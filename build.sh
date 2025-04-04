#!/bin/bash

# Build Script for compiling the BFS algorithm to WebAssembly with Emscripten

source ~/dev/emsdk/emsdk_env.sh

# Check if Emscripten is available
if ! command -v emcc &>/dev/null; then
  echo "Emscripten compiler not found. Make sure you have activated the Emscripten environment."
  echo "You may need to source 'emsdk_env.sh' first."
  exit 1
fi

# Check if VCPKG_ROOT is set
if [ -z "$VCPKG_ROOT" ]; then
  echo "VCPKG_ROOT environment variable is not set. Please set it to your vcpkg installation directory."
  exit 1
fi

# Install RapidJSON if not already installed
echo "Installing RapidJSON from vcpkg..."
"$VCPKG_ROOT/vcpkg" install rapidjson:wasm32-emscripten

# Create output directories if they don't exist
mkdir -p src/cpp

# Compile the WebAssembly module
echo "Compiling bfs.cpp to WebAssembly..."
emcc src/cpp/bfs.cpp -o src/cpp/bfs.wasm.js \
  -s WASM=1 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' \
  -s EXPORT_ES6=1 \
  -s EXPORT_NAME=createBfsModule \
  -s ENVIRONMENT=web \
  -s TOTAL_MEMORY=67108864 \
  -I "$VCPKG_ROOT/installed/wasm32-emscripten/include" \
  -O3 \
  --bind \
  --no-entry

if [ $? -ne 0 ]; then
  echo "Failed to compile WebAssembly module."
  exit 1
fi

echo "Successfully compiled bfs.cpp to WebAssembly!"
echo "Output files:"
echo "- src/cpp/bfs.wasm.js"
echo "- src/cpp/bfs.wasm"
echo "Done."
