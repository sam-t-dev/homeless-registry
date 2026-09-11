#!/bin/bash
# Sub-Sam Cron Job Script
# Runs every 30 minutes to handle anonymous homeless registry tasks
#
# This script performs the same functions as the GitHub Actions cron workflow,
# but runs on the VPS. It's useful for environments without GitHub Actions
# or for offline processing.

set -e

REGISTRY_DIR="/home/ubuntu/anonymous-registry"
cd "$REGISTRY_DIR"

echo "$(date '+%Y-%m-%d %H:%M:%S') - Sub-Sam cron job starting" >> cron.log

# Step 1: Ensure data directory exists and records.json has valid JSON
if [ ! -f data/records.json ]; then
  echo "$(date) - Creating initial records.json" >> cron.log
  echo '[]' > data/records.json
fi

# Step 2: Run the aggregate generation (same as GitHub Actions generate-index.js)
# But adapted for Node.js on the VPS
if command -v node &>/dev/null; then
  echo "$(date) - Running generate-index.js" >> cron.log
  node generate-index.js >> cron.log 2>&1 || echo "$(date) - WARNING: generate-index.js had issues" >> cron.log
else
  echo "$(date) - Node.js not found, skipping index generation" >> cron.log
fi

# Step 3: Check if we need to commit changes to gh-pages (if this is a git repo)
if [ -d .git ]; then
  # Check if index.html was actually updated
  if git diff --quiet index.html; then
    echo "$(date) - No changes to index.html, skipping git commit" >> cron.log
  else
    echo "$(date) - Updating index.html on gh-pages branch" >> cron.log
    git config user.name "Sub-Sam"
    git config user.email "sub-sam@anonymous-registry.local"
    git add index.html
    git commit -m "chore: update aggregate counts [auto-sub-sam $(date '+%Y-%m-%d %H:%M')]"
    git push origin HEAD:gh-pages 2>/dev/null || echo "$(date) - Could not push to gh-pages (may not be configured)" >> cron.log
  fi
else
  echo "$(date) - Not a git repo, skipping git operations" >> cron.log
fi

# Step 4: Log completion
echo "$(date '+%Y-%m-%d %H:%M:%S') - Sub-Sam cron job completed successfully" >> cron.log