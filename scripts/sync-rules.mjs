// Single source of truth: src/rules/rules.json. Copy it to public/ so a deployed
// copy can be replaced without rebuilding the app.
import fs from "node:fs";
fs.mkdirSync("public/rules", { recursive: true });
fs.copyFileSync("src/rules/rules.json", "public/rules/rules.json");
console.log("rules synced");
