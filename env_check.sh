#!/bin/bash
# Shared environment setup and checks for Emscripten and vcpkg

set -e

# Check if we're running in CI environment
if [ "${CI:-}" != "true" ]; then
  # Load Emscripten environment for local development
  EMSDK_PATH=~/dev/emsdk
  if [ -f "$EMSDK_PATH/emsdk_env.sh" ]; then
    source $EMSDK_PATH/emsdk_env.sh
  else
    echo "Warning: Emscripten SDK not found at $EMSDK_PATH"
    echo "If you've installed it elsewhere, please set EMSDK environment variable."
  fi
else
  echo "Running in CI environment, using pre-configured Emscripten"
fi

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

# Only run vcpkg updates in local development, not in CI
if [ "${CI:-}" != "true" ]; then
  # Update vcpkg
  # echo "Updating vcpkg..."
  # git -C "$VCPKG_ROOT" pull

  # Re-run bootstrap
  # echo "Running bootstrap for vcpkg..."
  # "$VCPKG_ROOT/bootstrap-vcpkg.sh"

  # Run integrate install
  # echo "Running vcpkg integrate install..."
  # "$VCPKG_ROOT/vcpkg" integrate install

  echo "Skipping vcpkg update and bootstrap in CI environment."
fi

# Display environment info for debugging
echo "Environment information:"
echo "- Emscripten version: $(emcc --version | head -n 1)"
echo "- VCPKG_ROOT: $VCPKG_ROOT"
echo "- EMSDK: ${EMSDK:-Not set explicitly}"
