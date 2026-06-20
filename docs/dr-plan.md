# ResiliPlan — Disaster Recovery Plan (Our Own Infrastructure)

> **Practice what we preach.** ResiliPlan adalah tool untuk DR planning — kita sendiri harus punya DR plan yang tested.
> **Author:** Erwin Alifiansyah · IT Service Resilience · PT Datacomm Diangraha
> **Last updated:** 2026-06-20
> **Next review:** Quarterly (or setiap ada perubahan infra signifikan)

---

## 1. Service Overview

**ResiliPlan** adalah internal tool untuk DRP/BCP management dengan AI co-pilot.

| Aspect | Detail |
|---|---|
| **Service name** | ResiliPlan |
| **Owner** | IT Service Resilience (PT Datacomm Diangraha) |
| **Deployment** | Self-hosted di public cloud server kantor (single host) |
| **Criticality tier** | Tier 2 (Business operations — high impact if down) |
| **User base** | Internal PT Datacomm Diangraha (~20 user Phase 0-1) |
| **Data sensitivity** | Confidential (DRP content, BIA, recovery strategy) |
| **Compliance** | ISO 22301, UU PDP (Indonesian data protection) |

---

## 2. Recovery Targets

| Metric | Target | Notes |
|---|---|---|
| **RTO (Recovery Time Objective)** | **1 hour** | Max acceptable downtime dari incident ke full restore |
| **RPO (Recovery Point Objective)** | **15 minutes** | Max acceptable data loss (dari last backup) |
| **MTTR (Mean Time To Restore)** | < 30 min (target) | Excluding major incidents |
| **MTBF (Mean Time Between Failures)** | > 90 days | Track via incident log |
| **Availability SLA** | 99% (~7.2h downtime/bulan) | Excluding planned maintenance |

**Justification:**
- RTO 1h: Tool tidak customer-facing, but downtime blocks DRP workflow. User bisa still use templates offline (read-only) untuk reference.
- RPO 15min: Acceptable karena backup daily + manual exports. Real-time replication overkill untuk internal tool.
- 99% availability: Standard untuk internal business tool (vs 99.9% untuk customer-facing SaaS).

---

## 3. Architecture (Quick Reference)

```
[Public Internet]
    ↓ HTTPS (443)
[Nginx reverse proxy + TLS] (port 443)
    ↓ HTTP (internal)
[Fastify API container] (port 3001)
    ↓
[PostgreSQL 16] (port 5432, internal only)
[Redis 7] (port 6379, internal only)
[Local FS] (/var/lib/resiliplan/exports, /var/lib/resiliplan/backups)
    ↓ HTTPS
[External AI providers] (BYO key, user-configured)
```

**Single point of failure (SPOF):** Server host itself. Mitigation: backup ke NAS (off-host) + monthly restore test.

**Future SPOF mitigation (Phase 4+):** Standby server + replication.

---

## 4. Backup Strategy

### 4.1 Backup Types

| Type | Frequency | Retention | Storage | Encryption |
|---|---|---|---|---|
| **Full database backup** | Daily (02:00 WIB) | 7 daily + 4 weekly + 12 monthly | `/var/lib/resiliplan/backups/` (local) + NAS | gpg AES-256 |
| **Configuration backup** | Weekly (Sunday 03:00 WIB) | 12 weekly | Same as above | gpg AES-256 |
| **Manual export (on-demand)** | User-triggered | Indefinite (per user request) | `/var/lib/resiliplan/exports/` | Optional (per user) |

### 4.2 Backup Procedure

**Daily full backup script** (`scripts/backup.sh`):

