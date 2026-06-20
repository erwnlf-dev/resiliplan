import { z } from 'zod';

export const queueEmailSchema = z.object({
  toEmail: z.string().email(),
  subject: z.string().min(3),
  bodyText: z.string().min(3),
  emailType: z.enum(['password_reset', 'mention_notification', 'approval_notification', 'system_notice']),
  recipientUserId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export function buildPasswordResetEmail(input: { appUrl: string; token: string; minutesValid?: number }) {
  const resetUrl = `${input.appUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(input.token)}`;
  const minutesValid = input.minutesValid ?? 30;
  return {
    subject: 'ResiliPlan password reset',
    bodyText: [
      'A password reset was requested for your ResiliPlan account.',
      '',
      `Reset link: ${resetUrl}`,
      `This link expires in ${minutesValid} minutes.`,
      '',
      'If you did not request this reset, contact IT Service Resilience.',
    ].join('\n'),
    resetUrl,
  };
}

export function buildMentionEmail(input: { appUrl: string; planId: string; sectionKey: string; commentBody: string }) {
  const planUrl = `${input.appUrl.replace(/\/$/, '')}/plans/${input.planId}`;
  return {
    subject: `ResiliPlan mention on ${input.sectionKey}`,
    bodyText: [
      `You were mentioned in a ResiliPlan review note for section ${input.sectionKey}.`,
      '',
      input.commentBody,
      '',
      `Open plan: ${planUrl}`,
    ].join('\n'),
    planUrl,
  };
}
