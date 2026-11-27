import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildMysqlTlsOptions } from '../dist/db/mysql-tls.js';

test('database TLS requires a readable CA and a DNS hostname', () => {
  const dir = mkdtempSync(join(tmpdir(), 'c2-mysql-tls-'));
  try {
    const caPath = join(dir, 'ca.pem');
    writeFileSync(caPath, 'test CA contents');
    assert.equal(buildMysqlTlsOptions('localhost', ''), undefined);
    assert.throws(() => buildMysqlTlsOptions('127.0.0.1', caPath), /DNS hostname/);
    assert.throws(() => buildMysqlTlsOptions('db.example.test', join(dir, 'missing.pem')));
    const options = buildMysqlTlsOptions('db.example.test', caPath);
    assert.equal(options.ca, 'test CA contents');
    assert.equal(options.rejectUnauthorized, true);
    assert.equal(options.verifyIdentity, true);
    assert.equal(options.minVersion, 'TLSv1.2');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
