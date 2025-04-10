// WebAssembly BFS Worker
// This worker runs the WASM BFS implementation to avoid blocking the UI thread

import {
  WorkerState,
  createWorkerState,
  extractMixArray,
  prepareWasmRun,
  sendCompletionMessages,
  setupBestMixReporting,
  setupProgressReporting,
  simulateProgress,
} from "./wasmWorkerCommon";

// Worker state
const state: WorkerState = createWorkerState();

// Setup global reportBfsProgress function for C++ to call
declare global {
  interface Window {
    reportBfsProgress: (progressData: any) => void;
    reportBestMixFound: (mixData: any) => void;
  }
}

// Implementation of reportBfsProgress that the C++ code will call
(self as any).reportBfsProgress = setupProgressReporting(state);

// Implementation of reportBestMixFound that the C++ code will call
(self as any).reportBestMixFound = setupBestMixReporting(state);

// Handle messages from the main thread
self.onmessage = async (event: MessageEvent) => {
  const { type, workerId: id, data } = event.data || {};

  if (type === "start" && data) {
    state.workerId = id;
    state.isPaused = false;
    state.startTime = Date.now();
    state.lastProgressUpdate = 0;
    state.lastBestMixUpdate = 0;
    state.totalTrackedProcessed = 0;
    state.totalTrackedCombinations = 0;
    state.currentBestMix = {
      mix: [],
      profit: -Infinity,
      sellPrice: 0,
      cost: 0,
    };

    const product = data.product;
    const maxDepth = data.maxDepth || 5; // Default to 5 if not provided

    try {
      // Prepare and load WASM module and data
      const {
        wasmModule,
        productJson,
        substancesJson,
        effectMultipliersJson,
        substanceRulesJson,
      } = await prepareWasmRun(state, product, maxDepth);

      // Check if progress reporting is available
      if (typeof wasmModule.findBestMixJsonWithProgress !== "function") {
        // Fall back to the old function if the new one isn't available
        if (typeof wasmModule.findBestMixJson !== "function") {
          throw new Error("BFS functions not found in WASM module");
        }

        console.warn(
          "Progress reporting not available in WASM module. Falling back to simulated progress."
        );
        simulateProgress(state);
      }

      // Call the WASM function with JSON strings and enable progress reporting
      const result = wasmModule.findBestMixJsonWithProgress
        ? wasmModule.findBestMixJsonWithProgress(
            productJson,
            substancesJson,
            effectMultipliersJson,
            substanceRulesJson,
            maxDepth,
            true // Enable progress reporting
          )
        : wasmModule.findBestMixJson(
            productJson,
            substancesJson,
            effectMultipliersJson,
            substanceRulesJson,
            maxDepth
          );

      // Extract mix array from result
      let mixArray = extractMixArray(result, wasmModule);

      // Create the best mix result
      const bestMix = {
        mix: mixArray,
        profit: result.profit,
        sellPrice: result.sellPrice,
        cost: result.cost,
      };

      // Update our current best mix with the final result
      state.currentBestMix = bestMix;

      // Send completion messages
      sendCompletionMessages(state, bestMix, maxDepth);
    } catch (error) {
      // Send the error to the main thread
      self.postMessage({
        type: "error",
        error: error instanceof Error ? error.message : String(error),
        workerId: state.workerId,
      });
    }
  } else if (type === "pause") {
    state.isPaused = true;
  } else if (type === "resume") {
    state.isPaused = false;
  }
};
