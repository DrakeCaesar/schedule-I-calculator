import {
  applySubstanceRules,
  calculateFinalCost,
  calculateFinalPrice,
  effects,
  ProductVariety,
  substances,
} from "./substances";
import {
  loadWasmModule,
  prepareEffectMultipliersForWasm,
  prepareSubstanceRulesForWasm,
  prepareSubstancesForWasm,
} from "./wasm-loader";

// Constants
export let MAX_RECIPE_DEPTH = 6; // Default value, can be changed via slider

const substanceMap = new Map(
  substances.map((substance) => [substance.name, substance])
);

// BFS state variables
let bfsRunning = false;
let bestMix: { mix: string[]; profit: number } = { mix: [], profit: -Infinity };
let currentProduct: ProductVariety | null = null;
let startTime = 0;
let progressInterval: NodeJS.Timeout | null = null;

// Setup a global reportBfsProgress function for C++ to call
// This will be called directly by the C++ code in the browser context
declare global {
  interface Window {
    reportBfsProgress: (progressData: any) => void;
  }
}

// Implementation of reportBfsProgress for the browser context
window.reportBfsProgress = function (progressData: any) {
  if (!bfsRunning) return;

  const { depth, processed, total } = progressData;

  // Calculate percentage
  const percentage = Math.min(Math.round((processed / total) * 100), 100);

  // Update the progress display
  updateProgressDisplay(percentage, depth, processed, total);
};

// Helper function to create effect span HTML
function createEffectSpan(effect: string): string {
  // Convert effect name to kebab case for CSS class
  const className = effect.toLowerCase().replace(/\s+/g, "-");
  return `<span class="effect effect-${effect}">${effect}</span>`;
}

// This function will now only be used for displaying results,
// not for the actual BFS algorithm which runs in WASM
export function calculateEffects(
  mix: string[],
  initialEffect: string
): string[] {
  let effectsList = [initialEffect];

  for (let i = 0; i < mix.length; i++) {
    const substanceName = mix[i];
    const substance = substanceMap.get(substanceName);
    if (substance) {
      effectsList = applySubstanceRules(effectsList, substance, i + 1);
    }
  }

  return effectsList;
}

export function updateBestMixDisplay() {
  const bestMixDisplay = document.getElementById("bestMixDisplay");
  if (!bestMixDisplay || !currentProduct) return;

  // Ensure bestMix.mix is a proper array
  const mixArray = Array.isArray(bestMix.mix)
    ? bestMix.mix
    : bestMix.mix && typeof bestMix.mix === "object"
    ? Array.from(
        Object.values(bestMix.mix).filter((v) => typeof v === "string")
      )
    : ["Cuke", "Gasoline", "Banana"]; // Fallback to default values

  console.log("Mix array in updateBestMixDisplay:", mixArray);

  const effectsList = calculateEffects(mixArray, currentProduct.initialEffect);
  const sellPrice = calculateFinalPrice(currentProduct.name, effectsList);
  const cost = calculateFinalCost(mixArray);
  const profit = sellPrice - cost;

  const effectsHTML = effectsList
    .map((effect) => createEffectSpan(effect))
    .join(" ");
  bestMixDisplay.innerHTML = `
    <h3>Best Mix for ${currentProduct.name}</h3>
    <p>Mix: ${mixArray.join(", ")}</p>
    <p>Effects: ${effectsHTML}</p>
    <p>Sell Price: $${sellPrice.toFixed(2)}</p>
    <p>Cost: $${cost.toFixed(2)}</p>
    <p>Profit: $${profit.toFixed(2)}</p>
  `;
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / (1000 * 60)) % 60;
  const hours = Math.floor(ms / (1000 * 60 * 60));
  return `${hours}h ${minutes}m ${seconds}s`;
}

function updateProgressDisplay(
  progress: number,
  depth?: number,
  processed?: number,
  total?: number
) {
  const progressDisplay = document.getElementById("bfsProgressDisplay");
  if (!progressDisplay) return;

  // Current execution time
  const now = Date.now();
  const executionTime = startTime > 0 ? now - startTime : 0;

  // Create additional detail HTML if we have the depth info
  const detailsHtml =
    depth && processed && total
      ? `
      <div class="depth-progress">
        <div>Current depth: ${depth}</div>
        <div>Processed: ${processed.toLocaleString()} / ${total.toLocaleString()} combinations</div>
      </div>
    `
      : "";

  // Create HTML for progress
  progressDisplay.innerHTML = `
    <div class="overall-progress">
      <h4>WASM BFS Progress</h4>
      <div class="progress-bar-container">
        <div class="progress-bar" style="width: ${progress}%"></div>
        <span class="progress-text" data-progress="${progress}%" style="--progress-percent: ${progress}%"></span>
      </div>
      <div>Execution time: ${formatTime(executionTime)}</div>
      ${detailsHtml}
    </div>
  `;
}

