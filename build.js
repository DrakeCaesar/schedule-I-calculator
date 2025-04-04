import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
  console.log("Creating bfs.cpp file...");
  // The content of the C++ file is in the provided code
  const cppCode = fs.readFileSync(path.join(__dirname, "src", "cpp", "bfs.cpp"), "utf8");
  fs.writeFileSync(cppFilePath, cppCode, "utf8");
}

// Define the command to compile C++ to WASM using Emscripten
// Use forward slashes to avoid escaping issues on Windows
// Added --bind flag and fixed duplicate -s flag
const command = `emcc -std=c++17 -O3 --bind -s WASM=1 -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap'] -s ALLOW_MEMORY_GROWTH=1 -s EXPORT_ES6=1 -s MODULARIZE=1 -s EXPORT_NAME="BFSModule" -o "${wasmOutputPath.replace(/\\/g, '/')}" "${cppFilePath.replace(/\\/g, '/')}"`;

console.log("Compiling C++ to WebAssembly...");
console.log(command);

try {
  execSync(command, { stdio: "inherit" });
  console.log("Successfully compiled C++ to WebAssembly!");
} catch (error) {
  console.error("Failed to compile C++ to WebAssembly:", error);
  process.exit(1);
}
