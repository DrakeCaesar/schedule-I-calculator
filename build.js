import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get current file directory (ES module equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure directories exist
const cppDir = path.join(__dirname, "src", "cpp");
if (!fs.existsSync(cppDir)) {
  fs.mkdirSync(cppDir, { recursive: true });
}

// Path to the C++ source file
const cppFilePath = path.join(cppDir, "bfs.cpp");
const wasmOutputPath = path.join(cppDir, "bfs.wasm.js");

// Check if the source file exists
if (!fs.existsSync(cppFilePath)) {
  console.log("No existing bfs.cpp file found, aborting build");
  process.exit(1);
}

// Define the command to compile C++ to WASM using Emscripten with simpler settings
// Use forward slashes to avoid escaping issues on Windows
const command = `emcc -std=c++17 -O3 --bind -s WASM=1 -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap'] -s ALLOW_MEMORY_GROWTH=1 -s EXPORT_ES6=1 -s MODULARIZE=1 -s EXPORT_NAME="BFSModule" -s ENVIRONMENT=web,worker -s SINGLE_FILE=0 -s ERROR_ON_UNDEFINED_SYMBOLS=0 -s ASSERTIONS=1 -o "${wasmOutputPath.replace(
  /\\/g,
  "/"
)}" "${cppFilePath.replace(/\\/g, "/")}"`;

console.log("Compiling C++ to WebAssembly...");
console.log(command);

try {
  execSync(command, { stdio: "inherit" });
  console.log("Successfully compiled C++ to WebAssembly!");

  // Copy the generated .wasm file to the public directory to ensure it's accessible
  const wasmFile = wasmOutputPath.replace(".js", ".wasm");
  const publicDir = path.join(__dirname, "public");

  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  if (fs.existsSync(wasmFile)) {
    fs.copyFileSync(wasmFile, path.join(publicDir, "bfs.wasm"));
    console.log("Copied WASM file to public directory for serving");
  }
} catch (error) {
  console.error("Failed to compile C++ to WebAssembly:", error);
  process.exit(1);
}
