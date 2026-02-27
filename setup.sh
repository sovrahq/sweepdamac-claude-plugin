#!/bin/bash
# SweepDaMac — post-install setup
# This script installs dependencies and compiles the MCP server

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/server"

echo "🧹 Setting up SweepDaMac..."

cd "$SERVER_DIR"

if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install --production=false
fi

if [ ! -d "dist" ] || [ "src/index.ts" -nt "dist/index.js" ]; then
  echo "🔨 Compiling TypeScript..."
  npx tsc
fi

echo "✅ SweepDaMac is ready! Restart Claude Code to load the plugin."
