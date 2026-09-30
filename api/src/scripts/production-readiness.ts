import nodemailer from 'nodemailer';

import { env } from '../config/env.js';

type Check = {
  name: string;
  detail: string;
  run: () => Promise<void> | void;
};

function requireValue(name: string, value: string): void {
  if (!value || value.includes('REPLACE_WITH')) {
    throw new Error(`${name} is not configured.`);
  }
}

async function requireHealthy(url: string): Promise<void> {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}.`);
  }
}

type BillplzItem = Record<string, unknown>;

async function fetchBillplzList(path: string, property: string): Promise<BillplzItem[]> {
  const baseUrl = env.TOPUP_GATEWAY_BASE_URL.replace(/\/+$/, '');
  const authorization = `Basic ${Buffer.from(`${env.TOPUP_GATEWAY_API_KEY}:`).toString('base64')}`;
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { authorization },
    signal: AbortSignal.timeout(10_000)
  });
  const body = await response.json().catch(() => null) as Record<string, unknown> | null;
  const items = body?.[property];
  if (!response.ok || !Array.isArray(items)) {
    throw new Error(`Billplz ${property.replaceAll('_', ' ')} lookup returned HTTP ${response.status}.`);
  }
  return items.filter((item): item is BillplzItem => Boolean(item) && typeof item === 'object');
}

async function requireBillplzApprovedMethods(): Promise<void> {
  const collectionId = encodeURIComponent(env.TOPUP_GATEWAY_COLLECTION_ID);
  const collectionMethods = await fetchBillplzList(
    `/v3/collections/${collectionId}/payment_methods`,
    'payment_methods'
  );
  const activeCollectionCodes = new Set(
    collectionMethods
      .filter((method) => method.active === true)
      .map((method) => String(method.code ?? ''))
  );
  const requiredCollectionCode: Record<string, string> = {
    touch_n_go: 'touchngo',
    card: 'billplz',
    bank_transfer: 'fpx'
  } as const;

  for (const method of env.TOPUP_GATEWAY_ALLOWED_METHODS) {
    const collectionCode = requiredCollectionCode[method];
    if (!activeCollectionCodes.has(collectionCode)) {
      throw new Error(`Billplz method ${method} is allowed by the API but is not active for this collection.`);
    }
  }

  if (env.TOPUP_GATEWAY_ALLOWED_METHODS.includes('bank_transfer')) {
    const banks = await fetchBillplzList('/v3/fpx_banks', 'banks');
    if (!banks.some((bank) => bank.active === true)) {
      throw new Error('Billplz online banking is active for the collection, but no FPX bank is currently available.');
    }
  }

  const requiredGatewayCodes = new Set<string>();
  if (env.TOPUP_GATEWAY_ALLOWED_METHODS.includes('touch_n_go')) requiredGatewayCodes.add('BP-TNG01');
  if (env.TOPUP_GATEWAY_ALLOWED_METHODS.includes('card')) requiredGatewayCodes.add('BP-BILLPLZ1');
  if (requiredGatewayCodes.size === 0) return;

  const gateways = await fetchBillplzList('/v4/payment_gateways', 'payment_gateways');
  const activeGatewayCodes = new Set(
    gateways
      .filter((gateway) => gateway.active === true)
      .map((gateway) => String(gateway.code ?? ''))
  );
  for (const requiredCode of requiredGatewayCodes) {
    if (!activeGatewayCodes.has(requiredCode)) {
      throw new Error(`Billplz gateway ${requiredCode} is required by the API allowlist but is not active.`);
    }
  }
}

async function main(): Promise<void> {
  const publicOrigin = env.PUBLIC_API_BASE_URL.replace(/\/v1\/?$/, '');
  const fcmReadinessDetail = env.FCM_DELIVERY_ENABLED
    ? 'FCM delivery is enabled and the service-account secret has the required fields; a physical device test remains required.'
    : 'FCM delivery is disabled. Set FCM_DELIVERY_ENABLED=true and install the service-account secret before testing notifications.';
  const topUpReadinessDetail = env.TOPUP_GATEWAY_ENABLED
    ? `Top-up gateway ${env.TOPUP_GATEWAY_PROVIDER} allowlist is ${env.TOPUP_GATEWAY_ALLOWED_METHODS.join(', ')}. Collection-level activation is verified for every allowed method.`
    : 'Online token top-up is intentionally disabled. Counter/admin token credits remain the only available top-up route.';
  const checks: Check[] = [
    {
      name: 'Production environment',
      detail: 'Production mode, secure OTP configuration, and non-placeholder session secrets are required.',
      run: () => {
        if (env.NODE_ENV !== 'production') {
          throw new Error('NODE_ENV must be production.');
        }
        if (env.OTP_DELIVERY_MODE !== 'email' || env.OTP_DEBUG_EXPOSE_CODE) {
          throw new Error('Production OTP must use email with debug codes disabled.');
        }
        requireValue('ACCESS_TOKEN_SECRET', env.ACCESS_TOKEN_SECRET);
        requireValue('REFRESH_TOKEN_SECRET', env.REFRESH_TOKEN_SECRET);
      }
    },
    {
      name: 'Public HTTPS endpoint',
      detail: `${publicOrigin}/health and ${env.PUBLIC_API_BASE_URL}/health must be reachable through IIS.`,
      run: async () => {
        if (new URL(env.PUBLIC_API_BASE_URL).protocol !== 'https:') {
          throw new Error('PUBLIC_API_BASE_URL must use HTTPS.');
        }
        await requireHealthy(`${publicOrigin}/health`);
        await requireHealthy(`${env.PUBLIC_API_BASE_URL}/health`);
      }
    },
    {
      name: 'Local API and database',
      detail: 'The container health endpoint must confirm database connectivity.',
      run: () => requireHealthy('http://127.0.0.1:8080/v1/health')
    },
    {
      name: 'SMTP transport',
      detail: 'The live OTP mail transport must authenticate successfully; no message is sent.',
      run: async () => {
        requireValue('EMAIL_SMTP_HOST', env.EMAIL_SMTP_HOST);
        requireValue('EMAIL_SMTP_USER', env.EMAIL_SMTP_USER);
        requireValue('EMAIL_SMTP_PASSWORD', env.EMAIL_SMTP_PASSWORD);
        requireValue('EMAIL_FROM_ADDRESS', env.EMAIL_FROM_ADDRESS);
        const transport = nodemailer.createTransport({
          host: env.EMAIL_SMTP_HOST,
          port: env.EMAIL_SMTP_PORT,
          secure: env.EMAIL_SMTP_SECURE,
          auth: { user: env.EMAIL_SMTP_USER, pass: env.EMAIL_SMTP_PASSWORD }
        });
        await transport.verify();
      }
    },
    {
      name: 'Admin browser origin',
      detail: 'At least one HTTPS CORS origin is required for the admin session cookie flow.',
      run: () => {
        if (!env.CORS_ALLOWED_ORIGINS.some((origin) => origin.startsWith('https://'))) {
          throw new Error('CORS_ALLOWED_ORIGINS must include the Admin Web HTTPS origin.');
        }
      }
    },
    {
      name: 'FCM configuration',
      detail: fcmReadinessDetail,
      run: () => {
        if (!env.FCM_DELIVERY_ENABLED) return;
        const serviceAccount = JSON.parse(env.FCM_SERVICE_ACCOUNT_JSON) as Record<string, unknown>;
        if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
          throw new Error('The FCM service-account secret is incomplete.');
        }
      }
    },
    {
      name: 'Top-up gateway policy',
      detail: topUpReadinessDetail,
      run: () => {
        if (!env.TOPUP_GATEWAY_ENABLED) return;
        requireValue('TOPUP_GATEWAY_PROVIDER', env.TOPUP_GATEWAY_PROVIDER);
        requireValue('TOPUP_GATEWAY_BASE_URL', env.TOPUP_GATEWAY_BASE_URL);
        requireValue('TOPUP_GATEWAY_API_KEY', env.TOPUP_GATEWAY_API_KEY);
        requireValue('TOPUP_GATEWAY_WEBHOOK_SECRET', env.TOPUP_GATEWAY_WEBHOOK_SECRET);
        requireValue('TOPUP_GATEWAY_COLLECTION_ID', env.TOPUP_GATEWAY_COLLECTION_ID);
        if (env.TOPUP_GATEWAY_PROVIDER !== 'billplz') {
          throw new Error('Only Billplz is approved for online C2 Token top-up.');
        }
        if (env.TOPUP_GATEWAY_ALLOWED_METHODS.includes('atome')) {
          throw new Error('Atome must not be enabled for token top-up.');
        }
        return requireBillplzApprovedMethods();
      }
    }
  ];

  let failed = false;
  for (const check of checks) {
    try {
      await check.run();
      console.log(`PASS  ${check.name} - ${check.detail}`);
    } catch (error) {
      failed = true;
      const message = error instanceof Error ? error.message : 'Unknown error.';
      console.error(`FAIL  ${check.name} - ${message}`);
    }
  }

  console.log('MANUAL  Verify one OTP email, Admin Web login/refresh/logout, and a real device notification.');
  if (env.PRINT_CONNECTOR_SHARED_SECRET) {
    console.log('MANUAL  A print connector is configured; verify one physical receipt using the connected printer hardware.');
  } else {
    console.log('INFO    Receipt printing is not configured in this deployment; no physical-printer test is required.');
  }
  if (env.TOPUP_GATEWAY_ENABLED) {
    console.log(`MANUAL  Complete one end-to-end ${env.TOPUP_GATEWAY_ALLOWED_METHODS.join('/')} payment and signed callback in the configured Billplz environment before customer launch.`);
  }
  if (failed) process.exitCode = 1;
}

void main();
