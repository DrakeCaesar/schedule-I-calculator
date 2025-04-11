// Shared utility functions for the application

import { applySubstanceRules, substances } from "./substances";

// Fast substance lookups using Map for better performance
const substanceMap = new Map(
  substances.map((substance) => [substance.name, substance])
);

/**
 * Memory-optimized version of calculateEffects
 * Uses Sets for faster lookup and Map for substance access
 */
export function calculateEffects(
  mix: string[],
  initialEffect: string | undefined
): string[] {
  if (!mix || mix.length === 0) {
    return initialEffect ? [initialEffect] : [];
  }

  // Use Sets for faster lookup
  let effectsList = initialEffect ? [initialEffect] : [];

  // Process each substance in order
  let recipeLength = 0;
  for (const substanceName of mix) {
    recipeLength++;
    const substance = substanceMap.get(substanceName);
    if (!substance) continue;

    // Apply substance rules to effects
    effectsList = applySubstanceRules(effectsList, substance, recipeLength);
  }

  return effectsList;
}
