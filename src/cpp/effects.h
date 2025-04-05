#pragma once

#include "types.h"
#include <string>
#include <vector>
#include <unordered_map>

// Apply substance rules to current effects
std::vector<std::string> applySubstanceRules(
    const std::vector<std::string> &currentEffects,
    const Substance &substance,
    int recipeLength,
    const std::unordered_map<std::string, bool> &effectsSet);

// Calculate effects for a mix
std::vector<std::string> calculateEffectsForMix(
    const MixState &mixState,
    const std::vector<Substance> &substances,
    const std::string &initialEffect,
    const std::unordered_map<std::string, bool> &effectsSet);
