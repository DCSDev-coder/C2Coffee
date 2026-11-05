import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { ApiError } from '../http/errors.js';

export type MarketingDrinkSelection = { menuItemId: number; quantity: number };

export async function consumeMarketingDrinkInventory(
  connection: PoolConnection,
  input: { tenantId: number; storeId: number; usageId: number; selections: MarketingDrinkSelection[]; adminUserId: number }
): Promise<void> {
  const itemIds = input.selections.map((item) => item.menuItemId);
  const [recipes] = await connection.query<RowDataPacket[]>(
    `SELECT r.menu_item_id, r.inventory_item_id, r.quantity_per_menu_item
       FROM inventory_menu_item_recipes r
       JOIN inventory_items inventory ON inventory.id = r.inventory_item_id
      WHERE r.tenant_id = ? AND r.menu_item_id IN (?) AND inventory.is_active = 1
      ORDER BY r.inventory_item_id`,
    [input.tenantId, itemIds]
  );

  const recipeItemIds = new Set(recipes.map((row) => Number(row.menu_item_id)));
  const missingRecipe = itemIds.find((id) => !recipeItemIds.has(id));
  if (missingRecipe) {
    throw new ApiError(409, 'marketing_recipe_required', 'Configure the drink inventory recipe before recording complimentary usage.');
  }

  const quantities = new Map(input.selections.map((item) => [item.menuItemId, item.quantity]));
  const required = new Map<number, number>();
  for (const row of recipes) {
    const inventoryItemId = Number(row.inventory_item_id);
    const quantity = Number(row.quantity_per_menu_item) * (quantities.get(Number(row.menu_item_id)) ?? 0);
    required.set(inventoryItemId, (required.get(inventoryItemId) ?? 0) + quantity);
  }

  for (const [inventoryItemId, quantity] of required) {
    const [stocks] = await connection.query<RowDataPacket[]>(
      `SELECT on_hand_quantity, reserved_quantity, average_unit_cost_rm
         FROM inventory_store_stocks
        WHERE tenant_id = :tenantId AND store_id = :storeId AND inventory_item_id = :inventoryItemId
        LIMIT 1 FOR UPDATE`,
      { tenantId: input.tenantId, storeId: input.storeId, inventoryItemId }
    );
    const stock = stocks[0];
    const available = stock ? Number(stock.on_hand_quantity) - Number(stock.reserved_quantity) : 0;
    if (!stock || available + 0.000001 < quantity) {
      throw new ApiError(409, 'marketing_stock_unavailable', 'There is not enough unreserved stock for this complimentary drink.');
    }
    const balanceAfter = Number(stock.on_hand_quantity) - quantity;
    const unitCost = Number(stock.average_unit_cost_rm ?? 0);
    await connection.execute(
      `UPDATE inventory_store_stocks
          SET on_hand_quantity = :balanceAfter, updated_at = UTC_TIMESTAMP()
        WHERE tenant_id = :tenantId AND store_id = :storeId AND inventory_item_id = :inventoryItemId`,
      { balanceAfter, tenantId: input.tenantId, storeId: input.storeId, inventoryItemId }
    );
    await connection.execute(
      `INSERT INTO marketing_drink_inventory_lines
         (usage_id, inventory_item_id, quantity, unit_cost_rm, total_cost_rm)
       VALUES (:usageId, :inventoryItemId, :quantity, :unitCost, :totalCost)`,
      { usageId: input.usageId, inventoryItemId, quantity, unitCost, totalCost: quantity * unitCost }
    );
    await connection.execute(
      `INSERT INTO inventory_movements
         (tenant_id, store_id, inventory_item_id, order_id, marketing_drink_usage_id,
          movement_type, quantity_change, unit_cost_rm, total_cost_rm, balance_after,
          note, created_by_admin_user_id, created_at)
       VALUES (:tenantId, :storeId, :inventoryItemId, NULL, :usageId,
               'marketing_consumption', :quantityChange, :unitCost, :totalCost, :balanceAfter,
               'Complimentary / marketing drink usage', :adminUserId, UTC_TIMESTAMP())`,
      {
        tenantId: input.tenantId, storeId: input.storeId, inventoryItemId,
        usageId: input.usageId, quantityChange: -quantity, unitCost,
        totalCost: quantity * unitCost, balanceAfter, adminUserId: input.adminUserId
      }
    );
  }
}

export async function reverseMarketingDrinkInventory(
  connection: PoolConnection,
  input: { tenantId: number; usageId: number; adminUserId: number }
): Promise<void> {
  const [lines] = await connection.query<RowDataPacket[]>(
    `SELECT line.inventory_item_id, line.quantity, line.unit_cost_rm, usage.store_id
       FROM marketing_drink_inventory_lines line
       JOIN marketing_drink_usages usage ON usage.id = line.usage_id
      WHERE line.usage_id = :usageId AND usage.tenant_id = :tenantId AND line.status = 'consumed'
      ORDER BY line.inventory_item_id FOR UPDATE`,
    input
  );
  if (lines.length === 0) throw new ApiError(409, 'marketing_usage_not_reversible', 'This usage has already been reversed or has no inventory lines.');
  for (const line of lines) {
    const inventoryItemId = Number(line.inventory_item_id);
    const quantity = Number(line.quantity);
    const [stocks] = await connection.query<RowDataPacket[]>(
      `SELECT on_hand_quantity FROM inventory_store_stocks
        WHERE tenant_id = :tenantId AND store_id = :storeId AND inventory_item_id = :inventoryItemId
        LIMIT 1 FOR UPDATE`,
      { tenantId: input.tenantId, storeId: line.store_id, inventoryItemId }
    );
    if (!stocks[0]) throw new ApiError(409, 'marketing_stock_record_missing', 'The inventory stock record required for reversal is missing.');
    const balanceAfter = Number(stocks[0].on_hand_quantity) + quantity;
    await connection.execute(
      `UPDATE inventory_store_stocks SET on_hand_quantity = :balanceAfter, updated_at = UTC_TIMESTAMP()
        WHERE tenant_id = :tenantId AND store_id = :storeId AND inventory_item_id = :inventoryItemId`,
      { balanceAfter, tenantId: input.tenantId, storeId: line.store_id, inventoryItemId }
    );
    await connection.execute(
      `INSERT INTO inventory_movements
         (tenant_id, store_id, inventory_item_id, order_id, marketing_drink_usage_id,
          movement_type, quantity_change, unit_cost_rm, total_cost_rm, balance_after,
          note, created_by_admin_user_id, created_at)
       VALUES (:tenantId, :storeId, :inventoryItemId, NULL, :usageId,
               'marketing_reversal', :quantity, :unitCost, :totalCost, :balanceAfter,
               'Reversal of complimentary / marketing drink usage', :adminUserId, UTC_TIMESTAMP())`,
      { tenantId: input.tenantId, storeId: line.store_id, inventoryItemId, usageId: input.usageId,
        quantity, unitCost: line.unit_cost_rm, totalCost: quantity * Number(line.unit_cost_rm), balanceAfter, adminUserId: input.adminUserId }
    );
  }
  await connection.execute(
    `UPDATE marketing_drink_inventory_lines SET status = 'reversed', reversed_at = UTC_TIMESTAMP()
      WHERE usage_id = :usageId AND status = 'consumed'`,
    { usageId: input.usageId }
  );
}
