import { defineConfig } from "vite";

export default defineConfig({
  base: "/schedule-I-calculator/",
  build: {
    outDir: "dist",
    sourcemap: true,
    target: "esnext",
    rollupOptions: {
      input: "index.html",
      output: {
        entryFileNames: "index.js",
        assetFileNames: "style.css",
        format: "es",
      },
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: "modern-compiler", // or "modern"
      },
    },
  },
});
