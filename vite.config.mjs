import { defineConfig } from "vite";
export default defineConfig({ root: "v2", base: "./", publicDir: "../public", build: { outDir: "../dist", emptyOutDir: true } });
