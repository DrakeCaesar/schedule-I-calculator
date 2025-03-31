// --- UI State Variables ---

import { currentMix, currentProduct } from ".";
import {
  applySubstanceRules,
  calculateFinalPrice,
  substances,
} from "./substances";

// --- UI Update Functions ---

// Update the product display area
export function updateProductDisplay() {
  const productDisplay = document.getElementById("productDisplay");
  if (productDisplay) {
    productDisplay.textContent = `Product: Weed - ${currentProduct.name} (Initial Effect: ${currentProduct.initialEffect})`;
  }
  // Reset mix additives when a new product is chosen.
  currentMix.splice(0, currentMix.length);
  updateMixListUI();
  updateResult();
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
  const finalPrice = calculateFinalPrice("Weed", effectsList);
  const finalEffectsEl = document.getElementById("finalEffects");
  const finalPriceEl = document.getElementById("finalPrice");
  if (finalEffectsEl) {
    finalEffectsEl.textContent = "Effects: " + effectsList.join(", ");
  }
  if (finalPriceEl) {
    finalPriceEl.textContent = "Price: $" + finalPrice.toFixed(2);
  }
}

// --- Drag & Drop Handlers ---

// Called when a draggable item starts (from sidebar or mix list)
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

// Handle drop event for the mix zone (to add or reorder additives)
export function onMixDrop(e: DragEvent) {
  e.preventDefault();
  if (!e.dataTransfer) return;
  const data = e.dataTransfer.getData("text/plain");
  const dropData = JSON.parse(data);
  const mixListEl = document.getElementById("mixList");
  let insertIndex = currentMix.length; // default insertion at the end

  // Determine insertion index by comparing mouse Y with each list item.
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
    // Dragging from the additives list: insert a copy at the calculated index.
    currentMix.splice(insertIndex, 0, dropData.name);
  } else if (dropData.source === "mix") {
    // Reordering within the mix.
    const oldIndex = parseInt(dropData.index, 10);
    // Adjust index if item is moved downward.
    if (oldIndex < insertIndex) {
      insertIndex = insertIndex - 1;
    }
    const [moved] = currentMix.splice(oldIndex, 1);
    currentMix.splice(insertIndex, 0, moved);
  }
  updateMixListUI();
  updateResult();
}

// Allow drop on mix zone by preventing default.
export function onMixDragOver(e: DragEvent) {
  e.preventDefault();
}

// Handle drop on the trash area (to remove an additive)
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
  }
}

// Allow drop on trash area.
export function onTrashDragOver(e: DragEvent) {
  e.preventDefault();
}
