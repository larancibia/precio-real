// extension/config.js
// Loaded as the FIRST content script and via popup.html — exposes a single
// API_BASE so we don't have to grep two files when the prod URL changes.
(function () {
  const API_BASE = "https://preciorreal.com";
  if (typeof window !== "undefined") {
    window.PrecioRealConfig = { API_BASE };
  }
  if (typeof self !== "undefined" && typeof window === "undefined") {
    // Service worker context (background.js will use this via importScripts).
    self.PrecioRealConfig = { API_BASE };
  }
})();
