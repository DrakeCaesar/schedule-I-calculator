@echo off
REM Build Script for compiling the BFS algorithm to WebAssembly with Emscripten

REM Check if Emscripten is available
where emcc >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo Emscripten compiler not found. Make sure you have activated the Emscripten environment.
  echo You may need to run 'emsdk_env.bat' first.
  exit /b 1
)

REM Check if VCPKG_ROOT is set
if not defined VCPKG_ROOT (
  echo VCPKG_ROOT environment variable is not set. Please set it to your vcpkg installation directory.
  exit /b 1
)

REM Install RapidJSON if not already installed
echo Installing RapidJSON from vcpkg...
"%VCPKG_ROOT%\vcpkg" install rapidjson:wasm32-emscripten

REM Create output directories if they don't exist
if not exist "src\cpp" mkdir "src\cpp"

REM Compile the WebAssembly module
echo Compiling bfs.cpp to WebAssembly...
emcc src/cpp/bfs.cpp -o src/cpp/bfs.wasm.js ^
  -s WASM=1 ^
  -s ALLOW_MEMORY_GROWTH=1 ^
  -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap'] ^
  -s EXPORT_ES6=1 ^
  -s EXPORT_NAME=createBfsModule ^
  -s USE_ES6_IMPORT_META=0 ^
  -s ENVIRONMENT=web ^
  -s TOTAL_MEMORY=67108864 ^
  -s ASSERTIONS=2 ^
  -I "%VCPKG_ROOT%\installed\wasm32-emscripten\include" ^
  -O3 ^
  --bind ^
  --no-entry

if %ERRORLEVEL% NEQ 0 (
  echo Failed to compile WebAssembly module.
  exit /b 1
)

echo Successfully compiled bfs.cpp to WebAssembly!
echo Output files:
echo - src\cpp\bfs.wasm.js
echo - src\cpp\bfs.wasm
echo Done.
