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
import { substances } from "./substances";

// --- Initialization ---

// The starting product (name and its initial effect) – chosen from the radio buttons.
export let currentProduct = { name: "OG Kush", initialEffect: "Calming" };
// The additives (by substance name) added to the mix, in order.
export let currentMix: string[] = [];

function initializeApp() {
  // Populate the additives list in the sidebar using our substances array.
  const additivesList = document.getElementById("additivesList");
  if (additivesList) {
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
        const initialEffect = target.dataset.initial || "";
        currentProduct = { name: prodName, initialEffect: initialEffect };
        updateProductDisplay();
      }
    });
  });

  // Add BFS button and best mix display
  const bfsButton = document.createElement("button");
  bfsButton.id = "bfsButton";
  bfsButton.textContent = "Start BFS";
  document.body.appendChild(bfsButton);

  const bestMixDisplay = document.createElement("div");
  bestMixDisplay.id = "bestMixDisplay";
  document.body.appendChild(bestMixDisplay);

  bfsButton.addEventListener("click", () => {
    toggleBFS();
  });

  // Initialize display with default product.
  loadFromLocalStorage();
  updateProductDisplay();
}

document.addEventListener("DOMContentLoaded", initializeApp);

// Add HMR handling
if ((import.meta as any).hot) {
  (import.meta as any).hot.accept(["./gui", "./substances"], () => {
    initializeApp();
  });
}
