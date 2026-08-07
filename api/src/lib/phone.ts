import { ApiError } from '../http/errors.js';

export function normalizePhoneE164(input: string): string {
  const trimmed = input.trim();
  const normalized = trimmed.replace(/[^\d+]/g, '');

  if (normalized.length === 0) {
    throw new ApiError(400, 'invalid_phone', 'Phone number is required.');
  }

  let e164 = normalized;

  if (e164.startsWith('00')) {
    e164 = `+${e164.slice(2)}`;
  } else if (e164.startsWith('60')) {
    e164 = `+${e164}`;
  } else if (e164.startsWith('0')) {
    e164 = `+60${e164.slice(1)}`;
  } else if (!e164.startsWith('+')) {
    throw new ApiError(
      400,flutter run --dart-define=USE_MOCK_AUTH=false
      'invalid_phone',
      'Phone number must be a valid Malaysian mobile number.'
    );
  }

  if (!/^\+\d{9,15}$/.test(e164)) {
    throw new ApiError(
      400,
      'invalid_phone',
      'Phone number must be a valid Malaysian mobile number.'
    );
  }

  return e164;
}
