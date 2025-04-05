#include "json_parser.h"
#include <nlohmann/json.hpp>

using json = nlohmann::json;

// Parse product from JSON
Product parseProductJson(const std::string &productJson)
{
  Product product;
  json doc = json::parse(productJson);
  product.name = doc["name"].get<std::string>();
  product.initialEffect = doc["initialEffect"].get<std::string>();
  return product;
}

// Parse substances from JSON
std::vector<Substance> parseSubstancesJson(const std::string &substancesJson)
{
  std::vector<Substance> substances;
  json doc = json::parse(substancesJson);
  substances.reserve(doc.size()); // Pre-allocate memory

  for (const auto &item : doc)
  {
    Substance substance;
    substance.name = item["name"].get<std::string>();
    substance.cost = item["cost"].get<double>();
    substance.defaultEffect = item["defaultEffect"].get<std::string>();
    substances.push_back(substance);
  }

  return substances;
}

// Parse effect multipliers from JSON - using pure integers (multiplied by 100)
std::unordered_map<std::string, int> parseEffectMultipliersJson(const std::string &effectMultipliersJson)
{
  std::unordered_map<std::string, int> effectMultipliers;
  json doc = json::parse(effectMultipliersJson);

  for (const auto &item : doc)
  {
    std::string name = item["name"].get<std::string>();
    // Multiply by 100 to convert to integer representation
    int multiplier = static_cast<int>(std::round(item["multiplier"].get<double>() * 100.0));
    effectMultipliers[name] = multiplier;
  }

  return effectMultipliers;
}

// Parse and apply substance rules from JSON
void applySubstanceRulesJson(
    std::vector<Substance> &substances,
    const std::string &substanceRulesJson)
{
  json doc = json::parse(substanceRulesJson);

  // Apply rules to substances
  for (const auto &item : doc)
  {
    std::string substanceName = item["substanceName"].get<std::string>();
    const auto &rules = item["rules"];

    // Find the substance
    for (auto &substance : substances)
    {
      if (substance.name == substanceName)
      {
        // Pre-allocate memory for rules
        substance.rules.reserve(rules.size());

        // Add rules to the substance
        for (const auto &ruleItem : rules)
        {
          SubstanceRule rule;

          rule.type = ruleItem["action"]["type"].get<std::string>();
          rule.target = ruleItem["action"]["target"].get<std::string>();

          // Handle withEffect (may be missing in "add" rules)
          if (ruleItem["action"].contains("withEffect") &&
              !ruleItem["action"]["withEffect"].is_null())
          {
            rule.withEffect = ruleItem["action"]["withEffect"].get<std::string>();
          }

          // Parse conditions
          const auto &conditions = ruleItem["condition"];
          rule.condition.reserve(conditions.size()); // Pre-allocate
          for (const auto &cond : conditions)
          {
            rule.condition.push_back(cond.get<std::string>());
          }

          // Parse ifNotPresent (may be empty)
          if (ruleItem.contains("ifNotPresent"))
          {
            const auto &ifNotPresent = ruleItem["ifNotPresent"];
            rule.ifNotPresent.reserve(ifNotPresent.size()); // Pre-allocate
            for (const auto &np : ifNotPresent)
            {
              rule.ifNotPresent.push_back(np.get<std::string>());
            }
          }

          substance.rules.push_back(rule);
        }
        break;
      }
    }
  }
}
