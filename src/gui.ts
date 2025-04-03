// --- UI State Variables ---

import { currentMix, currentProduct } from ".";
import {
  applySubstanceRules,
  calculateFinalCost,
  calculateFinalPrice,
  substances,
} from "./substances";
// Add these imports at the top

// Add these constants near the top
const STORAGE_KEY_MIX = "currentMix";
const STORAGE_KEY_PRODUCT = "currentProduct";

let bfsRunning = false;
let bfsPaused = false;
let bfsQueue: string[][] = [];
let bestMix: { mix: string[]; profit: number } = { mix: [], profit: -Infinity };
let bfsWorker: Worker | null = null;

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
  // currentMix.splice(0, currentMix.length);
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
  saveToLocalStorage();
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
    saveToLocalStorage();
  }
}

// Allow drop on trash area.
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
      // console.log("Loading saved mix:", savedMix);
      // console.log("Current mix before loading:", currentMix);
      // currentMix.splice(0, currentMix.length, ...JSON.parse(savedMix));
      // console.log("Current mix after loading:", currentMix);
    }

    if (savedProduct) {
      Object.assign(currentProduct, JSON.parse(savedProduct));
    }
  } catch (error) {
    console.error("Error loading saved state:", error);
  }
}

export async function toggleBFS() {
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
    bfsQueue = [[]]; // Start with an empty mix

    if (!bfsWorker) {
      bfsWorker = new Worker(new URL("./bfsWorker.ts", import.meta.url), {
        type: "module",
      });
      bfsWorker.onmessage = (event: MessageEvent) => {
        const { type, bestMix: updatedBestMix } = event.data;
        if (type === "update") {
          bestMix = updatedBestMix;
          updateBestMixDisplay();
        } else if (type === "done") {
          bfsRunning = false;
          bfsButton.textContent = "Start BFS";
        }
      };
    }

    bfsWorker.postMessage({
      type: "start",
      data: {
        product: currentProduct,
        queue: bfsQueue,
        bestMix,
      },
    });
  }
}

async function runBFS() {
  let currentLength = 1; // Start with mixes of length 1
  while (bfsQueue.length > 0 && !bfsPaused) {
    const currentMix = bfsQueue.shift()!;

    // Check if we need to move to the next length
    if (currentMix.length > currentLength) {
      currentLength++;
      if (currentLength > 8) break; // Stop if mix length exceeds 8
    }

    const effectsList = calculateEffects(currentMix);
    const sellPrice = calculateFinalPrice("Weed", effectsList);
    const cost = calculateFinalCost(currentMix);
    const profit = sellPrice - cost;

    // console.log(
    //   `Mix: ${currentMix.join(", ")}, Sell Price: $${sellPrice.toFixed(
    //     2
    //   )}, Cost: $${cost.toFixed(2)}, Profit: $${profit.toFixed(2)},
    //   Best Mix: ${bestMix.mix.join(
    //     ", "
    //   )}, Best Profit: $${bestMix.profit.toFixed(2)}`
    // );

    if (profit > bestMix.profit) {
      bestMix = { mix: currentMix, profit };
      updateBestMixDisplay();
    }

    // Generate mixes of the next length
    if (currentMix.length < 8) {
      for (const substance of substances) {
        bfsQueue.push([...currentMix, substance.name]);
      }
    }

    await sleep(1); // Sleep to avoid blocking
  }
}

function calculateEffects(mix: string[]): string[] {
  let effectsList = [currentProduct.initialEffect];
  mix.forEach((substanceName, index) => {
    const substance = substances.find((s) => s.name === substanceName);
    if (substance) {
      effectsList = applySubstanceRules(effectsList, substance, index + 1);
    }
  });
  return effectsList;
}

function updateBestMixDisplay() {
  const bestMixDisplay = document.getElementById("bestMixDisplay");
  if (!bestMixDisplay) return;

  const effectsList = calculateEffects(bestMix.mix);
  const sellPrice = calculateFinalPrice(currentProduct.name, effectsList);
  const cost = calculateFinalCost(bestMix.mix);
  const profit = sellPrice - cost;

  const effectsHTML = effectsList
    .map((effect) => createEffectSpan(effect))
    .join(" ");
  bestMixDisplay.innerHTML = `
    <h3>Best Mix</h3>
    <p>Mix: ${bestMix.mix.join(", ")}</p>
    <p>Effects: ${effectsHTML}</p>
    <p>Sell Price: $${sellPrice.toFixed(2)}</p>
    <p>Cost: $${cost.toFixed(2)}</p>
    <p>Profit: $${profit.toFixed(2)}</p>
  `;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
