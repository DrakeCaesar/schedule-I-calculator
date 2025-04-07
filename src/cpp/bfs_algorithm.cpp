#include "bfs_algorithm.h"
#include "effects.h"
#include "pricing.h"
#include <queue>
#include <cmath>
#include <limits>

// Include threading libraries only for native build
#ifndef __EMSCRIPTEN__
#include <thread>
#include <mutex>
#include <atomic>
#include <vector>
#include <iostream> // Add iostream for std::cout and std::endl
#endif

#ifdef __EMSCRIPTEN__
#include <emscripten/val.h>
using namespace emscripten;
#endif

// Mutex for thread synchronization when updating best mix - only used in native build
#ifndef __EMSCRIPTEN__
std::mutex bestMixMutex;
std::atomic<int> totalProcessedCombinations(0);
#endif

// Version of recursiveBFS for both Emscripten and native single-threaded mode
void recursiveBFS(
    const Product &product,
    const std::vector<Substance> &substances,
    const std::unordered_map<std::string, int> &effectMultipliers,
    const std::unordered_map<std::string, bool> &effectsSet,
    int currentDepth,
    int maxDepth,
    std::vector<MixState> &currentDepthMixes,
    MixState &bestMix,
    int &bestProfitCents,
    int &bestSellPriceCents,
    int &bestCostCents,
    int &processedCombinations,
    int totalCombinations,
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

    // Calculate profit using integer cents
    int sellPriceCents = calculateFinalPrice(product.name, effectsList, effectMultipliers);
    int costCents = calculateFinalCost(currentMix, substances);
    int profitCents = sellPriceCents - costCents;

    // Update best mix if this one is better
    if (profitCents > bestProfitCents)
    {
      bestMix = currentMix;
      bestProfitCents = profitCents;
      bestSellPriceCents = sellPriceCents;
      bestCostCents = costCents;

      // Report the new best mix in WebAssembly mode
#ifdef __EMSCRIPTEN__
      reportBestMixFoundToJS(bestMix, substances, bestProfitCents, bestSellPriceCents, bestCostCents);
#endif

#ifndef __EMSCRIPTEN__
      // Print best mix so far to stdout in native mode
      std::vector<std::string> mixNames = bestMix.toSubstanceNames(substances);
      std::cout << "Best mix so far: [";
      for (size_t i = 0; i < mixNames.size(); ++i)
      {
        if (i > 0)
          std::cout << ", ";
        std::cout << mixNames[i];
      }
      std::cout << "] with profit " << bestProfitCents / 100.0
                << ", price " << bestSellPriceCents / 100.0
                << ", cost " << bestCostCents / 100.0 << std::endl;
#endif
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

    // Adjust reporting frequency based on depth
    int reportFrequency = reportInterval;
    if (currentDepth > 5) {
      // For deeper levels, report progress less frequently to reduce I/O pressure
      reportFrequency = reportInterval * (currentDepth - 4); // 1000 for depth <=5, 2000 for depth 6, 3000 for depth 7...
    }

    // Report progress periodically with adaptive frequency
    if (progressCallback && batchSize >= reportFrequency)
    {
#ifndef __EMSCRIPTEN__
      // In native multithreaded version, use atomic counter
      progressCallback(currentDepth, totalProcessedCombinations.load(), totalCombinations);
#else
      // In Emscripten version, use regular counter
      progressCallback(currentDepth, processedCombinations, totalCombinations);
#endif
      batchSize = 0;
    }
  }

  // Report progress for this depth
  if (progressCallback && batchSize > 0)
  {
#ifndef __EMSCRIPTEN__
    progressCallback(currentDepth, totalProcessedCombinations.load(), totalCombinations);
#else
    progressCallback(currentDepth, processedCombinations, totalCombinations);
#endif
  }

  // If we have mixes for the next depth and haven't reached max depth,
  // recursively process the next depth (BFS ordering)
  if (!nextDepthMixes.empty() && currentDepth < maxDepth)
  {
    recursiveBFS(
        product, substances, effectMultipliers, effectsSet,
        currentDepth + 1, maxDepth, nextDepthMixes,
        bestMix, bestProfitCents, bestSellPriceCents, bestCostCents,
        processedCombinations, totalCombinations, progressCallback);
  }
}

