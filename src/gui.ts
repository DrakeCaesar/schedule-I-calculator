// --- UI State Variables ---

import { currentMix, currentProduct } from ".";
import { MAX_RECIPE_DEPTH } from "./bfs";
import { formatClockTime, formatTime, toggleBothBFS } from "./bfsCommon";
import {
  applySubstanceRules,
  calculateFinalCost,
  calculateFinalPrice,
  effects,
  substances,
} from "./substances";
import { calculateEffects, toggleTsBFS } from "./tsBfsController";
import { toggleWasmBFS } from "./wasmBfsController";
import {
  prepareEffectMultipliersForWasm,
  prepareSubstanceRulesForWasm,
  prepareSubstancesForWasm,
} from "./wasmLoader";

const STORAGE_KEY_MIX = "currentMix";
const STORAGE_KEY_PRODUCT = "currentProduct";

// --- UI Update Functions ---

// Update the product display area
export function updateProductDisplay() {
  const productDisplay = document.getElementById("productDisplay");
  if (productDisplay) {
    const initialEffectText = currentProduct.initialEffect
      ? ` (Initial Effect: ${currentProduct.initialEffect})`
      : "";
    productDisplay.textContent = `Product: ${currentProduct.name}${initialEffectText}`;
  }
  // Reset mix additives when a new product is chosen.
  updateMixListUI();
  updateResult();
  saveToLocalStorage();
}

// Render the mix list items (each additive in the drop zone)
export function updateMixListUI() {
  const mixList = document.getElementById("mixList");
  if (!mixList) return;
  mixList.innerHTML = "";
  currentMix.forEach((substanceName, index) => {
    const li = document.createElement("li");
    li.textContent = substanceName;
    li.setAttribute("draggable", "true");
    li.dataset.source = "mix";
    li.dataset.index = index.toString();
    li.addEventListener("dragstart", onDragStart);
    mixList.appendChild(li);
  });
}

function createEffectSpan(effect: string): string {
  // Convert effect name to kebab case for CSS class
  const className = effect.replace(/\s+/g, "-");
  return `<span class="effect effect-${className}">${effect}</span>`;
}

// Recalculate the resulting effects and price and update the result section.
export function updateResult() {
  let effectsList = [currentProduct.initialEffect];
  // Process each additive in order.
  let recipeLength = 0;
  for (const substanceName of currentMix) {
    recipeLength++;
    const substance = substances.find((s) => s.name === substanceName);
    if (substance) {
      effectsList = applySubstanceRules(effectsList, substance, recipeLength);
    }
  }
  const finalPrice = calculateFinalPrice(currentProduct.name, effectsList);
  const finalCost = calculateFinalCost(currentMix);
  const profit = finalPrice - finalCost;

  const finalEffectsEl = document.getElementById("finalEffects");
  const finalPriceEl = document.getElementById("finalPrice");
  const finalCostEl = document.getElementById("finalCost");
  const finalProfitEl = document.getElementById("finalProfit");

  if (finalEffectsEl) {
    const coloredEffects = effectsList.map((effect) =>
      createEffectSpan(effect)
    );
    finalEffectsEl.innerHTML = "Effects: " + coloredEffects.join(" ");
  }
  if (finalPriceEl) {
    finalPriceEl.textContent = "Price: $" + finalPrice.toFixed(2);
  }
  if (finalCostEl) {
    finalCostEl.textContent = "Cost: $" + finalCost.toFixed(2);
  }
  if (finalProfitEl) {
    finalProfitEl.textContent = "Profit: $" + profit.toFixed(2);
  }
}

// --- Drag & Drop Handlers ---

export function onDragStart(e: DragEvent) {
  const target = e.target as HTMLElement;
  const source = target.dataset.source;
  if (source === "sidebar") {
    const substanceName = target.dataset.substance;
    if (e.dataTransfer && substanceName) {
      e.dataTransfer.setData(
        "text/plain",
        JSON.stringify({ source: "sidebar", name: substanceName })
      );
    }
  } else if (source === "mix") {
    const index = target.dataset.index;
    if (e.dataTransfer && index !== undefined) {
      e.dataTransfer.setData(
        "text/plain",
        JSON.stringify({ source: "mix", index: index })
      );
    }
  }
}

