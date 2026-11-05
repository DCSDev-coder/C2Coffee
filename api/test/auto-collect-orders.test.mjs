import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const service = await readFile(
  new URL('../src/services/auto-collect-orders.ts', import.meta.url),
  'utf8',
);
const server = await readFile(
  new URL('../src/server.ts', import.meta.url),
  'utf8',
);

test('auto-completes only ready orders after one hour and is claim-safe', () => {
  assert.match(service, /status = 'ready_for_pickup'/);
  assert.match(service, /INTERVAL \$\{AUTO_COLLECT_DELAY_MINUTES\} MINUTE/);
  assert.match(service, /const AUTO_COLLECT_DELAY_MINUTES = 60/);
  assert.match(service, /status = 'collected', collected_at = UTC_TIMESTAMP\(\)/);
  assert.match(service, /AND status = 'ready_for_pickup'/);
  assert.match(service, /order_status_history/);
  assert.match(service, /processOrderLoyalty/);
  assert.match(service, /awardReferralForCollectedOrder/);
  assert.match(service, /consumeInventoryForOrder/);
});

test('server schedules the auto-collection sweep', () => {
  assert.match(server, /runAutoCollectSweep/);
  assert.match(server, /automatic order collection sweep/);
  assert.match(server, /const autoCollectTimer = setInterval/);
});
