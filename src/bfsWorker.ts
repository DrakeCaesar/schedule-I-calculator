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

self.onmessage = (event: MessageEvent) => {
  const { type, workerId: id, data } = event.data || {}; // Safely destructure event.data

  if (type === "start" && data) {
    workerId = id;
    isPaused = false;
    combinationsProcessed = 0;
    depthCombinationsProcessed = 0;
    currentDepth = data.queue[0].length; // Start at depth 1 with our initial substance
    currentProduct = { ...data.product };
    currentSubstanceName = data.substanceName;
    startTime = Date.now();

    // Calculate max combinations for this worker
    // Starting with a specific substance, so our combinations are reduced
    const substanceCount = substances.length;
    maxCombinations = 0;

    // We start at depth = 1 (our initial substance), and go up to MAX_RECIPE_DEPTH
    for (let i = currentDepth; i <= MAX_RECIPE_DEPTH; i++) {
      if (i === 1) {
        maxCombinations += 1; // Just our one substance at depth 1
      } else {
        maxCombinations += Math.pow(substanceCount, i - 1); // For depths > 1
      }
    }

    // Calculate initial combinations for first depth
    depthMaxCombinations = data.queue.length; // Just 1 at the start

    runBFS(data.queue, data.bestMix);
  } else if (type === "pause") {
    isPaused = true;
  } else if (type === "resume") {
    isPaused = false;
  } else {
    console.error("Invalid message received by worker:", event.data);
  }
};

function runBFS(queue: string[][], bestMix: { mix: string[]; profit: number }) {
  let lastProgressUpdate = Date.now();
  let itemsProcessedSinceUpdate = 0;

  while (queue.length > 0 && !isPaused) {
    const currentMix = queue.shift()!;
    combinationsProcessed++;
    depthCombinationsProcessed++;
    itemsProcessedSinceUpdate++;

    // Check if we need to move to the next depth
    if (currentMix.length > currentDepth) {
      currentDepth = currentMix.length;

      // Reset depth-specific counters
      depthCombinationsProcessed = 1; // Start at 1 because we're processing the first item of this depth

      // Calculate max combinations for this depth
      const substanceCount = substances.length;
      depthMaxCombinations = Math.pow(substanceCount, currentDepth - 1);

      // Send progress update when we move to next depth
      sendProgressUpdate();
      lastProgressUpdate = Date.now();
      itemsProcessedSinceUpdate = 0;

      if (currentDepth > MAX_RECIPE_DEPTH) break; // Stop if mix length exceeds MAX_RECIPE_DEPTH
    }

    const effectsList = calculateEffects(currentMix);
    const sellPrice = currentProduct
      ? calculateFinalPrice(currentProduct.name, effectsList)
      : 0;
    const cost = calculateFinalCost(currentMix);
    const profit = sellPrice - cost;

    if (profit > bestMix.profit) {
      bestMix = { mix: currentMix, profit };
      self.postMessage({
        type: "update",
        bestMix,
        sellPrice,
        cost,
        profit,
        workerId,
      });
    }

    if (currentMix.length < MAX_RECIPE_DEPTH) {
      // Use the cached names array for faster iteration
      for (const substanceName of substanceNames) {
        queue.push([...currentMix, substanceName]);
      }
    }

    // Send progress updates periodically to avoid flooding the main thread
    // Only check time after processing a batch of items for better performance
    if (itemsProcessedSinceUpdate >= BATCH_SIZE) {
      const now = Date.now();
      if (now - lastProgressUpdate > PROGRESS_UPDATE_INTERVAL) {
        sendProgressUpdate();
        lastProgressUpdate = now;
        itemsProcessedSinceUpdate = 0;
      }
    }
  }

  if (!isPaused) {
    // Send a final progress update
    sendProgressUpdate();
    self.postMessage({
      type: "done",
      bestMix,
      executionTime: Date.now() - startTime,
      workerId,
    });
  }
}

function sendProgressUpdate() {
  const executionTime = Date.now() - startTime;

  self.postMessage({
    type: "progress",
    depth: currentDepth,
    processed: depthCombinationsProcessed,
    total: depthMaxCombinations,
    totalProcessed: combinationsProcessed,
    grandTotal: maxCombinations,
    executionTime: executionTime,
    workerId,
  });
}

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
