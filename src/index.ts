import {
  onDragStart,
  onMixDragOver,
  onMixDrop,
  onTrashDragOver,
  onTrashDrop,
  updateProductDisplay,
} from "./gui";
import {
  applySubstanceRules,
  calculateFinalPrice,
  substances,
} from "./substances";

// ----- Example Usage -----
// Start with an initial effect "Energizing"
let currentEffects = ["Energizing"];
console.log("Initial Effects:", currentEffects);

// Suppose we add "Mega Bean" to our mix
const megaBean = substances.find((sub) => sub.name === "Motor Oil");
if (megaBean) {
  currentEffects = applySubstanceRules(currentEffects, megaBean);
  console.log("Effects after applying Motor Oil:", currentEffects);
}

const cuke = substances.find((sub) => sub.name === "Cuke");
if (cuke) {
  currentEffects = applySubstanceRules(currentEffects, cuke);
  console.log("Effects after applying Cuke:", currentEffects);
}

if (cuke) {
  currentEffects = applySubstanceRules(currentEffects, cuke);
  console.log("Effects after applying Cuke:", currentEffects);
}

//donut
const donut = substances.find((sub) => sub.name === "Donut");
if (donut) {
  currentEffects = applySubstanceRules(currentEffects, donut);
  console.log("Effects after applying Donut:", currentEffects);
}
//banana
const banana = substances.find((sub) => sub.name === "Banana");
if (banana) {
  currentEffects = applySubstanceRules(currentEffects, banana);
  console.log("Effects after applying Banana:", currentEffects);
}

// Calculate final price for a product (e.g., Weed) using the resulting effects
const finalPrice = calculateFinalPrice("Weed", currentEffects);
console.log("Final Price for Weed:", finalPrice);

// --- Initialization ---

// The starting product (name and its initial effect) – chosen from the radio buttons.
export let currentProduct = { name: "OG Kush", initialEffect: "Calming" };
// The additives (by substance name) added to the mix, in order.
export let currentMix: string[] = [];

document.addEventListener("DOMContentLoaded", () => {
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

  // Initialize display with default product.
  updateProductDisplay();
});
