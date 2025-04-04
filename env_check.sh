#!/bin/bash
# Shared environment setup and checks for Emscripten and vcpkg

set -e

# Load Emscripten environment
source ~/dev/emsdk/emsdk_env.sh

# Check if emcc is available
if ! command -v emcc &>/dev/null; then
  echo "Error: Emscripten compiler not found."
  echo "Make sure you have activated the Emscripten environment."
  exit 1
fi

# Check if VCPKG_ROOT is set
if [ -z "$VCPKG_ROOT" ]; then
  echo "Error: VCPKG_ROOT is not set. Please set it to your vcpkg installation directory."
  exit 1
fi

# Install RapidJSON
echo "Ensuring RapidJSON is installed via vcpkg..."
"$VCPKG_ROOT/vcpkg" install rapidjson:wasm32-emscripten
