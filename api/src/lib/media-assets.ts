import path from 'node:path';

import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { mysqlPool } from '../db/mysql.js';

type MediaAssetRow = RowDataPacket & {
  asset_path: string;
  mime_type: string;
  file_name: string;
  content: Buffer;
};

type SaveMediaAssetInput = {
  assetPath: string;
  fileName: string;
  mimeType: string;
  content: Buffer;
};

export function normalizeAssetPath(assetPath: string): string {
  const normalized = assetPath.trim().replaceAll('\\', '/');
  if (!normalized) {
    return '';
  }

  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

export function mimeTypeForAssetPath(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

export async function loadMediaAsset(assetPath: string): Promise<MediaAssetRow | null> {
  const normalizedAssetPath = normalizeAssetPath(assetPath);
  if (!normalizedAssetPath) {
    return null;
  }

  const [rows] = await mysqlPool.query<Array<MediaAssetRow>>(
    `
      SELECT asset_path, mime_type, file_name, content
      FROM media_assets
      WHERE asset_path = :assetPath
      LIMIT 1
    `,
    { assetPath: normalizedAssetPath }
  );

  return rows[0] ?? null;
}

export async function saveMediaAsset(input: SaveMediaAssetInput): Promise<void> {
  const normalizedAssetPath = normalizeAssetPath(input.assetPath);
  if (!normalizedAssetPath) {
    return;
  }

  await mysqlPool.execute<ResultSetHeader>(
    `
      INSERT INTO media_assets (
        asset_path,
        mime_type,
        file_name,
        content,
        created_at,
        updated_at
      )
      VALUES (
        :assetPath,
        :mimeType,
        :fileName,
        :content,
        UTC_TIMESTAMP(),
        UTC_TIMESTAMP()
      )
      ON DUPLICATE KEY UPDATE
        mime_type = VALUES(mime_type),
        file_name = VALUES(file_name),
        content = VALUES(content),
        updated_at = UTC_TIMESTAMP()
    `,
    {
      assetPath: normalizedAssetPath,
      mimeType: input.mimeType,
      fileName: input.fileName,
      content: input.content
    }
  );
}
