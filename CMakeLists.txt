cmake_minimum_required(VERSION 3.10)
project(schedule-I-calculator)

# Use vcpkg toolchain file if not already set
if(NOT DEFINED CMAKE_TOOLCHAIN_FILE)
    set(CMAKE_TOOLCHAIN_FILE "$ENV{VCPKG_ROOT}/scripts/buildsystems/vcpkg.cmake"
        CACHE STRING "Vcpkg toolchain file")
endif()

# Find RapidJSON
find_package(RapidJSON CONFIG REQUIRED)

set(SOURCES src/cpp/bfs.cpp)
add_executable(bfs_wasm ${SOURCES})

# Include RapidJSON headers
target_include_directories(bfs_wasm PRIVATE ${RAPIDJSON_INCLUDE_DIRS})

# Emscripten specific settings
set(EMSCRIPTEN_LINK_FLAGS
    "-s WASM=1 \
     -s ALLOW_MEMORY_GROWTH=1 \
     -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap'] \
     -s EXPORT_ES6=1 \
     -s EXPORT_NAME=createBfsModule \
     -s USE_ES6_IMPORT_META=0 \
     -s ENVIRONMENT=web \
     -O3 \
     --bind")

set_target_properties(bfs_wasm PROPERTIES
    LINK_FLAGS "${EMSCRIPTEN_LINK_FLAGS}"
    OUTPUT_NAME "bfs.wasm"
    SUFFIX ".js")
