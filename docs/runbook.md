# ResiliPlan — Operational Runbook

> **Common incidents and recovery procedures** untuk ResiliPlan self-hosted instance.
> **Last updated:** 2026-06-20
> **Review:** Quarterly, atau setiap ada perubahan infra

---

## Cara Pakai Runbook Ini

1. **Detect** — identify symptom dari alert / user report
2. **Triage** — cek severity (P0/P1/P2)
3. **Respond** — follow procedure di section terkait
4. **Verify** — confirm resolution
5. **Document** — log incident, update this runbook jika ada gap

**Severity:**
- **P0 (Critical)** — Service down, data loss, security breach. Response: immediate, all-hands
- **P1 (High)** — Major feature broken, workaround difficult. Response: < 1 hour
- **P2 (Medium)** — Minor issue, workaround exists. Response: < 4 hours
- **P3 (Low)** — Cosmetic, nice-to-fix. Response: next business day

---

## 🚨 P0 Incidents (Service Down / Data Loss)

### INC-01: Server Completely Down

**Symptom:** HTTP tidak respond, SSH timeout, monitoring silent.

**Detection:** UptimeRobot alert, user report, monitoring silent > 5 min.

**Triage:**
```bash
# 1. Cek server dari remote (jangan SSH dulu, kalau ada network issue)
ping resiliplan.kantor.local

# 2. Cek apakah server up di cloud provider console
# (login ke dashboard provider, lihat instance status)

# 3. Cek apakah ada maintenance window scheduled
cat /var/log/resiliplan/maintenance.log  # if accessible via cloud console

# 4. Cek apakah security group / firewall changed
# (di cloud provider console)
```

**Response:**

```bash
# A. Jika hardware failure → provision new server
# Ikuti procedure 5.3 di docs/dr-plan.md (Complete Server Failure)

# B. Jika OS hung → reboot via cloud console
# - Hard reboot dari cloud provider
# - Wait 5 min untuk boot
# - Cek services: docker compose ps
# - Jika services tidak start → cek Docker logs

# C. Jika network issue → cek firewall + DNS
# - Verify security group mengizinkan 80/443 inbound
# - Verify DNS A record point ke server IP
# - Test dari external: curl -I https://resiliplan.kantor.local
```

**Verify:**
- `curl https://resiliplan.kantor.local/api/health` returns 200
- Login admin works
- Sample DRP loads correctly

**RTO target:** 1 hour. **RPO target:** 15 min (last backup).

---

### INC-02: Database Corruption / Data Loss

**Symptom:** DB queries error, data missing, integrity constraint violations.

**Detection:** Application error logs, user report, DB monitoring alert.

**Triage:**
```bash
# SSH ke server
ssh admin@resiliplan.kantor.local

# Cek DB status
docker exec resiliplan-postgres pg_isready -U resiliplan

# Cek recent errors
docker logs resiliplan-postgres --tail 100

# Cek disk space (low disk → corruption)
df -h /var/lib/postgresql
```

**Response:**

```bash
# Opsi A: Single record corruption → manual fix
docker exec -it resiliplan-postgres psql -U resiliplan -d resiliplan
# Manual UPDATE/DELETE untuk fix record

# Opsi B: Whole database corruption → full restore
# STOP API DULU (prevent writes)
cd /opt/resiliplan
docker compose stop api

# Ikuti procedure 5.2 di docs/dr-plan.md (Full Restore)

# Opsi C: WAL archiving available → point-in-time recovery
# (if enabled, lebih advanced — dokumentasi terpisah)
```

**Verify:**
- Row counts match expected (compare with last backup)
- Application can connect + query
- Audit log shows restore event
- Notify users: "Data restored from backup at [time], data after [last_backup_time] is lost"

**RTO target:** 45 min. **RPO target:** 15 min (depends on backup frequency).

---

### INC-03: Security Breach / API Key Leak

**Symptom:** Unauthorized access detected, API key in public repo/log, suspicious activity in audit log.

**Detection:** GitHub secret scanning alert, audit log anomaly, user report.

**Triage:**
```bash
# 1. Identify scope: apa yang bocor?
# - API key OpenAI? → revoke di OpenAI dashboard immediately
# - API key Anthropic? → revoke di Anthropic dashboard immediately
# - DB password? → rotate (procedure di bawah)
# - SSH key? → revoke + regenerate
# - User password? → force reset user

# 2. Cek audit log untuk unauthorized access
docker exec resiliplan-postgres psql -U resiliplan -d resiliplan -c "
  SELECT user_id, action, ip_address, created_at
  FROM audit_log
  WHERE created_at > NOW() - INTERVAL '7 days'
  ORDER BY created_at DESC
  LIMIT 100;
"

# 3. Identify entry point
# - SQL injection? → cek application logs
# - Stolen password? → cek failed login attempts
# - Stolen session? → cek active sessions
```

