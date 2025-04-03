import { createProgressDisplay } from "./bfs";
import {
  loadFromLocalStorage,
  onDragStart,
  onMixDragOver,
  onMixDrop,
  onTrashDragOver,
  onTrashDrop,
  toggleBFS,
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

  // Set up product selection
  const productRadios = document.getElementsByName("product");
  productRadios.forEach((radio) => {
    radio.addEventListener("change", (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target.checked) {
        const prodName = target.value;
        const initialEffect = target.dataset.initial || ""; // Handle products without initial effects
        currentProduct = { name: prodName, initialEffect };
        updateProductDisplay();
      }
    });
  });

  // Add BFS button and best mix display if not already present
  let bfsButton = document.getElementById("bfsButton");
  if (!bfsButton) {
    bfsButton = document.createElement("button");
    bfsButton.id = "bfsButton";
    bfsButton.textContent = "Start BFS";
    document.body.appendChild(bfsButton);

    bfsButton.addEventListener("click", () => {
      toggleBFS();
    });
  }

  let bestMixDisplay = document.getElementById("bestMixDisplay");
  if (!bestMixDisplay) {
    bestMixDisplay = document.createElement("div");
    bestMixDisplay.id = "bestMixDisplay";
    document.body.appendChild(bestMixDisplay);
  }

  // Create progress display container
  createProgressDisplay();

  // Initialize display with default product.
  loadFromLocalStorage();
  updateProductDisplay();
}

document.addEventListener("DOMContentLoaded", initializeApp);

// Add HMR handling
if ((import.meta as any).hot) {
  (import.meta as any).hot.accept(["./gui", "./substances", "./bfs"], () => {
    initializeApp();
  });
}
