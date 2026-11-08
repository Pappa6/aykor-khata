import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";

// Stamp the service worker with a build id so every deploy is detected as an update.
function stampServiceWorker() {
  return {
    name: "stamp-sw",
    closeBundle() {
      const p = "dist/sw.js";
      if (fs.existsSync(p)) {
        const assets = fs.existsSync("dist/assets") ? fs.readdirSync("dist/assets").map((f) => "./assets/" + f) : [];
        fs.writeFileSync(
          p,
          fs.readFileSync(p, "utf8").replace("__BUILD__", String(Date.now())).replace("__ASSETS__", JSON.stringify(assets)),
        );
      }
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), stampServiceWorker()],
  build: { target: "es2020", chunkSizeWarningLimit: 900 },
});