#ifndef __EMSCRIPTEN__
// Thread-safe version of recursiveBFS for multi-threading (only in native build)
void recursiveBFSThreaded(
    const Product &product,
    const std::vector<Substance> &substances,
    const std::unordered_map<std::string, int> &effectMultipliers,
    const std::unordered_map<std::string, bool> &effectsSet,
    int currentDepth,
    int maxDepth,
    std::vector<MixState> &currentDepthMixes,
    MixState &threadBestMix,
    int &threadBestProfitCents,
    int &threadBestSellPriceCents,
    int &threadBestCostCents,
    int &processedCombinations,
    int expectedCombinations,
    ProgressCallback progressCallback)
{
  // Process all mixes at the current depth (breadth-first fashion)
  std::vector<MixState> nextDepthMixes;
  nextDepthMixes.reserve(currentDepthMixes.size() * substances.size());

  int batchSize = 0;
  const int reportInterval = 1000;
  const int bestMixCheckInterval = 5000; // Check global best mix every 5000 steps
  int stepsSinceLastBestMixCheck = 0;

  // Process all states at the current depth
  for (auto &currentMix : currentDepthMixes)
  {
    // Calculate effects for current mix
    std::vector<std::string> effectsList = calculateEffectsForMix(
        currentMix, substances, product.initialEffect, effectsSet);

    // Calculate profit using integer cents
    int sellPriceCents = calculateFinalPrice(product.name, effectsList, effectMultipliers);
    int costCents = calculateFinalCost(currentMix, substances);
    int profitCents = sellPriceCents - costCents;

    // Update thread's best mix if this one is better
    if (profitCents > threadBestProfitCents)
    {
      threadBestMix = currentMix;
      threadBestProfitCents = profitCents;
      threadBestSellPriceCents = sellPriceCents;
      threadBestCostCents = costCents;

      // Check if this is better than the global best mix
      // We use a mutex to avoid race conditions when checking and updating
      {
        std::lock_guard<std::mutex> lock(bestMixMutex);

        // Check against the global variables passed by reference to this function
        // These are actually the real global variables from bfsThreadWorker
        MixState &globalBestMix = *static_cast<MixState *>(&threadBestMix);
        int &globalBestProfitCents = threadBestProfitCents;

        // Report the updated best mix immediately regardless of whether it's better than
        // the global best - each thread reports its own discoveries
        std::vector<std::string> mixNames = threadBestMix.toSubstanceNames(substances);
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

    // Periodically check if we need to update the global best mix
    stepsSinceLastBestMixCheck++;
    if (stepsSinceLastBestMixCheck >= bestMixCheckInterval)
    {
      stepsSinceLastBestMixCheck = 0;

      std::lock_guard<std::mutex> lock(bestMixMutex);
      // This check happens in bfsThreadWorker after threads complete
      // We're now doing it more frequently within the thread
      // The actual update is now done above when a thread finds a better mix
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

    // Adjust reporting frequency based on depth
    int reportFrequency = reportInterval;
    if (currentDepth > 5) {
      // For deeper levels, report progress less frequently to reduce I/O pressure
      reportFrequency = reportInterval * (currentDepth - 4); // 1000 for depth <=5, 2000 for depth 6, 3000 for depth 7...
    }

    // Report progress periodically with adaptive frequency
    if (progressCallback && batchSize >= reportFrequency)
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
    recursiveBFSThreaded(
        product, substances, effectMultipliers, effectsSet,
        currentDepth + 1, maxDepth, nextDepthMixes,
        threadBestMix, threadBestProfitCents, threadBestSellPriceCents, threadBestCostCents,
        processedCombinations, expectedCombinations, progressCallback);
  }
}

#endif // <-- Added missing #endif for the recursiveBFSThreaded function

#ifndef __EMSCRIPTEN__
// Thread worker function (only in native build)
void bfsThreadWorker(
    const Product &product,
    const std::vector<Substance> &substances,
    const std::unordered_map<std::string, int> &effectMultipliers,
    const std::unordered_map<std::string, bool> &effectsSet,
    size_t startSubstanceIndex,
    int maxDepth,
    int expectedCombinations,
    MixState &globalBestMix,
    int &globalBestProfitCents,
    int &globalBestSellPriceCents,
    int &globalBestCostCents,
    ProgressCallback progressCallback)
{
  // Initialize thread-local best mix data
  MixState threadBestMix(maxDepth);
  int threadBestProfitCents = -std::numeric_limits<int>::infinity();
  int threadBestSellPriceCents = 0;
  int threadBestCostCents = 0;

  // Create initial mix state for this thread's starting substance
  std::vector<MixState> initialMixes;
  initialMixes.reserve(1);

  MixState initialMix(maxDepth);
  initialMix.addSubstance(startSubstanceIndex);
  initialMixes.push_back(initialMix);

  // Track thread-local processed combinations
  int processedCombinations = 0;

  // Execute BFS for this thread's starting state
  recursiveBFSThreaded(
      product, substances, effectMultipliers, effectsSet,
      1, maxDepth, initialMixes,
      threadBestMix, threadBestProfitCents, threadBestSellPriceCents, threadBestCostCents,
      processedCombinations, expectedCombinations, progressCallback);

  // Synchronize with global best mix
  std::lock_guard<std::mutex> lock(bestMixMutex);
  if (threadBestProfitCents > globalBestProfitCents)
  {
    globalBestMix = threadBestMix;
    globalBestProfitCents = threadBestProfitCents;
    globalBestSellPriceCents = threadBestSellPriceCents;
    globalBestCostCents = threadBestCostCents;

    // Print best mix update to stdout when a thread finds a better mix
    std::vector<std::string> mixNames = globalBestMix.toSubstanceNames(substances);
    std::cout << "Best mix so far: [";
    for (size_t i = 0; i < mixNames.size(); ++i)
    {
      if (i > 0)
        std::cout << ", ";
      std::cout << mixNames[i];
    }
    std::cout << "] with profit " << globalBestProfitCents / 100.0
              << ", price " << globalBestSellPriceCents / 100.0
              << ", cost " << globalBestCostCents / 100.0 << std::endl;
  }
}
#endif

// BFS algorithm with appropriate implementation for platform
JsBestMixResult findBestMix(
    const Product &product,
    const std::vector<Substance> &substances,
    const std::unordered_map<std::string, int> &effectMultipliers,
    int maxDepth,
    ProgressCallback progressCallback)
{
#ifndef __EMSCRIPTEN__
  // Native multi-threaded implementation
  // Reset the atomic counter for this run
  totalProcessedCombinations = 0;

  // Initialize the best mix and profit
  MixState bestMix(maxDepth);
  int bestProfitCents = -std::numeric_limits<int>::infinity();
  int bestSellPriceCents = 0;
  int bestCostCents = 0;

  // Create a set of all effect names for efficiency
  std::unordered_map<std::string, bool> effectsSet;
  effectsSet.reserve(effectMultipliers.size() * 2);
  for (const auto &pair : effectMultipliers)
  {
    effectsSet[pair.first] = true;
  }

  // Calculate total expected combinations for progress reporting
  // Use 64-bit integer to avoid overflow at high depths
  int64_t totalCombinations64 = 0;
  size_t substanceCount = substances.size();
  for (size_t i = 1; i <= static_cast<size_t>(maxDepth); ++i)
  {
    // Use pow with doubles and then cast to int64_t to handle large values
    totalCombinations64 += static_cast<int64_t>(pow(static_cast<double>(substanceCount), static_cast<double>(i)));
  }

  // Cap to INT_MAX if needed for compatibility with progress callback
  int totalCombinations = (totalCombinations64 > INT_MAX) ? 
                          INT_MAX : static_cast<int>(totalCombinations64);
  
  // If we'll exceed INT_MAX, print a warning
  if (totalCombinations64 > INT_MAX) {
    std::cout << "WARNING: Total combinations (" << totalCombinations64 
              << ") exceeds INT_MAX. Progress reporting will be approximate." << std::endl;
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
        std::ref(bestProfitCents),
        std::ref(bestSellPriceCents),
        std::ref(bestCostCents),
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

#else
  // Emscripten single-threaded implementation
  // Initialize the best mix and profit
  MixState bestMix(maxDepth);
  int bestProfitCents = -std::numeric_limits<int>::infinity();
  int bestSellPriceCents = 0;
  int bestCostCents = 0;

  // Create a set of all effect names for efficiency
  std::unordered_map<std::string, bool> effectsSet;
  effectsSet.reserve(effectMultipliers.size() * 2);
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
  // Use 64-bit integer to avoid overflow at high depths
  int64_t totalCombinations64 = 0;
  size_t substanceCount = substances.size();
  for (int i = 1; i <= maxDepth; ++i)
  {
    // Use pow with doubles and then cast to int64_t to handle large values
    totalCombinations64 += static_cast<int64_t>(pow(static_cast<double>(substanceCount), static_cast<double>(i)));
  }
  
  // Cap to INT_MAX if needed for compatibility with progress callback
  int totalCombinations = (totalCombinations64 > INT_MAX) ? 
                           INT_MAX : static_cast<int>(totalCombinations64);

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
      bestMix, bestProfitCents, bestSellPriceCents, bestCostCents,
      processedCombinations, totalCombinations, progressCallback);

  // Final progress report
  if (progressCallback)
  {
    progressCallback(maxDepth, totalCombinations, totalCombinations);
  }
#endif

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

  // Store monetary values in cents in the result
  result.profitCents = bestProfitCents;
  result.sellPriceCents = bestSellPriceCents;
  result.costCents = bestCostCents;

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

// JavaScript-compatible best mix reporting function
void reportBestMixFoundToJS(const MixState &bestMix,
                            const std::vector<Substance> &substances,
                            int profitCents,
                            int sellPriceCents,
                            int costCents)
{
  // Convert mix state to substance names
  std::vector<std::string> mixNames = bestMix.toSubstanceNames(substances);

  // Create JavaScript array for mix names
  val jsArray = val::array();
  for (size_t i = 0; i < mixNames.size(); ++i)
  {
    jsArray.set(i, val(mixNames[i]));
  }

  // Create event object with mix data
  val mixEvent = val::object();
  mixEvent.set("mix", jsArray);
  mixEvent.set("profit", profitCents / 100.0);
  mixEvent.set("sellPrice", sellPriceCents / 100.0);
  mixEvent.set("cost", costCents / 100.0);

  // Call JavaScript function to report the new best mix
  val::global("reportBestMixFound").call<void>("call", val::null(), mixEvent);
}
#endif
