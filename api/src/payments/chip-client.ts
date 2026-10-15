import crypto from 'node:crypto';

import { env } from '../config/env.js';
import { ApiError } from '../http/errors.js';
import { parseChipCallbackPublicKeyPayload } from './chip-callback-key.js';

export type ChipPaymentMethod = 'fpx' | 'duitnow_qr' | 'card' | 'ewallet';

type ChipPaymentMethodsResponse = {
  available_payment_methods?: unknown;
};

let cachedCallbackPublicKey: { value: string; expiresAt: number } | null = null;

export type ChipPurchase = {
  id?: unknown;
  brand_id?: unknown;
  checkout_url?: unknown;
  status?: unknown;
  updated_on?: unknown;
  payment?: { payment_type?: unknown } | null;
  purchase?: {
    currency?: unknown;
    total?: unknown;
  } | null;
};

function baseUrl(): string {
  return `${env.TOPUP_GATEWAY_BASE_URL.replace(/\/+$/, '')}/`;
}

function methodCodes(method: ChipPaymentMethod): string[] {
  switch (method) {
    case 'fpx': return env.CHIP_FPX_METHOD_CODES;
    case 'duitnow_qr': return env.CHIP_DUITNOW_METHOD_CODES;
    case 'card': return env.CHIP_CARD_METHOD_CODES;
    case 'ewallet': return env.CHIP_EWALLET_METHOD_CODES;
  }
}

async function chipRequest(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(new URL(path.replace(/^\/+/, ''), baseUrl()), {
      ...init,
      headers: {
        authorization: `Bearer ${env.TOPUP_GATEWAY_API_KEY}`,
        accept: 'application/json',
        ...init?.headers
      },
      signal: AbortSignal.timeout(15_000)
    });
  } catch (error) {
    throw new ApiError(502, 'topup_gateway_error', 'CHIP payment service is temporarily unavailable.');
  }
}

export function assertChipConfigured(): void {
  if (!env.TOPUP_GATEWAY_ENABLED || env.TOPUP_GATEWAY_PROVIDER !== 'chip') {
    throw new ApiError(503, 'topup_gateway_unavailable', 'Online payment is not available yet.');
  }
}

export async function getActiveChipMethods(amountCents = 100): Promise<Map<ChipPaymentMethod, string[]>> {
  assertChipConfigured();
  const query = new URLSearchParams({
    brand_id: env.TOPUP_GATEWAY_BRAND_ID,
    currency: 'MYR',
    amount: String(amountCents)
  });
  const response = await chipRequest(`payment_methods/?${query}`);
  const body = await response.json().catch(() => null) as ChipPaymentMethodsResponse | null;
  if (!response.ok || !Array.isArray(body?.available_payment_methods)) {
    throw new ApiError(502, 'topup_gateway_error', 'Payment options are temporarily unavailable.');
  }

  const activeCodes = new Set(
    body.available_payment_methods.filter((value): value is string => typeof value === 'string')
  );
  const result = new Map<ChipPaymentMethod, string[]>();
  for (const method of ['fpx', 'duitnow_qr', 'card', 'ewallet'] as const) {
    if (!env.TOPUP_GATEWAY_ALLOWED_METHODS.includes(method)) continue;
    const active = methodCodes(method).filter((code) => activeCodes.has(code));
    if (active.length > 0) result.set(method, active);
  }
  return result;
}

export async function createChipPurchase(input: {
  reference: string;
  customerName: string;
  customerEmail: string;
  amountCents: number;
  description: string;
  method: ChipPaymentMethod;
  callbackUrl: string;
}): Promise<{ id: string; checkoutUrl: string }> {
  const active = await getActiveChipMethods(input.amountCents);
  const whitelist = active.get(input.method);
  if (!whitelist?.length) {
    throw new ApiError(503, 'topup_method_unavailable', 'That payment method is not active for C2 Coffee yet.');
  }

  const response = await chipRequest('purchases/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      brand_id: env.TOPUP_GATEWAY_BRAND_ID,
      reference: input.reference,
      client: {
        email: input.customerEmail,
        full_name: input.customerName
      },
      purchase: {
        currency: 'MYR',
        products: [{ name: input.description, price: input.amountCents, quantity: 1 }]
      },
      payment_method_whitelist: whitelist,
      success_callback: input.callbackUrl,
      send_receipt: false
    })
  });
  const body = await response.json().catch(() => null) as ChipPurchase | null;
  const id = typeof body?.id === 'string' ? body.id : '';
  const checkoutUrl = typeof body?.checkout_url === 'string' ? body.checkout_url : '';
  if (!response.ok || !id || !isTrustedChipCheckoutUrl(checkoutUrl)) {
    throw new ApiError(502, 'topup_gateway_error', 'Unable to start the CHIP payment. Please try again.');
  }
  return { id, checkoutUrl };
}

export async function getChipPurchase(id: string): Promise<ChipPurchase> {
  assertChipConfigured();
  const response = await chipRequest(`purchases/${encodeURIComponent(id)}/`);
  const body = await response.json().catch(() => null) as ChipPurchase | null;
  if (!response.ok || !body || body.id !== id) {
    throw new ApiError(400, 'invalid_chip_callback', 'Unable to verify the CHIP purchase.');
  }
  return body;
}

async function getChipCallbackPublicKey(): Promise<string> {
  assertChipConfigured();
  if (cachedCallbackPublicKey && cachedCallbackPublicKey.expiresAt > Date.now()) {
    return cachedCallbackPublicKey.value;
  }

  const response = await chipRequest('public_key/');
  // CHIP documents this endpoint as returning the PEM itself rather than a
  // JSON object. Keep the parser tolerant of both formats for compatibility.
  const publicKey = parseChipCallbackPublicKeyPayload(await response.text());
  if (!response.ok || !publicKey) {
    throw new ApiError(502, 'topup_gateway_error', 'Unable to authenticate the CHIP callback.');
  }
  cachedCallbackPublicKey = { value: publicKey, expiresAt: Date.now() + 60 * 60 * 1000 };
  return publicKey;
}

export function verifyChipSignature(rawBody: Buffer, signature: string, publicKey: string): boolean {
  if (!rawBody.length || !/^[A-Za-z0-9+/]+={0,2}$/.test(signature)) return false;
  try {
    return crypto.verify('RSA-SHA256', rawBody, publicKey, Buffer.from(signature, 'base64'));
  } catch {
    return false;
  }
}

export async function verifyChipCallbackSignature(rawBody: Buffer, signature: string): Promise<boolean> {
  const publicKey = await getChipCallbackPublicKey();
  return verifyChipSignature(rawBody, signature, publicKey);
}

export function isTrustedChipCheckoutUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' &&
      (host === 'chip-in.asia' || host.endsWith('.chip-in.asia')) &&
      url.username === '' && url.password === '';
  } catch {
    return false;
  }
}

export function chipMethodLabel(method: unknown): string {
  const code = typeof method === 'string' ? method : '';
  if (code === 'fpx') return 'FPX Online Banking';
  if (code === 'duitnow_qr') return 'DuitNow QR';
  if (code === 'card') return 'Credit or debit card';
  if (code === 'ewallet') return 'E-wallet';
  if (env.CHIP_FPX_METHOD_CODES.includes(code)) return 'FPX Online Banking';
  if (env.CHIP_DUITNOW_METHOD_CODES.includes(code)) return 'DuitNow QR';
  if (env.CHIP_CARD_METHOD_CODES.includes(code)) return 'Credit or debit card';
  if (env.CHIP_EWALLET_METHOD_CODES.includes(code)) return 'E-wallet';
  return 'CHIP secure payment';
}
