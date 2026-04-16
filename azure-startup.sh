#!/bin/bash
set -e

# Azure App Service startup script
echo "=========================================="
echo "EV Backend - Azure App Service Startup"
echo "=========================================="
echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"
echo "Directory: $(pwd)"
echo ""

# Ensure we're in the right directory
cd /home/site/wwwroot

# Set environment variables for production
export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=512"

# Install dependencies
echo "Installing production dependencies..."
npm install --production || {
  echo "ERROR: npm install failed"
  exit 1
}

echo "Dependencies installed successfully"
echo ""
echo "Starting Node.js server..."
echo "Server will listen on port: ${PORT:-8080}"
echo ""

# Start the application
exec npm start