```bash
#!/bin/bash
# ResiliPlan daily backup
# Run via cron: 0 2 * * * /opt/resiliplan/scripts/backup.sh

set -euo pipefail

BACKUP_DIR="/var/lib/resiliplan/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="resiliplan_db_${DATE}.sql.gz"
NAS_MOUNT="/mnt/nas/resiliplan-backups"

# Create local backup
docker exec resiliplan-postgres pg_dump -U resiliplan -Fc resiliplan | gzip > "${BACKUP_DIR}/${BACKUP_FILE}"

# Encrypt with gpg
gpg --batch --yes --passphrase-file /etc/resiliplan/backup-passphrase \
    -c "${BACKUP_DIR}/${BACKUP_FILE}"

# Verify integrity
gpg --batch --yes --passphrase-file /etc/resiliplan/backup-passphrase \
    -d "${BACKUP_DIR}/${BACKUP_FILE}.gpg" | gunzip | head -c 16 > /dev/null || {
    echo "BACKUP VERIFICATION FAILED: ${BACKUP_FILE}.gpg" | tee -a /var/log/resiliplan/backup.log
    # Send alert (Telegram)
    /opt/resiliplan/scripts/alert.sh "❌ ResiliPlan backup verification FAILED: ${BACKUP_FILE}"
    exit 1
}

# Copy to NAS
rsync -avz "${BACKUP_DIR}/${BACKUP_FILE}.gpg" "${NAS_MOUNT}/daily/"

# Cleanup old local backups (keep 7 days)
find "${BACKUP_DIR}" -name "resiliplan_db_*.sql.gz.gpg" -mtime +7 -delete

# Log success
echo "$(date -Iseconds) ✅ Backup OK: ${BACKUP_FILE}.gpg ($(du -h ${BACKUP_DIR}/${BACKUP_FILE}.gpg | cut -f1))" \
    >> /var/log/resiliplan/backup.log
```

### 4.3 Backup Monitoring

- **Cron job exit code** monitored via health check endpoint
- **Telegram alert** on backup failure (within 5 min of cron run)
- **Weekly report** (Monday 09:00 WIB) — list of last 7 backups with size + age
- **Monthly audit** — verify oldest backup still readable

---

## 5. Restore Procedure

### 5.1 Restore Scenarios

| Scenario | Severity | Procedure | RTO |
|---|---|---|---|
| **Single record corruption** | Low | Restore from pg_dump + manual replay | 30 min |
| **Whole database corruption** | High | Full restore from latest backup | 45 min |
| **Complete server failure** | Critical | Provision new server + restore from NAS | 1-2 hours |
| **Accidental data deletion** | Medium | Point-in-time restore (if WAL archiving enabled) | 30-60 min |

### 5.2 Full Restore Procedure (most common)

**Step-by-step** (target: 45 min):

```bash
# 1. Stop API (prevent writes during restore)
cd /opt/resiliplan
docker compose stop api

# 2. Identify backup to restore
ls -lh /var/lib/resiliplan/backups/ | tail -10
# or
ls -lh /mnt/nas/resiliplan-backups/daily/ | tail -10

# 3. Decrypt + decompress
BACKUP_FILE="resiliplan_db_20260620_020000.sql.gz.gpg"
gpg --batch --yes --passphrase-file /etc/resiliplan/backup-passphrase \
    -d "/mnt/nas/resiliplan-backups/daily/${BACKUP_FILE}" | gunzip > /tmp/restore.sql

# 4. Verify integrity (count records, check structure)
head -c 100 /tmp/restore.sql  # Should start with valid pg_dump header
grep -c "CREATE TABLE" /tmp/restore.sql  # Should be > 0

# 5. Drop existing database (CAUTION!)
docker exec resiliplan-postgres psql -U resiliplan -c "DROP DATABASE resiliplan;"
docker exec resiliplan-postgres psql -U resiliplan -c "CREATE DATABASE resiliplan;"

# 6. Restore
cat /tmp/restore.sql | docker exec -i resiliplan-postgres psql -U resiliplan -d resiliplan

# 7. Verify row counts
docker exec resiliplan-postgres psql -U resiliplan -d resiliplan -c "
  SELECT 'plans' AS table_name, COUNT(*) AS row_count FROM plans
  UNION ALL
  SELECT 'sections', COUNT(*) FROM sections
  UNION ALL
  SELECT 'users', COUNT(*) FROM users
  UNION ALL
  SELECT 'audit_log', COUNT(*) FROM audit_log;
"

# 8. Restart API
docker compose start api

# 9. Smoke test
curl https://resiliplan.kantor.local/api/health
# Should return {"status": "ok", "db": "connected", ...}

# 10. Cleanup
rm -f /tmp/restore.sql

# 11. Log incident
echo "$(date -Iseconds) ✅ Restored from ${BACKUP_FILE}" >> /var/log/resiliplan/restore.log
```

