#include "pricing.h"
#include <cmath>

double calculateFinalPrice(
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

  // Determine base price from product name (convert to integer cents)
  // Default to Weed pricing (35.00)
  int basePriceInt = 3500; // $35.00 by default
  
  // Check for specific product types
  if (productName.find("Meth") != std::string::npos)
    basePriceInt = 7000; // $70.00
  else if (productName.find("Cocaine") != std::string::npos)
    basePriceInt = 15000; // $150.00
  // Otherwise keep default Weed price

  // Calculate final price using integer arithmetic
  // Formula: basePrice * (1.0 + totalMultiplier/100)
  // = (basePrice * 100 + basePrice * totalMultiplier) / 100
  int finalPrice = basePriceInt + (basePriceInt * totalMultiplier) / 100;
  
  // Convert to dollars and round
  return std::round(finalPrice / 100.0);
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
