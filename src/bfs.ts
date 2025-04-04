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

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / (1000 * 60)) % 60;
  const hours = Math.floor(ms / (1000 * 60 * 60));
  return `${hours}h ${minutes}m ${seconds}s`;
}

function updateProgressDisplay(progress: number) {
  const progressDisplay = document.getElementById("bfsProgressDisplay");
  if (!progressDisplay) return;

  // Current execution time
  const now = Date.now();
  const executionTime = startTime > 0 ? now - startTime : 0;

  // Create HTML for progress
  progressDisplay.innerHTML = `
    <div class="overall-progress">
      <h4>WASM BFS Progress</h4>
      <div class="progress-bar-container">
        <div class="progress-bar" style="width: ${progress}%"></div>
        <span class="progress-text" data-progress="${progress}%" style="--progress-percent: ${progress}%"></span>
      </div>
      <div>Execution time: ${formatTime(executionTime)}</div>
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

  // Show progress updates
  let progress = 0;
  progressInterval = setInterval(() => {
    // Simulate progress until the WASM module completes
    progress = Math.min(progress + 1, 95); // Don't reach 100% until actually done
    updateProgressDisplay(progress);
  }, 100);

  try {
    console.log("Loading WASM module...");
    const bfsModule = await loadWasmModule();

    console.log("WASM module loaded:", bfsModule);
    console.log(
      "findBestMixJson exists?",
      typeof bfsModule.findBestMixJson === "function"
    );

    if (typeof bfsModule.findBestMixJson !== "function") {
      throw new Error("findBestMixJson function not found in WASM module");
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

    // Call the WASM function with JSON strings
    console.log("Calling findBestMixJson function...");
    const result = bfsModule.findBestMixJson(
      productJson,
      substancesJson,
      effectMultipliersJson,
      substanceRulesJson,
      MAX_RECIPE_DEPTH
    );

    console.log("WASM function returned result:", result);

    // Ensure the result.mix is a proper array
    const mixArray = Array.isArray(result.mix)
      ? result.mix
      : result.mix
      ? Array.from(result.mix)
      : [];

    console.log("Converted mix array:", mixArray);

    // Update best mix with result, ensuring mix is a proper array
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
