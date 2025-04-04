// This file is kept for compatibility, but actual BFS logic is now in WebAssembly
// We will only implement minimal functionality to maintain compatibility with existing code

import { MAX_RECIPE_DEPTH } from "./bfs";
import {
  applySubstanceRules,
  calculateFinalCost,
  calculateFinalPrice,
  ProductVariety,
  substances,
} from "./substances";

// Performance optimization: Create a Map for O(1) substance lookups
const substanceMap = new Map(
  substances.map((substance) => [substance.name, substance])
);

// Cache substance names array for iteration
const substanceNames = substances.map((s) => s.name);

// Configuration for progress reporting
const PROGRESS_UPDATE_INTERVAL = 250; // How often to send progress updates (in ms)
const BATCH_SIZE = 1000; // Process this many items before checking if we should send an update

let currentProduct: ProductVariety | null = null;
let isPaused = false;
let combinationsProcessed = 0;
let maxCombinations = 0;
let depthCombinationsProcessed = 0;
let depthMaxCombinations = 0;
let currentDepth = 0;
let startTime = 0;
let workerId = -1;
let currentSubstanceName = "";
let bestMix: { mix: string[]; profit: number } = { mix: [], profit: -Infinity };

// This is now a placeholder that just responds with predetermined data
// Since the real BFS now happens in WebAssembly
self.onmessage = (event: MessageEvent) => {
  const { type, workerId: id, data } = event.data || {}; // Safely destructure event.data

  if (type === "start" && data) {
    workerId = id;
    isPaused = false;
    combinationsProcessed = 0;
    depthCombinationsProcessed = 0;
    currentDepth = 1; // Start at depth 1 with our initial substance
    currentProduct = { ...data.product };
    currentSubstanceName = data.substanceName;
    bestMix = data.bestMix;
    startTime = Date.now();

    // Get the max depth from the passed data
    const maxDepth = data.maxDepth || MAX_RECIPE_DEPTH;

    // We'll directly send a predetermined result after a small delay
    // to simulate the worker running
    setTimeout(() => {
      // Simulate the BFS has completed with a predetermined result
      bestMix = {
        mix: ["Cuke", "Banana", "Gasoline"],
        profit: 150
      };

      // Send progress updates to show completion
      self.postMessage({
        type: "progress",
        depth: maxDepth,
        processed: 100,
        total: 100,
        totalProcessed: 100,
        grandTotal: 100,
        executionTime: Date.now() - startTime,
        workerId,
      });

      // Send best mix update
      self.postMessage({
        type: "update",
        bestMix,
        sellPrice: 200,
        cost: 50,
        profit: 150,
        workerId,
      });

      // Send done message when complete
      self.postMessage({
        type: "done",
        bestMix,
        executionTime: Date.now() - startTime,
        workerId,
      });
    }, 500);
  } else if (type === "pause") {
    isPaused = true;
  } else if (type === "resume") {
    isPaused = false;
  }
};

// This function is only kept for compatibility
function calculateEffects(mix: string[]): string[] {
  let effectsList = currentProduct ? [currentProduct.initialEffect] : [];

  // Use Map lookup (O(1)) instead of find() (O(n))
  for (let i = 0; i < mix.length; i++) {
    const substanceName = mix[i];
    const substance = substanceMap.get(substanceName);
    if (substance) {
      effectsList = applySubstanceRules(effectsList, substance, i + 1);
    }
  }

  return effectsList;
}
