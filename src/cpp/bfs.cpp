#include <emscripten/emscripten.h>
#include <emscripten/bind.h>
#include <vector>
#include <string>
#include <unordered_map>
#include <cmath>
#include <algorithm>
#include <memory>

using namespace emscripten;

// Simple struct for the result
struct BestMixResult
{
  std::vector<std::string> mix;
  double profit;
  double sellPrice;
  double cost;
};

// Add a helper function that returns just the mix array directly
// This avoids the ClassHandle issue
EMSCRIPTEN_KEEPALIVE
std::vector<std::string> getMixArray()
{
  std::vector<std::string> mix;
  mix.push_back("Cuke");
  mix.push_back("Banana");
  mix.push_back("Gasoline");
  return mix;
}

// Simplified function that takes JSON strings for complex data
EMSCRIPTEN_KEEPALIVE
BestMixResult findBestMixJson(
    std::string productJson,
    std::string substancesJson,
    std::string effectMultipliersJson,
    std::string substanceRulesJson,
    int maxDepth)
{
  // Parse JSON strings (simplified example)
  // In a real implementation you would use a JSON parsing library
  // For this example, we'll just return a dummy result

  BestMixResult result;
  // Create a vector that will properly bind to JavaScript Array
  std::vector<std::string> mixArray;
  mixArray.push_back("Cuke");
  mixArray.push_back("Banana");
  mixArray.push_back("Gasoline");

  result.mix = mixArray;
  result.profit = 150.0;
  result.sellPrice = 200.0;
  result.cost = 50.0;

  return result;
}

// Emscripten bindings for the simplified function
EMSCRIPTEN_BINDINGS(bfs_module)
{
  value_object<BestMixResult>("BestMixResult")
      .field("mix", &BestMixResult::mix)
      .field("profit", &BestMixResult::profit)
      .field("sellPrice", &BestMixResult::sellPrice)
      .field("cost", &BestMixResult::cost);

  register_vector<std::string>("VectorString");

  // Add direct access to the mix array function
  function("getMixArray", &getMixArray);
  function("findBestMixJson", &findBestMixJson);
}
