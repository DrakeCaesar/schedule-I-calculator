import { Effect, ProductVariety, substances } from "./substances";

// Interface for the WASM module
interface BFSModule {
  findBestMix: (
    product: ProductVariety,
    substances: any[],
    effectMultipliers: Record<string, number>,
    substanceRules: Record<string, any[]>,
    maxDepth: number
  ) => {
    mix: string[];
    profit: number;
    sellPrice: number;
    cost: number;
  };
}

let wasmModule: BFSModule | null = null;
let isLoading = false;
let loadPromise: Promise<BFSModule> | null = null;

/**
 * Loads the WebAssembly module containing the BFS algorithm
 */
export async function loadWasmModule(): Promise<BFSModule> {
  if (wasmModule) {
    return wasmModule;
  }

  if (isLoading && loadPromise) {
    return loadPromise;
  }

  isLoading = true;
  loadPromise = new Promise((resolve, reject) => {
    // Dynamic import of the WASM module
    import("./cpp/bfs.wasm")
      .then((module) => {
        wasmModule = module as unknown as BFSModule;
        isLoading = false;
        resolve(wasmModule);
      })
      .catch((error) => {
        console.error("Failed to load WASM module:", error);
        isLoading = false;
        reject(error);
      });
  });

  return loadPromise;
}

// Prepare substance data in a format suitable for WASM
export function prepareSubstancesForWasm() {
  return substances.map((substance) => ({
    name: substance.name,
    cost: substance.cost,
    defaultEffect: substance.defaultEffect,
  }));
}

// Prepare effect multipliers in a format suitable for WASM
export function prepareEffectMultipliersForWasm(
  effects: Record<string, Effect>
) {
  const multipliers: Record<string, number> = {};

  for (const [name, effect] of Object.entries(effects)) {
    multipliers[name] = effect.multiplier;
  }

  return multipliers;
}

// Prepare substance rules in a format suitable for WASM
export function prepareSubstanceRulesForWasm() {
  const rules: Record<string, any[]> = {};

  for (const substance of substances) {
    rules[substance.name] = substance.rules.map((rule) => ({
      condition: rule.condition,
      ifNotPresent: rule.ifNotPresent || [],
      action: {
        type: rule.type,
        target: rule.target,
        withEffect: rule.withEffect || "",
      },
    }));
  }

  return rules;
}
