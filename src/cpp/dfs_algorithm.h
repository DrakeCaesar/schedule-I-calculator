#pragma once

#include "types.h"
#include <vector>
#include <string>
#include <unordered_map>
#include <atomic>
#include <mutex>

// DFS State struct with static memory allocation
struct DFSState
{
  int substanceIndices[10]; // Fixed-size array for the current path (MAX_DEPTH = 10)
  int depth;                // Current depth in the search
  int currentCost;          // Track the current mix cost in cents (integer)

  DFSState();

  // Add a substance to the current state
  void addSubstance(int index, const std::vector<Substance> &substances);

  // Remove the last substance added (backtrack)
  void removeLastSubstance(const std::vector<Substance> &substances);

  // Convert to a vector of substance names for result reporting
  std::vector<std::string> toSubstanceNames(const std::vector<Substance> &substances) const;

  // Copy the current state to a MixState for compatibility with existing code
  MixState toMixState() const;
};

// Global variables for thread synchronization in DFS algorithm
extern std::mutex g_bestMixMutex;
extern std::atomic<int> g_totalProcessedCombinations;
extern std::atomic<bool> g_shouldTerminate;
extern const int MAX_SUBSTANCES;
extern const int MAX_DEPTH;

// Worker function for DFS threading
void dfsThreadWorker(
    const Product &product,
    const std::vector<Substance> &substances,
    const std::unordered_map<std::string, int> &effectMultipliers,
    int startSubstanceIndex,
    int maxDepth,
    int expectedCombinations,
    MixState &globalBestMix,
    int &globalBestProfitCents,
    int &globalBestSellPriceCents,
    int &globalBestCostCents,
    ProgressCallback progressCallback);

// Main DFS algorithm with threading
JsBestMixResult findBestMixDFS(
    const Product &product,
    const std::vector<Substance> &substances,
    const std::unordered_map<std::string, int> &effectMultipliers,
    int maxDepth,
    ProgressCallback progressCallback = nullptr);

#ifdef __EMSCRIPTEN__
// JavaScript-compatible progress reporting function (only for WebAssembly)
void reportProgressToDfsJS(int depth, int processed, int total);

// Report the best mix found to JavaScript (for WebAssembly build)
void reportBestMixFoundToDfsJS(const MixState &bestMix,
                               const std::vector<Substance> &substances,
                               int profitCents,
                               int sellPriceCents,
                               int costCents);

// Unified JavaScript-compatible progress reporting function
// This is used by both BFS and DFS algorithms
void reportProgressToJS(int depth, int processed, int total);

// Unified function to report the best mix found to JavaScript
// This is used by both BFS and DFS algorithms
void reportBestMixFoundToJS(const MixState &bestMix,
                           const std::vector<Substance> &substances,
                           int profitCents,
                           int sellPriceCents,
                           int costCents);
#endif