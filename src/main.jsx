import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(<App />);

// Installable, works offline once opened. A new build is announced to the user, never forced.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").then((reg) => {
      const announce = () => window.dispatchEvent(new Event("ak-sw-update"));
      if (reg.waiting && navigator.serviceWorker.controller) announce();
      reg.addEventListener("updatefound", () => {
        const w = reg.installing;
        w?.addEventListener("statechange", () => {
          if (w.state === "installed" && navigator.serviceWorker.controller) announce();
        });
      });
    }).catch(() => {});
  });
}
