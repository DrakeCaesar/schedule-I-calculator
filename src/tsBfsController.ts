// TypeScript BFS Controller
// Manages the TypeScript implementation of the BFS algorithm

import { MAX_RECIPE_DEPTH, scheduleDomUpdate } from "./bfsCommon";
import {
  BfsMixResult,
  createBestMixDisplay,
  updateBestMixDisplay,
} from "./bfsMixDisplay";
import {
  createProgressDisplay,
  ProgressData,
  updateProgressDisplay,
} from "./bfsProgress";
import {
  calculateFinalCost,
  calculateFinalPrice,
  ProductVariety,
  substances,
} from "./substances";

// State variables for TypeScript BFS
let tsBfsRunning = false;
let tsBfsPaused = false;
let tsBestMix: BfsMixResult = {
  mix: [],
  profit: -Infinity,
};
let tsBfsWorkers: Worker[] = [];
let tsCurrentProduct: ProductVariety | null = null;
let tsActiveWorkers = 0;
let tsStartTime = 0;

// Fast substance lookups using Map
const substanceMap = new Map(
  substances.map((substance) => [substance.name, substance])
);

// Track progress for each worker
type WorkerProgress = {
  substanceName: string;
  depth: number;
  processed: number;
  total: number;
  totalProcessed: number;
  grandTotal: number;
  executionTime: number;
};

// Use Map instead of object for better performance with frequent updates
let workersProgress: Map<number, WorkerProgress> = new Map();

// Throttled progress updates
let lastTsProgressUpdate = 0;

// Memory-optimized version of calculateEffects
// Uses Sets for faster lookup
export function calculateEffects(
  mix: string[],
  initialEffect: string
): string[] {
  const effectsSet = new Set([initialEffect]);

  for (let i = 0; i < mix.length; i++) {
    const substanceName = mix[i];
    const substance = substanceMap.get(substanceName);

    if (substance) {
      // Apply rules for this substance
      for (const rule of substance.rules) {
        // Check conditions
        let conditionsMet = true;
        for (const condName of rule.condition) {
          if (!effectsSet.has(condName)) {
            conditionsMet = false;
            break;
          }
        }

        if (!conditionsMet) continue;

        // Check exclusions
        let exclusionsMet = true;
        for (const npName of rule.ifNotPresent || []) {
          if (effectsSet.has(npName)) {
            exclusionsMet = false;
            break;
          }
        }

        if (!exclusionsMet) continue;

        // Apply rule
        if (rule.type === "replace" && rule.withEffect) {
          if (effectsSet.has(rule.target) && !effectsSet.has(rule.withEffect)) {
            effectsSet.delete(rule.target);
            effectsSet.add(rule.withEffect);
          }
        } else if (rule.type === "add") {
          if (!effectsSet.has(rule.target)) {
            effectsSet.add(rule.target);
          }
        }
      }

      // Ensure default effect is present
      if (i + 1 < 9 && !effectsSet.has(substance.defaultEffect)) {
        effectsSet.add(substance.defaultEffect);
      }
    }
  }

  return Array.from(effectsSet);
}

export function updateTsBestMixDisplay() {
  if (!tsCurrentProduct) return;

  // Use existing properties if available to avoid recalculation
  let sellPrice = tsBestMix.sellPrice;
  let cost = tsBestMix.cost;

  if (sellPrice === undefined || cost === undefined) {
    const effectsList = calculateEffects(
      tsBestMix.mix,
      tsCurrentProduct.initialEffect
    );
    sellPrice = calculateFinalPrice(tsCurrentProduct.name, effectsList);
    cost = calculateFinalCost(tsBestMix.mix);

    // Cache values for future use
    tsBestMix.sellPrice = sellPrice;
    tsBestMix.cost = cost;
  }

  // Update with explicit algorithm type for consistency with other controllers
  updateBestMixDisplay("ts", tsBestMix, tsCurrentProduct, "BFS");
}

