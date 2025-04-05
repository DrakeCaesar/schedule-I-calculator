// Node.js server for schedule-I-calculator
// This server exposes an API endpoint that runs the native C++ BFS algorithm

import { exec } from "child_process";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get directory name in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// Enable CORS for all routes
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the project directory
app.use(express.static("./"));

// API endpoint for BFS calculations
app.post("/api/bfs", async (req, res) => {
  try {
    const { product, maxDepth } = req.body;

    if (!product || !product.name) {
      return res.status(400).json({
        success: false,
        error: "Invalid product data",
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

    fs.writeFileSync(productJsonPath, JSON.stringify(req.body.product));
    fs.writeFileSync(substancesJsonPath, JSON.stringify(req.body.substances));
    fs.writeFileSync(
      effectMultipliersJsonPath,
      JSON.stringify(req.body.effectMultipliers)
    );
    fs.writeFileSync(
      substanceRulesJsonPath,
      JSON.stringify(req.body.substanceRules)
    );

    // Determine the path of the bfs_calculator executable based on the platform
    const isWindows = process.platform === "win32";
    const bfsExecutable = isWindows
      ? path.join(__dirname, "build", "Release", "bfs_calculator.exe")
      : path.join(__dirname, "build", "bin", "bfs_calculator");

    // Prepare the command to execute
    let command = `"${bfsExecutable}" -p "${productJsonPath}" "${substancesJsonPath}" "${effectMultipliersJsonPath}" "${substanceRulesJsonPath}" ${
      maxDepth || 5
    } -o "${outputJsonPath}"`;

    console.log(`Executing command: ${command}`);

    // Execute the native BFS calculator
    exec(command, (error, stdout, stderr) => {
      // Log any console output from the executable
      if (stdout) console.log("BFS stdout:", stdout);
      if (stderr) console.log("BFS stderr:", stderr);

      if (error) {
        console.error(`Execution error: ${error}`);
        return res.status(500).json({
          success: false,
          error: `Error executing BFS calculator: ${error.message}`,
        });
      }

      try {
        // Read and parse the output file
        if (!fs.existsSync(outputJsonPath)) {
          throw new Error("Output file not generated");
        }

        const resultData = fs.readFileSync(outputJsonPath, "utf8");
        const result = JSON.parse(resultData);

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
        res.status(500).json({
          success: false,
          error: `Error parsing result: ${parseError.message}`,
        });
      }
    });
  } catch (error) {
    console.error(`Server error: ${error}`);
    res.status(500).json({
      success: false,
      error: `Server error: ${error.message}`,
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
