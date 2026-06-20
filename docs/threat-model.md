# ResiliPlan — Threat Model (STRIDE)

> **Methodology:** STRIDE (Microsoft threat modeling framework)
> **Scope:** Self-hosted ResiliPlan instance + AI provider integration
> **Last updated:** 2026-06-20
> **Review:** Quarterly, atau setiap ada perubahan arsitektur signifikan

---

## 1. STRIDE Overview

| Category | Threat | Property Violated |
|---|---|---|
| **S**poofing | Impersonating user/system | Authentication |
| **T**ampering | Modifying data/code | Integrity |
| **R**epudiation | Denying an action | Non-repudiation |
| **I**nformation Disclosure | Leaking data to unauthorized party | Confidentiality |
| **D**enial of Service | Making system unavailable | Availability |
| **E**levation of Privilege | Gaining higher access than authorized | Authorization |

---

## 2. System Architecture (for context)

### 2.1 Data Flows

```
[User Browser]
    ↕ HTTPS (TLS 1.3)
[Nginx reverse proxy]
    ↕ HTTP (internal network)
[Fastify API]
    ↕ SQL (internal network)
[PostgreSQL 16]
    ↕ TCP (internal network)
[Redis 7]
    ↕ HTTPS (BYO)
[External AI Provider: OpenAI / Anthropic / Custom]

[API Server]
    ↕ SSH (admin)
[System Admin]

[Backup cron]
    ↕ rsync/gpg
[Local FS] → [NAS]
```

### 2.2 Trust Boundaries

1. **Internet ↔ Nginx** (public network, TLS)
2. **Nginx ↔ Fastify** (internal network)
3. **Fastify ↔ PostgreSQL/Redis** (internal network)
4. **Fastify ↔ External AI** (public network, HTTPS)
5. **Admin ↔ Server** (SSH, public network)

### 2.3 Assets (what we protect)

| Asset | Sensitivity | Where stored |
|---|---|---|
| **User credentials** (passwords, sessions) | High | PostgreSQL (bcrypt hashed) |
| **User API keys** (BYO AI) | Critical | PostgreSQL (AES-256-GCM encrypted) |
| **DRP content** (sections, BIA, procedures) | High | PostgreSQL |
| **Audit log** | High | PostgreSQL (append-only) |
| **Server secrets** (DB password, encryption key) | Critical | Environment / `/etc/resiliplan/` |
| **Backup files** | Critical | Local FS + NAS (gpg encrypted) |
| **TLS certificates** | High | `/etc/letsencrypt/` |
| **Source code** | Medium | Git repository (public if GitHub open source) |

---

## 3. Threat Catalog

### 3.1 Spoofing (S)

| ID | Threat | Asset | Attack Vector | Likelihood | Impact | Risk | Mitigation |
|---|---|---|---|---|---|---|---|
| S-01 | User impersonation via stolen password | User credentials | Phishing, credential stuffing, password reuse | High | High | **Critical** | Strong password policy, MFA, rate limiting, breach check (HaveIBeenPwned) |
| S-02 | Session hijacking | User session | XSS, session fixation, MITM | Medium | High | **High** | HttpOnly + Secure + SameSite cookies, TLS only, session rotation, short TTL (30 min) |
| S-03 | API request spoofing | API integrity | CSRF, replay attack | Medium | High | **High** | CSRF token, rate limiting, request signing, request ID |
| S-04 | Server identity spoofing | TLS integrity | DNS spoofing, rogue cert | Low | Critical | **Medium** | TLS 1.3 only, HSTS header, Let's Encrypt auto-renew, CAA record |
| S-05 | Admin SSH impersonation | Server access | Stolen SSH key | Low | Critical | **Medium** | SSH key-only auth, fail2ban, key rotation, MFA on SSH (optional) |

### 3.2 Tampering (T)

| ID | Threat | Asset | Attack Vector | Likelihood | Impact | Risk | Mitigation |
|---|---|---|---|---|---|---|---|
| T-01 | SQL injection | Database | Unsanitized input | Low | Critical | **Medium** | Drizzle ORM (parameterized queries), Zod validation, input sanitization |
| T-02 | XSS via Markdown content | Other users' browsers | Malicious script in DRP content | Medium | Medium | **Medium** | DOMPurify sanitization, CSP header, no inline scripts |
| T-03 | Backup file tampering | Backups | Compromised server | Low | Critical | **Medium** | GPG encryption with key not on server, integrity check, off-site storage |
| T-04 | Audit log tampering | Audit trail | Compromised DB access | Low | High | **Medium** | Append-only constraint, separate backup of audit log, log export verification |
| T-05 | Environment variable tampering | Secrets | Compromised server | Low | Critical | **Low** | File permissions (chmod 600), separate user for app, key rotation |
| T-06 | Docker image tampering | Application code | Compromised CI, malicious base image | Low | Critical | **Low** | Image signing (cosign), trusted base images, SBOM, Dependabot |
| T-07 | API response tampering | API integrity | MITM | Low | High | **Low** | TLS only, HSTS, certificate pinning (optional for mobile) |

