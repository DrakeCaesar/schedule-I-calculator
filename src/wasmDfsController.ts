// WebAssembly DFS Controller
// Manages the WebAssembly implementation of the DFS algorithm

import { MAX_RECIPE_DEPTH } from "./bfsCommon";
import {
  BfsMixResult,
  createBestMixDisplay,
  updateBestMixDisplay,
} from "./bfsMixDisplay";
import { 
  createProgressDisplay, 
  updateProgressDisplay, 
  ProgressData,
  PROGRESS_UPDATE_INTERVAL 
} from "./bfsProgress";
import { ProductVariety } from "./substances";

// State variables for WebAssembly DFS
let wasmDfsRunning = false;
let wasmDfsBestMix: BfsMixResult = {
  mix: [],
  profit: -Infinity,
};
let wasmDfsCurrentProduct: ProductVariety | null = null;
let wasmDfsStartTime = 0;
let wasmDfsWorker: Worker | null = null;
let isMultiThreaded = false;
let numThreads = 0;

// Progress tracking
let lastWasmDfsProgressUpdate = 0;
let totalDfsProcessedCombinations = 0;
let totalDfsCombinations = 0;

export function updateWasmDfsBestMixDisplay() {
  if (!wasmDfsCurrentProduct) return;
  updateBestMixDisplay("wasm-dfs", wasmDfsBestMix, wasmDfsCurrentProduct);
}

export function updateWasmDfsProgressDisplay(progress: number, forceUpdate = false) {
  // Create a progress data object for the shared component
  const progressData: ProgressData = {
    processed: totalDfsProcessedCombinations,
    total: totalDfsCombinations || 100, // Avoid division by zero
    depth: 0, // WASM doesn't always provide depth info
    executionTime: wasmDfsStartTime > 0 ? Date.now() - wasmDfsStartTime : 0,
  };

  // If the progress is 100%, make sure processed equals total for proper display
  if (progress >= 100) {
    progressData.processed = progressData.total;
  }

  // Use the shared progress display component
  lastWasmDfsProgressUpdate = updateProgressDisplay(
    "wasm-dfs", 
    progressData, 
    lastWasmDfsProgressUpdate, 
    forceUpdate || progress === 100 // Force update if progress is 100%
  );
}

