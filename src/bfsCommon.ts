// Common BFS Utilities and Constants
// Contains shared functions and variables used by all BFS controllers

import { createBestMixDisplay } from "./bfsMixDisplay";
import { createProgressDisplay } from "./bfsProgress";
import { typeScriptBfsController, wasmBfsController } from "./controllers";
import { ProductVariety } from "./substances";

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

// Create all progress displays
export function createProgressDisplays() {
  // Create progress displays for each implementation
  createProgressDisplay("ts-bfs");
  createProgressDisplay("wasm-bfs");
  createProgressDisplay("native-bfs");

  // Create result displays for each implementation
  createBestMixDisplay("ts");
  createBestMixDisplay("wasm");
  createBestMixDisplay("native");
}

// Add function to update the MAX_RECIPE_DEPTH
export function setMaxRecipeDepth(depth: number) {
  MAX_RECIPE_DEPTH = depth;
}

// Function to start both implementations
export async function toggleBothBFS(product: ProductVariety) {
  const bothBfsButton = document.getElementById("bothBfsButton");
  if (!bothBfsButton) return;

  // Get the current max depth value from slider
  const maxDepthSlider = document.getElementById(
    "maxDepthSlider"
  ) as HTMLInputElement;
  if (maxDepthSlider) {
    MAX_RECIPE_DEPTH = parseInt(maxDepthSlider.value, 10);
  }

  // Check if either implementation is running
  if (typeScriptBfsController.isRunning() || wasmBfsController.isRunning()) {
    // Stop both implementations
    if (typeScriptBfsController.isRunning()) {
      typeScriptBfsController.toggle(product);
    }
    if (wasmBfsController.isRunning()) {
      wasmBfsController.toggle(product);
    }
    bothBfsButton.textContent = "Start Both BFS";
  } else {
    // Start both implementations
    bothBfsButton.textContent = "Stop Both BFS";
    createProgressDisplays();

    // Start TypeScript BFS
    typeScriptBfsController.toggle(product);

    // Start WASM BFS
    wasmBfsController.toggle(product);
  }
}

// Check if any BFS is running
export function isBfsRunning(): boolean {
  return typeScriptBfsController.isRunning() || wasmBfsController.isRunning();
}

// Export the combined function to control both implementations
export { toggleBothBFS as toggleBFS };
