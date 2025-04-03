// Interfaces for our data structures
export interface ProductVariety {
  name: string;
  initialEffect: string;
}

// Update the Product interface to include varieties
export interface Product {
  name: string;
  basePrice: number;
  varieties?: ProductVariety[];
}

export interface Effect {
  name: string;
  multiplier: number;
}

// Products with their base prices
export const products: { [key: string]: Product } = {
  Weed: {
    name: "Weed",
    basePrice: 35,
    varieties: [
      { name: "OG Kush", initialEffect: "Calming" },
      { name: "Sour Diesel", initialEffect: "Refreshing" },
      { name: "Green Crack", initialEffect: "Energizing" },
      { name: "Granddaddy Purple", initialEffect: "Sedating" },
    ],
  },
  Meth: { name: "Meth", basePrice: 70 },
  Cocaine: { name: "Cocaine", basePrice: 150 },
};

// Effects and their multipliers
export const effects: { [key: string]: Effect } = {
  "Anti-Gravity": { name: "Anti-Gravity", multiplier: 0.54 },
  Athletic: { name: "Athletic", multiplier: 0.32 },
  Balding: { name: "Balding", multiplier: 0.3 },
  "Bright-Eyed": { name: "Bright-Eyed", multiplier: 0.4 },
  Calming: { name: "Calming", multiplier: 0.1 },
  "Calorie-Dense": { name: "Calorie-Dense", multiplier: 0.28 },
  Cyclopean: { name: "Cyclopean", multiplier: 0.56 },
  Disorienting: { name: "Disorienting", multiplier: 0.0 },
  Electrifying: { name: "Electrifying", multiplier: 0.5 },
  Energizing: { name: "Energizing", multiplier: 0.22 },
  Euphoric: { name: "Euphoric", multiplier: 0.18 },
  Explosive: { name: "Explosive", multiplier: 0.0 },
  Focused: { name: "Focused", multiplier: 0.16 },
  Foggy: { name: "Foggy", multiplier: 0.36 },
  Gingeritis: { name: "Gingeritis", multiplier: 0.2 },
  Glowing: { name: "Glowing", multiplier: 0.48 },
  Jennerising: { name: "Jennerising", multiplier: 0.42 },
  Laxative: { name: "Laxative", multiplier: 0.0 },
  "Long Faced": { name: "Long Faced", multiplier: 0.52 },
  Munchies: { name: "Munchies", multiplier: 0.12 },
  Paranoia: { name: "Paranoia", multiplier: 0.0 },
  Refreshing: { name: "Refreshing", multiplier: 0.14 },
  Schizophrenia: { name: "Schizophrenia", multiplier: 0.0 },
  Sedating: { name: "Sedating", multiplier: 0.26 },
  "Seizure-Inducing": { name: "Seizure-Inducing", multiplier: 0.0 },
  Shrinking: { name: "Shrinking", multiplier: 0.6 },
  Slippery: { name: "Slippery", multiplier: 0.34 },
  Smelly: { name: "Smelly", multiplier: 0.0 },
  Sneaky: { name: "Sneaky", multiplier: 0.24 },
  Spicy: { name: "Spicy", multiplier: 0.38 },
  "Thought-Provoking": { name: "Thought-Provoking", multiplier: 0.44 },
  Toxic: { name: "Toxic", multiplier: 0.0 },
  "Tropic Thunder": { name: "Tropic Thunder", multiplier: 0.46 },
  Zombifying: { name: "Zombifying", multiplier: 0.58 },
};

// Performance optimizations: Create Maps for O(1) lookups
export const effectsMap = new Map(
  Object.entries(effects).map(([name, effect]) => [name, effect.multiplier])
);

// Map for finding base product from variety name
const productVarietyMap = new Map<string, string>();
for (const [productName, product] of Object.entries(products)) {
  if (product.varieties) {
    for (const variety of product.varieties) {
      productVarietyMap.set(variety.name, productName);
    }
  }
}

// A rule can be of type 'replace' or 'add'
interface SubstanceRule {
  type: "replace" | "add";
  // Conditions: a list of effects that must be present
  condition: string[];
  // Optional: effects that must not be present for the rule to apply
  ifNotPresent?: string[];
  // For a 'replace' rule, the target is the effect to be replaced
  target: string;
  // For 'replace', withEffect is the new effect; for 'add', target is the effect to add
  withEffect?: string;
}

