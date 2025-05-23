import { Effect, substances } from "./substances.js";

// Define the type for the Emscripten module factory function
type BFSModuleFactory = () => Promise<BFSModule>;

// Simplified interface for the WASM module
export interface BFSModule {
  // BFS functions
  findBestMixJson: (
    productJson: string,
    substancesJson: string,
    effectMultipliersJson: string,
    substanceRulesJson: string,
    maxDepth: number
  ) => {
    mixArray: string[]; // Now this is a properly bound JavaScript array
    profit: number;
    sellPrice: number;
    cost: number;
  };

  // Add the new progress-enabled function
  findBestMixJsonWithProgress?: (
    productJson: string,
    substancesJson: string,
    effectMultipliersJson: string,
    substanceRulesJson: string,
    maxDepth: number,
    reportProgress: boolean
  ) => {
    mixArray: string[];
    profit: number;
    sellPrice: number;
    cost: number;
  };

  // DFS functions
  findBestMixDFSJson?: (
    productJson: string,
    substancesJson: string,
    effectMultipliersJson: string,
    substanceRulesJson: string,
    maxDepth: number
  ) => {
    mixArray: string[];
    profit: number;
    sellPrice: number;
    cost: number;
  };

  // Add the new progress-enabled DFS function
  findBestMixDFSJsonWithProgress?: (
    productJson: string,
    substancesJson: string,
    effectMultipliersJson: string,
    substanceRulesJson: string,
    maxDepth: number,
    reportProgress: boolean,
    enableHashing: boolean
  ) => {
    mixArray: string[];
    profit: number;
    sellPrice: number;
    cost: number;
  };

  // Add the helper function
  getMixArray?: () => string[];
}

// No module declaration - we'll use type assertions instead

let wasmModule: BFSModule | null = null;
let isLoading = false;
let loadPromise: Promise<BFSModule> | null = null;

/**
 * Utility function to convert a ClassHandle to a JavaScript array
 * This will extract string values from the ClassHandle object
 */
export function extractMixArrayFromClassHandle(mixHandle: any): string[] {
  if (!mixHandle) return [];

  // If it's already an array, return it
  if (Array.isArray(mixHandle)) return mixHandle;

  // If it's a ClassHandle with numeric keys, extract the string values
  try {
    const result: string[] = [];
    // Look for properties that are numbers (array indices)
    for (let i = 0; typeof mixHandle[i] === "string"; i++) {
      result.push(mixHandle[i]);
    }
    return result;
  } catch (e) {
    console.error("Failed to extract strings from mix handle:", e);
    return [];
  }
}

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
  loadPromise = new Promise(async (resolve, reject) => {
    try {
      console.log("Starting to load WASM module...");

      // Import the JS glue code generated by Emscripten
      // @ts-ignore - Suppress TypeScript error for WASM module import
      const moduleImport = await import("./cpp/bfs.wasm.js");
      const moduleFactory = moduleImport.default as unknown as BFSModuleFactory;

      console.log("Module factory loaded, initializing WASM module...");

      // Initialize the module
      const module = await moduleFactory();

      console.log("WASM module initialized:", module);
      console.log("Available module functions:", Object.keys(module));

      wasmModule = module;
      isLoading = false;
      resolve(wasmModule);
    } catch (error) {
      console.error("Failed to load WASM module:", error);
      isLoading = false;
      reject(error);
    }
  });

  return loadPromise;
}

// Prepare substance data as JSON string
export function prepareSubstancesForWasm() {
  const data = substances.map((substance) => ({
    name: substance.name,
    cost: substance.cost,
    defaultEffect: substance.defaultEffect,
  }));
  return JSON.stringify(data);
}

// Prepare effect multipliers as JSON string
export function prepareEffectMultipliersForWasm(
  effects: Record<string, Effect>
) {
  const multipliers = Object.entries(effects).map(([name, effect]) => ({
    name,
    multiplier: effect.multiplier,
  }));
  return JSON.stringify(multipliers);
}

// Prepare substance rules as JSON string
export function prepareSubstanceRulesForWasm() {
  const rulesArray = substances.map((substance) => ({
    substanceName: substance.name,
    rules: substance.rules.map((rule) => ({
      condition: [...rule.condition],
      ifNotPresent: rule.ifNotPresent ? [...rule.ifNotPresent] : [],
      action: {
        type: rule.type,
        target: rule.target,
        withEffect: rule.withEffect || "",
      },
    })),
  }));
  return JSON.stringify(rulesArray);
}
