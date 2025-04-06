// TypeScript BFS Controller
// Manages the TypeScript implementation of the BFS algorithm

import { MAX_RECIPE_DEPTH, scheduleDomUpdate } from "./bfsCommon";
import {
  calculateFinalCost,
  calculateFinalPrice,
  ProductVariety,
  substances,
} from "./substances";

// State variables for TypeScript BFS
let tsBfsRunning = false;
let tsBfsPaused = false;
let tsBestMix: {
  mix: string[];
  profit: number;
  sellPrice?: number;
  cost?: number;
} = {
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
const PROGRESS_UPDATE_INTERVAL = 250; // ms

// Helper function to create effect span HTML
function createEffectSpan(effect: string): string {
  // Convert effect name to kebab case for CSS class
  const className = effect.replace(/\s+/g, "-");
  return `<span class="effect effect-${className}">${effect}</span>`;
}

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
  const bestMixDisplay = document.getElementById("tsBestMixDisplay");
  if (!bestMixDisplay || !tsCurrentProduct) return;

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

  const profit = sellPrice - cost;

  // Schedule the DOM update to avoid layout thrashing
  scheduleDomUpdate(() => {
    // Only calculate effects for display
    const effectsList = calculateEffects(
      tsBestMix.mix,
      tsCurrentProduct?.initialEffect || ""
    );
    const effectsHTML = effectsList
      .map((effect) => createEffectSpan(effect))
      .join(" ");

    bestMixDisplay.innerHTML = `
      <h3>TypeScript BFS Result for ${tsCurrentProduct?.name}</h3>
      <p>Mix: ${tsBestMix.mix.join(", ")}</p>
      <p>Effects: ${effectsHTML}</p>
      <p>Sell Price: $${sellPrice?.toFixed(2)}</p>
      <p>Cost: $${cost?.toFixed(2)}</p>
      <p>Profit: $${profit.toFixed(2)}</p>
    `;

    // Make sure the display is visible
    bestMixDisplay.style.display = "block";
  });
}

// Utility functions for time formatting
import { formatClockTime, formatTime } from "./bfsCommon";

