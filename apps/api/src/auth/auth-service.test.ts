import { describe, expect, it } from 'vitest';
import { generateTotp, hashPassword, validatePasswordPolicy, verifyPassword, verifyTotp } from './auth-service.js';

describe('auth-service', () => {
  it('hashes and verifies passwords using the native scrypt format', async () => {
    const hash = await hashPassword('ChangeMe123!@#');
    expect(hash.startsWith('scrypt$')).toBe(true);
    await expect(verifyPassword('ChangeMe123!@#', hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });

  it('rejects weak password policy inputs', () => {
    expect(validatePasswordPolicy('short')).toEqual(expect.arrayContaining(['Password minimum 12 characters.']));
    expect(validatePasswordPolicy('longbutnosymbol1A')).toContain('Password must include symbol.');
    expect(validatePasswordPolicy('LongEnough123!')).toHaveLength(0);
  });

  it('generates and verifies a six digit TOTP token', () => {
    const secret = Buffer.from('01234567890123456789').toString('base64');
    const token = generateTotp(secret, Date.now());
    expect(token).toMatch(/^\d{6}$/);
    expect(verifyTotp(secret, token)).toBe(true);
  });
});
