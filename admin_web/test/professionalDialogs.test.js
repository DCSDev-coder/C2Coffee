import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

test('admin pages use the branded dialog and toast system instead of browser popups', async () => {
  const componentDirectory = new URL('../src/components/', import.meta.url);
  const files = (await readdir(componentDirectory)).filter((name) => name.endsWith('.jsx'));
  for (const file of files) {
    const contents = await readFile(new URL(file, componentDirectory), 'utf8');
    assert.doesNotMatch(contents, /window\.(alert|confirm|prompt)\s*\(/, `${file} uses a raw browser dialog`);
    assert.doesNotMatch(contents, /(^|[^A-Za-z])alert\s*\(/m, `${file} uses a raw browser alert`);
  }
});

test('admin production API endpoint requires HTTPS', async () => {
  const contents = await readFile(new URL('../src/lib/adminApi.js', import.meta.url), 'utf8');
  assert.match(contents, /url\.protocol !== "https:"/);
  assert.match(contents, /url\.username \|\| url\.password/);
  assert.match(contents, /localhost/);
});