interface Substance {
  name: string;
  // Default effect to add after rules (or if not already present)
  cost: number;
  // The purchase cost of the substance
  defaultEffect: string;
  // Pricing adjustments (for display, etc.)
  pricing: { [key: string]: number };
  // Array of rules that change the effect(s)
  rules: SubstanceRule[];
}

// Substances with their default effect, pricing, and rules
export const substances: Substance[] = [
  {
    name: "Cuke",
    cost: 2,
    defaultEffect: "Energizing",
    pricing: { Weed: 43, Meth: 85, Cocaine: 183 },
    rules: [
      {
        type: "replace",
        condition: ["Toxic"],
        target: "Toxic",
        withEffect: "Euphoric",
      },
      {
        type: "replace",
        condition: ["Slippery"],
        target: "Slippery",
        withEffect: "Munchies",
      },
      {
        type: "replace",
        condition: ["Sneaky"],
        target: "Sneaky",
        withEffect: "Paranoia",
      },
      {
        type: "replace",
        condition: ["Foggy"],
        target: "Foggy",
        withEffect: "Cyclopean",
      },
      {
        type: "replace",
        condition: ["Gingeritis"],
        target: "Gingeritis",
        withEffect: "Thought-Provoking",
      },
      {
        type: "replace",
        condition: ["Munchies"],
        target: "Munchies",
        withEffect: "Athletic",
      },
      {
        type: "replace",
        condition: ["Euphoric"],
        target: "Euphoric",
        withEffect: "Laxative",
      },
    ],
  },
  {
    name: "Flu Medicine",
    cost: 5,
    defaultEffect: "Sedating",
    pricing: { Weed: 44, Meth: 88, Cocaine: 189 },
    rules: [
      {
        type: "replace",
        condition: ["Calming"],
        target: "Calming",
        withEffect: "Bright-Eyed",
      },
      {
        type: "replace",
        condition: ["Athletic"],
        target: "Athletic",
        withEffect: "Munchies",
      },
      {
        type: "replace",
        condition: ["Thought-Provoking"],
        target: "Thought-Provoking",
        withEffect: "Gingeritis",
      },
      {
        type: "replace",
        condition: ["Cyclopean"],
        target: "Cyclopean",
        withEffect: "Foggy",
      },
      {
        type: "replace",
        condition: ["Munchies"],
        target: "Munchies",
        withEffect: "Slippery",
      },
      {
        type: "replace",
        condition: ["Laxative"],
        target: "Laxative",
        withEffect: "Euphoric",
      },
      {
        type: "replace",
        condition: ["Euphoric"],
        target: "Euphoric",
        withEffect: "Toxic",
      },
      {
        type: "replace",
        condition: ["Focused"],
        target: "Focused",
        withEffect: "Calming",
      },
      {
        type: "replace",
        condition: ["Electrifying"],
        target: "Electrifying",
        withEffect: "Refreshing",
      },
      {
        type: "replace",
        condition: ["Shrinking"],
        target: "Shrinking",
        withEffect: "Paranoia",
      },
    ],
  },
  {
    name: "Gasoline",
    cost: 5,
    defaultEffect: "Toxic",
    pricing: { Weed: 35, Meth: 70, Cocaine: 150 },
    rules: [
      {
        type: "replace",
        condition: ["Gingeritis"],
        target: "Gingeritis",
        withEffect: "Smelly",
      },
      {
        type: "replace",
        condition: ["Jennerising"],
        target: "Jennerising",
        withEffect: "Sneaky",
      },
      {
        type: "replace",
        condition: ["Sneaky"],
        target: "Sneaky",
        withEffect: "Tropic Thunder",
      },
      {
        type: "replace",
        condition: ["Munchies"],
        target: "Munchies",
        withEffect: "Sedating",
      },
      {
        type: "replace",
        condition: ["Energizing"],
        target: "Energizing",
        withEffect: "Euphoric",
      },
      {
        type: "replace",
        condition: ["Euphoric"],
        target: "Euphoric",
        withEffect: "Energizing",
      },
      {
        type: "replace",
        condition: ["Laxative"],
        target: "Laxative",
        withEffect: "Foggy",
      },
      {
        type: "replace",
        condition: ["Disorienting"],
        target: "Disorienting",
        withEffect: "Glowing",
      },
      {
        type: "replace",
        condition: ["Paranoia"],
        target: "Paranoia",
        withEffect: "Calming",
      },
      {
        type: "replace",
        condition: ["Electrifying"],
        target: "Electrifying",
        withEffect: "Disorienting",
      },
      {
        type: "replace",
        condition: ["Shrinking"],
        target: "Shrinking",
        withEffect: "Focused",
      },
    ],
  },
  {
    name: "Donut",
    cost: 3,
    defaultEffect: "Calorie-Dense",
    pricing: { Weed: 45, Meth: 90, Cocaine: 192 },
    rules: [
      {
        type: "replace",
        condition: ["Calorie-Dense"],
        target: "Calorie-Dense",
        withEffect: "Explosive",
      },
      {
        type: "replace",
        condition: ["Balding"],
        target: "Balding",
        withEffect: "Sneaky",
      },
      {
        type: "replace",
        condition: ["Anti-Gravity"],
        target: "Anti-Gravity",
        withEffect: "Slippery",
      },
      {
        type: "replace",
        condition: ["Jennerising"],
        target: "Jennerising",
        withEffect: "Gingeritis",
      },
      {
        type: "replace",
        condition: ["Focused"],
        target: "Focused",
        withEffect: "Euphoric",
      },
      {
        type: "replace",
        condition: ["Shrinking"],
        target: "Shrinking",
        withEffect: "Energizing",
      },
    ],
  },
  {
    name: "Energy Drink",
    cost: 6,
    defaultEffect: "Athletic",
    pricing: { Weed: 46, Meth: 92, Cocaine: 198 },
    rules: [
      {
        type: "replace",
        condition: ["Sedating"],
        target: "Sedating",
        withEffect: "Munchies",
      },
      {
        type: "replace",
        condition: ["Euphoric"],
        target: "Euphoric",
        withEffect: "Energizing",
      },
      {
        type: "replace",
        condition: ["Spicy"],
        target: "Spicy",
        withEffect: "Euphoric",
      },
      {
        type: "replace",
        condition: ["Tropic Thunder"],
        target: "Tropic Thunder",
        withEffect: "Sneaky",
      },
      {
        type: "replace",
        condition: ["Glowing"],
        target: "Glowing",
        withEffect: "Disorienting",
      },
      {
        type: "replace",
        condition: ["Foggy"],
        target: "Foggy",
        withEffect: "Laxative",
      },
      {
        type: "replace",
        condition: ["Glowing"],
        target: "Glowing",
        withEffect: "Disorienting",
      },
      {
        type: "replace",
        condition: ["Disorienting"],
        target: "Disorienting",
        withEffect: "Electrifying",
      },
      {
        type: "replace",
        condition: ["Schizophrenia"],
        target: "Schizophrenia",
        withEffect: "Balding",
      },
      {
        type: "replace",
        condition: ["Focused"],
        target: "Focused",
        withEffect: "Shrinking",
      },
    ],
  },
  {
    name: "Mouth Wash",
    cost: 4,
    defaultEffect: "Balding",
    pricing: { Weed: 46, Meth: 91, Cocaine: 195 },
    rules: [
      {
        type: "replace",
        condition: ["Calming"],
        target: "Calming",
        withEffect: "Anti-Gravity",
      },
      {
        type: "replace",
        condition: ["Calorie-Dense"],
        target: "Calorie-Dense",
        withEffect: "Sneaky",
      },
      {
        type: "replace",
        condition: ["Explosive"],
        target: "Explosive",
        withEffect: "Sedating",
      },
      {
        type: "replace",
        condition: ["Focused"],
        target: "Focused",
        withEffect: "Jennerising",
      },
    ],
  },
  {
    name: "Motor Oil",
    cost: 6,
    defaultEffect: "Slippery",
    pricing: { Weed: 47, Meth: 94, Cocaine: 201 },
    rules: [
      {
        type: "replace",
        condition: ["Energizing"],
        target: "Energizing",
        withEffect: "Munchies",
      },
      {
        type: "replace",
        condition: ["Foggy"],
        target: "Foggy",
        withEffect: "Toxic",
      },
      {
        type: "replace",
        condition: ["Euphoric"],
        target: "Euphoric",
        withEffect: "Sedating",
      },
      {
        type: "replace",
        condition: ["Paranoia"],
        target: "Paranoia",
        withEffect: "Anti-Gravity",
      },
      {
        type: "replace",
        condition: ["Munchies"],
        target: "Munchies",
        withEffect: "Schizophrenia",
      },
    ],
  },
  {
    name: "Banana",
    cost: 2,
    defaultEffect: "Gingeritis",
    pricing: { Weed: 42, Meth: 84, Cocaine: 180 },
    rules: [
      {
        type: "replace",
        condition: ["Energizing"],
        target: "Energizing",
        withEffect: "Thought-Provoking",
      },
      {
        type: "replace",
        condition: ["Calming"],
        target: "Calming",
        withEffect: "Sneaky",
      },
      {
        type: "replace",
        condition: ["Toxic"],
        target: "Toxic",
        withEffect: "Smelly",
      },
      {
        type: "replace",
        condition: ["Long Faced"],
        target: "Long Faced",
        withEffect: "Refreshing",
      },
      {
        type: "replace",
        condition: ["Cyclopean"],
        target: "Cyclopean",
        withEffect: "Thought-Provoking",
      },
      {
        type: "replace",
        condition: ["Disorienting"],
        target: "Disorienting",
        withEffect: "Focused",
      },
      {
        type: "replace",
        condition: ["Focused"],
        target: "Focused",
        withEffect: "Seizure-Inducing",
      },
      {
        type: "replace",
        condition: ["Paranoia"],
        target: "Paranoia",
        withEffect: "Jennerising",
      },
      {
        type: "replace",
        condition: ["Smelly"],
        target: "Smelly",
        withEffect: "Anti-Gravity",
      },
    ],
  },
  {
    name: "Chili",
    cost: 7,
    defaultEffect: "Spicy",
    pricing: { Weed: 48, Meth: 97, Cocaine: 207 },
    rules: [
      {
        type: "replace",
        condition: ["Athletic"],
        target: "Athletic",
        withEffect: "Euphoric",
      },
      {
        type: "replace",
        condition: ["Anti-Gravity"],
        target: "Anti-Gravity",
        withEffect: "Tropic Thunder",
      },
      {
        type: "replace",
        condition: ["Sneaky"],
        target: "Sneaky",
        withEffect: "Bright-Eyed",
      },
      {
        type: "replace",
        condition: ["Munchies"],
        target: "Munchies",
        withEffect: "Toxic",
      },
      {
        type: "replace",
        condition: ["Laxative"],
        target: "Laxative",
        withEffect: "Long Faced",
      },
      {
        type: "replace",
        condition: ["Shrinking"],
        target: "Shrinking",
        withEffect: "Refreshing",
      },
    ],
  },
  {
    name: "Iodine",
    cost: 8,
    defaultEffect: "Jennerising",
    pricing: { Weed: 50, Meth: 99, Cocaine: 213 },
    rules: [
      {
        type: "replace",
        condition: ["Calming"],
        target: "Calming",
        withEffect: "Balding",
      },
      {
        type: "replace",
        condition: ["Toxic"],
        target: "Toxic",
        withEffect: "Sneaky",
      },
      {
        type: "replace",
        condition: ["Foggy"],
        target: "Foggy",
        withEffect: "Paranoia",
      },
      {
        type: "replace",
        condition: ["Calorie-Dense"],
        target: "Calorie-Dense",
        withEffect: "Gingeritis",
      },
      {
        type: "replace",
        condition: ["Euphoric"],
        target: "Euphoric",
        withEffect: "Seizure-Inducing",
      },
      {
        type: "replace",
        condition: ["Refreshing"],
        target: "Refreshing",
        withEffect: "Thought-Provoking",
      },
    ],
  },
  {
    name: "Paracetamol",
    cost: 3,
    defaultEffect: "Sneaky",
    pricing: { Weed: 43, Meth: 87, Cocaine: 186 },
    rules: [
      {
        type: "replace",
        condition: ["Energizing"],
        target: "Energizing",
        withEffect: "Paranoia",
      },
      {
        type: "replace",
        condition: ["Calming"],
        target: "Calming",
        withEffect: "Slippery",
      },
      {
        type: "replace",
        condition: ["Toxic"],
        target: "Toxic",
        withEffect: "Tropic Thunder",
      },
      {
        type: "replace",
        condition: ["Spicy"],
        target: "Spicy",
        withEffect: "Bright-Eyed",
      },
      {
        type: "replace",
        condition: ["Glowing"],
        target: "Glowing",
        withEffect: "Toxic",
      },
      {
        type: "replace",
        condition: ["Foggy"],
        target: "Foggy",
        withEffect: "Calming",
      },
      {
        type: "replace",
        condition: ["Munchies"],
        target: "Munchies",
        withEffect: "Anti-Gravity",
      },
      {
        type: "replace",
        condition: ["Paranoia"],
        target: "Paranoia",
        withEffect: "Balding",
      },
      {
        type: "replace",
        condition: ["Electrifying"],
        target: "Electrifying",
        withEffect: "Athletic",
      },
      {
        type: "replace",
        condition: ["Paranoia"],
        target: "Paranoia",
        withEffect: "Balding",
      },
      {
        type: "replace",
        condition: ["Focused"],
        target: "Focused",
        withEffect: "Gingeritis",
      },
    ],
  },
  {
    name: "Viagra",
    cost: 4,
    defaultEffect: "Tropic Thunder",
    pricing: { Weed: 51, Meth: 102, Cocaine: 219 },
    rules: [
      {
        type: "replace",
        condition: ["Athletic"],
        target: "Athletic",
        withEffect: "Sneaky",
      },
      {
        type: "replace",
        condition: ["Euphoric"],
        target: "Euphoric",
        withEffect: "Bright-Eyed",
      },
      {
        type: "replace",
        condition: ["Laxative"],
        target: "Laxative",
        withEffect: "Calming",
      },
      {
        type: "replace",
        condition: ["Disorienting"],
        target: "Disorienting",
        withEffect: "Toxic",
      },
    ],
  },
  {
    name: "Horse Semen",
    cost: 9,
    defaultEffect: "Long Faced",
    pricing: { Weed: 53, Meth: 106, Cocaine: 228 },
    rules: [
      {
        type: "replace",
        condition: ["Anti-Gravity"],
        target: "Anti-Gravity",
        withEffect: "Calming",
      },
      {
        type: "replace",
        condition: ["Gingeritis"],
        target: "Gingeritis",
        withEffect: "Refreshing",
      },
      {
        type: "replace",
        condition: ["Thought-Provoking"],
        target: "Thought-Provoking",
        withEffect: "Electrifying",
      },
    ],
  },
  {
    name: "Mega Bean",
    cost: 7,
    defaultEffect: "Foggy",
    pricing: { Weed: 48, Meth: 95, Cocaine: 204 },
    rules: [
      {
        type: "replace",
        condition: ["Energizing"],
        target: "Energizing",
        withEffect: "Cyclopean",
      },
      {
        type: "replace",
        condition: ["Calming"],
        target: "Calming",
        withEffect: "Glowing",
      },
      {
        type: "replace",
        condition: ["Sneaky"],
        target: "Sneaky",
        withEffect: "Calming",
      },
      {
        type: "replace",
        condition: ["Jennerising"],
        target: "Jennerising",
        withEffect: "Paranoia",
      },
      {
        type: "replace",
        condition: ["Athletic"],
        target: "Athletic",
        withEffect: "Laxative",
      },
      {
        type: "replace",
        condition: ["Slippery"],
        target: "Slippery",
        withEffect: "Toxic",
      },
      {
        type: "replace",
        condition: ["Thought-Provoking"],
        target: "Thought-Provoking",
        withEffect: "Energizing",
      },
      {
        type: "replace",
        condition: ["Seizure-Inducing"],
        target: "Seizure-Inducing",
        withEffect: "Focused",
      },
      {
        type: "replace",
        condition: ["Focused"],
        target: "Focused",
        withEffect: "Disorienting",
      },
      {
        type: "replace",
        condition: ["Sneaky"],
        target: "Sneaky",
        withEffect: "Glowing",
      },
      {
        type: "replace",
        condition: ["Thought-Provoking"],
        target: "Thought-Provoking",
        withEffect: "Cyclopean",
      },
      {
        type: "replace",
        condition: ["Shrinking"],
        target: "Shrinking",
        withEffect: "Electrifying",
      },
    ],
  },
  {
    name: "Addy",
    cost: 9,
    defaultEffect: "Thought-Provoking",
    pricing: { Weed: 50, Meth: 101, Cocaine: 216 },
    rules: [
      {
        type: "replace",
        condition: ["Sedating"],
        target: "Sedating",
        withEffect: "Gingeritis",
      },
      {
        type: "replace",
        condition: ["Long Faced"],
        target: "Long Faced",
        withEffect: "Electrifying",
      },
      {
        type: "replace",
        condition: ["Glowing"],
        target: "Glowing",
        withEffect: "Refreshing",
      },
      {
        type: "replace",
        condition: ["Foggy"],
        target: "Foggy",
        withEffect: "Energizing",
      },
      {
        type: "replace",
        condition: ["Explosive"],
        target: "Explosive",
        withEffect: "Euphoric",
      },
    ],
  },
  {
    name: "Battery",
    cost: 8,
    defaultEffect: "Bright-Eyed",
    pricing: { Weed: 49, Meth: 98, Cocaine: 210 },
    rules: [
      {
        type: "replace",
        condition: ["Munchies"],
        target: "Munchies",
        withEffect: "Tropic Thunder",
      },
      {
        type: "replace",
        condition: ["Euphoric"],
        target: "Euphoric",
        withEffect: "Zombifying",
      },
      {
        type: "replace",
        condition: ["Electrifying"],
        target: "Electrifying",
        withEffect: "Euphoric",
      },
      {
        type: "replace",
        condition: ["Laxative"],
        target: "Laxative",
        withEffect: "Calorie-Dense",
      },
      {
        type: "replace",
        condition: ["Electrifying"],
        target: "Electrifying",
        withEffect: "Euphoric",
      },
      {
        type: "replace",
        condition: ["Cyclopean"],
        target: "Cyclopean",
        withEffect: "Glowing",
      },
      {
        type: "replace",
        condition: ["Shrinking"],
        target: "Shrinking",
        withEffect: "Munchies",
      },
    ],
  },
];

