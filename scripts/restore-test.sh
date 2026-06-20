#!/bin/bash
#
# ResiliPlan monthly restore test
#
# Run via cron (first of each month, 04:00 WIB):
#   0 4 1 * * /opt/resiliplan/scripts/restore-test.sh
#
# What it does:
# 1. Find latest backup file
# 2. Decrypt + decompress
# 3. Restore to a TEST database (resiliplan_restore_test)
# 4. Verify row counts (should match production roughly)
# 5. Cleanup test database
# 6. Alert on success or failure
#

set -euo pipefail

# ===== Configuration =====
BACKUP_DIR="/var/lib/resiliplan/backups"
PASSPHRASE_FILE="/etc/resiliplan/backup-passphrase"
LOG_FILE="/var/log/resiliplan/restore-test.log"
CONTAINER_NAME="resiliplan-postgres"
TEST_DB="resiliplan_restore_test"

# ===== Helpers =====
log() {
  echo "$(date -Iseconds) $1" | tee -a "$LOG_FILE"
}

# ===== Pre-flight =====
log "Starting monthly restore test"

# Find latest backup
LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/resiliplan_db_*.sql.gz.gpg 2>/dev/null | head -1)
if [ -z "$LATEST_BACKUP" ]; then
  log "❌ FAILED: No backup files found in $BACKUP_DIR"
  /opt/resiliplan/scripts/alert.sh "❌ ResiliPlan restore test FAILED: no backup files found" 2>/dev/null || true
  exit 1
fi

log "Using backup: $LATEST_BACKUP"

# Check passphrase file
if [ ! -f "$PASSPHRASE_FILE" ]; then
  log "❌ FAILED: Passphrase file not found"
  exit 1
fi

# Check container
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  log "❌ FAILED: Container '$CONTAINER_NAME' not running"
  /opt/resiliplan/scripts/alert.sh "❌ ResiliPlan restore test FAILED: container not running" 2>/dev/null || true
  exit 1
fi

# ===== Step 1: Decrypt + decompress =====
log "Step 1/4: Decrypting backup"
TMP_FILE="/tmp/restore-test-$$.sql.gz"
if ! gpg --batch --yes --passphrase-file "$PASSPHRASE_FILE" \
    --decrypt "$LATEST_BACKUP" 2>"$LOG_FILE" > "$TMP_FILE"; then
  log "❌ FAILED: Decryption failed"
  rm -f "$TMP_FILE"
  /opt/resiliplan/scripts/alert.sh "❌ ResiliPlan restore test FAILED: decryption failed" 2>/dev/null || true
  exit 1
fi
DUMP_SIZE=$(stat -c '%s' "$TMP_FILE")
log "Step 1/4: Decrypted OK (${DUMP_SIZE} bytes)"

# ===== Step 2: Restore to test database =====
log "Step 2/4: Restoring to test database '$TEST_DB'"

# Drop test DB if exists
docker exec "$CONTAINER_NAME" psql -U resiliplan -d postgres -c "DROP DATABASE IF EXISTS ${TEST_DB};" >/dev/null 2>>"$LOG_FILE"

# Create test DB
docker exec "$CONTAINER_NAME" psql -U resiliplan -d postgres -c "CREATE DATABASE ${TEST_DB};" >/dev/null 2>>"$LOG_FILE"

# Restore
if ! gunzip -c "$TMP_FILE" | docker exec -i "$CONTAINER_NAME" psql -U resiliplan -d "${TEST_DB}" >/dev/null 2>>"$LOG_FILE"; then
  log "❌ FAILED: Restore to test DB failed"
  rm -f "$TMP_FILE"
  docker exec "$CONTAINER_NAME" psql -U resiliplan -d postgres -c "DROP DATABASE IF EXISTS ${TEST_DB};" >/dev/null 2>&1
  /opt/resiliplan/scripts/alert.sh "❌ ResiliPlan restore test FAILED: restore failed" 2>/dev/null || true
  exit 1
fi
log "Step 2/4: Restore OK"

# ===== Step 3: Verify row counts =====
log "Step 3/4: Verifying row counts"

# Critical tables to check
TABLES=("plans" "sections" "users" "audit_log" "assets" "bia_entries" "risks" "ai_configs")

# Get counts from production (exclude test DB)
PROD_COUNTS=()
TEST_COUNTS=()
TABLE_NAMES=()
ALL_OK=true

for TABLE in "${TABLES[@]}"; do
  PROD=$(docker exec "$CONTAINER_NAME" psql -U resiliplan -d resiliplan -tAc "SELECT COUNT(*) FROM ${TABLE};" 2>/dev/null || echo "0")
  TEST=$(docker exec "$CONTAINER_NAME" psql -U resiliplan -d "${TEST_DB}" -tAc "SELECT COUNT(*) FROM ${TABLE};" 2>/dev/null || echo "0")

  TABLE_NAMES+=("$TABLE")
  PROD_COUNTS+=("$PROD")
  TEST_COUNTS+=("$TEST")

  if [ "$TEST" -lt "$PROD" ]; then
    log "  ❌ ${TABLE}: prod=${PROD}, test=${TEST} (MISSING ROWS)"
    ALL_OK=false
  else
    log "  ✅ ${TABLE}: prod=${PROD}, test=${TEST}"
  fi
done

if [ "$ALL_OK" = false ]; then
  log "❌ FAILED: Some tables have missing rows in restored backup"
  rm -f "$TMP_FILE"
  docker exec "$CONTAINER_NAME" psql -U resiliplan -d postgres -c "DROP DATABASE IF EXISTS ${TEST_DB};" >/dev/null 2>&1
  /opt/resiliplan/scripts/alert.sh "❌ ResiliPlan restore test FAILED: missing rows in backup" 2>/dev/null || true
  exit 1
fi

log "Step 3/4: All tables OK"

# ===== Step 4: Cleanup =====
log "Step 4/4: Cleaning up"
rm -f "$TMP_FILE"
docker exec "$CONTAINER_NAME" psql -U resiliplan -d postgres -c "DROP DATABASE IF EXISTS ${TEST_DB};" >/dev/null 2>&1
log "Step 4/4: Cleanup OK"

# ===== Success =====
log "✅ Monthly restore test PASSED"
log "   Source: $LATEST_BACKUP"
log "   Verified: ${#TABLES[@]} tables"

/opt/resiliplan/scripts/alert.sh "✅ ResiliPlan monthly restore test PASSED (${#TABLES[@]} tables verified)" 2>/dev/null || true

exit 0
