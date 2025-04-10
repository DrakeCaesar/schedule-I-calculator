// WASM Worker Common Utilities
// This file contains shared functionality used by both BFS and DFS WebAssembly workers

import { effects } from "./substances";
import {
  loadWasmModule,
  prepareEffectMultipliersForWasm,
  prepareSubstanceRulesForWasm,
  prepareSubstancesForWasm,
} from "./wasmLoader";

// Common worker state that is shared between BFS and DFS workers
export interface WorkerState {
  isPaused: boolean;
  startTime: number;
  workerId: number;
  lastProgressUpdate: number;
  lastBestMixUpdate: number;
  totalTrackedProcessed: number;
  totalTrackedCombinations: number;
  currentBestMix: {
    mix: string[];
    profit: number;
    sellPrice: number;
    cost: number;
  };
}

// Define interface for WASM algorithm result
export interface WasmAlgorithmResult {
  mixArray: string[] | Record<string, string>;
  profit: number;
  sellPrice: number;
  cost: number;
  totalCombinations?: number; // may not exist in all cases
}

// Create and initialize worker state
export function createWorkerState(): WorkerState {
  return {
    isPaused: false,
    startTime: 0,
    workerId: -1,
    lastProgressUpdate: 0,
    lastBestMixUpdate: 0,
    totalTrackedProcessed: 0,
    totalTrackedCombinations: 0,
    currentBestMix: {
      mix: [],
      profit: -Infinity,
      sellPrice: 0,
      cost: 0,
    },
  };
}

// Setup global reportProgress function for C++ to call
// Note: Algorithm-specific version (BFS/DFS) should be implemented in each worker
export function setupProgressReporting(state: WorkerState) {
  return function reportProgress(progressData: any) {
    if (state.isPaused) return;

    const currentTime = Date.now();
    // Throttle progress updates to avoid overwhelming the main thread
    if (currentTime - state.lastProgressUpdate < 100) return;

    state.lastProgressUpdate = currentTime;

    // Keep track of the maximum values we've seen
    if (progressData.processed > state.totalTrackedProcessed) {
      state.totalTrackedProcessed = progressData.processed;
    }
    if (progressData.total > state.totalTrackedCombinations) {
      state.totalTrackedCombinations = progressData.total;
    }

    // Send progress update to main thread
    self.postMessage({
      type: "progress",
      depth: progressData.depth,
      processed: progressData.processed,
      total: progressData.total,
      executionTime: Date.now() - state.startTime,
      workerId: state.workerId,
    });
  };
}

// Setup global reportBestMixFound function for C++ to call
export function setupBestMixReporting(state: WorkerState) {
  return function reportBestMixFound(mixData: any) {
    if (state.isPaused) return;

    const currentTime = Date.now();
    // Throttle best mix updates to avoid overwhelming the main thread - once per second is enough
    if (currentTime - state.lastBestMixUpdate < 1000) return;

    state.lastBestMixUpdate = currentTime;

    // Extract mix data
    let mixArray: string[] = [];
    const profit = parseFloat(mixData.profit || "0");
    const sellPrice = parseFloat(mixData.sellPrice || "0");
    const cost = parseFloat(mixData.cost || "0");

    // Check if this mix is better than our current best
    if (profit <= state.currentBestMix.profit) return;

    // Extract mix array
    if (mixData.mixArray && Array.isArray(mixData.mixArray)) {
      mixArray = mixData.mixArray;
    } else if (mixData.mix && Array.isArray(mixData.mix)) {
      mixArray = mixData.mix;
    } else if (typeof mixData.mix === "string") {
      mixArray = mixData.mix.split(",").map((s: string) => s.trim());
    }

    // Update current best mix
    state.currentBestMix = {
      mix: mixArray,
      profit,
      sellPrice,
      cost,
    };

    // Send best mix update to main thread
    self.postMessage({
      type: "update",
      bestMix: state.currentBestMix,
      workerId: state.workerId,
    });
  };
}

