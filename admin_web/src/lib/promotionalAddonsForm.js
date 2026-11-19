export const PROMOTIONAL_ADDON_STATUSES = ['draft', 'active', 'paused', 'archived'];

export function emptyPromotionalAddonCampaign() {
  return {
    id: null,
    name: '',
    code: '',
    status: 'draft',
    startsAt: '',
    endsAt: '',
    outletScope: 'all',
    storeIds: [],
    qualifyingProductKindCodes: [],
    qualifyingCategoryIds: [],
    qualifyingMenuItemIds: [],
    minimumQuantity: 1,
    assignmentMode: 'customer_choice',
    legacyFallback: 'no_reward',
    allowDecline: true,
    priceMode: 'free',
    priceAmount: '',
    rewardMenuItemIds: [],
    priority: 100,
  };
}

function ids(value) {
  return (Array.isArray(value) ? value : [])
    .map((item) => Number(item?.id ?? item?.menu_item_id ?? item?.category_id ?? item?.store_id ?? item))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function codes(value) {
  return (Array.isArray(value) ? value : [])
    .map((item) => String((item?.code ?? item?.product_kind_code ?? item) || '').trim())
    .filter(Boolean);
}

function localDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function normalizePromotionalAddonCampaign(campaign = {}) {
  const base = emptyPromotionalAddonCampaign();
  const storeIds = ids(campaign.store_ids ?? campaign.stores);
  const priceMode = campaign.price_mode ?? campaign.pricing_mode ?? base.priceMode;
  return {
    ...base,
    id: campaign.id ?? campaign.campaign_id ?? null,
    name: campaign.name ?? campaign.campaign_name ?? '',
    code: campaign.code ?? campaign.campaign_code ?? '',
    status: campaign.status ?? base.status,
    startsAt: localDateTime(campaign.starts_at ?? campaign.start_at),
    endsAt: localDateTime(campaign.ends_at ?? campaign.end_at),
    outletScope: campaign.outlet_scope ?? (storeIds.length ? 'selected' : 'all'),
    storeIds,
    qualifyingProductKindCodes: codes(campaign.qualifying_product_kind_codes ?? campaign.qualifying_product_kinds),
    qualifyingCategoryIds: ids(campaign.qualifying_category_ids ?? campaign.qualifying_categories),
    qualifyingMenuItemIds: ids(campaign.qualifying_menu_item_ids ?? campaign.qualifying_menu_items),
    minimumQuantity: Number(campaign.minimum_quantity ?? 1),
    assignmentMode: campaign.assignment_mode ?? base.assignmentMode,
    legacyFallback: campaign.legacy_fallback ?? base.legacyFallback,
    allowDecline: Boolean(campaign.allow_decline ?? base.allowDecline),
    priceMode,
    priceAmount: priceMode === 'free' ? '' : String(campaign.price_amount ?? campaign.fixed_price ?? ''),
    rewardMenuItemIds: ids(campaign.reward_menu_item_ids ?? campaign.reward_items),
    priority: Number(campaign.priority ?? base.priority),
  };
}

export function validatePromotionalAddonCampaign(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Campaign name is required.';
  if (!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(form.code.trim().toUpperCase())) {
    errors.code = 'Use 3–40 letters, numbers, underscores, or hyphens.';
  }
  if (!form.startsAt) errors.startsAt = 'Start date and time are required.';
  if (!form.endsAt) errors.endsAt = 'End date and time are required.';
  if (form.startsAt && form.endsAt && new Date(form.startsAt) >= new Date(form.endsAt)) {
    errors.endsAt = 'End date must be after the start date.';
  }
  if (form.outletScope === 'selected' && form.storeIds.length === 0) {
    errors.storeIds = 'Select at least one outlet.';
  }
  const hasQualification = form.qualifyingProductKindCodes.length > 0 ||
    form.qualifyingCategoryIds.length > 0 || form.qualifyingMenuItemIds.length > 0;
  if (!hasQualification) errors.qualification = 'Choose at least one qualifying product kind, category, or menu item.';
  if (!Number.isInteger(Number(form.minimumQuantity)) || Number(form.minimumQuantity) < 1) {
    errors.minimumQuantity = 'Minimum quantity must be at least 1.';
  }
  if (form.rewardMenuItemIds.length === 0) errors.rewardMenuItemIds = 'Select at least one reward item.';
  if (form.priceMode !== 'free' && (!(Number(form.priceAmount) >= 0) || form.priceAmount === '')) {
    errors.priceAmount = 'Enter a valid non-negative price.';
  }
  if (!Number.isInteger(Number(form.priority)) || Number(form.priority) < 0) {
    errors.priority = 'Priority must be a non-negative whole number.';
  }
  return errors;
}

function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

export function buildPromotionalAddonPayload(form) {
  return {
    name: form.name.trim(),
    code: form.code.trim().toUpperCase(),
    status: form.status,
    starts_at: toIso(form.startsAt),
    ends_at: toIso(form.endsAt),
    outlet_scope: form.outletScope,
    store_ids: form.outletScope === 'selected' ? ids(form.storeIds) : [],
    qualifying_product_kind_codes: codes(form.qualifyingProductKindCodes),
    qualifying_category_ids: ids(form.qualifyingCategoryIds),
    qualifying_menu_item_ids: ids(form.qualifyingMenuItemIds),
    minimum_quantity: Number(form.minimumQuantity),
    assignment_mode: form.assignmentMode,
    legacy_fallback: form.priceMode === 'free' ? form.legacyFallback : 'no_reward',
    allow_decline: Boolean(form.allowDecline),
    price_mode: form.priceMode,
    price_amount: form.priceMode === 'free' ? 0 : Number(form.priceAmount),
    reward_menu_item_ids: ids(form.rewardMenuItemIds),
    priority: Number(form.priority),
  };
}

export function unwrapPromotionalAddonCollection(response, key) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.[key])) return response[key];
  if (Array.isArray(response?.data?.[key])) return response.data[key];
  if (Array.isArray(response?.items)) return response.items;
  return [];
}
