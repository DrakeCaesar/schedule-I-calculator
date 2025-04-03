import {
  applySubstanceRules,
  calculateFinalCost,
  calculateFinalPrice,
  ProductVariety,
  substances,
} from "./substances";

// Constants
export const MAX_RECIPE_DEPTH = 6;

const substanceMap = new Map(
  substances.map((substance) => [substance.name, substance])
);

// BFS state variables
let bfsRunning = false;
let bfsPaused = false;
let bestMix: { mix: string[]; profit: number } = { mix: [], profit: -Infinity };
let bfsWorkers: Worker[] = [];
let currentProduct: ProductVariety | null = null;
let activeWorkers = 0;

// Track progress for each worker
type WorkerProgress = {
  substanceName: string;
  depth: number;
  processed: number;
  total: number;
  totalProcessed: number;
  grandTotal: number;
  executionTime: number;
};

let workersProgress: Map<number, WorkerProgress> = new Map();
let startTime = 0;

// Helper function to create effect span HTML
function createEffectSpan(effect: string): string {
  // Convert effect name to kebab case for CSS class
  const className = effect.toLowerCase().replace(/\s+/g, "-");
  return `<span class="effect effect-${effect}">${effect}</span>`;
}

export function calculateEffects(
  mix: string[],
  initialEffect: string
): string[] {
  let effectsList = [initialEffect];

  for (let i = 0; i < mix.length; i++) {
    const substanceName = mix[i];
    const substance = substanceMap.get(substanceName);
    if (substance) {
      effectsList = applySubstanceRules(effectsList, substance, i + 1);
    }
  }

  return effectsList;
}

export function updateBestMixDisplay() {
  const bestMixDisplay = document.getElementById("bestMixDisplay");
  if (!bestMixDisplay || !currentProduct) return;

  const effectsList = calculateEffects(
    bestMix.mix,
    currentProduct.initialEffect
  );
  const sellPrice = calculateFinalPrice(currentProduct.name, effectsList);
  const cost = calculateFinalCost(bestMix.mix);
  const profit = sellPrice - cost;

  const effectsHTML = effectsList
    .map((effect) => createEffectSpan(effect))
    .join(" ");
  bestMixDisplay.innerHTML = `
    <h3>Best Mix for ${currentProduct.name}</h3>
    <p>Mix: ${bestMix.mix.join(", ")}</p>
    <p>Effects: ${effectsHTML}</p>
    <p>Sell Price: $${sellPrice.toFixed(2)}</p>
    <p>Cost: $${cost.toFixed(2)}</p>
    <p>Profit: $${profit.toFixed(2)}</p>
  `;
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / (1000 * 60));
  return `${minutes}m ${seconds}s`;
}

function updateProgressDisplay() {
  const progressDisplay = document.getElementById("bfsProgressDisplay");
  if (!progressDisplay) return;

  // Calculate overall progress across all workers
  let totalProcessed = 0;
  let grandTotal = 0;
  const now = Date.now();
  const executionTime = now - startTime;

  // Sum up totals from all workers
  workersProgress.forEach((progress) => {
    totalProcessed += progress.totalProcessed;
    grandTotal += progress.grandTotal;
  });

  // Calculate overall percentage
  const overallPercentage =
    Math.min(100, Math.round((totalProcessed / grandTotal) * 100)) || 0;

  // Create HTML for overall progress (now at the top)
  const overallProgressHTML = `
    <div class="overall-progress">
      <h4>Overall Progress - ${activeWorkers} active workers</h4>
      <div>Total processed: ${totalProcessed.toLocaleString()} / ${grandTotal.toLocaleString()}</div>
      <div class="progress-bar-container">
        <div class="progress-bar" style="width: ${overallPercentage}%">
          <span class="progress-text">${overallPercentage}%</span>
        </div>
      </div>
      <div>Execution time: ${formatTime(executionTime)}</div>
    </div>
  `;

  // Create more compact HTML for each worker's progress
  const workerProgressHTML = Array.from(workersProgress.entries())
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
            <span class="worker-depth">Depth: ${progress.depth}/${MAX_RECIPE_DEPTH}</span>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar" style="width: ${depthPercentage}%">
              <span class="progress-text">${depthPercentage}%</span>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  progressDisplay.innerHTML = `
    ${overallProgressHTML}
    <div class="workers-container">
      <h4>Worker Status</h4>
      ${workerProgressHTML}
    </div>
  `;
}

