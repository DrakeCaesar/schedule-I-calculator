#pragma once

#include "types.h"
#include <unordered_map>
#include <vector>
#include <string>

// Utility functions for substance rules and effects
std::vector<std::string> applySubstanceRules(
    const std::vector<std::string> &currentEffects,
    const Substance &substance,
    int recipeLength,
    const std::unordered_map<std::string, bool> &effectsSet);

// Helper function to calculate effects for a mix (used by BFS)
std::vector<std::string> calculateEffectsForMix(
    const MixState &mixState,
    const std::vector<Substance> &substances,
    const std::string &initialEffect,
    const std::unordered_map<std::string, bool> &effectsSet);
