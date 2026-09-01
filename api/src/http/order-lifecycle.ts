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
    default:
      // Customer-facing progress must follow the persisted workflow. A paid
      // order remains ordered until a barista explicitly starts preparation.
      return 'paid';
  }
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
