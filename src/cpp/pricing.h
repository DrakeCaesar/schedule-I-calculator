#pragma once

#include "types.h"
#include <string>
#include <vector>
#include <unordered_map>

// Calculate the final selling price of a product
double calculateFinalPrice(
    const std::string &productName,
    const std::vector<std::string> &currentEffects,
    const std::unordered_map<std::string, double> &effectMultipliers);

// Calculate the total cost of a mix
double calculateFinalCost(
    const MixState &mixState,
    const std::vector<Substance> &substances);
