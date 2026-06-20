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

## Go-live checklist

### 1. Environment
- Copy `.env.example` to `.env`.
- Set `NODE_ENV=production`.
- Set real `APP_URL` and `API_URL`.
- Generate a non-default `API_KEY_ENCRYPTION_KEY`:
  ```bash
  openssl rand -hex 32
  ```
- Set `CORS_ORIGINS` to the exact internal frontend URL only.
- Keep `API_HOST=127.0.0.1` when fronted by nginx/Tailscale/reverse proxy.

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
- SMTP delivery should only be enabled after internal relay details are confirmed.

### 6. Rollback
If deployment fails:
1. Stop new runtime process.
2. Restore previous git commit.
3. Rebuild previous commit.
4. Point service manager back to previous build.
5. Database rollback is not automatic; avoid destructive migrations. Current migration `0009_email_outbox.sql` is additive.

## Remaining decisions before office launch
- Final internal URL/domain.
- Internal SMTP relay account or manual Email Outbox handling for first week.
- Admin user list and MFA requirement date.
- Backup schedule and restore test window.
- Whether access is via LAN DNS, VPN, or Tailscale.

## Not included yet
- SSO/OIDC provider integration.
- Automatic SMTP send worker.
- Payment provider integration.
- Public SaaS hardening/legal/commercial package.
