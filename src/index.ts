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
const megaBean = substances.find((sub) => sub.name === "Mega Bean");
if (megaBean) {
  currentEffects = applySubstanceRules(currentEffects, megaBean);
  console.log("Effects after applying Mega Bean:", currentEffects);
}

const cuke = substances.find((sub) => sub.name === "Cuke");
if (cuke) {
  currentEffects = applySubstanceRules(currentEffects, cuke);
  console.log("Effects after applying Cuke:", currentEffects);
}

// Calculate final price for a product (e.g., Weed) using the resulting effects
const finalPrice = calculateFinalPrice("Weed", currentEffects);
console.log("Final Price for Weed:", finalPrice);
