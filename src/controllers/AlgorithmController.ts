// Abstract Algorithm Controller
// Base class for all algorithm implementation controllers (TS, WASM, Native)

import { ImplementationType, createProgressDisplay, ProgressData, updateProgressDisplay } from "@/bfsProgress";
import {
  BfsMixResult,
  createBestMixDisplay,
  updateBestMixDisplay,
} from "../bfsMixDisplay";
import { ProductVariety } from "../substances";

export abstract class AlgorithmController {
  // Common state
  protected running = false;
  protected bestMix: BfsMixResult = { mix: [], profit: -Infinity };
  protected currentProduct: ProductVariety | null = null;
  protected startTime = 0;
  protected lastProgressUpdate = 0;

  // Engine type (ts, wasm, native)
  protected readonly engine: string;
  // Algorithm type (bfs, dfs)
  protected readonly algorithm: string;

  constructor(engine: string, algorithm: string) {
    this.engine = engine;
    this.algorithm = algorithm;
  }

  // Implementation-specific ID prefix (e.g., "ts-bfs")
  protected get implementationType(): ImplementationType {
    return `${this.engine}-${this.algorithm}` as ImplementationType;
  }

  // Button ID
  protected get buttonId(): string {
    return `${this.engine}${this.algorithm.toUpperCase()}Button`;
  }

  // Whether the algorithm is currently running
  public isRunning(): boolean {
    return this.running;
  }

  // Get the current best mix result
  public getBestMix(): BfsMixResult {
    return this.bestMix;
  }

  // Create progress and best mix displays
  protected createDisplays(): void {
    createProgressDisplay(this.implementationType);
    createBestMixDisplay(this.engine, this.algorithm.toUpperCase());
  }

  // Update best mix display
  protected updateBestMixDisplay(): void {
    if (!this.currentProduct) return;
    updateBestMixDisplay(
      this.engine as any, // Cast to satisfy type constraints
      this.bestMix,
      this.currentProduct,
      this.algorithm.toUpperCase()
    );
  }

  // Update progress display
  protected updateProgressDisplay(
    data: Partial<ProgressData> = {},
    forceUpdate = false
  ): void {
    const progressData: ProgressData = {
      processed: 0,
      total: 100,
      executionTime: this.startTime > 0 ? Date.now() - this.startTime : 0,
      message: this.running ? "Processing..." : "Ready",
      algorithm: this.algorithm.toUpperCase(),
      forceUpdate: forceUpdate,
      ...data, // Override defaults with provided data
    };

    this.lastProgressUpdate = updateProgressDisplay(
      this.implementationType,
      progressData,
      this.lastProgressUpdate
    );
  }

  // Update button state
  protected updateButtonState(): void {
    const button = document.getElementById(this.buttonId);
    if (button) {
      button.textContent = this.running
        ? `Stop ${this.engine.toUpperCase()} ${this.algorithm.toUpperCase()}`
        : `Start ${this.engine.toUpperCase()} ${this.algorithm.toUpperCase()}`;
    }
  }

  // Start the algorithm
  protected abstract start(product: ProductVariety): Promise<void>;

  // Stop the algorithm
  protected abstract stop(): void;

  // Toggle algorithm running state
  public async toggle(product: ProductVariety): Promise<void> {
    if (this.running) {
      this.stop();
      this.updateButtonState();
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

  // Reset to initial state
  protected reset(): void {
    this.running = false;
    this.updateProgressDisplay(
      {
        message: "Ready",
        processed: 0,
        total: 100,
      },
      true
    );
    this.updateButtonState();
  }
}
