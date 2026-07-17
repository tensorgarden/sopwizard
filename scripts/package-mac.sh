#!/bin/bash
# Builds the downloadable macOS bundle: the server with a bundled Node
# runtime, the extension, and a double-click launcher. No install required.
# Usage: scripts/package-mac.sh [arm64|x64]

set -euo pipefail

ARCH="${1:-arm64}"
NODE_VERSION="${NODE_VERSION:-v22.18.0}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGE="$ROOT/dist/SOPWizard"
# The download page names the Intel build "mac-intel"; Node names the same
# architecture "x64". Keep both straight.
LABEL="$ARCH"
[ "$ARCH" = "x64" ] && LABEL="intel"
ZIP="$ROOT/dist/SOPWizard-mac-$LABEL.zip"

rm -rf "$STAGE" "$ZIP"
mkdir -p "$STAGE/runtime"

echo "· fetching Node $NODE_VERSION ($ARCH)"
TARBALL="node-$NODE_VERSION-darwin-$ARCH.tar.gz"
TMP="$(mktemp -d)"
curl -fsSL "https://nodejs.org/dist/$NODE_VERSION/$TARBALL" -o "$TMP/$TARBALL"
# Verify against the official checksums before we trust the binary.
curl -fsSL "https://nodejs.org/dist/$NODE_VERSION/SHASUMS256.txt" -o "$TMP/SHASUMS256.txt"
(cd "$TMP" && grep " $TARBALL\$" SHASUMS256.txt | shasum -a 256 -c -)
tar -xz -C "$STAGE/runtime" --strip-components=2 -f "$TMP/$TARBALL" "node-$NODE_VERSION-darwin-$ARCH/bin/node"
rm -rf "$TMP"

echo "· staging server"
mkdir -p "$STAGE/server"
cp -R "$ROOT/server/src" "$STAGE/server/src"
cp -R "$ROOT/server/samples" "$STAGE/server/samples"
cp "$ROOT/server/package.json" "$STAGE/server/package.json"
cp "$ROOT/server/.env.example" "$STAGE/server/.env.example"
npm install --omit=dev --prefix "$STAGE/server" --silent

echo "· staging extension"
cp -R "$ROOT/extension" "$STAGE/extension"
mkdir -p "$STAGE/dist"
(cd "$STAGE" && zip -qr "dist/sopwizard-extension.zip" extension)

cat > "$STAGE/Start SOPWizard.command" <<'EOF'
#!/bin/bash
cd "$(dirname "$0")"
xattr -dr com.apple.quarantine . 2>/dev/null
clear
echo "SOPWizard is running. Keep this window open while you record."
echo "Close this window (or press Ctrl+C) to stop."
( until curl -s http://localhost:8787/health >/dev/null 2>&1; do sleep 1; done
  open http://localhost:8787 ) &
cd server
exec ../runtime/node src/index.js
EOF
chmod +x "$STAGE/Start SOPWizard.command"

cat > "$STAGE/README.txt" <<'EOF'
SOPWizard
=========

1. Right-click "Start SOPWizard.command" and choose Open
   (first time only; after that, double-click works).
   Your browser opens the SOPWizard home page.

2. Install the recorder (one time):
   - In Chrome, go to  chrome://extensions
   - Turn on "Developer mode" (top right)
   - Click "Load unpacked" and choose the "extension" folder
     inside this SOPWizard folder
   - Pin SOPWizard to the toolbar (puzzle icon -> pin)

3. Try it: the home page has a practice page made for your
   first recording.

Keep the small terminal window open while you use SOPWizard.
EOF

echo "· zipping"
cd "$ROOT/dist" && zip -qry "$ZIP" "SOPWizard"
echo "built $ZIP"
