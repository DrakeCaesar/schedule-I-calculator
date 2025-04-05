#include "bfs_algorithm.h"
#include "effects.h"
#include "pricing.h"
#include <queue>
#include <cmath>
#include <limits>

#ifdef __EMSCRIPTEN__
#include <emscripten/val.h>
using namespace emscripten;
#endif

// Recursive BFS implementation that maintains BFS behavior
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
    ProgressCallback progressCallback)
{
  // Process all mixes at the current depth (breadth-first fashion)
  std::vector<MixState> nextDepthMixes;
  nextDepthMixes.reserve(currentDepthMixes.size() * substances.size());

  int batchSize = 0;
  const int reportInterval = 1000;

  // Process all states at the current depth (equivalent to processing one level of the queue)
  for (auto &currentMix : currentDepthMixes)
  {
    // Calculate effects for current mix
    std::vector<std::string> effectsList = calculateEffectsForMix(
        currentMix, substances, product.initialEffect, effectsSet);

    // Calculate profit
    double sellPrice = calculateFinalPrice(product.name, effectsList, effectMultipliers);
    double cost = calculateFinalCost(currentMix, substances);
    double profit = sellPrice - cost;

    // Update best mix if this one is better
    if (profit > bestProfit)
    {
      bestMix = currentMix;
      bestProfit = profit;
      bestSellPrice = sellPrice;
      bestCost = cost;
    }

    // If we haven't reached max depth, prepare mixes for the next depth
    if (currentDepth < maxDepth)
    {
      for (size_t i = 0; i < substances.size(); ++i)
      {
        MixState newMix = currentMix; // Copy is optimized due to vector of indices
        newMix.addSubstance(i);
        nextDepthMixes.push_back(newMix);
      }
    }

    // Update progress
    processedCombinations++;
    batchSize++;

    // Report progress periodically
    if (progressCallback && batchSize >= reportInterval)
    {
      progressCallback(currentDepth, processedCombinations, totalCombinations);
      batchSize = 0;
    }
  }

  // Report progress for this depth
  if (progressCallback && batchSize > 0)
  {
    progressCallback(currentDepth, processedCombinations, totalCombinations);
  }

  // If we have mixes for the next depth and haven't reached max depth,
  // recursively process the next depth (BFS ordering)
  if (!nextDepthMixes.empty() && currentDepth < maxDepth)
  {
    recursiveBFS(
        product, substances, effectMultipliers, effectsSet,
        currentDepth + 1, maxDepth, nextDepthMixes,
        bestMix, bestProfit, bestSellPrice, bestCost,
        processedCombinations, totalCombinations, progressCallback);
  }
}

// BFS algorithm with recursive implementation but maintaining BFS ordering
JsBestMixResult findBestMix(
    const Product &product,
    const std::vector<Substance> &substances,
    const std::unordered_map<std::string, double> &effectMultipliers,
    int maxDepth,
    ProgressCallback progressCallback)
{
  // Initialize the best mix and profit
  MixState bestMix(maxDepth);
  double bestProfit = -std::numeric_limits<double>::infinity();
  double bestSellPrice = 0.0;
  double bestCost = 0.0;

  // Create a set of all effect names for efficiency
  std::unordered_map<std::string, bool> effectsSet;
  effectsSet.reserve(effectMultipliers.size() * 2); // Pre-allocate with enough capacity
  for (const auto &pair : effectMultipliers)
  {
    effectsSet[pair.first] = true;
  }

  // Initial states for depth 1 (single substances)
  std::vector<MixState> initialMixes;
  initialMixes.reserve(substances.size());

  // Add each substance as a starting point
  for (size_t i = 0; i < substances.size(); ++i)
  {
    MixState initialMix(maxDepth);
    initialMix.addSubstance(i);
    initialMixes.push_back(initialMix);
  }

  // Calculate total expected combinations for progress reporting
  int totalCombinations = 0;
  int substanceCount = substances.size();
  for (int i = 1; i <= maxDepth; ++i)
  {
    totalCombinations += pow(substanceCount, i);
  }

  // Initial progress report
  int processedCombinations = 0;
  if (progressCallback)
  {
    progressCallback(1, 0, totalCombinations);
  }

  // Start the recursive BFS from depth 1
  recursiveBFS(
      product, substances, effectMultipliers, effectsSet,
      1, maxDepth, initialMixes,
      bestMix, bestProfit, bestSellPrice, bestCost,
      processedCombinations, totalCombinations, progressCallback);

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
