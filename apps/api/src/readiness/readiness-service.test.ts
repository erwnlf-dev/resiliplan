import { describe, expect, it } from 'vitest';
import { evaluateProductionReadiness } from './readiness-service.js';

describe('readiness service', () => {
  it('fails when default encryption key is still configured', () => {
    const result = evaluateProductionReadiness({ nodeEnv: 'production', appUrl: 'https://app.local', apiUrl: 'https://api.local', encryptionKey: 'change-me-please-32-chars-minimum-please-change-in-production', corsOrigins: ['https://app.local'], smtpConfigured: true, migrationsApplied: 9 });
    expect(result.status).toBe('not_ready');
    expect(result.checks.find((check) => check.key === 'encryption_key')?.status).toBe('fail');
  });

  it('allows internal outbox mode when SMTP is not configured but marks warning', () => {
    const result = evaluateProductionReadiness({ nodeEnv: 'production', appUrl: 'https://app.local', apiUrl: 'https://api.local', encryptionKey: '0123456789abcdef0123456789abcdef', corsOrigins: ['https://app.local'], smtpConfigured: false, migrationsApplied: 9 });
    expect(result.status).toBe('ready_with_warnings');
    expect(result.checks.find((check) => check.key === 'smtp')?.status).toBe('warn');
  });

  it('passes when production-critical settings are complete', () => {
    const result = evaluateProductionReadiness({ nodeEnv: 'production', appUrl: 'https://app.local', apiUrl: 'https://api.local', encryptionKey: '0123456789abcdef0123456789abcdef', corsOrigins: ['https://app.local'], smtpConfigured: true, migrationsApplied: 9 });
    expect(result.status).toBe('ready');
    expect(result.failed).toBe(0);
    expect(result.warnings).toBe(0);
  });
});
