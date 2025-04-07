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

// Check if we should do a debug build
const isDebug = process.argv.includes("--debug");
console.log(`Building in ${isDebug ? "debug" : "optimized release"} mode...`);

// List of source files to compile - added dfs.cpp and dfs_algorithm.cpp
const sourceFiles = [
  "bfs.cpp",
  "dfs.cpp",  // Added DFS module
  "effects.cpp",
  "pricing.cpp",
  "bfs_algorithm.cpp",
  "dfs_algorithm.cpp", // Added DFS algorithm
  "json_parser.cpp",
].map((file) => path.join(cppDir, file).replace(/\\/g, "/"));

// Check if all source files exist
let missingFiles = sourceFiles.filter((file) => !fs.existsSync(file));
if (missingFiles.length > 0) {
  console.log(`Missing source files: ${missingFiles.join(", ")}`);
  process.exit(1);
}

// Output paths
const wasmOutputPath = path.join(cppDir, "bfs.wasm.js").replace(/\\/g, "/");
const wasmBinaryPath = path.join(cppDir, "bfs.wasm.wasm").replace(/\\/g, "/");

// Define common Emscripten arguments
const commonArgs = [
  "-s WASM=1",
  "-s ALLOW_MEMORY_GROWTH=1",
  "-s EXPORTED_RUNTIME_METHODS=['ccall','cwrap']",
  "-s EXPORT_ES6=1",
  "-s EXPORT_NAME=createBfsModule",
  "-s ENVIRONMENT=web,worker",
  "--bind",
  "--no-entry",
];

// Define debug-specific arguments
const debugArgs = [
  ...commonArgs,
  "-O0",
  "-g3",
  "-s ASSERTIONS=2",
  "-s SAFE_HEAP=1",
  "-s STACK_OVERFLOW_CHECK=2",
  "-s DEMANGLE_SUPPORT=1",
  "-s TOTAL_MEMORY=67108864",
];

// Define release-specific arguments
const releaseArgs = [
  ...commonArgs,
  "-O3",
  "-flto",
  "-fno-rtti",
  "-fno-exceptions",
  "-DEMSCRIPTEN_HAS_UNBOUND_TYPE_NAMES=0",
  "-s ASSERTIONS=1",
  "-s INITIAL_MEMORY=16MB",
  "-s TOTAL_STACK=2MB",
  "-s MALLOC=emmalloc",
  "-s SUPPORT_ERRNO=0",
  "-s NO_FILESYSTEM=1",
  "-s DISABLE_EXCEPTION_CATCHING=1",
  "-s ELIMINATE_DUPLICATE_FUNCTIONS=1",
  "-s AGGRESSIVE_VARIABLE_ELIMINATION=1",
  "-s ALLOW_UNIMPLEMENTED_SYSCALLS=0",
  "-s ERROR_ON_UNDEFINED_SYMBOLS=0",
  "--closure 0",
];

// Select build arguments based on mode
const buildArgs = isDebug ? debugArgs : releaseArgs;

// Include path for vcpkg dependencies if available
const vcpkgRoot = process.env.VCPKG_ROOT;
if (vcpkgRoot) {
  buildArgs.push(`-I "${vcpkgRoot}/installed/wasm32-emscripten/include"`);
}

// Build the command
const command = `emcc -std=c++17 ${sourceFiles.join(
  " "
)} -o "${wasmOutputPath}" ${buildArgs.join(" ")}`;

console.log("Compiling C++ to WebAssembly...");
console.log(command);

try {
  execSync(command, { stdio: "inherit" });
  console.log("Successfully compiled C++ to WebAssembly!");

  // Copy the generated .wasm file to the public directory to ensure it's accessible
  const publicDir = path.join(__dirname, "public");
  const distDir = path.join(__dirname, "dist");

  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  if (fs.existsSync(wasmBinaryPath)) {
    // Copy to public directory for development
    fs.copyFileSync(wasmBinaryPath, path.join(publicDir, "bfs.wasm"));
    console.log("Copied WASM file to public directory for serving");

    // Copy to dist directory if it exists (for production builds)
    if (fs.existsSync(distDir)) {
      if (!fs.existsSync(path.join(distDir, "assets"))) {
        fs.mkdirSync(path.join(distDir, "assets"), { recursive: true });
      }
      fs.copyFileSync(wasmBinaryPath, path.join(distDir, "assets", "bfs.wasm"));
      fs.copyFileSync(wasmBinaryPath, path.join(distDir, "bfs.wasm"));
      console.log("Copied WASM file to dist directory for production");
    }
  } else {
    console.error(`WASM binary not found at ${wasmBinaryPath}`);
  }

  // Display file sizes
  console.log("📊 Build size:");
  [wasmOutputPath, wasmBinaryPath].forEach((file) => {
    if (fs.existsSync(file)) {
      const stats = fs.statSync(file);
      console.log(`- ${file}: ${(stats.size / 1024).toFixed(2)} KB`);
    } else {
      console.log(`- ${file}: File not found`);
    }
  });
} catch (error) {
  console.error("Failed to compile C++ to WebAssembly:", error);
  process.exit(1);
}
