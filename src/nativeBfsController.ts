// Native BFS Controller
// Manages the Native C++ implementation of the BFS algorithm via Node.js server

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
import { effects, ProductVariety } from "./substances";
import {
  prepareEffectMultipliersForWasm,
  prepareSubstanceRulesForWasm,
  prepareSubstancesForWasm,
} from "./wasmLoader";

// State variables for Native BFS
let nativeBfsRunning = false;
let nativeBestMix: BfsMixResult = {
  mix: [],
  profit: -Infinity,
};
let nativeCurrentProduct: ProductVariety | null = null;
let nativeWebSocket: WebSocket | null = null;
let nativeStartTime = 0;

// Progress tracking
let nativeTotalProcessed = 0;
let nativeGrandTotal = 1; // Start with 1 to avoid division by zero
let nativeLastUpdate = 0;

export function updateNativeBestMixDisplay() {
  if (!nativeCurrentProduct) return;
  updateBestMixDisplay("native", nativeBestMix, nativeCurrentProduct);
}

export function updateNativeProgressDisplay(
  progressData: ProgressData,
  forceUpdate = false
): void {
  // Store values for our global state
  nativeTotalProcessed = progressData.processed;
  if (progressData.total > 0) {
    nativeGrandTotal = progressData.total;
  }

  // Use the shared progress display component
  nativeLastUpdate = updateProgressDisplay(
    "native",
    progressData,
    nativeLastUpdate,
    forceUpdate
  );
}

// Initialize WebSocket connection for native BFS
function initializeNativeWebSocket() {
  if (nativeWebSocket) {
    // Close existing connection if there is one
    nativeWebSocket.close();
  }

  // Create new WebSocket connection
  nativeWebSocket = new WebSocket("ws://localhost:3000");

  nativeWebSocket.onopen = () => {
    console.log("Native BFS WebSocket connection established");
  };

  nativeWebSocket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === "progress") {
        // Handle progress update
        const executionTime =
          data.executionTime || Date.now() - nativeStartTime;

        // Create progress data object
        const progressData: ProgressData = {
          processed: data.totalProcessed || data.processed || 0,
          total: data.grandTotal || data.total || 100,
          depth: data.depth || 1,
          executionTime,
          message: data.message || `Processing depth ${data.depth || 1}`,
        };

        updateNativeProgressDisplay(progressData);
      } else if (data.type === "done") {
        // Handle completion
        nativeBfsRunning = false;

        // Update progress to 100%
        updateNativeProgressDisplay(
          {
            processed: nativeGrandTotal,
            total: nativeGrandTotal,
            depth: data.depth || 0,
            executionTime: Date.now() - nativeStartTime,
            message: "Calculation complete",
          },
          true
        );

        // Update the result display if we have result data
        if (data.result) {
          nativeBestMix = {
            mix: data.result.mixArray || [],
            profit: data.result.profit || 0,
            sellPrice: data.result.sellPrice || 0,
            cost: data.result.cost || 0,
          };
          updateNativeBestMixDisplay();
        }

        // Update button state
        const nativeBfsButton = document.getElementById("nativeBfsButton");
        if (nativeBfsButton) {
          nativeBfsButton.textContent = "Start Native BFS";
        }
      } else if (data.type === "error") {
        // Handle error
        console.error("Native BFS error:", data.message);

        updateNativeProgressDisplay(
          {
            processed: nativeTotalProcessed,
            total: nativeGrandTotal,
            depth: 0,
            executionTime: Date.now() - nativeStartTime,
            message: `Error: ${data.message}`,
          },
          true
        );

        nativeBfsRunning = false;

        // Update button state
        const nativeBfsButton = document.getElementById("nativeBfsButton");
        if (nativeBfsButton) {
          nativeBfsButton.textContent = "Start Native BFS";
        }
      }
    } catch (error) {
      console.error("Error processing WebSocket message:", error);
    }
  };

  nativeWebSocket.onerror = (error) => {
    console.error("WebSocket error:", error);
    nativeBfsRunning = false;
  };

  nativeWebSocket.onclose = () => {
    console.log("Native BFS WebSocket connection closed");
    nativeWebSocket = null;
  };
}

