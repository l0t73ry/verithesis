#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/outlayer/verithesis-wasi"

rustup target add wasm32-wasip1 2>/dev/null || true
cargo build --release --target wasm32-wasip1

WASM="$ROOT/outlayer/verithesis-wasi/target/wasm32-wasip1/release/verithesis-wasi.wasm"
mkdir -p "$ROOT/enclave-worker/wasm" "$ROOT/web-app/public"
cp "$WASM" "$ROOT/enclave-worker/wasm/verithesis-wasi.wasm"
cp "$WASM" "$ROOT/web-app/public/verithesis-wasi.wasm"
if command -v shasum >/dev/null; then
  echo "WASM: $WASM"
  echo "SHA256: $(shasum -a 256 "$WASM" | awk '{print $1}')"
fi

if command -v wasmtime >/dev/null; then
  wasmtime run "$WASM" -- < "$ROOT/outlayer/fixtures/wasm-golden.json" | head -c 120
  echo ""
  echo "wasmtime smoke OK"
else
  echo "Install wasmtime for local tee gate: https://wasmtime.dev/"
fi
