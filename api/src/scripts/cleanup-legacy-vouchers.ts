import mysql from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2/promise';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env' });

const APPLY_FLAG = '--apply';
const LEGACY_CODES = ['DIRECTPAY_RM5'];

async function main() {
  const apply = process.argv.includes(APPLY_FLAG);

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    timezone: 'Z'
  });

  try {
    const [templateRows] = await connection.query<
      Array<
        RowDataPacket & {
          id: number;
          code: string;
          name: string;
          voucher_type: string;
          is_active: number;
        }
      >
    >(
      `
        SELECT id, code, name, voucher_type, is_active
        FROM voucher_templates
        WHERE (
          code IN (${LEGACY_CODES.map(() => '?').join(', ')})
          OR voucher_type = 'campaign_direct_pay'
        )
          AND is_active = 1
        ORDER BY created_at DESC
      `,
      LEGACY_CODES
    );

    const [issuedRows] = await connection.query<
      Array<
        RowDataPacket & {
          id: number;
          user_id: number;
          status: string;
          code: string;
          name: string;
        }
      >
    >(
      `
        SELECT
          uv.id,
          uv.user_id,
          uv.status,
          vt.code,
          vt.name
        FROM user_vouchers uv
        JOIN voucher_templates vt ON vt.id = uv.voucher_template_id
        WHERE (vt.code IN (${LEGACY_CODES.map(() => '?').join(', ')})
            OR vt.voucher_type = 'campaign_direct_pay')
          AND uv.status = 'active'
        ORDER BY uv.issued_at DESC
      `,
      LEGACY_CODES
    );

    console.log(
      JSON.stringify(
        {
          mode: apply ? 'apply' : 'dry-run',
          templates: templateRows,
          activeIssuedVouchers: issuedRows
        },
        null,
        2
      )
    );

    if (!apply) {
      console.log(
        '\nDry run only. Re-run with --apply to deactivate templates and revoke active issued legacy vouchers.'
      );
      return;
    }

    await connection.beginTransaction();

    await connection.query(
      `
        UPDATE voucher_templates
        SET is_active = 0,
            valid_until = UTC_TIMESTAMP()
        WHERE code IN (${LEGACY_CODES.map(() => '?').join(', ')})
           OR voucher_type = 'campaign_direct_pay'
      `,
      LEGACY_CODES
    );

    await connection.query(
      `
        UPDATE user_vouchers uv
        JOIN voucher_templates vt ON vt.id = uv.voucher_template_id
        SET uv.status = 'revoked',
            uv.revoked_reason = 'legacy direct-pay voucher cleanup',
            uv.revoked_at = UTC_TIMESTAMP()
        WHERE (vt.code IN (${LEGACY_CODES.map(() => '?').join(', ')})
            OR vt.voucher_type = 'campaign_direct_pay')
          AND uv.status = 'active'
      `,
      LEGACY_CODES
    );

    await connection.commit();
    console.log('\nCleanup applied.');
  } catch (error) {
    try {
      await connection.rollback();
    } catch {}
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
