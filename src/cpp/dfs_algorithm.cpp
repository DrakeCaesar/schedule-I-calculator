#include "dfs_algorithm.h"
#include "reporter.h"
#include "effects.h"
#include "pricing.h"
#include <iostream>
#include <thread>
#include <mutex>
#include <functional>
#include <cmath>
#include <limits>

#ifdef __EMSCRIPTEN__
#include <emscripten/val.h>
#include <emscripten/threading.h>
using namespace emscripten;
#endif

// Define global variables for thread synchronization
std::mutex g_bestMixMutex;
std::atomic<int64_t> g_totalProcessedCombinations(0);
std::atomic<bool> g_shouldTerminate(false);
const int MAX_SUBSTANCES = 16; // Maximum number of substances
const int MAX_DEPTH = 10;      // Maximum depth for the mix

// Mutex for console output
std::mutex g_consoleMutex;

// DFSState implementation
DFSState::DFSState() : depth(0), currentCost(0), stateHash(0)
{
  // Initialize all indices to -1 (not used)
  for (int i = 0; i < 16; ++i)
  {
    substanceIndices[i] = -1;
  }
}

void DFSState::addSubstance(int index, const std::vector<Substance> &substances)
{
  if (depth < 16)
  {
    substanceIndices[depth] = index;
    currentCost += substances[index].cost; // Add the cost in cents

    // Update hash incrementally - multiply by a prime number and add index
    // This creates a unique hash value for each path of substances
    stateHash = stateHash * 31 + static_cast<uint64_t>(index);

    depth++;
  }
}

void DFSState::removeLastSubstance(const std::vector<Substance> &substances)
{
  if (depth > 0)
  {
    depth--;
    int index = substanceIndices[depth];
    currentCost -= substances[index].cost; // Subtract the cost in cents

    // Reverse the hash calculation for backtracking
    stateHash = (stateHash - static_cast<uint64_t>(index)) / 31;

    substanceIndices[depth] = -1;
  }
}

std::vector<std::string> DFSState::toSubstanceNames(const std::vector<Substance> &substances) const
{
  std::vector<std::string> names;
  names.reserve(depth);
  for (int i = 0; i < depth; ++i)
  {
    names.push_back(substances[substanceIndices[i]].name);
  }
  return names;
}

MixState DFSState::toMixState() const
{
  MixState mix(depth); // Only allocate what we need
  for (int i = 0; i < depth; ++i)
  {
    if (substanceIndices[i] >= 0)
    {
      mix.addSubstance(substanceIndices[i]);
    }
  }
  return mix;
}

