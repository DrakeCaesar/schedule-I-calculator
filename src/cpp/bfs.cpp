#include <string>
#include <vector>
#include <cmath>
#include <memory>

#include "types.h"
#include "effects.h"
#include "pricing.h"
#include "bfs_algorithm.h"
#include "reporter.h"
#include "json_parser.h"

// Include Emscripten headers only when building for WebAssembly
#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#include <emscripten/bind.h>
#include <emscripten/val.h>
using namespace emscripten;
#endif

// Parse JSON input and run BFS
#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
JsBestMixResult findBestMixJson(
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

  // Run the BFS algorithm without progress reporting
  return findBestMix(product, substances, effectMultipliers, maxDepth, nullptr);
}

// Parse JSON input and run BFS with progress reporting
#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
JsBestMixResult findBestMixJsonWithProgress(
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

  // Run the BFS algorithm with progress reporting if enabled
#ifdef __EMSCRIPTEN__
  if (reportProgress)
  {
    return findBestMix(product, substances, effectMultipliers, maxDepth, reportProgressToJS);
  }
  else
#else
  // In native mode, use the reportProgressToConsole function defined in standalone.cpp
  extern void reportProgressToConsole(int depth, int processed, int total);
  if (reportProgress)
  {
    return findBestMix(product, substances, effectMultipliers, maxDepth, reportProgressToConsole);
  }
  else
#endif
  {
    return findBestMix(product, substances, effectMultipliers, maxDepth, nullptr);
  }
}

// Helper function that returns just the mix array directly
#ifdef __EMSCRIPTEN__
EMSCRIPTEN_KEEPALIVE
#endif
std::vector<std::string> getMixArray()
{
  std::vector<std::string> mix;
  mix.push_back("Cuke");
  mix.push_back("Banana");
  mix.push_back("Gasoline");
  return mix;
}

// Emscripten bindings - only include in WebAssembly build
#ifdef __EMSCRIPTEN__
EMSCRIPTEN_BINDINGS(bfs_module)
{
  value_object<JsBestMixResult>("JsBestMixResult")
      .field("mixArray", &JsBestMixResult::mixArray)
      // Include both cents-based integer and dollar-based double fields
      .field("profitCents", &JsBestMixResult::profitCents)
      .field("sellPriceCents", &JsBestMixResult::sellPriceCents)
      .field("costCents", &JsBestMixResult::costCents)
      // Keep the legacy dollar-based fields for backward compatibility
      .field("profit", &JsBestMixResult::profit)
      .field("sellPrice", &JsBestMixResult::sellPrice)
      .field("cost", &JsBestMixResult::cost);

  register_vector<std::string>("VectorString");

  function("getMixArray", &getMixArray);
  function("findBestMixJson", &findBestMixJson);
  function("findBestMixJsonWithProgress", &findBestMixJsonWithProgress);
}
#endif
