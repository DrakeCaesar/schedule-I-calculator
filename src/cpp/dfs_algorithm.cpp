#include "dfs_algorithm.h"
#include "effects.h"
#include "pricing.h"
#include <iostream>
#include <thread>
#include <mutex>
#include <functional>
#include <cmath>
#include <limits>

// Define global variables for thread synchronization
std::mutex g_bestMixMutex;
std::atomic<int> g_totalProcessedCombinations(0);
std::atomic<bool> g_shouldTerminate(false);
const int MAX_SUBSTANCES = 16; // Maximum number of substances
const int MAX_DEPTH = 10;      // Maximum depth for the mix

// Mutex for console output
std::mutex g_consoleMutex;

// DFSState implementation
DFSState::DFSState() : depth(0), currentCost(0)
{
  // Initialize all indices to -1 (not used)
  for (int i = 0; i < MAX_DEPTH; ++i)
  {
    substanceIndices[i] = -1;
  }
}

void DFSState::addSubstance(int index, const std::vector<Substance> &substances)
{
  if (depth < MAX_DEPTH)
  {
    substanceIndices[depth] = index;
    currentCost += substances[index].cost; // Add the cost in cents
    depth++;
  }
}

void DFSState::removeLastSubstance(const std::vector<Substance> &substances)
{
  if (depth > 0)
  {
    depth--;
    currentCost -= substances[substanceIndices[depth]].cost; // Subtract the cost in cents
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
  MixState mix(MAX_DEPTH);
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
    int expectedCombinations,
    MixState &globalBestMix,
    int &globalBestProfitCents,
    int &globalBestSellPriceCents,
    int &globalBestCostCents,
    ProgressCallback progressCallback)
{
  // Initialize thread-local best mix data
  DFSState currentState;
  MixState threadBestMix(maxDepth);
  int threadBestProfitCents = -std::numeric_limits<int>::infinity();
  int threadBestSellPriceCents = 0;
  int threadBestCostCents = 0;

  // Initialize with the starting substance
  currentState.addSubstance(startSubstanceIndex, substances);

  // Create a set of all effect names for efficiency
  std::unordered_map<std::string, bool> effectsSet;
  effectsSet.reserve(effectMultipliers.size() * 2);
  for (const auto &pair : effectMultipliers)
  {
    effectsSet[pair.first] = true;
  }

  // Thread-local cache for effect calculations at each depth
  std::vector<std::vector<std::string>> effectsCache(maxDepth + 1);

  // Initialize effects cache with initial effect
  effectsCache[0].push_back(product.initialEffect);

  // Pre-calculate effects for the first substance (which is already added)
  std::vector<std::string> effectsList = applySubstanceRules(
      effectsCache[0], substances[startSubstanceIndex], 1, effectsSet);
  effectsCache[1] = effectsList;

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

  g_totalProcessedCombinations++; // Count the first node

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

    // Calculate effects efficiently using the cached previous level
    if (current.depth == 2)
    {
      // For depth 2, use the cached effects from the starting substance
      effectsList = applySubstanceRules(
          effectsCache[1],
          substances[current.substanceIndex],
          current.depth,
          effectsSet);
      effectsCache[current.depth] = effectsList;
    }
    else
    {
      // For deeper levels, use the parent's cached effects
      effectsList = applySubstanceRules(
          effectsCache[current.depth - 1],
          substances[current.substanceIndex],
          current.depth,
          effectsSet);
      effectsCache[current.depth] = effectsList;
    }

    // Update progress and count this combination
    g_totalProcessedCombinations++;

    // Adaptively adjust progress reporting frequency
    int reportFrequency = 10000;
    if (current.depth > 5)
    {
      reportFrequency = 50000 * (current.depth - 4);
    }

    // Report progress periodically
    if (progressCallback && g_totalProcessedCombinations % reportFrequency == 0)
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
    ProgressCallback progressCallback)
{
  // Reset global counters
  g_totalProcessedCombinations = 0;
  g_shouldTerminate = false;

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

  // Cap to INT_MAX if needed for compatibility with progress callback
  int totalCombinations = (totalCombinations64 > INT_MAX) ? INT_MAX : static_cast<int>(totalCombinations64);

  // If we'll exceed INT_MAX, print a warning
  if (totalCombinations64 > INT_MAX)
  {
    std::lock_guard<std::mutex> lock(g_consoleMutex);
    std::cout << "WARNING: Total combinations (" << totalCombinations64
              << ") exceeds INT_MAX. Progress reporting will be approximate." << std::endl;
  }

  // Report initial progress
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
  result.mixArray = bestMix.toSubstanceNames(substances);
  result.profitCents = bestProfitCents;
  result.sellPriceCents = bestSellPriceCents;
  result.costCents = bestCostCents;

  return result;
}