### 5.3 Complete Server Failure Procedure (worst case)

**Step-by-step** (target: 1-2 hours):

```bash
# Phase 1: Provision new server (15-30 min, parallel to next steps)
# - Spin up new VPS (same size/region as original)
# - Install Docker, Docker Compose, certbot, fail2ban
# - Restore /opt/resiliplan directory from git/GitHub
# - Restore /etc/resiliplan/ (TLS cert, secrets) from secure backup

# Phase 2: Restore database from NAS (20-30 min)
# - Mount NAS
# - Decrypt + restore latest backup (procedure 5.2 above)

# Phase 3: Restore configuration (5-10 min)
# - Restore .env files
# - Restore Nginx config
# - Restore crontab

# Phase 4: Start services (5 min)
cd /opt/resiliplan
docker compose up -d
docker compose ps  # Verify all services running

# Phase 5: Update DNS (5 min, propagation-dependent)
# Update A record at registrar to point to new server IP

# Phase 6: Smoke test (10 min)
curl https://resiliplan.kantor.local/api/health
# Login as admin
# Verify a known DRP loads correctly
# Verify AI provider connection (if user has BYO)

# Phase 7: Notify users
# Send Telegram broadcast: "ResiliPlan restored, all data verified"

# Phase 8: Post-incident review (within 48h)
# - What went wrong
# - How long was actual downtime
# - What can be improved
# - Update this doc with lessons learned
```

---

## 6. Testing & Validation

### 6.1 Backup Test (Monthly)

**Automated test** (`scripts/restore-test.sh`):

```bash
#!/bin/bash
# Monthly restore test
# Run via cron: 0 4 1 * * /opt/resiliplan/scripts/restore-test.sh

set -euo pipefail

TEST_DB="resiliplan_restore_test"
LATEST_BACKUP=$(ls -t /var/lib/resiliplan/backups/resiliplan_db_*.sql.gz.gpg | head -1)
LOG="/var/log/resiliplan/restore-test.log"

echo "$(date -Iseconds) Starting restore test from ${LATEST_BACKUP}" >> "${LOG}"

# 1. Decrypt + restore to test database
gpg --batch --yes --passphrase-file /etc/resiliplan/backup-passphrase \
    -d "${LATEST_BACKUP}" | gunzip > /tmp/restore-test.sql

docker exec resiliplan-postgres psql -U resiliplan -c "DROP DATABASE IF EXISTS ${TEST_DB};" 2>>"${LOG}"
docker exec resiliplan-postgres psql -U resiliplan -c "CREATE DATABASE ${TEST_DB};" 2>>"${LOG}"

cat /tmp/restore-test.sql | docker exec -i resiliplan-postgres psql -U resiliplan -d "${TEST_DB}" 2>>"${LOG}"

# 2. Verify row counts (should match production roughly)
PROD_COUNT=$(docker exec resiliplan-postgres psql -U resiliplan -d resiliplan -tAc "SELECT COUNT(*) FROM plans;")
TEST_COUNT=$(docker exec resiliplan-postgres psql -U resiliplan -d "${TEST_DB}" -tAc "SELECT COUNT(*) FROM plans;")

if [ "${TEST_COUNT}" -lt "${PROD_COUNT}" ]; then
    echo "❌ FAIL: Test DB has fewer rows than production (test=${TEST_COUNT}, prod=${PROD_COUNT})" >> "${LOG}"
    /opt/resiliplan/scripts/alert.sh "❌ ResiliPlan restore test FAILED — test DB has ${TEST_COUNT} rows vs prod ${PROD_COUNT}"
    exit 1
fi

# 3. Cleanup
docker exec resiliplan-postgres psql -U resiliplan -c "DROP DATABASE ${TEST_DB};" 2>>"${LOG}"
rm -f /tmp/restore-test.sql

echo "$(date -Iseconds) ✅ Restore test PASSED (${TEST_COUNT} plans)" >> "${LOG}"
/opt/resiliplan/scripts/alert.sh "✅ ResiliPlan monthly restore test PASSED"
```

