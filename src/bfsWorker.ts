import {
  applySubstanceRules,
  calculateFinalCost,
  calculateFinalPrice,
  ProductVariety,
  substances,
} from "./substances";

let currentProduct: ProductVariety | null = null;

self.onmessage = (event: MessageEvent) => {
  const { type, data } = event.data || {}; // Safely destructure event.data

  if (type === "start" && data) {
    currentProduct = data.product; // Dynamically set current product
    runBFS(data.queue, data.bestMix);
  } else {
    console.error("Invalid message received by worker:", event.data);
  }
};

function runBFS(queue: string[][], bestMix: { mix: string[]; profit: number }) {
  let currentLength = 1;

  while (queue.length > 0) {
    const currentMix = queue.shift()!;

    if (currentMix.length > currentLength) {
      currentLength++;
      if (currentLength > 8) break;
    }

    const effectsList = calculateEffects(currentMix);
    const sellPrice = currentProduct
      ? calculateFinalPrice(currentProduct.name, effectsList)
      : 0;
    const cost = calculateFinalCost(currentMix);
    const profit = sellPrice - cost;

    if (profit > bestMix.profit) {
      bestMix = { mix: currentMix, profit };
      self.postMessage({
        type: "update",
        bestMix,
        sellPrice,
        cost,
        profit,
      });
    }

    if (currentMix.length < 8) {
      for (const substance of substances) {
        queue.push([...currentMix, substance.name]);
      }
    }
  }

  self.postMessage({ type: "done", bestMix });
}

function calculateEffects(mix: string[]): string[] {
  let effectsList = currentProduct ? [currentProduct.initialEffect] : [];
  mix.forEach((substanceName, index) => {
    const substance = substances.find((s) => s.name === substanceName);
    if (substance) {
      effectsList = applySubstanceRules(effectsList, substance, index + 1);
    }
  });
  return effectsList;
}
