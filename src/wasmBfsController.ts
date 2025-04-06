// WebAssembly BFS Controller
// Manages the WebAssembly implementation of the BFS algorithm

import { MAX_RECIPE_DEPTH, scheduleDomUpdate } from "./bfsCommon";
import {
  calculateFinalCost,
  calculateFinalPrice,
  ProductVariety,
} from "./substances";
import { calculateEffects } from "./tsBfsController";

// State variables for WebAssembly BFS
let wasmBfsRunning = false;
let wasmBestMix: {
  mix: string[];
  profit: number;
  sellPrice?: number;
  cost?: number;
} = {
  mix: [],
  profit: -Infinity,
};
let wasmCurrentProduct: ProductVariety | null = null;
let wasmStartTime = 0;
let wasmBfsWorker: Worker | null = null;

// Progress throttling
let lastWasmProgressUpdate = 0;
const PROGRESS_UPDATE_INTERVAL = 250; // ms

// Helper function to create effect span HTML
function createEffectSpan(effect: string): string {
  // Convert effect name to kebab case for CSS class
  const className = effect.replace(/\s+/g, "-");
  return `<span class="effect effect-${className}">${effect}</span>`;
}

export function updateWasmBestMixDisplay() {
  const bestMixDisplay = document.getElementById("wasmBestMixDisplay");
  if (!bestMixDisplay || !wasmCurrentProduct) return;

  // Ensure bestMix.mix is a proper array
  const mixArray = Array.isArray(wasmBestMix.mix)
    ? wasmBestMix.mix
    : wasmBestMix.mix && typeof wasmBestMix.mix === "object"
    ? Array.from(
        Object.values(wasmBestMix.mix).filter((v) => typeof v === "string")
      )
    : []; // Empty array as fallback

  // Use existing properties if available to avoid recalculation
  let sellPrice = wasmBestMix.sellPrice;
  let cost = wasmBestMix.cost;

  if (sellPrice === undefined || cost === undefined) {
    const effectsList = calculateEffects(
      mixArray,
      wasmCurrentProduct.initialEffect
    );
    sellPrice = calculateFinalPrice(wasmCurrentProduct.name, effectsList);
    cost = calculateFinalCost(mixArray);

    // Cache values for future use
    wasmBestMix.sellPrice = sellPrice;
    wasmBestMix.cost = cost;
  }

  const profit = sellPrice - cost;

  // Schedule the DOM update
  scheduleDomUpdate(() => {
    // Calculate effects for display - consistent with native implementation
    const effectsList = calculateEffects(
      mixArray,
      wasmCurrentProduct?.initialEffect || ""
    );
    const effectsHTML = effectsList
      .map((effect) => createEffectSpan(effect))
      .join(" ");

    bestMixDisplay.innerHTML = `
      <h3>WebAssembly BFS Result for ${wasmCurrentProduct?.name}</h3>
      <p>Mix: ${mixArray.join(", ")}</p>
      <p>Effects: ${effectsHTML}</p>
      <p>Sell Price: $${sellPrice?.toFixed(2)}</p>
      <p>Cost: $${cost?.toFixed(2)}</p>
      <p>Profit: $${profit.toFixed(2)}</p>
    `;

    // Make sure the display is visible
    bestMixDisplay.style.display = "block";
  });
}

// Utility functions for time formatting
import { formatClockTime, formatTime } from "./bfsCommon";