**Response:**

```bash
# 1. Revoke compromised credential IMMEDIATELY
# (di provider dashboard, regenerate)

# 2. Rotate secrets
# Generate new API key encryption key:
NEW_KEY=$(openssl rand -hex 32)
echo "NEW_KEY=$NEW_KEY" >> /etc/resiliplan/secrets.new
# Re-encrypt existing API keys (script needed):
/opt/resiliplan/scripts/rotate-encryption-key.sh $NEW_KEY

# 3. Force logout all users
docker exec resiliplan-postgres psql -U resiliadmin -d resiliplan -c "
  UPDATE sessions SET expires_at = NOW() WHERE expires_at > NOW();
"

# 4. Force password reset untuk affected users
docker exec resiliplan-postgres psql -U resiliadmin -d resiliplan -c "
  UPDATE users SET must_reset_password = true WHERE id IN (...);
"

# 5. Notify users
# Send Telegram: "Security incident detected. All users must reset password."

# 6. Document incident
# - Timeline (when detected, when responded, when resolved)
# - Root cause
# - Impact (data accessed, actions taken)
# - Remediation (what was done, what to prevent recurrence)
# - File under docs/incidents/YYYY-MM-DD-brief-description.md
```

**Verify:**
- New API key works in app
- Old API key no longer accepted
- All users reset password successfully
- Audit log shows revocation + reset events

**Post-incident:**
- File incident report within 48h
- Update threat model with new attack vector
- Implement preventive measures (e.g., if XSS → add CSP, if SQLi → add WAF)

---

### INC-04: Backup Failure

**Symptom:** Backup cron exit non-zero, backup file not created, Telegram alert "backup failed".

**Detection:** Daily Telegram alert (02:30 WIB) OR manual check.

**Triage:**
```bash
# Cek log
tail -50 /var/log/resiliplan/backup.log

# Cek disk space
df -h /var/lib/resiliplan/backups

# Cek Docker container
docker ps -a | grep postgres
docker logs resiliplan-postgres --tail 50
```

**Response:**

```bash
# Opsi A: Disk penuh → cleanup
# Hapus backup lama
find /var/lib/resiliplan/backups -name "*.sql.gz.gpg" -mtime +30 -delete
# Verify space
df -h /var/lib/resiliplan/backups

# Opsi B: Docker down → restart
docker compose up -d postgres
docker exec resiliplan-postgres pg_isready

# Opsi C: pg_dump error → manual run
docker exec resiliplan-postgres pg_dump -U resiliplan -Fc resiliplan | gzip > /tmp/manual-backup.sql.gz
# Check exit code: $?
# If error, cek Postgres logs

# Opsi D: GPG passphrase wrong → cek file
ls -la /etc/resiliplan/backup-passphrase
cat /etc/resiliplan/backup-passphrase  # verify

# Opsi E: NAS mount issue → mount ulang
mount /mnt/nas
# Check: ls /mnt/nas/resiliplan-backups/
```

**Verify:**
- Manual backup run sukses
- Verify backup integrity (gpg decrypt + head)
- Test rsync to NAS

**Follow-up:**
- Jika recurring → cek cron, network, NAS reliability
- Jika persistent failure → file incident

---

## ⚠️ P1 Incidents (Major Feature Broken)

### INC-05: AI Co-pilot Not Working

**Symptom:** User click "Generate" → error or timeout.

**Detection:** User report, error spike di Sentry.

**Triage:**
```bash
# 1. Cek apakah ini individual user atau semua user
# - Login sebagai admin, test AI di plan dummy
# - Cek audit log untuk AI errors

# 2. Cek AI provider status
# - OpenAI: https://status.openai.com
# - Anthropic: https://status.anthropic.com

# 3. Cek user's AI config
docker exec resiliplan-postgres psql -U resiliplan -d resiliplan -c "
  SELECT id, name, provider, base_url, default_model, enabled, last_error
  FROM ai_configs
  WHERE user_id = $USER_ID;
"
```

**Response:**

```bash
# Opsi A: Provider outage → user pakai provider lain atau input manual
# Tunggu provider recovery, atau user switch ke alternative

# Opsi B: API key invalid/expired
# User rotate API key di provider dashboard, update di app
# (Settings → AI Configurations → Edit → Test Connection)

# Opsi C: Base URL wrong (custom provider)
# User verify base URL, test connection

# Opsi D: Rate limit hit
# User wait atau upgrade plan di provider
# (log: "429 Too Many Requests" or "Rate limit reached")

# Opsi E: Network issue (server can't reach provider)
curl -I https://api.openai.com  # dari server
# If fail, cek firewall, DNS, network

# Opsi F: App bug
# Cek app logs:
docker logs resiliplan-api --tail 200
# Look for stack trace, error message
```

