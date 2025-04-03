import {
  applySubstanceRules,
  calculateFinalCost,
  calculateFinalPrice,
  ProductVariety,
  substances,
} from "./substances";

// Constants
export const MAX_RECIPE_DEPTH = 6;

// BFS state variables
let bfsRunning = false;
let bfsPaused = false;
let bestMix: { mix: string[]; profit: number } = { mix: [], profit: -Infinity };
let bfsWorker: Worker | null = null;
let currentProduct: ProductVariety | null = null;
let currentProgress = {
  depth: 0,
  processed: 0,
  total: 0,
  totalProcessed: 0,
  grandTotal: 0,
};

// Helper function to create effect span HTML
function createEffectSpan(effect: string): string {
  // Convert effect name to kebab case for CSS class
  const className = effect.toLowerCase().replace(/\s+/g, "-");
  return `<span class="effect effect-${effect}">${effect}</span>`;
}

export function calculateEffects(
  mix: string[],
  initialEffect: string
): string[] {
  let effectsList = [initialEffect];
  mix.forEach((substanceName, index) => {
    const substance = substances.find((s) => s.name === substanceName);
    if (substance) {
      effectsList = applySubstanceRules(effectsList, substance, index + 1);
    }
  });
  return effectsList;
}

export function updateBestMixDisplay() {
  const bestMixDisplay = document.getElementById("bestMixDisplay");
  if (!bestMixDisplay || !currentProduct) return;

  const effectsList = calculateEffects(
    bestMix.mix,
    currentProduct.initialEffect
  );
  const sellPrice = calculateFinalPrice(currentProduct.name, effectsList);
  const cost = calculateFinalCost(bestMix.mix);
  const profit = sellPrice - cost;

  const effectsHTML = effectsList
    .map((effect) => createEffectSpan(effect))
    .join(" ");
  bestMixDisplay.innerHTML = `
    <h3>Best Mix for ${currentProduct.name}</h3>
    <p>Mix: ${bestMix.mix.join(", ")}</p>
    <p>Effects: ${effectsHTML}</p>
    <p>Sell Price: $${sellPrice.toFixed(2)}</p>
    <p>Cost: $${cost.toFixed(2)}</p>
    <p>Profit: $${profit.toFixed(2)}</p>
  `;
}

function updateProgressDisplay() {
  const progressDisplay = document.getElementById("bfsProgressDisplay");
  if (!progressDisplay) return;

  const { depth, processed, total, totalProcessed, grandTotal } =
    currentProgress;

  // Calculate percentage for current depth
  const depthPercentage =
    Math.min(100, Math.round((processed / total) * 100)) || 0;

  // Calculate overall percentage
  const overallPercentage =
    Math.min(100, Math.round((totalProcessed / grandTotal) * 100)) || 0;

  progressDisplay.innerHTML = `
    <div>Current depth: ${depth} of ${MAX_RECIPE_DEPTH}</div>
    <div>Current depth progress: ${processed.toLocaleString()} / ${total.toLocaleString()}</div>
    <div class="progress-bar-container">
      <div class="progress-bar" style="width: ${depthPercentage}%"></div>
    </div>
    <div>${depthPercentage}% of current depth complete</div>
    <div>Overall progress: ${totalProcessed.toLocaleString()} / ${grandTotal.toLocaleString()} (${overallPercentage}%)</div>
  `;
}

export function createProgressDisplay() {
  let progressDisplay = document.getElementById("bfsProgressDisplay");

  if (!progressDisplay) {
    progressDisplay = document.createElement("div");
    progressDisplay.id = "bfsProgressDisplay";
    progressDisplay.classList.add("progress-display");
    document.body.appendChild(progressDisplay);
  }

  updateProgressDisplay();
}

export async function toggleBFS(product: ProductVariety) {
  const bfsButton = document.getElementById("bfsButton");
  if (!bfsButton) return;

  if (bfsRunning) {
    bfsPaused = !bfsPaused;
    bfsButton.textContent = bfsPaused ? "Resume BFS" : "Pause BFS";
    if (bfsPaused) {
      bfsWorker?.postMessage({ type: "pause" });
    } else {
      bfsWorker?.postMessage({ type: "resume" });
    }
  } else {
    bfsRunning = true;
    bfsPaused = false;
    bfsButton.textContent = "Pause BFS";
    bestMix = { mix: [], profit: -Infinity };
    currentProduct = product;
    const bfsQueue = [[]]; // Start with an empty mix

    // Reset progress
    currentProgress = {
      depth: 0,
      processed: 0,
      total: 0,
      totalProcessed: 0,
      grandTotal: 0,
    };
    createProgressDisplay();

    if (!bfsWorker) {
      bfsWorker = new Worker(new URL("./bfsWorker.ts", import.meta.url), {
        type: "module",
      });
      bfsWorker.onmessage = (event: MessageEvent) => {
        const { type } = event.data;

        if (type === "update") {
          const { bestMix: updatedBestMix } = event.data;
          bestMix = updatedBestMix;
          updateBestMixDisplay();
        } else if (type === "progress") {
          const { depth, processed, total, totalProcessed, grandTotal } =
            event.data;
          currentProgress = {
            depth,
            processed,
            total,
            totalProcessed,
            grandTotal,
          };
          updateProgressDisplay();
        } else if (type === "done") {
          bfsRunning = false;
          bfsButton.textContent = "Start BFS";
        }
      };
    }

    bfsWorker.postMessage({
      type: "start",
      data: {
        product: { ...product }, // Pass a copy of the current product
        queue: bfsQueue,
        bestMix,
      },
    });
  }
}

export function isBfsRunning(): boolean {
  return bfsRunning;
}

export function getBestMix(): { mix: string[]; profit: number } {
  return bestMix;
}
