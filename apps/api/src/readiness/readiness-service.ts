export type ReadinessCheck = {
  key: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
};

export function evaluateProductionReadiness(input: {
  nodeEnv: string;
  appUrl: string;
  apiUrl: string;
  encryptionKey: string;
  corsOrigins: string[];
  smtpConfigured: boolean;
  migrationsApplied: number;
}) {
  const checks: ReadinessCheck[] = [
    {
      key: 'node_env',
      label: 'Runtime mode',
      status: input.nodeEnv === 'production' ? 'pass' : 'warn',
      detail: input.nodeEnv === 'production' ? 'NODE_ENV is production.' : `NODE_ENV is ${input.nodeEnv}; acceptable for dev/staging, not final production.`,
    },
    {
      key: 'encryption_key',
      label: 'Encryption key',
      status: input.encryptionKey.includes('change-me') || input.encryptionKey.length < 32 ? 'fail' : 'pass',
      detail: input.encryptionKey.includes('change-me') ? 'Default encryption key is still configured.' : 'Encryption key length/pattern is acceptable.',
    },
    {
      key: 'cors',
      label: 'CORS origins',
      status: input.corsOrigins.some((origin) => origin.includes('localhost') || origin.includes('127.0.0.1')) && input.nodeEnv === 'production' ? 'warn' : 'pass',
      detail: `${input.corsOrigins.length} allowed origin(s): ${input.corsOrigins.join(', ')}`,
    },
    {
      key: 'smtp',
      label: 'SMTP configuration',
      status: input.smtpConfigured ? 'pass' : 'warn',
      detail: input.smtpConfigured ? 'SMTP variables are configured.' : 'SMTP not configured; email remains governed outbox/manual-send mode.',
    },
    {
      key: 'migrations',
      label: 'Database migrations',
      status: input.migrationsApplied > 0 ? 'pass' : 'fail',
      detail: `${input.migrationsApplied} migration(s) recorded in database ledger.`,
    },
    {
      key: 'urls',
      label: 'Application URLs',
      status: input.appUrl.startsWith('https://') && input.apiUrl.startsWith('https://') ? 'pass' : 'warn',
      detail: `APP_URL=${input.appUrl}; API_URL=${input.apiUrl}`,
    },
  ];
  const failed = checks.filter((check) => check.status === 'fail').length;
  const warnings = checks.filter((check) => check.status === 'warn').length;
  return {
    status: failed > 0 ? 'not_ready' : warnings > 0 ? 'ready_with_warnings' : 'ready',
    failed,
    warnings,
    checks,
  };
}
