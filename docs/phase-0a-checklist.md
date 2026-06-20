# ResiliPlan — Phase 0a Definition of Done Checklist

> **Status:** ⏳ In progress
> **Target:** Maturity score 5.0 → 6.5/10
> **Last updated:** 2026-06-20

---

## Overview

Phase 0a (Production Readiness Prerequisites) harus 100% complete sebelum mulai Phase 0b (Foundation coding) dan sebelum push ke GitHub publik.

Total estimated effort: **~30 hours**

---

## 0a.1 — Open Source Boilerplate ✅ DONE (commit 69ef907)

- [x] LICENSE → MIT
- [x] CONTRIBUTING.md
- [x] CODE_OF_CONDUCT.md
- [x] SECURITY.md
- [x] Issue templates (bug, feature, question)
- [x] PR template
- [x] CHANGELOG.md
- [x] GitHub badges di README

**Status:** ✅ Complete
**Time spent:** ~2h

---

## 0a.2 — Security Baseline

### Required

- [ ] **Helmet** middleware: CSP, HSTS, X-Frame-Options, X-Content-Type-Options
  - File: `apps/api/src/server.ts`
  - Verify: `curl -I https://resiliplan.kantor.local/api/health` shows all headers
- [ ] **CSRF protection**: token middleware
  - Package: `@fastify/csrf-protection`
  - Verify: POST without token returns 403
- [ ] **Rate limiting**: `@fastify/rate-limit`
  - Per-IP: 100 req/min
  - Per-user (auth endpoints): 10 req/min
  - Verify: 11th request dalam 1 min returns 429
- [ ] **Password policy**: min 12 chars + complexity + breach check
  - Use `zxcvbn` for strength + HaveIBeenPwned API
  - Verify: "password123" rejected
- [ ] **Dependabot** enabled di GitHub repo
  - File: `.github/dependabot.yml` ✅
  - Verify: PRs auto-created within 24h of repo push
- [ ] **CodeQL** scanning di GitHub Actions
  - File: `.github/workflows/codeql.yml` ✅
  - Verify: CodeQL runs on first push

### Nice to have

- [ ] **CORS** whitelist
- [ ] **Session timeout**: 30 min idle
- [ ] **Concurrent session limit**: max 5 per user

**Status:** ⏳ Pending
**Time estimate:** ~6h

---

## 0a.3 — Reliability Baseline

### Required

- [ ] **RTO/RPO defined** → `docs/dr-plan.md` ✅
  - RTO: 1 hour
  - RPO: 15 minutes
- [ ] **Backup script**: daily pg_dump
  - File: `scripts/backup.sh` ✅
  - Verify: Manual run successful, file written, encrypted, copied to NAS
- [ ] **Backup monitoring**: alert on failure
  - File: `scripts/alert.sh` ✅
  - Verify: Telegram message on test failure
- [ ] **Monthly restore test**
  - File: `scripts/restore-test.sh` ✅
  - Cron: `0 4 1 * *` (1st of month)
  - Verify: Manual run successful, all tables verified
- [ ] **Deep health check** endpoint
  - Endpoint: `GET /api/health` (deep)
  - Verify: Returns 200 + JSON with DB/Redis status
  - Verify: Returns 503 if DB unreachable

### Nice to have

- [ ] **Backup retention policy**: 7 daily + 4 weekly + 12 monthly
- [ ] **Off-site backup verification**: monthly checksum
- [ ] **Disk space monitoring** + alert

**Status:** ⏳ Scripts done, health check pending (in Phase 0b)
**Time estimate:** ~6h

---

## 0a.4 — Data Integrity

### Required

- [ ] **Drizzle Kit migrations**: versioned, reversible
  - Package: `drizzle-kit`
  - File: `apps/api/drizzle.config.ts`
  - Verify: `drizzle-kit generate` creates migration
- [ ] **FK constraints** di schema
  - File: `apps/api/src/db/schema/*.ts` ✅ (data-model.md)
  - Verify: All relations have `.references()`
- [ ] **UU PDP compliance endpoints**:
  - `GET /api/me/export` — download all user data (JSON)
  - `DELETE /api/me/delete` — soft delete account (or hard delete after grace period)
  - Verify: Both endpoints work
- [ ] **Data retention policy**:
  - Audit log: 7 years
  - Plan content: indefinite
  - Drafts: 90 days auto-purge
  - AI usage log: 90 days then aggregate monthly

### Nice to have

