import assert from 'node:assert/strict';
import test from 'node:test';

import { PrintConnector } from '../src/print-connector.js';

const config = {
  printerReference: 'c2-test-zy905',
  dryRun: false,
  printerHost: '192.168.1.50',
  printerPort: 9100,
  requestTimeoutMs: 1000
};

test('prints a claimed job and acknowledges it once', async () => {
  const acknowledgements = [];
  const apiClient = {
    claimJob: async () => ({
      job_ref: 'a1111111-1111-4111-8111-111111111111',
      receipt: { order_ref: 'ORD-1', items: [], final_total_rm: '0.00', token_amount: 0 }
    }),
    acknowledge: async (...arguments_) => acknowledgements.push(arguments_)
  };
  let sent;
  const connector = new PrintConnector(config, {
    apiClient,
    send: async (request) => { sent = request; },
    log: { info() {}, error() {} }
  });

  assert.equal(await connector.processOne(), true);
  assert.equal(sent.host, config.printerHost);
  assert.ok(Buffer.isBuffer(sent.payload));
  assert.deepEqual(acknowledgements, [[
    'a1111111-1111-4111-8111-111111111111',
    'printed'
  ]]);
});

test('reports a failed print without leaving the job dispatching', async () => {
  const acknowledgements = [];
  const apiClient = {
    claimJob: async () => ({
      job_ref: 'a2222222-2222-4222-8222-222222222222',
      receipt: { order_ref: 'ORD-2', items: [], final_total_rm: '0.00', token_amount: 0 }
    }),
    acknowledge: async (...arguments_) => acknowledgements.push(arguments_)
  };
  const connector = new PrintConnector(config, {
    apiClient,
    send: async () => { throw new Error('connect ECONNREFUSED'); },
    log: { info() {}, error() {} }
  });

  assert.equal(await connector.processOne(), true);
  assert.deepEqual(acknowledgements, [[
    'a2222222-2222-4222-8222-222222222222',
    'failed',
    'printer_connection_refused'
  ]]);
});
