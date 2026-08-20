import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(crypto.scrypt);
const PASSWORD_HASH_ALGORITHM = 'scrypt';
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_HASH_BYTES = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(PASSWORD_SALT_BYTES).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, PASSWORD_HASH_BYTES)) as Buffer;

  return [
    PASSWORD_HASH_ALGORITHM,
    salt,
    derivedKey.toString('hex')
  ].join('$');
}

export async function verifyPassword(
  password: string,
  encodedHash: string
): Promise<boolean> {
  const [algorithm, salt, expectedHash] = encodedHash.split('$');
  if (algorithm !== PASSWORD_HASH_ALGORITHM || !salt || !expectedHash) {
    return false;
  }

  const derivedKey = (await scryptAsync(password, salt, PASSWORD_HASH_BYTES)) as Buffer;
  const actual = Buffer.from(derivedKey.toString('hex'), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');

  if (actual.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(actual, expected);
}
