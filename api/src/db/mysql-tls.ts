import { readFileSync } from 'node:fs';
import { isIP } from 'node:net';

/** Enable authenticated TLS using a CA mounted inside the API container. */
export function buildMysqlTlsOptions(host: string, caFile: string) {
  if (!caFile) return undefined;
  // mysql2 only performs its explicit hostname check for DNS names.
  if (isIP(host)) throw new Error('DB_TLS_CA_FILE requires DB_HOST to be a DNS hostname');
  return {
    ca: readFileSync(caFile, 'utf8'),
    rejectUnauthorized: true,
    verifyIdentity: true,
    minVersion: 'TLSv1.2'
  };
}
