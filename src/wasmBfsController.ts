// WebAssembly BFS Controller
// Manages the WebAssembly implementation of the BFS algorithm

import { MAX_RECIPE_DEPTH } from "./bfsCommon";
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
import { ProductVariety } from "./substances";

// State variables for WebAssembly BFS
let wasmBfsRunning = false;
let wasmBestMix: BfsMixResult = {
  mix: [],
  profit: -Infinity,
};
let wasmCurrentProduct: ProductVariety | null = null;
let wasmStartTime = 0;
let wasmBfsWorker: Worker | null = null;

// Progress tracking
let lastWasmProgressUpdate = 0;
// Add variables to track processed combinations
let totalProcessedCombinations = 0;
let totalCombinations = 0;

export function updateWasmBestMixDisplay() {
  if (!wasmCurrentProduct) return;
  updateBestMixDisplay("wasm", wasmBestMix, wasmCurrentProduct);
}

export function updateWasmProgressDisplay(
  progress: number,
  forceUpdate = false
) {
  // Create a progress data object for the shared component
  const progressData: ProgressData = {
    processed: totalProcessedCombinations,
    total: totalCombinations || 100, // Avoid division by zero
    depth: 0, // WASM doesn't always provide depth info
    executionTime: wasmStartTime > 0 ? Date.now() - wasmStartTime : 0,
  };

  // If the progress is 100%, make sure processed equals total for proper display
  if (progress >= 100) {
    progressData.processed = progressData.total;
  }

  // Use the shared progress display component
  lastWasmProgressUpdate = updateProgressDisplay(
    "wasm",
    progressData,
    lastWasmProgressUpdate,
    forceUpdate || progress === 100 // Force update if progress is 100%
  );
}

// Create message handler for the WebAssembly worker
function createWasmWorkerMessageHandler() {
  return function (event: MessageEvent) {
    const { type } = event.data;

    if (type === "update") {
      const { bestMix: updatedBestMix } = event.data;

      // Update our best mix with the result from the worker
      wasmBestMix = updatedBestMix;
      updateWasmBestMixDisplay();
    } else if (type === "progress") {
      // Calculate progress percentage if we have the necessary data
      let progress = 0;

      // Track combinations processed/total for display
      if (
        event.data.processed !== undefined &&
        event.data.total !== undefined
      ) {
        totalProcessedCombinations = event.data.processed;
        totalCombinations = event.data.total;

        // Calculate percentage if total is greater than zero
        if (totalCombinations > 0) {
          progress = Math.min(
            100,
            Math.round((totalProcessedCombinations / totalCombinations) * 100)
          );
        }
      } else if (event.data.progress !== undefined) {
        // If we already have a percentage, use that
        progress = event.data.progress;
      }

      // Force progress to 100% if we're done
      if (event.data.isFinal) {
        progress = 100;
        // Ensure processed equals total for the final update
        totalProcessedCombinations = totalCombinations;
      }

      // Update the progress display
      updateWasmProgressDisplay(progress, event.data.isFinal);
    } else if (type === "done") {
      // When the calculation is complete, make sure we show 100% progress
      // Ensure processed equals total
      if (totalCombinations > 0) {
        totalProcessedCombinations = totalCombinations;
      } else if (totalProcessedCombinations > 0) {
        totalCombinations = totalProcessedCombinations;
      } else {
        // If we don't have either value, set some reasonable defaults
        totalProcessedCombinations = 100;
        totalCombinations = 100;
      }

      // Force a final progress update to 100% when done
      updateWasmProgressDisplay(100, true);

      // Mark the WASM BFS as complete
      wasmBfsRunning = false;

      // Update button text
      const wasmBfsButton = document.getElementById("wasmBfsButton");
      if (wasmBfsButton) {
        wasmBfsButton.textContent = "Start WASM BFS";
      }

      // Clean up worker reference
      wasmBfsWorker = null;
    } else if (type === "error") {
      console.error("WASM BFS worker error:", event.data.error);
      alert(`WASM BFS error: ${event.data.error}`);

      // Mark the WASM BFS as complete
      wasmBfsRunning = false;

      // Update button text
      const wasmBfsButton = document.getElementById("wasmBfsButton");
      if (wasmBfsButton) {
        wasmBfsButton.textContent = "Start WASM BFS";
      }

      // Clean up worker reference
      wasmBfsWorker = null;
    }
  };
}

// Function to start WebAssembly BFS implementation
export async function startWasmBFS(product: ProductVariety) {
  wasmBfsRunning = true;
  wasmBestMix = { mix: [], profit: -Infinity };
  wasmCurrentProduct = product;
  wasmStartTime = Date.now();

  // Reset progress tracking
  totalProcessedCombinations = 0;
  totalCombinations = 0;
  lastWasmProgressUpdate = 0;

  // Create worker
  const worker = new Worker(new URL("./wasmBfsWorker.ts", import.meta.url), {
    type: "module",
  });

  // Set up worker message handler
  worker.onmessage = createWasmWorkerMessageHandler();

  // Start the worker
  worker.postMessage({
    type: "start",
    workerId: 0, // Only one WASM worker
    data: {
      product: { ...product },
      bestMix: wasmBestMix,
      maxDepth: MAX_RECIPE_DEPTH,
    },
  });

  // Store the worker reference in case we need to terminate it
  wasmBfsWorker = worker;
}

// Function to run only the WebAssembly BFS
export async function toggleWasmBFS(product: ProductVariety) {
  const wasmBfsButton = document.getElementById("wasmBfsButton");
  if (!wasmBfsButton) return;

  // Check if WASM implementation is running
  if (wasmBfsRunning) {
    // Stop the WASM BFS
    wasmBfsRunning = false;

    // Terminate the worker if it exists
    if (wasmBfsWorker) {
      wasmBfsWorker.terminate();
      wasmBfsWorker = null;
    }

    wasmBfsButton.textContent = "Start WASM BFS";
  } else {
    // Create displays using the shared components
    createProgressDisplay("wasm");
    createBestMixDisplay("wasm");

    // Start WebAssembly BFS
    wasmBfsButton.textContent = "Stop WASM BFS";
    startWasmBFS(product);
  }
}

// Export state getters
export function isWasmBfsRunning(): boolean {
  return wasmBfsRunning;
}

export function getWasmBestMix(): BfsMixResult {
  return wasmBestMix;
}
