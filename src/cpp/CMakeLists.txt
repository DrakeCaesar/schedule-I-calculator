cmake_minimum_required(VERSION 3.10)
project(BfsCalculator)

set(CMAKE_CXX_STANDARD 14)

# Source files
set(SOURCES
  bfs.cpp
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

# Set Emscripten compiler flags
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -s WASM=1 -s ALLOW_MEMORY_GROWTH=1 -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap'] -s EXPORT_ES6=1 -s EXPORT_NAME=createBfsModule -s ENVIRONMENT=web -s TOTAL_MEMORY=67108864 -s ASSERTIONS=2 -O3 --bind --no-entry")

# Include directories for RapidJSON
include_directories("${VCPKG_ROOT}/installed/wasm32-emscripten/include")

# Create executable
add_executable(bfs ${SOURCES} ${HEADERS})

# Install built WASM module
install(TARGETS bfs DESTINATION .)
