#pragma once

#include "types.h"
#include <string>
#include <vector>
#include <unordered_map>

// Parse product from JSON
Product parseProductJson(const std::string &productJson);

// Parse substances from JSON
std::vector<Substance> parseSubstancesJson(const std::string &substancesJson);

// Parse effect multipliers from JSON
std::unordered_map<std::string, double> parseEffectMultipliersJson(const std::string &effectMultipliersJson);

// Parse and apply substance rules from JSON
void applySubstanceRulesJson(
    std::vector<Substance> &substances,
    const std::string &substanceRulesJson);