// Standard progress display update that matches other controllers
export function updateTsProgressDisplay(forceUpdate = false) {
  const totalProcessed = Array.from(workersProgress.values()).reduce(
    (sum, progress) => sum + progress.totalProcessed,
    0
  );
  const grandTotal = Array.from(workersProgress.values()).reduce(
    (sum, progress) => sum + progress.grandTotal,
    0
  );
  const executionTime = tsStartTime > 0 ? Date.now() - tsStartTime : 0;

  // Find the maximum depth across all workers
  const maxWorkerDepth = Math.max(
    ...Array.from(workersProgress.values()).map(
      (progress) => progress.depth || 0
    )
  );

  // Create a progress data object for the shared component
  const progressData: ProgressData = {
    processed: totalProcessed,
    total: grandTotal || 100, // Avoid division by zero
    depth: maxWorkerDepth,
    executionTime,
    message: tsBfsRunning
      ? tsBfsPaused
        ? "Paused"
        : "Processing..."
      : totalProcessed > 0
      ? "Calculation complete"
      : "Ready",
    algorithm: "BFS",
    forceUpdate,
  };

  // Use the shared progress display component with the standard pattern
  lastTsProgressUpdate = updateProgressDisplay(
    "ts-bfs",
    progressData,
    lastTsProgressUpdate
  );

  // If we have worker progress information, add it to the display
  if (workersProgress.size > 0 && tsBfsRunning) {
    addWorkerDetailsToProgressDisplay();
  }
}

// Helper function to add worker details to the progress display
function addWorkerDetailsToProgressDisplay() {
  const progressDisplay = document.getElementById("ts-bfsProgressDisplay");
  if (!progressDisplay) return;

  // Create worker progress HTML
  const workerProgressHTML = Array.from(workersProgress.entries())
    .map(([id, progress]) => {
      // Calculate percentage for current worker's depth
      const depthPercentage =
        Math.min(
          100,
          Math.round((progress.processed / Math.max(1, progress.total)) * 100)
        ) || 0;

      return `
        <div class="worker-progress">
          <div class="worker-header">
            <span class="worker-name">${progress.substanceName}</span>
            <span class="worker-depth">Depth: ${progress.depth}/${MAX_RECIPE_DEPTH}</span>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar" style="width: ${depthPercentage}%"></div>
            <span class="progress-text" data-progress="${depthPercentage}%" style="--progress-percent: ${depthPercentage}%"></span>
          </div>
        </div>
      `;
    })
    .join("");

  // Schedule the DOM update for worker details
  scheduleDomUpdate(() => {
    // Check if we already have a workers container
    let workersContainer = progressDisplay.querySelector(".workers-container");

    if (!workersContainer) {
      workersContainer = document.createElement("div");
      workersContainer.className = "workers-container";
      workersContainer.innerHTML = `<h4>Worker Status</h4>`;
      progressDisplay.appendChild(workersContainer);
    }

    // Update worker details
    workersContainer.innerHTML = `
      <h4>Worker Status</h4>
      ${workerProgressHTML}
    `;
  });
}

