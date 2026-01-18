// Settings Window Controller
class SettingsController {
  constructor() {
    this.currentTheme = 'system';
    this.init();
  }

  async init() {
    this.initTheme();
    this.bindEvents();
    this.setupIPC();
  }

  initTheme() {
    // Get saved theme
    const savedTheme = localStorage.getItem('toolbar-theme') || 'system';
    this.currentTheme = savedTheme;

    // Apply theme
    if (savedTheme === 'system') {
      this.applySystemTheme();
    } else {
      this.applyTheme(savedTheme);
    }

    // Update select value
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
      themeSelect.value = savedTheme;
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

    // Apply theme locally
    if (theme === 'system') {
      this.applySystemTheme();
    } else {
      this.applyTheme(theme);
    }

    // Notify main process to update toolbar
    if (window.electronAPI) {
      window.electronAPI.setTheme(theme);
    }
  }

  switchPage(pageName) {
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === pageName);
    });

    // Update pages
    document.querySelectorAll('.page').forEach(page => {
      page.classList.toggle('active', page.id === `page-${pageName}`);
    });
  }

  bindEvents() {
    // Navigation items
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        this.switchPage(item.dataset.page);
      });
    });

    // Theme select
    document.getElementById('theme-select').addEventListener('change', (e) => {
      this.setTheme(e.target.value);
    });

    // Close button
    document.getElementById('close-btn').addEventListener('click', () => {
      if (window.electronAPI) {
        window.electronAPI.closeSettingsWindow();
      }
    });

    // Author link
    document.getElementById('author-link').addEventListener('click', (e) => {
      e.preventDefault();
      if (window.electronAPI) {
        window.electronAPI.openExternal('https://cichetto.com.br');
      }
    });

    // Website link
    document.getElementById('website-link').addEventListener('click', (e) => {
      e.preventDefault();
      if (window.electronAPI) {
        window.electronAPI.openExternal('https://markoscreen.app');
      }
    });
  }

  setupIPC() {
    if (window.electronAPI) {
      // Listen for theme sync from toolbar
      window.electronAPI.onThemeSync((theme) => {
        this.currentTheme = theme;
        if (theme === 'system') {
          this.applySystemTheme();
        } else {
          this.applyTheme(theme);
        }
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
          themeSelect.value = theme;
        }
      });
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.settingsController = new SettingsController();
});
