import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { FastifyInstance } from 'fastify';

import { loadMediaAsset, normalizeAssetPath, mimeTypeForAssetPath } from '../../lib/media-assets.js';

export async function registerAssetRoutes(
  app: FastifyInstance
): Promise<void> {
  const routeDir = path.dirname(fileURLToPath(import.meta.url));
  const publicRoot = path.resolve(routeDir, '../../public');
  const menuRoot = path.join(publicRoot, 'menu');

  app.get('/assets/menu/*', async (request, reply) => {
    const params = request.params as { '*': string };
    const relativePath = decodeURIComponent(params['*'] ?? '').trim();

    if (!relativePath) {
      return reply.status(404).send();
    }

    const assetPath = normalizeAssetPath(`/assets/menu/${relativePath}`);
    if (!assetPath) {
      return reply.status(404).send();
    }

    const databaseAsset = await loadMediaAsset(assetPath);
    if (databaseAsset) {
      return reply
        .header('Cross-Origin-Resource-Policy', 'cross-origin')
        .header('Cache-Control', 'public, max-age=31536000, immutable')
        .type(databaseAsset.mime_type)
        .send(databaseAsset.content);
    }

    const resolvedPath = path.resolve(menuRoot, relativePath);
    if (!resolvedPath.startsWith(menuRoot)) {
      return reply.status(404).send();
    }

    try {
      const content = await readFile(resolvedPath);
      return reply
        .header('Cross-Origin-Resource-Policy', 'cross-origin')
        .header('Cache-Control', 'public, max-age=31536000, immutable')
        .type(mimeTypeForAssetPath(resolvedPath))
        .send(content);
    } catch {
      return reply.status(404).send();
    }
  });
}