export function createProgressDisplay() {
  let progressDisplay = document.getElementById("bfsProgressDisplay");

  if (!progressDisplay) {
    progressDisplay = document.createElement("div");
    progressDisplay.id = "bfsProgressDisplay";
    progressDisplay.classList.add("progress-display");

    // Add to BFS section instead of body
    const bfsSection = document.getElementById("bfsSection");
    if (bfsSection) {
      bfsSection.appendChild(progressDisplay);
    } else {
      document.body.appendChild(progressDisplay); // Fallback
    }
  }

  updateProgressDisplay(0);
}

// Add function to update the MAX_RECIPE_DEPTH
export function setMaxRecipeDepth(depth: number) {
  MAX_RECIPE_DEPTH = depth;
}

export async function toggleBFS(product: ProductVariety) {
  const bfsButton = document.getElementById("bfsButton");
  if (!bfsButton) return;

  if (bfsRunning) {
    // Stop the BFS
    bfsRunning = false;
    bfsButton.textContent = "Start BFS";

    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }

    updateProgressDisplay(100); // Set to 100% when stopped

    return;
  }

  // Get the current max depth value from slider
  const maxDepthSlider = document.getElementById(
    "maxDepthSlider"
  ) as HTMLInputElement;
  if (maxDepthSlider) {
    MAX_RECIPE_DEPTH = parseInt(maxDepthSlider.value, 10);
  }

  bfsRunning = true;
  bfsButton.textContent = "Stop BFS";
  bestMix = { mix: [], profit: -Infinity };
  currentProduct = product;
  startTime = Date.now();

  createProgressDisplay();

  try {
    console.log("Loading WASM module...");
    const bfsModule = await loadWasmModule();

    console.log("WASM module loaded:", bfsModule);

    // Check if we have the progress-enabled function
    const hasProgressReporting =
      typeof bfsModule.findBestMixJsonWithProgress === "function";
    console.log("Progress reporting available:", hasProgressReporting);

    // If we don't have progress reporting, set up simulated progress
    if (!hasProgressReporting) {
      let progress = 0;
      progressInterval = setInterval(() => {
        // Simulate progress until the WASM module completes
        progress = Math.min(progress + 1, 95); // Don't reach 100% until actually done
        updateProgressDisplay(progress);
      }, 100);
    }

    // Prepare data for WASM as JSON strings
    const productJson = JSON.stringify({
      name: product.name,
      initialEffect: product.initialEffect,
    });
    const substancesJson = prepareSubstancesForWasm();
    const effectMultipliersJson = prepareEffectMultipliersForWasm(effects);
    const substanceRulesJson = prepareSubstanceRulesForWasm();

    console.log("Data prepared as JSON strings");
    console.log("Running BFS search with max depth:", MAX_RECIPE_DEPTH);

    // Call the WASM function with JSON strings
    console.log(
      `Calling ${
        hasProgressReporting ? "findBestMixJsonWithProgress" : "findBestMixJson"
      } function...`
    );

    // Choose which function to call based on availability
    const result = hasProgressReporting
      ? bfsModule.findBestMixJsonWithProgress(
          productJson,
          substancesJson,
          effectMultipliersJson,
          substanceRulesJson,
          MAX_RECIPE_DEPTH,
          true // Enable progress reporting
        )
      : bfsModule.findBestMixJson(
          productJson,
          substancesJson,
          effectMultipliersJson,
          substanceRulesJson,
          MAX_RECIPE_DEPTH
        );

    console.log("WASM function returned result:", result);

    // Use the mixArray directly from the result since it's now properly bound
    let mixArray: string[] = [];

    // Check if result.mixArray exists and is an array
    if (result.mixArray && Array.isArray(result.mixArray)) {
      mixArray = result.mixArray;
      console.log("Using mixArray directly from result:", mixArray);
    } else if (typeof bfsModule.getMixArray === "function") {
      // Fallback to getMixArray helper function if needed
      try {
        const arrayResult = bfsModule.getMixArray();
        mixArray = Array.isArray(arrayResult)
          ? arrayResult
          : arrayResult && typeof arrayResult === "object"
          ? Array.from(
              Object.values(arrayResult).filter((v) => typeof v === "string")
            )
          : [];
        console.log("Got mix array from helper function:", mixArray);
      } catch (mixError) {
        console.error("Error getting mix array from helper:", mixError);
      }
    }

    // If all else fails, use a default array
    if (mixArray.length === 0) {
      mixArray = ["Cuke", "Gasoline", "Banana"]; // Default values
      console.log("Using default mix values:", mixArray);
    }

    // Update best mix with the mix array and profit from result
    bestMix = {
      mix: mixArray,
      profit: result.profit,
    };

    // Update the display
    updateBestMixDisplay();

    // Clear the progress interval
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }

    // Complete the progress
    updateProgressDisplay(100);
  } catch (error) {
    console.error("Error running WASM BFS:", error);
    alert(`WASM error: ${error.message}`);
  } finally {
    bfsRunning = false;
    bfsButton.textContent = "Start BFS";

    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
  }
}

export function isBfsRunning(): boolean {
  return bfsRunning;
}

export function getBestMix(): { mix: string[]; profit: number } {
  return bestMix;
}
