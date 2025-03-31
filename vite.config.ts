import { defineConfig } from "vite";

export default defineConfig({
  base: "/scheduleI/",
  build: {
    outDir: "dist",
    sourcemap: true,
    target: "esnext",
    rollupOptions: {
      input: "index.html",
      output: {
        entryFileNames: "index.js",
        assetFileNames: "styles.css",
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
