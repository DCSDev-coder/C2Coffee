import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = new URL('../dist/', import.meta.url);
const maximumFileBytes = 2 * 1024 * 1024;
const maximumBuildBytes = 10 * 1024 * 1024;

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  }));
  return nested.flat();
}

const rootPath = root.pathname;
const files = await filesIn(rootPath);
let totalBytes = 0;
const oversized = [];
for (const file of files) {
  const details = await stat(file);
  totalBytes += details.size;
  if (details.size > maximumFileBytes) {
    oversized.push(`${relative(rootPath, file)} (${(details.size / 1024 / 1024).toFixed(2)} MB)`);
  }
}

if (oversized.length > 0 || totalBytes > maximumBuildBytes) {
  const reasons = [];
  if (oversized.length > 0) reasons.push(`oversized files: ${oversized.join(', ')}`);
  if (totalBytes > maximumBuildBytes) {
    reasons.push(`total ${(totalBytes / 1024 / 1024).toFixed(2)} MB exceeds 10 MB`);
  }
  throw new Error(`Admin build asset budget failed: ${reasons.join('; ')}`);
}

console.log(`Admin build asset budget passed: ${(totalBytes / 1024 / 1024).toFixed(2)} MB total.`);
