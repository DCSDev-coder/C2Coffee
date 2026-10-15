import nodemailer from 'nodemailer';

import { env } from '../config/env.js';
import { getActiveChipMethods } from '../payments/chip-client.js';

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

async function requireChipApprovedMethods(): Promise<void> {
  const active = await getActiveChipMethods();
  for (const method of env.TOPUP_GATEWAY_ALLOWED_METHODS) {
    if (!active.has(method as 'fpx' | 'duitnow_qr' | 'card' | 'ewallet')) {
      throw new Error(`CHIP method ${method} is allowed by the API but is not active for this brand.`);
    }
  }
}

async function main(): Promise<void> {
  const publicOrigin = env.PUBLIC_API_BASE_URL.replace(/\/v1\/?$/, '');
  const fcmReadinessDetail = env.FCM_DELIVERY_ENABLED
    ? 'FCM delivery is enabled and the service-account secret has the required fields; a physical device test remains required.'
    : 'FCM delivery is disabled. Set FCM_DELIVERY_ENABLED=true and install the service-account secret before testing notifications.';
  const topUpReadinessDetail = env.TOPUP_GATEWAY_ENABLED
    ? `Top-up gateway ${env.TOPUP_GATEWAY_PROVIDER} allowlist is ${env.TOPUP_GATEWAY_ALLOWED_METHODS.join(', ')}. Brand-level activation is verified for every allowed method.`
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
        requireValue('TOPUP_GATEWAY_BRAND_ID', env.TOPUP_GATEWAY_BRAND_ID);
        if (env.TOPUP_GATEWAY_PROVIDER !== 'chip') {
          throw new Error('Only CHIP is approved for online C2 Token top-up.');
        }
        if (env.TOPUP_GATEWAY_ALLOWED_METHODS.includes('atome')) {
          throw new Error('Atome must not be enabled for token top-up.');
        }
        return requireChipApprovedMethods();
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
    console.log(`MANUAL  Complete one end-to-end ${env.TOPUP_GATEWAY_ALLOWED_METHODS.join('/')} payment and verified callback in CHIP before customer launch.`);
  }
  if (failed) process.exitCode = 1;
}

void main();
