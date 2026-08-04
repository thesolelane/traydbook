#!/bin/bash
# TraydBook — Ubuntu deployment script
# Run from the server: bash /var/www/traydbook/deploy/deploy.sh

set -e

APP_DIR="/var/www/traydbook"
LOG_DIR="/var/log/traydbook"

echo "=============================="
echo "  TraydBook Deploy"
echo "=============================="

# Create log directory if needed
mkdir -p "$LOG_DIR"

cd "$APP_DIR"

echo "→ Pulling latest code..."
git pull origin main

echo "→ Installing dependencies..."
npm install --legacy-peer-deps --production=false

echo "→ Building frontend..."
npm run build

echo "→ Restarting API server..."
if pm2 list | grep -q "traydbook-api"; then
    pm2 reload ecosystem.config.js --update-env
else
    pm2 start deploy/ecosystem.config.js
    pm2 save
fi

echo ""
echo "✓ Deploy complete."
echo "  API status:  pm2 status"
echo "  API logs:    pm2 logs traydbook-api"
echo "  Nginx logs:  tail -f /var/log/nginx/error.log"

# ── Post-deploy simulation ──────────────────────────────────────────────────
# Runs the 112-check end-to-end simulation against the live staging app.
# Requires these env vars to be exported on the server (add to /etc/environment
# or the PM2 ecosystem file and then `source` them before calling this script):
#   SIM_APP_URL        https://admin.traydbook.com
#   SIM_SB_URL         Supabase project URL
#   SIM_SB_ANON_KEY    Supabase anon key
#   SIM_SB_SERVICE_KEY Supabase service role key
#
# Set SIM_SKIP=1 to bypass (e.g. hotfix deploys where speed matters more).

if [ "${SIM_SKIP:-0}" = "1" ]; then
  echo ""
  echo "⚠  Simulation skipped (SIM_SKIP=1)"
elif [ -z "${SIM_APP_URL:-}" ] || [ -z "${SIM_SB_URL:-}" ] || \
     [ -z "${SIM_SB_ANON_KEY:-}" ] || [ -z "${SIM_SB_SERVICE_KEY:-}" ]; then
  echo ""
  echo "⚠  Simulation skipped — set SIM_APP_URL, SIM_SB_URL, SIM_SB_ANON_KEY,"
  echo "   SIM_SB_SERVICE_KEY on this server to enable post-deploy checks."
else
  echo ""
  echo "→ Running post-deploy simulation (112 checks)..."
  # Wait briefly for PM2 to finish reloading workers before hitting the API
  sleep 5
  node "$APP_DIR/scripts/simulate.mjs"
  SIM_EXIT=$?
  if [ "$SIM_EXIT" -ne 0 ]; then
    echo ""
    echo "❌ Simulation failed — one or more checks did not pass."
    echo "   Review the output above, fix the regression, and re-deploy."
    exit "$SIM_EXIT"
  fi
  echo "✅ All simulation checks passed."
fi
