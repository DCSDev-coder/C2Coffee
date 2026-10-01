import mysql from 'mysql2/promise';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env' });

const APPLY_FLAG = '--apply';
const WELCOME_TEMPLATE_CODE = 'WELCOME10';

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
    const [templateRows] = await connection.query(
      `
        SELECT id, code, name, voucher_type, is_active
        FROM voucher_templates
        ORDER BY created_at DESC
      `
    );

    const [issuedRows] = await connection.query(
      `
        SELECT uv.id, uv.user_id, uv.status, vt.code, vt.name
        FROM user_vouchers uv
        JOIN voucher_templates vt ON vt.id = uv.voucher_template_id
        ORDER BY uv.issued_at DESC
      `
    );

    console.log(
      JSON.stringify(
        {
          mode: apply ? 'apply' : 'dry-run',
          templates: templateRows,
          issuedVouchers: issuedRows
        },
        null,
        2
      )
    );

    if (!apply) {
      console.log(
        '\nDry run only. Re-run with --apply to clear voucher tables and restore the welcome voucher template.'
      );
      return;
    }

    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');

    try {
      await connection.query('TRUNCATE TABLE voucher_redemptions');
      await connection.query('TRUNCATE TABLE user_vouchers');
      await connection.query('TRUNCATE TABLE voucher_templates');

      await connection.query(
        `
          INSERT INTO voucher_templates (
            code, name, voucher_type, discount_mode, discount_value, token_value,
            min_spend_rm, eligible_scope_json, exclude_scope_json, requires_drink_in_cart,
            stack_rule, expires_in_days, is_active
          )
          VALUES (
            ?,
            'Welcome New User Voucher',
            'welcome',
            'free_drink',
            0.00,
            10,
            NULL,
            JSON_OBJECT('category_codes', JSON_ARRAY('coffee', 'non_coffee')),
            NULL,
            1,
            'primary_only',
            14,
            1
          )
        `,
        [WELCOME_TEMPLATE_CODE]
      );
    } finally {
      await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    }

    console.log('\nVoucher tables reset and welcome voucher restored.');
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
