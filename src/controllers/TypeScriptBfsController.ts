// TypeScript BFS Controller
// Implementation of AlgorithmController for TypeScript BFS

import { MAX_RECIPE_DEPTH, scheduleDomUpdate } from "../bfsCommon";
import { ProductVariety, substances } from "../substances";
import { calculateEffects } from "../utils";
import { AlgorithmController } from "./AlgorithmController";

type WorkerProgress = {
  substanceName: string;
  depth: number;
  processed: number;
  total: number;
  totalProcessed: number;
  grandTotal: number;
  executionTime: number;
};

export class TypeScriptBfsController extends AlgorithmController {
  private workers: Worker[] = [];
  private activeWorkers = 0;
  private paused = false;

  // Use Map for better performance with frequent updates
  private workersProgress: Map<number, WorkerProgress> = new Map();

  // Fast substance lookups
  private substanceMap = new Map(
    substances.map((substance) => [substance.name, substance])
  );

  constructor() {
    super("ts", "bfs");
  }

  // Whether the algorithm is paused
  public isPaused(): boolean {
    return this.paused;
  }

  // Start the TypeScript BFS algorithm
  protected async start(product: ProductVariety): Promise<void> {
    this.running = true;
    this.paused = false;
    this.workers = [];
    this.activeWorkers = 0;
    this.workersProgress.clear();

    // Create a separate worker for each substance to distribute processing
    for (let i = 0; i < substances.length; i++) {
      const substance = substances[i];
      const substanceName = substance.name;

      // Create a new worker
      const worker = new Worker(new URL("../tsBfsWorker.ts", import.meta.url), {
        type: "module",
      });

      // Set up the message handler
      worker.onmessage = this.createWorkerMessageHandler(i, substanceName);

      // Store worker reference
      this.workers.push(worker);

      // Initialize worker progress tracking
      this.workersProgress.set(i, {
        substanceName,
        depth: 1, // Starting with one substance
        processed: 0,
        total: 1,
        totalProcessed: 0,
        grandTotal: 0,
        executionTime: 0,
      });

      // Start the worker
      worker.postMessage({
        type: "start",
        workerId: i,
        data: {
          product: { ...product },
          bestMix: this.bestMix,
          substanceName,
          maxDepth: MAX_RECIPE_DEPTH,
        },
      });

      this.activeWorkers++;
    }

    // Initial progress update
    this.updateProgressDisplay();
  }

  // Stop or pause the TypeScript BFS algorithm
  protected stop(): void {
    if (this.paused) {
      // If already paused, stop completely
      this.workers.forEach((worker) => {
        worker.terminate();
      });
      this.workers = [];
      this.activeWorkers = 0;
      this.running = false;
      this.paused = false;
      this.reset();
    } else {
      // Just pause the workers
      this.paused = true;
      this.workers.forEach((worker) => {
        worker.postMessage({ type: "pause" });
      });
      this.updateButtonState();
    }
  }

  // Resume the algorithm if paused
  public resume(): void {
    if (this.running && this.paused) {
      this.paused = false;
      this.workers.forEach((worker) => {
        worker.postMessage({ type: "resume" });
      });
      this.updateButtonState();
      this.updateProgressDisplay();
    }
  }

  // Update button state based on running/paused status
  protected updateButtonState(): void {
    const button = document.getElementById(this.buttonId);
    if (button) {
      if (this.running) {
        button.textContent = this.paused
          ? `Resume ${this.engine.toUpperCase()} ${this.algorithm.toUpperCase()}`
          : `Pause ${this.engine.toUpperCase()} ${this.algorithm.toUpperCase()}`;
      } else {
        button.textContent = `Start ${this.engine.toUpperCase()} ${this.algorithm.toUpperCase()}`;
      }
    }
  }

  // Update progress display with worker-specific details
  protected updateProgressDisplay(
    data: Partial<any> = {},
    forceUpdate = false
  ): void {
    // Calculate overall totals from worker progress
    const totalProcessed = Array.from(this.workersProgress.values()).reduce(
      (sum, progress) => sum + progress.totalProcessed,
      0
    );
    const grandTotal = Array.from(this.workersProgress.values()).reduce(
      (sum, progress) => sum + progress.grandTotal,
      0
    );

    // Find the maximum depth across all workers
    const maxWorkerDepth = Math.max(
      ...Array.from(this.workersProgress.values()).map(
        (progress) => progress.depth || 0
      )
    );

    // Create progress data for the base implementation
    super.updateProgressDisplay(
      {
        processed: totalProcessed,
        total: grandTotal || 100,
        depth: maxWorkerDepth,
        message: this.running
          ? this.paused
            ? "Paused"
            : "Processing..."
          : totalProcessed > 0
          ? "Calculation complete"
          : "Ready",
        ...data,
      },
      forceUpdate
    );

    // Add worker-specific details if we have active workers
    if (this.workersProgress.size > 0 && this.running) {
      this.addWorkerDetailsToProgressDisplay();
    }
  }

