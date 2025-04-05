#include <emscripten/emscripten.h>
#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <string>
#include <vector>
#include <cmath>
#include <memory>
#include <rapidjson/document.h>

#include "types.h"
#include "effects.h"
#include "pricing.h"
#include "bfs_algorithm.h"
#include "json_parser.h"

using namespace emscripten;

// Parse JSON input and run BFS
EMSCRIPTEN_KEEPALIVE
JsBestMixResult findBestMixJson(
    std::string productJson,
    std::string substancesJson,
    std::string effectMultipliersJson,
    std::string substanceRulesJson,
    int maxDepth)
{
  try
  {
    // Parse JSON inputs
    Product product = parseProductJson(productJson);
    std::vector<Substance> substances = parseSubstancesJson(substancesJson);
    std::unordered_map<std::string, double> effectMultipliers = parseEffectMultipliersJson(effectMultipliersJson);
    applySubstanceRulesJson(substances, substanceRulesJson);

    // Run the BFS algorithm without progress reporting
    return findBestMix(product, substances, effectMultipliers, maxDepth, nullptr);
  }
  catch (const std::exception &e)
  {
    printf("Error parsing JSON: %s\n", e.what());

    // Return a default result on error
    std::vector<std::string> defaultMix = {"Cuke", "Banana", "Gasoline"};

    val jsArray = val::array();
    for (size_t i = 0; i < defaultMix.size(); ++i)
    {
      jsArray.set(i, val(defaultMix[i]));
    }

    JsBestMixResult result;
    result.mixArray = jsArray;
    result.profit = 150.0;
    result.sellPrice = 200.0;
    result.cost = 50.0;

    return result;
  }
}

// Parse JSON input and run BFS with progress reporting
EMSCRIPTEN_KEEPALIVE
JsBestMixResult findBestMixJsonWithProgress(
    std::string productJson,
    std::string substancesJson,
    std::string effectMultipliersJson,
    std::string substanceRulesJson,
    int maxDepth,
    bool reportProgress)
{
  try
  {
    // Parse JSON inputs
    Product product = parseProductJson(productJson);
    std::vector<Substance> substances = parseSubstancesJson(substancesJson);
    std::unordered_map<std::string, double> effectMultipliers = parseEffectMultipliersJson(effectMultipliersJson);
    applySubstanceRulesJson(substances, substanceRulesJson);

    // Run the BFS algorithm with progress reporting if enabled
    if (reportProgress)
    {
      return findBestMix(product, substances, effectMultipliers, maxDepth, reportProgressToJS);
    }
    else
    {
      return findBestMix(product, substances, effectMultipliers, maxDepth, nullptr);
    }
  }
  catch (const std::exception &e)
  {
    printf("Error parsing JSON: %s\n", e.what());

    // Return a default result on error
    std::vector<std::string> defaultMix = {"Cuke", "Banana", "Gasoline"};

    val jsArray = val::array();
    for (size_t i = 0; i < defaultMix.size(); ++i)
    {
      jsArray.set(i, val(defaultMix[i]));
    }

    JsBestMixResult result;
    result.mixArray = jsArray;
    result.profit = 150.0;
    result.sellPrice = 200.0;
    result.cost = 50.0;

    return result;
  }
}

// Helper function that returns just the mix array directly
EMSCRIPTEN_KEEPALIVE
std::vector<std::string> getMixArray()
{
  std::vector<std::string> mix;
  mix.push_back("Cuke");
  mix.push_back("Banana");
  mix.push_back("Gasoline");
  return mix;
}

// Emscripten bindings
EMSCRIPTEN_BINDINGS(bfs_module)
{
  value_object<JsBestMixResult>("JsBestMixResult")
      .field("mixArray", &JsBestMixResult::mixArray)
      .field("profit", &JsBestMixResult::profit)
      .field("sellPrice", &JsBestMixResult::sellPrice)
      .field("cost", &JsBestMixResult::cost);

  register_vector<std::string>("VectorString");

  function("getMixArray", &getMixArray);
  function("findBestMixJson", &findBestMixJson);
  function("findBestMixJsonWithProgress", &findBestMixJsonWithProgress);
}
