#!/bin/bash
# Build script with optional watch mode

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/env_check.sh"

mkdir -p src/cpp

EMCC_ARGS=(
  src/cpp/bfs.cpp
  src/cpp/effects.cpp
  src/cpp/pricing.cpp
  src/cpp/bfs_algorithm.cpp
  src/cpp/json_parser.cpp
  -o src/cpp/bfs.wasm.js
  -s WASM=1
  -s ALLOW_MEMORY_GROWTH=1
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]'
  -s EXPORT_ES6=1
  -s EXPORT_NAME=createBfsModule
  -s ENVIRONMENT=web
  -s TOTAL_MEMORY=67108864
  -s ASSERTIONS=2
  -I "$VCPKG_ROOT/installed/wasm32-emscripten/include"
  -O3
  --bind
  --no-entry
)

if [ "$1" == "--watch" ]; then
  echo "👀 Watching for changes..."
  emcc --watch "${EMCC_ARGS[@]}"
else
  echo "🔨 Building once..."
  emcc "${EMCC_ARGS[@]}"
  echo "✅ Build complete:"
  echo "- src/cpp/bfs.wasm.js"
  echo "- src/cpp/bfs.wasm"
fi