export function onMixDrop(e: DragEvent) {
  e.preventDefault();
  if (!e.dataTransfer) return;
  const data = e.dataTransfer.getData("text/plain");
  const dropData = JSON.parse(data);
  const mixListEl = document.getElementById("mixList");
  let insertIndex = currentMix.length;

  if (mixListEl) {
    const rect = mixListEl.getBoundingClientRect();
    const mouseY = e.clientY;
    for (let i = 0; i < mixListEl.children.length; i++) {
      const child = mixListEl.children[i] as HTMLElement;
      const childRect = child.getBoundingClientRect();
      if (mouseY < childRect.top + childRect.height / 2) {
        insertIndex = i;
        break;
      }
    }
  }

  if (dropData.source === "sidebar") {
    currentMix.splice(insertIndex, 0, dropData.name);
  } else if (dropData.source === "mix") {
    const oldIndex = parseInt(dropData.index, 10);
    if (oldIndex < insertIndex) {
      insertIndex = insertIndex - 1;
    }
    const [moved] = currentMix.splice(oldIndex, 1);
    currentMix.splice(insertIndex, 0, moved);
  }
  updateMixListUI();
  updateResult();
  saveToLocalStorage();
}

export function onMixDragOver(e: DragEvent) {
  e.preventDefault();
}

export function onTrashDrop(e: DragEvent) {
  e.preventDefault();
  if (!e.dataTransfer) return;
  const data = e.dataTransfer.getData("text/plain");
  const dropData = JSON.parse(data);
  if (dropData.source === "mix") {
    const index = parseInt(dropData.index, 10);
    currentMix.splice(index, 1);
    updateMixListUI();
    updateResult();
    saveToLocalStorage();
  }
}

export function onTrashDragOver(e: DragEvent) {
  e.preventDefault();
}

function saveToLocalStorage() {
  localStorage.setItem(STORAGE_KEY_MIX, JSON.stringify(currentMix));
  localStorage.setItem(STORAGE_KEY_PRODUCT, JSON.stringify(currentProduct));
}

export function loadFromLocalStorage() {
  try {
    const savedMix = localStorage.getItem(STORAGE_KEY_MIX);
    const savedProduct = localStorage.getItem(STORAGE_KEY_PRODUCT);

    if (savedMix) {
      const parsedMix = JSON.parse(savedMix);
      // Clear current mix and load saved items
      currentMix.length = 0; // Clear the array
      currentMix.push(...parsedMix); // Add all items from saved mix
    }

    if (savedProduct) {
      const parsedProduct = JSON.parse(savedProduct);
      Object.assign(currentProduct, parsedProduct);

      // Select the corresponding radio button
      setTimeout(() => {
        const productRadios = document.querySelectorAll(
          'input[name="product"]'
        );
        for (const radio of productRadios) {
          const inputRadio = radio as HTMLInputElement;
          if (inputRadio.value === currentProduct.name) {
            inputRadio.checked = true;
            break;
          }
        }
      }, 0);
    }

    // Update UI with loaded data
    updateMixListUI();
    updateResult();
  } catch (error) {
    console.error("Error loading saved state:", error);
  }
}

export function toggleBFS() {
  toggleBothBFS(currentProduct);
}

export function toggleTS() {
  toggleTsBFS(currentProduct);
}

export function toggleWASM() {
  toggleWasmBFS(currentProduct);
}