export function createProgressDisplay() {
  let progressDisplay = document.getElementById("bfsProgressDisplay");

  if (!progressDisplay) {
    progressDisplay = document.createElement("div");
    progressDisplay.id = "bfsProgressDisplay";
    progressDisplay.classList.add("progress-display");

    // Add CSS for progress display directly
    const style = document.createElement("style");
    style.textContent = `
      .progress-display {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: white;
        border: 1px solid #ccc;
        padding: 15px;
        border-radius: 5px;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        max-width: 350px;
        max-height: 80vh;
        overflow-y: auto;
        z-index: 1000;
        font-size: 14px;
      }
      
      .overall-progress {
        margin-bottom: 15px;
        padding-bottom: 10px;
        border-bottom: 2px solid #eee;
      }
      
      .overall-progress h4 {
        margin-top: 0;
        margin-bottom: 8px;
      }
      
      .workers-container h4 {
        margin-top: 0;
        margin-bottom: 10px;
      }
      
      .worker-progress {
        margin-bottom: 5px;
      }
      
      .worker-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 3px;
        font-size: 12px;
      }
      
      .worker-name {
        font-weight: bold;
      }
      
      .progress-bar-container {
        width: 100%;
        height: 20px;
        background: #eee;
        border-radius: 4px;
        margin: 3px 0;
        position: relative;
        overflow: hidden;
      }
      
      .progress-bar {
        height: 100%;
        background: #4CAF50;
        border-radius: 4px;
        position: relative;
      }
      
      .progress-text {
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        mix-blend-mode: difference;
        color: white;
        text-shadow: 0 0 2px rgba(0, 0, 0, 0.5);
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(progressDisplay);
  }

  updateProgressDisplay();
}

export async function toggleBFS(product: ProductVariety) {
  const bfsButton = document.getElementById("bfsButton");
  if (!bfsButton) return;

  if (bfsRunning) {
    bfsPaused = !bfsPaused;
    bfsButton.textContent = bfsPaused ? "Resume BFS" : "Pause BFS";

    // Pause or resume all workers
    const messageType = bfsPaused ? "pause" : "resume";
    bfsWorkers.forEach((worker) => {
      worker.postMessage({ type: messageType });
    });
  } else {
    bfsRunning = true;
    bfsPaused = false;
    bfsButton.textContent = "Pause BFS";
    bestMix = { mix: [], profit: -Infinity };
    currentProduct = product;
    startTime = Date.now();

    // Clean up any existing workers
    bfsWorkers.forEach((worker) => worker.terminate());
    bfsWorkers = [];
    workersProgress = new Map();
    activeWorkers = 0;

    // Create a worker for each substance
    for (let i = 0; i < substances.length; i++) {
      const substanceName = substances[i].name;

      // Initialize with a single substance
      const initialQueue = [[substanceName]];

      // Create worker
      const worker = new Worker(new URL("./bfsWorker.ts", import.meta.url), {
        type: "module",
      });

      // Set up worker message handler
      worker.onmessage = createWorkerMessageHandler(i, substanceName);

      // Store the worker
      bfsWorkers.push(worker);

      // Initialize this worker's progress
      workersProgress.set(i, {
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
          queue: initialQueue,
          bestMix,
          substanceName,
        },
      });

      activeWorkers++;
    }

    createProgressDisplay();
  }
}

function createWorkerMessageHandler(workerId: number, substanceName: string) {
  return function (event: MessageEvent) {
    const { type } = event.data;

    if (type === "update") {
      const { bestMix: updatedBestMix } = event.data;

      // Only update if this mix is better than our current best mix
      if (updatedBestMix.profit > bestMix.profit) {
        bestMix = updatedBestMix;
        updateBestMixDisplay();
      }
    } else if (type === "progress") {
      const {
        depth,
        processed,
        total,
        totalProcessed,
        grandTotal,
        executionTime,
      } = event.data;

      // Update this worker's progress
      workersProgress.set(workerId, {
        substanceName,
        depth,
        processed,
        total,
        totalProcessed,
        grandTotal,
        executionTime,
      });

      updateProgressDisplay();
    } else if (type === "done") {
      activeWorkers--;

      // Check if this was the last worker to finish
      if (activeWorkers === 0) {
        bfsRunning = false;
        const bfsButton = document.getElementById("bfsButton");
        if (bfsButton) bfsButton.textContent = "Start BFS";
      }

      // Final update of progress display
      updateProgressDisplay();
    }
  };
}

export function isBfsRunning(): boolean {
  return bfsRunning;
}

export function getBestMix(): { mix: string[]; profit: number } {
  return bestMix;
}
