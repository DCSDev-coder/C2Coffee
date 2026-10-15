import assert from 'node:assert/strict';
import test from 'node:test';

import { parseChipCallbackPublicKeyPayload } from '../dist/payments/chip-callback-key.js';

const publicKey = `-----BEGIN PUBLIC KEY-----
MIIBexample
-----END PUBLIC KEY-----`;

test('accepts the raw PEM payload returned by CHIP', () => {
  assert.equal(parseChipCallbackPublicKeyPayload(`\n${publicKey}\n`), publicKey);
});

test('retains compatibility with a JSON-wrapped public key', () => {
  assert.equal(
    parseChipCallbackPublicKeyPayload(JSON.stringify({ public_key: publicKey })),
    publicKey
  );
});

test('accepts the JSON-string PEM response returned by CHIP', () => {
  assert.equal(parseChipCallbackPublicKeyPayload(JSON.stringify(publicKey)), publicKey);
});

test('rejects malformed callback key payloads', () => {
  assert.equal(parseChipCallbackPublicKeyPayload('not a public key'), '');
  assert.equal(parseChipCallbackPublicKeyPayload('{"public_key":42}'), '');
});
