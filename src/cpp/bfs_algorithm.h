#pragma once

#include "types.h"
#include <vector>
#include <string>
#include <unordered_map>

// BFS algorithm with memory optimizations and progress reporting
JsBestMixResult findBestMix(
    const Product &product,
    const std::vector<Substance> &substances,
    const std::unordered_map<std::string, int> &effectMultipliers,
    int maxDepth,
    ProgressCallback progressCallback = nullptr);

// Basic recursive BFS implementation
void recursiveBFS(
    const Product &product,
    const std::vector<Substance> &substances,
    const std::unordered_map<std::string, int> &effectMultipliers,
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

#ifndef __EMSCRIPTEN__
// Thread worker function - only in native build
void bfsThreadWorker(
    const Product &product,
    const std::vector<Substance> &substances,
    const std::unordered_map<std::string, int> &effectMultipliers,
    const std::unordered_map<std::string, bool> &effectsSet,
    size_t startSubstanceIndex,
    int maxDepth,
    int expectedCombinations,
    MixState &globalBestMix,
    double &globalBestProfit,
    double &globalBestSellPrice,
    double &globalBestCost,
    ProgressCallback progressCallback);
#endif

#ifdef __EMSCRIPTEN__
// JavaScript-compatible progress reporting function (only for WebAssembly)
void reportProgressToJS(int depth, int processed, int total);
#endif
