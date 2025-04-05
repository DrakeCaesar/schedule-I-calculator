#pragma once

#include "types.h"
#include <vector>
#include <string>
#include <unordered_map>

// BFS algorithm with memory optimizations and progress reporting
JsBestMixResult findBestMix(
    const Product &product,
    const std::vector<Substance> &substances,
    const std::unordered_map<std::string, double> &effectMultipliers,
    int maxDepth,
    ProgressCallback progressCallback = nullptr);

// Recursive BFS implementation
void recursiveBFS(
    const Product &product,
    const std::vector<Substance> &substances,
    const std::unordered_map<std::string, double> &effectMultipliers,
    const std::unordered_map<std::string, bool> &effectsSet,
    int currentDepth,
    int maxDepth,
    std::vector<MixState> &currentDepthMixes,
    MixState &bestMix,
    double &bestProfit,
    double &bestSellPrice,
    double &bestCost,
    int &processedCombinations,
    int totalCombinations,
    ProgressCallback progressCallback = nullptr);

// JavaScript-compatible progress reporting function
void reportProgressToJS(int depth, int processed, int total);
