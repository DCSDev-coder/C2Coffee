import { buildApp } from './app.js';
import { env } from './config/env.js';
import { assertSingleCafeDeployment } from './admin/deployment.js';
import { runPickupReminderSweep } from './services/pickup-reminders.js';
import { runVoucherExpiryReminderSweep } from './services/voucher-expiry-reminders.js';
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
async function runScheduledVoucherReminders(): Promise<void> {
  try {
    await assertSingleCafeDeployment();
    await runVoucherExpiryReminderSweep();
  } catch (error) {
    app.log.error(error, 'voucher reminder sweep failed');
  }
}
void runScheduledVoucherReminders();
const pickupReminderTimer = setInterval(() => {
  void runScheduledPickupReminders();
}, 60_000);
pickupReminderTimer.unref();
const voucherExpiryReminderTimer = setInterval(() => {
  void runScheduledVoucherReminders();
}, 24 * 60 * 60 * 1000);
voucherExpiryReminderTimer.unref();

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
