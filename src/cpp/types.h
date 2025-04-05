#pragma once

#include <string>
#include <vector>
#include <unordered_map>
#include <functional>
#include <emscripten/val.h>

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
  double cost;
  std::string defaultEffect;
  std::vector<SubstanceRule> rules;
};

struct Product
{
  std::string name;
  std::string initialEffect;
};

// Simple struct for the result
struct JsBestMixResult
{
  emscripten::val mixArray; // Using emscripten::val to store JavaScript array
  double profit;
  double sellPrice;
  double cost;
};

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
