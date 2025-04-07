#include "pricing.h"
#include <cmath>

// Calculate the final selling price in cents
int calculateFinalPrice(
    const std::string &productName,
    const std::vector<std::string> &currentEffects,
    const std::unordered_map<std::string, int> &effectMultipliers)
{
  // Use integer arithmetic for better performance
  int totalMultiplier = 0;

  // Calculate the total multiplier from all effects
  for (const auto &effect : currentEffects)
  {
    auto it = effectMultipliers.find(effect);
    if (it != effectMultipliers.end())
    {
      totalMultiplier += it->second;
    }
  }

  // Determine base price from product name (in integer cents)
  // Default to Weed pricing (35.00)
  int basePriceInCents = 3500; // $35.00 by default

  // Check for specific product types
  if (productName.find("Meth") != std::string::npos)
    basePriceInCents = 7000; // $70.00
  else if (productName.find("Cocaine") != std::string::npos)
    basePriceInCents = 15000; // $150.00
  // Otherwise keep default Weed price

  // Calculate final price using integer arithmetic
  // Formula: basePrice * (1.0 + totalMultiplier/100)
  // = (basePrice * 100 + basePrice * totalMultiplier) / 100
  int finalPriceInCents = basePriceInCents + (basePriceInCents * totalMultiplier) / 100;

  // Return the price in cents directly, no rounding needed
  return finalPriceInCents;
}

// Calculate the total cost of a mix in cents
int calculateFinalCost(const MixState &mixState, const std::vector<Substance> &substances)
{
  int totalCost = 0;

  for (size_t idx : mixState.substanceIndices)
  {
    totalCost += substances[idx].cost;
  }

  return totalCost;
}
