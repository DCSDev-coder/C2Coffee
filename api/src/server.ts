import { buildApp } from './app.js';
import { env } from './config/env.js';
import { assertSingleCafeDeployment } from './admin/deployment.js';
import { runPickupReminderSweep } from './services/pickup-reminders.js';
import { expireStaleUserVouchers } from './services/voucher-expiry-maintenance.js';
import { runVoucherScheduleReminderSweep } from './services/voucher-expiry-reminders.js';
import { runReferralRewardRetrySweep } from './services/referrals.js';

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
const pickupReminderTimer = setInterval(() => {
  void runScheduledPickupReminders();
}, 60_000);
pickupReminderTimer.unref();
const voucherExpiryReminderTimer = setInterval(() => {
  void runScheduledVoucherMaintenance();
}, 24 * 60 * 60 * 1000);
voucherExpiryReminderTimer.unref();
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
