import { ApiError } from '../http/errors.js';

export function assertOutletPublication(current: { is_customer_facing: boolean; status: string } | null,
  next: { is_customer_facing: boolean; status: string }): void {
  if (next.is_customer_facing && next.status !== 'active') {
    throw new ApiError(409, 'customer_store_conflict', 'Only an active outlet can be available in the customer app.');
  }
}
