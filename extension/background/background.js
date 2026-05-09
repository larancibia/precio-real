// Service worker como ES module (manifest declara type: "module").
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Precio Real] background installed');
});
