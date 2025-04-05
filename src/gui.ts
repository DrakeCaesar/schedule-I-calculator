// --- UI State Variables ---

import { currentMix, currentProduct } from ".";
import { MAX_RECIPE_DEPTH } from "./bfs";
import { toggleBothBFS } from "./bfsCommon";
import {
  applySubstanceRules,
  calculateFinalCost,
  calculateFinalPrice,
  effects,
  substances,
} from "./substances";
import { toggleTsBFS } from "./tsBfsController";
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
  const className = effect.toLowerCase().replace(/\s+/g, "-");
  return `<span class="effect effect-${effect}">${effect}</span>`;
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

// Function to toggle native BFS processing via Node.js server
export function toggleNative() {
  const progressDisplay = document.getElementById("nativeProgressDisplay");
  const toggleButton = document.getElementById("nativeBfsButton");

  if (!progressDisplay || !toggleButton) {
    console.error("Required DOM elements not found");
    return;
  }

  if (progressDisplay.classList.contains("running")) {
    // If currently running, abort and reset
    progressDisplay.classList.remove("running");
    progressDisplay.innerHTML =
      '<div class="progress-indicator"></div><div class="progress-text">Ready</div>';
    toggleButton.textContent = "Run Native BFS";
    return;
  }

  // Start the BFS calculation
  progressDisplay.classList.add("running");
  toggleButton.textContent = "Cancel Native BFS";

  const startTime = Date.now();
  updateProgressDisplay(0, "Starting native calculation...");

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
      const executionTime = Date.now() - startTime;
      const formattedTime = (executionTime / 1000).toFixed(2);

      if (!data.success) {
        throw new Error(data.error || "Unknown server error");
      }

      // Display 100% progress
      updateProgressDisplay(100, `Calculation complete in ${formattedTime}s`);

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
      updateBestMixDisplay("native", bestMix);

      // Show the native best mix container if it's hidden
      const nativeBestMixEl = document.getElementById("nativeBestMix");
      if (nativeBestMixEl && nativeBestMixEl.style.display === "none") {
        nativeBestMixEl.style.display = "block";
      }

      // Reset the button after a small delay
      setTimeout(() => {
        if (progressDisplay && toggleButton) {
          progressDisplay.classList.remove("running");
          toggleButton.textContent = "Run Native BFS";
        }
      }, 3000);
    })
    .catch((error) => {
      // Handle errors
      console.error("Native BFS error:", error);
      updateProgressDisplay(-1, `Error: ${error.message}`);

      // Reset the button after a small delay
      setTimeout(() => {
        if (progressDisplay && toggleButton) {
          progressDisplay.classList.remove("running");
          toggleButton.textContent = "Run Native BFS";
        }
      }, 3000);
    });
}

// Helper function to update the progress display for native BFS
function updateProgressDisplay(progress: number, message: string) {
  const progressDisplay = document.getElementById("nativeProgressDisplay");
  if (!progressDisplay) return;

  const progressIndicator = progressDisplay.querySelector(
    ".progress-indicator"
  ) as HTMLElement;
  const progressText = progressDisplay.querySelector(
    ".progress-text"
  ) as HTMLElement;

  if (progressIndicator && progressText) {
    // Handle error state
    if (progress < 0) {
      progressIndicator.style.width = "100%";
      progressIndicator.style.backgroundColor = "#f44336"; // Red for error
      progressText.textContent = message;
      return;
    }

    // Normal progress update
    progressIndicator.style.width = `${progress}%`;
    progressText.textContent = message;

    // Change color when complete
    if (progress >= 100) {
      progressIndicator.style.backgroundColor = "#4CAF50"; // Green for success
    } else {
      progressIndicator.style.backgroundColor = ""; // Default color
    }
  }
}

// Helper function to update a best mix display
function updateBestMixDisplay(
  source: string,
  bestMix: { mix: string[]; profit: number; sellPrice: number; cost: number }
) {
  const displayId =
    source === "native"
      ? "nativeBestMix"
      : source === "ts"
      ? "tsBestMix"
      : source === "wasm"
      ? "wasmBestMix"
      : "bestMix";

  const display = document.getElementById(displayId);
  if (!display) return;

  let html = "<h3>Best Mix:</h3>";
  html += `<p>Profit: $${bestMix.profit.toFixed(2)}</p>`;
  html += `<p>Sell Price: $${bestMix.sellPrice.toFixed(2)}</p>`;
  html += `<p>Cost: $${bestMix.cost.toFixed(2)}</p>`;

  if (bestMix.mix && bestMix.mix.length) {
    html += "<ol>";
    bestMix.mix.forEach((substance) => {
      html += `<li>${substance}</li>`;
    });
    html += "</ol>";
  } else {
    html += "<p>No substances in mix</p>";
  }

  display.innerHTML = html;
}
