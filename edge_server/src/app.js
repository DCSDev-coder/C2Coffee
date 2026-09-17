import process from 'node:process';

import { createConfig } from './config.js';
import { PrintConnector } from './print-connector.js';

async function main() {
  const config = createConfig(process.env);
  const connector = new PrintConnector(config);
  await connector.run();
}

main().catch((error) => {
  console.error(`[connector] Unable to start: ${error.message}`);
  process.exitCode = 1;
});
