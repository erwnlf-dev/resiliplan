import { describe, expect, it } from 'vitest';
import { buildManualEmailPacket, getEmailProcessingPlan } from './outbox-processing-service.js';

describe('outbox processing service', () => {
  it('keeps automatic email sending approval-gated', () => {
    const plan = getEmailProcessingPlan();
    expect(plan.canAutoSend).toBe(false);
    expect(['manual_required', 'smtp_ready']).toContain(plan.mode);
  });

  it('builds a manual handling packet from queued email', () => {
    const packet = buildManualEmailPacket({ toEmail: 'ops@example.local', subject: 'Test', bodyText: 'Body', emailType: 'system_notice', status: 'queued' } as any);
    expect(packet).toMatchObject({ to: 'ops@example.local', subject: 'Test', action: 'copy_to_approved_mail_client' });
  });
});