// Function to create Native BFS progress display
export function createNativeProgressDisplay() {
  let nativeProgressDisplay = document.getElementById("nativeProgressDisplay");
  if (!nativeProgressDisplay) {
    nativeProgressDisplay = document.createElement("div");
    nativeProgressDisplay.id = "nativeProgressDisplay";
    nativeProgressDisplay.classList.add("progress-display");

    const nativeColumn = document.querySelector(".native-column");
    if (nativeColumn) {
      // Find if there's already a progress display in this column
      const existingDisplay = nativeColumn.querySelector(".progress-display");
      if (existingDisplay) {
        nativeColumn.replaceChild(nativeProgressDisplay, existingDisplay);
      } else {
        nativeColumn.appendChild(nativeProgressDisplay);
      }
    } else {
      // Fallback - append to BFS section
      const bfsSection = document.getElementById("bfsSection");
      if (bfsSection) {
        bfsSection.appendChild(nativeProgressDisplay);
      }
    }
  }

  updateNativeProgressDisplay(0, "Ready");
}

// Function to create Native result display
export function createNativeResultDisplay() {
  let nativeBestMixDisplay = document.getElementById("nativeBestMix");
  if (!nativeBestMixDisplay) {
    nativeBestMixDisplay = document.createElement("div");
    nativeBestMixDisplay.id = "nativeBestMix";
    nativeBestMixDisplay.classList.add("best-mix-display");

    const nativeColumn = document.querySelector(".native-column");
    if (nativeColumn) {
      // Find if there's already a results display in this column
      const existingDisplay = nativeColumn.querySelector(".best-mix-display");
      if (existingDisplay) {
        nativeColumn.replaceChild(nativeBestMixDisplay, existingDisplay);
      } else {
        // Insert at beginning of column
        nativeColumn.insertBefore(
          nativeBestMixDisplay,
          nativeColumn.firstChild
        );
      }
    } else {
      // Fallback - append to BFS section
      const bfsSection = document.getElementById("bfsSection");
      if (bfsSection) {
        bfsSection.appendChild(nativeBestMixDisplay);
      }
    }
  }
}

// Updated helper function to update the progress display for native BFS
function updateNativeProgressDisplay(progress: number, message: string) {
  const progressDisplay = document.getElementById("nativeProgressDisplay");
  if (!progressDisplay) return;

  // Calculate current execution time
  const now = Date.now();
  const executionTime = nativeStartTime > 0 ? now - nativeStartTime : 0;

  // Calculate estimated remaining time based on progress
  let remainingTime = 0;
  if (progress > 0 && progress < 100) {
    remainingTime = Math.round((executionTime / progress) * (100 - progress));
  }

  // Calculate estimated finish time
  const estimatedFinishTime = now + remainingTime;

  // Format progress percentage
  const formattedProgress = Math.max(0, Math.min(100, progress));

  // Update the DOM with progress information to match TypeScript BFS format
  progressDisplay.innerHTML = `
    <div class="overall-progress">
      <h4>Native BFS Progress</h4>
      <div>Status: ${message}</div>
      <div class="progress-bar-container">
        <div class="progress-bar" style="width: ${formattedProgress}%"></div>
        <span class="progress-text" data-progress="${formattedProgress}%" style="--progress-percent: ${formattedProgress}%"></span>
      </div>
      <div>Execution time: ${formatTime(executionTime)}</div>
      <div>Estimated time remaining: ${formatTime(remainingTime)}</div>
      <div>Estimated finish time: ${formatClockTime(estimatedFinishTime)}</div>
    </div>
  `;
}

// Add a variable to track native BFS start time
let nativeStartTime = 0;

