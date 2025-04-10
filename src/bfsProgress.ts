// BFS Progress Display Handler
// Shared functionality for displaying progress of BFS calculations

import { formatClockTime, formatTime, scheduleDomUpdate } from "./bfsCommon";

// Progress update constants
export const PROGRESS_UPDATE_INTERVAL = 250; // ms

// Types for progress data
export interface ProgressData {
  processed: number;
  total: number;
  depth?: number;
  executionTime: number;
  message?: string;
  algorithm?: string; // Add algorithm type for display
  forceUpdate?: boolean; // Integrate force update into the data object
}

// Define a consistent implementation type
export type ImplementationType =
  | "ts-bfs" // TypeScript BFS
  | "wasm-bfs" // WebAssembly BFS
  | "wasm-dfs" // WebAssembly DFS
  | "native-bfs" // Native BFS
  | "native-dfs"; // Native DFS

function calculateRemainingTimeAndFinishTime(
  processed: number,
  total: number,
  executionTime: number
) {
  const percentage = Math.min(
    100,
    Math.round((processed / Math.max(1, total)) * 100)
  );
  let remainingTime = 0;
  if (percentage > 0 && percentage < 100) {
    remainingTime = Math.round(
      (executionTime / percentage) * (100 - percentage)
    );
  }
  const estimatedFinishTime = Date.now() + remainingTime;
  return { percentage, remainingTime, estimatedFinishTime };
}

// Creates or updates a progress display for the specified implementation
export function updateProgressDisplay(
  implementation: ImplementationType,
  progressData: ProgressData,
  lastUpdateTime: number
): number {
  const currentTime = Date.now();
  const forceUpdate = progressData.forceUpdate || false;

  // Only update if forced or enough time has passed since last update
  const isCompleteOrError =
    progressData.message === "Ready" ||
    progressData.message === "Calculation complete" ||
    progressData.message?.startsWith("Error") ||
    progressData.message === "Calculation canceled";

  if (
    !forceUpdate &&
    !isCompleteOrError &&
    currentTime - lastUpdateTime < PROGRESS_UPDATE_INTERVAL
  ) {
    return lastUpdateTime; // Return the original lastUpdateTime if we're skipping this update
  }

  // Get the appropriate progress display element
  const displayId = `${implementation}ProgressDisplay`;
  const progressDisplay = document.getElementById(displayId);
  if (!progressDisplay) return currentTime;

  // Extract and prepare data for display
  const { processed, total, depth, executionTime, message, algorithm } =
    progressData;
  const { percentage, remainingTime, estimatedFinishTime } =
    calculateRemainingTimeAndFinishTime(processed, total, executionTime);

  // Determine display title based on implementation
  const implParts = implementation.split("-");
  const algorithmType =
    algorithm || (implParts.length > 1 ? implParts[1].toUpperCase() : "BFS");
  const engine =
    implParts[0] === "ts"
      ? "TypeScript"
      : implParts[0] === "wasm"
      ? "WebAssembly"
      : "Native";
  const title = `${engine} ${algorithmType} Progress`;

  // Update the DOM with progress information
  scheduleDomUpdate(() => {
    progressDisplay.innerHTML = `
      <div class="overall-progress">
        <h4>${title}</h4>
        <div>Total processed: ${processed.toLocaleString()} / ${total.toLocaleString()}</div>
        <div class="progress-bar-container">
          <div class="progress-bar" style="width: ${percentage}%"></div>
          <span class="progress-text" data-progress="${percentage}%" style="--progress-percent: ${percentage}%"></span>
        </div>
        ${message ? `<div>Status: ${message}</div>` : ""}
        ${depth ? `<div>Current depth: ${depth}</div>` : ""}
        <div>Execution time: ${formatTime(executionTime)}</div>
        <div>Estimated time remaining: ${formatTime(remainingTime)}</div>
        <div>Estimated finish time: ${formatClockTime(
          estimatedFinishTime
        )}</div>
      </div>
    `;
  });

  return currentTime; // Return the current time as the new lastUpdateTime
}

