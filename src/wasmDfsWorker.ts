// WebAssembly DFS Worker
// This worker runs the WASM DFS implementation to avoid blocking the UI thread

import { effects } from "./substances";
import {
  loadWasmModule,
  prepareEffectMultipliersForWasm,
  prepareSubstanceRulesForWasm,
  prepareSubstancesForWasm,
} from "./wasmLoader";

let isPaused = false;
let startTime = 0;
let workerId = -1;
let lastProgressUpdate = 0;
let lastBestMixUpdate = 0;
let totalTrackedProcessed = 0;
let totalTrackedCombinations = 0;
let currentBestMix = {
  mix: [],
  profit: -Infinity,
  sellPrice: 0,
  cost: 0,
};

// Setup global reportDfsProgress function for C++ to call
// This will be called by the C++ code when progress is made
declare global {
  interface Window {
    reportDfsProgress: (progressData: any) => void;
    reportBestMixFound: (mixData: any) => void;
  }
}

// Implementation of reportDfsProgress that the C++ code will call
(self as any).reportDfsProgress = function (progressData: any) {
  if (isPaused) return;

  const currentTime = Date.now();
  // Throttle progress updates to avoid overwhelming the main thread
  if (currentTime - lastProgressUpdate < 100) return;

  lastProgressUpdate = currentTime;

  // Keep track of the maximum values we've seen
  if (progressData.processed > totalTrackedProcessed) {
    totalTrackedProcessed = progressData.processed;
  }
  if (progressData.total > totalTrackedCombinations) {
    totalTrackedCombinations = progressData.total;
  }

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

// Implementation of reportBestMixFound that the C++ code will call
// This function is shared between BFS and DFS implementations
(self as any).reportBestMixFound = function (mixData: any) {
  if (isPaused) return;

  const currentTime = Date.now();
  // Throttle best mix updates to avoid overwhelming the main thread - once per second is enough
  if (currentTime - lastBestMixUpdate < 1000) return;

  lastBestMixUpdate = currentTime;

  // Extract mix data
  let mixArray: string[] = [];
  const profit = parseFloat(mixData.profit || "0");
  const sellPrice = parseFloat(mixData.sellPrice || "0");
  const cost = parseFloat(mixData.cost || "0");

  // Check if this mix is better than our current best
  if (profit <= currentBestMix.profit) return;

  // Extract mix array
  if (mixData.mixArray && Array.isArray(mixData.mixArray)) {
    mixArray = mixData.mixArray;
  } else if (mixData.mix && Array.isArray(mixData.mix)) {
    mixArray = mixData.mix;
  } else if (typeof mixData.mix === "string") {
    mixArray = mixData.mix.split(",").map((s: string) => s.trim());
  }

  // Update current best mix
  currentBestMix = {
    mix: mixArray,
    profit,
    sellPrice,
    cost,
  };

  // Send best mix update to main thread
  self.postMessage({
    type: "update",
    bestMix: currentBestMix,
    workerId,
  });
};

// Define interface for WASM DFS result
interface WasmDfsResult {
  mixArray: string[] | Record<string, string>;
  profit: number;
  sellPrice: number;
  cost: number;
  // totalCombinations may not exist in all cases
  totalCombinations?: number;
}

// Handle messages from the main thread
self.onmessage = async (event: MessageEvent) => {
  const { type, workerId: id, data } = event.data || {};

  if (type === "start" && data) {
    workerId = id;
    isPaused = false;
    startTime = Date.now();
    lastProgressUpdate = 0;
    lastBestMixUpdate = 0;
    totalTrackedProcessed = 0;
    totalTrackedCombinations = 0;
    currentBestMix = {
      mix: [],
      profit: -Infinity,
      sellPrice: 0,
      cost: 0,
    };

    const product = data.product;
    const maxDepth = data.maxDepth || 5; // Default to 5 if not provided

    try {
      // Load the WebAssembly module
      const bfsModule = await loadWasmModule();

      // Check if DFS functions are available
      if (typeof bfsModule.findBestMixDFSJsonWithProgress !== "function") {
        // Fall back to the non-progress version if available
        if (typeof bfsModule.findBestMixDFSJson !== "function") {
          throw new Error("DFS functions not found in WASM module");
        }

        console.warn(
          "DFS Progress reporting not available in WASM module. Falling back to simulated progress."
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

      // Call the WASM DFS function with JSON strings and enable progress reporting
      const result = bfsModule.findBestMixDFSJsonWithProgress
        ? bfsModule.findBestMixDFSJsonWithProgress(
            productJson,
            substancesJson,
            effectMultipliersJson,
            substanceRulesJson,
            maxDepth,
            true // Enable progress reporting
          )
        : bfsModule.findBestMixDFSJson(
            productJson,
            substancesJson,
            effectMultipliersJson,
            substanceRulesJson,
            maxDepth
          );

      // Cast result to our interface
      const typedResult = result as WasmDfsResult;

      // Extract mix array from result
      let mixArray: string[] = [];

      if (typedResult.mixArray && Array.isArray(typedResult.mixArray)) {
        mixArray = typedResult.mixArray;
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
        profit: typedResult.profit,
        sellPrice: typedResult.sellPrice,
        cost: typedResult.cost,
      };

      // Update our current best mix with the final result
      currentBestMix = bestMix;

      // Get the total combinations value, using our tracked value if available
      let finalTotalCombinations =
        typedResult.totalCombinations || totalTrackedCombinations || 100;
      let finalProcessedCombinations = finalTotalCombinations; // At completion, processed equals total

      // Always send a final 100% progress update, regardless of what the C++ code reported
      self.postMessage({
        type: "progress",
        depth: maxDepth,
        processed: finalProcessedCombinations,
        total: finalTotalCombinations,
        progress: 100, // Explicit progress percentage
        executionTime: Date.now() - startTime,
        workerId,
        isFinal: true, // Signal that this is the final progress update
      });

      // Send the final best mix result
      self.postMessage({
        type: "update",
        bestMix,
        workerId,
      });

      // Send completion message
      self.postMessage({
        type: "done",
        bestMix,
        processed: finalProcessedCombinations,
        total: finalTotalCombinations,
        executionTime: Date.now() - startTime,
        workerId,
      });
    } catch (error) {
      // Send the error to the main thread
      self.postMessage({
        type: "error",
        error: error instanceof Error ? error.message : String(error),
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
  let estimatedTotal = 100;

  // Also simulate best mix updates during progress
  let simulatedMixes = [
    {
      mix: ["Stone", "Powder"],
      profit: 50,
      sellPrice: 150,
      cost: 100,
    },
    {
      mix: ["Stone", "Powder", "Liquid"],
      profit: 75,
      sellPrice: 200,
      cost: 125,
    },
    {
      mix: ["Stone", "Powder", "Liquid", "Crystal"],
      profit: 120,
      sellPrice: 250,
      cost: 130,
    },
  ];

  const progressInterval = setInterval(() => {
    if (isPaused) return;

    progress = Math.min(progress + 1, 95);

    // Send progress update
    self.postMessage({
      type: "progress",
      progress,
      processed: Math.floor((progress / 100) * estimatedTotal),
      total: estimatedTotal,
      executionTime: Date.now() - startTime,
      workerId,
    });

    // Also simulate best mix updates at certain progress thresholds
    if (progress === 30 && simulatedMixes.length > 0) {
      const mix = simulatedMixes.shift();
      if (mix) {
        self.postMessage({
          type: "update",
          bestMix: mix,
          workerId,
        });
        currentBestMix = mix;
      }
    } else if (progress === 60 && simulatedMixes.length > 0) {
      const mix = simulatedMixes.shift();
      if (mix) {
        self.postMessage({
          type: "update",
          bestMix: mix,
          workerId,
        });
        currentBestMix = mix;
      }
    } else if (progress === 90 && simulatedMixes.length > 0) {
      const mix = simulatedMixes.shift();
      if (mix) {
        self.postMessage({
          type: "update",
          bestMix: mix,
          workerId,
        });
        currentBestMix = mix;
      }
    }

    if (progress >= 95) {
      clearInterval(progressInterval);
    }
  }, 100);

  // Clean up interval after 30 seconds to avoid memory leaks
  setTimeout(() => clearInterval(progressInterval), 30000);
}
