import assert from 'node:assert/strict';
import net from 'node:net';
import test from 'node:test';

import { sendToNetworkPrinter } from '../src/network-printer.js';

test('hands ESC/POS bytes to a reachable TCP printer', async () => {
  let received = Buffer.alloc(0);
  const server = net.createServer((socket) => {
    socket.on('data', (chunk) => { received = Buffer.concat([received, chunk]); });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  try {
    await sendToNetworkPrinter({
      host: '127.0.0.1',
      port,
      payload: Buffer.from([0x1b, 0x40, 0x41]),
      timeoutMs: 1000
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.deepEqual([...received], [0x1b, 0x40, 0x41]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
