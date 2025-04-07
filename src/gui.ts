// --- UI State Variables ---

import { currentMix, currentProduct } from ".";
import { toggleBothBFS } from "./bfsCommon";
import { createEffectSpan } from "./bfsMixDisplay";
import { toggleNativeBFS, toggleNativeDFS } from "./nativeBfsController";
import {
  applySubstanceRules,
  calculateFinalCost,
  calculateFinalPrice,
  substances,
} from "./substances";
import { toggleTsBFS } from "./tsBfsController";
import { toggleWasmBFS } from "./wasmBfsController";
import { toggleWasmDFS } from "./wasmDfsController";

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

// BFS button handlers
export function toggleBFS() {
  toggleBothBFS(currentProduct);
}

export function toggleTS() {
  toggleTsBFS(currentProduct);
}

export function toggleWASM() {
  toggleWasmBFS(currentProduct);
}

export function toggleWasmDFSHandler() {
  toggleWasmDFS(currentProduct);
}

export function toggleNative() {
  // For backward compatibility, use DFS since that's the default
  toggleNativeDFS(currentProduct);
}

// New separated algorithm handlers
export function toggleNativeBFSHandler() {
  toggleNativeBFS(currentProduct);
}

export function toggleNativeDFSHandler() {
  toggleNativeDFS(currentProduct);
}
