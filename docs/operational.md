# ResiliPlan — Operational Runbook

> **Day-to-day operations guide for administrators and coordinators.**
>
> Use this for: routine monitoring, common incidents, backup verification, sync troubleshooting, and on-call procedures.

## Quick Reference

| Action | Command | UI Path |
|--------|---------|---------|
| Check system health | `pm2 jlist` + `curl localhost:3001/api/health` | Dashboard → Readiness |
| View PM2 logs | `pm2 logs resiliplan-api --lines 100` | — |
| Restart API | `pm2 restart resiliplan-api` | — |
| Restart web | `pm2 restart resiliplan-web` | — |
| Manual backup | `bash scripts/daily-backup.sh` | Backups page |
| Restore backup | `bash scripts/restore-from-backup.sh <file>` | — |
| View integration sync | `curl /api/v1/integrations/:id/syncs` | Integrations → History |
| Process webhook queue | `curl -X POST /api/v1/webhooks/outbox/process` | Integrations page |

## Daily Operations

### 1. Morning Health Check (5 min)

```bash
# PM2 status
pm2 jlist | python3 -c "import json,sys; ps=json.load(sys.stdin); [print(f'{p[\"name\"]:30s} {p[\"pm2_env\"][\"status\"]} uptime={p[\"pm2_env\"][\"pm2_uptime\"]//3600}h') for p in ps if 'resiliplan' in p['name']]"

# API health
curl -s http://localhost:3001/api/health | python3 -m json.tool

# DB connection
PGPASSWORD=$(grep DB_PASSWORD /home/erwin.alifiansyah/ITResilience_Prod/ResiliPlan/.env | cut -d= -f2) psql -h localhost -U resiliplan -d resiliplan -c "SELECT NOW(), COUNT(*) AS plan_count FROM drp_plans, COUNT(*) AS bia_count FROM bia_entries;"

# Disk usage
df -h /home /var
```

**Expected**:
- All 3 PM2 processes: `online`
- API health: `{"status":"ok"}`
- DB responsive (<100ms query)
- Disk usage < 80%

**If something wrong** → see "Common Incidents" below.

### 2. Integration Sync Health (10 min, weekday)

1. Login → **Integrations** page
2. Check KPI cards:
   - `Total`: configured integrations
   - `Active`: last sync OK
   - `Error`: needs attention
   - `Paused`: user-disabled
3. For each `Error` integration:
   - Click `History` to view last sync attempts
   - Read `Last error` field
   - Open logs: `pm2 logs resiliplan-api --lines 200 | grep -i <integration-name>`
4. For stale `Active` integrations (last sync > 24h):
   - Click `Sync` button to trigger manual sync
   - Verify success

### 3. Backup Verification (1 min, daily)

```bash
# List recent backups
ls -lh /home/erwin.alifiansyah/ITResilience_Prod/ResiliPlan/backups/daily/ | tail -5

# Verify checksum of today's backup
sha256sum -c backups/daily/resiliplan_$(date +%Y%m%d)_*.dump.sha256

# Verify backup can be restored (monthly test, NOT daily)
bash scripts/restore-from-backup.sh backups/daily/resiliplan_20260620_*.dump --dry-run
```

**Expected**:
- 1 backup per day (cron 03:00)
- SHA256 checksum matches
- Restore dry-run completes without error

### 4. Plan Quality Review (weekly, 15 min)

```sql
-- Find plans with no recent activity
SELECT id, name, criticality_tier, updated_at
FROM drp_plans
WHERE updated_at < NOW() - INTERVAL '90 days'
ORDER BY criticality_tier, updated_at;
```

**Action**: For each stale plan, schedule review with plan owner.

## Common Incidents

### A. API returns 500

**Symptoms**: Web app shows "Failed to load", API logs show stack trace

**Diagnosis**:
```bash
pm2 logs resiliplan-api --lines 100 --err
```

**Common causes**:
1. Database connection lost → check PostgreSQL: `pg_isready`
2. Out of memory → check `pm2 jlist` for memory %, restart
3. Bad migration → check if migration ran: `psql ... -c "\dt"`
4. Secrets rotated but cache stale → restart API

**Recovery**:
```bash
pm2 restart resiliplan-api
sleep 3
curl -s http://localhost:3001/api/health
```

### B. Web shows stale data

**Symptoms**: Just saved a plan, refresh page still shows old data

**Diagnosis**:
1. Check if save succeeded (toast notification)
2. Check API directly: `curl /api/v1/plans`
3. Check browser console for errors

**Common causes**:
1. CSRF token mismatch → re-login
2. Session expired → re-login
3. Cache not invalidated → hard refresh (Ctrl+Shift+R)

**Recovery**: Re-login, hard refresh, verify with API call.

### C. Integration sync fails

**Symptoms**: Integration in `Error` state, last error shown