### 3.3 Repudiation (R)

| ID | Threat | Asset | Attack Vector | Likelihood | Impact | Risk | Mitigation |
|---|---|---|---|---|---|---|---|
| R-01 | User denies creating/modifying DRP | Audit trail | Lack of attribution | Low | High | **Low** | Audit log with user ID + IP + timestamp + action, immutable storage |
| R-02 | Admin denies taking action | Operational audit | Lack of admin action log | Low | High | **Low** | Admin actions logged separately, SSH session recording (optional) |
| R-03 | Approval action repudiation | Approval workflow | Lack of cryptographic signature | Low | High | **Low** | E-sign with timestamp + user ID + content hash, immutable approval record |

### 3.4 Information Disclosure (I)

| ID | Threat | Asset | Attack Vector | Likelihood | Impact | Risk | Mitigation |
|---|---|---|---|---|---|---|---|
| I-01 | Database breach via SQL injection | All user data | Exploited SQLi | Low | Critical | **Medium** | Drizzle ORM + Zod + WAF (Phase 4+) |
| I-02 | Backup file exposure | All user data | Misconfigured NAS, public S3 | Medium | Critical | **High** | GPG encryption, NAS permission (chmod 700), never in public cloud |
| I-03 | AI provider data leakage | DRP content sent to AI | Provider logs/breach | Medium | High | **High** | User opt-in per AI request, data classification warning, BYO key option (direct to provider) |
| I-04 | Log file exposure | Sensitive data in logs | Log file accessible, log shipping | Medium | High | **Medium** | Sanitize logs (no API keys, no passwords), log rotation, restricted file permissions |
| I-05 | API key exposure in error messages | API keys | Verbose error in production | Low | Critical | **Low** | Generic error messages in production, detailed only in dev |
| I-06 | Browser cache exposure | User credentials | Cached sensitive pages | Low | Medium | **Low** | Cache-Control: no-store for authenticated pages |
| I-07 | Network sniffing | All traffic | MITM, rogue AP | Low | High | **Low** | TLS 1.3 only, HSTS, internal network segmentation |
| I-08 | Insider threat (employee access) | All data | Privileged abuse | Low | Critical | **Medium** | Audit log review, least privilege, separation of duties, NDA |

### 3.5 Denial of Service (D)

| ID | Threat | Asset | Attack Vector | Likelihood | Impact | Risk | Mitigation |
|---|---|---|---|---|---|---|---|
| D-01 | HTTP flood (L7) | API availability | Botnet, script kiddies | High | Medium | **High** | Rate limiting (per-IP + per-user), Cloudflare (Phase 4+), fail2ban |
| D-02 | Slowloris | API availability | Slow HTTP requests | Medium | Medium | **Medium** | Fastify timeout config, Nginx timeout, connection limits |
| D-03 | Database connection exhaustion | Database | Many concurrent requests | Medium | High | **Medium** | DB connection pool (max 20), query timeout, statement timeout |
| D-04 | Disk space exhaustion (logs/exports) | Server stability | Log spam, large exports | Medium | High | **Medium** | Log rotation, disk monitoring + alert, export size limit, user quota |
| D-05 | AI provider rate limit | AI features | Excessive AI requests | Medium | Low | **Low** | Per-user rate limit, request queue, cost awareness widget, fallback to manual |
| D-06 | Backup job resource consumption | Server performance | Backup during peak hour | Low | Low | **Low** | Schedule backup at 02:00 (low traffic), nice/ionice, throttle |
| D-07 | Server hardware failure | All services | Disk, RAM, CPU failure | Low | Critical | **Medium** | RAID, monitoring, backup off-site, runbook for replacement |

### 3.6 Elevation of Privilege (E)

