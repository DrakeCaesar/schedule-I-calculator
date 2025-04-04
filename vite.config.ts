import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    target: "esnext",
    sourcemap: true,
    // Set WASM as external assets
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        manualChunks: {
          wasm: ["./src/cpp/bfs.wasm.js"],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Don't try to optimize WASM modules
  optimizeDeps: {
    exclude: ["./src/cpp/bfs.wasm.js"],
  },
  // Handle WebAssembly files correctly
  assetsInclude: ["**/*.wasm"],
  // Ensure proper file serving during development
  server: {
    fs: {
      // Allow serving files from this project directory
      allow: ["."],
      strict: false,
    },
    headers: {
      // Required for proper WASM loading
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  // Properly handle static assets
  publicDir: "public",
});