**Verify:**
- User can test connection successfully
- AI generate works end-to-end
- Token usage logged

---

### INC-06: User Can't Login

**Symptom:** User login attempts fail, "Invalid credentials" error.

**Detection:** User report.

**Triage:**
```bash
# 1. Cek apakah user exists
docker exec resiliplan-postgres psql -U resiliplan -d resiliplan -c "
  SELECT id, email, name, role, disabled, must_reset_password, created_at
  FROM users
  WHERE email = '[email protected]';
"

# 2. Cek recent failed login attempts
docker exec resiliplan-postgres psql -U resiliplan -d resiliplan -c "
  SELECT email, ip_address, success, created_at
  FROM login_attempts
  WHERE email = '[email protected]'
  ORDER BY created_at DESC
  LIMIT 20;
"

# 3. Cek rate limit
# If user > 5 failed attempts dalam 15 min → blocked

# 4. Cek user status
# - disabled = true → user must contact admin
# - must_reset_password = true → user must reset via email
```

**Response:**

```bash
# Opsi A: Forgot password
# Trigger password reset:
docker exec resiliplan-postgres psql -U resiliplan -d resiliplan -c "
  UPDATE users
  SET reset_token = '$(openssl rand -hex 32)',
      reset_token_expires_at = NOW() + INTERVAL '1 hour'
  WHERE email = '[email protected]';
"
# Send reset link ke user via email/Slack

# Opsi B: User disabled
# Admin enable di dashboard, atau SQL:
docker exec resiliplan-postgres psql -U resiliplan -d resiliplan -c "
  UPDATE users SET disabled = false WHERE email = '[email protected]';
"

# Opsi C: Account locked (too many failed attempts)
docker exec resiliplan-postgres psql -U resiliplan -d resiliplan -c "
  DELETE FROM login_attempts WHERE email = '[email protected]';
"

# Opsi D: Password wrong (genuine user error)
# User follow forgot password flow
```

**Verify:**
- User can login successfully
- Failed attempts cleared
- Audit log shows successful login

---

### INC-07: Export PDF Gagal

**Symptom:** User click "Export PDF" → error, blank PDF, atau timeout.

**Detection:** User report, error di Sentry.

**Triage:**
```bash
# 1. Cek Puppeteer
docker logs resiliplan-api --tail 100 | grep -i "puppeteer\|chromium\|pdf"

# 2. Cek memory (Puppeteer makan banyak memory)
docker stats resiliplan-api

# 3. Cek disk (export ditulis ke /var/lib/resiliplan/exports)
df -h /var/lib/resiliplan/exports

# 4. Cek template HTML
ls -la /opt/resiliplan/apps/api/templates/
```

**Response:**

```bash
# Opsi A: OOM (Out of Memory)
# Restart API:
docker compose restart api
# Long-term: increase memory limit di docker-compose

# Opsi B: Chromium missing
docker exec resiliplan-api which chromium
# If missing, install:
# Update Dockerfile, rebuild

# Opsi C: Disk penuh
# Cleanup old exports:
find /var/lib/resiliplan/exports -mtime +30 -delete
# Increase disk size

# Opsi D: Template bug
# Test manual render:
docker exec resiliplan-api node -e "
  const puppeteer = require('puppeteer');
  puppeteer.launch().then(async (browser) => {
    const page = await browser.newPage();
    await page.setContent('<h1>Test</h1>');
    await page.pdf({ path: '/tmp/test.pdf' });
    await browser.close();
    console.log('OK');
  });
"
```

**Verify:**
- User can export PDF
- File written to disk
- File opens correctly

---

## 🟡 P2 Incidents (Minor Issues)

### INC-08: Slow API Response

**Symptom:** API takes > 2 seconds, user reports slow loading.

**Detection:** Monitoring alert (P95 latency), user report.

**Triage:**
```bash
# 1. Cek API metrics
curl https://resiliplan.kantor.local/metrics | grep http_request_duration

# 2. Cek DB slow queries
docker exec resiliplan-postgres psql -U resiliplan -d resiliplan -c "
  SELECT pid, query, state, NOW() - query_start AS duration
  FROM pg_stat_activity
  WHERE state != 'idle'
    AND NOW() - query_start > INTERVAL '1 second'
  ORDER BY duration DESC;
"

# 3. Cek Redis
docker exec resiliplan-redis redis-cli ping
docker exec resiliplan-redis redis-cli info memory

# 4. Cek CPU/memory
docker stats
```

**Response:**

