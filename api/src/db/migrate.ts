import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RowDataPacket } from 'mysql2';
import { mysqlPool } from './mysql.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(dirname, 'migrations');
const seedsDir = path.join(dirname, 'seeds');
const shouldRunDemoSeeds = process.argv.includes('--seed-demo');

async function ensureMigrationTable(): Promise<void> {
  await mysqlPool.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      filename VARCHAR(255) NOT NULL,
      checksum_sha256 CHAR(64) NULL,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_schema_migrations_filename (filename)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function getAppliedFilenames(): Promise<Set<string>> {
  const [rows] = await mysqlPool.query<Array<RowDataPacket & { filename: string }>>(
    'SELECT filename FROM schema_migrations ORDER BY filename'
  );
  return new Set(rows.map((row) => row.filename));
}

async function run(): Promise<void> {
  await ensureMigrationTable();
  const applied = await getAppliedFilenames();
  const migrationFiles = await getSqlFiles(migrationsDir);

  for (const file of migrationFiles) {
    if (applied.has(file)) continue;

    const fullPath = path.join(migrationsDir, file);
    await applySqlFile(file, fullPath, true);
    console.log(`Applied migration: ${file}`);
  }

  if (shouldRunDemoSeeds) {
    const seedFiles = await getSqlFiles(seedsDir);

    for (const file of seedFiles) {
      await applySqlFile(`seed:${file}`, path.join(seedsDir, file), false);
      console.log(`Applied demo seed: ${file}`);
    }
  }

  await mysqlPool.end();
}

async function getSqlFiles(directory: string): Promise<string[]> {
  return (await readdir(directory))
    .filter((file) => file.endsWith('.sql'))
    .sort();
}

async function applySqlFile(
  filename: string,
  fullPath: string,
  trackMigration: boolean
): Promise<void> {
  const sql = await readFile(fullPath, 'utf8');
  const connection = await mysqlPool.getConnection();

  try {
    await connection.beginTransaction();
    for (const statement of splitSqlStatements(sql)) {
      if (statement.trim().length === 0) continue;
      await connection.query(statement);
    }

    if (trackMigration) {
      await connection.execute(
        'INSERT INTO schema_migrations (filename) VALUES (:filename)',
        { filename }
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(/;\s*$/m)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

run().catch(async (error) => {
  console.error(error);
  await mysqlPool.end();
  process.exitCode = 1;
});