| ID | Threat | Asset | Attack Vector | Likelihood | Impact | Risk | Mitigation |
|---|---|---|---|---|---|---|---|
| E-01 | User escalates to admin via API bug | Authorization | IDOR, broken access control | Medium | Critical | **High** | RBAC enforcement in service layer, integration tests for authz, audit log review |
| E-02 | SQL injection leads to RCE | Server | PostgreSQL exploit + local vuln | Low | Critical | **Low** | Separate DB user (no superuser), parameterized queries, minimal DB grants |
| E-03 | Container escape | Server host | Docker vulnerability | Low | Critical | **Low** | Minimal container privileges, distroless images, regular base image updates |
| E-04 | Privilege escalation via dependency vuln | Server | npm package with backdoor | Low | Critical | **Medium** | Dependabot, npm audit, lockfile, package signature verification, minimal dependencies |
| E-05 | SSRF via AI provider URL | Internal services | User-controlled URL | Medium | High | **Medium** | URL allowlist (no internal IPs), timeout, response size limit, network segmentation |
| E-06 | Cookie theft via XSS | User session | Reflected/stored XSS | Low | High | **Low** | HttpOnly cookies, CSP, sanitization |

---

## 4. Risk Summary

### 4.1 By Risk Level

| Risk Level | Count | Top Threats |
|---|---|---|
| **Critical** | 3 | S-01 (stolen password), S-02, S-03, I-02, I-03 |
| **High** | 5 | D-01, E-01, I-03 |
| **Medium** | 14 | S-04, S-05, T-01, T-02, T-03, T-04, I-01, I-04, I-08, D-02, D-03, D-04, D-07, E-04, E-05 |
| **Low** | 8 | T-05, T-06, T-07, R-01, R-02, R-03, I-05, I-06, I-07, D-05, D-06, E-02, E-03, E-06 |

### 4.2 By Category

| Category | Critical | High | Medium | Low |
|---|---|---|---|---|
| Spoofing | 1 | 2 | 2 | 0 |
| Tampering | 0 | 0 | 4 | 3 |
| Repudiation | 0 | 0 | 0 | 3 |
| Info Disclosure | 0 | 2 | 4 | 4 |
| Denial of Service | 0 | 1 | 4 | 2 |
| Elevation of Privilege | 0 | 1 | 2 | 3 |

---

## 5. Mitigations by Implementation Phase

### 5.1 Phase 0a (Production Readiness — Current)

- ✅ Strong password policy + MFA admin (P1)
- ✅ CSRF protection + rate limiting
- ✅ Helmet (CSP, HSTS, X-Frame-Options)
- ✅ Dependabot for dependency scanning
- ✅ CodeQL for SAST
- ✅ Audit log (append-only)
- ✅ Drizzle ORM (SQL injection prevention)
- ✅ GPG encryption for backups
- ✅ TLS 1.3 only

### 5.2 Phase 0b (Foundation)

- Lucia Auth with secure session management
- Docker container with minimal privileges
- Network segmentation (internal only for DB/Redis)
- Log sanitization
- File permissions (chmod 600 for secrets)
- HTTPS only via Nginx

### 5.3 Phase 1+ (Future)

- WAF (Cloudflare or self-hosted ModSecurity)
- Container image signing (cosign)
- SBOM generation
- Database connection pooling
- Disk monitoring + alerts
- Pen test (external, annual)
- SOC 2 readiness (jika commercial)

---

## 6. Trust Assumptions

We ASSUME the following:

1. **Server admin is trusted** — has root access, can read all data, must be vetted
2. **Database admin is trusted** — can read all data, must be vetted
3. **PostgreSQL & Redis are secure** — no insider threat at DB level
4. **TLS certificate authority is trusted** — Let's Encrypt is not compromised
5. **Backup passphrase is secure** — stored in `/etc/resiliplan/`, chmod 600
6. **AI providers are honest** — won't maliciously exfiltrate data (but may log)
7. **Network is segmented** — internal network between services is trusted
8. **Operating system is patched** — apt upgrade regularly

If ANY assumption is violated, additional mitigations are needed.

---

## 7. Open Questions / Future Analysis

- [ ] **AI provider trust** — Should we add data classification warnings per AI request?
- [ ] **Insider threat detection** — Anomaly detection on admin actions (Phase 4+)
- [ ] **Penetration test** — Schedule external pen test post-public-launch
- [ ] **Supply chain security** — SLSA framework adoption (Level 2+ for production builds)
- [ ] **Encryption at rest** — Currently disk-level, consider PostgreSQL TDE (Phase 4+)
- [ ] **Zero-trust network** — Currently internal network trusted, evaluate zero-trust (Phase 5+)

---

## 8. References

- **STRIDE Methodology** — https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool
- **OWASP Top 10** — https://owasp.org/Top10
- **OWASP API Security** — https://owasp.org/API-Security
- **NIST SP 800-53** — Security & Privacy Controls
- **CIS Controls** — https://www.cisecurity.org/controls
- **SLSA Framework** — https://slsa.dev
