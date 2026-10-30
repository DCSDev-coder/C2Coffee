import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

import { ApiError } from '../http/errors.js';

type RequirementRow = RowDataPacket & {
  tenant_id: number;
  store_id: number;
  inventory_item_id: number;
  item_name: string;
  required_quantity: string;
};

type AllocationRow = RowDataPacket & {
  id: number;
  tenant_id: number;
  store_id: number;
  inventory_item_id: number;
  quantity: string;
  status: 'reserved' | 'consumed' | 'released' | 'reversed';
};

type StockRow = RowDataPacket & {
  id: number;
  on_hand_quantity: string;
  reserved_quantity: string;
};

function quantity(value: unknown): number {
  return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
}

async function loadRequirements(
  connection: PoolConnection,
  orderId: number
): Promise<RequirementRow[]> {
  const [rows] = await connection.query<RequirementRow[]>(
    `SELECT s.tenant_id, o.store_id, r.inventory_item_id, ii.name AS item_name,
            CAST(SUM(r.quantity_per_menu_item * oi.quantity) AS CHAR) AS required_quantity
       FROM orders o
       JOIN stores s ON s.id = o.store_id
       JOIN order_items oi ON oi.order_id = o.id
       JOIN inventory_menu_item_recipes r
         ON r.menu_item_id = oi.menu_item_id AND r.tenant_id = s.tenant_id
       JOIN inventory_items ii
         ON ii.id = r.inventory_item_id AND ii.tenant_id = s.tenant_id AND ii.is_active = 1
      WHERE o.id = :orderId
      GROUP BY s.tenant_id, o.store_id, r.inventory_item_id, ii.name
      ORDER BY r.inventory_item_id
      FOR UPDATE`,
    { orderId }
  );
  return rows;
}

async function lockAllocations(
  connection: PoolConnection,
  orderId: number
): Promise<AllocationRow[]> {
  const [rows] = await connection.query<AllocationRow[]>(
    `SELECT id, tenant_id, store_id, inventory_item_id,
            CAST(quantity AS CHAR) AS quantity, status
       FROM inventory_order_allocations
      WHERE order_id = :orderId
      ORDER BY inventory_item_id
      FOR UPDATE`,
    { orderId }
  );
  return rows;
}

async function lockStock(
  connection: PoolConnection,
  storeId: number,
  inventoryItemId: number
): Promise<StockRow> {
  const [rows] = await connection.query<StockRow[]>(
    `SELECT id, CAST(on_hand_quantity AS CHAR) AS on_hand_quantity,
            CAST(reserved_quantity AS CHAR) AS reserved_quantity
       FROM inventory_store_stocks
      WHERE store_id = :storeId AND inventory_item_id = :inventoryItemId
      LIMIT 1 FOR UPDATE`,
    { storeId, inventoryItemId }
  );
  if (!rows[0]) {
    throw new ApiError(
      409,
      'inventory_stock_not_configured',
      'Stock has not been configured for one or more ingredients used by this order.'
    );
  }
  return rows[0];
}

/**
 * Places an idempotent stock hold for an order. This is called after the order
 * item snapshots are written so mobile and counter orders share one source of
 * truth. Orders without configured recipes remain valid and consume no stock.
 */
export async function reserveInventoryForOrder(
  connection: PoolConnection,
  orderId: number
): Promise<{ reservedComponents: number }> {
  const existing = await lockAllocations(connection, orderId);
  if (existing.some((row) => row.status === 'reserved' || row.status === 'consumed')) {
    return { reservedComponents: existing.filter((row) => row.status === 'reserved').length };
  }

  const requirements = await loadRequirements(connection, orderId);
  for (const requirement of requirements) {
    const required = quantity(requirement.required_quantity);
    if (required <= 0) continue;
    const stock = await lockStock(connection, requirement.store_id, requirement.inventory_item_id);
    const available = quantity(Number(stock.on_hand_quantity) - Number(stock.reserved_quantity));
    if (available < required) {
      throw new ApiError(
        409,
        'inventory_insufficient_stock',
        `${requirement.item_name} does not have enough available stock for this order.`
      );
    }
  }

  for (const requirement of requirements) {
    const required = quantity(requirement.required_quantity);
    if (required <= 0) continue;
    await connection.execute(
      `UPDATE inventory_store_stocks
          SET reserved_quantity = reserved_quantity + :required
        WHERE store_id = :storeId AND inventory_item_id = :inventoryItemId`,
      {
        required,
        storeId: requirement.store_id,
        inventoryItemId: requirement.inventory_item_id
      }
    );
    await connection.execute(
      `INSERT INTO inventory_order_allocations
         (tenant_id, store_id, order_id, inventory_item_id, quantity, status, reserved_at)
       VALUES
         (:tenantId, :storeId, :orderId, :inventoryItemId, :required, 'reserved', UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE
         quantity = VALUES(quantity), status = 'reserved', reserved_at = UTC_TIMESTAMP(),
         consumed_at = NULL, released_at = NULL, reversed_at = NULL`,
      {
        tenantId: requirement.tenant_id,
        storeId: requirement.store_id,
        orderId,
        inventoryItemId: requirement.inventory_item_id,
        required
      }
    );
  }
  return { reservedComponents: requirements.length };
}

