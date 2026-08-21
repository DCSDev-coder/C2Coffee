import { mysqlPool } from './src/db/mysql.js';

async function run() {
  await mysqlPool.execute(
    "UPDATE admin_users SET password_hash = 'scrypt$7370a6aa00e5286d8a21743b7430fd02$d15e2e733b3b337c311b9a549f2a7af8cb3f5bf219ea61fe881d5205bac395bb7c38e61da66c6beb63dfaae07e813221cd6ce14f42dd00e211bf64cc063b9261' WHERE username = 'Boss';"
  );
  await mysqlPool.end();
  console.log("Updated password correctly.");
}

run();
