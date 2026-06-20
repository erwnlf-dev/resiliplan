# ResiliPlan — Operational Scripts

> Scripts untuk operational tasks (backup, monitoring, restore test).

## Setup

```bash
# Copy to /opt/resiliplan/scripts/ on server
sudo cp scripts/*.sh /opt/resiliplan/scripts/
sudo chmod +x /opt/resiliplan/scripts/*.sh
sudo chown root:root /opt/resiliplan/scripts/*.sh

# Create secrets directory (chmod 700, owner root)
sudo mkdir -p /etc/resiliplan
sudo chmod 700 /etc/resiliplan

# Create backup passphrase file (32+ random chars)
sudo openssl rand -base64 32 | sudo tee /etc/resiliplan/backup-passphrase > /dev/null
sudo chmod 600 /etc/resiliplan/backup-passphrase
sudo chown root:root /etc/resiliplan/backup-passphrase

# Create Telegram secrets file
sudo tee /etc/resiliplan/telegram.env > /dev/null <<EOF
# Get from @BotFather
TELEGRAM_BOT_TOKEN=***# Get from @userinfobot (your chat ID) or group ID
TELEGRAM_CHAT_ID=-1001234567890
EOF
sudo chmod 600 /etc/resiliplan/telegram.env
sudo chown root:root /etc/resiliplan/telegram.env

# Mount NAS
sudo mkdir -p /mnt/nas/resiliplan-backups/daily
# Configure /etc/fstab for auto-mount:
# //nas-server/share  /mnt/nas/resiliplan-backups  cifs  credentials=/etc/samba/nas-credentials,uid=root,gid=root  0  0
```

## Scripts

### `backup.sh` — Daily Database Backup

**Run:** `0 2 * * * /opt/resiliplan/scripts/backup.sh` (cron)

**What it does:**
1. `pg_dump` from PostgreSQL container
2. Compress with gzip
3. Encrypt with GPG (AES-256, passphrase from `/etc/resiliplan/backup-passphrase`)
4. Verify integrity (decrypt + check)
5. Copy to NAS
6. Cleanup local backups > 7 days
7. Send success/failure alert to Telegram

**Logs:** `/var/log/resiliplan/backup.log`

**Verify:**
```bash
# Test manually
sudo /opt/resiliplan/scripts/backup.sh

# Check log
tail -20 /var/log/resiliplan/backup.log

# Verify backup on NAS
ls -lh /mnt/nas/resiliplan-backups/daily/
```

### `restore-test.sh` — Monthly Restore Test

**Run:** `0 4 1 * * /opt/resiliplan/scripts/restore-test.sh` (cron, 1st of month)

**What it does:**
1. Find latest backup
2. Decrypt + decompress
3. Restore to test DB (`resiliplan_restore_test`)
4. Verify row counts (8 critical tables)
5. Cleanup test DB
6. Alert on success/failure

**Logs:** `/var/log/resiliplan/restore-test.log`

**Verify:**
```bash
# Test manually
sudo /opt/resiliplan/scripts/restore-test.sh

# Check log
tail -20 /var/log/resiliplan/restore-test.log
```

### `alert.sh` — Telegram Alert Sender

**Usage:**
```bash
/opt/resiliplan/scripts/alert.sh "ResiliPlan backup failed: ..."
```

**Format:** Sends to Telegram via Bot API. Reads credentials from `/etc/resiliplan/telegram.env`.

**Note:** Fails silently if credentials missing (doesn't break calling script).

## Manual Operations

### Full Restore (Disaster Recovery)

See `docs/dr-plan.md` section 5.2 for full procedure.

```bash
# 1. Stop API
cd /opt/resiliplan
docker compose stop api

# 2. Decrypt + restore (see dr-plan.md for details)
# 3. Verify
docker exec resiliplan-postgres psql -U resiliplan -d resiliplan -c "SELECT COUNT(*) FROM plans;"
# 4. Restart
docker compose start api
```

### Rotate Encryption Key

```bash
# 1. Generate new key
NEW_KEY=$(openssl rand -hex 32)

# 2. Update env
sudo sed -i "s/^API_KEY_ENCRYPTION_KEY=.*/API_KEY_ENCRYPTION_KEY=${NEW_KEY}/" /opt/resiliplan/.env

# 3. Re-encrypt all AI configs in DB
# (requires custom script - to be developed)
```

## Cron Schedule

```bash
# /etc/cron.d/resiliplan
# Daily backup at 02:00 WIB
0 2 * * * root /opt/resiliplan/scripts/backup.sh >> /var/log/resiliplan/backup.log 2>&1

# Monthly restore test at 04:00 WIB (1st of month)
0 4 1 * * root /opt/resiliplan/scripts/restore-test.sh >> /var/log/resiliplan/restore-test.log 2>&1
```

## Troubleshooting

### Backup fails with "permission denied"

```bash
# Check file permissions
ls -la /etc/resiliplan/
# Should be: drwx------ root root  /etc/resiliplan
#             -rw------- root root  /etc/resiliplan/backup-passphrase
```

### GPG decryption fails

```bash
# Verify passphrase is correct
sudo gpg --batch --passphrase-file /etc/resiliplan/backup-passphrase \
    --decrypt /path/to/backup.sql.gz.gpg 2>&1 | head
```

### NAS mount lost

```bash
# Remount
sudo mount -a
# Or check fstab
cat /etc/fstab | grep resiliplan
```

### Container not found

```bash
# Check container name
docker ps --format '{{.Names}}'
# Update CONTAINER_NAME in backup.sh if different
```

## Related Documents

- `docs/dr-plan.md` — Disaster recovery plan
- `docs/runbook.md` — Common incident response
- `docs/threat-model.md` — Security analysis
