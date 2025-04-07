#include "effects.h"

// Apply substance rules to current effects
std::vector<std::string> applySubstanceRules(
    const std::vector<std::string> &currentEffects,
    const Substance &substance,
    int recipeLength,
    const std::unordered_map<std::string, bool> &effectsSet)
{
  // Pre-allocate hash maps with appropriate capacity to avoid rehashing
  std::unordered_map<std::string, bool> ogEffects(currentEffects.size() * 2);
  std::unordered_map<std::string, bool> newEffects(currentEffects.size() * 2);

  // Convert input to sets for efficient lookups
  for (const auto &effect : currentEffects)
  {
    ogEffects[effect] = true;
    newEffects[effect] = true;
  }

  // Apply each rule in order
  for (const auto &rule : substance.rules)
  {
    // Check if all conditions are met
    bool conditionsMet = true;
    for (const auto &cond : rule.condition)
    {
      if (ogEffects.find(cond) == ogEffects.end())
      {
        conditionsMet = false;
        break;
      }
    }

    // Only check exclusions if conditions are met (fail fast)
    if (!conditionsMet)
      continue;

    // Check if all exclusions are met
    bool exclusionsMet = true;
    for (const auto &np : rule.ifNotPresent)
    {
      if (ogEffects.find(np) != ogEffects.end())
      {
        exclusionsMet = false;
        break;
      }
    }

    if (conditionsMet && exclusionsMet)
    {
      if (rule.type == "replace" && !rule.withEffect.empty())
      {
        if (newEffects.find(rule.target) != newEffects.end() &&
            newEffects.find(rule.withEffect) == newEffects.end())
        {
          // Remove target and add new effect
          newEffects.erase(rule.target);
          newEffects[rule.withEffect] = true;
        }
      }
      else if (rule.type == "add")
      {
        // Add new effect if not present
        if (newEffects.find(rule.target) == newEffects.end())
        {
          newEffects[rule.target] = true;
        }
      }
    }
  }

  // Ensure default effect is present
  if (recipeLength < 9)
  {
    newEffects[substance.defaultEffect] = true;
  }

  // Convert back to vector with pre-allocation for efficiency
  std::vector<std::string> result;
  result.reserve(newEffects.size());
  for (const auto &pair : newEffects)
  {
    result.push_back(pair.first);
  }

  return result;
}

// Calculate effects for a mix
std::vector<std::string> calculateEffectsForMix(
    const MixState &mixState,
    const std::vector<Substance> &substances,
    const std::string &initialEffect,
    const std::unordered_map<std::string, bool> &effectsSet)
{
  // Pre-allocate with a reasonable initial capacity
  std::vector<std::string> effectsList;
  effectsList.reserve(10); // Start with space for ~10 effects
  effectsList.push_back(initialEffect);

// Thread-local storage for caching effects at each depth
#ifdef __EMSCRIPTEN__
  // For WebAssembly (single-threaded), we can use regular static variables
  static std::unordered_map<size_t, std::vector<std::string>> effectsCache;
  static MixState lastMixState(mixState.substanceIndices.capacity());
  static size_t lastProcessedDepth = 0;
#else
  // For multi-threaded native environment, use thread_local
  thread_local std::unordered_map<size_t, std::vector<std::string>> effectsCache;
  thread_local MixState lastMixState(mixState.substanceIndices.capacity());
  thread_local size_t lastProcessedDepth = 0;
#endif

  // Check if we can reuse previous calculations
  size_t reuseDepth = 0;
  if (!lastMixState.substanceIndices.empty() && !mixState.substanceIndices.empty())
  {
    // Find common prefix between current and last mix state
    size_t minSize = std::min(lastMixState.substanceIndices.size(), mixState.substanceIndices.size());
    for (; reuseDepth < minSize; ++reuseDepth)
    {
      if (lastMixState.substanceIndices[reuseDepth] != mixState.substanceIndices[reuseDepth])
        break;
    }
  }

  // If we can reuse previous calculations, start from the cached result
  if (reuseDepth > 0 && reuseDepth <= lastProcessedDepth && effectsCache.count(reuseDepth - 1) > 0)
  {
    effectsList = effectsCache[reuseDepth - 1];
  }

  // Apply rules for the remaining substances
  for (size_t i = reuseDepth; i < mixState.substanceIndices.size(); ++i)
  {
    size_t idx = mixState.substanceIndices[i];
    effectsList = applySubstanceRules(effectsList, substances[idx], i + 1, effectsSet);

    // Cache the intermediate result
    effectsCache[i] = effectsList;
  }

  // Update the last processed mix state and depth for next call
  lastMixState = mixState;
  lastProcessedDepth = mixState.substanceIndices.size();

  return effectsList;
}
