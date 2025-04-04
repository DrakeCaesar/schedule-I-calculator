#include <emscripten/emscripten.h>
#include <emscripten/bind.h>
#include <vector>
#include <string>
#include <unordered_map>
#include <cmath>
#include <algorithm>
#include <memory>

using namespace emscripten;

// Structs to mirror TypeScript interfaces
struct Effect
{
  std::string name;
  double multiplier;
};

struct ProductVariety
{
  std::string name;
  std::string initialEffect;
};

struct Substance
{
  std::string name;
  int cost;
  std::string defaultEffect;
  // Rules are complex to pass directly, so we'll pass them as serialized JSON
};

struct RuleAction
{
  std::string type;
  std::string target;
  std::string withEffect;
};

struct Rule
{
  std::vector<std::string> condition;
  std::vector<std::string> ifNotPresent;
  RuleAction action;
};

struct BestMixResult
{
  std::vector<std::string> mix;
  double profit;
  double sellPrice;
  double cost;
};

// Core BFS function to find the best mix
EMSCRIPTEN_KEEPALIVE
BestMixResult findBestMix(
    ProductVariety product,
    const std::vector<Substance> &substances,
    const std::unordered_map<std::string, double> &effectMultipliers,
    const std::unordered_map<std::string, std::vector<Rule>> &substanceRules,
    int maxDepth)
{

  BestMixResult bestResult;
  bestResult.profit = -1000.0; // Initialize with negative profit

  // Stack-based DFS implementation (more efficient in C++)
  struct SearchNode
  {
    std::vector<std::string> mix;
    std::vector<std::string> effects;
    int depth;
  };

  // Start with initial product effect
  std::vector<SearchNode> stack;
  stack.push_back({
      {},                      // Empty mix
      {product.initialEffect}, // Start with product's initial effect
      0                        // Depth 0
  });

  int combinationsProcessed = 0;

  while (!stack.empty())
  {
    SearchNode current = stack.back();
    stack.pop_back();
    combinationsProcessed++;

    // If we've reached max depth, just evaluate this mix
    if (current.depth == maxDepth)
    {
      // Calculate profit for this mix
      double cost = 0.0;
      for (const auto &substanceName : current.mix)
      {
        for (const auto &substance : substances)
        {
          if (substance.name == substanceName)
          {
            cost += substance.cost;
            break;
          }
        }
      }

      // Calculate sell price based on effects
      double totalMultiplier = 0.0;
      for (const auto &effectName : current.effects)
      {
        auto it = effectMultipliers.find(effectName);
        if (it != effectMultipliers.end())
        {
          totalMultiplier += it->second;
        }
      }

      // Find base price for product
      double basePrice = 35.0; // Default value (e.g., for Weed)
      if (product.name == "Cocaine")
        basePrice = 150.0;
      else if (product.name == "Meth")
        basePrice = 70.0;

      double sellPrice = std::round(basePrice * (1.0 + totalMultiplier));
      double profit = sellPrice - cost;

      // Update best result if this is better
      if (profit > bestResult.profit)
      {
        bestResult.mix = current.mix;
        bestResult.profit = profit;
        bestResult.sellPrice = sellPrice;
        bestResult.cost = cost;
      }

      continue; // No need to explore further from this node
    }

    // Try adding each substance to the mix
    for (const auto &substance : substances)
    {
      // Create a new mix with this substance added
      std::vector<std::string> newMix = current.mix;
      newMix.push_back(substance.name);

      // Apply substance rules to get new effects
      std::vector<std::string> newEffects = current.effects;

      // Apply rules for this substance
      auto rulesIt = substanceRules.find(substance.name);
      if (rulesIt != substanceRules.end())
      {
        const auto &rules = rulesIt->second;

        // Convert effects to a set for faster lookup
        std::unordered_map<std::string, bool> effectsSet;
        for (const auto &effect : newEffects)
        {
          effectsSet[effect] = true;
        }

        // Apply each rule
        for (const auto &rule : rules)
        {
          // Check if all conditions are met
          bool conditionsMet = true;
          for (const auto &cond : rule.condition)
          {
            if (!effectsSet[cond])
            {
              conditionsMet = false;
              break;
            }
          }

          // Check if all excluded effects are absent
          bool exclusionsMet = true;
          for (const auto &excluded : rule.ifNotPresent)
          {
            if (effectsSet[excluded])
            {
              exclusionsMet = false;
              break;
            }
          }

          if (conditionsMet && exclusionsMet)
          {
            if (rule.action.type == "replace" && !rule.action.withEffect.empty())
            {
              if (effectsSet[rule.action.target] && !effectsSet[rule.action.withEffect])
              {
                // Remove target effect
                effectsSet[rule.action.target] = false;

                // Add new effect
                effectsSet[rule.action.withEffect] = true;
              }
            }
            else if (rule.action.type == "add")
            {
              if (!effectsSet[rule.action.target])
              {
                effectsSet[rule.action.target] = true;
              }
            }
          }
        }

        // Add default effect if not at max recipe length
        if (newMix.size() < 9)
        {
          effectsSet[substance.defaultEffect] = true;
        }

        // Convert the set back to an array
        newEffects.clear();
        for (const auto &pair : effectsSet)
        {
          if (pair.second)
          {
            newEffects.push_back(pair.first);
          }
        }
      }

      // Add this new state to the stack for further exploration
      stack.push_back({newMix,
                       newEffects,
                       current.depth + 1});
    }
  }

  return bestResult;
}

// Emscripten bindings to expose the function to JavaScript
EMSCRIPTEN_BINDINGS(bfs_module)
{
  value_object<ProductVariety>("ProductVariety")
      .field("name", &ProductVariety::name)
      .field("initialEffect", &ProductVariety::initialEffect);

  value_object<Substance>("Substance")
      .field("name", &Substance::name)
      .field("cost", &Substance::cost)
      .field("defaultEffect", &Substance::defaultEffect);

  value_object<Effect>("Effect")
      .field("name", &Effect::name)
      .field("multiplier", &Effect::multiplier);

  value_object<BestMixResult>("BestMixResult")
      .field("mix", &BestMixResult::mix)
      .field("profit", &BestMixResult::profit)
      .field("sellPrice", &BestMixResult::sellPrice)
      .field("cost", &BestMixResult::cost);

  value_object<RuleAction>("RuleAction")
      .field("type", &RuleAction::type)
      .field("target", &RuleAction::target)
      .field("withEffect", &RuleAction::withEffect);

  value_object<Rule>("Rule")
      .field("condition", &Rule::condition)
      .field("ifNotPresent", &Rule::ifNotPresent)
      .field("action", &Rule::action);

  register_vector<std::string>("VectorString");
  register_vector<Substance>("VectorSubstance");
  register_vector<Rule>("VectorRule");

  register_map<std::string, double>("MapStringDouble");
  register_map<std::string, std::vector<Rule>>("MapStringVectorRule");

  function("findBestMix", &findBestMix);
}
