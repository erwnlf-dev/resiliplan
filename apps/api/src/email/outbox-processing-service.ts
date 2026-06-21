import { config } from '../config/index.js';
import type { EmailOutbox } from '../db/schema/index.js';

export type EmailProcessingPlan = {
  mode: 'manual_required' | 'smtp_ready';
  canAutoSend: boolean;
  detail: string;
};

export function getEmailProcessingPlan(): EmailProcessingPlan {
  const hasSmtp = Boolean(config.SMTP_HOST && config.SMTP_PORT && config.SMTP_FROM);
  if (!hasSmtp) {
    return { mode: 'manual_required', canAutoSend: false, detail: 'SMTP is not fully configured; keep emails in governed outbox for manual handling.' };
  }
  return { mode: 'smtp_ready', canAutoSend: false, detail: 'SMTP settings are present, but automatic send remains disabled until transport implementation and approval are completed.' };
}

export function buildManualEmailPacket(email: EmailOutbox) {
  return {
    to: email.toEmail,
    subject: email.subject,
    bodyText: email.bodyText,
    emailType: email.emailType,
    status: email.status,
    action: 'copy_to_approved_mail_client',
  };
}
