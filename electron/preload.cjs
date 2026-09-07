const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('nodeDriverDesktop', {
  platform: process.platform,
});

window.addEventListener('DOMContentLoaded', () => {
  document.documentElement.classList.add('electron');
  document.documentElement.classList.add(`platform-${process.platform}`);
});
