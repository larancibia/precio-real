#!/usr/bin/env bash
# install_cron.sh — Install the precio-real scraper as a crontab entry.
#
# Usage:
#   bash scraper/install_cron.sh
#
# Installs a cron entry that runs every 2 hours.
# Safe to re-run: only adds the entry if it's not already present.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PYTHON="$(command -v python3)"
LOG_FILE="/tmp/precio-real-scraper.log"
RUN_HISTORY_PATH="/tmp/precio-real-scraper-run-history.jsonl"
FRESHNESS_THRESHOLD_HOURS="${PRECIO_REAL_FRESHNESS_THRESHOLD_HOURS:-6}"

# The command to run: cd to project root so `python -m scraper.scraper` resolves.
CRON_CMD="cd $PROJECT_DIR && $PYTHON -m scraper.scraper --run-history-path $RUN_HISTORY_PATH --check-freshness --freshness-threshold-hours $FRESHNESS_THRESHOLD_HOURS >> $LOG_FILE 2>&1"
# Every 2 hours at minute 0
CRON_SCHEDULE="0 */2 * * *"
CRON_ENTRY="$CRON_SCHEDULE $CRON_CMD"

echo "Installing cron job for precio-real scraper..."
echo "  Schedule : $CRON_SCHEDULE (every 2 hours)"
echo "  Command  : $CRON_CMD"
echo "  Log      : $LOG_FILE"
echo "  History  : $RUN_HISTORY_PATH"
echo "  Freshness: ${FRESHNESS_THRESHOLD_HOURS}h"
echo ""

# Read existing crontab (ignore error if empty)
CURRENT_CRONTAB=$(crontab -l 2>/dev/null || true)

if echo "$CURRENT_CRONTAB" | grep -qF "scraper.scraper"; then
    echo "Cron entry already present — no changes made."
    echo "Current entry:"
    echo "$CURRENT_CRONTAB" | grep "scraper.scraper"
    exit 0
fi

# Append new entry
(echo "$CURRENT_CRONTAB"; echo "$CRON_ENTRY") | crontab -

echo "Done. Verify with: crontab -l"
echo ""
crontab -l | grep "scraper.scraper" || true
