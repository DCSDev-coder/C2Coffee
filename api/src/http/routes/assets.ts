import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { FastifyInstance } from 'fastify';

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

    const resolvedPath = path.resolve(menuRoot, relativePath);
    if (!resolvedPath.startsWith(menuRoot)) {
      return reply.status(404).send();
    }

    try {
      const content = await readFile(resolvedPath);
      return reply
        .header('Cross-Origin-Resource-Policy', 'cross-origin')
        .header('Cache-Control', 'public, max-age=31536000, immutable')
        .type(_mimeTypeFor(resolvedPath))
        .send(content);
    } catch {
      return reply.status(404).send();
    }
  });
}

function _mimeTypeFor(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}
