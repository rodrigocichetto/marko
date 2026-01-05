const { app, BrowserWindow, ipcMain, screen, globalShortcut, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

let overlayWindow = null;
let toolbarWindow = null;
let tray = null;
let isDrawingEnabled = false; // Disabled until a tool is selected
let currentSettings = {
  hideToolbarFromCapture: true,
  overlayVisible: true
};

// Platform-specific settings
const isMac = process.platform === 'darwin';
const isWindows = process.platform === 'win32';
const isLinux = process.platform === 'linux';

function createOverlayWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;

  overlayWindow = new BrowserWindow({
    x: 0,
    y: 0,
    width: width,
    height: height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: true,
    hasShadow: false,
    // Enable click-through when not drawing
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Set window level for overlay - use 'floating' so toolbar can be above it
  if (isMac) {
    overlayWindow.setAlwaysOnTop(true, 'floating');
    overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  } else if (isWindows) {
    overlayWindow.setAlwaysOnTop(true, 'floating');
  } else {
    overlayWindow.setAlwaysOnTop(true, 'floating');
  }

  overlayWindow.loadFile(path.join(__dirname, '../renderer/overlay/index.html'));

  // Make window click-through initially (no tool selected)
  overlayWindow.setIgnoreMouseEvents(true);

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

function createToolbarWindow() {
  toolbarWindow = new BrowserWindow({
    width: 1080,
    height: 100,
    x: Math.floor(screen.getPrimaryDisplay().bounds.width / 2 - 540),
    y: 30,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: false,
    hasShadow: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Set toolbar above overlay - use 'screen-saver' level (higher than 'floating')
  if (isMac) {
    toolbarWindow.setAlwaysOnTop(true, 'screen-saver');
    toolbarWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  } else if (isWindows) {
    toolbarWindow.setAlwaysOnTop(true, 'screen-saver');
  } else {
    toolbarWindow.setAlwaysOnTop(true, 'pop-up-menu');
  }

  // Hide toolbar from screen capture if supported
  if (currentSettings.hideToolbarFromCapture) {
    setToolbarContentProtection(true);
  }

  toolbarWindow.loadFile(path.join(__dirname, '../renderer/toolbar/index.html'));

  toolbarWindow.on('closed', () => {
    toolbarWindow = null;
  });
}

function setToolbarContentProtection(enabled) {
  if (!toolbarWindow) return;

  // setContentProtection hides window from screen capture
  // Available on macOS and Windows
  if (isMac || isWindows) {
    toolbarWindow.setContentProtection(enabled);
  }
}

function setupIPC() {
  // Tool selection from toolbar
  ipcMain.on('tool-selected', (event, tool) => {
    if (overlayWindow) {
      overlayWindow.webContents.send('tool-changed', tool);
    }
  });

  // Color selection
  ipcMain.on('color-selected', (event, color) => {
    if (overlayWindow) {
      overlayWindow.webContents.send('color-changed', color);
    }
  });

  // Stroke width selection
  ipcMain.on('stroke-width-selected', (event, width) => {
    if (overlayWindow) {
      overlayWindow.webContents.send('stroke-width-changed', width);
    }
  });

  // Clear canvas
  ipcMain.on('clear-canvas', () => {
    if (overlayWindow) {
      overlayWindow.webContents.send('clear-canvas');
    }
  });

  // Undo
  ipcMain.on('undo', () => {
    if (overlayWindow) {
      overlayWindow.webContents.send('undo');
    }
  });

  // Redo
  ipcMain.on('redo', () => {
    if (overlayWindow) {
      overlayWindow.webContents.send('redo');
    }
  });

  // Toggle drawing mode (click-through)
  ipcMain.on('toggle-drawing', (event, enabled) => {
    isDrawingEnabled = enabled;
    if (overlayWindow) {
      overlayWindow.setIgnoreMouseEvents(!enabled);
      overlayWindow.webContents.send('drawing-mode-changed', enabled);
    }
  });

  // Toggle overlay visibility
  ipcMain.on('toggle-overlay', (event, visible) => {
    currentSettings.overlayVisible = visible;
    if (overlayWindow) {
      if (visible) {
        overlayWindow.show();
      } else {
        overlayWindow.hide();
      }
    }
  });

  // Toggle hide toolbar from screen capture
  ipcMain.on('toggle-hide-from-capture', (event, enabled) => {
    currentSettings.hideToolbarFromCapture = enabled;
    setToolbarContentProtection(enabled);
  });

  // Move toolbar window
  ipcMain.on('move-toolbar', (event, { deltaX, deltaY }) => {
    if (toolbarWindow) {
      const [x, y] = toolbarWindow.getPosition();
      toolbarWindow.setPosition(x + deltaX, y + deltaY);
    }
  });

  // Get current settings
  ipcMain.handle('get-settings', () => {
    return currentSettings;
  });

  // Quit app
  ipcMain.on('quit-app', () => {
    app.quit();
  });
}

function setupGlobalShortcuts() {
  // Tool shortcuts (Ctrl/Cmd + Shift + Key)
  const toolShortcuts = {
    'P': 'pen',
    'R': 'rectangle',
    'O': 'circle',      // O for circle (C is taken by clear)
    'A': 'arrow',
    'L': 'line',
    'I': 'pointer',     // I for pointer
    'E': 'eraser'
  };

  Object.entries(toolShortcuts).forEach(([key, tool]) => {
    globalShortcut.register(`CommandOrControl+Shift+${key}`, () => {
      if (overlayWindow) {
        overlayWindow.webContents.send('tool-changed', tool);
      }
      if (toolbarWindow) {
        toolbarWindow.webContents.send('tool-selected-sync', tool);
      }
      // Enable drawing mode when selecting a tool
      if (!isDrawingEnabled) {
        isDrawingEnabled = true;
        if (overlayWindow) {
          overlayWindow.setIgnoreMouseEvents(false);
          overlayWindow.webContents.send('drawing-mode-changed', true);
        }
        if (toolbarWindow) {
          toolbarWindow.webContents.send('drawing-mode-sync', true);
        }
      }
    });
  });

  // Toggle drawing mode: Ctrl/Cmd + Shift + D
  globalShortcut.register('CommandOrControl+Shift+D', () => {
    isDrawingEnabled = !isDrawingEnabled;
    if (overlayWindow) {
      overlayWindow.setIgnoreMouseEvents(!isDrawingEnabled);
      overlayWindow.webContents.send('drawing-mode-changed', isDrawingEnabled);
    }
    if (toolbarWindow) {
      toolbarWindow.webContents.send('drawing-mode-sync', isDrawingEnabled);
    }
  });

  // Clear canvas: Ctrl/Cmd + Shift + C
  globalShortcut.register('CommandOrControl+Shift+C', () => {
    if (overlayWindow) {
      overlayWindow.webContents.send('clear-canvas');
    }
  });

  // Undo: Ctrl/Cmd + Z
  globalShortcut.register('CommandOrControl+Z', () => {
    if (overlayWindow && isDrawingEnabled) {
      overlayWindow.webContents.send('undo');
    }
  });

  // Redo: Ctrl/Cmd + Shift + Z
  globalShortcut.register('CommandOrControl+Shift+Z', () => {
    if (overlayWindow && isDrawingEnabled) {
      overlayWindow.webContents.send('redo');
    }
  });

  // Toggle overlay visibility: Ctrl/Cmd + Shift + H
  globalShortcut.register('CommandOrControl+Shift+H', () => {
    currentSettings.overlayVisible = !currentSettings.overlayVisible;
    if (overlayWindow) {
      if (currentSettings.overlayVisible) {
        overlayWindow.show();
      } else {
        overlayWindow.hide();
      }
    }
    if (toolbarWindow) {
      toolbarWindow.webContents.send('overlay-visibility-sync', currentSettings.overlayVisible);
    }
  });

  // Show/focus toolbar: Ctrl/Cmd + Shift + T
  globalShortcut.register('CommandOrControl+Shift+T', () => {
    if (toolbarWindow) {
      toolbarWindow.show();
      toolbarWindow.focus();
    }
  });
}

function createTray() {
  // Create a simple tray icon
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAADASURBVDiNpZMxDsIwDEXfT1mYGJiQGLgAV+AAXIMLcAAuwBWQmJiYmFg6wEBiCEtDKG3qSF6s/PdtJ7ZUChABT+AErIE3sAGSwAjYA0fgDuyAJ7AB6sAFuANH4AykwA4YAxegBrSAO5AAb2AGvIAFsAPqwB0YA28gBu7AC/gAUyAGtkAXSP4ZCVn1jqU87QF0gQXQB2ZAHxgCVaAKLIEJMAQGQA9YAj1gDByAPjABhsASWABDYA70gf+fzxeLQvT0dNHv1wAAAABJRU5ErkJggg=='
  );

  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Toolbar (Cmd+Shift+T)',
      click: () => {
        if (toolbarWindow) {
          toolbarWindow.show();
          toolbarWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Toggle Drawing',
      type: 'checkbox',
      checked: isDrawingEnabled,
      click: () => {
        isDrawingEnabled = !isDrawingEnabled;
        if (overlayWindow) {
          overlayWindow.setIgnoreMouseEvents(!isDrawingEnabled);
          overlayWindow.webContents.send('drawing-mode-changed', isDrawingEnabled);
        }
        if (toolbarWindow) {
          toolbarWindow.webContents.send('drawing-mode-sync', isDrawingEnabled);
        }
      }
    },
    {
      label: 'Show/Hide Overlay',
      click: () => {
        currentSettings.overlayVisible = !currentSettings.overlayVisible;
        if (overlayWindow) {
          if (currentSettings.overlayVisible) {
            overlayWindow.show();
          } else {
            overlayWindow.hide();
          }
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Clear Canvas',
      click: () => {
        if (overlayWindow) {
          overlayWindow.webContents.send('clear-canvas');
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit()
    }
  ]);

  tray.setToolTip('Screen Annotator');
  tray.setContextMenu(contextMenu);
}

app.whenReady().then(() => {
  createOverlayWindow();
  createToolbarWindow();
  setupIPC();
  setupGlobalShortcuts();
  createTray();

  // Handle screen changes (multi-monitor support) - must be inside whenReady
  screen.on('display-added', () => {
    if (overlayWindow) {
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.bounds;
      overlayWindow.setBounds({ x: 0, y: 0, width, height });
    }
  });

  screen.on('display-removed', () => {
    if (overlayWindow) {
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.bounds;
      overlayWindow.setBounds({ x: 0, y: 0, width, height });
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createOverlayWindow();
      createToolbarWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (!isMac) {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
