// WebAssembly BFS Controller
// Implementation of AlgorithmController for WebAssembly BFS

import { MAX_RECIPE_DEPTH } from "../bfsCommon";
import { ProductVariety } from "../substances";
import { AlgorithmController } from "./AlgorithmController";

export class WasmBfsController extends AlgorithmController {
  private worker: Worker | null = null;
  private totalProcessedCombinations = 0;
  private totalCombinations = 0;

  constructor() {
    super("wasm", "bfs");
  }

  // Start the WASM BFS algorithm
  protected async start(product: ProductVariety): Promise<void> {
    this.running = true;
    this.totalProcessedCombinations = 0;
    this.totalCombinations = 0;

    // Create worker
    const worker = new Worker(new URL("../wasmBfsWorker.ts", import.meta.url), {
      type: "module",
    });

    // Set up worker message handler
    worker.onmessage = this.createWorkerMessageHandler();

    // Start the worker
    worker.postMessage({
      type: "start",
      workerId: 0, // Only one WASM worker
      data: {
        product: { ...product },
        bestMix: this.bestMix,
        maxDepth: MAX_RECIPE_DEPTH,
      },
    });

    // Store the worker reference
    this.worker = worker;
  }

  // Stop the WASM BFS algorithm
  protected stop(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.running = false;
    this.reset();
  }

  // Create message handler for the worker
  private createWorkerMessageHandler() {
    return (event: MessageEvent) => {
      const { type } = event.data;

      if (type === "update") {
        const { bestMix: updatedBestMix } = event.data;

        // Update our best mix with the result from the worker
        this.bestMix = updatedBestMix;
        this.updateBestMixDisplay();
      } else if (type === "progress") {
        // Calculate progress percentage if we have the necessary data
        let progress = 0;

        // Track combinations processed/total for display
        if (
          event.data.processed !== undefined &&
          event.data.total !== undefined
        ) {
          this.totalProcessedCombinations = event.data.processed;
          this.totalCombinations = event.data.total;

          // Calculate percentage if total is greater than zero
          if (this.totalCombinations > 0) {
            progress = Math.min(
              100,
              Math.round(
                (this.totalProcessedCombinations / this.totalCombinations) * 100
              )
            );
          }
        } else if (event.data.progress !== undefined) {
          // If we already have a percentage, use that
          progress = event.data.progress;
        }

        // Force progress to 100% if we're done
        if (event.data.isFinal) {
          progress = 100;
          // Ensure processed equals total for the final update
          this.totalProcessedCombinations = this.totalCombinations;
        }

        // Update the progress display
        this.updateProgressDisplay(
          {
            processed: this.totalProcessedCombinations,
            total: this.totalCombinations || 100,
            message:
              progress === 100 ? "Calculation complete" : "Processing...",
          },
          event.data.isFinal
        );
      } else if (type === "done") {
        // When the calculation is complete, make sure we show 100% progress
        // Ensure processed equals total
        if (this.totalCombinations > 0) {
          this.totalProcessedCombinations = this.totalCombinations;
        } else if (this.totalProcessedCombinations > 0) {
          this.totalCombinations = this.totalProcessedCombinations;
        } else {
          // If we don't have either value, set some reasonable defaults
          this.totalProcessedCombinations = 100;
          this.totalCombinations = 100;
        }

        // Force a final progress update to 100% when done
        this.updateProgressDisplay(
          {
            processed: this.totalProcessedCombinations,
            total: this.totalCombinations,
            message: "Calculation complete",
          },
          true
        );

        // Mark the WASM BFS as complete
        this.running = false;

        // Clean up worker reference
        this.worker = null;

        // Update button text
        this.updateButtonState();
      } else if (type === "error") {
        console.error("WASM BFS worker error:", event.data.error);
        alert(`WASM BFS error: ${event.data.error}`);

        // Mark the WASM BFS as complete
        this.running = false;

        // Update button text
        this.updateButtonState();

        // Clean up worker reference
        this.worker = null;
      }
    };
  }
}

// Create singleton instance
export const wasmBfsController = new WasmBfsController();
