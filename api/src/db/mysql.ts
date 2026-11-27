import mysql from 'mysql2/promise';
import { env } from '../config/env.js';
import { buildMysqlTlsOptions } from './mysql-tls.js';

export const mysqlPool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: env.DB_CONNECTION_LIMIT,
  namedPlaceholders: true,
  ssl: buildMysqlTlsOptions(env.DB_HOST, env.DB_TLS_CA_FILE),
  timezone: 'Z',
  decimalNumbers: false
});

export async function assertDatabaseConnection(): Promise<void> {
  const connection = await getUtcConnection();
  try {
    await connection.ping();
  } finally {
    connection.release();
  }
}

export async function getUtcConnection() {
  const connection = await mysqlPool.getConnection();
  await connection.query("SET time_zone = '+00:00'");
  return connection;
}
