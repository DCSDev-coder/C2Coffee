export function parseChipCallbackPublicKeyPayload(payload: string): string {
  const trimmed = payload.trim();
  const isPem = (value: unknown): value is string =>
    typeof value === 'string' &&
    /^-----BEGIN (?:PUBLIC KEY|CERTIFICATE)-----/.test(value.trim());

  if (isPem(trimmed)) return trimmed;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    // CHIP currently returns a JSON string containing the PEM key. Keep
    // support for the object form for compatibility with other responses.
    if (isPem(parsed)) return parsed.trim();
    if (parsed && typeof parsed === 'object' && 'public_key' in parsed) {
      const publicKey = (parsed as { public_key?: unknown }).public_key;
      return isPem(publicKey) ? publicKey.trim() : '';
    }
    return '';
  } catch {
    return '';
  }
}
