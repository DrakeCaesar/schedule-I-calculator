#pragma once

#include "types.h"
#include <string>
#include <vector>
#include <unordered_map>

// Parse product from JSON string
Product parseProductJson(const std::string &productJson);

// Parse substances from JSON string
std::vector<Substance> parseSubstancesJson(const std::string &substancesJson);

// Parse effect multipliers from JSON string - returns integers multiplied by 100
std::unordered_map<std::string, int> parseEffectMultipliersJson(const std::string &effectMultipliersJson);

// Parse substance rules from JSON string and apply to substances
void applySubstanceRulesJson(
    std::vector<Substance> &substances,
    const std::string &substanceRulesJson);
