#!/bin/bash
# Build script with optional watch mode and optimizations

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/env_check.sh"

mkdir -p src/cpp

# Common arguments for both debug and release builds
COMMON_ARGS=(
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
  -I "$VCPKG_ROOT/installed/wasm32-emscripten/include"
  --bind
  --no-entry
)

# Optimized build arguments
RELEASE_ARGS=(
  "${COMMON_ARGS[@]}"
  -O3
  -flto
  -fno-rtti
  -fno-exceptions
  -DEMSCRIPTEN_HAS_UNBOUND_TYPE_NAMES=0
  -s ASSERTIONS=2
  -s INITIAL_MEMORY=16MB
  -s TOTAL_STACK=2MB
  -s MALLOC="emmalloc"
  -s SUPPORT_ERRNO=0
  -s NO_FILESYSTEM=1
  -s DISABLE_EXCEPTION_CATCHING=1
  -s ELIMINATE_DUPLICATE_FUNCTIONS=1
  -s AGGRESSIVE_VARIABLE_ELIMINATION=1
  -s ALLOW_UNIMPLEMENTED_SYSCALLS=0
  -s ERROR_ON_UNDEFINED_SYMBOLS=1
  --closure 0
)

# Debug build arguments
DEBUG_ARGS=(
  "${COMMON_ARGS[@]}"
  -O0
  -g3
  -s ASSERTIONS=2
  -s SAFE_HEAP=1
  -s STACK_OVERFLOW_CHECK=2
  -s DEMANGLE_SUPPORT=1
  -s TOTAL_MEMORY=67108864
)

# Determine whether to use debug or release build
MODE="release"
WATCH=false

while [[ $# -gt 0 ]]; do
  case "$1" in
  --watch)
    WATCH=true
    shift
    ;;
  --debug)
    MODE="debug"
    shift
    ;;
  *)
    shift
    ;;
  esac
done

# Set build arguments based on mode
if [ "$MODE" == "debug" ]; then
  EMCC_ARGS=("${DEBUG_ARGS[@]}")
  BUILD_TYPE="debug"
else
  EMCC_ARGS=("${RELEASE_ARGS[@]}")
  BUILD_TYPE="optimized release"
fi

# Build once or watch based on arguments
if [ "$WATCH" = true ]; then
  echo "👀 Watching for changes in $BUILD_TYPE mode..."
  emcc --watch "${EMCC_ARGS[@]}"
else
  echo "🔨 Building in $BUILD_TYPE mode..."
  emcc "${EMCC_ARGS[@]}"
  if [ "$MODE" == "release" ]; then
    echo "📏 Optimizing and compressing wasm..."
    # If wasm-opt tool is available (from binaryen package)
    if command -v wasm-opt >/dev/null 2>&1; then
      wasm-opt -O4 --enable-mutable-globals --enable-bulk-memory \
        --enable-threads --enable-simd -o src/cpp/bfs.wasm.opt src/cpp/bfs.wasm.wasm &&
        mv src/cpp/bfs.wasm.opt src/cpp/bfs.wasm.wasm
    fi
  fi

  echo "✅ Build complete:"
  echo "- src/cpp/bfs.wasm.js"
  echo "- src/cpp/bfs.wasm.wasm"

  # Show size information
  echo "📊 Build size:"
  for file in src/cpp/bfs.wasm.js src/cpp/bfs.wasm.wasm; do
    if [ -f "$file" ]; then
      ls -lh "$file" | awk '{print "- " $9 ": " $5}'
    else
      echo "- $file: File not found"
    fi
  done
fi
