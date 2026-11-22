import { ApiError } from '../http/errors.js';
import type { ChipPurchase } from '../payments/chip-client.js';

export type MobilePaymentState =
  | 'payment_active'
  | 'payment_processing'
  | 'payment_paid'
  | 'payment_failed'
  | 'payment_expired'
  | 'provider_temporarily_unavailable';

export type MobilePaymentStateDescription = {
  state: MobilePaymentState;
  can_continue: boolean;
  can_change_method: boolean;
  can_cancel: boolean;
};

const paidStatuses = new Set(['paid', 'refunded', 'partially_refunded']);
const expiredStatuses = new Set(['expired', 'overdue']);
const failedStatuses = new Set(['failed', 'cancelled', 'error', 'payment_failure', 'blocked']);
const processingStatuses = new Set(['pending_execute', 'processing', 'executing']);

export function normalizeChipPurchaseStatus(purchase: ChipPurchase | null | undefined): string {
  return typeof purchase?.status === 'string'
    ? purchase.status.trim().toLowerCase()
    : 'unknown';
}

export function isTerminalChipPurchaseStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return paidStatuses.has(normalized) || expiredStatuses.has(normalized) || failedStatuses.has(normalized);
}

export function isPaidChipPurchaseStatus(status: string): boolean {
  return paidStatuses.has(status.trim().toLowerCase());
}

export function describeMobilePaymentState(input: {
  providerStatus?: string | null;
  localPaymentStatus?: string | null;
  hasCheckoutUrl: boolean;
  providerUnavailable?: boolean;
}): MobilePaymentStateDescription {
  if (input.providerUnavailable) {
    return {
      state: 'provider_temporarily_unavailable',
      can_continue: false,
      can_change_method: false,
      can_cancel: false
    };
  }

  const providerStatus = input.providerStatus?.trim().toLowerCase() || 'unknown';
  const localStatus = input.localPaymentStatus?.trim().toLowerCase() || 'unknown';

  if (paidStatuses.has(providerStatus) || paidStatuses.has(localStatus)) {
    return {
      state: 'payment_paid',
      can_continue: false,
      can_change_method: false,
      can_cancel: false
    };
  }

  if (expiredStatuses.has(providerStatus)) {
    return {
      state: 'payment_expired',
      can_continue: false,
      can_change_method: true,
      can_cancel: true
    };
  }

  if (failedStatuses.has(providerStatus) || failedStatuses.has(localStatus)) {
    return {
      state: 'payment_failed',
      can_continue: false,
      can_change_method: true,
      can_cancel: true
    };
  }

  if (processingStatuses.has(providerStatus) || providerStatus === 'unknown') {
    return {
      state: 'payment_processing',
      can_continue: input.hasCheckoutUrl,
      // The retry endpoint safely closes or detaches the unresolved CHIP
      // purchase before creating the replacement attempt. Customers may
      // therefore switch methods even when CHIP still reports processing.
      can_change_method: true,
      can_cancel: false
    };
  }

  return {
    state: 'payment_active',
    can_continue: input.hasCheckoutUrl,
    // Changing method uses the same guarded retry flow, which prevents two
    // payable CHIP attempts and protects against a late provider payment.
    can_change_method: true,
    can_cancel: false
  };
}

export async function closeChipPurchaseSafely(
  purchaseId: string,
  dependencies: {
    cancelPurchase: (id: string) => Promise<ChipPurchase>;
    getPurchase: (id: string) => Promise<ChipPurchase>;
  }
): Promise<ChipPurchase> {
  let purchase: ChipPurchase;
  try {
    purchase = await dependencies.cancelPurchase(purchaseId);
  } catch {
    try {
      purchase = await dependencies.getPurchase(purchaseId);
    } catch {
      throw new ApiError(
        409,
        'payment_status_unavailable',
        'We could not safely confirm the payment status yet. Please check again shortly.'
      );
    }
  }

  const status = normalizeChipPurchaseStatus(purchase);
  if (!isTerminalChipPurchaseStatus(status)) {
    throw new ApiError(
      409,
      'payment_still_processing',
      'The payment is still being processed. Please check its status again shortly.'
    );
  }
  return purchase;
}