// DFS Worker function for each thread
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
    bool useHashingOptimization)
{
  // Initialize thread-local best mix data
  DFSState currentState;
  MixState threadBestMix(maxDepth);
  int threadBestProfitCents = -std::numeric_limits<int>::infinity();
  int threadBestSellPriceCents = 0;
  int threadBestCostCents = 0;

  // Initialize with the starting substance
  currentState.addSubstance(startSubstanceIndex, substances);

  // Create a set of all effect names for fast lookups
  std::unordered_map<std::string, bool> effectsSet;
  effectsSet.reserve(effectMultipliers.size() * 2);
  for (const auto &pair : effectMultipliers)
  {
    effectsSet[pair.first] = true;
  }

  // Initialize the optimized effects cache with the hashing flag
  EffectsCache effectsCache(maxDepth, product.initialEffect, useHashingOptimization);

  // Pre-calculate effects for the first substance (which is already added)
  std::vector<std::string> effectsList = applySubstanceRules(
      effectsCache.depthCache[0], substances[startSubstanceIndex], 1, effectsSet);

  // Cache the effects at depth 1
  effectsCache.cacheEffects(1, effectsList);

  // Also cache in the substance-specific map for potential reuse
  effectsCache.cacheCalculatedEffects(startSubstanceIndex, effectsCache.depthCache[0], effectsList);

  // Process the first node (already added substance)
  {
    // Calculate monetary values for the first node
    int sellPriceCents = calculateFinalPrice(product.name, effectsList, effectMultipliers);
    int costCents = currentState.currentCost;
    int profitCents = sellPriceCents - costCents;

    // Update best mix if this one is better
    if (profitCents > threadBestProfitCents)
    {
      threadBestMix = currentState.toMixState();
      threadBestProfitCents = profitCents;
      threadBestSellPriceCents = sellPriceCents;
      threadBestCostCents = costCents;

      // Update global best mix (thread-safe)
      std::lock_guard<std::mutex> lock(g_bestMixMutex);
      if (threadBestProfitCents > globalBestProfitCents)
      {
        globalBestMix = threadBestMix;
        globalBestProfitCents = threadBestProfitCents;
        globalBestSellPriceCents = threadBestSellPriceCents;
        globalBestCostCents = threadBestCostCents;

        // Report best mix
        {
          std::lock_guard<std::mutex> consoleLock(g_consoleMutex);
          std::vector<std::string> mixNames = currentState.toSubstanceNames(substances);
          std::cout << "Best mix so far: [";
          for (size_t i = 0; i < mixNames.size(); ++i)
          {
            if (i > 0)
              std::cout << ", ";
            std::cout << mixNames[i];
          }
          std::cout << "] with profit " << threadBestProfitCents / 100.0
                    << ", price " << threadBestSellPriceCents / 100.0
                    << ", cost " << threadBestCostCents / 100.0 << std::endl;
        }
      }
    }
  }

  // Count the first node
  g_totalProcessedCombinations.fetch_add(1, std::memory_order_relaxed);

  // Use a stack-based iterative DFS approach
  // Each entry represents (substance_index, depth)
  struct StackEntry
  {
    size_t substanceIndex;
    size_t depth;
  };

  std::vector<StackEntry> stack;
  stack.reserve(maxDepth);

  // If we should go deeper, add the first candidate for depth 2
  if (maxDepth > 1)
  {
    stack.push_back({0, 2});
  }

  while (!stack.empty() && !g_shouldTerminate)
  {
    // Get the top entry without popping
    StackEntry &current = stack.back();

    // If we've exhausted substances at this depth, backtrack
    if (current.substanceIndex >= substances.size())
    {
      stack.pop_back();
      // Backtrack if we have more than just the initial substance
      if (currentState.depth > 1)
      {
        currentState.removeLastSubstance(substances);
      }
      continue;
    }

    // Add the current substance
    currentState.addSubstance(current.substanceIndex, substances);

    // Calculate effects efficiently, checking for cached results first
    const int substanceIndex = current.substanceIndex;
    const size_t currentDepth = current.depth;
    const auto &parentEffects = effectsCache.depthCache[currentDepth - 1];

    // Use direct cache lookup using the substance+parent combo
    if (effectsCache.hasCalculatedEffects(substanceIndex, parentEffects))
    {
      // Get pre-calculated effects - no need to reapply rules
      effectsList = effectsCache.getCachedEffects(substanceIndex, parentEffects);
    }
    else
    {
      // Calculate effects from parent effects
      effectsList = applySubstanceRules(
          parentEffects,
          substances[substanceIndex],
          currentDepth,
          effectsSet);

      // Cache for potential reuse with same substance+parent combo
      effectsCache.cacheCalculatedEffects(substanceIndex, parentEffects, effectsList);
    }

    // Always update the depth cache
    effectsCache.cacheEffects(currentDepth, effectsList);

    // Update progress and count this combination
    g_totalProcessedCombinations.fetch_add(1, std::memory_order_relaxed);

    // Adaptively adjust progress reporting frequency
    int reportFrequency = 10000000;

    // Report progress periodically
    if (progressCallback && (g_totalProcessedCombinations.load() % reportFrequency == 0))
    {
      progressCallback(current.depth, g_totalProcessedCombinations.load(), expectedCombinations);
    }

    // Calculate profit for the current mix
    int sellPriceCents = calculateFinalPrice(product.name, effectsList, effectMultipliers);
    int costCents = currentState.currentCost;
    int profitCents = sellPriceCents - costCents;

    // Update best mix if needed
    if (profitCents > threadBestProfitCents)
    {
      threadBestMix = currentState.toMixState();
      threadBestProfitCents = profitCents;
      threadBestSellPriceCents = sellPriceCents;
      threadBestCostCents = costCents;

      // Update global best mix (thread-safe)
      std::lock_guard<std::mutex> lock(g_bestMixMutex);
      if (threadBestProfitCents > globalBestProfitCents)
      {
        globalBestMix = threadBestMix;
        globalBestProfitCents = threadBestProfitCents;
        globalBestSellPriceCents = threadBestSellPriceCents;
        globalBestCostCents = threadBestCostCents;

        // Report best mix
        {
          std::lock_guard<std::mutex> consoleLock(g_consoleMutex);
          std::vector<std::string> mixNames = currentState.toSubstanceNames(substances);
          std::cout << "Best mix so far: [";
          for (size_t i = 0; i < mixNames.size(); ++i)
          {
            if (i > 0)
              std::cout << ", ";
            std::cout << mixNames[i];
          }
          std::cout << "] with profit " << threadBestProfitCents / 100.0
                    << ", price " << threadBestSellPriceCents / 100.0
                    << ", cost " << threadBestCostCents / 100.0 << std::endl;
        }
      }
    }

    // If we haven't reached max depth, go deeper with the first substance
    if (current.depth < maxDepth)
    {
      current.substanceIndex++;                // Move to next substance at current level
      stack.push_back({0, current.depth + 1}); // Push the next level starting at substance 0
    }
    else
    {
      // At max depth, try the next substance at this level
      currentState.removeLastSubstance(substances);
      current.substanceIndex++;
    }
  }
}

