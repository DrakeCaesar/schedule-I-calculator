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

// Calculate effects for a mix - DFS version
std::vector<std::string> calculateEffectsForMixDFS(
    const MixState &mixState,
    const std::vector<Substance> &substances,
    const std::string &initialEffect,
    const std::unordered_map<std::string, bool> &effectsSet);

// Calculate effects for a mix - BFS version (using legacy implementation)
std::vector<std::string> calculateEffectsForMixBFS(
    const MixState &mixState,
    const std::vector<Substance> &substances,
    const std::string &initialEffect,
    const std::unordered_map<std::string, bool> &effectsSet);