// Create or get a progress display element for a specific implementation
export function createProgressDisplay(
  implementation: ImplementationType
): HTMLElement {
  const displayId = `${implementation}ProgressDisplay`;
  let progressDisplay = document.getElementById(displayId);

  if (!progressDisplay) {
    progressDisplay = document.createElement("div");
    progressDisplay.id = displayId;
    progressDisplay.classList.add("progress-display");

    // Find the appropriate column to place the display
    const implParts = implementation.split("-");
    const engine = implParts[0];
    const columnSelector = `.${engine}-column`;
    const column = document.querySelector(columnSelector);

    if (column) {
      // Find if there's already a progress display in this column
      const existingDisplay = column.querySelector(".progress-display");
      if (existingDisplay) {
        column.replaceChild(progressDisplay, existingDisplay);
      } else {
        column.appendChild(progressDisplay);
      }
    } else {
      // Fallback - append to BFS section
      const bfsSection = document.getElementById("bfsSection");
      if (bfsSection) {
        bfsSection.appendChild(progressDisplay);
      }
    }
  }

  // Initialize with "Ready" state
  updateProgressDisplay(
    implementation,
    {
      processed: 0,
      total: 100,
      depth: 0,
      executionTime: 0,
      message: "Ready",
      algorithm: implementation.split("-")[1]?.toUpperCase() || "BFS",
      forceUpdate: true,
    },
    0
  );

  return progressDisplay;
}

// Add worker-specific progress display functionality for TS BFS
export function createTsWorkerProgressHTML(
  workersProgress: Map<
    number,
    {
      substanceName: string;
      depth: number;
      processed: number;
      total: number;
      totalProcessed: number;
      grandTotal: number;
      executionTime: number;
    }
  >,
  maxDepth: number
): string {
  return Array.from(workersProgress.entries())
    .map(([id, progress]) => {
      // Calculate percentage for current worker's depth
      const depthPercentage =
        Math.min(
          100,
          Math.round((progress.processed / progress.total) * 100)
        ) || 0;

      return `
        <div class="worker-progress">
          <div class="worker-header">
            <span class="worker-name">${progress.substanceName}</span>
            <span class="worker-depth">Depth: ${progress.depth}/${maxDepth}</span>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar" style="width: ${depthPercentage}%"></div>
            <span class="progress-text" data-progress="${depthPercentage}%" style="--progress-percent: ${depthPercentage}%"></span>
          </div>
        </div>
      `;
    })
    .join("");
}

// Updates the TS progress display with worker-specific progress information
export function updateTsProgressDisplayWithWorkers(
  totalProcessed: number,
  grandTotal: number,
  executionTime: number,
  workersProgress: Map<number, any>,
  maxDepth: number,
  lastUpdateTime: number,
  forceUpdate = false
): number {
  // Use the unified updateProgressDisplay for the overall progress
  // but add worker-specific details after
  const progressData: ProgressData = {
    processed: totalProcessed,
    total: grandTotal || 100,
    executionTime,
    message: "Processing...",
    forceUpdate,
  };

  const currentTime = updateProgressDisplay(
    "ts-bfs",
    progressData,
    lastUpdateTime
  );

  // Only proceed if enough time has passed or force update is true
  if (!forceUpdate && currentTime === lastUpdateTime) {
    return lastUpdateTime;
  }

  const progressDisplay = document.getElementById("ts-bfsProgressDisplay");
  if (!progressDisplay) return currentTime;

  // Calculate overall percentage
  const overallPercentage =
    Math.min(100, Math.round((totalProcessed / grandTotal) * 100)) || 0;

  // Add worker-specific content
  const workerProgressHTML = createTsWorkerProgressHTML(
    workersProgress,
    maxDepth
  );

  // Schedule the DOM update for worker details
  scheduleDomUpdate(() => {
    // Find the overall progress container
    const overallProgress = progressDisplay.querySelector(".overall-progress");

    // Check if we already have a workers container
    let workersContainer = progressDisplay.querySelector(".workers-container");

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

  return currentTime;
}
