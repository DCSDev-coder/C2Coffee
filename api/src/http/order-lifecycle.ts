export type OrderLifecycleStatus =
  | 'draft'
  | 'pending_payment'
  | 'payment_failed'
  | 'paid'
  | 'accepted'
  | 'preparing'
  | 'ready_for_pickup'
  | 'collected'
  | 'cancelled'
  | 'refunded';

export const ORDER_PREPARING_DELAY_MS = 8_000;
export const ORDER_READY_DELAY_MS = 60_000;

export type OrderLifecycleSource = {
  status: string;
  createdAt: Date;
  paidAt?: Date | null;
  acceptedAt?: Date | null;
  readyAt?: Date | null;
  collectedAt?: Date | null;
};

export function resolveOrderLifecycleStatus(
  order: OrderLifecycleSource
): OrderLifecycleStatus {
  switch (order.status) {
    case 'draft':
    case 'pending_payment':
    case 'payment_failed':
    case 'cancelled':
    case 'refunded':
      return order.status;
    case 'collected':
      return 'collected';
    case 'ready_for_pickup':
      return 'ready_for_pickup';
    case 'preparing':
      return 'preparing';
    case 'accepted':
      return 'accepted';
    case 'paid':
    default:
      break;
  }

  if (order.collectedAt) {
    return 'collected';
  }

  if (order.readyAt) {
    return 'ready_for_pickup';
  }

  if (order.acceptedAt) {
    return 'accepted';
  }

  const referenceTime = order.paidAt ?? order.createdAt;
  const ageMs = Date.now() - referenceTime.getTime();

  if (ageMs >= ORDER_READY_DELAY_MS) {
    return 'ready_for_pickup';
  }

  if (ageMs >= ORDER_PREPARING_DELAY_MS) {
    return 'preparing';
  }

  return 'paid';
}

export function isCustomerActiveOrderStatus(status: string): boolean {
  switch (status) {
    case 'pending_payment':
    case 'paid':
    case 'accepted':
    case 'preparing':
    case 'ready_for_pickup':
      return true;
    default:
      return false;
  }
}
