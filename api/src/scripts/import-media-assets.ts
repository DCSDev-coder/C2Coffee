import { access, readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { constants } from 'node:fs';

import { config as loadEnv } from 'dotenv';

import { mysqlPool } from '../db/mysql.js';
import { mimeTypeForAssetPath, normalizeAssetPath, saveMediaAsset } from '../lib/media-assets.js';

loadEnv({ path: '.env' });

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

async function resolvePublicMenuRoot(): Promise<string> {
  const candidates = [
    path.resolve(scriptDir, '../../public/menu'),
    path.resolve(scriptDir, '../public/menu')
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate, constants.R_OK);
      return candidate;
    } catch {}
  }

  throw new Error(`Could not find public menu directory. Tried: ${candidates.join(', ')}`);
}

async function walkFiles(rootDir: string): Promise<string[]> {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await walkFiles(absolutePath));
      continue;
    }

    if (entry.isFile()) {
      results.push(absolutePath);
    }
  }

  return results;
}

async function main() {
  const publicMenuRoot = await resolvePublicMenuRoot();
  const files = await walkFiles(publicMenuRoot);
  let imported = 0;

  for (const filePath of files) {
    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) {
      continue;
    }

    const relativePath = path.relative(publicMenuRoot, filePath).split(path.sep).join('/');
    const assetPath = normalizeAssetPath(`/assets/menu/${relativePath}`);
    if (!assetPath || assetPath.endsWith('/.gitkeep')) {
      continue;
    }

    const content = await readFile(filePath);
    await saveMediaAsset({
      assetPath,
      fileName: path.basename(filePath),
      mimeType: mimeTypeForAssetPath(filePath),
      content
    });
    imported += 1;
  }

  console.log(`Imported ${imported} media assets into the database.`);
  await mysqlPool.end();
}

main().catch(async (error) => {
  console.error(error);
  await mysqlPool.end();
  process.exitCode = 1;
});