- [ ] **Soft delete** pattern (with `deleted_at` column)
- [ ] **Anonymization script** for dev/staging
- [ ] **Encryption at rest** (LUKS or PostgreSQL TDE)

**Status:** ⏳ Pending
**Time estimate:** ~5h

---

## 0a.5 — API Standard

### Required

- [ ] **API versioning**: `/api/v1/...` prefix
  - File: `apps/api/src/server.ts`
  - Verify: `/api/v1/health` works, `/api/health` redirects
- [ ] **OpenAPI 3.1 spec**: auto-generated dari Zod
  - Package: `@asteasolutions/zod-to-openapi`
  - File: `apps/api/src/openapi/registry.ts`
  - Verify: `GET /api/openapi.json` returns valid spec
- [ ] **Swagger UI**: served di `/api/docs`
  - Package: `@scalar/fastify-api-reference` (or `@fastify/swagger` + `@fastify/swagger-ui`)
  - Verify: `GET /api/docs` shows interactive UI
- [ ] **Standard error response**: RFC 7807
  - Format: `{ type, title, status, detail, instance }`
  - Verify: All errors return this format
- [ ] **Request ID middleware**: `X-Request-ID`
  - Package: `fastify-request-id` or custom
  - Verify: Response includes X-Request-ID header

### Nice to have

- [ ] **Idempotency keys** for POST/PUT
- [ ] **Standard success response wrapper** (for consistency)
- [ ] **API client SDK** (auto-generated from OpenAPI)

**Status:** ⏳ Pending
**Time estimate:** ~6h

---

## 0a.6 — Threat Model & Documentation

### Required

- [x] **Threat model** (STRIDE) → `docs/threat-model.md` ✅
  - 30+ threats identified
  - Mitigations mapped per threat
  - Risk summary table
- [x] **Runbook** (common incidents) → `docs/runbook.md` ✅
  - 12 incidents documented
  - P0/P1/P2/P3 severity
  - Step-by-step response
- [x] **DR plan** (own infra) → `docs/dr-plan.md` ✅
  - RTO/RPO defined
  - Backup + restore procedures
  - Communication plan

### Nice to have

- [ ] **Onboarding guide** untuk new contributor
  - File: `docs/onboarding.md`
- [ ] **Admin guide** (sysadmin)
  - File: `docs/admin-guide.md`
- [ ] **Troubleshooting guide** (FAQ-style)
  - File: `docs/troubleshooting.md`
- [ ] **Postmortem template**
  - File: `docs/postmortem-template.md`

**Status:** ⏳ Core done, nice-to-haves pending
**Time estimate:** ~4h

---

## Summary

| Sub-phase | Status | Time spent | Time remaining |
|---|---|---|---|
| 0a.1 Open Source Boilerplate | ✅ Done | 2h | 0h |
| 0a.2 Security Baseline | ⏳ Pending | 0h | ~6h |
| 0a.3 Reliability Baseline | ⏳ Partial | 1h | ~5h |
| 0a.4 Data Integrity | ⏳ Pending | 0h | ~5h |
| 0a.5 API Standard | ⏳ Pending | 0h | ~6h |
| 0a.6 Threat Model & Docs | ⏳ Partial | 3h | ~4h |
| **Total** | | **6h done** | **~26h remaining** |

**Maturity score:**
- Current: 5.0/10
- After 0a complete: target 6.5/10

**Blocking for:**
- ❌ Public GitHub release (need all P0)
- ⚠️ Internal deployment (need 0a.2, 0a.3, 0a.4 minimum)

---

## Verification Commands

```bash
# Check status of each sub-phase
cat .github/dependabot.yml | head -5  # Should exist
cat .github/workflows/codeql.yml | head -5  # Should exist
test -f scripts/backup.sh && echo "✅ backup.sh exists"
test -f scripts/restore-test.sh && echo "✅ restore-test.sh exists"
test -f docs/dr-plan.md && echo "✅ dr-plan.md exists"
test -f docs/threat-model.md && echo "✅ threat-model.md exists"
test -f docs/runbook.md && echo "✅ runbook.md exists"
```

---

## Next Action

**Execute remaining 0a.2, 0a.3, 0a.4, 0a.5 tasks** (~22 hours of work).

Or, move to **Phase 0b (Foundation coding)** in parallel — 0a items can be done alongside 0b since they're orthogonal (security baseline + data integrity can be built as part of 0b scaffolding).

**Recommendation:** Move to Phase 0b (start scaffolding monorepo + Docker), integrate remaining 0a items as part of 0b implementation.

---

**Last updated:** 2026-06-20
