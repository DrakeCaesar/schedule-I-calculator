// WebAssembly DFS Worker
// This worker runs the WASM DFS implementation with multi-threading to avoid blocking the UI thread

import {
  WorkerState,
  createWorkerState,
  extractMixArray,
  prepareWasmRun,
  sendCompletionMessages,
  setupBestMixReporting,
  setupProgressReporting,
} from "./wasmWorkerCommon";

// Worker state
const state: WorkerState = createWorkerState();

// Setup global reportDfsProgress function for C++ to call
declare global {
  interface Window {
    reportDfsProgress: (progressData: any) => void;
    reportBestMixFound: (mixData: any) => void;
  }
}

// Implementation of reportDfsProgress that the C++ code will call
(self as any).reportDfsProgress = setupProgressReporting(state);

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

      // Check if DFS functions are available
      if (typeof wasmModule.findBestMixDFSJsonWithProgress !== "function") {
        // Fall back to the non-progress version if available
        if (typeof wasmModule.findBestMixDFSJson !== "function") {
          throw new Error("DFS functions not found in WASM module");
        }
      }

      console.log("Starting multi-threaded WebAssembly DFS...");

      // Post a message to inform the main thread that we're using threading
      self.postMessage({
        type: "info",
        message:
          "Using multi-threaded WebAssembly implementation with 16 threads",
        workerId: state.workerId,
      });

      // Call the WASM DFS function with JSON strings and enable progress reporting
      // The multi-threaded implementation will be used automatically by the WebAssembly module
      // due to the PTHREAD_POOL_SIZE=16 setting in the build
      let result;
      if (wasmModule.findBestMixDFSJsonWithProgress) {
        result = wasmModule.findBestMixDFSJsonWithProgress(
          productJson,
          substancesJson,
          effectMultipliersJson,
          substanceRulesJson,
          maxDepth,
          true, // Enable progress reporting
          true // Enable hashing optimization
        );
      } else if (wasmModule.findBestMixDFSJson) {
        result = wasmModule.findBestMixDFSJson(
          productJson,
          substancesJson,
          effectMultipliersJson,
          substanceRulesJson,
          maxDepth
        );
      } else {
        throw new Error("DFS functions not found in WASM module");
      }

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
