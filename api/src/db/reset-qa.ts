import { mysqlPool } from './mysql.js';

const TABLES_TO_TRUNCATE = [
  'voucher_redemptions',
  'user_vouchers',
  'referrals',
  'loyalty_tier_snapshots',
  'loyalty_cup_events',
  'payment_events',
  'refunds',
  'payments',
  'order_status_history',
  'order_item_modifiers',
  'order_items',
  'orders',
  'token_reservations',
  'token_ledger',
  'token_lots',
  'token_topups',
  'token_accounts',
  'push_tokens',
  'sessions',
  'auth_otps',
  'otp_request_logs',
  'devices',
  'users',
  'store_daily_order_sequences'
] as const;

async function run(): Promise<void> {
  await mysqlPool.execute('SET FOREIGN_KEY_CHECKS = 0');

  try {
    for (const tableName of TABLES_TO_TRUNCATE) {
      await mysqlPool.query(`TRUNCATE TABLE \`${tableName}\``);
      console.log(`Truncated table: ${tableName}`);
    }
  } finally {
    await mysqlPool.execute('SET FOREIGN_KEY_CHECKS = 1');
    await mysqlPool.end();
  }
}

run().catch(async (error) => {
  console.error(error);
  await mysqlPool.end();
  process.exitCode = 1;
});
