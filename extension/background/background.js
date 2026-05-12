// Service worker como ES module (manifest declara type: "module").
// browser.* es el namespace nativo de Firefox; Chrome expone chrome.*.
// Firefox MV3 soporta chrome.* como compat layer, pero preferimos browser.*
// cuando existe para evitar quirks futuros.
const api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

api.runtime.onInstalled.addListener(() => {
  console.log('[Precio Real] background installed');
});
