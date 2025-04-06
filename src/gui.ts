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

// WebSocket connection for native BFS progress updates
let nativeWebSocket: WebSocket | null = null;
let isNativeBfsRunning = false;
// Native BFS progress state
let nativeTotalProcessed = 0;
let nativeGrandTotal = 1; // Start with 1 to avoid division by zero
let nativeLastUpdate = 0;
const NATIVE_UPDATE_INTERVAL = 250; // ms

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

  updateNativeProgressDisplay(0, 0, 0, 0, "Ready");
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
// This matches the format used in the TypeScript and WASM implementations
function updateNativeProgressDisplay(
  processed: number,
  total: number,
  depth: number,
  executionTime: number,
  message: string
) {
  const progressDisplay = document.getElementById("nativeProgressDisplay");
  if (!progressDisplay) return;

  // Calculate current time
  const now = Date.now();

  // Only update every NATIVE_UPDATE_INTERVAL ms unless it's a special update
  if (
    message !== "Ready" &&
    message !== "Calculation complete" &&
    message !== "Error" &&
    now - nativeLastUpdate < NATIVE_UPDATE_INTERVAL
  ) {
    return;
  }

  nativeLastUpdate = now;

  // Store values for our global state
  nativeTotalProcessed = processed;
  if (total > 0) {
    nativeGrandTotal = total;
  }

  // Calculate progress percentage
  const percentage = Math.min(
    100,
    Math.round((processed / Math.max(1, total)) * 100)
  );

  // Calculate estimated remaining time based on progress
  let remainingTime = 0;
  if (percentage > 0 && percentage < 100) {
    remainingTime = Math.round(
      (executionTime / percentage) * (100 - percentage)
    );
  }

  // Calculate estimated finish time
  const estimatedFinishTime = now + remainingTime;

  // Update the DOM with progress information to match TypeScript BFS format
  progressDisplay.innerHTML = `
    <div class="overall-progress">
      <h4>Native BFS Progress</h4>
      <div>Total processed: ${processed.toLocaleString()} / ${total.toLocaleString()}</div>
      <div class="progress-bar-container">
        <div class="progress-bar" style="width: ${percentage}%"></div>
        <span class="progress-text" data-progress="${percentage}%" style="--progress-percent: ${percentage}%"></span>
      </div>
      <div>Status: ${message}</div>
      <div>Current depth: ${depth}</div>
      <div>Execution time: ${formatTime(executionTime)}</div>
      <div>Estimated time remaining: ${formatTime(remainingTime)}</div>
      <div>Estimated finish time: ${formatClockTime(estimatedFinishTime)}</div>
    </div>
  `;
}

// Add a variable to track native BFS start time
let nativeStartTime = 0;

// Initialize WebSocket connection for native BFS
function initializeNativeWebSocket() {
  if (nativeWebSocket) {
    // Close existing connection if there is one
    nativeWebSocket.close();
  }

  // Create new WebSocket connection
  nativeWebSocket = new WebSocket("ws://localhost:3000");

  nativeWebSocket.onopen = () => {
    console.log("Native BFS WebSocket connection established");
  };

  nativeWebSocket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === "progress") {
        // Handle progress update
        const executionTime =
          data.executionTime || Date.now() - nativeStartTime;

        updateNativeProgressDisplay(
          data.totalProcessed || data.processed || 0,
          data.grandTotal || data.total || 100,
          data.depth || 1,
          executionTime,
          data.message || `Processing depth ${data.depth || 1}`
        );
      } else if (data.type === "done") {
        // Handle completion
        isNativeBfsRunning = false;

        // Update progress to 100%
        updateNativeProgressDisplay(
          nativeGrandTotal,
          nativeGrandTotal,
          data.depth || 0,
          Date.now() - nativeStartTime,
          "Calculation complete"
        );

        // Update the result display
        if (data.result) {
          updateNativeBestMixDisplay({
            mix: data.result.mixArray || [],
            profit: data.result.profit || 0,
            sellPrice: data.result.sellPrice || 0,
            cost: data.result.cost || 0,
          });
        }

        // Update button state
        const nativeBfsButton = document.getElementById("nativeBfsButton");
        if (nativeBfsButton) {
          nativeBfsButton.textContent = "Start Native BFS";
        }
      } else if (data.type === "error") {
        // Handle error
        console.error("Native BFS error:", data.message);

        updateNativeProgressDisplay(
          nativeTotalProcessed,
          nativeGrandTotal,
          0,
          Date.now() - nativeStartTime,
          `Error: ${data.message}`
        );

        isNativeBfsRunning = false;

        // Update button state
        const nativeBfsButton = document.getElementById("nativeBfsButton");
        if (nativeBfsButton) {
          nativeBfsButton.textContent = "Start Native BFS";
        }
      }
    } catch (error) {
      console.error("Error processing WebSocket message:", error);
    }
  };

  nativeWebSocket.onerror = (error) => {
    console.error("WebSocket error:", error);
    isNativeBfsRunning = false;
  };

  nativeWebSocket.onclose = () => {
    console.log("Native BFS WebSocket connection closed");
    nativeWebSocket = null;
  };
}

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
  if (isNativeBfsRunning) {
    // If currently running, abort and reset
    isNativeBfsRunning = false;

    // Update progress display
    updateNativeProgressDisplay(
      nativeTotalProcessed,
      nativeGrandTotal,
      0,
      Date.now() - nativeStartTime,
      "Calculation canceled"
    );

    nativeBfsButton.textContent = "Start Native BFS";
    return;
  }

  // Create displays
  createNativeProgressDisplay();
  createNativeResultDisplay();

  // Set start time for execution time calculation
  nativeStartTime = Date.now();
  isNativeBfsRunning = true;
  nativeLastUpdate = 0;

  // Initialize WebSocket connection for progress updates
  initializeNativeWebSocket();

  // Start the BFS calculation
  nativeBfsButton.textContent = "Stop Native BFS";

  // Initial progress update
  updateNativeProgressDisplay(0, 100, 1, 0, "Starting native calculation...");

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
      if (!data.success) {
        throw new Error(data.error || "Unknown server error");
      }

      // The WebSocket will handle progress updates and final results
      // This is just a fallback in case WebSocket fails
      if (!nativeWebSocket || nativeWebSocket.readyState !== WebSocket.OPEN) {
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

        // Final progress update
        const executionTime = Date.now() - nativeStartTime;
        updateNativeProgressDisplay(
          100,
          100,
          0,
          executionTime,
          `Calculation complete in ${(executionTime / 1000).toFixed(2)}s`
        );

        // Reset the button after a successful computation
        nativeBfsButton.textContent = "Start Native BFS";
        isNativeBfsRunning = false;
      }
    })
    .catch((error) => {
      // Handle errors
      console.error("Native BFS error:", error);

      // Update progress with error
      updateNativeProgressDisplay(
        nativeTotalProcessed,
        nativeGrandTotal,
        0,
        Date.now() - nativeStartTime,
        `Error: ${error.message}`
      );

      // Reset the button after an error
      nativeBfsButton.textContent = "Start Native BFS";
      isNativeBfsRunning = false;
    });
}