  // Helper method to add worker details to the progress display
  private addWorkerDetailsToProgressDisplay(): void {
    const progressDisplay = document.getElementById("ts-bfsProgressDisplay");
    if (!progressDisplay) return;

    // Create worker progress HTML
    const workerProgressHTML = Array.from(this.workersProgress.entries())
      .map(([id, progress]) => {
        // Calculate percentage for current worker's depth
        const depthPercentage =
          Math.min(
            100,
            Math.round((progress.processed / Math.max(1, progress.total)) * 100)
          ) || 0;

        return `
          <div class="worker-progress">
            <div class="worker-header">
              <span class="worker-name">${progress.substanceName}</span>
              <span class="worker-depth">Depth: ${progress.depth}/${MAX_RECIPE_DEPTH}</span>
            </div>
            <div class="progress-bar-container">
              <div class="progress-bar" style="width: ${depthPercentage}%"></div>
              <span class="progress-text" data-progress="${depthPercentage}%" style="--progress-percent: ${depthPercentage}%"></span>
            </div>
          </div>
        `;
      })
      .join("");

    // Schedule the DOM update for worker details
    scheduleDomUpdate(() => {
      // Check if we already have a workers container
      let workersContainer =
        progressDisplay.querySelector(".workers-container");

      if (!workersContainer) {
        workersContainer = document.createElement("div");
        workersContainer.className = "workers-container";
        workersContainer.innerHTML = `<h4>Worker Status</h4>`;
        progressDisplay.appendChild(workersContainer);
      }

      // Update worker details
      workersContainer.innerHTML = `
        <h4>Worker Status</h4>
        ${workerProgressHTML}
      `;
    });
  }

  // Memory-optimized version of calculateEffects for calculating display data
  public calculateEffects(mix: string[], initialEffect: string): string[] {
    return calculateEffects(mix, initialEffect);
  }

  // Create message handler for a specific worker
  private createWorkerMessageHandler(workerId: number, substanceName: string) {
    return (event: MessageEvent) => {
      const { type } = event.data;

      if (type === "update") {
        const { bestMix: updatedBestMix } = event.data;

        // Only update if this mix is better than our current best mix
        if (updatedBestMix.profit > this.bestMix.profit) {
          // Copy only necessary properties to avoid memory bloat
          this.bestMix.mix = updatedBestMix.mix;
          this.bestMix.profit = updatedBestMix.profit;
          this.bestMix.sellPrice = updatedBestMix.sellPrice;
          this.bestMix.cost = updatedBestMix.cost;
          this.updateBestMixDisplay();
        }
      } else if (type === "progress") {
        const {
          depth,
          processed,
          total,
          totalProcessed,
          grandTotal,
          executionTime,
          isFinal, // Check for final update flag
        } = event.data;

        // Update this worker's progress
        this.workersProgress.set(workerId, {
          substanceName,
          depth,
          processed,
          total,
          totalProcessed,
          grandTotal,
          executionTime,
        });

        // Force update if this is the final progress message
        this.updateProgressDisplay({}, isFinal === true);
      } else if (type === "done") {
        // Get the worker's final stats before updating
        const workerProgress = this.workersProgress.get(workerId);

        if (workerProgress) {
          // Set processed counts to their maximum values to show 100% completion
          workerProgress.processed = workerProgress.total;
          workerProgress.totalProcessed = workerProgress.grandTotal;

          // Update the worker's progress with complete status
          this.workersProgress.set(workerId, workerProgress);
        }

        this.activeWorkers--;

        // Check if this was the last worker to finish
        if (this.activeWorkers === 0) {
          this.running = false;
          this.paused = false;

          // Update button state
          this.updateButtonState();
        }

        // Final update of progress display with force update
        this.updateProgressDisplay({}, true);
      }
    };
  }

  // Toggle the controller state (override base implementation to handle pause/resume)
  public async toggle(product: ProductVariety): Promise<void> {
    if (this.running) {
      if (this.paused) {
        this.resume();
      } else {
        this.stop(); // Will pause first
      }
    } else {
      this.createDisplays();
      this.updateButtonState();
      this.currentProduct = product;
      this.bestMix = { mix: [], profit: -Infinity };
      this.startTime = Date.now();
      this.lastProgressUpdate = 0;
      await this.start(product);
    }
  }
}

// Create singleton instance
export const typeScriptBfsController = new TypeScriptBfsController();
