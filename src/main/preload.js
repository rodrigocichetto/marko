const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Send messages to main process
  selectTool: (tool) => ipcRenderer.send('tool-selected', tool),
  selectColor: (color) => ipcRenderer.send('color-selected', color),
  selectStrokeWidth: (width) => ipcRenderer.send('stroke-width-selected', width),
  selectTextMode: (mode) => ipcRenderer.send('text-mode-selected', mode),
  clearCanvas: () => ipcRenderer.send('clear-canvas'),
  undo: () => ipcRenderer.send('undo'),
  redo: () => ipcRenderer.send('redo'),
  toggleDrawing: (enabled) => ipcRenderer.send('toggle-drawing', enabled),
  toggleOverlay: (visible) => ipcRenderer.send('toggle-overlay', visible),
  toggleHideFromCapture: (enabled) => ipcRenderer.send('toggle-hide-from-capture', enabled),
  moveToolbar: (delta) => ipcRenderer.send('move-toolbar', delta),
  quitApp: () => ipcRenderer.send('quit-app'),

  // Get settings
  getSettings: () => ipcRenderer.invoke('get-settings'),

  // Listen for messages from main process
  onToolChanged: (callback) => {
    ipcRenderer.on('tool-changed', (event, tool) => callback(tool));
  },
  onColorChanged: (callback) => {
    ipcRenderer.on('color-changed', (event, color) => callback(color));
  },
  onStrokeWidthChanged: (callback) => {
    ipcRenderer.on('stroke-width-changed', (event, width) => callback(width));
  },
  onClearCanvas: (callback) => {
    ipcRenderer.on('clear-canvas', () => callback());
  },
  onUndo: (callback) => {
    ipcRenderer.on('undo', () => callback());
  },
  onRedo: (callback) => {
    ipcRenderer.on('redo', () => callback());
  },
  onDrawingModeChanged: (callback) => {
    ipcRenderer.on('drawing-mode-changed', (event, enabled) => callback(enabled));
  },
  onDrawingModeSync: (callback) => {
    ipcRenderer.on('drawing-mode-sync', (event, enabled) => callback(enabled));
  },
  onOverlayVisibilitySync: (callback) => {
    ipcRenderer.on('overlay-visibility-sync', (event, visible) => callback(visible));
  },
  onToolSelectedSync: (callback) => {
    ipcRenderer.on('tool-selected-sync', (event, tool) => callback(tool));
  },
  onTextModeChanged: (callback) => {
    ipcRenderer.on('text-mode-changed', (event, mode) => callback(mode));
  },
  onTextModeSync: (callback) => {
    ipcRenderer.on('text-mode-sync', (event, mode) => callback(mode));
  }
});
