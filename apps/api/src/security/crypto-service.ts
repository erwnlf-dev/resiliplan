/**
 * Shared Encryption Service
 * AES-256-GCM for secrets at rest (API keys, tokens, webhooks).
 * Used by AI provider, integrations, and other secret-bearing tables.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { config } from '../config/index.js';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

export function encryptSecret(plaintext: string): string {
  const key = Buffer.from(config.API_KEY_ENCRYPTION_KEY.slice(0, 32), 'utf8');
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  return `enc:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

export function decryptSecret(ciphertext: string): string {
  if (!ciphertext.startsWith('enc:')) return ciphertext; // Plaintext passthrough
  const key = Buffer.from(config.API_KEY_ENCRYPTION_KEY.slice(0, 32), 'utf8');
  const parts = ciphertext.slice(4).split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted format');
  const [ivHex, tagHex, encrypted] = parts;

  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export function isEncrypted(value: string | undefined | null): boolean {
  return !!value && value.startsWith('enc:');
}

/**
 * Mask sensitive fields when returning integration to client.
 * Configurable per integration type.
 */
export function maskSecrets<T extends Record<string, unknown>>(config: T, secretKeys: string[] = ['apiKey', 'apiToken', 'webhookSecret', 'clientSecret']): T {
  const masked: Record<string, unknown> = { ...config };
  for (const k of secretKeys) {
    if (masked[k] && typeof masked[k] === 'string' && (masked[k] as string).length > 0) {
      masked[k] = '***';
    }
  }
  // Also mask nested provider-specific secrets
  for (const provider of ['netbox', 'prometheus', 'mattermost', 'keycloak', 'rundeck', 'webhook']) {
    const nested = masked[provider] as Record<string, unknown> | undefined;
    if (nested) {
      for (const k of secretKeys) {
        if (nested[k] && typeof nested[k] === 'string') {
          nested[k] = '***';
        }
      }
    }
  }
  return masked as T;
}