// Create a Map for fast substance cost lookups
const substanceCostMap = new Map(substances.map((s) => [s.name, s.cost]));

// A simple pricing calculation: Final Price = Base Price * (1 + total effect multiplier)
export function calculateFinalPrice(
  productName: string,
  currentEffects: string[]
): number {
  // Use Map for O(1) lookup instead of find());
  const baseProductName = productVarietyMap.get(productName) || productName;

  const product = products[baseProductName];
  if (!product) return 0;

  let totalMultiplier = 0;
  // Use for...of loop instead of forEach for better performance
  for (const effectName of currentEffects) {
    const multiplier = effectsMap.get(effectName);
    if (multiplier !== undefined) {
      totalMultiplier += multiplier;
    }
  }

  return Math.round(product.basePrice * (1 + totalMultiplier));
}

export function calculateFinalCost(currentMix: string[]): number {
  let totalCost = 0;

  // Use Map for O(1) lookups instead of find()
  for (const substanceName of currentMix) {
    const cost = substanceCostMap.get(substanceName);
    if (cost !== undefined) {
      totalCost += cost;
    }
  }

  return Math.round(totalCost);
}

// Function to apply a substance’s rules to the current list of effects.
export function applySubstanceRules(
  currentEffects: string[],
  substance: Substance,
  recipeLength: number
): string[] {
  // Convert input array to Set for more efficient operations
  let ogEffects = new Set(currentEffects);
  let newEffects = new Set(currentEffects);

  // Apply each rule in order
  for (const rule of substance.rules) {
    // Check if all conditions are met
    const conditionsMet = rule.condition.every((cond) => ogEffects.has(cond));

    // Check if all excluded effects are absent
    const exclusionsMet = rule.ifNotPresent
      ? !rule.ifNotPresent.some((np) => new Set(ogEffects).has(np))
      : true;
    if (conditionsMet && exclusionsMet) {
      if (rule.type === "replace" && rule.withEffect) {
        if (newEffects.has(rule.target) && !newEffects.has(rule.withEffect)) {
          // console.log(
          //   `Replacing ${rule.target} with ${rule.withEffect} for ${substance.name}`
          // );

          // Remove target and add new effect
          newEffects.delete(rule.target);
          newEffects.add(rule.withEffect);
          ogEffects.add(rule.withEffect); // Add new effect to original effects for future checks

          // console.log(Array.from(newEffects));
        }
      } else if (rule.type === "add") {
        // Add new effect if not present
        if (!newEffects.has(rule.target)) {
          newEffects.add(rule.target);
          // console.log(
          //   `Adding ${rule.target} for ${substance.name} (not already present)`
          // );
          // console.log(Array.from(newEffects));
        }
      }
    }
  }

  // Ensure default effect is present

  if (recipeLength < 8) {
    // console.log(`Adding default effect ${substance.defaultEffect}`);

    newEffects.add(substance.defaultEffect);
  } else {
    // console.log("Skipping default effect addition due to recipe length");
  }

  // Convert back to array for return
  return Array.from(newEffects);
}
