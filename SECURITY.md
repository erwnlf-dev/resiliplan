# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| 0.x.x   | :x:                |

Kami akan provide security updates untuk versi terbaru (1.x.x). Versi lama tidak akan di-patch kecuali critical vulnerability.

## Reporting a Vulnerability

**Please do NOT report security vulnerabilities via public GitHub issues.**

If you discover a security vulnerability in ResiliPlan, please report it privately:

📧 **Email:** [email protected]
🔒 **Subject prefix:** `[SECURITY] ResiliPlan`

Atau gunakan [GitHub Security Advisories](https://github.com/datacomm-diangraha/resiliplan/security/advisories/new) untuk private reporting.

### What to include:

1. **Description** — apa vulnerability-nya, dampaknya
2. **Reproduction steps** — bagaimana cara reproduce
3. **Affected versions** — versi mana yang affected
4. **Environment** — deployment context (jika relevan)
5. **Proof of concept** — code, screenshot, video (jika ada)
6. **Suggested fix** — kalau ada (optional, appreciated)

### What to expect:

- **Acknowledgment** dalam 2-3 hari kerja
- **Initial assessment** dalam 7 hari kerja
- **Status updates** setiap 7-14 hari sampai fix released
- **Credit** — akan di-credit di security advisory (kecuali request anonymity)

### Disclosure timeline:

Kami follow [coordinated disclosure](https://en.wikipedia.org/wiki/Coordinated_vulnerability_disclosure):

1. Reporter submit vulnerability privately
2. Maintainer confirm + assess severity
3. Fix developed (timeline tergantung complexity)
4. Fix released di version terbaru
5. Setelah fix released, public disclosure via GitHub Security Advisory
6. **Standard timeline:** 90 hari dari report ke public disclosure

## Security Best Practices for Self-hosted Deployment

Karena ResiliPlan self-hosted, security juga tanggung jawab Anda sebagai deployer. Berikut minimum best practices:

### 1. Network Security

- **Run behind reverse proxy** (Nginx, Caddy) dengan TLS 1.3
- **Firewall** — close semua port kecuali 80/443 ke public
- **Private network** untuk backend services (PostgreSQL, Redis) — tidak exposed ke public
- **SSH key-only** auth, disable password auth
- **Fail2ban** untuk protect SSH dari brute force

### 2. Secrets Management

- **Never commit secrets** ke Git (.env di .gitignore)
- **Use strong random secret** untuk `API_KEY_ENCRYPTION_KEY` (32 bytes random)
- **Rotate API keys** periodically (quarterly recommended)
- **Use environment-specific secrets** (dev/staging/prod berbeda)

### 3. Database Security

- **Strong PostgreSQL password** (min 16 chars random)
- **Restrict network access** — PostgreSQL hanya listen di private network
- **Encryption at rest** — enable LUKS atau equivalent
- **Backup encryption** — encrypt pg_dump dengan gpg
- **Regular backup** — daily minimum, test restore monthly

### 4. Application Security

- **Keep updated** — patch regularly (Dependabot akan notify)
- **Review CI logs** — pastikan no secrets leaked
- **Audit log monitoring** — review periodically untuk suspicious activity
- **User access review** — periodically review who has access

### 5. AI Provider Security (BYO)

- **Read provider's data policy** — beberapa provider (OpenAI API default) mungkin log data
- **Consider privacy-sensitive deployments** — gunakan local LLM (Ollama) untuk data yang sangat sensitif
- **Monitor token usage** — detect unusual activity

### 6. Update Strategy

- **Subscribe to releases** — watch repo untuk security updates
- **Test updates di staging** sebelum production
- **Keep dependencies updated** — Dependabot akan create PRs otomatis

## Security Features (Built-in)

ResiliPlan include beberapa security features by default:

- ✅ **API key encryption** (AES-256-GCM at rest)
- ✅ **Audit log** untuk semua perubahan
- ✅ **RBAC** (Role-based Access Control)
- ✅ **Session management** via Lucia Auth
- ✅ **CSRF protection** (planned — see [roadmap](../PRD.md))
- ✅ **Rate limiting** (planned)
- ✅ **Security headers** (planned)
- ✅ **Dependency scanning** (Dependabot enabled)

## Known Security Considerations

### BYO AI = data flow to third party

When AI features digunakan, content DRP Anda akan dikirim ke AI provider (OpenAI, Anthropic, dll) yang Anda configure. Kami TIDAK control data policy provider tersebut.

**Mitigasi:**
- Review provider data policy sebelum enable
- Untuk data sangat sensitif, gunakan local LLM (Ollama) atau disable AI features
- Consider data classification — jangan kirim data classified ke external AI

### Self-hosted = self-managed security

Tidak seperti SaaS, kami TIDAK provide:
- Automatic security patching (Anda harus apply manual via git pull + redeploy)
- 24/7 security monitoring
- Incident response untuk YOUR deployment
- Compliance certification untuk YOUR deployment

**Mitigasi:**
- Subscribe ke release notifications
- Apply security patches promptly
- Run your own monitoring + alerting
- Consider your own compliance certification

## Vulnerability Disclosure Hall of Fame

_(akan di-update setelah ada security researcher yang contribute)_

## Contact

- 📧 [email protected]
- 🔒 [GitHub Security Advisories](https://github.com/datacomm-diangraha/resiliplan/security/advisories/new)

---

**Last updated:** 2026-06-20
