#include "pricing.h"
#include <cmath>

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

  // Determine base price from product name
  double basePrice = 100.0;
  if (productName.find("Weed") != std::string::npos)
    basePrice = 35.0;
  else if (productName.find("Meth") != std::string::npos)
    basePrice = 70.0;
  else if (productName.find("Cocaine") != std::string::npos)
    basePrice = 150.0;

  return std::round(basePrice * (1.0 + totalMultiplier));
}

double calculateFinalCost(const MixState &mixState, const std::vector<Substance> &substances)
{
  double totalCost = 0.0;

  for (size_t idx : mixState.substanceIndices)
  {
    totalCost += substances[idx].cost;
  }

  return std::round(totalCost);
}
