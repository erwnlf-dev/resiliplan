#!/bin/bash
#
# ResiliPlan daily database backup
#
# Run via cron:
#   0 2 * * * /opt/resiliplan/scripts/backup.sh
#
# What it does:
# 1. pg_dump from PostgreSQL container
# 2. Compress with gzip
# 3. Encrypt with GPG (AES-256)
# 4. Verify integrity
# 5. Copy to NAS
# 6. Cleanup old local backups (>7 days)
# 7. Send success/failure alert to Telegram
#
# Requirements:
# - gpg with passphrase file at /etc/resiliplan/backup-passphrase (chmod 600)
# - NAS mounted at /mnt/nas/resiliplan-backups
# - Docker container 'resiliplan-postgres' running
# - Telegram bot credentials (see /opt/resiliplan/scripts/alert.sh)
#

set -euo pipefail

# ===== Configuration =====
BACKUP_DIR="/var/lib/resiliplan/backups"
NAS_MOUNT="/mnt/nas/resiliplan-backups"
PASSPHRASE_FILE="/etc/resiliplan/backup-passphrase"
LOG_FILE="/var/log/resiliplan/backup.log"
CONTAINER_NAME="resiliplan-postgres"
DB_NAME="resiliplan"
DB_USER="resiliplan"
RETENTION_DAYS=7

# ===== Helpers =====
log() {
  echo "$(date -Iseconds) $1" | tee -a "$LOG_FILE"
}

error_exit() {
  local msg="$1"
  log "❌ ERROR: $msg"
  /opt/resiliplan/scripts/alert.sh "❌ ResiliPlan backup FAILED: $msg" 2>/dev/null || true
  exit 1
}

cleanup() {
  # Remove sensitive temp files
  if [ -f "${BACKUP_DIR}/${BACKUP_FILE}.tmp" ]; then
    shred -u "${BACKUP_DIR}/${BACKUP_FILE}.tmp" 2>/dev/null || rm -f "${BACKUP_DIR}/${BACKUP_FILE}.tmp"
  fi
}
trap cleanup EXIT

# ===== Pre-flight checks =====
log "Starting backup"

# Check passphrase file
if [ ! -f "$PASSPHRASE_FILE" ]; then
  error_exit "Passphrase file not found: $PASSPHRASE_FILE"
fi

# Check passphrase file permissions
PERMS=$(stat -c '%a' "$PASSPHRASE_FILE")
if [ "$PERMS" != "600" ]; then
  error_exit "Passphrase file has insecure permissions ($PERMS, expected 600). Run: chmod 600 $PASSPHRASE_FILE"
fi

# Check Docker container
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  error_exit "Container '$CONTAINER_NAME' is not running"
fi

# Check NAS mount
if ! mountpoint -q "$NAS_MOUNT" 2>/dev/null; then
  error_exit "NAS not mounted at $NAS_MOUNT"
fi

# Create backup dir if needed
mkdir -p "$BACKUP_DIR"
mkdir -p "$NAS_MOUNT/daily"

# ===== Generate backup filename =====
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="resiliplan_db_${TIMESTAMP}.sql.gz"
BACKUP_FILE_GPG="${BACKUP_FILE}.gpg"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"
BACKUP_PATH_GPG="${BACKUP_DIR}/${BACKUP_FILE_GPG}"
NAS_PATH="${NAS_MOUNT}/daily/${BACKUP_FILE_GPG}"

# ===== Step 1: pg_dump =====
log "Step 1/6: Running pg_dump"
if ! docker exec "$CONTAINER_NAME" \
    pg_dump -U "$DB_USER" -Fc --no-owner --no-acl "$DB_NAME" \
    > "${BACKUP_PATH}.tmp" 2>>"$LOG_FILE"; then
  error_exit "pg_dump failed (check logs above)"
fi

# Verify dump is not empty
DUMP_SIZE=$(stat -c '%s' "${BACKUP_PATH}.tmp" 2>/dev/null || echo "0")
if [ "$DUMP_SIZE" -lt 1024 ]; then
  error_exit "pg_dump output suspiciously small (${DUMP_SIZE} bytes)"
fi

# Compress
gzip "${BACKUP_PATH}.tmp"
mv "${BACKUP_PATH}.tmp.gz" "$BACKUP_PATH"
log "Step 1/6: pg_dump OK (${DUMP_SIZE} bytes → $(du -h "$BACKUP_PATH" | cut -f1))"

# ===== Step 2: Encrypt with GPG =====
log "Step 2/6: Encrypting with GPG (AES-256)"
if ! gpg --batch --yes --passphrase-file "$PASSPHRASE_FILE" \
    --cipher-algo AES256 --compress-algo none \
    --symmetric --output "$BACKUP_PATH_GPG" \
    "$BACKUP_PATH" 2>>"$LOG_FILE"; then
  error_exit "GPG encryption failed"
fi

# Verify encrypted file
if [ ! -f "$BACKUP_PATH_GPG" ]; then
  error_exit "Encrypted file not created"
fi
log "Step 2/6: Encryption OK ($(du -h "$BACKUP_PATH_GPG" | cut -f1))"

# ===== Step 3: Verify integrity =====
log "Step 3/6: Verifying integrity (decrypt test)"
if ! gpg --batch --yes --passphrase-file "$PASSPHRASE_FILE" \
    --decrypt "$BACKUP_PATH_GPG" 2>/dev/null | gunzip | head -c 16 > /dev/null; then
  error_exit "Backup integrity check FAILED (cannot decrypt)"
fi
log "Step 3/6: Integrity OK"

# ===== Step 4: Copy to NAS =====
log "Step 4/6: Copying to NAS"
if ! rsync -avz "$BACKUP_PATH_GPG" "$NAS_PATH" 2>>"$LOG_FILE"; then
  error_exit "rsync to NAS failed"
fi

# Verify NAS file
if [ ! -f "$NAS_PATH" ]; then
  error_exit "Backup not found on NAS after rsync"
fi
NAS_SIZE=$(stat -c '%s' "$NAS_PATH")
LOCAL_SIZE=$(stat -c '%s' "$BACKUP_PATH_GPG")
if [ "$NAS_SIZE" != "$LOCAL_SIZE" ]; then
  error_exit "NAS file size mismatch (local=${LOCAL_SIZE}, nas=${NAS_SIZE})"
fi
log "Step 4/6: NAS copy OK (size matches)"

# ===== Step 5: Cleanup old local backups =====
log "Step 5/6: Cleaning up local backups older than ${RETENTION_DAYS} days"
DELETED_COUNT=$(find "$BACKUP_DIR" -name "resiliplan_db_*.sql.gz.gpg" -mtime +${RETENTION_DAYS} -print -delete | wc -l)
log "Step 5/6: Deleted ${DELETED_COUNT} old local backups"

# ===== Step 6: Success =====
FINAL_SIZE=$(du -h "$BACKUP_PATH_GPG" | cut -f1)
log "✅ Step 6/6: Backup complete (${FINAL_SIZE})"
log "   Local: $BACKUP_PATH_GPG"
log "   NAS:   $NAS_PATH"

# Send success alert (optional, can be noisy - comment out if not needed)
/opt/resiliplan/scripts/alert.sh "✅ ResiliPlan daily backup OK (${FINAL_SIZE})" 2>/dev/null || true

# Optional: cleanup plaintext file (already deleted, but just in case)
rm -f "$BACKUP_PATH"

exit 0
