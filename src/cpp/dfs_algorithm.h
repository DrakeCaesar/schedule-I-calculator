#pragma once

#include "types.h"
#include <vector>
#include <string>
#include <string_view>
#include <unordered_map>
#include <atomic>
#include <mutex>

// Forward declarations
struct EffectsCache;

// DFS State struct with optimized memory layout
struct DFSState
{
  // Use a larger fixed-size array to handle deeper searches without reallocation
  int substanceIndices[16]; // Support up to 16 substances in a mix for better future-proofing
  int depth;                // Current depth in the search
  int currentCost;          // Track the current mix cost in cents (integer)

  // Hash value that can be incrementally updated to quickly identify identical states
  uint64_t stateHash;

  DFSState();

  // Add a substance to the current state
  void addSubstance(int index, const std::vector<Substance> &substances);

  // Remove the last substance added (backtrack)
  void removeLastSubstance(const std::vector<Substance> &substances);

  // Convert to a vector of substance names for result reporting
  std::vector<std::string> toSubstanceNames(const std::vector<Substance> &substances) const;

  // Copy the current state to a MixState for compatibility with existing code
  MixState toMixState() const;

  // Get a unique hash for the current state (for potential memoization)
  uint64_t getHash() const { return stateHash; }
};

// Effects cache optimized for DFS traversal
// Stores effects at each depth to avoid recalculating them
struct EffectsCache
{
  // Primary cache: full effects list for each depth
  std::vector<std::vector<std::string>> depthCache;

  // Secondary cache: substance+parent effects hash -> resulting effects
  // This allows reusing effects calculations even when they don't fall on the same depth
  std::unordered_map<uint64_t, std::vector<std::string>> effectsMap;

  // String pool for shared strings to minimize allocations
  std::unordered_map<std::string, std::string> stringPool;

  // Flag to control whether to use advanced caching via hashing
  bool useHashingOptimization;

  EffectsCache(int maxDepth, const std::string &initialEffect, bool enableHashing = true)
      : useHashingOptimization(enableHashing)
  {
    depthCache.resize(maxDepth + 1);
    depthCache[0].push_back(initialEffect);
    stringPool[initialEffect] = initialEffect; // Add initial effect to pool
  }

  // Get shared string reference
  const std::string &getPooledString(const std::string &str)
  {
    auto it = stringPool.find(str);
    if (it != stringPool.end())
    {
      return it->second;
    }
    auto result = stringPool.emplace(str, str);
    return result.first->second;
  }

  // Add effects to cache
  void cacheEffects(int depth, const std::vector<std::string> &effects)
  {
    depthCache[depth] = effects;
  }

  // Get a unique hash for substance + parent effects
  static uint64_t getEffectsHash(int substanceIndex, const std::vector<std::string> &parentEffects)
  {
    uint64_t hash = static_cast<uint64_t>(substanceIndex) << 32;
    for (const auto &effect : parentEffects)
    {
      // Simple hash combination
      hash = hash ^ std::hash<std::string>{}(effect);
    }
    return hash;
  }

  // Check if we already calculated these effects
  bool hasCalculatedEffects(int substanceIndex, const std::vector<std::string> &parentEffects)
  {
    if (!useHashingOptimization)
      return false; // Skip hash-based caching if disabled

    uint64_t hash = getEffectsHash(substanceIndex, parentEffects);
    return effectsMap.find(hash) != effectsMap.end();
  }

  // Cache calculated effects with substance+parent hash
  void cacheCalculatedEffects(int substanceIndex, const std::vector<std::string> &parentEffects,
                              const std::vector<std::string> &resultEffects)
  {
    if (!useHashingOptimization)
      return; // Skip hash-based caching if disabled

    uint64_t hash = getEffectsHash(substanceIndex, parentEffects);
    effectsMap[hash] = resultEffects;
  }

  // Get cached effects
  const std::vector<std::string> &getCachedEffects(int substanceIndex, const std::vector<std::string> &parentEffects)
  {
    uint64_t hash = getEffectsHash(substanceIndex, parentEffects);
    return effectsMap[hash];
  }
};

// Global variables for thread synchronization in DFS algorithm
extern std::mutex g_bestMixMutex;
extern std::atomic<int64_t> g_totalProcessedCombinations;
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
    int64_t expectedCombinations,
    MixState &globalBestMix,
    int &globalBestProfitCents,
    int &globalBestSellPriceCents,
    int &globalBestCostCents,
    ProgressCallback progressCallback,
    bool useHashingOptimization = true);

// Main DFS algorithm with threading
JsBestMixResult findBestMixDFS(
    const Product &product,
    const std::vector<Substance> &substances,
    const std::unordered_map<std::string, int> &effectMultipliers,
    int maxDepth,
    ProgressCallback progressCallback = nullptr,
    bool useHashingOptimization = true);