```bash
# Opsi A: Long-running query → kill
docker exec resiliplan-postgres psql -U resiliplan -d resiliplan -c "
  SELECT pg_cancel_backend($PID);
"

# Opsi B: DB missing index → add index
# (per query analysis)

# Opsi C: Redis down → restart
docker compose restart redis

# Opsi D: Resource exhaustion → scale or cleanup
# Check for memory leaks, restart API
docker compose restart api
```

**Verify:**
- P95 latency < 1.5s
- No long-running queries
- Resources back to normal

---

### INC-09: Disk Space Warning

**Symptom:** Monitoring alert disk > 80% full.

**Detection:** Monitoring alert.

**Triage:**
```bash
# Cek usage
df -h
du -sh /var/* | sort -h

# Cek Docker
docker system df
```

**Response:**

```bash
# Opsi A: Old logs → rotate
journalctl --vacuum-time=7d

# Opsi B: Old backups → cleanup (verify NAS has them)
find /var/lib/resiliplan/backups -mtime +7 -delete
find /var/lib/resiliplan/exports -mtime +30 -delete

# Opsi C: Docker images → cleanup
docker image prune -a

# Opsi D: Docker volumes → inspect
docker volume ls
docker system df -v
```

**Verify:**
- Disk usage < 70%
- Monitoring alert cleared

---

### INC-10: GitHub Actions Failing

**Symptom:** CI red, Dependabot PRs not auto-merged.

**Detection:** GitHub notification.

**Triage:**
```bash
# Via gh CLI:
gh run list --repo datacomm-diangraha/resiliplan --limit 5

# Or via GitHub web UI:
# https://github.com/datacomm-diangraha/resiliplan/actions
```

**Response:**

```bash
# Opsi A: Test failure → fix test, push
cd ~/work/resiliplan
# Fix code
git commit -m "fix: test failure"
git push

# Opsi B: Lint failure → fix lint
npm run lint:fix
git commit -m "chore: lint fix"
git push

# Opsi C: Dependabot PR conflict → rebase
gh pr checkout 123
git rebase main
git push --force-with-lease

# Opsi D: Build failure → cek logs
gh run view 456 --log
```

**Verify:**
- CI green
- Dependabot PRs auto-merge-able

---

## 📊 P3 Incidents (Cosmetic / Nice-to-Fix)

### INC-11: UI Bug / Visual Issue

**Symptom:** Misalignment, wrong color, broken layout.

**Triage:**
- Browser console error?
- Specific browser only?
- Specific page only?

**Response:**
- File bug di GitHub Issues
- Assign ke frontend
- Fix in next sprint

### INC-12: Slow Page Load (no API issue)

**Symptom:** Page takes > 3s, but API responds < 500ms.

**Triage:**
```bash
# Browser DevTools → Network tab
# Cek: bundle size, asset loading, image size
```

**Response:**
- Code splitting (route-level)
- Lazy load images
- Optimize bundle
- Lighthouse audit

---

## 🔍 Diagnostic Commands (Quick Reference)

```bash
# Service status
docker compose ps
docker stats

# Logs (real-time)
docker logs -f resiliplan-api
docker logs -f resiliplan-postgres
docker logs -f resiliplan-redis

# DB queries
docker exec resiliplan-postgres psql -U resiliplan -d resiliplan -c "\dt"  # list tables
docker exec resiliplan-postgres psql -U resiliplan -d resiliplan -c "
  SELECT pid, query, state, NOW() - query_start AS duration
  FROM pg_stat_activity
  WHERE state != 'idle'
  ORDER BY duration DESC;
"

# Health check
curl https://resiliplan.kantor.local/api/health

# Disk usage
df -h
du -sh /var/lib/resiliplan/* | sort -h

# Network
netstat -tlnp  # listening ports
ss -tlnp       # alternative

# Process
ps auxf | grep -E "node|postgres|redis|nginx"

# Recent errors
docker logs resiliplan-api --since 1h | grep -i error
```

---

## 📞 Escalation Matrix

| Severity | First Responder | Escalation (if not resolved) |
|---|---|---|
| **P0** | Server Admin (auto-paged) | DR Coordinator (5 min) → All-hands (15 min) |
| **P1** | Server Admin | DR Coordinator (30 min) |
| **P2** | Server Admin | Log + fix in business hours |
| **P3** | Frontend team | Next sprint |

**On-call rotation:** Currently N/A (small team). All P0 alerts go to DR Coordinator.

---

## 📚 Related Documents

- [`docs/dr-plan.md`](./dr-plan.md) — Full DR plan with RTO/RPO + restore procedures
- [`docs/threat-model.md`](./threat-model.md) — STRIDE analysis
- [`docs/incident-response.md`](./incident-response.md) — General incident response (coming soon)
- [`PRD.md`](../PRD.md) — Product requirements
