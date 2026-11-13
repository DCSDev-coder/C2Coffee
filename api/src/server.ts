import { buildApp } from './app.js';
import { env } from './config/env.js';
import { assertSingleCafeDeployment } from './admin/deployment.js';
import { runPickupReminderSweep } from './services/pickup-reminders.js';
import { expireStaleUserVouchers } from './services/voucher-expiry-maintenance.js';
import { runVoucherScheduleReminderSweep } from './services/voucher-expiry-reminders.js';
import { runReferralRewardRetrySweep } from './services/referrals.js';
import { runLoyaltyTierMaintenanceSweep } from './services/loyalty-tier-maintenance.js';
import { runAutoCollectSweep } from './services/auto-collect-orders.js';
import { runEmployeeAllowanceSweep } from './services/employee-token-allowance.js';
import { expireStaleCounterPendingOrders } from './services/counter-pending-order-maintenance.js';

const app = await buildApp();

async function runScheduledPickupReminders(): Promise<void> {
  try {
    await assertSingleCafeDeployment();
    const result = await runPickupReminderSweep();
    if (result.claimed > 0 || result.failed > 0) {
      app.log.info(result, 'completed pickup reminder sweep');
    }
  } catch (error) {
    app.log.error(error, 'pickup reminder sweep failed');
  }
}

// The database claim in the sweep keeps this safe when more than one API
// process is running. The first run also catches orders made ready before a
// server restart.
void runScheduledPickupReminders();
async function runScheduledAutoCollect(): Promise<void> {
  try {
    await assertSingleCafeDeployment();
    const result = await runAutoCollectSweep();
    if (result.claimed > 0 || result.failed > 0) {
      app.log.info(result, 'completed automatic order collection sweep');
    }
  } catch (error) {
    app.log.error(error, 'automatic order collection sweep failed');
  }
}
void runScheduledAutoCollect();
async function runScheduledCounterPendingMaintenance(): Promise<void> {
  try {
    await assertSingleCafeDeployment();
    const result = await expireStaleCounterPendingOrders();
    if (result.cancelled > 0) app.log.info(result, 'expired stale counter pending orders');
  } catch (error) {
    app.log.error(error, 'counter pending-order maintenance failed');
  }
}
void runScheduledCounterPendingMaintenance();
async function runScheduledVoucherMaintenance(): Promise<void> {
  try {
    await assertSingleCafeDeployment();
    await expireStaleUserVouchers();
  } catch (error) {
    app.log.error(error, 'voucher expiry maintenance sweep failed');
  }
}
void runScheduledVoucherMaintenance();
async function runScheduledVoucherScheduleReminders(): Promise<void> {
  try {
    await assertSingleCafeDeployment();
    await runVoucherScheduleReminderSweep();
  } catch (error) {
    app.log.error(error, 'voucher schedule reminder sweep failed');
  }
}
void runScheduledVoucherScheduleReminders();
async function runScheduledEmployeeAllowances(): Promise<void> {
  try {
    await assertSingleCafeDeployment();
    const result = await runEmployeeAllowanceSweep();
    if (result.eligible > 0 || result.failed > 0) {
      app.log.info(result, 'completed employee allowance sweep');
    }
  } catch (error) {
    app.log.error(error, 'employee allowance sweep failed');
  }
}
// Run at startup and hourly so a restart on the first day still reconciles the
// month, while the unique period key makes repeated runs idempotent.
void runScheduledEmployeeAllowances();
const employeeAllowanceTimer = setInterval(() => {
  void runScheduledEmployeeAllowances();
}, 60 * 60 * 1000);
employeeAllowanceTimer.unref();
const pickupReminderTimer = setInterval(() => {
  void runScheduledPickupReminders();
}, 60_000);
pickupReminderTimer.unref();
const autoCollectTimer = setInterval(() => {
  void runScheduledAutoCollect();
}, 60_000);
autoCollectTimer.unref();
const counterPendingMaintenanceTimer = setInterval(() => {
  void runScheduledCounterPendingMaintenance();
}, 60_000);
counterPendingMaintenanceTimer.unref();
const voucherExpiryReminderTimer = setInterval(() => {
  void runScheduledVoucherMaintenance();
}, 24 * 60 * 60 * 1000);
voucherExpiryReminderTimer.unref();
async function runScheduledLoyaltyTierMaintenance(): Promise<void> {
  try {
    await assertSingleCafeDeployment();
    const result = await runLoyaltyTierMaintenanceSweep();
    if (result.changed > 0) {
      app.log.info(result, 'completed loyalty tier maintenance sweep');
    }
  } catch (error) {
    app.log.error(error, 'loyalty tier maintenance sweep failed');
  }
}
void runScheduledLoyaltyTierMaintenance();
const loyaltyTierMaintenanceTimer = setInterval(() => {
  void runScheduledLoyaltyTierMaintenance();
}, 24 * 60 * 60 * 1000);
loyaltyTierMaintenanceTimer.unref();
const voucherScheduleReminderTimer = setInterval(() => {
  void runScheduledVoucherScheduleReminders();
}, 60_000);
voucherScheduleReminderTimer.unref();

async function runScheduledReferralRewardRetries(): Promise<void> {
  try {
    await assertSingleCafeDeployment();
    const result = await runReferralRewardRetrySweep();
    if (result.processed > 0) app.log.info(result, 'completed referral reward retry sweep');
  } catch (error) {
    app.log.error(error, 'referral reward retry sweep failed');
  }
}
void runScheduledReferralRewardRetries();
const referralRewardRetryTimer = setInterval(() => {
  void runScheduledReferralRewardRetries();
}, 5 * 60_000);
referralRewardRetryTimer.unref();

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  app.log.error(error, 'failed to start API server');
  process.exitCode = 1;
}
