import test from 'node:test';
import assert from 'node:assert/strict';
import { isMobilePriceWindowActive, mobilePriceWindowsOverlap, voucherEligibleTotals, loadScheduledMobilePrices, scheduledPriceVoucherDiscount } from '../dist/services/scheduled-mobile-pricing.js';

test('mobile price windows use outlet local time with an exclusive end', () => {
  const lunch = { days: [1], startMinute: 660, endMinute: 840 };
  const active = (value) => isMobilePriceWindowActive(lunch, new Date(value), 'Asia/Kuala_Lumpur');
  assert.equal(active('2026-11-30T02:59:00Z'), false);
  assert.equal(active('2026-11-30T03:00:00Z'), true);
  assert.equal(active('2026-11-30T06:00:00Z'), false);
  assert.equal(active('2026-12-01T03:00:00Z'), false);
});

test('special-priced items and their modifiers cannot contribute to voucher discounts', () => {
  const totals = voucherEligibleTotals([
    { specialPriceActive: true, quantity: 1, basePriceRm: 10, modifierRm: 2, tokenPrice: 10, modifierTokens: 2 },
    { specialPriceActive: false, quantity: 2, basePriceRm: 8, modifierRm: 0.5, tokenPrice: 8, modifierTokens: 1 }
  ]);
  assert.deepEqual(totals, { rm: 17, tokens: 18 });
  assert.equal(Math.round(totals.rm * 0.2 * 100), 340);
});

test('overnight window uses the date and weekday when it started', () => {
  const window = { days: [1], startMinute: 1380, endMinute: 60, endDate: '2026-11-30' };
  assert.equal(isMobilePriceWindowActive(window, new Date('2026-11-30T16:30:00Z'), 'Asia/Kuala_Lumpur'), true);
  assert.equal(isMobilePriceWindowActive(window, new Date('2026-11-30T17:00:00Z'), 'Asia/Kuala_Lumpur'), false);
});

test('overlapping weekly windows account for midnight and week boundaries', () => {
  const sunday = { days: [7], startMinute: 1380, endMinute: 60 };
  assert.equal(mobilePriceWindowsOverlap(sunday, { days: [1], startMinute: 30, endMinute: 90 }), true);
  assert.equal(mobilePriceWindowsOverlap(sunday, { days: [1], startMinute: 60, endMinute: 120 }), false);
  assert.equal(mobilePriceWindowsOverlap(sunday, { days: [2], startMinute: 30, endMinute: 90 }), false);
});

test('overlap respects bounded campaign dates including overnight spillover', () => {
  const overnight = { days: [1], startMinute: 1380, endMinute: 60, startDate: '2026-11-30', endDate: '2026-11-30' };
  const followingDay = { days: [2], startMinute: 30, endMinute: 90, startDate: '2026-12-01', endDate: '2026-12-01' };
  assert.equal(mobilePriceWindowsOverlap(overnight, followingDay), true);
  assert.equal(mobilePriceWindowsOverlap(overnight, { ...followingDay, startDate: '2026-12-08', endDate: '2026-12-08' }), false);
});

test('scheduled prices are resolved at outlet time and overlapping active rows fail safely', async () => {
  const row = { id: 4, menu_item_id: 8, weekday_mask: 1, start_minute: 660,
    end_minute: 840, start_date: null, end_date: null, price_rm: '10.00',
    price_tokens: 10, timezone: 'Asia/Kuala_Lumpur' };
  const now = new Date('2026-11-30T03:00:00Z');
  const connection = { query: async () => [[row]] };
  const prices = await loadScheduledMobilePrices(connection, 2, now);
  assert.deepEqual(prices.get(8), { scheduleId: 4, menuItemId: 8, priceRm: '10.00', priceTokens: 10 });
  await assert.rejects(loadScheduledMobilePrices({ query: async () => [[row, { ...row, id: 5 }]] }, 2, now), /Overlapping/);
});

test('percentage and fixed discounts are capped to ordinary-priced items', () => {
  const eligible = { rm: 8, tokens: 8 };
  assert.deepEqual(scheduledPriceVoucherDiscount(eligible, 'percent_rm', 20, false), { rm: 1.6, tokens: 0 });
  assert.deepEqual(scheduledPriceVoucherDiscount(eligible, 'fixed_rm', 20, false), { rm: 8, tokens: 0 });
  assert.deepEqual(scheduledPriceVoucherDiscount(eligible, 'fixed_token', 20, true), { rm: 0, tokens: 8 });
  assert.deepEqual(scheduledPriceVoucherDiscount({ rm: 0, tokens: 0 }, 'percent_rm', 20, true), { rm: 0, tokens: 0 });
});
