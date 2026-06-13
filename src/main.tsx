import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/offline-map-sw.js").catch((error) => {
      console.warn("Offline map service worker registration failed:", error);
    });
  });
}
