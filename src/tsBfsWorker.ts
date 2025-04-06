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
    const maxDepth = data.maxDepth || 5; // Default to 5 if not provided

    // Calculate max combinations for this worker
    // Starting with a specific substance, so our combinations are reduced
    const substanceCount = substances.length;
    maxCombinations = 0;

    // We start at depth = 1 (our initial substance), and go up to maxDepth
    for (let i = currentDepth; i <= maxDepth; i++) {
      if (i === 1) {
        maxCombinations += 1; // Just our one substance at depth 1
      } else {
        maxCombinations += Math.pow(substanceCount, i - 1); // For depths > 1
      }
    }

    // Calculate initial combinations for first depth
    depthMaxCombinations = 1; // Just 1 at the start

    // Process the initial substance
    processMix([data.substanceName], maxDepth);

    // Send final progress update with completed state before done message
    self.postMessage({
      type: "progress",
      depth: maxDepth,
      processed: depthMaxCombinations, // Set to total to show 100%
      total: depthMaxCombinations,
      totalProcessed: maxCombinations, // Set to total to show 100%
      grandTotal: maxCombinations,
      progress: 100, // Add explicit progress percentage
      isFinal: true, // Add flag to indicate this is the final update
      executionTime: Date.now() - startTime,
      workerId,
    });

    // Send done message when complete
    self.postMessage({
      type: "done",
      bestMix,
      executionTime: Date.now() - startTime,
      workerId,
    });
  } else if (type === "pause") {
    isPaused = true;
  } else if (type === "resume") {
    isPaused = false;
  } else {
    console.error("Invalid message received by worker:", event.data);
  }
};

function processMix(currentMix: string[], maxDepth: number) {
  if (isPaused) return;

  // Process the current mix
  combinationsProcessed++;
  depthCombinationsProcessed++;

  // Check if we need to move to the next depth
  if (currentMix.length > currentDepth) {
    currentDepth = currentMix.length;

    // Reset depth-specific counters
    depthCombinationsProcessed = 1;

    // Calculate max combinations for this depth
    const substanceCount = substances.length;
    depthMaxCombinations = Math.pow(substanceCount, currentDepth - 1);

    // Send progress update when we move to next depth
    sendProgressUpdate();
  }

  // Process current combination
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

  // If we haven't reached max depth, continue adding substances
  if (currentMix.length < maxDepth) {
    // Periodically send progress updates
    if (combinationsProcessed % BATCH_SIZE === 0) {
      sendProgressUpdate();
    }

    // Continue to next depth with each substance
    for (const substanceName of substanceNames) {
      processMix([...currentMix, substanceName], maxDepth);
      if (isPaused) return;
    }
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
