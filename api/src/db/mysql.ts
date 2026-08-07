import mysql from 'mysql2/promise';
import { env } from '../config/env.js';

export const mysqlPool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: env.DB_CONNECTION_LIMIT,
  namedPlaceholders: true,
  timezone: 'Z',
  decimalNumbers: false
});

export async function assertDatabaseConnection(): Promise<void> {
  const connection = await mysqlPool.getConnection();
  try {
    await connection.ping();
  } finally {
    connection.release();
  }
}