**Schedule:** First of each month, 04:00 WIB

### 6.2 Full DR Drill (Quarterly)

**Manual exercise** — simulate complete server failure, time the recovery:

- [ ] Pick random Friday afternoon (when team is online)
- [ ] Announce "DR drill starting" (no actual user impact)
- [ ] Run procedure 5.3 (complete server failure) on staging clone
- [ ] Time each step
- [ ] Document issues encountered
- [ ] Update this doc with improvements
- [ ] Post to team channel: "DR drill complete, RTO achieved: X minutes"

---

## 7. Roles & Responsibilities

| Role | Person | Responsibility |
|---|---|---|
| **DR Coordinator** | Erwin Alifiansyah | Owns this DR plan, runs quarterly drills, escalates issues |
| **Server Admin** | (assignee) | Server provisioning, restore execution, monitoring |
| **Database Admin** | (assignee) | Database-specific recovery, WAL archiving, replication |
| **Security Lead** | (assignee) | Encryption keys, secret rotation, audit log review |
| **User Lead** | (assignee) | User communication during incident, status updates |

**Escalation:**
- 0-15 min: Server Admin (auto-alert from monitoring)
- 15-30 min: DR Coordinator (if not resolved)
- 30-60 min: Server Admin + DBA (if DB-related)
- 60+ min: All-hands + management notification

---

## 8. Communication Plan

### 8.1 During Incident

| Time | Audience | Channel | Message |
|---|---|---|---|
| **T+0** (incident detected) | DR Coordinator | Auto-alert (Telegram) | "ResiliPlan incident detected: [brief description]" |
| **T+5 min** | Internal users | Telegram group | "ResiliPlan is currently down. Investigating. ETA: 15 min." |
| **T+15 min** | Internal users | Telegram group | "Update: [progress]. RTO target: 60 min." |
| **T+30 min** | Internal users | Telegram group | "Update: [progress]. RTO target: still achievable / slipped to X." |
| **T+resolved** | Internal users | Telegram group | "✅ ResiliPlan restored. RTO achieved: X min. RPO: Y min. Postmortem to follow." |
| **T+48h** | Internal users | Email + Telegram | Postmortem document (blameless) |

### 8.2 After Incident (Postmortem)

Within 48 hours, document:
1. **Timeline** — what happened, when, who responded
2. **Root cause** — why it happened (technical + process)
3. **Impact** — downtime, data loss, user impact
4. **What went well** — things that worked
5. **What could be improved** — gaps identified
6. **Action items** — concrete steps to prevent recurrence
7. **Lessons learned** — for future DR plan updates

---

## 9. Maintenance Windows

**Scheduled maintenance:** Sunday 02:00-04:00 WIB (low usage time)

**Notification:** 7 days advance notice (for major maintenance), 24 hours (for minor)

**Allowed during maintenance window:**
- Software updates
- Database migrations
- Infrastructure changes
- Backup system maintenance

**NOT allowed during maintenance window:**
- Anything that requires extended downtime (>2 hours)

---

## 10. Plan Maintenance

**This document reviewed:**
- ✅ At least quarterly (next: 2026-09-20)
- ✅ After any major incident
- ✅ After any infrastructure change
- ✅ After any compliance requirement change

**Change log:**
- 2026-06-20: Initial version (created during planning phase)

---

## 11. Related Documents

- [`docs/runbook.md`](./runbook.md) — Common incident response procedures
- [`docs/threat-model.md`](./threat-model.md) — Security threat analysis (STRIDE)
- [`PRD.md`](../PRD.md) — Product requirements and roadmap
- [`docs/gap-analysis.md`](./gap-analysis.md) — Production readiness assessment
- [`SECURITY.md`](../SECURITY.md) — Vulnerability disclosure + self-hosted best practices
