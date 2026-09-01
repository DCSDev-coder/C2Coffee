import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.string().default('info'),
  OTP_DELIVERY_MODE: z.enum(['stub', 'log', 'email']).default('stub'),
  OTP_DEBUG_EXPOSE_CODE: z.coerce.boolean().default(false),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  OTP_EXPIRY_SECONDS: z.coerce.number().int().positive().default(300),
  OTP_RESEND_SECONDS: z.coerce.number().int().positive().default(45),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  ACCOUNT_RETENTION_YEARS: z.coerce.number().int().positive().default(7),
  LEGACY_DIRECT_PAYMENT_BYPASS: z.coerce.boolean().default(false),
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
  BILLPLZ_BASE_URL: z.string().optional().default(''),
  BILLPLZ_COLLECTION_ID: z.string().optional().default(''),
  BILLPLZ_API_KEY: z.string().optional().default(''),
  BILLPLZ_X_SIGNATURE_KEY: z.string().optional().default(''),
  WHATSAPP_CLOUD_API_TOKEN: z.string().optional().default(''),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().default(''),
  SMS_PROVIDER_BASE_URL: z.string().optional().default(''),
  SMS_PROVIDER_API_KEY: z.string().optional().default(''),
  EMAIL_SMTP_HOST: z.string().optional().default(''),
  EMAIL_SMTP_PORT: z.coerce.number().int().positive().default(587),
  EMAIL_SMTP_SECURE: z.coerce.boolean().default(false),
  EMAIL_SMTP_USER: z.string().optional().default(''),
  EMAIL_SMTP_PASSWORD: z.string().optional().default(''),
  EMAIL_FROM_ADDRESS: z.string().email().optional().default(''),
  EMAIL_FROM_NAME: z.string().optional().default('C2 Coffee & Candle')
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const formatted = parsedEnv.error.flatten().fieldErrors;
  throw new Error(`Invalid API environment: ${JSON.stringify(formatted)}`);
}

export const env = {
  ...parsedEnv.data,
  CORS_ALLOWED_ORIGINS: parsedEnv.data.CORS_ALLOWED_ORIGINS
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
};

export type ApiEnv = typeof env;