// Function to toggle native BFS processing via Node.js server
export async function toggleNativeBFS(product: ProductVariety) {
  const nativeBfsButton = document.getElementById("nativeBfsButton");
  if (!nativeBfsButton) return;

  // Check if calculation is already running
  if (nativeBfsRunning) {
    // If currently running, abort and reset
    nativeBfsRunning = false;

    // Update progress display with cancellation message
    updateNativeProgressDisplay(
      {
        processed: nativeTotalProcessed,
        total: nativeGrandTotal,
        depth: 0,
        executionTime: Date.now() - nativeStartTime,
        message: "Calculation canceled",
      },
      true
    );

    nativeBfsButton.textContent = "Start Native BFS";
    return;
  }

  // Create displays using shared components
  createProgressDisplay("native");
  createBestMixDisplay("native");

  // Set start time for execution time calculation
  nativeStartTime = Date.now();
  nativeBfsRunning = true;
  nativeLastUpdate = 0;
  nativeCurrentProduct = product;
  nativeBestMix = { mix: [], profit: -Infinity };

  // Initialize WebSocket connection for progress updates
  initializeNativeWebSocket();

  // Start the BFS calculation
  nativeBfsButton.textContent = "Stop Native BFS";

  // Initial progress update
  updateNativeProgressDisplay(
    {
      processed: 0,
      total: 100,
      depth: 1,
      executionTime: 0,
      message: "Starting native calculation...",
    },
    true
  );

  // Prepare data for the server
  const maxDepthEl = document.getElementById(
    "maxDepthSlider"
  ) as HTMLInputElement;
  const maxDepth = maxDepthEl
    ? parseInt(maxDepthEl.value, 10)
    : MAX_RECIPE_DEPTH;

  const productJson = {
    name: product.name,
    initialEffect: product.initialEffect,
  };

  // Get data in the same format as we use for WASM
  const substancesJson = JSON.parse(prepareSubstancesForWasm());
  const effectMultipliersJson = JSON.parse(
    prepareEffectMultipliersForWasm(effects)
  );
  const substanceRulesJson = JSON.parse(prepareSubstanceRulesForWasm());

  // Send the data to the server - use the full URL with port
  try {
    const response = await fetch("http://localhost:3000/api/bfs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product: productJson,
        substances: substancesJson,
        effectMultipliers: effectMultipliersJson,
        substanceRules: substanceRulesJson,
        maxDepth,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Server responded with ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json();

    // Process successful result
    if (!data.success) {
      throw new Error(data.error || "Unknown server error");
    }

    // The WebSocket will handle progress updates and final results
    // This is just a fallback in case WebSocket fails
    if (!nativeWebSocket || nativeWebSocket.readyState !== WebSocket.OPEN) {
      // Extract results and update the UI
      const result = data.result;
      if (!result) {
        throw new Error("No result data received");
      }

      // Convert result format to UI expectations
      nativeBestMix = {
        mix: result.mixArray || [],
        profit: result.profit || 0,
        sellPrice: result.sellPrice || 0,
        cost: result.cost || 0,
      };

      // Update the display
      updateNativeBestMixDisplay();

      // Final progress update
      const executionTime = Date.now() - nativeStartTime;
      updateNativeProgressDisplay(
        {
          processed: nativeGrandTotal,
          total: nativeGrandTotal,
          depth: 0,
          executionTime,
          message: `Calculation complete in ${(executionTime / 1000).toFixed(
            2
          )}s`,
        },
        true
      );

      // Reset the button after a successful computation
      nativeBfsButton.textContent = "Start Native BFS";
      nativeBfsRunning = false;
    }
  } catch (error: unknown) {
    // Handle errors with proper type checking
    console.error("Native BFS error:", error);

    // Convert error to string for display
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Show error message in progress display
    updateNativeProgressDisplay(
      {
        processed: nativeTotalProcessed,
        total: nativeGrandTotal,
        depth: 0,
        executionTime: Date.now() - nativeStartTime,
        message: `Error: ${errorMessage}`,
      },
      true
    );

    // Reset the button after an error
    nativeBfsButton.textContent = "Start Native BFS";
    nativeBfsRunning = false;
  }
}

// Export state getters
export function isNativeBfsRunning(): boolean {
  return nativeBfsRunning;
}

export function getNativeBestMix(): BfsMixResult {
  return nativeBestMix;
}
