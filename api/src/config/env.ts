import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.string().default('info'),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  OTP_EXPIRY_SECONDS: z.coerce.number().int().positive().default(300),
  OTP_RESEND_SECONDS: z.coerce.number().int().positive().default(45),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  ACCOUNT_RETENTION_YEARS: z.coerce.number().int().positive().default(7),
  PUBLIC_API_BASE_URL: z.string().url(),
  CORS_ALLOWED_ORIGINS: z.string().default(''),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),
  DB_CONNECTION_LIMIT: z.coerce.number().int().positive().default(10),
  ACCESS_TOKEN_SECRET: z.string().min(32),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  BILLPLZ_BASE_URL: z.string().url(),
  BILLPLZ_COLLECTION_ID: z.string().min(1),
  BILLPLZ_API_KEY: z.string().min(1),
  BILLPLZ_X_SIGNATURE_KEY: z.string().min(1),
  WHATSAPP_CLOUD_API_TOKEN: z.string().min(1),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1),
  SMS_PROVIDER_BASE_URL: z.string().min(1),
  SMS_PROVIDER_API_KEY: z.string().min(1)
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
