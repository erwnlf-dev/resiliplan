import { asc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { emailOutbox } from '../db/schema/email.js';
import { logger } from '../utils/logger.js';

const BATCH_SIZE = 10;

export async function processEmailOutbox(): Promise<{ processed: number; sent: number; failed: number }> {
  const stats = { processed: 0, sent: 0, failed: 0 };
  const smtpConfig = getSmtpConfig();

  if (!smtpConfig) {
    logger.info('[smtp-worker] SMTP not configured; queued emails remain in outbox for manual handling');
    return stats;
  }

  const pendingEmails = await db
    .select()
    .from(emailOutbox)
    .where(eq(emailOutbox.status, 'queued'))
    .orderBy(asc(emailOutbox.queuedAt))
    .limit(BATCH_SIZE);

  for (const email of pendingEmails) {
    stats.processed++;
    try {
      await sendEmailViaSmtp(smtpConfig, email);
      await db
        .update(emailOutbox)
        .set({ status: 'sent', sentAt: new Date(), lastError: null, updatedAt: new Date() })
        .where(eq(emailOutbox.id, email.id));
      stats.sent++;
      logger.info({ emailId: email.id, toEmail: email.toEmail }, '[smtp-worker] Email sent');
    } catch (error) {
      stats.failed++;
      const message = error instanceof Error ? error.message : 'Unknown SMTP error';
      await db
        .update(emailOutbox)
        .set({ status: 'failed', lastError: message, updatedAt: new Date() })
        .where(eq(emailOutbox.id, email.id));
      logger.error({ err: error, emailId: email.id }, '[smtp-worker] Email failed');
    }
  }

  return stats;
}

function getSmtpConfig(): { host: string; port: number; secure: boolean; user?: string; pass?: string } | null {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return {
    host,
    port: Number.parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  };
}

async function sendEmailViaSmtp(config: NonNullable<ReturnType<typeof getSmtpConfig>>, email: typeof emailOutbox.$inferSelect): Promise<void> {
  // SMTP delivery is intentionally approval/config gated. This worker is ready to be
  // wired to an SMTP library after relay details are approved; in test it simulates send.
  logger.info({ emailId: email.id, toEmail: email.toEmail, subject: email.subject, smtpHost: config.host, smtpPort: config.port }, '[smtp-worker] SMTP send requested');
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('SMTP transport not enabled yet; keep email in governed outbox');
  }
}

export async function startSmtpWorker(intervalMs = 30_000): Promise<() => void> {
  logger.info({ intervalMs }, '[smtp-worker] Starting');
  let running = false;

  const processBatch = async () => {
    if (running) return;
    running = true;
    try {
      const stats = await processEmailOutbox();
      if (stats.processed > 0) logger.info(stats, '[smtp-worker] Batch complete');
    } catch (error) {
      logger.error({ err: error }, '[smtp-worker] Batch error');
    } finally {
      running = false;
    }
  };

  await processBatch();
  const timer = setInterval(processBatch, intervalMs);
  return () => {
    clearInterval(timer);
    logger.info('[smtp-worker] Stopped');
  };
}
