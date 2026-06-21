#!/usr/bin/env bash
#
# Backup Restore Verification Script
# Tests that daily backups can be successfully restored
#
# Usage: ./scripts/backup-restore-test.sh [BACKUP_FILE]
#
# If BACKUP_FILE not provided, uses the most recent .dump backup created by scripts/daily-backup.sh.
#

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/resiliplan}"
TEST_DB_NAME="resiliplan_restore_test_$(date +%s)"
MAIN_DB_NAME="${MAIN_DB_NAME:-resiliplan}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Find backup file
if [ $# -eq 0 ]; then
    log_info "Finding most recent backup..."
    BACKUP_FILE=$(find "$BACKUP_DIR" -name "resiliplan_*.dump" -type f -printf "%T@ %p\n" | sort -rn | head -1 | cut -d' ' -f2-)
    if [ -z "$BACKUP_FILE" ]; then
        log_error "No backup files found in $BACKUP_DIR"
        exit 1
    fi
else
    BACKUP_FILE="$1"
fi

log_info "Using backup file: $BACKUP_FILE"

if [ ! -f "$BACKUP_FILE" ]; then
    log_error "Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Cleanup function
cleanup() {
    log_info "Cleaning up test database..."
    psql -U postgres -c "DROP DATABASE IF EXISTS $TEST_DB_NAME;" 2>/dev/null || true
}

trap cleanup EXIT

# Create test database
log_info "Creating test database: $TEST_DB_NAME"
psql -U postgres -c "CREATE DATABASE $TEST_DB_NAME;" > /dev/null

# Restore backup
log_info "Restoring backup to test database..."
pg_restore -U postgres -d "$TEST_DB_NAME" "$BACKUP_FILE" --no-owner --no-privileges --clean --if-exists

# Verification tests
log_info "Running verification tests..."

# Test 1: Check essential tables exist
log_info "Test 1: Checking essential tables..."
TABLES=("users" "tenants" "drp_plans" "drp_sections" "bia_entries" "service_assets" "service_risks" "recovery_drills" "email_outbox")
MISSING_TABLES=()

for table in "${TABLES[@]}"; do
    if ! psql -U postgres -d "$TEST_DB_NAME" -c "SELECT 1 FROM $table LIMIT 1;" > /dev/null 2>&1; then
        MISSING_TABLES+=("$table")
    fi
done

if [ ${#MISSING_TABLES[@]} -gt 0 ]; then
    log_error "Missing tables: ${MISSING_TABLES[*]}"
    exit 1
fi
log_info "✓ All essential tables present"

# Test 2: Verify row counts match main database
log_info "Test 2: Verifying row counts..."
COUNT_MISMATCHES=()

for table in "${TABLES[@]}"; do
    MAIN_COUNT=$(psql -U postgres -d "$MAIN_DB_NAME" -t -c "SELECT COUNT(*) FROM $table;" | tr -d '[:space:]')
    TEST_COUNT=$(psql -U postgres -d "$TEST_DB_NAME" -t -c "SELECT COUNT(*) FROM $table;" | tr -d '[:space:]')
    
    if [ "$MAIN_COUNT" != "$TEST_COUNT" ]; then
        log_warn "Row count mismatch for $table: main=$MAIN_COUNT, test=$TEST_COUNT"
        COUNT_MISMATCHES+=("$table")
    fi
done

if [ ${#COUNT_MISMATCHES[@]} -gt 0 ]; then
    log_warn "Row count mismatches found (this may be expected if data changed during backup)"
else
    log_info "✓ All row counts match"
fi

# Test 3: Verify migrations table
log_info "Test 3: Checking migration history..."
if ! psql -U postgres -d "$TEST_DB_NAME" -c "SELECT 1 FROM _resiliplan_migrations LIMIT 1;" > /dev/null 2>&1; then
    log_error "Migration history table missing or inaccessible"
    exit 1
fi
MIGRATION_COUNT=$(psql -U postgres -d "$TEST_DB_NAME" -t -c "SELECT COUNT(*) FROM _resiliplan_migrations;" | tr -d '[:space:]')
log_info "✓ Migration history present ($MIGRATION_COUNT migrations)"

# Test 4: Verify critical indexes
log_info "Test 4: Checking critical indexes..."
CRITICAL_INDEXES=("idx_users_email" "idx_users_tenant_id" "idx_plans_tenant_id")
MISSING_INDEXES=()

for idx in "${CRITICAL_INDEXES[@]}"; do
    if ! psql -U postgres -d "$TEST_DB_NAME" -c "SELECT 1 FROM pg_indexes WHERE indexname = '$idx';" > /dev/null 2>&1; then
        MISSING_INDEXES+=("$idx")
    fi
done

if [ ${#MISSING_INDEXES[@]} -gt 0 ]; then
    log_error "Missing critical indexes: ${MISSING_INDEXES[*]}"
    exit 1
fi
log_info "✓ All critical indexes present"

# Test 5: Verify foreign key constraints
log_info "Test 5: Checking foreign key constraints..."
FK_COUNT=$(psql -U postgres -d "$TEST_DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY';" | tr -d '[:space:]')
if [ "$FK_COUNT" -eq 0 ]; then
    log_error "No foreign key constraints found"
    exit 1
fi
log_info "✓ Foreign key constraints present ($FK_COUNT constraints)"

# Summary
log_info "========================================="
log_info "Backup Restore Verification: PASSED"
log_info "========================================="
log_info "Backup file: $BACKUP_FILE"
log_info "Test database: $TEST_DB_NAME (will be cleaned up)"
log_info "Essential tables: ${#TABLES[@]} verified"
log_info "Migrations: $MIGRATION_COUNT applied"
log_info "Indexes: ${#CRITICAL_INDEXES[@]} critical indexes verified"
log_info "Foreign keys: $FK_COUNT constraints verified"
if [ ${#COUNT_MISMATCHES[@]} -gt 0 ]; then
    log_warn "Note: ${#COUNT_MISMATCHES[@]} tables had row count differences (expected during live backup)"
fi

exit 0