// Main DFS algorithm with threading
JsBestMixResult findBestMixDFS(
    const Product &product,
    const std::vector<Substance> &substances,
    const std::unordered_map<std::string, int> &effectMultipliers,
    int maxDepth,
    ProgressCallback progressCallback,
    bool useHashingOptimization)
{
  // Reset global counters
  g_totalProcessedCombinations = 0;
  g_shouldTerminate = false;

  // Log optimization status
  {
    std::lock_guard<std::mutex> lock(g_consoleMutex);
    std::cout << "DFS algorithm running with " << (useHashingOptimization ? "ENABLED" : "DISABLED")
              << " hashing optimization" << std::endl;
  }

  // Initialize best mix variables
  MixState bestMix(maxDepth);
  int bestProfitCents = -std::numeric_limits<int>::infinity();
  int bestSellPriceCents = 0;
  int bestCostCents = 0;

  // Calculate total expected combinations for progress reporting
  // Use 64-bit integer to avoid overflow at high depths
  int64_t totalCombinations64 = 0;
  size_t substanceCount = std::min(static_cast<size_t>(MAX_SUBSTANCES), substances.size());
  for (size_t i = 1; i <= static_cast<size_t>(maxDepth); ++i)
  {
    // Use pow with doubles and then cast to int64_t to handle large values
    totalCombinations64 += static_cast<int64_t>(pow(static_cast<double>(substanceCount), static_cast<double>(i)));
  }

  // Use the full 64-bit value for total combinations
  int64_t totalCombinations = totalCombinations64;

#ifndef __EMSCRIPTEN__
  // If we'll exceed INT_MAX, print an informational message (native only)
  if (totalCombinations64 > INT_MAX)
  {
    std::lock_guard<std::mutex> lock(g_consoleMutex);
    std::cout << "INFO: Total combinations (" << totalCombinations64
              << ") exceeds INT_MAX. Using 64-bit progress reporting." << std::endl;
  }
#endif

  // Initial progress report
  if (progressCallback)
  {
    progressCallback(1, 0, totalCombinations);
  }

  // Check if we can use threads
  bool canUseThreads = true; // Default true for native builds

#ifdef __EMSCRIPTEN__
// For WebAssembly, check if threading is supported
#ifdef __EMSCRIPTEN_PTHREADS__
  canUseThreads = emscripten_has_threading_support();
  canUseThreads = false; // Disable threading for now
#else
  canUseThreads = false; // No threading support in this build
#endif
#endif

  if (canUseThreads)
  {
    // Multi-threaded implementation (native or WebAssembly with threading)
    // Create a set of all effect names for efficiency
    std::unordered_map<std::string, bool> effectsSet;
    effectsSet.reserve(effectMultipliers.size() * 2);
    for (const auto &pair : effectMultipliers)
    {
      effectsSet[pair.first] = true;
    }

    // Create and launch threads - one for each starting substance
    std::vector<std::thread> threads;
    int maxThreads = std::min(16, (int)substances.size()); // Use up to 16 threads
    threads.reserve(maxThreads);

    for (size_t i = 0; i < substances.size() && i < maxThreads; ++i)
    {
      threads.emplace_back(
          dfsThreadWorker,
          std::ref(product),
          std::ref(substances),
          std::ref(effectMultipliers),
          i,
          maxDepth,
          totalCombinations,
          std::ref(bestMix),
          std::ref(bestProfitCents),
          std::ref(bestSellPriceCents),
          std::ref(bestCostCents),
          progressCallback,
          useHashingOptimization);
    }

    // Wait for all threads to complete
    for (auto &thread : threads)
    {
      if (thread.joinable())
      {
        thread.join();
      }
    }
  }
  else
  {
    // Single-threaded WebAssembly fallback
    // Create a set of all effect names for efficiency
    std::unordered_map<std::string, bool> effectsSet;
    effectsSet.reserve(effectMultipliers.size() * 2);
    for (const auto &pair : effectMultipliers)
    {
      effectsSet[pair.first] = true;
    }

    int64_t processedCombinations = 0;

    // Process each substance as a starting point in sequence
    for (size_t startIdx = 0; startIdx < substances.size(); ++startIdx)
    {
      // Initialize state with the starting substance
      DFSState currentState;
      currentState.addSubstance(startIdx, substances);
      processedCombinations++;

      // Initialize the optimized effects cache with the hashing option
      EffectsCache effectsCache(maxDepth, product.initialEffect, useHashingOptimization);

      // Calculate effects for the first substance
      std::vector<std::string> effectsList = applySubstanceRules(
          effectsCache.depthCache[0], substances[startIdx], 1, effectsSet);

      // Cache the effects at depth 1
      effectsCache.cacheEffects(1, effectsList);

      // Also cache in the substance-specific map for potential reuse
      effectsCache.cacheCalculatedEffects(startIdx, effectsCache.depthCache[0], effectsList);

      // Calculate profit for starting substance
      int sellPriceCents = calculateFinalPrice(product.name, effectsList, effectMultipliers);
      int costCents = currentState.currentCost;
      int profitCents = sellPriceCents - costCents;

      // Update best mix if better
      if (profitCents > bestProfitCents)
      {
        bestMix = currentState.toMixState();
        bestProfitCents = profitCents;
        bestSellPriceCents = sellPriceCents;
        bestCostCents = costCents;

#ifdef __EMSCRIPTEN__
        // Report to JavaScript
        if (progressCallback)
        {
          reportBestMixFoundToJS(bestMix, substances, bestProfitCents, bestSellPriceCents, bestCostCents);
        }
#endif
      }

      // Stack-based DFS (simulating recursion for WebAssembly)
      struct StackEntry
      {
        size_t substanceIndex;
        size_t depth;
      };

      std::vector<StackEntry> stack;
      stack.reserve(maxDepth);

      // Add first entry for depth 2 if we should go deeper
      if (maxDepth > 1)
      {
        stack.push_back({0, 2});
      }

      // Progress reporting variables
      int batchSize = 0;
      const int reportInterval = 1000;

      // Process the DFS stack
      while (!stack.empty())
      {
        // Get current stack entry
        StackEntry &current = stack.back();

        // If we've exhausted substances at this depth, backtrack
        if (current.substanceIndex >= substances.size())
        {
          stack.pop_back();
          // Backtrack if we have more than just the initial substance
          if (currentState.depth > 1)
          {
            currentState.removeLastSubstance(substances);
          }
          continue;
        }

        // Add the current substance
        currentState.addSubstance(current.substanceIndex, substances);

        // Calculate effects efficiently, checking for cached results first
        const int substanceIndex = current.substanceIndex;
        const size_t currentDepth = current.depth;
        const auto &parentEffects = effectsCache.depthCache[currentDepth - 1];

        // Use direct cache lookup using the substance+parent combo
        if (effectsCache.hasCalculatedEffects(substanceIndex, parentEffects))
        {
          // Get pre-calculated effects - no need to reapply rules
          effectsList = effectsCache.getCachedEffects(substanceIndex, parentEffects);
        }
        else
        {
          // Calculate effects from parent effects
          effectsList = applySubstanceRules(
              parentEffects,
              substances[substanceIndex],
              currentDepth,
              effectsSet);

          // Cache for potential reuse with same substance+parent combo
          effectsCache.cacheCalculatedEffects(substanceIndex, parentEffects, effectsList);
        }

        // Always update the depth cache
        effectsCache.cacheEffects(currentDepth, effectsList);

        // Count this combination
        processedCombinations++;
        batchSize++;

        // Adaptive progress reporting frequency
        int reportFrequency = reportInterval;
        if (current.depth > 5)
        {
          reportFrequency = reportInterval * (current.depth - 4);
        }

        // Report progress periodically
        if (progressCallback && batchSize >= reportFrequency)
        {
          progressCallback(current.depth, processedCombinations, totalCombinations);
          batchSize = 0;
        }

        // Calculate profit for the current mix
        sellPriceCents = calculateFinalPrice(product.name, effectsList, effectMultipliers);
        costCents = currentState.currentCost;
        profitCents = sellPriceCents - costCents;

        // Update best mix if better
        if (profitCents > bestProfitCents)
        {
          bestMix = currentState.toMixState();
          bestProfitCents = profitCents;
          bestSellPriceCents = sellPriceCents;
          bestCostCents = costCents;

#ifdef __EMSCRIPTEN__
          // Report to JavaScript
          if (progressCallback)
          {
            reportBestMixFoundToJS(bestMix, substances, bestProfitCents, bestSellPriceCents, bestCostCents);
          }
#endif
        }

        // If we haven't reached max depth, go deeper with the first substance
        if (current.depth < maxDepth)
        {
          current.substanceIndex++;                // Move to next substance at current level
          stack.push_back({0, current.depth + 1}); // Push next level starting at substance 0
        }
        else
        {
          // At max depth, try the next substance at this level
          currentState.removeLastSubstance(substances);
          current.substanceIndex++;
        }
      }

      // Report progress after finishing this starting substance
      if (progressCallback && batchSize > 0)
      {
        progressCallback(maxDepth, processedCombinations, totalCombinations);
      }
    }
  }

  // Final progress report
  if (progressCallback)
  {
    progressCallback(maxDepth, totalCombinations, totalCombinations);
  }

  // Create the result
  JsBestMixResult result;

#ifdef __EMSCRIPTEN__
  // WebAssembly version: convert to JavaScript array
  val jsArray = val::array();
  std::vector<std::string> bestMixNames = bestMix.toSubstanceNames(substances);
  for (size_t i = 0; i < bestMixNames.size(); ++i)
  {
    jsArray.set(i, val(bestMixNames[i]));
  }
  result.mixArray = jsArray;
#else
  // Native version: use std::vector directly
  result.mixArray = bestMix.toSubstanceNames(substances);
#endif

  // Set the monetary values in cents
  result.profitCents = bestProfitCents;
  result.sellPriceCents = bestSellPriceCents;
  result.costCents = bestCostCents;

  // Convert cents to dollars for backward compatibility
  result.profit = bestProfitCents / 100.0;
  result.sellPrice = bestSellPriceCents / 100.0;
  result.cost = bestCostCents / 100.0;

  return result;
}