export function updateTsProgressDisplay(forceUpdate = false) {
  const currentTime = Date.now();

  // Only update every PROGRESS_UPDATE_INTERVAL ms, unless forceUpdate is true
  if (
    !forceUpdate &&
    currentTime - lastTsProgressUpdate < PROGRESS_UPDATE_INTERVAL
  ) {
    return;
  }

  lastTsProgressUpdate = currentTime;

  const progressDisplay = document.getElementById("tsBfsProgressDisplay");
  if (!progressDisplay) return;

  // Calculate overall progress across all workers
  let totalProcessed = 0;
  let grandTotal = 0;
  const now = Date.now();
  const executionTime = tsStartTime > 0 ? now - tsStartTime : 0;

  // Sum up totals from all workers
  workersProgress.forEach((progress) => {
    totalProcessed += progress.totalProcessed;
    grandTotal += progress.grandTotal;
  });

  // Calculate overall percentage
  const overallPercentage =
    Math.min(100, Math.round((totalProcessed / grandTotal) * 100)) || 0;

  // Estimate remaining time
  const remainingTime =
    totalProcessed > 0
      ? Math.round(
          (executionTime / totalProcessed) * (grandTotal - totalProcessed)
        )
      : 0;
  const estimatedFinishTime = now + remainingTime;

  // Schedule the DOM update
  scheduleDomUpdate(() => {
    // Create HTML for overall progress
    const overallProgressHTML = `
      <div class="overall-progress">
        <h4>TypeScript BFS Progress</h4>
        <div>Total processed: ${totalProcessed.toLocaleString()} / ${grandTotal.toLocaleString()}</div>
        <div class="progress-bar-container">
          <div class="progress-bar" style="width: ${overallPercentage}%"></div>
          <span class="progress-text" data-progress="${overallPercentage}%" style="--progress-percent: ${overallPercentage}%"></span>
        </div>
        <div>Execution time: ${formatTime(executionTime)}</div>
        <div>Estimated time remaining: ${formatTime(remainingTime)}</div>
        <div>Estimated finish time: ${formatClockTime(
          estimatedFinishTime
        )}</div>
      </div>
    `;

    // Create more compact HTML for each worker's progress
    const workerProgressHTML = Array.from(workersProgress.entries())
      .map(([id, progress]) => {
        // Calculate percentage for current worker's depth
        const depthPercentage =
          Math.min(
            100,
            Math.round((progress.processed / progress.total) * 100)
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

    progressDisplay.innerHTML = `
      ${overallProgressHTML}
      <div class="workers-container">
        <h4>Worker Status</h4>
        ${workerProgressHTML}
      </div>
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
        const bfsButton = document.getElementById("bfsButton");
        if (bfsButton) {
          bfsButton.textContent = "Start Both BFS";
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

// Function to create TypeScript progress display
export function createTsProgressDisplay() {
  let tsProgressDisplay = document.getElementById("tsBfsProgressDisplay");
  if (!tsProgressDisplay) {
    tsProgressDisplay = document.createElement("div");
    tsProgressDisplay.id = "tsBfsProgressDisplay";
    tsProgressDisplay.classList.add("progress-display");

    const tsColumn = document.querySelector(".ts-column");
    if (tsColumn) {
      // Find if there's already a progress display in this column
      const existingDisplay = tsColumn.querySelector(".progress-display");
      if (existingDisplay) {
        tsColumn.replaceChild(tsProgressDisplay, existingDisplay);
      } else {
        tsColumn.appendChild(tsProgressDisplay);
      }
    } else {
      // Fallback - append to BFS section
      const bfsSection = document.getElementById("bfsSection");
      if (bfsSection) {
        bfsSection.appendChild(tsProgressDisplay);
      }
    }
  }

  updateTsProgressDisplay();
}

// Function to create TypeScript result display
export function createTsResultDisplay() {
  let tsBestMixDisplay = document.getElementById("tsBestMixDisplay");
  if (!tsBestMixDisplay) {
    tsBestMixDisplay = document.createElement("div");
    tsBestMixDisplay.id = "tsBestMixDisplay";
    tsBestMixDisplay.classList.add("best-mix-display");

    const tsColumn = document.querySelector(".ts-column");
    if (tsColumn) {
      // Find if there's already a results display in this column
      const existingDisplay = tsColumn.querySelector(".best-mix-display");
      if (existingDisplay) {
        tsColumn.replaceChild(tsBestMixDisplay, existingDisplay);
      } else {
        // Insert at beginning of column
        tsColumn.insertBefore(tsBestMixDisplay, tsColumn.firstChild);
      }
    } else {
      // Fallback - append to BFS section
      const bfsSection = document.getElementById("bfsSection");
      if (bfsSection) {
        bfsSection.appendChild(tsBestMixDisplay);
      }
    }
  }
}

// Function to run only the TypeScript BFS
export async function toggleTsBFS(product: ProductVariety) {
  const tsBfsButton = document.getElementById("tsBfsButton");
  if (!tsBfsButton) return;

  // Get the current max depth value from slider
  const maxDepthSlider = document.getElementById(
    "maxDepthSlider"
  ) as HTMLInputElement;
  if (maxDepthSlider) {
    // Using the imported MAX_RECIPE_DEPTH from common
  }

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
    // Create only the TS progress display
    createTsProgressDisplay();
    // Create only the TS result display
    createTsResultDisplay();

    // Start TypeScript BFS
    tsBfsButton.textContent = "Pause TS BFS";
    startTsBFS(product);
  }
}

// Export state getters
export function isTsBfsRunning(): boolean {
  return tsBfsRunning;
}

export function getTsBestMix(): {
  mix: string[];
  profit: number;
  sellPrice?: number;
  cost?: number;
} {
  return tsBestMix;
}
