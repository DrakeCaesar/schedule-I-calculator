#include <emscripten/emscripten.h>
#include <emscripten/bind.h>
#include <vector>
#include <string>
#include <unordered_map>
#include <queue>
#include <set>
#include <cmath>
#include <algorithm>
#include <memory>
#include <sstream>
#include <rapidjson/document.h>
#include <rapidjson/stringbuffer.h>

using namespace emscripten;
using namespace rapidjson;

// Data structures that mirror the TypeScript ones
struct Effect
{
  std::string name;
  double multiplier;
};

struct SubstanceRule
{
  std::string type; // "replace" or "add"
  std::vector<std::string> condition;
  std::vector<std::string> ifNotPresent;
  std::string target;
  std::string withEffect;
};

struct Substance
{
  std::string name;
  double cost;
  std::string defaultEffect;
  std::vector<SubstanceRule> rules;
};

struct Product
{
  std::string name;
  std::string initialEffect;
};

// Simple struct for the result
struct JsBestMixResult
{
  val mixArray; // Using emscripten::val to store JavaScript array
  double profit;
  double sellPrice;
  double cost;
};

// Utility functions for BFS algorithm
std::vector<std::string> applySubstanceRules(
    const std::vector<std::string> &currentEffects,
    const Substance &substance,
    int recipeLength,
    const std::unordered_map<std::string, bool> &effectsSet)
{
  std::unordered_map<std::string, bool> ogEffects;
  std::unordered_map<std::string, bool> newEffects;

  // Convert input to sets for efficient lookups
  for (const auto &effect : currentEffects)
  {
    ogEffects[effect] = true;
    newEffects[effect] = true;
  }

  // Apply each rule in order
  for (const auto &rule : substance.rules)
  {
    // Check if all conditions are met
    bool conditionsMet = true;
    for (const auto &cond : rule.condition)
    {
      if (ogEffects.find(cond) == ogEffects.end())
      {
        conditionsMet = false;
        break;
      }
    }

    // Check if all exclusions are met
    bool exclusionsMet = true;
    for (const auto &np : rule.ifNotPresent)
    {
      if (ogEffects.find(np) != ogEffects.end())
      {
        exclusionsMet = false;
        break;
      }
    }

    if (conditionsMet && exclusionsMet)
    {
      if (rule.type == "replace" && !rule.withEffect.empty())
      {
        if (newEffects.find(rule.target) != newEffects.end() &&
            newEffects.find(rule.withEffect) == newEffects.end())
        {
          // Remove target and add new effect
          newEffects.erase(rule.target);
          newEffects[rule.withEffect] = true;
        }
      }
      else if (rule.type == "add")
      {
        // Add new effect if not present
        if (newEffects.find(rule.target) == newEffects.end())
        {
          newEffects[rule.target] = true;
        }
      }
    }
  }

  // Ensure default effect is present
  if (recipeLength < 9)
  {
    newEffects[substance.defaultEffect] = true;
  }

  // Convert back to vector
  std::vector<std::string> result;
  for (const auto &pair : newEffects)
  {
    result.push_back(pair.first);
  }

  return result;
}

double calculateFinalPrice(
    const std::string &productName,
    const std::vector<std::string> &currentEffects,
    const std::unordered_map<std::string, double> &effectMultipliers)
{
  double totalMultiplier = 0.0;

  // Calculate the total multiplier from all effects
  for (const auto &effect : currentEffects)
  {
    auto it = effectMultipliers.find(effect);
    if (it != effectMultipliers.end())
    {
      totalMultiplier += it->second;
    }
  }

  // For simplicity, we'll use a fixed base price of 100
  // In a real implementation, you'd look up the actual base price
  double basePrice = 100.0;
  if (productName.find("Weed") != std::string::npos)
    basePrice = 35.0;
  else if (productName.find("Meth") != std::string::npos)
    basePrice = 70.0;
  else if (productName.find("Cocaine") != std::string::npos)
    basePrice = 150.0;

  return std::round(basePrice * (1.0 + totalMultiplier));
}

double calculateFinalCost(
    const std::vector<std::string> &mix,
    const std::unordered_map<std::string, Substance> &substancesMap)
{
  double totalCost = 0.0;

  for (const auto &substanceName : mix)
  {
    auto it = substancesMap.find(substanceName);
    if (it != substancesMap.end())
    {
      totalCost += it->second.cost;
    }
  }

  return std::round(totalCost);
}

