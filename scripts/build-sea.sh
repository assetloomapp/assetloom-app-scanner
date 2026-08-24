#!/usr/bin/env bash
set -euo pipefail

# Single binary via Node SEA: pnpm build:sea -> dist/assetloom-app-scanner-sea
# Bun is used as the bundler only (SEA needs one CJS file); the runtime is
# the stock Node binary, so node:sqlite works without the bun:sqlite shim.
# ponytail: macOS/Linux only; add Windows signtool handling if ever needed.

mkdir -p dist/sea
bun build src/cli.ts --target=node --format=cjs --outfile=dist/sea/cli.cjs

cat > dist/sea/sea-config.json <<'EOF'
{
  "main": "dist/sea/cli.cjs",
  "output": "dist/sea/sea-prep.blob",
  "disableExperimentalSEAWarning": true
}
EOF
node --experimental-sea-config dist/sea/sea-config.json

cp "$(command -v node)" dist/assetloom-app-scanner-sea

extra_args=()
if [[ "$(uname)" == "Darwin" ]]; then
  codesign --remove-signature dist/assetloom-app-scanner-sea
  extra_args+=(--macho-segment-name NODE_SEA)
fi

npx -y postject dist/assetloom-app-scanner-sea NODE_SEA_BLOB dist/sea/sea-prep.blob \
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 \
  "${extra_args[@]}"

if [[ "$(uname)" == "Darwin" ]]; then
  codesign --sign - dist/assetloom-app-scanner-sea
fi

ls -lh dist/assetloom-app-scanner-sea