**Diagnosis**:
1. UI: Integrations → Click `History` on failed integration
2. API: `curl /api/v1/integrations/{id}/syncs`
3. Logs: `pm2 logs resiliplan-api --lines 200 | grep -i error`

**Common errors & fixes**:

| Error | Cause | Fix |
|-------|-------|-----|
| `401 Unauthorized` | Invalid API token | Update token in Integration → Edit |
| `404 Not Found` | Wrong URL/tenant ID | Verify config (URL, tenant UUID) |
| `ECONNREFUSED` | Target system down | Check target system health |
| `Timeout` | Slow target | Increase timeout, or sync off-peak |
| `Tenant not found` | Wrong tenant UUID | Get correct UUID from target system |
| `Invalid signature` | Webhook secret mismatch | Regenerate secret, update both sides |

**Recovery**:
1. Fix root cause (update config, fix external system)
2. Click `Sync` to retry
3. Verify `Status` returns to `active`
4. If persistent after 3 retries → pause integration + investigate

### D. Backup missing

**Symptoms**: `/backups/daily/` has no file for today

**Diagnosis**:
```bash
# Check cron
crontab -l | grep -i backup

# Check last backup log
ls -la /home/erwin.alifiansyah/ITResilience_Prod/ResiliPlan/backups/.cron.log
tail -50 /home/erwin.alifiansyah/ITResilience_Prod/ResiliPlan/backups/.cron.log
```

**Common causes**:
1. Cron daemon stopped → `systemctl status cron`
2. Disk full → `df -h`
3. Database unreachable at 03:00 → check DB health at that time
4. Permission issue on backup dir → `ls -la backups/`

**Recovery**:
```bash
# Manual backup now
bash scripts/daily-backup.sh

# If cron is broken, reinstall
crontab < <(crontab -l; echo "0 3 * * * /usr/bin/bash /home/erwin.alifiansyah/ITResilience_Prod/ResiliPlan/scripts/daily-backup.sh >> /home/erwin.alifiansyah/ITResilience_Prod/ResiliPlan/backups/.cron.log 2>&1")
```

### E. Outbox queue stuck

**Symptoms**: Webhook events accumulating in `webhook_outbox`, never dispatched

**Diagnosis**:
```sql
SELECT event_type, status, attempts, COUNT(*)
FROM webhook_outbox
WHERE status = 'queued'
GROUP BY event_type, status, attempts
ORDER BY COUNT(*) DESC;
```

**Common causes**:
1. No worker process → check PM2 (webhook worker not deployed yet, use manual trigger)
2. Target system (Mattermost, webhook URL) down
3. Network issue

**Recovery**:
```bash
# Manually process outbox
curl -X POST http://localhost:3001/api/v1/webhooks/outbox/process \
  -H "X-CSRF-Token: ..." \
  -b cookies.txt
```

### F. Acronis sync returns 0 rows

**Symptoms**: Acronis integration succeeds but `rowsCreated=0, rowsUpdated=0`

**Diagnosis**:
1. Check `proxyUrl` is correct: `http://127.0.0.1:4184/api/workers/acronis/query`
2. Check `tenantId` is correct (use `list_tenants` to verify)
3. Check `tagPrefix` doesn't filter everything out

**Common causes**:
1. Wrong tenant UUID → verify via Acronis UI
2. Too-aggressive `excludeNamePatterns` matching all resources
3. Resources not tagged → remove `tagPrefix` filter

**Recovery**: Edit integration config, re-sync.

## Scheduled Tasks

### Daily (03:00) — Automated
- **Database backup** via `scripts/daily-backup.sh`
- SHA256 checksum generated
- Retention: 14 days (configurable in `.env`)

### Weekly (Sunday 02:00) — Manual
- **Restore test**: `bash scripts/restore-from-backup.sh <latest> --verify`
- **Disk cleanup**: `pm2 flush` to clear PM2 logs
- **Log rotation check**: verify `logs/` size < 1GB

### Monthly (1st) — Manual
- **Security review**:
  - Check `audit_logs` for unusual activity
  - Review active sessions
  - Rotate API keys (AI providers, integrations)
- **Capacity planning**:
  - Check `webhook_outbox` table size
  - Check `audit_logs` table size (consider partitioning)
  - Check `integration_syncs` retention
- **DR drill**: tabletop exercise on a critical plan

### Quarterly — Manual
- **Password rotation** for admin accounts
- **TLS certificate renewal** (if HTTPS enabled)
- **Backup retention policy review**
- **Integration review**: any to add/remove?

## On-Call Procedures

### Severity 1 — Service down
- API not responding
- Web app not loading
- Database unreachable
- All integrations failing

**Response**:
1. Acknowledge via Telegram
2. Check PM2 status: `pm2 jlist`
3. Restart all processes: `pm2 restart all`
4. Verify health: `curl /api/health`
5. If still down, check server resources (RAM, disk, CPU)
6. Escalate to manager if > 15 min unresolved

