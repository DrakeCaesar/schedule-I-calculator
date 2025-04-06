// BFS Results Display Handler
// Shared functionality for displaying results of BFS calculations

import { scheduleDomUpdate } from "./bfsCommon";
import { ProductVariety } from "./substances";
import { calculateEffects } from "./tsBfsController";

// Interface for BFS result data
export interface BfsMixResult {
  mix: string[];
  profit: number;
  sellPrice?: number;
  cost?: number;
}

// Helper function to create effect span HTML
export function createEffectSpan(effect: string): string {
  // Convert effect name to kebab case for CSS class
  const className = effect.replace(/\s+/g, "-");
  return `<span class="effect effect-${className}">${effect}</span>`;
}

// Creates or updates a best mix display for a specific implementation
export function updateBestMixDisplay(
  implementation: "ts" | "wasm" | "native",
  bestMix: BfsMixResult,
  currentProduct: ProductVariety
): void {
  const displayId =
    implementation === "native"
      ? "nativeBestMix" // Native uses a slightly different ID format
      : `${implementation}BestMixDisplay`;

  const bestMixDisplay = document.getElementById(displayId);
  if (!bestMixDisplay || !currentProduct) return;

  // Ensure bestMix.mix is a proper array
  const mixArray = Array.isArray(bestMix.mix)
    ? bestMix.mix
    : bestMix.mix && typeof bestMix.mix === "object"
    ? Array.from(
        Object.values(bestMix.mix).filter((v) => typeof v === "string")
      )
    : []; // Empty array as fallback

  // Calculate effects for display
  const effectsList = calculateEffects(mixArray, currentProduct.initialEffect);
  const effectsHTML = effectsList
    .map((effect) => createEffectSpan(effect))
    .join(" ");

  // Get implementation-specific display name
  const implementationNames = {
    ts: "TypeScript",
    wasm: "WebAssembly",
    native: "Native",
  };

  // Schedule the DOM update
  scheduleDomUpdate(() => {
    bestMixDisplay.innerHTML = `
      <h3>${implementationNames[implementation]} BFS Result for ${
      currentProduct.name
    }</h3>
      <p>Mix: ${mixArray.join(", ")}</p>
      <p>Effects: ${effectsHTML}</p>
      <p>Sell Price: $${bestMix.sellPrice?.toFixed(2) || "0.00"}</p>
      <p>Cost: $${bestMix.cost?.toFixed(2) || "0.00"}</p>
      <p>Profit: $${bestMix.profit.toFixed(2)}</p>
    `;

    // Make sure the display is visible
    bestMixDisplay.style.display = "block";
  });
}

// Create or get a best mix display element for a specific implementation
export function createBestMixDisplay(
  implementation: "ts" | "wasm" | "native"
): HTMLElement {
  const displayId =
    implementation === "native"
      ? "nativeBestMix" // Native uses a slightly different ID format
      : `${implementation}BestMixDisplay`;

  let bestMixDisplay = document.getElementById(displayId);

  if (!bestMixDisplay) {
    bestMixDisplay = document.createElement("div");
    bestMixDisplay.id = displayId;
    bestMixDisplay.classList.add("best-mix-display");

    // Default hidden state with a placeholder message
    bestMixDisplay.style.display = "none";
    bestMixDisplay.innerHTML = `<p>Run ${implementation.toUpperCase()} BFS to see results</p>`;

    // Find the appropriate column to place the display
    const columnSelector = `.${implementation}-column`;
    const column = document.querySelector(columnSelector);

    if (column) {
      // Find if there's already a results display in this column
      const existingDisplay = column.querySelector(".best-mix-display");
      if (existingDisplay) {
        column.replaceChild(bestMixDisplay, existingDisplay);
      } else {
        // Insert at beginning of column
        column.insertBefore(bestMixDisplay, column.firstChild);
      }
    } else {
      // Fallback - append to BFS section
      const bfsSection = document.getElementById("bfsSection");
      if (bfsSection) {
        bfsSection.appendChild(bestMixDisplay);
      }
    }
  }

  return bestMixDisplay;
}