// Optimize worker message handler to reduce memory allocations
function createTsWorkerMessageHandler(workerId: number, substanceName: string) {
  return function (event: MessageEvent) {
    const { type } = event.data;

    if (type === "update") {
      const { bestMix: updatedBestMix } = event.data;

      // Only update if this mix is better than our current best mix
      if (updatedBestMix.profit > tsBestMix.profit) {
        // Copy only necessary properties to avoid memory bloat
        tsBestMix.mix = updatedBestMix.mix;
        tsBestMix.profit = updatedBestMix.profit;
        tsBestMix.sellPrice = updatedBestMix.sellPrice;
        tsBestMix.cost = updatedBestMix.cost;
        updateTsBestMixDisplay();
      }
    } else if (type === "progress") {
      const {
        depth,
        processed,
        total,
        totalProcessed,
        grandTotal,
        executionTime,
        isFinal, // Check for final update flag
      } = event.data;

      // Update this worker's progress
      workersProgress.set(workerId, {
        substanceName,
        depth,
        processed,
        total,
        totalProcessed,
        grandTotal,
        executionTime,
      });

      // Force update if this is the final progress message
      updateTsProgressDisplay(isFinal === true);
    } else if (type === "done") {
      // Get the worker's final stats before updating
      const workerProgress = workersProgress.get(workerId);

      if (workerProgress) {
        // Set processed counts to their maximum values to show 100% completion
        workerProgress.processed = workerProgress.total;
        workerProgress.totalProcessed = workerProgress.grandTotal;

        // Update the worker's progress with complete status
        workersProgress.set(workerId, workerProgress);
      }

      tsActiveWorkers--;

      // Check if this was the last worker to finish
      if (tsActiveWorkers === 0) {
        tsBfsRunning = false;
        const tsBfsButton = document.getElementById("tsBfsButton");
        if (tsBfsButton) {
          tsBfsButton.textContent = "Start TS BFS";
        }
      }

      // Final update of progress display with force update
      updateTsProgressDisplay(true);
    }
  };
}

// Function to start TypeScript BFS implementation
export async function startTsBFS(product: ProductVariety) {
  tsBfsRunning = true;
  tsBfsPaused = false;
  tsBestMix = { mix: [], profit: -Infinity };
  tsCurrentProduct = product;
  tsStartTime = Date.now();

  // Clean up any existing workers
  tsBfsWorkers.forEach((worker) => worker.terminate());
  tsBfsWorkers = [];
  workersProgress = new Map();
  tsActiveWorkers = 0;

  // Create a worker for each substance
  for (let i = 0; i < substances.length; i++) {
    const substanceName = substances[i].name;

    // Create worker
    const worker = new Worker(new URL("./tsBfsWorker.ts", import.meta.url), {
      type: "module",
    });

    // Set up worker message handler
    worker.onmessage = createTsWorkerMessageHandler(i, substanceName);

    // Store the worker
    tsBfsWorkers.push(worker);

    // Initialize this worker's progress
    workersProgress.set(i, {
      substanceName,
      depth: 1, // Starting with one substance
      processed: 0,
      total: 1,
      totalProcessed: 0,
      grandTotal: 0,
      executionTime: 0,
    });

    // Start the worker
    worker.postMessage({
      type: "start",
      workerId: i,
      data: {
        product: { ...product },
        bestMix: tsBestMix,
        substanceName,
        maxDepth: MAX_RECIPE_DEPTH, // Pass the current max depth to the worker
      },
    });

    tsActiveWorkers++;
  }

  updateTsProgressDisplay();
}

// Function to run only the TypeScript BFS
export async function toggleTsBFS(product: ProductVariety) {
  const tsBfsButton = document.getElementById("tsBfsButton");
  if (!tsBfsButton) return;

  // Check if TS implementation is running
  if (tsBfsRunning) {
    tsBfsPaused = !tsBfsPaused;
    // Pause or resume all workers
    const messageType = tsBfsPaused ? "pause" : "resume";
    tsBfsWorkers.forEach((worker) => {
      worker.postMessage({ type: messageType });
    });
    tsBfsButton.textContent = tsBfsPaused ? "Resume TS BFS" : "Pause TS BFS";
  } else {
    // Create the progress and result displays
    createProgressDisplay("ts-bfs");
    createBestMixDisplay("ts");

    // Start TypeScript BFS
    tsBfsButton.textContent = "Pause TS BFS";
    startTsBFS(product);
  }
}

// Export state getters
export function isTsBfsRunning(): boolean {
  return tsBfsRunning;
}

export function getTsBestMix(): BfsMixResult {
  return tsBestMix;
}
