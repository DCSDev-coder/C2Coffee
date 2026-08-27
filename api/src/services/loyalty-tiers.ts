import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { mysqlPool } from '../db/mysql.js';

export type LoyaltyTierConfig = {
  id: number;
  code: string;
  name: string;
  minCups: number;
  promotionText: string;
  rewardConfigs: TierRewardConfig[];
  rewardConfig: TierRewardConfig | null;
  badgeColor: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type TierRewardCondition = {
  mode: 'always' | 'birthday';
  birthdayMatch: 'month_day' | 'month' | null;
};

export type TierRewardConfig = {
  enabled: boolean;
  label: string;
  kind: 'discount' | 'free_item' | 'promotion';
  discountUnit: 'token' | 'rm' | 'percent' | null;
  rewardItemType: 'drink' | 'food' | 'merchandise' | null;
  rewardValue: number | null;
  scope: 'all_items' | 'all_drinks' | 'all_food' | 'all_merchandise' | 'selected_skus' | 'all_except_skus';
  notes: string;
  condition: TierRewardCondition;
};

type LoyaltyTierRow = RowDataPacket & {
  id: number;
  code: string;
  name: string;
  min_cups: number | string;
  promotion_text: string | null;
  reward_config_json: string | Record<string, unknown> | null;
  badge_color: string | null;
  sort_order: number | string;
  is_active: number | string;
};

function normalizeRewardCondition(raw: Record<string, unknown> | null | undefined): TierRewardCondition {
  const mode = raw?.mode === 'birthday' ? 'birthday' : 'always';
  const birthdayMatch = raw?.birthdayMatch === 'month'
    ? 'month'
    : raw?.birthdayMatch === 'month_day'
      ? 'month_day'
      : null;

  return {
    mode,
    birthdayMatch: mode === 'birthday' ? birthdayMatch ?? 'month_day' : null
  };
}

function normalizeRewardConfig(value: unknown): TierRewardConfig | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const enabled = Boolean(raw.enabled ?? false);
  const label = String(raw.label ?? '').trim();
  const kind = raw.kind === 'discount' || raw.kind === 'free_item' ? raw.kind : 'promotion';
  const discountUnit = raw.discountUnit === 'token' || raw.discountUnit === 'rm' || raw.discountUnit === 'percent'
    ? raw.discountUnit
    : null;
  const rewardItemType = raw.rewardItemType === 'drink' || raw.rewardItemType === 'food' || raw.rewardItemType === 'merchandise'
    ? raw.rewardItemType
    : null;
  const rewardValueRaw = raw.rewardValue;
  const rewardValue = typeof rewardValueRaw === 'number' && Number.isFinite(rewardValueRaw)
    ? rewardValueRaw
    : typeof rewardValueRaw === 'string' && rewardValueRaw.trim() !== ''
      ? Number(rewardValueRaw)
      : null;
  const scope = raw.scope === 'all_items'
    || raw.scope === 'all_drinks'
    || raw.scope === 'all_food'
    || raw.scope === 'all_merchandise'
    || raw.scope === 'selected_skus'
    || raw.scope === 'all_except_skus'
      ? raw.scope
      : 'all_items';
  const notes = String(raw.notes ?? '').trim();
  const condition = normalizeRewardCondition(
    raw.condition && typeof raw.condition === 'object'
      ? (raw.condition as Record<string, unknown>)
      : null
  );

  if (!enabled && !label && rewardValue == null && discountUnit == null && rewardItemType == null && notes === '') {
    return null;
  }

  return {
    enabled,
    label,
    kind,
    discountUnit,
    rewardItemType,
    rewardValue,
    scope,
    notes,
    condition
  };
}

function parseRewardConfigs(value: LoyaltyTierRow['reward_config_json']): TierRewardConfig[] {
  if (value == null) {
    return [];
  }

  const raw = typeof value === 'string'
    ? (() => {
        try {
          return JSON.parse(value) as unknown;
        } catch {
          return null;
        }
      })()
    : value;

  if (Array.isArray(raw)) {
    return raw.map(normalizeRewardConfig).filter((reward): reward is TierRewardConfig => Boolean(reward));
  }

  const reward = normalizeRewardConfig(raw);
  return reward ? [reward] : [];
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
        promotion_text,
        reward_config_json,
        badge_color,
        sort_order,
        is_active
      FROM loyalty_tiers
      ORDER BY min_cups ASC, sort_order ASC, id ASC
    `
  );

  return rows.map((row) => ({
    id: Number(row.id),
    code: String(row.code ?? '').trim().toLowerCase(),
    name: String(row.name ?? '').trim(),
    minCups: Number(row.min_cups ?? 0),
    promotionText: String(row.promotion_text ?? ''),
    rewardConfigs: (() => {
      const rewardConfigs = parseRewardConfigs(row.reward_config_json);
      return rewardConfigs;
    })(),
    rewardConfig: (() => {
      const rewardConfigs = parseRewardConfigs(row.reward_config_json);
      return rewardConfigs[0] ?? null;
    })(),
    badgeColor: row.badge_color ? String(row.badge_color) : null,
    sortOrder: Number(row.sort_order ?? 0),
    isActive: Number(row.is_active ?? 0) === 1
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