// Create message handler for the WebAssembly DFS worker
function createWasmDfsWorkerMessageHandler() {
  return function (event: MessageEvent) {
    const { type } = event.data;

    if (type === "update") {
      const { bestMix: updatedBestMix } = event.data;

      // Update our best mix with the result from the worker
      wasmDfsBestMix = updatedBestMix;
      updateWasmDfsBestMixDisplay();
    } else if (type === "progress") {
      // Calculate progress percentage if we have the necessary data
      let progress = 0;

      // Track combinations processed/total for display
      if (
        event.data.processed !== undefined &&
        event.data.total !== undefined
      ) {
        totalDfsProcessedCombinations = event.data.processed;
        totalDfsCombinations = event.data.total;

        // Calculate percentage if total is greater than zero
        if (totalDfsCombinations > 0) {
          progress = Math.min(
            100,
            Math.round(
              (totalDfsProcessedCombinations / totalDfsCombinations) * 100
            )
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
        totalDfsProcessedCombinations = totalDfsCombinations;
      }

      // Update the progress display
      updateWasmDfsProgressDisplay(progress, event.data.isFinal);
    } else if (type === "info") {
      // Handle info messages, like multi-threading status
      if (event.data.message && event.data.message.includes("multi-threaded")) {
        isMultiThreaded = true;
        // Try to extract the number of threads from the message
        const match = event.data.message.match(/with (\d+) threads/);
        if (match && match[1]) {
          numThreads = parseInt(match[1], 10);
        }

        // Update the button text to show threading info
        const wasmDfsButton = document.getElementById("wasmDfsButton");
        if (wasmDfsButton && wasmDfsRunning) {
          wasmDfsButton.textContent = `Stop WASM DFS (${
            numThreads || "multi"
          }-threaded)`;
        }

        // Update status display if it exists
        const statusElem = document.getElementById("wasm-dfs-threading-info");
        if (statusElem) {
          statusElem.textContent = `Using ${
            numThreads || "multi"
          }-threaded WebAssembly DFS`;
          statusElem.style.display = "block";
        }
      }
    } else if (type === "done") {
      // When the calculation is complete, make sure we show 100% progress
      // Ensure processed equals total
      if (totalDfsCombinations > 0) {
        totalDfsProcessedCombinations = totalDfsCombinations;
      } else if (totalDfsProcessedCombinations > 0) {
        totalDfsCombinations = totalDfsProcessedCombinations;
      } else {
        // If we don't have either value, set some reasonable defaults
        totalDfsProcessedCombinations = 100;
        totalDfsCombinations = 100;
      }

      // Force a final progress update to 100% when done
      updateWasmDfsProgressDisplay(100, true);

      // Mark the WASM DFS as complete
      wasmDfsRunning = false;

      // Update button text
      const wasmDfsButton = document.getElementById("wasmDfsButton");
      if (wasmDfsButton) {
        wasmDfsButton.textContent = "Start WASM DFS";
      }

      // Clean up worker reference
      wasmDfsWorker = null;
    } else if (type === "error") {
      console.error("WASM DFS worker error:", event.data.error);
      alert(`WASM DFS error: ${event.data.error}`);

      // Mark the WASM DFS as complete
      wasmDfsRunning = false;

      // Update button text
      const wasmDfsButton = document.getElementById("wasmDfsButton");
      if (wasmDfsButton) {
        wasmDfsButton.textContent = "Start WASM DFS";
      }

      // Clean up worker reference
      wasmDfsWorker = null;
    }
  };
}

// Function to start WebAssembly DFS implementation
export async function startWasmDFS(product: ProductVariety) {
  wasmDfsRunning = true;
  wasmDfsBestMix = { mix: [], profit: -Infinity };
  wasmDfsCurrentProduct = product;
  wasmDfsStartTime = Date.now();
  isMultiThreaded = false;
  numThreads = 0;

  // Reset progress tracking
  totalDfsProcessedCombinations = 0;
  totalDfsCombinations = 0;
  lastWasmDfsProgressUpdate = 0;

  // Create worker
  const worker = new Worker(new URL("./wasmDfsWorker.ts", import.meta.url), {
    type: "module",
  });

  // Set up worker message handler
  worker.onmessage = createWasmDfsWorkerMessageHandler();

  // Start the worker
  worker.postMessage({
    type: "start",
    workerId: 0, // Only one WASM worker
    data: {
      product: { ...product },
      bestMix: wasmDfsBestMix,
      maxDepth: MAX_RECIPE_DEPTH,
    },
  });

  // Store the worker reference in case we need to terminate it
  wasmDfsWorker = worker;
}

// Function to run only the WebAssembly DFS
export async function toggleWasmDFS(product: ProductVariety) {
  const wasmDfsButton = document.getElementById("wasmDfsButton");
  if (!wasmDfsButton) return;

  // Check if WASM implementation is running
  if (wasmDfsRunning) {
    // Stop the WASM DFS
    wasmDfsRunning = false;

    // Terminate the worker if it exists
    if (wasmDfsWorker) {
      wasmDfsWorker.terminate();
      wasmDfsWorker = null;
    }

    wasmDfsButton.textContent = "Start WASM DFS";
  } else {
    // Create displays using the shared components
    createProgressDisplay("wasm-dfs");
    createBestMixDisplay("wasm-dfs");

    // Create a threading info element if it doesn't exist
    let threadingInfoElem = document.getElementById("wasm-dfs-threading-info");
    if (!threadingInfoElem) {
      threadingInfoElem = document.createElement("div");
      threadingInfoElem.id = "wasm-dfs-threading-info";
      threadingInfoElem.style.marginTop = "10px";
      threadingInfoElem.style.fontStyle = "italic";
      threadingInfoElem.style.display = "none";

      // Find the right place to insert it (after best mix display)
      const bestMixContainer = document.getElementById(
        "wasm-dfs-best-mix-container"
      );
      if (bestMixContainer && bestMixContainer.parentNode) {
        bestMixContainer.parentNode.insertBefore(
          threadingInfoElem,
          bestMixContainer.nextSibling
        );
      }
    }

    // Start WebAssembly DFS
    wasmDfsButton.textContent = "Stop WASM DFS";
    startWasmDFS(product);
  }
}

// Export state getters
export function isWasmDfsRunning(): boolean {
  return wasmDfsRunning;
}

export function getWasmDfsBestMix(): BfsMixResult {
  return wasmDfsBestMix;
}