// Helper function to update a best mix display with consistent formatting
function updateNativeBestMixDisplay(bestMix: {
  mix: string[];
  profit: number;
  sellPrice: number;
  cost: number;
}) {
  const bestMixDisplay = document.getElementById("nativeBestMix");
  if (!bestMixDisplay || !currentProduct) return;

  // Calculate effects for display
  const effectsList =
    bestMix.mix && bestMix.mix.length > 0
      ? calculateEffects(bestMix.mix, currentProduct.initialEffect)
      : [currentProduct.initialEffect];

  const effectsHTML = effectsList
    .map((effect) => createEffectSpan(effect))
    .join(" ");

  // Schedule the DOM update
  bestMixDisplay.innerHTML = `
    <h3>Native BFS Result for ${currentProduct.name}</h3>
    <p>Mix: ${bestMix.mix.join(", ")}</p>
    <p>Effects: ${effectsHTML}</p>
    <p>Sell Price: $${bestMix.sellPrice.toFixed(2)}</p>
    <p>Cost: $${bestMix.cost.toFixed(2)}</p>
    <p>Profit: $${bestMix.profit.toFixed(2)}</p>
  `;

  // Make the display visible
  bestMixDisplay.style.display = "block";
}

// Function to toggle native BFS processing via Node.js server
export function toggleNative() {
  const nativeBfsButton = document.getElementById("nativeBfsButton");
  if (!nativeBfsButton) return;

  // Check if calculation is already running
  const progressDisplay = document.getElementById("nativeProgressDisplay");
  const isRunning = progressDisplay?.classList.contains("running");

  if (isRunning) {
    // If currently running, abort and reset
    if (progressDisplay) {
      progressDisplay.classList.remove("running");
      updateNativeProgressDisplay(0, "Calculation canceled");
    }
    nativeBfsButton.textContent = "Start Native BFS";
    return;
  }

  // Create only the Native progress display
  createNativeProgressDisplay();
  // Create only the Native result display
  createNativeResultDisplay();

  // Set start time for execution time calculation
  nativeStartTime = Date.now();

  // Start the BFS calculation
  if (progressDisplay) {
    progressDisplay.classList.add("running");
  }
  nativeBfsButton.textContent = "Stop Native BFS";

  updateNativeProgressDisplay(0, "Starting native calculation...");

  // Prepare data for the server
  const maxDepthEl = document.getElementById(
    "maxDepthSlider"
  ) as HTMLInputElement;
  const maxDepth = maxDepthEl
    ? parseInt(maxDepthEl.value, 10)
    : MAX_RECIPE_DEPTH;

  const productJson = {
    name: currentProduct.name,
    initialEffect: currentProduct.initialEffect,
  };

  // Get data in the same format as we use for WASM
  const substancesJson = JSON.parse(prepareSubstancesForWasm());
  const effectMultipliersJson = JSON.parse(
    prepareEffectMultipliersForWasm(effects)
  );
  const substanceRulesJson = JSON.parse(prepareSubstanceRulesForWasm());

  // Send the data to the server - use the full URL with port
  fetch("http://localhost:3000/api/bfs", {
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
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(
          `Server responded with ${response.status}: ${response.statusText}`
        );
      }
      return response.json();
    })
    .then((data) => {
      // Process successful result
      const executionTime = Date.now() - nativeStartTime;
      const formattedTime = (executionTime / 1000).toFixed(2);

      if (!data.success) {
        throw new Error(data.error || "Unknown server error");
      }

      // Display 100% progress
      updateNativeProgressDisplay(
        100,
        `Calculation complete in ${formattedTime}s`
      );

      // Extract results and update the UI
      const result = data.result;
      if (!result) {
        throw new Error("No result data received");
      }

      // Convert result format to match our UI expectations
      const bestMix = {
        mix: result.mixArray || [],
        profit: result.profit || 0,
        sellPrice: result.sellPrice || 0,
        cost: result.cost || 0,
      };

      // Update the display
      updateNativeBestMixDisplay(bestMix);

      // Reset the button after a successful computation
      nativeBfsButton.textContent = "Start Native BFS";
      if (progressDisplay) {
        progressDisplay.classList.remove("running");
      }
    })
    .catch((error) => {
      // Handle errors
      console.error("Native BFS error:", error);
      updateNativeProgressDisplay(-1, `Error: ${error.message}`);

      // Reset the button after an error
      nativeBfsButton.textContent = "Start Native BFS";
      if (progressDisplay) {
        progressDisplay.classList.remove("running");
      }
    });
}
