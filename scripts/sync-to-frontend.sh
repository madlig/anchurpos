#!/bin/bash
# Script untuk sync root → frontend/
# Jalankan setiap kali ada perubahan kode di root
# Usage: bash scripts/sync-to-frontend.sh

FRONTEND_DIR="$(dirname "$0")/../frontend"
ROOT_DIR="$(dirname "$0")/.."

echo "Syncing root → frontend/..."

# Folders to sync from root to frontend
SYNC_DIRS=("app" "lib" "types" "components" "scripts" "public")

for dir in "${SYNC_DIRS[@]}"; do
  if [ -d "$ROOT_DIR/$dir" ]; then
    rsync -a --delete \
      --exclude="node_modules" \
      --exclude=".next" \
      "$ROOT_DIR/$dir/" "$FRONTEND_DIR/$dir/"
    echo "  ✓ $dir synced"
  fi
done

# Sync config files
CONFIG_FILES=("next.config.ts" "tailwind.config.ts" "tsconfig.json" "postcss.config.mjs")
for f in "${CONFIG_FILES[@]}"; do
  if [ -f "$ROOT_DIR/$f" ]; then
    cp "$ROOT_DIR/$f" "$FRONTEND_DIR/$f"
    echo "  ✓ $f synced"
  fi
done

echo "Sync complete!"
