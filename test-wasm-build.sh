#!/bin/bash
# Test script for validating WASM build in GitHub Actions

echo "Testing WASM build process for GitHub Actions workflow"
echo "======================================================"

# Check if env_check.sh exists and make it executable
if [ -f "env_check.sh" ]; then
  chmod +x env_check.sh
  echo "✅ env_check.sh exists"
else
  echo "❌ env_check.sh is missing"
  exit 1
fi

# Check if build.sh exists and make it executable
if [ -f "build.sh" ]; then
  chmod +x build.sh
  echo "✅ build.sh exists"
else
  echo "❌ build.sh is missing"
  exit 1
fi

# Check for Emscripten
if command -v emcc &> /dev/null; then
  EMCC_VERSION=$(emcc --version | head -n 1)
  echo "✅ Emscripten is installed: $EMCC_VERSION"
else
  echo "❌ Emscripten (emcc) is not installed or not in PATH"
  exit 1
fi

# Check for vcpkg
if [ -z "$VCPKG_ROOT" ]; then
  echo "❌ VCPKG_ROOT is not set"
  exit 1
else
  echo "✅ VCPKG_ROOT is set to: $VCPKG_ROOT"
fi

# Check if the source files exist
CPP_FILES=("src/cpp/bfs.cpp" "src/cpp/effects.cpp" "src/cpp/pricing.cpp" "src/cpp/bfs_algorithm.cpp" "src/cpp/json_parser.cpp")
MISSING_FILES=0

echo "Checking for required C++ source files:"
for file in "${CPP_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file exists"
  else
    echo "  ❌ $file is missing"
    MISSING_FILES=1
  fi
done

if [ $MISSING_FILES -eq 1 ]; then
  echo "❌ Some required source files are missing"
  exit 1
fi

echo "======================================================"
echo "All checks passed. The build process should work correctly in GitHub Actions."
echo "To perform an actual test build, run: ./build.sh --debug"