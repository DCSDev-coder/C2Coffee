import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');

const copyTargets = [
  ['src/db/migrations', 'dist/db/migrations'],
  ['src/db/seeds', 'dist/db/seeds']
];

for (const [sourceRelative, destinationRelative] of copyTargets) {
  const sourcePath = path.join(rootDir, sourceRelative);
  const destinationPath = path.join(rootDir, destinationRelative);

  await mkdir(path.dirname(destinationPath), { recursive: true });
  await cp(sourcePath, destinationPath, { recursive: true, force: true });
}