// Prepare a WASM run with common setup
export async function prepareWasmRun(
  state: WorkerState,
  product: any,
  maxDepth: number
) {
  // Prepare data for WASM as JSON strings
  const productJson = JSON.stringify({
    name: product.name,
    initialEffect: product.initialEffect,
  });
  const substancesJson = prepareSubstancesForWasm();
  const effectMultipliersJson = prepareEffectMultipliersForWasm(effects);
  const substanceRulesJson = prepareSubstanceRulesForWasm();

  // Load the WebAssembly module
  const wasmModule = await loadWasmModule();

  return {
    wasmModule,
    productJson,
    substancesJson,
    effectMultipliersJson,
    substanceRulesJson,
    maxDepth,
  };
}

// Extract mix array from WASM result with fallbacks
export function extractMixArray(
  result: WasmAlgorithmResult,
  wasmModule: any
): string[] {
  let mixArray: string[] = [];

  if (result.mixArray && Array.isArray(result.mixArray)) {
    mixArray = result.mixArray;
  } else if (typeof wasmModule.getMixArray === "function") {
    try {
      const arrayResult = wasmModule.getMixArray();
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

  return mixArray;
}

// Send final progress and completion messages
export function sendCompletionMessages(
  state: WorkerState,
  bestMix: any,
  maxDepth: number
) {
  // Get the total combinations value, using our tracked value if available
  let finalTotalCombinations = state.totalTrackedCombinations || 100;
  let finalProcessedCombinations = finalTotalCombinations; // At completion, processed equals total

  // Always send a final 100% progress update
  self.postMessage({
    type: "progress",
    depth: maxDepth,
    processed: finalProcessedCombinations,
    total: finalTotalCombinations,
    progress: 100, // Explicit progress percentage
    executionTime: Date.now() - state.startTime,
    workerId: state.workerId,
    isFinal: true, // Signal that this is the final progress update
  });

  // Send the final best mix result
  self.postMessage({
    type: "update",
    bestMix,
    workerId: state.workerId,
  });

  // Send completion message
  self.postMessage({
    type: "done",
    bestMix,
    processed: finalProcessedCombinations,
    total: finalTotalCombinations,
    executionTime: Date.now() - state.startTime,
    workerId: state.workerId,
  });
}

// Fallback function to simulate progress for older WASM modules
export function simulateProgress(state: WorkerState) {
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
    if (state.isPaused) return;

    progress = Math.min(progress + 1, 95);

    // Send progress update
    self.postMessage({
      type: "progress",
      progress,
      processed: Math.floor((progress / 100) * estimatedTotal),
      total: estimatedTotal,
      executionTime: Date.now() - state.startTime,
      workerId: state.workerId,
    });

    // Also simulate best mix updates at certain progress thresholds
    if (progress === 30 && simulatedMixes.length > 0) {
      const mix = simulatedMixes.shift();
      if (mix) {
        self.postMessage({
          type: "update",
          bestMix: mix,
          workerId: state.workerId,
        });
        state.currentBestMix = mix;
      }
    } else if (progress === 60 && simulatedMixes.length > 0) {
      const mix = simulatedMixes.shift();
      if (mix) {
        self.postMessage({
          type: "update",
          bestMix: mix,
          workerId: state.workerId,
        });
        state.currentBestMix = mix;
      }
    } else if (progress === 90 && simulatedMixes.length > 0) {
      const mix = simulatedMixes.shift();
      if (mix) {
        self.postMessage({
          type: "update",
          bestMix: mix,
          workerId: state.workerId,
        });
        state.currentBestMix = mix;
      }
    }

    if (progress >= 95) {
      clearInterval(progressInterval);
    }
  }, 100);

  // Clean up interval after 30 seconds to avoid memory leaks
  setTimeout(() => clearInterval(progressInterval), 30000);
}
