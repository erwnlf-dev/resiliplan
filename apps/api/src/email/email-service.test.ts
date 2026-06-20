import { describe, expect, it } from 'vitest';
import { buildMentionEmail, buildPasswordResetEmail, queueEmailSchema } from './email-service.js';

describe('email service', () => {
  it('builds a password reset email with a stable reset URL', () => {
    const email = buildPasswordResetEmail({ appUrl: 'https://resiliplan.internal/', token: 'abc+123', minutesValid: 15 });
    expect(email.subject).toContain('password reset');
    expect(email.resetUrl).toBe('https://resiliplan.internal/reset-password?token=abc%2B123');
    expect(email.bodyText).toContain('15 minutes');
  });

  it('builds mention notification email text', () => {
    const email = buildMentionEmail({ appUrl: 'https://resiliplan.internal', planId: 'plan-1', sectionKey: 'recovery', commentBody: 'please review' });
    expect(email.subject).toContain('recovery');
    expect(email.bodyText).toContain('please review');
    expect(email.planUrl).toBe('https://resiliplan.internal/plans/plan-1');
  });

  it('validates queue email payloads', () => {
    expect(queueEmailSchema.parse({ toEmail: 'ops@datacomm.co.id', subject: 'Notice', bodyText: 'Body', emailType: 'system_notice' }).emailType).toBe('system_notice');
    expect(() => queueEmailSchema.parse({ toEmail: 'bad', subject: 'x', bodyText: 'Body', emailType: 'system_notice' })).toThrow();
  });
});
