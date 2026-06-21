# ResiliPlan Internal Production Release Packet

Author: Erwin Alifiansyah  
Scope: Internal office production readiness, professional SaaS posture without external commercialization dependency.

## Release objective
Prepare ResiliPlan for controlled internal use at PT Datacomm Diangraha while keeping the architecture ready for future professional/SaaS expansion.

## Current production posture
- Authenticated Fastify API + React web app.
- PostgreSQL-backed tenant/user/DRP/BIA/resilience/billing/email-outbox data model.
- CSRF protection, MFA setup/verify, password change, password reset token flow.
- Governed email outbox for password reset and mention notification drafts.
- Production readiness API/UI checks.
- Health/readiness endpoints and monitoring counters.
- Audit logs for key create/update/approval/outbox actions.
- DRP quality score for completeness/readiness review.
- Evidence attachment links per plan/section.
- Searchable/exportable audit trail.
- Backup dashboard reading latest daily dump/checksum state.

## Confirmed internal launch decisions
- Access URL: direct VM IP and port for now.
- SMTP: not required for first launch; configure later from Settings dashboard / outbox posture.
- Admin users: Erwin Alifiansyah only for initial access.
- Backup: daily database backup.
- Network access: restricted by VM security group.

## Go-live checklist

### 1. Environment
- Copy `.env.example` to `.env`.
- Set `NODE_ENV=production`.
- Set `APP_URL=http://<VM_IP>:5173` and `API_URL=http://<VM_IP>:3001` for initial IP:port access.
- Generate a non-default `API_KEY_ENCRYPTION_KEY`:
  ```bash
  openssl rand -hex 32
  ```
- Set `CORS_ORIGINS` to the exact internal frontend IP:port URL only.
- Set `API_HOST=0.0.0.0` only when the VM security group restricts source access.

### 2. Database
Run:
```bash
pnpm --filter @resiliplan/api run db:migrate
```
Verify:
```sql
select name, applied_at from _resiliplan_migrations order by name;
```
Expected latest migration: `0009_email_outbox.sql`.

### 3. Build verification
Run before restart/deploy:
```bash
pnpm typecheck
pnpm build
pnpm --filter @resiliplan/api test
```
Expected baseline after this packet: 10 test files, 32 tests passing.

### 4. Runtime checks
After starting API/web/collab services:
```bash
curl -fsS http://127.0.0.1:3001/api/health/live
curl -fsS http://127.0.0.1:3001/api/health/ready
```
Then login as admin and open:
- `/readiness`
- `/monitoring`
- `/email-outbox`
- `/security`

### 5. Email posture
Initial internal production mode may run without SMTP.
- Password reset requests create `email_outbox` rows.
- Mention notifications create app notifications and email outbox rows.
- Admin/coordinator can review queued emails in the Email Outbox page.
- SMTP delivery should only be enabled later from the Settings dashboard after internal relay details are confirmed.

### 6. Daily backup
Install daily cron on the VM:
```bash
0 1 * * * cd /path/to/ResiliPlan && BACKUP_DIR=/var/backups/resiliplan RETENTION_DAYS=14 scripts/daily-backup.sh >> /var/log/resiliplan-backup.log 2>&1
```
Manual verification:
```bash
scripts/daily-backup.sh
ls -lh /var/backups/resiliplan
sha256sum -c /var/backups/resiliplan/*.sha256
```

### 7. Rollback
If deployment fails:
1. Stop new runtime process.
2. Restore previous git commit.
3. Rebuild previous commit.
4. Point service manager back to previous build.
5. Database rollback is not automatic; avoid destructive migrations. Current migration `0009_email_outbox.sql` is additive.

## Remaining decisions before office launch
- Exact VM IP and ports to publish in `.env`.
- Security group source CIDR allowlist.
- MFA requirement date for Erwin admin account.
- Backup restore test window.
- SMTP relay details when ready.

## Not included yet
- SSO/OIDC provider integration.
- Automatic SMTP send worker.
- Payment provider integration.
- Public SaaS hardening/legal/commercial package.
