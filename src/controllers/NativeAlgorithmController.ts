// Native Algorithm Controller
// Implementation of AlgorithmController for both Native BFS and DFS

import {
  ProgressData,
  createProgressDisplay,
  updateProgressDisplay,
} from "@/bfsProgress";
import { MAX_RECIPE_DEPTH } from "../bfsCommon";
import { createBestMixDisplay } from "../bfsMixDisplay";
import { ProductVariety, effects } from "../substances";
import {
  prepareEffectMultipliersForWasm,
  prepareSubstanceRulesForWasm,
  prepareSubstancesForWasm,
} from "../wasmLoader";
import { AlgorithmController } from "./AlgorithmController";

// Base class for Native algorithm controllers (BFS/DFS)
export class NativeAlgorithmController extends AlgorithmController {
  protected webSocket: WebSocket | null = null;
  protected totalProcessed = 0;
  protected grandTotal = 1; // Start with 1 to avoid division by zero
  protected lastUpdate = 0;

  constructor(algorithm: string) {
    super("native", algorithm);
  }

  // Start the Native algorithm
  protected async start(product: ProductVariety): Promise<void> {
    this.running = true;
    this.totalProcessed = 0;
    this.grandTotal = 1;
    this.lastUpdate = 0;

    // Initialize WebSocket connection
    this.initializeWebSocket();

    // Set start time for execution time calculation
    this.startTime = Date.now();
    this.lastProgressUpdate = 0;

    // Initial progress update
    this.updateProgressDisplay(
      {
        processed: 0,
        total: 100,
        depth: 1,
        executionTime: 0,
        message: `Starting ${this.algorithm.toUpperCase()} calculation...`,
      },
      true
    );

    try {
      // Prepare data for the server
      const maxDepthEl = document.getElementById(
        "maxDepthSlider"
      ) as HTMLInputElement;
      const maxDepth = maxDepthEl
        ? parseInt(maxDepthEl.value, 10)
        : MAX_RECIPE_DEPTH;

      const productJson = {
        name: product.name,
        initialEffect: product.initialEffect,
      };

      // Get data in the same format as we use for WASM
      const substancesJson = JSON.parse(prepareSubstancesForWasm());
      const effectMultipliersJson = JSON.parse(
        prepareEffectMultipliersForWasm(effects)
      );
      const substanceRulesJson = JSON.parse(prepareSubstanceRulesForWasm());

      // Send the data to the server - use the full URL with port
      const response = await fetch("http://localhost:3000/api/mix", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product: productJson,
          substances: substancesJson,
          effectMultipliers: effectMultipliersJson,
          substanceRules: substanceRulesJson,
          maxDepth,
          algorithm: this.algorithm, // Specify algorithm
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Server responded with ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();

      // Process successful result
      if (!data.success) {
        throw new Error(data.error || "Unknown server error");
      }

      // The WebSocket will handle progress updates and final results
      // This is just a fallback in case WebSocket fails
      if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
        // Extract results and update the UI
        const result = data.result;
        if (!result) {
          throw new Error("No result data received");
        }

        // Convert result format to UI expectations
        this.bestMix = {
          mix: result.mixArray || [],
          profit: result.profit || 0,
          sellPrice: result.sellPrice || 0,
          cost: result.cost || 0,
        };

        // Update the display
        this.updateBestMixDisplay();

        // Final progress update
        const executionTime = Date.now() - this.startTime;
        this.updateProgressDisplay(
          {
            processed: this.grandTotal,
            total: this.grandTotal,
            depth: 0,
            executionTime,
            message: `Calculation complete in ${(executionTime / 1000).toFixed(
              2
            )}s`,
          },
          true
        );

        // Reset the state after a successful computation
        this.running = false;
        this.updateButtonState();
      }
    } catch (error: unknown) {
      // Handle errors with proper type checking
      console.error(`Native ${this.algorithm.toUpperCase()} error:`, error);

      // Convert error to string for display
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Show error message in progress display
      this.updateProgressDisplay(
        {
          processed: this.totalProcessed,
          total: this.grandTotal,
          depth: 0,
          executionTime: Date.now() - this.startTime,
          message: `Error: ${errorMessage}`,
        },
        true
      );

      // Reset the state after an error
      this.running = false;
      this.updateButtonState();
    }
  }

  // Stop the Native algorithm
  protected stop(): void {
    if (this.webSocket) {
      this.webSocket.close();
      this.webSocket = null;
    }
    this.running = false;

    // Update progress display with cancellation message
    this.updateProgressDisplay(
      {
        processed: this.totalProcessed,
        total: this.grandTotal,
        depth: 0,
        executionTime: Date.now() - this.startTime,
        message: "Calculation canceled",
      },
      true
    );

    this.reset();
  }

