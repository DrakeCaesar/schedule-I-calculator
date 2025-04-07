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
// Thread-local storage for caching effects at each depth
#ifdef __EMSCRIPTEN__
  // For WebAssembly (single-threaded), we can use regular static variables
  static std::unordered_map<size_t, std::vector<std::string>> effectsCache;
#else
  // For multi-threaded native environment, use thread_local
  thread_local std::unordered_map<size_t, std::vector<std::string>> effectsCache;
#endif

  // Get the current mix depth
  size_t currentDepth = mixState.substanceIndices.size();

  // If we have a cached result for the previous depth, use it as a starting point
  if (currentDepth > 0 && effectsCache.find(currentDepth - 1) != effectsCache.end())
  {
    // Get effects from previous depth
    std::vector<std::string> effectsList = effectsCache[currentDepth - 1];

    // Apply only the last substance's rules
    size_t lastIdx = mixState.substanceIndices[currentDepth - 1];
    effectsList = applySubstanceRules(effectsList, substances[lastIdx], currentDepth, effectsSet);

    // Cache the result for this depth
    effectsCache[currentDepth] = effectsList;

    return effectsList;
  }
  else if (currentDepth > 0 && effectsCache.find(0) != effectsCache.end())
  {
    // We don't have the previous depth cached, but we have the initial state
    // This is likely due to backtracking in the DFS

    // Start with the initial effect
    std::vector<std::string> effectsList = effectsCache[0];

    // Apply rules for all substances in this mix
    for (size_t i = 0; i < currentDepth; ++i)
    {
      size_t idx = mixState.substanceIndices[i];
      effectsList = applySubstanceRules(effectsList, substances[idx], i + 1, effectsSet);

      // Cache intermediate results
      effectsCache[i + 1] = effectsList;
    }

    return effectsList;
  }
  else
  {
    // First calculation or cache was reset
    // Start with the initial effect
    std::vector<std::string> effectsList;
    effectsList.reserve(10); // Start with space for ~10 effects
    effectsList.push_back(initialEffect);

    // Cache the initial state
    effectsCache[0] = effectsList;

    // Apply rules for all substances in this mix
    for (size_t i = 0; i < currentDepth; ++i)
    {
      size_t idx = mixState.substanceIndices[i];
      effectsList = applySubstanceRules(effectsList, substances[idx], i + 1, effectsSet);

      // Cache intermediate results
      effectsCache[i + 1] = effectsList;
    }

    return effectsList;
  }
}
