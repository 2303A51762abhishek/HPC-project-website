#!/bin/bash
set -e

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting EV Backend..."
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Node: $(node --version), NPM: $(npm --version)"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Working directory: $(pwd)"

# Install dependencies - CRITICAL for Azure
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Installing npm dependencies..."
if npm install --production; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Dependencies installed successfully"
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ npm install failed"
  exit 1
fi

# Set memory limit for Node.js
export NODE_OPTIONS="--max-old-space-size=512"

# Start the application
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting Node.js server on port 8080..."
exec npm start

