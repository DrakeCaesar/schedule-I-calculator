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
    # MSVC runtime optimizations
    target_compile_options(bfs_calculator PRIVATE

      # Release mode flags
      $<$<CONFIG:Release>:/O2> # Full optimization
      $<$<CONFIG:Release>:/Ob3> # Aggressive inlining
      $<$<CONFIG:Release>:/Oi> # Enable intrinsic functions
      $<$<CONFIG:Release>:/Ot> # Favor speed over size
      $<$<CONFIG:Release>:/GL> # Whole program optimization
      $<$<CONFIG:Release>:/Gy> # Function-level linking
      $<$<CONFIG:Release>:/fp:fast> # Fast floating-point model
      $<$<CONFIG:Release>:/Qpar> # Auto-parallelization
      $<$<CONFIG:Release>:/Qvec-report:2> # Vector report level
      $<$<CONFIG:Release>:/Qpar-report:2> # Parallelization report
      $<$<CONFIG:Release>:/DNDEBUG> # Define NDEBUG
    )

    # Enhanced linker options for performance
    target_link_options(bfs_calculator PRIVATE
      $<$<CONFIG:Release>:/LTCG> # Link-time code generation
      $<$<CONFIG:Release>:/INCREMENTAL:NO> # Disable incremental linking
      $<$<CONFIG:Release>:/OPT:REF> # Eliminate unreferenced data
      $<$<CONFIG:Release>:/OPT:ICF> # Identical COMDAT folding
      $<$<CONFIG:Release>:/DYNAMICBASE:NO> # Disable ASLR for perf (security trade-off)
      $<$<CONFIG:Release>:/HIGHENTROPYVA:NO> # Disable high entropy ASLR
    )

    # Processor-specific optimizations - automatically select best instruction set
    if(CMAKE_SIZEOF_VOID_P EQUAL 8) # 64-bit
      target_compile_options(bfs_calculator PRIVATE
        $<$<CONFIG:Release>:/favor:blend> # Optimize for latest AMD/Intel

        # Uncomment specific instruction set if you know your target platform
        # $<$<CONFIG:Release>:/arch:AVX2>  # Use AVX2 instructions
        # $<$<CONFIG:Release>:/arch:AVX>   # Use AVX instructions
      )
    endif()
  else()
    # GCC/Clang runtime optimizations
    target_compile_options(bfs_calculator PRIVATE

      # Release mode flags
      $<$<NOT:$<CONFIG:Debug>>:-O3> # Full optimization
      $<$<NOT:$<CONFIG:Debug>>:-march=native> # Optimize for this machine
      $<$<NOT:$<CONFIG:Debug>>:-mtune=native> # Tune for this machine
      $<$<NOT:$<CONFIG:Debug>>:-flto> # Link-time optimization
      $<$<NOT:$<CONFIG:Debug>>:-ffast-math> # Fast math operations
      $<$<NOT:$<CONFIG:Debug>>:-funroll-loops> # Unroll loops
      $<$<NOT:$<CONFIG:Debug>>:-finline-functions> # Inline eligible functions
      $<$<NOT:$<CONFIG:Debug>>:-fomit-frame-pointer> # Omit frame pointer when possible
      $<$<NOT:$<CONFIG:Debug>>:-DNDEBUG> # Define NDEBUG

      # Enable auto-vectorization and provide feedback
      $<$<NOT:$<CONFIG:Debug>>:-ftree-vectorize>

      # $<$<NOT:$<CONFIG:Debug>>:-fopt-info-vec-optimized>

      # Profile-guided optimization if available
      # First build: -fprofile-generate
      # Then run, then rebuild with: -fprofile-use
      # $<$<NOT:$<CONFIG:Debug>>:-fprofile-use>
    )

    # Enhanced linker options for runtime performance
    target_link_options(bfs_calculator PRIVATE
      $<$<NOT:$<CONFIG:Debug>>:-flto> # Link-time optimization
      $<$<NOT:$<CONFIG:Debug>>:-Wl,--gc-sections> # Garbage collect unused sections
      $<$<NOT:$<CONFIG:Debug>>:-Wl,-O3> # Linker optimizations
    )
  endif()

  # Print optimization summary
  message(STATUS "Build type: ${CMAKE_BUILD_TYPE}")
  message(STATUS "Compiler ID: ${CMAKE_CXX_COMPILER_ID}")
  message(STATUS "Compiler version: ${CMAKE_CXX_COMPILER_VERSION}")
endif()
