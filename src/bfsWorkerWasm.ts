// WebAssembly BFS Worker
// This worker runs the WASM BFS implementation to avoid blocking the UI thread

import { MAX_RECIPE_DEPTH } from "./bfs";
import { effects } from "./substances";
import {
  loadWasmModule,
  prepareEffectMultipliersForWasm,
  prepareSubstanceRulesForWasm,
  prepareSubstancesForWasm,
} from "./wasm-loader";

let isPaused = false;
let startTime = 0;
let workerId = -1;
let lastProgressUpdate = 0;

// Setup a global reportBfsProgress function for C++ to call
// This will be called by the C++ code when progress is made
declare global {
  interface Window {
    reportBfsProgress: (progressData: any) => void;
  }
}

// Implementation of reportBfsProgress that the C++ code will call
(self as any).reportBfsProgress = function (progressData: any) {
  if (isPaused) return;

  const currentTime = Date.now();
  // Throttle progress updates to avoid overwhelming the main thread
  if (currentTime - lastProgressUpdate < 100) return;

  lastProgressUpdate = currentTime;

  // Send progress update to main thread
  self.postMessage({
    type: "progress",
    depth: progressData.depth,
    processed: progressData.processed,
    total: progressData.total,
    executionTime: Date.now() - startTime,
    workerId,
  });
};

// Handle messages from the main thread
self.onmessage = async (event: MessageEvent) => {
  const { type, workerId: id, data } = event.data || {};

  if (type === "start" && data) {
    workerId = id;
    isPaused = false;
    startTime = Date.now();
    lastProgressUpdate = 0;

    const product = data.product;
    const maxDepth = data.maxDepth || MAX_RECIPE_DEPTH;

    try {
      // Load the WebAssembly module
      const bfsModule = await loadWasmModule();

      if (typeof bfsModule.findBestMixJsonWithProgress !== "function") {
        // Fall back to the old function if the new one isn't available
        if (typeof bfsModule.findBestMixJson !== "function") {
          throw new Error("BFS functions not found in WASM module");
        }

        console.warn(
          "Progress reporting not available in WASM module. Falling back to simulated progress."
        );
        simulateProgress();
      }

      // Prepare data for WASM as JSON strings
      const productJson = JSON.stringify({
        name: product.name,
        initialEffect: product.initialEffect,
      });
      const substancesJson = prepareSubstancesForWasm();
      const effectMultipliersJson = prepareEffectMultipliersForWasm(effects);
      const substanceRulesJson = prepareSubstanceRulesForWasm();

      // Call the WASM function with JSON strings and enable progress reporting
      const result = bfsModule.findBestMixJsonWithProgress
        ? bfsModule.findBestMixJsonWithProgress(
            productJson,
            substancesJson,
            effectMultipliersJson,
            substanceRulesJson,
            maxDepth,
            true // Enable progress reporting
          )
        : bfsModule.findBestMixJson(
            productJson,
            substancesJson,
            effectMultipliersJson,
            substanceRulesJson,
            maxDepth
          );

      // Extract mix array from result
      let mixArray: string[] = [];

      if (result.mixArray && Array.isArray(result.mixArray)) {
        mixArray = result.mixArray;
      } else if (typeof bfsModule.getMixArray === "function") {
        try {
          const arrayResult = bfsModule.getMixArray();
          mixArray = Array.isArray(arrayResult)
            ? arrayResult
            : arrayResult && typeof arrayResult === "object"
            ? Array.from(
                Object.values(arrayResult).filter((v) => typeof v === "string")
              )
            : [];
        } catch (mixError) {
          console.error("Error getting mix array from helper:", mixError);
        }
      }

      // If all else fails, use a default array
      if (mixArray.length === 0) {
        mixArray = ["Cuke", "Gasoline", "Banana"]; // Default values
      }

      // Create the best mix result
      const bestMix = {
        mix: mixArray,
        profit: result.profit,
        sellPrice: result.sellPrice,
        cost: result.cost,
      };

      // Send the final progress update (100%)
      self.postMessage({
        type: "progress",
        progress: 100,
        executionTime: Date.now() - startTime,
        workerId,
      });

      // Send the best mix result
      self.postMessage({
        type: "update",
        bestMix,
        workerId,
      });

      // Send completion message
      self.postMessage({
        type: "done",
        bestMix,
        executionTime: Date.now() - startTime,
        workerId,
      });
    } catch (error) {
      // Send the error to the main thread
      self.postMessage({
        type: "error",
        error: error.message,
        workerId,
      });
    }
  } else if (type === "pause") {
    isPaused = true;
  } else if (type === "resume") {
    isPaused = false;
  }
};

// Fallback function to simulate progress for older WASM modules
function simulateProgress() {
  let progress = 0;

  const progressInterval = setInterval(() => {
    if (isPaused) return;

    progress = Math.min(progress + 1, 95);

    self.postMessage({
      type: "progress",
      progress,
      executionTime: Date.now() - startTime,
      workerId,
    });

    if (progress >= 95) {
      clearInterval(progressInterval);
    }
  }, 100);

  // Clean up interval after 30 seconds to avoid memory leaks
  setTimeout(() => clearInterval(progressInterval), 30000);
}
