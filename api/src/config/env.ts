import 'dotenv/config';
import { z } from 'zod';

// JavaScript Boolean('false') is true, so z.coerce.boolean() is unsafe for
// deployment environment strings. Parse the explicit forms operators use.
const envBoolean = (defaultValue: boolean) => z.preprocess((value) => {
  if (value === undefined || value === '') return defaultValue;
  if (typeof value !== 'string') return value;

  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'no'].includes(normalized)) return false;
  return value;
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.string().default('info'),
  OTP_DELIVERY_MODE: z.enum(['stub', 'log', 'email']).default('stub'),
  OTP_DEBUG_EXPOSE_CODE: envBoolean(false),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  // Refresh sessions are rotated on successful use. Ninety days is the
  // maximum inactive period before customers and staff must sign in again.
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(90),
  OTP_EXPIRY_SECONDS: z.coerce.number().int().positive().default(300),
  OTP_RESEND_SECONDS: z.coerce.number().int().positive().default(45),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  ACCOUNT_RETENTION_YEARS: z.coerce.number().int().positive().default(7),
  PUBLIC_API_BASE_URL: z.string().url(),
  CORS_ALLOWED_ORIGINS: z.string().default(''),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().min(1),
  DB_CONNECTION_LIMIT: z.coerce.number().int().positive().default(10),
  ACCESS_TOKEN_SECRET: z.string().min(32),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  // Top-up stays fail-closed until a provider is approved and the gateway
  // implementation, credentials, and signed callback are all in place.
  TOPUP_GATEWAY_ENABLED: envBoolean(false),
  TOPUP_GATEWAY_PROVIDER: z.string().trim().max(50).default(''),
  TOPUP_GATEWAY_BASE_URL: z.string().trim().default(''),
  TOPUP_GATEWAY_API_KEY: z.string().trim().default(''),
  TOPUP_GATEWAY_WEBHOOK_SECRET: z.string().trim().default(''),
  TOPUP_GATEWAY_COLLECTION_ID: z.string().trim().max(100).default(''),
  // Approved customer top-up methods. The gateway adapter checks that each is
  // active with Billplz before returning it to the customer app.
  TOPUP_GATEWAY_ALLOWED_METHODS: z.string().trim().default('touch_n_go,card,bank_transfer'),
  WHATSAPP_CLOUD_API_TOKEN: z.string().optional().default(''),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().default(''),
  SMS_PROVIDER_BASE_URL: z.string().optional().default(''),
  SMS_PROVIDER_API_KEY: z.string().optional().default(''),
  EMAIL_SMTP_HOST: z.string().optional().default(''),
  EMAIL_SMTP_PORT: z.coerce.number().int().positive().default(587),
  EMAIL_SMTP_SECURE: envBoolean(false),
  EMAIL_SMTP_USER: z.string().optional().default(''),
  EMAIL_SMTP_PASSWORD: z.string().optional().default(''),
  EMAIL_FROM_ADDRESS: z.string().email().optional().default(''),
  EMAIL_FROM_NAME: z.string().optional().default('C2 Coffee & Candle'),
  SUPPORT_EMAIL_ADDRESS: z.string().email().default('support@c2coffeeandcandle.com'),
  ADMIN_COOKIE_DOMAIN: z.string().trim().optional().default(''),
  ADMIN_COOKIE_SECURE: envBoolean(false),
  ADMIN_COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  FCM_DELIVERY_ENABLED: envBoolean(false),
  FCM_SERVICE_ACCOUNT_JSON: z.string().optional().default(''),
  PRINT_CONNECTOR_SHARED_SECRET: z.string().optional().default('')
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const formatted = parsedEnv.error.flatten().fieldErrors;
  throw new Error(`Invalid API environment: ${JSON.stringify(formatted)}`);
}

const parsed = parsedEnv.data;

// A production deployment must never silently fall back to a development OTP
// path or expose a code through the API response.
if (parsed.NODE_ENV === 'production') {
  if (parsed.OTP_DELIVERY_MODE !== 'email' || parsed.OTP_DEBUG_EXPOSE_CODE) {
    throw new Error('Production requires OTP_DELIVERY_MODE=email and OTP_DEBUG_EXPOSE_CODE=false.');
  }

  if (!parsed.EMAIL_SMTP_HOST || !parsed.EMAIL_SMTP_USER || !parsed.EMAIL_SMTP_PASSWORD || !parsed.EMAIL_FROM_ADDRESS) {
    throw new Error('Production requires complete SMTP configuration for OTP delivery.');
  }

  if (parsed.FCM_DELIVERY_ENABLED && !parsed.FCM_SERVICE_ACCOUNT_JSON) {
    throw new Error('FCM_SERVICE_ACCOUNT_JSON is required when FCM_DELIVERY_ENABLED=true.');
  }
}

if (parsed.ADMIN_COOKIE_SAME_SITE === 'none' && !(parsed.NODE_ENV === 'production' || parsed.ADMIN_COOKIE_SECURE)) {
  throw new Error('ADMIN_COOKIE_SAME_SITE=none requires HTTPS via production mode or ADMIN_COOKIE_SECURE=true.');
}

const topUpMethods = parsed.TOPUP_GATEWAY_ALLOWED_METHODS
  .split(',')
  .map((method) => method.trim().toLowerCase())
  .filter(Boolean);
const allowedTopUpMethods = new Set(['touch_n_go', 'card', 'bank_transfer']);

if (topUpMethods.some((method) => !allowedTopUpMethods.has(method))) {
  throw new Error('TOPUP_GATEWAY_ALLOWED_METHODS may only include touch_n_go, card, and bank_transfer.');
}

if (parsed.TOPUP_GATEWAY_ENABLED) {
  if (!parsed.TOPUP_GATEWAY_PROVIDER || !parsed.TOPUP_GATEWAY_BASE_URL || !parsed.TOPUP_GATEWAY_API_KEY || !parsed.TOPUP_GATEWAY_WEBHOOK_SECRET || !parsed.TOPUP_GATEWAY_COLLECTION_ID) {
    throw new Error('TOPUP_GATEWAY_ENABLED=true requires provider, HTTPS base URL, API key, webhook secret, and collection ID.');
  }
  if (new URL(parsed.TOPUP_GATEWAY_BASE_URL).protocol !== 'https:') {
    throw new Error('TOPUP_GATEWAY_BASE_URL must use HTTPS.');
  }
  if (topUpMethods.length === 0) {
    throw new Error('TOPUP_GATEWAY_ENABLED=true requires at least one approved payment method.');
  }
}

export const env = {
  ...parsed,
  CORS_ALLOWED_ORIGINS: parsed.CORS_ALLOWED_ORIGINS
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  TOPUP_GATEWAY_ALLOWED_METHODS: topUpMethods
};

export type ApiEnv = typeof env;
