import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const routes = await readFile(new URL('../src/http/routes/gift-cards.ts', import.meta.url), 'utf8');
const service = await readFile(new URL('../src/services/gift-cards.ts', import.meta.url), 'utf8');
const settlement = await readFile(new URL('../src/services/chip-gift-card-settlement.ts', import.meta.url), 'utf8');
const migration = await readFile(new URL('../src/db/migrations/131_gift_card_wallet_redemption.sql', import.meta.url), 'utf8');
const mobileCheckout = await readFile(new URL('../../mobile_app/lib/screens/order_confirmation_page.dart', import.meta.url), 'utf8');
const mobilePush = await readFile(new URL('../../mobile_app/lib/services/push_notification_service.dart', import.meta.url), 'utf8');

test('gift cards convert once into the recipient token wallet', () => {
  assert.match(service, /status !== 'active'/);
  assert.match(service, /source_type, source_id[\s\S]*'gift_card_redemption'/);
  assert.match(service, /remaining_amount = 0, status = 'depleted'/);
  assert.match(service, /deliveryKey: `gift_card_received:/);
});

test('phone delivery is automatic while blank-phone cards remain claimable by code', () => {
  assert.match(routes, /recipient_phone: z\.string\(\)\.trim\(\)\.max\(30\)\.optional\(\)\.nullable\(\)/);
  assert.match(routes, /if \(recipientUserId\) \{[\s\S]*creditGiftCardToWallet/);
  assert.match(routes, /if \(card\.recipient_phone &&/);
  assert.match(routes, /creditGiftCardToWallet\(connection, Number\(card\.id\), request\.auth\.userId\)/);
});

test('RM conversion preserves value and paid callbacks do not roll back for a full wallet', () => {
  assert.match(routes, /const money = z\.coerce\.number\(\)\.int\(\)/);
  assert.match(service, /Number\.isInteger\(amount\)/);
  assert.match(settlement, /token_wallet_cap_exceeded/);
  assert.match(settlement, /gift_card_delivery_pending/);
});

test('migration preserves existing ledger sources and adds gift-card redemption', () => {
  for (const source of ['topup_paid', 'topup_refund', 'order_spend', 'refund_return', 'expiry', 'admin_adjustment', 'promo_credit', 'voucher_subsidy', 'referral_reward', 'referral_reversal', 'gift_card_purchase', 'gift_card_redemption']) {
    assert.match(migration, new RegExp(`'${source}'`));
  }
});

test('mobile checkout no longer sends a selected gift card', () => {
  assert.doesNotMatch(mobileCheckout, /giftCardCode:/);
  assert.doesNotMatch(mobileCheckout, /child: _buildGiftCardCard\(\)/);
});

test('direct delivery notifies and refreshes an already-open recipient app', () => {
  assert.match(routes, /type: 'gift_card_received'/);
  assert.match(settlement, /deliverPushToUser/);
  assert.match(mobilePush, /case 'gift_card_received':[\s\S]*loadAuthenticatedState\(force: true\)/);
});
