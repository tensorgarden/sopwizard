#!/bin/bash
# Builds the downloadable Windows bundle: server with a bundled Node runtime,
# the extension, and a double-click launcher. Batch files get CRLF endings.
# Usage: scripts/package-win.sh

set -euo pipefail

NODE_VERSION="${NODE_VERSION:-v22.18.0}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGE="$ROOT/dist/SOPWizard"
ZIP="$ROOT/dist/SOPWizard-windows-x64.zip"
TMP="$(mktemp -d)"

rm -rf "$STAGE" "$ZIP"
mkdir -p "$STAGE/runtime" "$STAGE/dist"

echo "· fetching Node $NODE_VERSION (win-x64)"
WINZIP="node-$NODE_VERSION-win-x64.zip"
curl -fsSL "https://nodejs.org/dist/$NODE_VERSION/$WINZIP" -o "$TMP/$WINZIP"
# Verify against the official checksums before we trust the binary.
curl -fsSL "https://nodejs.org/dist/$NODE_VERSION/SHASUMS256.txt" -o "$TMP/SHASUMS256.txt"
(cd "$TMP" && grep " $WINZIP\$" SHASUMS256.txt | shasum -a 256 -c -)
unzip -q "$TMP/$WINZIP" -d "$TMP"
cp "$TMP/node-$NODE_VERSION-win-x64/node.exe" "$STAGE/runtime/node.exe"

echo "· staging server"
mkdir -p "$STAGE/server"
cp -R "$ROOT/server/src" "$STAGE/server/src"
cp -R "$ROOT/server/samples" "$STAGE/server/samples"
cp "$ROOT/server/package.json" "$STAGE/server/package.json"
cp "$ROOT/server/.env.example" "$STAGE/server/.env.example"
npm install --omit=dev --prefix "$STAGE/server" --silent

echo "· staging extension"
cp -R "$ROOT/extension" "$STAGE/extension"
(cd "$STAGE" && zip -qr "dist/sopwizard-extension.zip" extension)

python3 - "$STAGE" <<'PY'
import sys

stage = sys.argv[1]

launcher = """@echo off
setlocal
cd /d "%~dp0"
echo SOPWizard is running. Keep this window open while you record.
echo Close this window to stop.
start "" /min powershell -NoProfile -Command "while($true){try{Invoke-WebRequest http://localhost:8787/health -UseBasicParsing -TimeoutSec 1 | Out-Null; break}catch{Start-Sleep -Milliseconds 400}}; Start-Process 'http://localhost:8787'"
cd server
"%~dp0runtime\\node.exe" src\\index.js
pause
"""

readme = """SOPWizard
=========

1. Double-click "Start SOPWizard.cmd".
   If Windows shows "Windows protected your PC", click
   "More info" and then "Run anyway" (first time only).
   Your browser opens the SOPWizard home page.

2. Install the recorder (one time):
   - In Chrome, go to  chrome://extensions
   - Turn on "Developer mode" (top right)
   - Click "Load unpacked" and choose the "extension" folder
     inside this SOPWizard folder
   - Pin SOPWizard to the toolbar (puzzle icon -> pin)

3. Try it: the home page has a practice page made for your
   first recording.

Keep the small black window open while you use SOPWizard.
"""

for name, text in (("Start SOPWizard.cmd", launcher), ("README.txt", readme)):
    with open(f"{stage}/{name}", "wb") as f:
        f.write(text.replace("\n", "\r\n").encode("utf-8"))
print("· wrote launcher and readme (crlf)")
PY

echo "· zipping"
cd "$ROOT/dist" && zip -qry "$ZIP" "SOPWizard"
rm -rf "$TMP"
echo "built $ZIP"
