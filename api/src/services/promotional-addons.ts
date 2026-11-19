import crypto from 'node:crypto';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { ApiError } from '../http/errors.js';

export type PromotionalAssignmentMode = 'customer_choice' | 'server_random';
export type PromotionalPriceMode = 'free' | 'fixed_rm' | 'fixed_token';

export type PromotionalQualificationItem = {
  menu_item_id: number;
  category_id: number;
  product_kind_code: string;
  quantity: number;
  line_type?: 'sale' | 'promotional_addon';
};

export type PromotionalQualification = {
  minimum_quantity: number;
  qualifying_product_kind_codes: string[];
  qualifying_category_ids: number[];
  qualifying_menu_item_ids: number[];
};

export type PromotionalRewardAvailability = {
  menu_item_id: number;
  available_quantity: number;
};

function normalized(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export function isCampaignQualified(
  campaign: PromotionalQualification,
  items: PromotionalQualificationItem[],
): boolean {
  const kinds = new Set(campaign.qualifying_product_kind_codes.map(normalized));
  const categories = new Set(campaign.qualifying_category_ids.map(Number));
  const menuItems = new Set(campaign.qualifying_menu_item_ids.map(Number));
  const hasRules = kinds.size > 0 || categories.size > 0 || menuItems.size > 0;
  const matchingUnits = items.reduce((total, item) => {
    if ((item.line_type ?? 'sale') !== 'sale') return total;
    const matches = !hasRules ||
      kinds.has(normalized(item.product_kind_code)) ||
      categories.has(Number(item.category_id)) ||
      menuItems.has(Number(item.menu_item_id));
    return matches ? total + Math.max(0, Number(item.quantity) || 0) : total;
  }, 0);
  return matchingUnits >= Math.max(1, Number(campaign.minimum_quantity) || 1);
}

export function choosePromotionalReward(input: {
  assignmentMode: PromotionalAssignmentMode;
  selectedMenuItemId: number | null;
  rewards: PromotionalRewardAvailability[];
  randomIndex?: (upperExclusive: number) => number;
}): number {
  const available = input.rewards.filter((reward) => Number(reward.available_quantity) > 0);
  if (available.length === 0) {
    throw new ApiError(409, 'promotional_reward_unavailable', 'The promotional gift is currently out of stock.');
  }
  if (input.assignmentMode === 'customer_choice') {
    if (!input.selectedMenuItemId) {
      throw new ApiError(400, 'promotional_reward_selection_required', 'Choose a promotional gift before checkout.');
    }
    const selected = available.find((reward) => reward.menu_item_id === input.selectedMenuItemId);
    if (!selected) {
      throw new ApiError(409, 'promotional_reward_unavailable', 'The selected promotional gift is no longer available.');
    }
    return selected.menu_item_id;
  }
  const randomIndex = input.randomIndex ?? ((upperExclusive: number) => crypto.randomInt(upperExclusive));
  const index = randomIndex(available.length);
  if (!Number.isInteger(index) || index < 0 || index >= available.length) {
    throw new Error('Promotional reward random index was outside the available range.');
  }
  return available[index].menu_item_id;
}

type CampaignRow = RowDataPacket & {
  id: number;
  tenant_id: number;
  code: string;
  name: string;
  assignment_mode: PromotionalAssignmentMode;
  legacy_fallback: 'random' | 'no_reward';
  allow_decline: number;
  price_mode: PromotionalPriceMode;
  fixed_price_rm: string | null;
  fixed_token_amount: number | null;
  minimum_quantity: number;
  qualifying_product_kind_codes_json: string | string[];
};

type RewardRow = RowDataPacket & {
  menu_item_id: number;
  name: string;
  image_url: string | null;
  base_price_rm: string;
  base_price_token: number;
  inventory_item_id: number | null;
  quantity_per_menu_item: string | null;
  on_hand_quantity: string | null;
  reserved_quantity: string | null;
};

export type PromotionalAddonResolution = {
  campaignId: number;
  tenantId: number;
  campaignCode: string;
  campaignName: string;
  assignmentMode: PromotionalAssignmentMode;
  allowDecline: boolean;
  priceMode: PromotionalPriceMode;
  priceRm: number;
  tokenAmount: number;
  qualificationSummary: string;
  rewardMenuItemId: number;
  rewardName: string;
  rewardImageUrl: string | null;
  normalPriceRm: number;
  availableRewards: Array<{
    menu_item_id: number;
    name: string;
    image_url: string | null;
    available_quantity: number;
    is_available: boolean;
  }>;
};

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

async function loadRewardAvailability(
  connection: PoolConnection,
  campaignId: number,
  tenantId: number,
  storeId: number,
  lockStock: boolean,
) {
  if (lockStock) {
    await connection.query(
      `SELECT stock.id
         FROM promotional_addon_reward_items rewards
         JOIN inventory_menu_item_recipes recipe
           ON recipe.menu_item_id = rewards.menu_item_id AND recipe.tenant_id = :tenantId
         JOIN inventory_store_stocks stock
           ON stock.store_id = :storeId AND stock.inventory_item_id = recipe.inventory_item_id
        WHERE rewards.campaign_id = :campaignId AND rewards.is_active = 1
        ORDER BY stock.id
        FOR UPDATE`,
      { campaignId, tenantId, storeId },
    );
  }
  const [rows] = await connection.query<RewardRow[]>(
    `SELECT rewards.menu_item_id, item.name, item.image_url,
            CAST(item.base_price_rm AS CHAR) AS base_price_rm,
            item.base_price_token,
            recipe.inventory_item_id,
            CAST(recipe.quantity_per_menu_item AS CHAR) AS quantity_per_menu_item,
            CAST(stock.on_hand_quantity AS CHAR) AS on_hand_quantity,
            CAST(stock.reserved_quantity AS CHAR) AS reserved_quantity
       FROM promotional_addon_reward_items rewards
       JOIN menu_items item ON item.id = rewards.menu_item_id
       LEFT JOIN inventory_menu_item_recipes recipe
         ON recipe.menu_item_id = item.id AND recipe.tenant_id = :tenantId
       LEFT JOIN inventory_store_stocks stock
         ON stock.store_id = :storeId AND stock.inventory_item_id = recipe.inventory_item_id
      WHERE rewards.campaign_id = :campaignId AND rewards.is_active = 1
        AND item.is_active = 1 AND item.sale_visibility = 'promotion_only'
      ORDER BY rewards.sort_order, rewards.menu_item_id, recipe.inventory_item_id`,
    { campaignId, tenantId, storeId },
  );
  const rewards = new Map<number, { menu_item_id: number; name: string; image_url: string | null; normal_price_rm: number; available_quantity: number; has_recipe: boolean }>();
  for (const row of rows) {
    const existing = rewards.get(row.menu_item_id) ?? {
      menu_item_id: row.menu_item_id,
      name: row.name,
      image_url: row.image_url,
      normal_price_rm: Number(row.base_price_rm),
      available_quantity: Number.MAX_SAFE_INTEGER,
      has_recipe: false,
    };
    if (row.inventory_item_id && Number(row.quantity_per_menu_item) > 0) {
      existing.has_recipe = true;
      const availableStock = Math.max(0, Number(row.on_hand_quantity ?? 0) - Number(row.reserved_quantity ?? 0));
      existing.available_quantity = Math.min(existing.available_quantity, Math.floor(availableStock / Number(row.quantity_per_menu_item)));
    }
    rewards.set(row.menu_item_id, existing);
  }
  return [...rewards.values()].map((reward) => ({
    ...reward,
    available_quantity: reward.has_recipe && Number.isFinite(reward.available_quantity) ? reward.available_quantity : 0,
  }));
}

export async function resolvePromotionalAddonForCheckout(connection: PoolConnection, input: {
  tenantId: number;
  storeId: number;
  paymentMode: 'token' | 'direct';
  channel: 'mobile' | 'counter';
  clientCapabilities: string[];
  selectedRewardMenuItemId: number | null;
  declined: boolean;
  items: PromotionalQualificationItem[];
  lockStock?: boolean;
  requireSelection?: boolean;
}): Promise<PromotionalAddonResolution | null> {
  const campaignLock = input.lockStock === false ? '' : 'FOR UPDATE';
  const [campaignRows] = await connection.query<CampaignRow[]>(
    `SELECT campaign.*
       FROM promotional_addon_campaigns campaign
      WHERE campaign.tenant_id = :tenantId AND campaign.status = 'active'
        AND (campaign.starts_at IS NULL OR campaign.starts_at <= UTC_TIMESTAMP())
        AND (campaign.ends_at IS NULL OR campaign.ends_at > UTC_TIMESTAMP())
        AND JSON_CONTAINS(campaign.payment_modes_json, JSON_QUOTE(:paymentMode))
        AND JSON_CONTAINS(campaign.sales_channels_json, JSON_QUOTE(:channel))
        AND (NOT EXISTS (SELECT 1 FROM promotional_addon_campaign_stores scope WHERE scope.campaign_id = campaign.id)
             OR EXISTS (SELECT 1 FROM promotional_addon_campaign_stores scope WHERE scope.campaign_id = campaign.id AND scope.store_id = :storeId))
      ORDER BY campaign.priority DESC, campaign.id ASC
      ${campaignLock}`,
    input,
  );

  for (const campaign of campaignRows) {
    const [categoryRows] = await connection.query<Array<RowDataPacket & { category_id: number }>>(
      'SELECT category_id FROM promotional_addon_qualifying_categories WHERE campaign_id = :campaignId',
      { campaignId: campaign.id },
    );
    const [itemRows] = await connection.query<Array<RowDataPacket & { menu_item_id: number }>>(
      'SELECT menu_item_id FROM promotional_addon_qualifying_items WHERE campaign_id = :campaignId',
      { campaignId: campaign.id },
    );
    const qualification: PromotionalQualification = {
      minimum_quantity: campaign.minimum_quantity,
      qualifying_product_kind_codes: parseStringArray(campaign.qualifying_product_kind_codes_json),
      qualifying_category_ids: categoryRows.map((row) => Number(row.category_id)),
      qualifying_menu_item_ids: itemRows.map((row) => Number(row.menu_item_id)),
    };
    if (!isCampaignQualified(qualification, input.items)) continue;

    const supportsFeature = input.clientCapabilities.includes('promotion_addons_v1');
    let assignmentMode = campaign.assignment_mode;
    if (!supportsFeature) {
      // Older app versions must never receive an unexpected paid line item.
      if (campaign.legacy_fallback === 'no_reward' || campaign.price_mode !== 'free') return null;
      assignmentMode = 'server_random';
    }
    if (input.declined && campaign.allow_decline === 1 && supportsFeature) return null;
    const rewards = await loadRewardAvailability(connection, campaign.id, input.tenantId, input.storeId, input.lockStock !== false);
    if (!input.selectedRewardMenuItemId && !rewards.some((reward) => reward.available_quantity > 0)) {
      // “While stocks last” must not prevent the customer from buying the
      // qualifying products. A stale explicit choice still returns the
      // unavailable error below so the customer can choose again.
      continue;
    }
    const rewardMenuItemId = assignmentMode === 'customer_choice' && input.requireSelection === false && !input.selectedRewardMenuItemId
      ? rewards.find((reward) => reward.available_quantity > 0)?.menu_item_id
      : choosePromotionalReward({ assignmentMode, selectedMenuItemId: input.selectedRewardMenuItemId, rewards });
    if (!rewardMenuItemId) {
      throw new ApiError(409, 'promotional_reward_unavailable', 'The promotional gift is currently out of stock.');
    }
    const reward = rewards.find((candidate) => candidate.menu_item_id === rewardMenuItemId)!;
    return {
      campaignId: campaign.id,
      tenantId: campaign.tenant_id,
      campaignCode: campaign.code,
      campaignName: campaign.name,
      assignmentMode,
      allowDecline: campaign.allow_decline === 1,
      priceMode: campaign.price_mode,
      priceRm: campaign.price_mode === 'fixed_rm' ? Number(campaign.fixed_price_rm ?? 0) : 0,
      tokenAmount: campaign.price_mode === 'fixed_token' ? Number(campaign.fixed_token_amount ?? 0) : 0,
      qualificationSummary: `${campaign.minimum_quantity} qualifying item${campaign.minimum_quantity === 1 ? '' : 's'}`,
      rewardMenuItemId,
      rewardName: reward.name,
      rewardImageUrl: reward.image_url,
      normalPriceRm: reward.normal_price_rm,
      availableRewards: rewards.map((candidate) => ({
        menu_item_id: candidate.menu_item_id,
        name: candidate.name,
        image_url: candidate.image_url,
        available_quantity: candidate.available_quantity,
        is_available: candidate.available_quantity > 0,
      })),
    };
  }
  return null;
}

export async function insertPromotionalAddonOrderLine(
  connection: PoolConnection,
  orderId: number,
  storeId: number,
  promotion: PromotionalAddonResolution,
): Promise<number> {
  const [itemResult] = await connection.execute<ResultSetHeader>(
    `INSERT INTO order_items
       (order_id, menu_item_id, line_type, item_name_snapshot, base_price_rm_snapshot,
        token_price_snapshot, quantity, line_subtotal_rm, line_token_amount, is_qualifying_cup)
     VALUES
       (:orderId, :menuItemId, 'promotional_addon', :name, :priceRm,
        :tokenAmount, 1, :priceRm, :tokenAmount, 0)`,
    {
      orderId,
      menuItemId: promotion.rewardMenuItemId,
      name: promotion.rewardName,
      priceRm: promotion.priceRm.toFixed(2),
      tokenAmount: promotion.tokenAmount,
    },
  );
  await connection.execute(
    `INSERT INTO order_promotional_addons
       (order_id, order_item_id, campaign_id, reward_menu_item_id,
        campaign_code_snapshot, campaign_name_snapshot, assignment_mode_snapshot,
        reward_name_snapshot, reward_image_url_snapshot, normal_price_rm_snapshot,
        promotional_price_rm_snapshot, promotional_token_amount_snapshot,
        discount_rm_snapshot, quantity, qualification_summary_snapshot, store_id)
     VALUES
       (:orderId, :orderItemId, :campaignId, :rewardMenuItemId,
        :campaignCode, :campaignName, :assignmentMode,
        :rewardName, :rewardImageUrl, :normalPriceRm,
        :priceRm, :tokenAmount, :discountRm, 1, :qualificationSummary, :storeId)`,
    {
      orderId,
      orderItemId: itemResult.insertId,
      campaignId: promotion.campaignId,
      rewardMenuItemId: promotion.rewardMenuItemId,
      campaignCode: promotion.campaignCode,
      campaignName: promotion.campaignName,
      assignmentMode: promotion.assignmentMode,
      rewardName: promotion.rewardName,
      rewardImageUrl: promotion.rewardImageUrl,
      normalPriceRm: promotion.normalPriceRm.toFixed(2),
      priceRm: promotion.priceRm.toFixed(2),
      tokenAmount: promotion.tokenAmount,
      discountRm: Math.max(0, promotion.normalPriceRm - promotion.priceRm).toFixed(2),
      qualificationSummary: promotion.qualificationSummary,
      storeId,
    },
  );
  await connection.execute(
    `INSERT INTO promotional_addon_events
       (tenant_id, campaign_id, order_id, event_type, metadata_json)
     VALUES (:tenantId, :campaignId, :orderId, :eventType,
             JSON_OBJECT('reward_menu_item_id', :rewardMenuItemId))`,
    {
      tenantId: promotion.tenantId,
      campaignId: promotion.campaignId,
      orderId,
      eventType: promotion.assignmentMode === 'server_random' ? 'assigned_randomly' : 'selected',
      rewardMenuItemId: promotion.rewardMenuItemId,
    },
  );
  return itemResult.insertId;
}

export async function fulfilPromotionalAddonForOrder(connection: PoolConnection, orderId: number): Promise<void> {
  await connection.execute(
    `UPDATE order_promotional_addons
        SET fulfilment_status = 'fulfilled', fulfilled_at = COALESCE(fulfilled_at, UTC_TIMESTAMP())
      WHERE order_id = :orderId AND fulfilment_status = 'pending'`,
    { orderId },
  );
  await connection.execute(
    `INSERT INTO promotional_addon_events (tenant_id, campaign_id, order_id, event_type, metadata_json)
     SELECT campaign.tenant_id, assignment.campaign_id, assignment.order_id, 'fulfilled', NULL
       FROM order_promotional_addons assignment
       JOIN promotional_addon_campaigns campaign ON campaign.id = assignment.campaign_id
      WHERE assignment.order_id = :orderId AND assignment.fulfilment_status = 'fulfilled'
        AND NOT EXISTS (
          SELECT 1 FROM promotional_addon_events event
           WHERE event.order_id = assignment.order_id AND event.campaign_id = assignment.campaign_id AND event.event_type = 'fulfilled'
        )`,
    { orderId },
  );
}

export async function cancelPromotionalAddonForOrder(connection: PoolConnection, orderId: number): Promise<void> {
  await connection.execute(
    `UPDATE order_promotional_addons
        SET fulfilment_status = 'cancelled'
      WHERE order_id = :orderId AND fulfilment_status = 'pending'`,
    { orderId },
  );
  await connection.execute(
    `INSERT INTO promotional_addon_events (tenant_id, campaign_id, order_id, event_type, metadata_json)
     SELECT campaign.tenant_id, assignment.campaign_id, assignment.order_id, 'cancelled', NULL
       FROM order_promotional_addons assignment
       JOIN promotional_addon_campaigns campaign ON campaign.id = assignment.campaign_id
      WHERE assignment.order_id = :orderId AND assignment.fulfilment_status = 'cancelled'
        AND NOT EXISTS (
          SELECT 1 FROM promotional_addon_events event
           WHERE event.order_id = assignment.order_id AND event.campaign_id = assignment.campaign_id AND event.event_type = 'cancelled'
        )`,
    { orderId },
  );
}

export async function recordPromotionalAddonRefundDisposition(
  connection: PoolConnection,
  orderId: number,
  disposition: 'returned' | 'retained' | undefined,
  inventoryAlreadyReversed: boolean,
): Promise<void> {
  const [assignments] = await connection.query<Array<RowDataPacket & {
    campaign_id: number;
    order_item_id: number;
    fulfilment_status: string;
  }>>(
    `SELECT campaign_id, order_item_id, fulfilment_status
       FROM order_promotional_addons
      WHERE order_id = :orderId
      LIMIT 1 FOR UPDATE`,
    { orderId },
  );
  const assignment = assignments[0];
  if (!assignment) return;
  if (assignment.fulfilment_status === 'pending') {
    await cancelPromotionalAddonForOrder(connection, orderId);
    return;
  }
  if (assignment.fulfilment_status !== 'fulfilled') return;
  if (!disposition) {
    throw new ApiError(400, 'promotional_gift_disposition_required', 'Confirm whether the promotional gift was returned or kept by the customer.');
  }

  const shouldRestoreReturnedGift = disposition === 'returned' && !inventoryAlreadyReversed;
  const shouldReconsumeRetainedGift = disposition === 'retained' && inventoryAlreadyReversed;
  if (shouldRestoreReturnedGift || shouldReconsumeRetainedGift) {
    const [usageRows] = await connection.query<Array<RowDataPacket & {
      tenant_id: number;
      store_id: number;
      inventory_item_id: number;
      total_quantity: string;
    }>>(
      `SELECT tenant_id, store_id, inventory_item_id,
              CAST(SUM(total_quantity) AS CHAR) AS total_quantity
         FROM inventory_order_usage_lines
        WHERE order_id = :orderId AND order_item_id = :orderItemId
        GROUP BY tenant_id, store_id, inventory_item_id
        ORDER BY inventory_item_id`,
      { orderId, orderItemId: assignment.order_item_id },
    );
    for (const usage of usageRows) {
      const amount = Math.round(Number(usage.total_quantity) * 1000) / 1000;
      if (amount <= 0) continue;
      const [stocks] = await connection.query<Array<RowDataPacket & {
        id: number;
        on_hand_quantity: string;
      }>>(
        `SELECT id, CAST(on_hand_quantity AS CHAR) AS on_hand_quantity
           FROM inventory_store_stocks
          WHERE store_id = :storeId AND inventory_item_id = :inventoryItemId
          LIMIT 1 FOR UPDATE`,
        { storeId: usage.store_id, inventoryItemId: usage.inventory_item_id },
      );
      const stock = stocks[0];
      if (!stock) throw new ApiError(409, 'inventory_stock_not_configured', 'Promotional gift stock is not configured for this outlet.');
      const delta = shouldRestoreReturnedGift ? amount : -amount;
      const balanceAfter = Math.round((Number(stock.on_hand_quantity) + delta) * 1000) / 1000;
      if (balanceAfter < 0) throw new ApiError(409, 'inventory_balance_conflict', 'Promotional gift stock cannot be reconciled for this refund.');
      await connection.execute(
        `UPDATE inventory_store_stocks SET on_hand_quantity = :balanceAfter WHERE id = :stockId`,
        { balanceAfter, stockId: stock.id },
      );
      await connection.execute(
        `INSERT INTO inventory_movements
           (tenant_id, store_id, inventory_item_id, order_id, movement_type,
            quantity_change, balance_after, note, created_at)
         VALUES
           (:tenantId, :storeId, :inventoryItemId, :orderId, :movementType,
            :quantityChange, :balanceAfter, :note, UTC_TIMESTAMP())`,
        {
          tenantId: usage.tenant_id,
          storeId: usage.store_id,
          inventoryItemId: usage.inventory_item_id,
          orderId,
          movementType: shouldRestoreReturnedGift ? 'promotional_return' : 'promotional_retained',
          quantityChange: delta,
          balanceAfter,
          note: shouldRestoreReturnedGift
            ? 'Promotional gift physically returned with refunded order.'
            : 'Promotional gift retained by customer after refunded order.',
        },
      );
    }
  }

  const eventType = disposition === 'returned' ? 'returned' : 'retained_after_refund';
  await connection.execute(
    `UPDATE order_promotional_addons
        SET fulfilment_status = :status,
            returned_at = CASE WHEN :status = 'returned' THEN UTC_TIMESTAMP() ELSE returned_at END
      WHERE order_id = :orderId AND fulfilment_status = 'fulfilled'`,
    { orderId, status: eventType },
  );
  await connection.execute(
    `INSERT INTO promotional_addon_events (tenant_id, campaign_id, order_id, event_type, metadata_json)
     SELECT campaign.tenant_id, assignment.campaign_id, assignment.order_id, :eventType, NULL
       FROM order_promotional_addons assignment
       JOIN promotional_addon_campaigns campaign ON campaign.id = assignment.campaign_id
      WHERE assignment.order_id = :orderId
        AND NOT EXISTS (
          SELECT 1 FROM promotional_addon_events event
           WHERE event.order_id = assignment.order_id AND event.campaign_id = assignment.campaign_id AND event.event_type = :eventType
        )`,
    { orderId, eventType },
  );
}