### Severity 2 — Degraded
- Some integrations failing
- Slow API response (> 5s)
- Single user cannot login
- Backup failure

**Response**:
1. Acknowledge
2. Identify scope (which integration, which user)
3. Check integration logs / user audit
4. Pause failing integration if needed
5. Fix root cause (config, permissions, etc.)
6. Re-enable and verify

### Severity 3 — Minor
- Cosmetic UI issue
- Non-critical warning
- Documentation typo
- Feature request

**Response**:
1. Note in `~/hermes-workspace/incidents/`
2. Schedule fix in next iteration

## Useful SQL Queries

```sql
-- Active integrations with recent errors
SELECT i.name, i.type, i.last_error, i.last_error_at
FROM integrations i
WHERE i.status = 'error'
  AND i.last_error_at > NOW() - INTERVAL '7 days'
ORDER BY i.last_error_at DESC;

-- Webhook outbox health
SELECT
  event_type,
  status,
  COUNT(*) AS count,
  AVG(attempts) AS avg_attempts
FROM webhook_outbox
WHERE queued_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type, status
ORDER BY count DESC;

-- Plan activity
SELECT
  p.criticality_tier,
  COUNT(*) AS plan_count,
  COUNT(*) FILTER (WHERE p.updated_at > NOW() - INTERVAL '30 days') AS active_30d,
  COUNT(*) FILTER (WHERE p.updated_at < NOW() - INTERVAL '90 days') AS stale_90d
FROM drp_plans p
GROUP BY p.criticality_tier
ORDER BY p.criticality_tier;

-- BIA alignment with plans
SELECT
  b.criticality_tier,
  COUNT(*) AS bia_count,
  COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM drp_plans WHERE service_asset_id = b.id)) AS with_plan,
  COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM drp_plans WHERE service_asset_id = b.id)) AS without_plan
FROM bia_entries b
GROUP BY b.criticality_tier;
```

## Performance Baselines

| Metric | Normal | Warning | Critical |
|--------|--------|---------|----------|
| API response time (p95) | < 500ms | 500ms - 2s | > 2s |
| Web bundle load | < 2s | 2s - 5s | > 5s |
| DB query (p95) | < 100ms | 100ms - 1s | > 1s |
| Disk usage | < 60% | 60% - 80% | > 80% |
| Memory (RSS) | < 1GB | 1GB - 2GB | > 2GB |
| Webhook outbox pending | < 50 | 50 - 500 | > 500 |
| Integration sync time | < 30s | 30s - 5m | > 5m |

## Disaster Recovery (ResiliPlan's own DR)

**If the VM is lost**:
1. Provision new VM (Ubuntu 22.04, Node 20+, Docker)
2. Install dependencies: `apt install -y postgresql-client nginx`
3. Clone repo: `git clone https://github.com/erwnlf-dev/resiliplan.git`
4. Restore database: `bash scripts/restore-from-backup.sh <latest-daily>`
5. Copy `.env` from backup (encrypted secrets)
6. Install deps: `pnpm install`
7. Build: `pnpm build`
8. Start: `pm2 start ecosystem.config.js`
9. Restore Nginx config
10. Verify: `curl /api/health`

**RTO**: ~30 min (manual restore)
**RPO**: 24 hours (last nightly backup)

## Security Operations

### Audit Log Review
```sql
-- Failed login attempts (last 24h)
SELECT * FROM audit_logs
WHERE entity_type = 'auth' AND action = 'login_failed'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Settings changes
SELECT * FROM audit_logs
WHERE entity_type = 'settings'
ORDER BY created_at DESC LIMIT 20;

-- Integration lifecycle
SELECT * FROM audit_logs
WHERE entity_type = 'integration'
ORDER BY created_at DESC LIMIT 20;
```

### Secret Rotation
1. Generate new secret
2. Update in UI/API
3. Verify integration sync succeeds
4. Update `.env` for backup scripts
5. Remove old secret from target system
6. Document in audit log

### Incident Response
1. Isolate: pause affected integration
2. Investigate: review audit logs
3. Remediate: fix config, rotate secrets if needed
4. Document: write incident report
5. Review: schedule post-mortem

## References

- [docs/runbook.md](./runbook.md) — General runbook
- [docs/integrations.md](./integrations.md) — Integration catalog + setup
- [docs/architecture.md](./architecture.md) — System architecture
- [docs/dr-plan.md](./dr-plan.md) — DR plan template
- [docs/threat-model.md](./threat-model.md) — Security threat model
- [docs/gap-analysis.md](./gap-analysis.md) — Known limitations

## Support

- **Internal**: Erwin Alifiansyah (admin@resiliplan.local)
- **Repository**: https://github.com/erwnlf-dev/resiliplan/issues
- **Documentation**: https://github.com/erwnlf-dev/resiliplan/tree/master/docs
