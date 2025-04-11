/**
 * Type definitions for Emscripten-generated WebAssembly module
 */

// Result type for BFS/DFS algorithm
interface WasmAlgorithmResult {
  mixArray: string[];
  profit: number;
  sellPrice: number;
  cost: number;
  totalCombinations?: number;
}

// Define the complete module interface
interface BFSModule {
  // BFS functions
  findBestMixJson: (
    productJson: string,
    substancesJson: string,
    effectMultipliersJson: string,
    substanceRulesJson: string,
    maxDepth: number
  ) => WasmAlgorithmResult;

  findBestMixJsonWithProgress?: (
    productJson: string,
    substancesJson: string,
    effectMultipliersJson: string,
    substanceRulesJson: string,
    maxDepth: number,
    reportProgress: boolean
  ) => WasmAlgorithmResult;

  // DFS functions
  findBestMixDFSJson?: (
    productJson: string,
    substancesJson: string,
    effectMultipliersJson: string,
    substanceRulesJson: string,
    maxDepth: number
  ) => WasmAlgorithmResult;

  findBestMixDFSJsonWithProgress?: (
    productJson: string,
    substancesJson: string,
    effectMultipliersJson: string,
    substanceRulesJson: string,
    maxDepth: number,
    reportProgress: boolean
  ) => WasmAlgorithmResult;

  // Helper functions
  getMixArray?: () => string[];
}

// Define the factory function
declare function ModuleFactory(): Promise<BFSModule>;

// Export the factory as default
export default ModuleFactory;