export function updateWasmProgressDisplay(progress: number) {
  const currentTime = Date.now();

  // Always update when progress is 100%, otherwise throttle updates
  if (
    progress !== 100 &&
    currentTime - lastWasmProgressUpdate < PROGRESS_UPDATE_INTERVAL
  ) {
    return;
  }

  lastWasmProgressUpdate = currentTime;

  const progressDisplay = document.getElementById("wasmBfsProgressDisplay");
  if (!progressDisplay) return;

  // Current execution time
  const now = Date.now();
  const executionTime = wasmStartTime > 0 ? now - wasmStartTime : 0;

  // Calculate estimated remaining time based on progress
  let remainingTime = 0;
  if (progress > 0 && progress < 100) {
    remainingTime = Math.round((executionTime / progress) * (100 - progress));
  }

  // Calculate estimated finish time
  const estimatedFinishTime = now + remainingTime;

  // Schedule the DOM update
  scheduleDomUpdate(() => {
    // Create HTML for progress to match TypeScript BFS format
    progressDisplay.innerHTML = `
      <div class="overall-progress">
        <h4>WebAssembly BFS Progress</h4>
        <div>Total processed: ${progress}%</div>
        <div class="progress-bar-container">
          <div class="progress-bar" style="width: ${progress}%"></div>
          <span class="progress-text" data-progress="${progress}%" style="--progress-percent: ${progress}%"></span>
        </div>
        <div>Execution time: ${formatTime(executionTime)}</div>
        <div>Estimated time remaining: ${formatTime(remainingTime)}</div>
        <div>Estimated finish time: ${formatClockTime(
          estimatedFinishTime
        )}</div>
      </div>
    `;
  });
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
      if (
        event.data.processed !== undefined &&
        event.data.total !== undefined &&
        event.data.total > 0
      ) {
        // If we have processed and total values, calculate percentage
        progress = Math.min(
          100,
          Math.round((event.data.processed / event.data.total) * 100)
        );
      } else if (event.data.progress !== undefined) {
        // If we already have a percentage, use that
        progress = event.data.progress;
      }

      // Force progress to 100% if we're done
      if (type === "done") {
        progress = 100;
      }

      // Update the progress display with the progress from the worker
      updateWasmProgressDisplay(progress);
    } else if (type === "done") {
      // Force a final progress update to 100% when done
      updateWasmProgressDisplay(100);

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

// Function to create WebAssembly progress display
export function createWasmProgressDisplay() {
  let wasmProgressDisplay = document.getElementById("wasmBfsProgressDisplay");
  if (!wasmProgressDisplay) {
    wasmProgressDisplay = document.createElement("div");
    wasmProgressDisplay.id = "wasmBfsProgressDisplay";
    wasmProgressDisplay.classList.add("progress-display");

    const wasmColumn = document.querySelector(".wasm-column");
    if (wasmColumn) {
      // Find if there's already a progress display in this column
      const existingDisplay = wasmColumn.querySelector(".progress-display");
      if (existingDisplay) {
        wasmColumn.replaceChild(wasmProgressDisplay, existingDisplay);
      } else {
        wasmColumn.appendChild(wasmProgressDisplay);
      }
    } else {
      // Fallback - append to BFS section
      const bfsSection = document.getElementById("bfsSection");
      if (bfsSection) {
        bfsSection.appendChild(wasmProgressDisplay);
      }
    }
  }

  updateWasmProgressDisplay(0);
}

// Function to create WebAssembly result display
export function createWasmResultDisplay() {
  let wasmBestMixDisplay = document.getElementById("wasmBestMixDisplay");
  if (!wasmBestMixDisplay) {
    wasmBestMixDisplay = document.createElement("div");
    wasmBestMixDisplay.id = "wasmBestMixDisplay";
    wasmBestMixDisplay.classList.add("best-mix-display");

    const wasmColumn = document.querySelector(".wasm-column");
    if (wasmColumn) {
      // Find if there's already a results display in this column
      const existingDisplay = wasmColumn.querySelector(".best-mix-display");
      if (existingDisplay) {
        wasmColumn.replaceChild(wasmBestMixDisplay, existingDisplay);
      } else {
        // Insert at beginning of column
        wasmColumn.insertBefore(wasmBestMixDisplay, wasmColumn.firstChild);
      }
    } else {
      // Fallback - append to BFS section
      const bfsSection = document.getElementById("bfsSection");
      if (bfsSection) {
        bfsSection.appendChild(wasmBestMixDisplay);
      }
    }
  }
}

// Function to run only the WebAssembly BFS
export async function toggleWasmBFS(product: ProductVariety) {
  const wasmBfsButton = document.getElementById("wasmBfsButton");
  if (!wasmBfsButton) return;

  // Get the current max depth value from slider
  const maxDepthSlider = document.getElementById(
    "maxDepthSlider"
  ) as HTMLInputElement;
  if (maxDepthSlider) {
    // Using the imported MAX_RECIPE_DEPTH from common
  }

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
    // Create only the WASM progress display
    createWasmProgressDisplay();
    // Create only the WASM result display
    createWasmResultDisplay();

    // Start WebAssembly BFS
    wasmBfsButton.textContent = "Stop WASM BFS";
    startWasmBFS(product);
  }
}

// Export state getters
export function isWasmBfsRunning(): boolean {
  return wasmBfsRunning;
}

export function getWasmBestMix(): {
  mix: string[];
  profit: number;
  sellPrice?: number;
  cost?: number;
} {
  return wasmBestMix;
}
