import crypto from 'node:crypto';

export function hashSha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function generateOtpCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

export function generateOpaqueToken(): string {
  return crypto.randomBytes(48).toString('base64url');
}

export function generateDeviceActivationCode(): string {
  const value = crypto.randomBytes(8).toString('hex').toUpperCase();
  return `C2-${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8, 12)}-${value.slice(12)}`;
}

export function otpMatches(code: string, expectedHash: string): boolean {
  const actualHash = hashSha256(code);
  return crypto.timingSafeEqual(
    Buffer.from(actualHash, 'hex'),
    Buffer.from(expectedHash, 'hex')
  );
}
