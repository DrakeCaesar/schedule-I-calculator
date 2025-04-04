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

// Create a JS-friendly version of the result
struct JsBestMixResult {
  val mixArray; // Using emscripten::val to store JavaScript array
  double profit;
  double sellPrice;
  double cost;
};

// Simplified function that takes JSON strings for complex data and returns JS-friendly result
EMSCRIPTEN_KEEPALIVE
JsBestMixResult findBestMixJson(
    std::string productJson,
    std::string substancesJson,
    std::string effectMultipliersJson,
    std::string substanceRulesJson,
    int maxDepth)
{
  // Parse JSON strings (simplified example)
  // In a real implementation you would use a JSON parsing library
  // For this example, we'll just return a dummy result

  // Create a regular C++ vector
  std::vector<std::string> mixArray;
  mixArray.push_back("Cuke");
  mixArray.push_back("Banana");
  mixArray.push_back("Gasoline");

  // Convert C++ vector to JavaScript array using emscripten::val
  val jsArray = val::array();
  for (size_t i = 0; i < mixArray.size(); ++i) {
    jsArray.set(i, val(mixArray[i]));
  }

  // Create and return the JS-friendly result
  JsBestMixResult result;
  result.mixArray = jsArray;
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
      
  value_object<JsBestMixResult>("JsBestMixResult")
      .field("mixArray", &JsBestMixResult::mixArray)
      .field("profit", &JsBestMixResult::profit)
      .field("sellPrice", &JsBestMixResult::sellPrice)
      .field("cost", &JsBestMixResult::cost);

  register_vector<std::string>("VectorString");

  // Add direct access to the mix array function
  function("getMixArray", &getMixArray);
  function("findBestMixJson", &findBestMixJson);
}
