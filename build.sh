#!/bin/bash
# Build script with optional watch mode and optimizations

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/env_check.sh"

mkdir -p src/cpp

# Common arguments for both debug and release builds
COMMON_ARGS=(
  src/cpp/bfs.cpp
  src/cpp/dfs.cpp
  src/cpp/effects.cpp
  src/cpp/pricing.cpp
  src/cpp/bfs_algorithm.cpp
  src/cpp/dfs_algorithm.cpp
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

# Release build arguments with optimizations
RELEASE_ARGS=(
  "${COMMON_ARGS[@]}"
  -O3
  -flto
  -fno-rtti
  -fno-exceptions
  -DEMSCRIPTEN_HAS_UNBOUND_TYPE_NAMES=0
  -s ASSERTIONS=1
  -s INITIAL_MEMORY=16MB 
  -s TOTAL_STACK=2MB
  -s MALLOC=emmalloc
  -s SUPPORT_ERRNO=0
  -s NO_FILESYSTEM=1
  -s DISABLE_EXCEPTION_CATCHING=1
  -s ELIMINATE_DUPLICATE_FUNCTIONS=1
  -s AGGRESSIVE_VARIABLE_ELIMINATION=1
  -s ALLOW_UNIMPLEMENTED_SYSCALLS=0
  -s ERROR_ON_UNDEFINED_SYMBOLS=0
  --closure 0
)

# Function to copy wasm file to public directory (for development)
copy_wasm_to_public() {
  mkdir -p public/
  cp src/cpp/bfs.wasm.wasm public/bfs.wasm
  echo "Copied WASM file to public directory for serving"
}

# Function to copy wasm file to dist directory (for production builds)
copy_wasm_to_dist() {
  if [ -d "dist/" ]; then
    mkdir -p dist/assets/
    cp src/cpp/bfs.wasm.wasm dist/assets/bfs.wasm
    cp src/cpp/bfs.wasm.wasm dist/bfs.wasm
    echo "Copied WASM file to dist directory for production"
  fi
}

# Build options
if [[ "$1" == "--debug" ]]; then
  echo "Building in debug mode..."
  emcc -std=c++17 "${DEBUG_ARGS[@]}"
else
  echo "Building in optimized release mode..."
  emcc -std=c++17 "${RELEASE_ARGS[@]}"
fi

echo "Successfully compiled C++ to WebAssembly!"

copy_wasm_to_public
copy_wasm_to_dist

# Display file sizes
echo "📊 Build size:"
ls -lh src/cpp/bfs.wasm.js src/cpp/bfs.wasm.wasm | awk '{print "- " $9 ": " $5}'
