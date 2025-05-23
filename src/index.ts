import { createProgressDisplays, setMaxRecipeDepth } from "./bfsCommon";
import {
  loadFromLocalStorage,
  onDragStart,
  onMixDragOver,
  onMixDrop,
  onTrashDragOver,
  onTrashDrop,
  toggleBFS,
  toggleNativeBFSHandler,
  toggleNativeDFSHandler,
  toggleTS,
  toggleWASM,
  toggleWasmDFSHandler,
  updateProductDisplay,
} from "./gui";
import "./style.scss";
import { products, ProductVariety, substances } from "./substances";

// --- Initialization ---

// The starting product (name and its initial effect) – chosen from the radio buttons.
export let currentProduct: ProductVariety = {
  name: "OG Kush",
  initialEffect: "Calming",
};
// The additives (by substance name) added to the mix, in order.
export let currentMix: string[] = [];

function setupButton(buttonId: string, clickHandler: () => void) {
  const button = document.getElementById(buttonId);
  if (button) {
    const newButton = button.cloneNode(true);
    if (button.parentNode) {
      button.parentNode.replaceChild(newButton, button);
    }
    newButton.addEventListener("click", clickHandler);
  }
}

function initializeApp() {
  // Populate the additives list in the sidebar using our substances array.
  const additivesList = document.getElementById("additivesList");
  if (additivesList) {
    // Clear existing items to prevent duplication on hot reload
    additivesList.innerHTML = "";

    substances.forEach((substance) => {
      const div = document.createElement("div");
      div.textContent = substance.name;
      div.classList.add("draggable");
      div.setAttribute("draggable", "true");
      div.dataset.source = "sidebar";
      div.dataset.substance = substance.name;
      div.addEventListener("dragstart", onDragStart);
      additivesList.appendChild(div);
    });
  }

  // Dynamically generate product radio buttons
  const productSelection = document.getElementById("productSelection");
  if (productSelection) {
    productSelection.innerHTML = ""; // Clear existing buttons to prevent duplication
    Object.values(products).forEach((product) => {
      if (product.varieties) {
        product.varieties.forEach((variety, index) => {
          const label = document.createElement("label");
          label.innerHTML = `
            <input
              type="radio"
              name="product"
              value="${variety.name}"
              data-initial="${variety.initialEffect}"
              ${index === 0 && product.name === "Weed" ? "checked" : ""}
            />
            ${product.name} - ${variety.name} - ${variety.initialEffect}
          `;
          productSelection.appendChild(label);
        });
      } else {
        const label = document.createElement("label");
        label.innerHTML = `
          <input
            type="radio"
            name="product"
            value="${product.name}"
            data-initial=""
          />
          ${product.name}
        `;
        productSelection.appendChild(label);
      }
    });

    // Remove any existing event listener to prevent duplicates
    productSelection.removeEventListener(
      "change",
      handleProductSelectionChange
    );
    productSelection.addEventListener("change", handleProductSelectionChange);
  }

  // Set up the drop zone (mix list)
  const mixZone = document.getElementById("mixZone");
  if (mixZone) {
    mixZone.addEventListener("dragover", onMixDragOver);
    mixZone.addEventListener("drop", onMixDrop);
  }

  // Set up the trash area
  const trash = document.getElementById("trash");
  if (trash) {
    trash.addEventListener("dragover", onTrashDragOver);
    trash.addEventListener("drop", onTrashDrop);
  }

  // Set up BFS buttons
  setupButton("bothBfsButton", toggleBFS);
  setupButton("tsBfsButton", toggleTS);
  setupButton("wasmBfsButton", toggleWASM);
  setupButton("nativeBfsButton", toggleNativeBFSHandler);
  setupButton("nativeDfsButton", toggleNativeDFSHandler);
  setupButton("wasmDfsButton", toggleWasmDFSHandler);

  // Set up max depth slider
  const maxDepthSlider = document.getElementById(
    "maxDepthSlider"
  ) as HTMLInputElement;
  const maxDepthValue = document.getElementById("maxDepthValue");

  if (maxDepthSlider && maxDepthValue) {
    // Remove existing listeners to prevent duplicates during hot reload
    const newSlider = maxDepthSlider.cloneNode(true) as HTMLInputElement;
    if (maxDepthSlider.parentNode) {
      maxDepthSlider.parentNode.replaceChild(newSlider, maxDepthSlider);
    }

    // Add the event listener to the new element
    newSlider.addEventListener("input", () => {
      const depth = parseInt(newSlider.value, 10);
      maxDepthValue.textContent = newSlider.value;
      setMaxRecipeDepth(depth);
    });

    // Initialize with current value from DOM
    maxDepthValue.textContent = newSlider.value;
    setMaxRecipeDepth(parseInt(newSlider.value, 10));
  }

  // Create progress display container in the BFS section
  createProgressDisplays();

  // Initialize display with default product.
  loadFromLocalStorage();
  updateProductDisplay();
}

// Separate the event handler for better control
function handleProductSelectionChange(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.name === "product" && target.checked) {
    console.log(
      `Radio changed: ${target.value} with effect ${
        target.dataset.initial || "none"
      }`
    );
    const prodName = target.value;
    const initialEffect = target.dataset.initial || ""; // Handle products without initial effects
    currentProduct = { name: prodName, initialEffect };
    updateProductDisplay();
  }
}

document.addEventListener("DOMContentLoaded", initializeApp);

// Add HMR handling
if ((import.meta as any).hot) {
  (import.meta as any).hot.accept(
    ["./gui", "./substances", "./bfsCommon"],
    () => {
      initializeApp();
    }
  );
}
