// Common BFS Utilities and Constants
// Contains shared functions and variables used by both TS and WASM controllers

import { ProductVariety } from "./substances";
import {
  createTsProgressDisplay,
  createTsResultDisplay,
  isTsBfsRunning,
  startTsBFS,
  updateTsProgressDisplay,
} from "./tsBfsController";
import {
  createWasmProgressDisplay,
  createWasmResultDisplay,
  isWasmBfsRunning,
  startWasmBFS,
  updateWasmProgressDisplay,
} from "./wasmBfsController";

// Constants
export let MAX_RECIPE_DEPTH = 5; // Default value, can be changed via slider

// Memory-optimized DOM update functions
// Batch DOM updates to reduce reflow and improve performance
let pendingDomUpdates: Function[] = [];
let domUpdateScheduled = false;

export function scheduleDomUpdate(updateFn: Function) {
  pendingDomUpdates.push(updateFn);

  if (!domUpdateScheduled) {
    domUpdateScheduled = true;
    requestAnimationFrame(() => {
      const updates = [...pendingDomUpdates];
      pendingDomUpdates = [];
      domUpdateScheduled = false;

      // Execute all pending DOM updates in a single frame
      updates.forEach((update) => update());
    });
  }
}

// Memory-efficient time formatters using template literals
export function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / (1000 * 60)) % 60;
  const hours = Math.floor(ms / (1000 * 60 * 60));
  return `${hours}h ${minutes}m ${seconds}s`;
}

export function formatClockTime(ms: number): string {
  const date = new Date(ms);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

// Create both progress displays
export function createProgressDisplays() {
  createTsProgressDisplay();
  createWasmProgressDisplay();
  createTsResultDisplay();
  createWasmResultDisplay();

  // Initialize progress displays
  updateTsProgressDisplay();
  updateWasmProgressDisplay(0);
}

// Add function to update the MAX_RECIPE_DEPTH
export function setMaxRecipeDepth(depth: number) {
  MAX_RECIPE_DEPTH = depth;
}

// Function to start both implementations
export async function toggleBothBFS(product: ProductVariety) {
  const bfsButton = document.getElementById("bfsButton");
  if (!bfsButton) return;

  // Get the current max depth value from slider
  const maxDepthSlider = document.getElementById(
    "maxDepthSlider"
  ) as HTMLInputElement;
  if (maxDepthSlider) {
    MAX_RECIPE_DEPTH = parseInt(maxDepthSlider.value, 10);
  }

  // Check if either implementation is running
  if (isTsBfsRunning() || isWasmBfsRunning()) {
    // Stop both implementations
    bfsButton.textContent = "Start Both BFS";
  } else {
    // Start both implementations
    bfsButton.textContent = "Stop Both BFS";
    createProgressDisplays();

    // Start TypeScript BFS
    startTsBFS(product);

    // Start WASM BFS
    startWasmBFS(product);
  }
}

// Check if any BFS is running
export function isBfsRunning(): boolean {
  return isTsBfsRunning() || isWasmBfsRunning();
}

// Export the combined function to control both implementations
export { toggleBothBFS as toggleBFS };
