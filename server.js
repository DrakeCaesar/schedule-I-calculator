// Node.js server for schedule-I-calculator
// This server exposes an API endpoint that runs the native C++ BFS algorithm

import { exec } from "child_process";
import { EventEmitter } from "events";
import express from "express";
import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";

// Create a global event emitter for BFS progress updates
const bfsProgressEmitter = new EventEmitter();

// Get directory name in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Handle WebSocket connections
wss.on("connection", (ws) => {
  console.log("WebSocket client connected");

  // Setup listener for BFS progress
  const progressListener = (progress) => {
    if (ws.readyState === 1) {
      // Check if connection is open
      ws.send(JSON.stringify(progress));
    }
  };

  // Register listener
  bfsProgressEmitter.on("progress", progressListener);

  // Clean up when client disconnects
  ws.on("close", () => {
    console.log("WebSocket client disconnected");
    bfsProgressEmitter.off("progress", progressListener);
  });
});

// Enable CORS for all routes
app.use((req, res, next) => {
  // Basic CORS headers
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  
  // Headers required for SharedArrayBuffer
  res.header("Cross-Origin-Opener-Policy", "same-origin");
  res.header("Cross-Origin-Embedder-Policy", "require-corp");
  
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the project directory
app.use(express.static("./"));

// API endpoint for mix calculations - supports both BFS and DFS
app.post("/api/mix", async (req, res) => {
  try {
    const { product, maxDepth, algorithm = "bfs" } = req.body;

    if (!product || !product.name) {
      return res.status(400).json({
        success: false,
        error: "Invalid product data",
      });
    }

    // Validate algorithm selection
    if (algorithm !== "bfs" && algorithm !== "dfs") {
      return res.status(400).json({
        success: false,
        error: "Invalid algorithm. Use 'bfs' or 'dfs'",
      });
    }

    // Create temporary JSON files for the native process
    const tempDir = path.join(__dirname, "temp");

    // Ensure the temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    // Write input data to temp files
    const productJsonPath = path.join(tempDir, "product.json");
    const substancesJsonPath = path.join(tempDir, "substances.json");
    const effectMultipliersJsonPath = path.join(
      tempDir,
      "effectMultipliers.json"
    );
    const substanceRulesJsonPath = path.join(tempDir, "substanceRules.json");
    const outputJsonPath = path.join(tempDir, "output.json");

    // Add maxDepth to product object so it's available in the JSON
    const productWithDepth = {
      ...req.body.product,
      maxDepth: maxDepth || 5,
    };

    fs.writeFileSync(
      productJsonPath,
      JSON.stringify(productWithDepth, null, 2)
    );
    fs.writeFileSync(
      substancesJsonPath,
      JSON.stringify(req.body.substances, null, 2)
    );
    fs.writeFileSync(
      effectMultipliersJsonPath,
      JSON.stringify(req.body.effectMultipliers, null, 2)
    );
    fs.writeFileSync(
      substanceRulesJsonPath,
      JSON.stringify(req.body.substanceRules, null, 2)
    );

    // Determine the path of the bfs_calculator executable based on the platform
    const isWindows = process.platform === "win32";
    const calculatorExecutable = isWindows
      ? path.join(__dirname, "build", "Release", "bfs_calculator.exe")
      : path.join(__dirname, "build", "bin", "bfs_calculator");

    // Prepare the command to execute with algorithm choice
    let command = `"${calculatorExecutable}" -a ${algorithm} -p "${productJsonPath}" "${substancesJsonPath}" "${effectMultipliersJsonPath}" "${substanceRulesJsonPath}" ${
      maxDepth || 5
    } -o "${outputJsonPath}"`;

    console.log(`Executing command: ${command}`);

    // Track total combinations for better progress reporting
    let totalCombinations = 0;
    let processedCombinations = 0;
    let currentDepth = 1;
    let startTime = Date.now();

    // Track the best mix found so far
    let currentBestMix = null;

    // Initialize progress tracking
    bfsProgressEmitter.emit("progress", {
      type: "progress",
      processed: 0,
      total: 100, // Initial estimate
      depth: 1,
      message: `Starting ${algorithm.toUpperCase()} calculation...`,
      executionTime: 0,
    });

    // Execute the native calculator with increased timeout (20 minutes)
    const childProcess = exec(command, { timeout: 20 * 60 * 1000 });

    // Handle potential exec errors
    childProcess.on("error", (error) => {
      console.error(`Error executing calculator: ${error.message}`);
      bfsProgressEmitter.emit("progress", {
        type: "error",
        message: `Execution error: ${error.message}`,
      });
    });

    // Process stdout to extract progress information
    childProcess.stdout.on("data", (data) => {
      // console.log(`${algorithm.toUpperCase()} stdout: ${data}`);
      const dataStr = data.toString();

      // Try to parse progress information - looking for patterns like:
      // Progress: Depth 3, 456/1000 (45%)
      const progressMatch = dataStr.match(
        /Progress: Depth (\d+), (\d+)\/(\d+)/
      );
      if (progressMatch) {
        const depth = parseInt(progressMatch[1], 10);
        const processed = parseInt(progressMatch[2], 10);
        const total = parseInt(progressMatch[3], 10);

        // Update our progress tracking
        currentDepth = depth;
        processedCombinations = processed;

        // If this is the first time we see this depth, update total
        if (depth > 1 && totalCombinations === 0) {
          totalCombinations = total;
        }

        // Calculate overall progress percentage (0-100)
        const percentage = Math.min(100, Math.round((processed / total) * 100));

        // Calculate execution time
        const executionTime = Date.now() - startTime;

        // Periodically send the current best mix, even if it hasn't changed
        // This gives more frequent UI updates
        if (currentBestMix && percentage % 5 === 0) {
          // Use the last known digit of processed number as a simple way to reduce
          // how often we send updates (avoids flooding the WebSocket)
          const lastDigit = processed % 10;
          if (lastDigit === 0) {
            // console.log(
            //   "Sending periodic best mix update at progress:",
            //   percentage + "%"
            // );
            // Emit best mix update with currentBestMix
            bfsProgressEmitter.emit("progress", {
              type: "update",
              bestMix: currentBestMix,
              executionTime,
              milestone: true, // Mark this as a milestone update rather than a new best mix
            });
          }
        }

        // Emit progress event
        bfsProgressEmitter.emit("progress", {
          type: "progress",
          depth,
          processed,
          total,
          totalProcessed: processedCombinations,
          grandTotal: totalCombinations,
          percentage,
          executionTime,
          message: `Processing depth ${depth}`,
          bestMix: currentBestMix, // Include current best mix if available
        });
      }

      // Check for best mix found so far
      // Format: Best mix so far: [mixArray] with profit X
      const bestMixMatch = dataStr.match(
        /Best mix so far: \[(.*?)\] with profit (\d+\.?\d*), price (\d+\.?\d*), cost (\d+\.?\d*)/
      );
      if (bestMixMatch) {
        const mixArray = bestMixMatch[1].split(",").map((item) => item.trim());
        const profit = parseFloat(bestMixMatch[2]);
        const sellPrice = parseFloat(bestMixMatch[3]);
        const cost = parseFloat(bestMixMatch[4]);

        // Update current best mix
        currentBestMix = {
          mix: mixArray,
          profit,
          sellPrice,
          cost,
        };

        // Emit best mix update
        bfsProgressEmitter.emit("progress", {
          type: "update",
          bestMix: currentBestMix,
          executionTime: Date.now() - startTime,
        });
      }
    });

    // Process stderr
    childProcess.stderr.on("data", (data) => {
      console.log(`${algorithm.toUpperCase()} stderr: ${data}`);

      // Emit error information
      bfsProgressEmitter.emit("progress", {
        type: "error",
        message: data.toString(),
      });
    });

    // Handle completion or error
    childProcess.on("exit", (code) => {
      if (code !== 0) {
        console.error(`Execution error with code: ${code}`);

        // Emit error event
        bfsProgressEmitter.emit("progress", {
          type: "error",
          message: `Process exited with code ${code}`,
        });

        return res.status(500).json({
          success: false,
          error: `Error executing ${algorithm.toUpperCase()} calculator, exit code: ${code}`,
        });
      }

      try {
        // Read and parse the output file
        if (!fs.existsSync(outputJsonPath)) {
          throw new Error("Output file not generated");
        }

        const resultData = fs.readFileSync(outputJsonPath, "utf8");
        const result = JSON.parse(resultData);

        // Emit a final 100% progress update
        bfsProgressEmitter.emit("progress", {
          type: "progress",
          depth: currentDepth,
          processed: totalCombinations || 100,
          total: totalCombinations || 100,
          totalProcessed: totalCombinations || 100,
          grandTotal: totalCombinations || 100,
          percentage: 100,
          executionTime: Date.now() - startTime,
          message: "Calculation complete",
          bestMix: result, // Include final best mix
        });

        // Emit completion event
        bfsProgressEmitter.emit("progress", {
          type: "done",
          result,
        });

        // Send the result back to the client
        res.json({
          success: true,
          result,
        });

        // Clean up temp files
        // fs.unlinkSync(productJsonPath);
        // fs.unlinkSync(substancesJsonPath);
        // fs.unlinkSync(effectMultipliersJsonPath);
        // fs.unlinkSync(substanceRulesJsonPath);
        // fs.unlinkSync(outputJsonPath);
      } catch (parseError) {
        console.error(`Error parsing result: ${parseError}`);

        // Emit error event
        bfsProgressEmitter.emit("progress", {
          type: "error",
          message: parseError.message,
        });

        res.status(500).json({
          success: false,
          error: `Error parsing result: ${parseError.message}`,
        });
      }
    });
  } catch (error) {
    console.error(`Server error: ${error}`);

    // Emit error event
    bfsProgressEmitter.emit("progress", {
      type: "error",
      message: error.message,
    });

    res.status(500).json({
      success: false,
      error: `Server error: ${error.message}`,
    });
  }
});

// Keep the old /api/bfs endpoint for backward compatibility
app.post("/api/bfs", async (req, res) => {
  // Force the algorithm to be BFS and delegate to the new endpoint
  req.body.algorithm = "bfs";
  app.handle(req, res, "/api/mix");
});

// Start the server
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
