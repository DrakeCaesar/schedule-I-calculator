cmake_minimum_required(VERSION 3.10)
project(BfsCalculator)

set(CMAKE_CXX_STANDARD 14)

# Source files
set(SOURCES
  effects.cpp
  pricing.cpp
  bfs_algorithm.cpp
  json_parser.cpp
)

# Header files
set(HEADERS
  types.h
  effects.h
  pricing.h
  bfs_algorithm.h
  json_parser.h
)

# Check if we're building for WebAssembly
if(EMSCRIPTEN)
  # WebAssembly build
  message(STATUS "Building for WebAssembly")
  set(WASM_SOURCES ${SOURCES} bfs.cpp)

  # Set Emscripten compiler flags
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -s WASM=1 -s ALLOW_MEMORY_GROWTH=1 -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap'] -s EXPORT_ES6=1 -s EXPORT_NAME=createBfsModule -s ENVIRONMENT=web -s TOTAL_MEMORY=67108864 -s ASSERTIONS=2 -O3 --bind --no-entry")

  # Include directories for RapidJSON
  include_directories("${VCPKG_ROOT}/installed/wasm32-emscripten/include")

  # Create WebAssembly executable
  add_executable(bfs ${WASM_SOURCES} ${HEADERS})

  # Install built WASM module
  install(TARGETS bfs DESTINATION .)
else()
  # Native build
  message(STATUS "Building native executable")
  set(NATIVE_SOURCES ${SOURCES} standalone.cpp)

  # Set optimization flags for native build
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -O3")

  # Find RapidJSON - adjust paths as needed for your environment
  if(DEFINED ENV{VCPKG_ROOT})
    include_directories("$ENV{VCPKG_ROOT}/installed/x64-windows/include")
  else()
    # Fallback to system include directories
    include_directories("/usr/include" "/usr/local/include")
  endif()

  # Create native executable
  add_executable(bfs_calculator ${NATIVE_SOURCES} ${HEADERS})

  # Install native executable
  install(TARGETS bfs_calculator DESTINATION bin)
endif()