  // Initialize WebSocket connection
  protected initializeWebSocket(): void {
    if (this.webSocket) {
      // Close existing connection if there is one
      this.webSocket.close();
    }

    // Create new WebSocket connection
    this.webSocket = new WebSocket("ws://localhost:3000");

    this.webSocket.onopen = () => {
      console.log(
        `Native ${this.algorithm.toUpperCase()} WebSocket connection established`
      );
    };

    this.webSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "progress") {
          // Handle progress update
          const executionTime =
            data.executionTime || Date.now() - this.startTime;

          // Store values for our global state
          this.totalProcessed = data.totalProcessed || data.processed || 0;
          if (data.grandTotal > 0 || data.total > 0) {
            this.grandTotal = data.grandTotal || data.total || 100;
          }

          // Create progress data object
          const progressData: ProgressData = {
            processed: this.totalProcessed,
            total: this.grandTotal,
            depth: data.depth || 1,
            executionTime,
            message: data.message || `Processing depth ${data.depth || 1}`,
            algorithm: this.algorithm.toUpperCase(),
          };

          this.updateProgressDisplay(progressData);

          // If progress update includes a best mix, update the display
          if (data.bestMix && data.bestMix.profit > this.bestMix.profit) {
            this.bestMix = data.bestMix;
            this.updateBestMixDisplay();
          }
        } else if (data.type === "update") {
          // Handle best mix update
          if (data.bestMix && data.bestMix.profit > this.bestMix.profit) {
            this.bestMix = data.bestMix;
            this.updateBestMixDisplay();
          }
        } else if (data.type === "done") {
          // Handle completion
          this.running = false;

          // Update progress to 100%
          this.updateProgressDisplay(
            {
              processed: this.grandTotal,
              total: this.grandTotal,
              depth: data.depth || 0,
              executionTime: Date.now() - this.startTime,
              message: "Calculation complete",
            },
            true
          );

          // Update the result display if we have result data
          if (data.result) {
            this.bestMix = {
              mix: data.result.mixArray || [],
              profit: data.result.profit || 0,
              sellPrice: data.result.sellPrice || 0,
              cost: data.result.cost || 0,
            };
            this.updateBestMixDisplay();
          }

          // Update button state
          this.updateButtonState();
        } else if (data.type === "error") {
          // Handle error
          console.error(
            `Native ${this.algorithm.toUpperCase()} error:`,
            data.message
          );

          this.updateProgressDisplay(
            {
              processed: this.totalProcessed,
              total: this.grandTotal,
              depth: 0,
              executionTime: Date.now() - this.startTime,
              message: `Error: ${data.message}`,
            },
            true
          );

          this.running = false;

          // Update button state
          this.updateButtonState();
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
      }
    };

    this.webSocket.onerror = (error) => {
      console.error("WebSocket error:", error);
      this.running = false;
      this.updateButtonState();
    };

    this.webSocket.onclose = () => {
      console.log(
        `Native ${this.algorithm.toUpperCase()} WebSocket connection closed`
      );
      this.webSocket = null;
    };
  }

  // Override the createDisplays method to use the correct implementation prefixes
  protected createDisplays(): void {
    createProgressDisplay(this.implementationType);
    createBestMixDisplay("native", this.algorithm);
  }

  // Update progress display with standardized progress data
  protected updateProgressDisplay(
    data: Partial<ProgressData> = {},
    forceUpdate = false
  ): void {
    const progressData: ProgressData = {
      processed: this.totalProcessed,
      total: this.grandTotal || 100,
      depth: data.depth || 1,
      executionTime: data.executionTime || Date.now() - this.startTime,
      message: data.message || "Processing...",
      algorithm: this.algorithm.toUpperCase(),
      forceUpdate: forceUpdate,
    };

    // Use the shared progress display component
    this.lastUpdate = updateProgressDisplay(
      this.implementationType,
      progressData,
      this.lastUpdate
    );
  }
}

// Create concrete controllers for BFS and DFS
export class NativeBfsController extends NativeAlgorithmController {
  constructor() {
    super("bfs");
  }
}

export class NativeDfsController extends NativeAlgorithmController {
  constructor() {
    super("dfs");
  }
}

// Create singleton instances
export const nativeBfsController = new NativeBfsController();
export const nativeDfsController = new NativeDfsController();
