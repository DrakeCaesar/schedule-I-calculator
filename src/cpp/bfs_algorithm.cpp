#include "bfs_algorithm.h"
#include "effects.h"
#include "pricing.h"
#include <queue>
#include <cmath>
#include <limits>
#include <thread>
#include <mutex>
#include <atomic>
#include <vector>

#ifdef __EMSCRIPTEN__
#include <emscripten/val.h>
using namespace emscripten;
#endif

// Mutex for thread synchronization when updating best mix
std::mutex bestMixMutex;

// Atomic counter for processed combinations across all threads
std::atomic<int> totalProcessedCombinations(0);

// Thread-safe version of recursiveBFS
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
    ProgressCallback progressCallback)
{
  // Process all mixes at the current depth (breadth-first fashion)
  std::vector<MixState> nextDepthMixes;
  nextDepthMixes.reserve(currentDepthMixes.size() * substances.size());

  int batchSize = 0;
  const int reportInterval = 1000;

  // Process all states at the current depth
  for (auto &currentMix : currentDepthMixes)
  {
    // Calculate effects for current mix
    std::vector<std::string> effectsList = calculateEffectsForMix(
        currentMix, substances, product.initialEffect, effectsSet);

    // Calculate profit
    double sellPrice = calculateFinalPrice(product.name, effectsList, effectMultipliers);
    double cost = calculateFinalCost(currentMix, substances);
    double profit = sellPrice - cost;

    // Update thread's best mix if this one is better
    if (profit > threadBestProfit)
    {
      threadBestMix = currentMix;
      threadBestProfit = profit;
      threadBestSellPrice = sellPrice;
      threadBestCost = cost;
    }

    // If we haven't reached max depth, prepare mixes for the next depth
    if (currentDepth < maxDepth)
    {
      for (size_t i = 0; i < substances.size(); ++i)
      {
        MixState newMix = currentMix;
        newMix.addSubstance(i);
        nextDepthMixes.push_back(newMix);
      }
    }

    // Update progress
    processedCombinations++;
    totalProcessedCombinations++;
    batchSize++;

    // Report progress periodically
    if (progressCallback && batchSize >= reportInterval)
    {
      progressCallback(currentDepth, totalProcessedCombinations.load(), expectedCombinations);
      batchSize = 0;
    }
  }

  // Report progress for this depth
  if (progressCallback && batchSize > 0)
  {
    progressCallback(currentDepth, totalProcessedCombinations.load(), expectedCombinations);
  }

  // If we have mixes for the next depth and haven't reached max depth,
  // recursively process the next depth
  if (!nextDepthMixes.empty() && currentDepth < maxDepth)
  {
    recursiveBFS(
        product, substances, effectMultipliers, effectsSet,
        currentDepth + 1, maxDepth, nextDepthMixes,
        threadBestMix, threadBestProfit, threadBestSellPrice, threadBestCost,
        processedCombinations, expectedCombinations, progressCallback);
  }
}

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
    ProgressCallback progressCallback)
{
  // Initialize thread-local best mix data
  MixState threadBestMix(maxDepth);
  double threadBestProfit = -std::numeric_limits<double>::infinity();
  double threadBestSellPrice = 0.0;
  double threadBestCost = 0.0;

  // Create initial mix state for this thread's starting substance
  std::vector<MixState> initialMixes;
  initialMixes.reserve(1);

  MixState initialMix(maxDepth);
  initialMix.addSubstance(startSubstanceIndex);
  initialMixes.push_back(initialMix);

  // Track thread-local processed combinations
  int processedCombinations = 0;

  // Execute BFS for this thread's starting state
  recursiveBFS(
      product, substances, effectMultipliers, effectsSet,
      1, maxDepth, initialMixes,
      threadBestMix, threadBestProfit, threadBestSellPrice, threadBestCost,
      processedCombinations, expectedCombinations, progressCallback);

  // Synchronize with global best mix
  std::lock_guard<std::mutex> lock(bestMixMutex);
  if (threadBestProfit > globalBestProfit)
  {
    globalBestMix = threadBestMix;
    globalBestProfit = threadBestProfit;
    globalBestSellPrice = threadBestSellPrice;
    globalBestCost = threadBestCost;
  }
}

// BFS algorithm with multi-threading
JsBestMixResult findBestMix(
    const Product &product,
    const std::vector<Substance> &substances,
    const std::unordered_map<std::string, double> &effectMultipliers,
    int maxDepth,
    ProgressCallback progressCallback)
{
  // Reset the atomic counter for this run
  totalProcessedCombinations = 0;

  // Initialize the best mix and profit
  MixState bestMix(maxDepth);
  double bestProfit = -std::numeric_limits<double>::infinity();
  double bestSellPrice = 0.0;
  double bestCost = 0.0;

  // Create a set of all effect names for efficiency
  std::unordered_map<std::string, bool> effectsSet;
  effectsSet.reserve(effectMultipliers.size() * 2);
  for (const auto &pair : effectMultipliers)
  {
    effectsSet[pair.first] = true;
  }

  // Calculate total expected combinations for progress reporting
  int totalCombinations = 0;
  int substanceCount = substances.size();
  for (int i = 1; i <= maxDepth; ++i)
  {
    totalCombinations += pow(substanceCount, i);
  }

  // Initial progress report
  if (progressCallback)
  {
    progressCallback(1, 0, totalCombinations);
  }

  // Create and launch threads - one for each starting substance
  std::vector<std::thread> threads;
  threads.reserve(substances.size());

  for (size_t i = 0; i < substances.size(); ++i)
  {
    threads.emplace_back(
        bfsThreadWorker,
        std::ref(product),
        std::ref(substances),
        std::ref(effectMultipliers),
        std::ref(effectsSet),
        i,
        maxDepth,
        totalCombinations,
        std::ref(bestMix),
        std::ref(bestProfit),
        std::ref(bestSellPrice),
        std::ref(bestCost),
        progressCallback);
  }

  // Wait for all threads to complete
  for (auto &thread : threads)
  {
    if (thread.joinable())
    {
      thread.join();
    }
  }

  // Final progress report
  if (progressCallback)
  {
    progressCallback(maxDepth, totalCombinations, totalCombinations);
  }

  // Create the result
  JsBestMixResult result;

  // Convert best mix to an array using substance names
  std::vector<std::string> bestMixNames = bestMix.toSubstanceNames(substances);

#ifdef __EMSCRIPTEN__
  // WebAssembly version: convert to JavaScript array
  val jsArray = val::array();
  for (size_t i = 0; i < bestMixNames.size(); ++i)
  {
    jsArray.set(i, val(bestMixNames[i]));
  }
  result.mixArray = jsArray;
#else
  // Native version: use std::vector directly
  result.mixArray = bestMixNames;
#endif

  result.profit = bestProfit;
  result.sellPrice = bestSellPrice;
  result.cost = bestCost;

  return result;
}

#ifdef __EMSCRIPTEN__
// JavaScript-compatible progress reporting function
void reportProgressToJS(int depth, int processed, int total)
{
  val progressEvent = val::object();
  progressEvent.set("depth", depth);
  progressEvent.set("processed", processed);
  progressEvent.set("total", total);

  // Call JavaScript progress function
  val::global("reportBfsProgress").call<void>("call", val::null(), progressEvent);
}
#endif