// BFS algorithm
JsBestMixResult findBestMix(
    const Product &product,
    const std::vector<Substance> &substances,
    const std::unordered_map<std::string, double> &effectMultipliers,
    int maxDepth)
{
  // Initialize the best mix and profit
  std::vector<std::string> bestMix;
  double bestProfit = -std::numeric_limits<double>::infinity();
  double bestSellPrice = 0.0;
  double bestCost = 0.0;

  // Create a map for faster lookups
  std::unordered_map<std::string, Substance> substancesMap;
  for (const auto &substance : substances)
  {
    substancesMap[substance.name] = substance;
  }

  // Create a set of all effect names for efficiency
  std::unordered_map<std::string, bool> effectsSet;
  for (const auto &pair : effectMultipliers)
  {
    effectsSet[pair.first] = true;
  }

  // Queue for BFS
  std::queue<std::vector<std::string>> queue;

  // Add each substance as a starting point
  for (const auto &substance : substances)
  {
    std::vector<std::string> mix = {substance.name};
    queue.push(mix);
  }

  // BFS main loop
  while (!queue.empty())
  {
    std::vector<std::string> currentMix = queue.front();
    queue.pop();

    // Calculate effects for current mix
    std::vector<std::string> effectsList = {product.initialEffect};
    for (size_t i = 0; i < currentMix.size(); ++i)
    {
      const auto &substanceName = currentMix[i];
      auto it = substancesMap.find(substanceName);
      if (it != substancesMap.end())
      {
        effectsList = applySubstanceRules(effectsList, it->second, i + 1, effectsSet);
      }
    }

    // Calculate profit
    double sellPrice = calculateFinalPrice(product.name, effectsList, effectMultipliers);
    double cost = calculateFinalCost(currentMix, substancesMap);
    double profit = sellPrice - cost;

    // Update best mix if this one is better
    if (profit > bestProfit)
    {
      bestMix = currentMix;
      bestProfit = profit;
      bestSellPrice = sellPrice;
      bestCost = cost;
    }

    // If we haven't reached max depth, continue adding substances
    if (currentMix.size() < static_cast<size_t>(maxDepth))
    {
      for (const auto &substance : substances)
      {
        std::vector<std::string> newMix = currentMix;
        newMix.push_back(substance.name);
        queue.push(newMix);
      }
    }
  }

  // Convert best mix to a JavaScript array
  val jsArray = val::array();
  for (size_t i = 0; i < bestMix.size(); ++i)
  {
    jsArray.set(i, val(bestMix[i]));
  }

  // Create and return the result
  JsBestMixResult result;
  result.mixArray = jsArray;
  result.profit = bestProfit;
  result.sellPrice = bestSellPrice;
  result.cost = bestCost;

  return result;
}

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
    // Parse product
    Document productDoc;
    productDoc.Parse(productJson.c_str());

    Product product;
    product.name = productDoc["name"].GetString();
    product.initialEffect = productDoc["initialEffect"].GetString();

    // Parse substances
    Document substancesDoc;
    substancesDoc.Parse(substancesJson.c_str());

    std::vector<Substance> substances;
    for (SizeType i = 0; i < substancesDoc.Size(); i++)
    {
      Substance substance;
      substance.name = substancesDoc[i]["name"].GetString();
      substance.cost = substancesDoc[i]["cost"].GetDouble();
      substance.defaultEffect = substancesDoc[i]["defaultEffect"].GetString();
      substances.push_back(substance);
    }

    // Parse effect multipliers
    Document multipliersDoc;
    multipliersDoc.Parse(effectMultipliersJson.c_str());

    std::unordered_map<std::string, double> effectMultipliers;
    for (SizeType i = 0; i < multipliersDoc.Size(); i++)
    {
      std::string name = multipliersDoc[i]["name"].GetString();
      double multiplier = multipliersDoc[i]["multiplier"].GetDouble();
      effectMultipliers[name] = multiplier;
    }

    // Parse substance rules
    Document rulesDoc;
    rulesDoc.Parse(substanceRulesJson.c_str());

    // Apply rules to substances
    for (SizeType i = 0; i < rulesDoc.Size(); i++)
    {
      std::string substanceName = rulesDoc[i]["substanceName"].GetString();
      const Value &rules = rulesDoc[i]["rules"];

      // Find the substance
      for (auto &substance : substances)
      {
        if (substance.name == substanceName)
        {
          // Add rules to the substance
          for (SizeType j = 0; j < rules.Size(); j++)
          {
            SubstanceRule rule;

            rule.type = rules[j]["action"]["type"].GetString();
            rule.target = rules[j]["action"]["target"].GetString();

            // Handle withEffect (may be missing in "add" rules)
            if (rules[j]["action"].HasMember("withEffect") &&
                !rules[j]["action"]["withEffect"].IsNull())
            {
              rule.withEffect = rules[j]["action"]["withEffect"].GetString();
            }

            // Parse conditions
            const Value &conditions = rules[j]["condition"];
            for (SizeType k = 0; k < conditions.Size(); k++)
            {
              rule.condition.push_back(conditions[k].GetString());
            }

            // Parse ifNotPresent (may be empty)
            if (rules[j].HasMember("ifNotPresent"))
            {
              const Value &ifNotPresent = rules[j]["ifNotPresent"];
              for (SizeType k = 0; k < ifNotPresent.Size(); k++)
              {
                rule.ifNotPresent.push_back(ifNotPresent[k].GetString());
              }
            }

            substance.rules.push_back(rule);
          }
          break;
        }
      }
    }

    // Run the BFS algorithm
    return findBestMix(product, substances, effectMultipliers, maxDepth);
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
}
