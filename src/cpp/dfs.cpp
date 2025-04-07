#include <string>
#include <vector>
#include <cmath>
#include <memory>

#include "types.h"
#include "effects.h"
#include "pricing.h"
#include "dfs_algorithm.h"
#include "json_parser.h"

// Include Emscripten headers only when building for WebAssembly
#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#include <emscripten/bind.h>
#include <emscripten/val.h>
using namespace emscripten;
#endif

// Parse JSON input and run DFS
#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
JsBestMixResult findBestMixDFSJson(
    std::string productJson,
    std::string substancesJson,
    std::string effectMultipliersJson,
    std::string substanceRulesJson,
    int maxDepth)
{
  // Parse JSON inputs
  Product product = parseProductJson(productJson);
  std::vector<Substance> substances = parseSubstancesJson(substancesJson);
  std::unordered_map<std::string, int> effectMultipliers = parseEffectMultipliersJson(effectMultipliersJson);
  applySubstanceRulesJson(substances, substanceRulesJson);

  // Run the DFS algorithm without progress reporting
  return findBestMixDFS(product, substances, effectMultipliers, maxDepth, nullptr);
}

// Parse JSON input and run DFS with progress reporting
#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
JsBestMixResult findBestMixDFSJsonWithProgress(
    std::string productJson,
    std::string substancesJson,
    std::string effectMultipliersJson,
    std::string substanceRulesJson,
    int maxDepth,
    bool reportProgress)
{
  Product product = parseProductJson(productJson);
  std::vector<Substance> substances = parseSubstancesJson(substancesJson);
  std::unordered_map<std::string, int> effectMultipliers = parseEffectMultipliersJson(effectMultipliersJson);
  applySubstanceRulesJson(substances, substanceRulesJson);

  // Function pointer for progress reporting in console mode
  extern void reportProgressToConsole(int depth, int processed, int total);

  // Run the DFS algorithm with progress reporting if enabled
#ifdef __EMSCRIPTEN__
  if (reportProgress)
  {
    // Use the WebAssembly-specific progress reporting function
    return findBestMixDFS(product, substances, effectMultipliers, maxDepth, reportProgressToDfsJS);
  }
  else
#else
  if (reportProgress)
  {
    return findBestMixDFS(product, substances, effectMultipliers, maxDepth, reportProgressToConsole);
  }
  else
#endif
  {
    return findBestMixDFS(product, substances, effectMultipliers, maxDepth, nullptr);
  }
}

// Emscripten bindings - only include in WebAssembly build
#ifdef __EMSCRIPTEN__
EMSCRIPTEN_BINDINGS(dfs_module)
{
  // Reuse the JsBestMixResult binding from BFS module
  function("findBestMixDFSJson", &findBestMixDFSJson);
  function("findBestMixDFSJsonWithProgress", &findBestMixDFSJsonWithProgress);
}
#endif