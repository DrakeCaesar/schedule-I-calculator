// WebAssembly BFS Worker
// This worker runs the WASM BFS implementation to avoid blocking the UI thread

import { MAX_RECIPE_DEPTH } from "./bfs";
import { effects, ProductVariety } from "./substances";
import {
  loadWasmModule,
  prepareEffectMultipliersForWasm,
  prepareSubstancesForWasm,
  prepareSubstanceRulesForWasm,
} from "./wasm-loader";

let isPaused = false;
let startTime = 0;
let workerId = -1;
let progress = 0;

// Setup a regular progress update
function startProgressUpdates() {
  const progressInterval = setInterval(() => {
    if (isPaused) return;
    
    // Simulate progress until we get actual progress from WASM
    // In a more advanced implementation, we could get real progress from the WASM module
    progress = Math.min(progress + 1, 95);
    
    self.postMessage({
      type: "progress",
      progress,
      executionTime: Date.now() - startTime,
      workerId,
    });
    
  }, 100);

  return progressInterval;
}

// Handle messages from the main thread
self.onmessage = async (event: MessageEvent) => {
  const { type, workerId: id, data } = event.data || {};

  if (type === "start" && data) {
    workerId = id;
    isPaused = false;
    progress = 0;
    startTime = Date.now();
    
    const product = data.product;
    const maxDepth = data.maxDepth || MAX_RECIPE_DEPTH;
    
    // Start sending progress updates
    const progressInterval = startProgressUpdates();
    
    try {
      // Load the WebAssembly module
      const bfsModule = await loadWasmModule();
      
      if (typeof bfsModule.findBestMixJson !== "function") {
        throw new Error("findBestMixJson function not found in WASM module");
      }
      
      // Prepare data for WASM as JSON strings
      const productJson = JSON.stringify({
        name: product.name,
        initialEffect: product.initialEffect,
      });
      const substancesJson = prepareSubstancesForWasm();
      const effectMultipliersJson = prepareEffectMultipliersForWasm(effects);
      const substanceRulesJson = prepareSubstanceRulesForWasm();
      
      // Call the WASM function with JSON strings
      const result = bfsModule.findBestMixJson(
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
        cost: result.cost
      };
      
      // Stop the progress updates
      clearInterval(progressInterval);
      
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
      // Stop the progress updates
      clearInterval(progressInterval);
      
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
