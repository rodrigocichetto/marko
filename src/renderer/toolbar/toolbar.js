// Toolbar Controller for Screen Annotator
class ToolbarController {
  constructor() {
    this.currentTool = null; // No tool selected initially
    this.currentColor = '#ff0000';
    this.currentStrokeWidth = 4;
    this.drawingEnabled = false; // Disabled until a tool is selected
    this.hideFromCapture = true;
    this.currentTheme = 'system'; // 'light', 'dark', or 'system'
    this.init();
  }

  async init() {
    // Load saved settings
    if (window.electronAPI) {
      const settings = await window.electronAPI.getSettings();
      this.hideFromCapture = settings.hideToolbarFromCapture;
      if (settings.theme) {
        this.currentTheme = settings.theme;
      }
      this.updateToggleStates();
    }

    // Initialize theme
    this.initTheme();

    this.bindEvents();
    this.setupDrag();
    this.setupKeyboardShortcuts();
    this.setupIPC();
  }

  initTheme() {
    // Check for saved theme preference or use system preference
    const savedTheme = localStorage.getItem('toolbar-theme');

    if (savedTheme) {
      this.currentTheme = savedTheme;
    }

    // Apply the current theme
    if (this.currentTheme === 'system') {
      this.applySystemTheme();
    } else {
      this.applyTheme(this.currentTheme);
    }

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this.currentTheme === 'system') {
        this.applySystemTheme();
      }
    });
  }

  applySystemTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.applyTheme(prefersDark ? 'dark' : 'light');
  }

  applyTheme(theme) {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  setTheme(theme) {
    this.currentTheme = theme;

    // Save preference
    localStorage.setItem('toolbar-theme', theme);

    // Apply theme
    if (theme === 'system') {
      this.applySystemTheme();
    } else {
      this.applyTheme(theme);
    }
  }

  openSettings() {
    if (window.electronAPI) {
      window.electronAPI.openSettings();
    }
  }

  bindEvents() {
    // Tool buttons
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        this.selectTool(tool);
      });
    });

    // Color buttons
    document.querySelectorAll('.color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const color = btn.dataset.color;
        this.selectColor(color);
      });
    });

    // Stroke width buttons
    document.querySelectorAll('.stroke-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const width = parseInt(btn.dataset.width);
        this.selectStrokeWidth(width);
      });
    });

    // Action buttons
    document.getElementById('clear-btn').addEventListener('click', () => {
      if (window.electronAPI) {
        window.electronAPI.clearCanvas();
      }
    });

    // Toggle buttons
    document.getElementById('drawing-toggle').addEventListener('click', () => {
      this.toggleDrawing();
    });

    document.getElementById('hide-capture-toggle').addEventListener('click', () => {
      this.toggleHideFromCapture();
    });

    // Settings button
    document.getElementById('settings-btn').addEventListener('click', () => {
      this.openSettings();
    });

    // Close button
    document.getElementById('close-btn').addEventListener('click', () => {
      if (window.electronAPI) {
        window.electronAPI.quitApp();
      }
    });
  }

  setupDrag() {
    const toolbar = document.querySelector('.toolbar');
    let isDragging = false;
    let startX, startY;

    // Allow dragging from anywhere on the toolbar
    toolbar.addEventListener('mousedown', (e) => {
      // Don't start drag if clicking on a button
      if (e.target.closest('button')) return;

      isDragging = true;
      startX = e.screenX;
      startY = e.screenY;
      toolbar.style.cursor = 'grabbing';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const deltaX = e.screenX - startX;
      const deltaY = e.screenY - startY;

      startX = e.screenX;
      startY = e.screenY;

      if (window.electronAPI) {
        window.electronAPI.moveToolbar({ deltaX, deltaY });
      }
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        toolbar.style.cursor = 'grab';
      }
    });

    // Set initial cursor
    toolbar.style.cursor = 'grab';
  }

  setupKeyboardShortcuts() {
    // Keyboard shortcuts are now handled globally in main process
    // This method kept for potential future local shortcuts
  }

  setupIPC() {
    if (window.electronAPI) {
      // Sync drawing mode from main process
      window.electronAPI.onDrawingModeSync((enabled) => {
        this.drawingEnabled = enabled;
        this.updateDrawingToggle();
      });

      // Sync overlay visibility
      window.electronAPI.onOverlayVisibilitySync((visible) => {
        // Could update UI to show overlay state
      });

      // Sync tool selection from global shortcuts
      window.electronAPI.onToolSelectedSync((tool) => {
        this.currentTool = tool;
        this.drawingEnabled = true;
        this.updateDrawingToggle();
        // Update UI
        document.querySelectorAll('.tool-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.tool === tool);
        });
      });

      // Sync theme from settings window
      window.electronAPI.onThemeSync((theme) => {
        this.currentTheme = theme;
        localStorage.setItem('toolbar-theme', theme);
        if (theme === 'system') {
          this.applySystemTheme();
        } else {
          this.applyTheme(theme);
        }
      });
    }
  }

  selectTool(tool) {
    this.currentTool = tool;

    // Enable drawing when a tool is selected
    if (tool && !this.drawingEnabled) {
      this.drawingEnabled = true;
      this.updateDrawingToggle();
      if (window.electronAPI) {
        window.electronAPI.toggleDrawing(true);
      }
    }

    // Update UI
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });

    // Notify main process
    if (window.electronAPI) {
      window.electronAPI.selectTool(tool);
    }
  }

  selectColor(color) {
    this.currentColor = color;

    // Update UI
    document.querySelectorAll('.color-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.color === color);
    });

    // Notify main process
    if (window.electronAPI) {
      window.electronAPI.selectColor(color);
    }
  }

  selectStrokeWidth(width) {
    this.currentStrokeWidth = width;

    // Update UI
    document.querySelectorAll('.stroke-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.width) === width);
    });

    // Notify main process
    if (window.electronAPI) {
      window.electronAPI.selectStrokeWidth(width);
    }
  }

  toggleDrawing() {
    this.drawingEnabled = !this.drawingEnabled;
    this.updateDrawingToggle();

    if (window.electronAPI) {
      window.electronAPI.toggleDrawing(this.drawingEnabled);
    }
  }

  updateDrawingToggle() {
    const btn = document.getElementById('drawing-toggle');
    btn.classList.toggle('active', this.drawingEnabled);
  }

  toggleHideFromCapture() {
    this.hideFromCapture = !this.hideFromCapture;
    const btn = document.getElementById('hide-capture-toggle');
    btn.classList.toggle('active', this.hideFromCapture);

    if (window.electronAPI) {
      window.electronAPI.toggleHideFromCapture(this.hideFromCapture);
    }
  }

  updateToggleStates() {
    document.getElementById('hide-capture-toggle').classList.toggle('active', this.hideFromCapture);
  }
}

// Initialize toolbar controller when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.toolbarController = new ToolbarController();
});
