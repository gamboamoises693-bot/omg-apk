#!/usr/bin/env bash
# Rebuilds the screenshots of the how-to guides from the real app.
#   1. builds a copy of the app that talks to the LOCAL emulators (never the real Firebase project)
#   2. starts the Auth and Firestore emulators with the real security rules, adds sample data
#   3. opens the app in a phone-sized browser, takes a picture per step, writes src/data/guides.json
# Needs: node, firebase-tools (`npx firebase-tools`), and Playwright with Chromium (`npm i -g playwright`).
# Usage: scripts/guides/run.sh [guideId ...]
set -euo pipefail
cd "$(dirname "$0")/../.."
FIREBASE="${FIREBASE_BIN:-npx -y firebase-tools}"
OUT_BACKUP="$(mktemp -d)"

echo "== build (emulator copy)"
NEXT_PUBLIC_USE_EMULATORS=1 npx next build >/dev/null
python3 -m http.server 8765 -d out >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT

echo "== emulators + capture"
$FIREBASE emulators:exec --only auth,firestore --project project-a682ecac-e2d1-469c-bc7 \
  "node scripts/guides/run.mjs $*"

echo "== rebuild normal app (without emulators)"
npx next build >/dev/null
