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

// Thread-safe version of recursive BFS
void recursiveBFS(
    const Product &product,
    const std::vector<Substance> &substances,
    const std::unordered_map<std::string, double> &effectMultipliers,
    const std::unordered_map<std::string, bool> &effectsSet,
    int currentDepth,
    int maxDepth,
    std::vector<MixState> &currentDepthMixes,
    MixState &threadBestMix,
    double &threadBestProfit,
    double &threadBestSellPrice,
    double &threadBestCost,
    int &processedCombinations,
    int expectedCombinations,
    ProgressCallback progressCallback = nullptr);

// Thread worker function
void bfsThreadWorker(
    const Product &product,
    const std::vector<Substance> &substances,
    const std::unordered_map<std::string, double> &effectMultipliers,
    const std::unordered_map<std::string, bool> &effectsSet,
    size_t startSubstanceIndex,
    int maxDepth,
    int expectedCombinations,
    MixState &globalBestMix,
    double &globalBestProfit,
    double &globalBestSellPrice,
    double &globalBestCost,
    ProgressCallback progressCallback);

#ifdef __EMSCRIPTEN__
// JavaScript-compatible progress reporting function (only for WebAssembly)
void reportProgressToJS(int depth, int processed, int total);
#endif
