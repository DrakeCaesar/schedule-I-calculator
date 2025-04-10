// Native Algorithm Controller
// Manages the Native C++ implementation of search algorithms via Node.js server
// Now supports both BFS and DFS with separate functions

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

// State variables for Native algorithm
let nativeAlgorithmRunning = false;
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

// Currently active algorithm
let currentAlgorithm = "dfs"; // Default algorithm

export function updateNativeBestMixDisplay() {
  if (!nativeCurrentProduct) return;
  updateBestMixDisplay(
    "native",
    nativeBestMix,
    nativeCurrentProduct,
    currentAlgorithm.toUpperCase()
  );
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

  // Add algorithm and forceUpdate flags to the progress data
  const enhancedProgressData: ProgressData = {
    ...progressData,
    algorithm: currentAlgorithm.toUpperCase(),
    forceUpdate,
  };

  // Determine which implementation type to use based on the current algorithm
  const implementation =
    currentAlgorithm === "bfs" ? "native-bfs" : "native-dfs";

  // Use the shared progress display component
  nativeLastUpdate = updateProgressDisplay(
    implementation,
    enhancedProgressData,
    nativeLastUpdate
  );
}

// Initialize WebSocket connection for native algorithm
function initializeNativeWebSocket() {
  if (nativeWebSocket) {
    // Close existing connection if there is one
    nativeWebSocket.close();
  }

  // Create new WebSocket connection
  nativeWebSocket = new WebSocket("ws://localhost:3000");

  nativeWebSocket.onopen = () => {
    console.log(
      `Native ${currentAlgorithm.toUpperCase()} WebSocket connection established`
    );
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

        // If progress update includes a best mix, update the display
        if (data.bestMix && data.bestMix.profit > nativeBestMix.profit) {
          nativeBestMix = data.bestMix;
          updateNativeBestMixDisplay();
        }
      } else if (data.type === "update") {
        // Handle best mix update
        if (data.bestMix && data.bestMix.profit > nativeBestMix.profit) {
          nativeBestMix = data.bestMix;
          updateNativeBestMixDisplay();
        }
      } else if (data.type === "done") {
        // Handle completion
        nativeAlgorithmRunning = false;

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

        // Update button states
        updateButtonStates();
      } else if (data.type === "error") {
        // Handle error
        console.error(
          `Native ${currentAlgorithm.toUpperCase()} error:`,
          data.message
        );

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

        nativeAlgorithmRunning = false;

        // Update button states
        updateButtonStates();
      }
    } catch (error) {
      console.error("Error processing WebSocket message:", error);
    }
  };

  nativeWebSocket.onerror = (error) => {
    console.error("WebSocket error:", error);
    nativeAlgorithmRunning = false;
  };

  nativeWebSocket.onclose = () => {
    console.log(
      `Native ${currentAlgorithm.toUpperCase()} WebSocket connection closed`
    );
    nativeWebSocket = null;
  };
}

// Helper function to update button states
function updateButtonStates() {
  const nativeBfsButton = document.getElementById("nativeBfsButton");
  const nativeDfsButton = document.getElementById("nativeDfsButton");

  if (nativeBfsButton) {
    nativeBfsButton.textContent = "Start Native BFS";
    nativeBfsButton.classList.toggle(
      "running",
      nativeAlgorithmRunning && currentAlgorithm === "bfs"
    );
  }

  if (nativeDfsButton) {
    nativeDfsButton.textContent = "Start Native DFS";
    nativeDfsButton.classList.toggle(
      "running",
      nativeAlgorithmRunning && currentAlgorithm === "dfs"
    );
  }
}

// Update the best mix display title to match the current algorithm
function updateNativeMixDisplayTitle() {
  const nativeBestMixDisplay = document.getElementById("nativeBestMix");
  if (nativeBestMixDisplay) {
    // Look for an h4 element, or any title element if it exists
    const titleElement =
      nativeBestMixDisplay.querySelector("h4") ||
      nativeBestMixDisplay.querySelector("h3") ||
      nativeBestMixDisplay.querySelector("p");

    if (titleElement) {
      // Update the title to show the current algorithm
      titleElement.textContent = `Best Native ${currentAlgorithm.toUpperCase()} Mix`;
    }
  }
}

// Common function to start/stop native algorithm
async function toggleNativeAlgorithm(
  product: ProductVariety,
  algorithm: string
) {
  // Store the algorithm for this run
  currentAlgorithm = algorithm;

  // Update all UI elements to reflect the current algorithm
  updateNativeMixDisplayTitle();

  const buttonId = algorithm === "bfs" ? "nativeBfsButton" : "nativeDfsButton";
  const algorithmButton = document.getElementById(buttonId);
  if (!algorithmButton) return;

  // Check if calculation is already running
  if (nativeAlgorithmRunning) {
    // If currently running, abort and reset
    nativeAlgorithmRunning = false;

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

    // Update button states
    updateButtonStates();
    return;
  }

  // Determine which implementation type to use
  const implementation = algorithm === "bfs" ? "native-bfs" : "native-dfs";

  // Create displays using shared components with standardized implementation type
  createProgressDisplay(implementation);
  createBestMixDisplay(implementation);

  // Set start time for execution time calculation
  nativeStartTime = Date.now();
  nativeAlgorithmRunning = true;
  nativeLastUpdate = 0;
  nativeCurrentProduct = product;
  nativeBestMix = { mix: [], profit: -Infinity };

  // Initialize WebSocket connection for progress updates
  initializeNativeWebSocket();

  // Start the calculation
  algorithmButton.textContent = `Stop Native ${algorithm.toUpperCase()}`;

  // Initial progress update
  updateNativeProgressDisplay(
    {
      processed: 0,
      total: 100,
      depth: 1,
      executionTime: 0,
      message: `Starting native ${algorithm} calculation...`,
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
    const response = await fetch("http://localhost:3000/api/mix", {
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
        algorithm, // Specify algorithm
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
      nativeAlgorithmRunning = false;
      updateButtonStates();
    }
  } catch (error: unknown) {
    // Handle errors with proper type checking
    console.error(`Native ${algorithm.toUpperCase()} error:`, error);

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
    nativeAlgorithmRunning = false;
    updateButtonStates();
  }
}

// Specific functions to toggle BFS and DFS algorithms
export async function toggleNativeBFS(product: ProductVariety) {
  return toggleNativeAlgorithm(product, "bfs");
}

export async function toggleNativeDFS(product: ProductVariety) {
  return toggleNativeAlgorithm(product, "dfs");
}

// Export state getters
export function isNativeBfsRunning(): boolean {
  return nativeAlgorithmRunning;
}

export function getNativeBestMix(): BfsMixResult {
  return nativeBestMix;
}
