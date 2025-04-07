cmake_minimum_required(VERSION 3.10)
project(schedule-I-calculator)

# Use vcpkg toolchain file if not already set
if(NOT DEFINED CMAKE_TOOLCHAIN_FILE)
    set(CMAKE_TOOLCHAIN_FILE "$ENV{VCPKG_ROOT}/scripts/buildsystems/vcpkg.cmake"
        CACHE STRING "Vcpkg toolchain file")
endif()

# Always use nlohmann_json
find_package(nlohmann_json CONFIG REQUIRED)
message(STATUS "Using nlohmann_json for JSON parsing")

# Check if we're building for WebAssembly
if(EMSCRIPTEN)
    # WebAssembly build
    message(STATUS "Building for WebAssembly")

    set(SOURCES
        src/cpp/bfs.cpp
        src/cpp/dfs.cpp
        src/cpp/effects.cpp
        src/cpp/pricing.cpp
        src/cpp/bfs_algorithm.cpp
        src/cpp/dfs_algorithm.cpp
        src/cpp/json_parser.cpp
    )

    add_executable(bfs_wasm ${SOURCES})

    # Link with nlohmann_json
    target_link_libraries(bfs_wasm PRIVATE nlohmann_json::nlohmann_json)

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
else()
    # Native build
    message(STATUS "Building native executable")

    set(SOURCES
        src/cpp/standalone.cpp
        src/cpp/effects.cpp
        src/cpp/pricing.cpp
        src/cpp/bfs_algorithm.cpp
        src/cpp/dfs_algorithm.cpp
        src/cpp/dfs.cpp
        src/cpp/json_parser.cpp
    )

    add_executable(bfs_calculator ${SOURCES})

    # Link with nlohmann_json
    target_link_libraries(bfs_calculator PRIVATE nlohmann_json::nlohmann_json)

    # Find and link with threading library
    find_package(Threads REQUIRED)
    target_link_libraries(bfs_calculator PRIVATE Threads::Threads)

    # Set optimization flags for native build - fixed for MSVC compatibility
    if(MSVC)
        # Only apply optimizations for Release builds to avoid conflict with runtime checks
        string(REPLACE "/RTC1" "" CMAKE_CXX_FLAGS_DEBUG "${CMAKE_CXX_FLAGS_DEBUG}")

        # Apply optimizations in Release mode
        target_compile_options(bfs_calculator PRIVATE
            $<$<CONFIG:Release>:/O2>
            $<$<CONFIG:Debug>:/Od>
        )
    else()
        # Non-MSVC compilers
        target_compile_options(bfs_calculator PRIVATE
            $<$<NOT:$<CONFIG:Debug>>:-O3>
            $<$<CONFIG:Debug>:-O0 -g>
        )
    endif()
endif()
