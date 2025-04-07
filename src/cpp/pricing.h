#pragma once

#include "types.h"
#include <string>
#include <vector>
#include <unordered_map>

// Calculate the final selling price of a product (in cents)
int calculateFinalPrice(
    const std::string &productName,
    const std::vector<std::string> &currentEffects,
    const std::unordered_map<std::string, int> &effectMultipliers);

// Calculate the total cost of a mix (in cents)
int calculateFinalCost(
    const MixState &mixState,
    const std::vector<Substance> &substances);
