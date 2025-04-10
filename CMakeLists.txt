cmake_minimum_required(VERSION 3.10)
project(schedule-I-calculator)

# Enable modern C++ features
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Enable Link-Time Optimization if supported
include(CheckIPOSupported)
check_ipo_supported(RESULT LTO_SUPPORTED OUTPUT LTO_MESSAGE)

if(LTO_SUPPORTED)
  message(STATUS "Link-Time Optimization (LTO) is supported")
  set(CMAKE_INTERPROCEDURAL_OPTIMIZATION_RELEASE ON)
else()
  message(STATUS "Link-Time Optimization not supported: ${LTO_MESSAGE}")
endif()

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
    src/cpp/reporter.cpp
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
  message(STATUS "Building native executable with runtime performance optimizations")

  set(SOURCES
    src/cpp/standalone.cpp
    src/cpp/effects.cpp
    src/cpp/pricing.cpp
    src/cpp/reporter.cpp
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

  # Set runtime performance optimization flags
  if(MSVC)
    target_compile_options(bfs_calculator PRIVATE
      $<$<CONFIG:Release>:/O2>
      $<$<CONFIG:Release>:/Ob3>
      $<$<CONFIG:Release>:/Oi>
      $<$<CONFIG:Release>:/Ot>
      $<$<CONFIG:Release>:/GL>
      $<$<CONFIG:Release>:/Gy>
      $<$<CONFIG:Release>:/fp:fast>
      $<$<CONFIG:Release>:/Qpar>
      $<$<CONFIG:Release>:/Qvec-report:2>
      $<$<CONFIG:Release>:/Qpar-report:2>
      $<$<CONFIG:Release>:/DNDEBUG>
      $<$<CONFIG:Release>:/GF>
      $<$<CONFIG:Release>:/Gw>
      $<$<CONFIG:Release>:/Zc:inline>
      $<$<CONFIG:Release>:/GR->
      $<$<CONFIG:Release>:/EHs- /EHc->
    )

    target_link_options(bfs_calculator PRIVATE
      $<$<CONFIG:Release>:/LTCG>
      $<$<CONFIG:Release>:/INCREMENTAL:NO>
      $<$<CONFIG:Release>:/OPT:REF>
      $<$<CONFIG:Release>:/OPT:ICF>
      $<$<CONFIG:Release>:/DYNAMICBASE>
      $<$<CONFIG:Release>:/HIGHENTROPYVA>
    )

    if(CMAKE_SIZEOF_VOID_P EQUAL 8)
      target_compile_options(bfs_calculator PRIVATE
        $<$<CONFIG:Release>:/favor:blend>
      )
    endif()

  else()
    target_compile_options(bfs_calculator PRIVATE
      $<$<NOT:$<CONFIG:Debug>>:-O3>
      $<$<NOT:$<CONFIG:Debug>>:-march=native>
      $<$<NOT:$<CONFIG:Debug>>:-mtune=native>
      $<$<NOT:$<CONFIG:Debug>>:-flto>
      $<$<NOT:$<CONFIG:Debug>>:-ffast-math>
      $<$<NOT:$<CONFIG:Debug>>:-funroll-loops>
      $<$<NOT:$<CONFIG:Debug>>:-finline-functions>
      $<$<NOT:$<CONFIG:Debug>>:-fomit-frame-pointer>
      $<$<NOT:$<CONFIG:Debug>>:-DNDEBUG>
      $<$<NOT:$<CONFIG:Debug>>:-ftree-vectorize>
      $<$<NOT:$<CONFIG:Debug>>:-fno-exceptions>
      $<$<NOT:$<CONFIG:Debug>>:-fno-rtti>
      $<$<NOT:$<CONFIG:Debug>>:-fvisibility=hidden>
      $<$<NOT:$<CONFIG:Debug>>:-ffunction-sections>
      $<$<NOT:$<CONFIG:Debug>>:-fdata-sections>
      $<$<NOT:$<CONFIG:Debug>>:-fwhole-program>
      $<$<NOT:$<CONFIG:Debug>>:-funsafe-math-optimizations>
    )

    target_link_options(bfs_calculator PRIVATE
      $<$<NOT:$<CONFIG:Debug>>:-flto>
      $<$<NOT:$<CONFIG:Debug>>:-Wl,--gc-sections>
      $<$<NOT:$<CONFIG:Debug>>:-Wl,-O3>
      $<$<NOT:$<CONFIG:Debug>>:-s>
    )
  endif()

  message(STATUS "Build type: ${CMAKE_BUILD_TYPE}")
  message(STATUS "Compiler ID: ${CMAKE_CXX_COMPILER_ID}")
  message(STATUS "Compiler version: ${CMAKE_CXX_COMPILER_VERSION}")
endif()