export async function releaseInventoryForOrder(
  connection: PoolConnection,
  orderId: number
): Promise<{ releasedComponents: number }> {
  const allocations = (await lockAllocations(connection, orderId)).filter(
    (row) => row.status === 'reserved'
  );
  for (const allocation of allocations) {
    await lockStock(connection, allocation.store_id, allocation.inventory_item_id);
    await connection.execute(
      `UPDATE inventory_store_stocks
          SET reserved_quantity = GREATEST(0, reserved_quantity - :amount)
        WHERE store_id = :storeId AND inventory_item_id = :inventoryItemId`,
      {
        amount: quantity(allocation.quantity),
        storeId: allocation.store_id,
        inventoryItemId: allocation.inventory_item_id
      }
    );
    await connection.execute(
      `UPDATE inventory_order_allocations
          SET status = 'released', released_at = UTC_TIMESTAMP()
        WHERE id = :allocationId AND status = 'reserved'`,
      { allocationId: allocation.id }
    );
  }
  return { releasedComponents: allocations.length };
}

export async function consumeInventoryForOrder(
  connection: PoolConnection,
  orderId: number
): Promise<{ consumedComponents: number }> {
  const allocations = (await lockAllocations(connection, orderId)).filter(
    (row) => row.status === 'reserved'
  );
  for (const allocation of allocations) {
    const amount = quantity(allocation.quantity);
    const stock = await lockStock(connection, allocation.store_id, allocation.inventory_item_id);
    const balanceAfter = quantity(Number(stock.on_hand_quantity) - amount);
    if (balanceAfter < 0) {
      throw new ApiError(409, 'inventory_balance_conflict', 'Reserved inventory is no longer available. Review the stock balance before collection.');
    }
    await connection.execute(
      `UPDATE inventory_store_stocks
          SET on_hand_quantity = on_hand_quantity - :amount,
              reserved_quantity = GREATEST(0, reserved_quantity - :amount)
        WHERE id = :stockId`,
      { amount, stockId: stock.id }
    );
    await connection.execute(
      `INSERT IGNORE INTO inventory_movements
         (tenant_id, store_id, inventory_item_id, order_id, movement_type,
          quantity_change, balance_after, note, created_at)
       VALUES
         (:tenantId, :storeId, :inventoryItemId, :orderId, 'consumption',
          :quantityChange, :balanceAfter, 'Consumed when order was collected.', UTC_TIMESTAMP())`,
      {
        tenantId: allocation.tenant_id,
        storeId: allocation.store_id,
        inventoryItemId: allocation.inventory_item_id,
        orderId,
        quantityChange: -amount,
        balanceAfter
      }
    );
    await connection.execute(
      `UPDATE inventory_order_allocations
          SET status = 'consumed', consumed_at = UTC_TIMESTAMP()
        WHERE id = :allocationId AND status = 'reserved'`,
      { allocationId: allocation.id }
    );
  }
  return { consumedComponents: allocations.length };
}

export async function reverseInventoryForOrder(
  connection: PoolConnection,
  orderId: number
): Promise<{ reversedComponents: number; releasedComponents: number }> {
  const allocations = await lockAllocations(connection, orderId);
  let reversedComponents = 0;
  let releasedComponents = 0;
  for (const allocation of allocations) {
    if (allocation.status === 'reserved') {
      await lockStock(connection, allocation.store_id, allocation.inventory_item_id);
      await connection.execute(
        `UPDATE inventory_store_stocks
            SET reserved_quantity = GREATEST(0, reserved_quantity - :amount)
          WHERE store_id = :storeId AND inventory_item_id = :inventoryItemId`,
        {
          amount: quantity(allocation.quantity),
          storeId: allocation.store_id,
          inventoryItemId: allocation.inventory_item_id
        }
      );
      await connection.execute(
        `UPDATE inventory_order_allocations
            SET status = 'released', released_at = UTC_TIMESTAMP()
          WHERE id = :allocationId AND status = 'reserved'`,
        { allocationId: allocation.id }
      );
      releasedComponents += 1;
      continue;
    }
    if (allocation.status !== 'consumed') continue;
    const amount = quantity(allocation.quantity);
    const stock = await lockStock(connection, allocation.store_id, allocation.inventory_item_id);
    const balanceAfter = quantity(Number(stock.on_hand_quantity) + amount);
    await connection.execute(
      `UPDATE inventory_store_stocks
          SET on_hand_quantity = on_hand_quantity + :amount
        WHERE id = :stockId`,
      { amount, stockId: stock.id }
    );
    await connection.execute(
      `INSERT IGNORE INTO inventory_movements
         (tenant_id, store_id, inventory_item_id, order_id, movement_type,
          quantity_change, balance_after, note, created_at)
       VALUES
         (:tenantId, :storeId, :inventoryItemId, :orderId, 'refund_reversal',
          :amount, :balanceAfter, 'Restored after an approved order refund.', UTC_TIMESTAMP())`,
      {
        tenantId: allocation.tenant_id,
        storeId: allocation.store_id,
        inventoryItemId: allocation.inventory_item_id,
        orderId,
        amount,
        balanceAfter
      }
    );
    await connection.execute(
      `UPDATE inventory_order_allocations
          SET status = 'reversed', reversed_at = UTC_TIMESTAMP()
        WHERE id = :allocationId AND status = 'consumed'`,
      { allocationId: allocation.id }
    );
    reversedComponents += 1;
  }
  return { reversedComponents, releasedComponents };
}
