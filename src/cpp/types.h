#pragma once

#include <string>
#include <vector>
#include <unordered_map>
#include <functional>

// Include Emscripten headers only when building for WebAssembly
#ifdef __EMSCRIPTEN__
#include <emscripten/val.h>
#endif

// Progress reporting function type
typedef std::function<void(int, int, int)> ProgressCallback;

// Data structures that mirror the TypeScript ones
struct Effect
{
  std::string name;
  double multiplier;
};

struct SubstanceRule
{
  std::string type; // "replace" or "add"
  std::vector<std::string> condition;
  std::vector<std::string> ifNotPresent;
  std::string target;
  std::string withEffect;
};

struct Substance
{
  std::string name;
  int cost; // Changed from double to int (representing cents)
  std::string defaultEffect;
  std::vector<SubstanceRule> rules;
};

struct Product
{
  std::string name;
  std::string initialEffect;
};

// Define different result structs based on build type
#ifdef __EMSCRIPTEN__
// WebAssembly version with emscripten::val
struct JsBestMixResult
{
  emscripten::val mixArray; // Using emscripten::val to store JavaScript array
  int profitCents;          // Integer cents instead of double dollars
  int sellPriceCents;       // Integer cents instead of double dollars
  int costCents;            // Integer cents instead of double dollars
  
  // Add these fields for backward compatibility
  double profit;            // Dollar value (cents / 100.0)
  double sellPrice;         // Dollar value (cents / 100.0)
  double cost;              // Dollar value (cents / 100.0)
};
#else
// Native version with std::vector
struct JsBestMixResult
{
  std::vector<std::string> mixArray;
  int profitCents;    // Integer cents instead of double dollars
  int sellPriceCents; // Integer cents instead of double dollars
  int costCents;      // Integer cents instead of double dollars
  
  // Add these fields for backward compatibility
  double profit;      // Dollar value (cents / 100.0)
  double sellPrice;   // Dollar value (cents / 100.0)
  double cost;        // Dollar value (cents / 100.0)
};
#endif

// Memory-efficient mix representation
// Instead of storing multiple copies of string vectors, store indices
struct MixState
{
  std::vector<size_t> substanceIndices; // Indices into substances vector

  explicit MixState(size_t initialCapacity = 6)
  {
    substanceIndices.reserve(initialCapacity);
  }

  MixState(const MixState &other)
  {
    substanceIndices = other.substanceIndices;
  }

  void addSubstance(size_t index)
  {
    substanceIndices.push_back(index);
  }

  // Convert to a vector of substance names for final result
  std::vector<std::string> toSubstanceNames(const std::vector<Substance> &substances) const
  {
    std::vector<std::string> names;
    names.reserve(substanceIndices.size());
    for (size_t idx : substanceIndices)
    {
      names.push_back(substances[idx].name);
    }
    return names;
  }
};
