import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { mysqlPool } from '../db/mysql.js';

export type LoyaltyTierConfig = {
  id: number;
  code: string;
  name: string;
  minCups: number;
  badgeColor: string | null;
  sortOrder: number;
  isActive: boolean;
  rewardConfig: LoyaltyTierRewardConfig | null;
};

export type LoyaltyTierRewardConfig = {
  voucherTemplateId: number;
};

type LoyaltyTierRow = RowDataPacket & {
  id: number;
  code: string;
  name: string;
  min_cups: number | string;
  badge_color: string | null;
  sort_order: number | string;
  is_active: number | string;
  reward_config_json: unknown;
};

function parseRewardConfig(value: unknown): LoyaltyTierRewardConfig | null {
  if (!value) return null;

  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== 'object') return null;
  const voucherTemplateId = Number((parsed as { voucherTemplateId?: unknown }).voucherTemplateId);
  return Number.isInteger(voucherTemplateId) && voucherTemplateId > 0
    ? { voucherTemplateId }
    : null;
}

export type TierProgress = {
  tierCode: string;
  tierName: string;
  current: number;
  target: number;
  remaining: number;
  percentage: number;
  nextTier: string;
  nextTierCode: string | null;
  isBaseTier: boolean;
};

export async function loadLoyaltyTiers(
  connection: PoolConnection | typeof mysqlPool = mysqlPool
): Promise<LoyaltyTierConfig[]> {
  const [rows] = await connection.query<LoyaltyTierRow[]>(
    `
      SELECT
        id,
        code,
        name,
        min_cups,
        badge_color,
        sort_order,
        is_active,
        reward_config_json
      FROM loyalty_tiers
      ORDER BY min_cups ASC, sort_order ASC, id ASC
    `
  );

  return rows.map((row) => ({
    id: Number(row.id),
    code: String(row.code ?? '').trim().toLowerCase(),
    name: String(row.name ?? '').trim(),
    minCups: Number(row.min_cups ?? 0),
    badgeColor: row.badge_color ? String(row.badge_color) : null,
    sortOrder: Number(row.sort_order ?? 0),
    isActive: Number(row.is_active ?? 0) === 1,
    rewardConfig: parseRewardConfig(row.reward_config_json)
  }));
}

export function getActiveLoyaltyTiers(tiers: LoyaltyTierConfig[]): LoyaltyTierConfig[] {
  return [...tiers]
    .filter((tier) => tier.isActive)
    .sort((a, b) => a.minCups - b.minCups || a.sortOrder - b.sortOrder || a.id - b.id);
}

export function getTierByCode(tiers: LoyaltyTierConfig[], tierCode: string | null | undefined): LoyaltyTierConfig | null {
  const code = String(tierCode ?? '').trim().toLowerCase();
  if (!code) {
    return null;
  }

  return tiers.find((tier) => tier.code === code) ?? null;
}

export function formatTierName(tiers: LoyaltyTierConfig[], tierCode: string | null | undefined): string {
  const tier = getTierByCode(tiers, tierCode);
  if (tier) {
    return tier.name;
  }

  const fallback = String(tierCode ?? '').trim();
  if (!fallback) {
    return 'Kawan';
  }

  return fallback
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function getTierProgress(
  cups: number,
  tiers: LoyaltyTierConfig[]
): TierProgress {
  const activeTiers = getActiveLoyaltyTiers(tiers);

  if (activeTiers.length === 0) {
    return {
      tierCode: 'kawan',
      tierName: 'Kawan',
      current: cups,
      target: cups,
      remaining: 0,
      percentage: 100,
      nextTier: 'Max Tier',
      nextTierCode: null,
      isBaseTier: true
    };
  }

  let currentTier = activeTiers[0];
  for (const tier of activeTiers) {
    if (cups >= tier.minCups) {
      currentTier = tier;
    } else {
      break;
    }
  }

  const currentIndex = activeTiers.findIndex((tier) => tier.code === currentTier.code);
  const nextTier = currentIndex >= 0 ? activeTiers[currentIndex + 1] ?? null : null;
  const target = nextTier ? nextTier.minCups : cups;
  const remaining = nextTier ? Math.max(0, nextTier.minCups - cups) : 0;
  const percentage = target > 0 ? Math.min(100, (cups / target) * 100) : 100;

  return {
    tierCode: currentTier.code,
    tierName: currentTier.name,
    current: cups,
    target,
    remaining,
    percentage,
    nextTier: nextTier ? nextTier.name : 'Max Tier',
    nextTierCode: nextTier ? nextTier.code : null,
    isBaseTier: currentIndex === 0
  };
}

export function getTierTargetByCode(tiers: LoyaltyTierConfig[], tierCode: string | null | undefined): number {
  const activeTiers = getActiveLoyaltyTiers(tiers);
  const tier = getTierByCode(activeTiers, tierCode);

  if (!tier) {
    return activeTiers[0]?.minCups ?? 0;
  }

  const currentIndex = activeTiers.findIndex((entry) => entry.code === tier.code);
  const nextTier = currentIndex >= 0 ? activeTiers[currentIndex + 1] ?? null : null;
  return nextTier?.minCups ?? tier.minCups;
}
