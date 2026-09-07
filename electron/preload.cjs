const { contextBridge, ipcRenderer } = require('electron');

/**
 * The renderer loads from file:// in a packaged build, so it CANNOT fetch the
 * local Alignment backend directly: cross-origin is blocked, and a JSON POST
 * would need a preflight the Express server does not answer. The main process
 * has no such restriction, so every backend call is relayed through it.
 */
contextBridge.exposeInMainWorld('nodeDriverDesktop', {
  platform: process.platform,
  /** Relay one HTTP request through the main process. */
  request: (options) => ipcRenderer.invoke('backend:request', options),
  /** The backend origin this desktop build talks to. */
  backendUrl: () => ipcRenderer.invoke('backend:url'),
});

window.addEventListener('DOMContentLoaded', () => {
  document.documentElement.classList.add('electron');
  document.documentElement.classList.add(`platform-${process.platform}`);
});
