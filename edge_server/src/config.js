const allowedTransports = new Set(['network_escpos']);

function required(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function integer(env, name, fallback, { min, max }) {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

function boolean(env, name, fallback = false) {
  const raw = env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(`${name} must be true or false.`);
}

export function createConfig(env) {
  const apiUrl = new URL(required(env, 'C2_API_URL'));
  if (!['http:', 'https:'].includes(apiUrl.protocol)) {
    throw new Error('C2_API_URL must use http or https.');
  }

  const transport = env.PRINTER_TRANSPORT?.trim() || 'network_escpos';
  if (!allowedTransports.has(transport)) {
    throw new Error(`PRINTER_TRANSPORT must be one of: ${[...allowedTransports].join(', ')}.`);
  }

  const config = {
    apiUrl: apiUrl.toString().replace(/\/$/, ''),
    connectorSecret: required(env, 'C2_PRINT_CONNECTOR_SHARED_SECRET'),
    printerReference: required(env, 'PRINTER_REFERENCE'),
    transport,
    pollIntervalMs: integer(env, 'POLL_INTERVAL_MS', 2000, { min: 500, max: 60000 }),
    requestTimeoutMs: integer(env, 'REQUEST_TIMEOUT_MS', 10000, { min: 1000, max: 60000 }),
    dryRun: boolean(env, 'DRY_RUN', false)
  };

  if (transport === 'network_escpos') {
    config.printerHost = required(env, 'PRINTER_HOST');
    config.printerPort = integer(env, 'PRINTER_PORT', 9100, { min: 1, max: 65535 });
  }

  return Object.freeze(config);
}
