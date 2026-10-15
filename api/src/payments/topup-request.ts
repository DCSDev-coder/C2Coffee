import { z } from 'zod';

export const topUpRequestSchema = z.object({
  package_id: z.coerce.number().int().positive().optional(),
  amount_rm: z.coerce.number().int().min(1).max(500).optional(),
  payment_method: z.enum(['fpx', 'duitnow_qr', 'card', 'ewallet'])
}).refine(
  (value) => (value.package_id !== undefined) !== (value.amount_rm !== undefined),
  { message: 'Provide either package_id or amount_rm.' }
);
