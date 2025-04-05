#include "json_parser.h"
#include <rapidjson/document.h>

using namespace rapidjson;

// Parse product from JSON
Product parseProductJson(const std::string &productJson)
{
  Document doc;
  doc.Parse(productJson.c_str());

  Product product;
  product.name = doc["name"].GetString();
  product.initialEffect = doc["initialEffect"].GetString();

  return product;
}

// Parse substances from JSON
std::vector<Substance> parseSubstancesJson(const std::string &substancesJson)
{
  Document doc;
  doc.Parse(substancesJson.c_str());

  std::vector<Substance> substances;
  substances.reserve(doc.Size()); // Pre-allocate memory

  for (SizeType i = 0; i < doc.Size(); i++)
  {
    Substance substance;
    substance.name = doc[i]["name"].GetString();
    substance.cost = doc[i]["cost"].GetDouble();
    substance.defaultEffect = doc[i]["defaultEffect"].GetString();
    substances.push_back(substance);
  }

  return substances;
}

// Parse effect multipliers from JSON
std::unordered_map<std::string, double> parseEffectMultipliersJson(const std::string &effectMultipliersJson)
{
  Document doc;
  doc.Parse(effectMultipliersJson.c_str());

  std::unordered_map<std::string, double> effectMultipliers;
  for (SizeType i = 0; i < doc.Size(); i++)
  {
    std::string name = doc[i]["name"].GetString();
    double multiplier = doc[i]["multiplier"].GetDouble();
    effectMultipliers[name] = multiplier;
  }

  return effectMultipliers;
}

// Parse and apply substance rules from JSON
void applySubstanceRulesJson(
    std::vector<Substance> &substances,
    const std::string &substanceRulesJson)
{
  Document doc;
  doc.Parse(substanceRulesJson.c_str());

  // Apply rules to substances
  for (SizeType i = 0; i < doc.Size(); i++)
  {
    std::string substanceName = doc[i]["substanceName"].GetString();
    const Value &rules = doc[i]["rules"];

    // Find the substance
    for (auto &substance : substances)
    {
      if (substance.name == substanceName)
      {
        // Pre-allocate memory for rules
        substance.rules.reserve(rules.Size());

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
          rule.condition.reserve(conditions.Size()); // Pre-allocate
          for (SizeType k = 0; k < conditions.Size(); k++)
          {
            rule.condition.push_back(conditions[k].GetString());
          }

          // Parse ifNotPresent (may be empty)
          if (rules[j].HasMember("ifNotPresent"))
          {
            const Value &ifNotPresent = rules[j]["ifNotPresent"];
            rule.ifNotPresent.reserve(ifNotPresent.Size()); // Pre-allocate
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
}
