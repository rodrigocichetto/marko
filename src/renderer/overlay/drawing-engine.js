// Drawing Engine for Screen Annotator
class DrawingEngine {
  constructor() {
    this.canvas = document.getElementById('drawing-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.laserPointer = document.getElementById('laser-pointer');
    this.container = document.getElementById('canvas-container');

    // Drawing state
    this.isDrawing = false;
    this.currentTool = null; // No tool selected initially
    this.currentColor = '#ff0000';
    this.currentStrokeWidth = 3;
    this.drawingEnabled = false; // Disabled until a tool is selected

    // History for undo/redo
    this.history = [];
    this.historyIndex = -1;
    this.maxHistory = 50;

    // Current shape being drawn
    this.startPoint = null;
    this.currentPath = [];

    // Initialize
    this.setupCanvas();
    this.bindEvents();
    this.setupIPC();
    this.saveState();
  }

  setupCanvas() {
    // Set canvas to full screen
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Set default styles
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.strokeStyle = this.currentColor;
    this.ctx.lineWidth = this.currentStrokeWidth;
  }

  resizeCanvas() {
    // Store current canvas content
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

    // Resize canvas
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    // Restore content
    this.ctx.putImageData(imageData, 0, 0);

    // Restore styles
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.strokeStyle = this.currentColor;
    this.ctx.lineWidth = this.currentStrokeWidth;
  }

  bindEvents() {
    // Mouse events
    this.canvas.addEventListener('mousedown', (e) => this.handlePointerDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handlePointerMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handlePointerUp(e));
    this.canvas.addEventListener('mouseleave', (e) => this.handlePointerUp(e));

    // Touch events for tablet support
    this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
    this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
    this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
    this.canvas.addEventListener('touchcancel', (e) => this.handleTouchEnd(e));

    // Prevent context menu
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setupIPC() {
    if (window.electronAPI) {
      window.electronAPI.onToolChanged((tool) => {
        this.setTool(tool);
      });

      window.electronAPI.onColorChanged((color) => {
        this.setColor(color);
      });

      window.electronAPI.onStrokeWidthChanged((width) => {
        this.setStrokeWidth(width);
      });

      window.electronAPI.onClearCanvas(() => {
        this.clearCanvas();
      });

      window.electronAPI.onUndo(() => {
        this.undo();
      });

      window.electronAPI.onRedo(() => {
        this.redo();
      });

      window.electronAPI.onDrawingModeChanged((enabled) => {
        this.setDrawingEnabled(enabled);
      });
    }
  }

  setTool(tool) {
    this.currentTool = tool;
    this.updateCursor();

    // Enable drawing when a tool is selected
    if (tool) {
      this.drawingEnabled = true;
      this.container.classList.remove('drawing-disabled');
    }

    // Hide laser pointer when switching tools
    if (tool !== 'pointer') {
      this.laserPointer.classList.remove('active');
    }
  }

  setColor(color) {
    this.currentColor = color;
    this.ctx.strokeStyle = color;
  }

  setStrokeWidth(width) {
    this.currentStrokeWidth = width;
    this.ctx.lineWidth = width;
  }

  setDrawingEnabled(enabled) {
    this.drawingEnabled = enabled;
    if (!enabled) {
      this.container.classList.add('drawing-disabled');
      this.laserPointer.classList.remove('active');
    } else {
      this.container.classList.remove('drawing-disabled');
    }
  }

  updateCursor() {
    // No cursor change if no tool selected
    if (!this.currentTool) {
      this.canvas.style.cursor = 'default';
      return;
    }

    // Set cursor directly via JavaScript for reliable updates
    switch (this.currentTool) {
      case 'pen':
      case 'rectangle':
      case 'circle':
      case 'arrow':
      case 'line':
        this.canvas.style.cursor = 'crosshair';
        break;
      case 'pointer':
        this.canvas.style.cursor = 'pointer';
        break;
      case 'eraser':
        // Create eraser cursor as encoded SVG
        const eraserSvg = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" fill="white" stroke="black" stroke-width="2"/></svg>');
        this.canvas.style.cursor = `url('data:image/svg+xml,${eraserSvg}') 12 12, auto`;
        break;
      default:
        this.canvas.style.cursor = 'crosshair';
    }
  }

  handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = {
      clientX: touch.clientX,
      clientY: touch.clientY,
      button: 0
    };
    this.handlePointerDown(mouseEvent);
  }

  handleTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = {
      clientX: touch.clientX,
      clientY: touch.clientY
    };
    this.handlePointerMove(mouseEvent);
  }

  handleTouchEnd(e) {
    e.preventDefault();
    this.handlePointerUp({});
  }

  handlePointerDown(e) {
    if (!this.drawingEnabled || !this.currentTool || e.button !== 0) return;

    this.isDrawing = true;
    const point = this.getPoint(e);
    this.startPoint = point;
    this.currentPath = [point];

    if (this.currentTool === 'pen' || this.currentTool === 'eraser') {
      this.ctx.beginPath();
      this.ctx.moveTo(point.x, point.y);

      if (this.currentTool === 'eraser') {
        this.ctx.globalCompositeOperation = 'destination-out';
        this.ctx.lineWidth = this.currentStrokeWidth * 5;
      } else {
        this.ctx.globalAlpha = 1;
        this.ctx.lineWidth = this.currentStrokeWidth;
      }
    } else if (this.currentTool === 'pointer') {
      this.laserPointer.style.left = point.x + 'px';
      this.laserPointer.style.top = point.y + 'px';
      this.laserPointer.classList.add('active');
    }
  }

  handlePointerMove(e) {
    const point = this.getPoint(e);

    if (this.currentTool === 'pointer') {
      this.laserPointer.style.left = point.x + 'px';
      this.laserPointer.style.top = point.y + 'px';
      if (this.isDrawing) {
        this.laserPointer.classList.add('active');
      }
      return;
    }

    if (!this.isDrawing) return;

    if (this.currentTool === 'pen' || this.currentTool === 'eraser') {
      this.currentPath.push(point);
      this.ctx.lineTo(point.x, point.y);
      this.ctx.stroke();
    } else if (this.currentTool === 'rectangle' || this.currentTool === 'circle' ||
               this.currentTool === 'arrow' || this.currentTool === 'line') {
      // Redraw canvas from history and draw preview
      this.redrawFromHistory();
      this.drawShapePreview(this.startPoint, point);
    }
  }

  handlePointerUp(e) {
    if (!this.isDrawing) return;

    const point = this.getPoint(e);

    if (this.currentTool === 'pen') {
      this.ctx.globalAlpha = 1;
      this.ctx.lineWidth = this.currentStrokeWidth;
      this.saveState();
    } else if (this.currentTool === 'eraser') {
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.lineWidth = this.currentStrokeWidth;
      this.saveState();
    } else if (this.currentTool === 'rectangle') {
      this.redrawFromHistory();
      this.drawRectangle(this.startPoint, point);
      this.saveState();
    } else if (this.currentTool === 'circle') {
      this.redrawFromHistory();
      this.drawEllipse(this.startPoint, point);
      this.saveState();
    } else if (this.currentTool === 'arrow') {
      this.redrawFromHistory();
      this.drawArrow(this.startPoint, point);
      this.saveState();
    } else if (this.currentTool === 'line') {
      this.redrawFromHistory();
      this.drawLine(this.startPoint, point);
      this.saveState();
    } else if (this.currentTool === 'pointer') {
      this.laserPointer.classList.remove('active');
    }

    this.isDrawing = false;
    this.startPoint = null;
    this.currentPath = [];
  }

  getPoint(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX || 0) - rect.left,
      y: (e.clientY || 0) - rect.top
    };
  }

  drawShapePreview(start, end) {
    this.ctx.strokeStyle = this.currentColor;
    this.ctx.lineWidth = this.currentStrokeWidth;
    this.ctx.globalAlpha = 0.5;

    switch (this.currentTool) {
      case 'rectangle':
        this.drawRectangle(start, end);
        break;
      case 'circle':
        this.drawEllipse(start, end);
        break;
      case 'arrow':
        this.drawArrow(start, end);
        break;
      case 'line':
        this.drawLine(start, end);
        break;
    }

    this.ctx.globalAlpha = 1;
  }

  drawRectangle(start, end) {
    const width = end.x - start.x;
    const height = end.y - start.y;

    this.ctx.strokeStyle = this.currentColor;
    this.ctx.lineWidth = this.currentStrokeWidth;
    this.ctx.beginPath();
    this.ctx.rect(start.x, start.y, width, height);
    this.ctx.stroke();
  }

  drawEllipse(start, end) {
    const centerX = (start.x + end.x) / 2;
    const centerY = (start.y + end.y) / 2;
    const radiusX = Math.abs(end.x - start.x) / 2;
    const radiusY = Math.abs(end.y - start.y) / 2;

    this.ctx.strokeStyle = this.currentColor;
    this.ctx.lineWidth = this.currentStrokeWidth;
    this.ctx.beginPath();
    this.ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
    this.ctx.stroke();
  }

  drawLine(start, end) {
    this.ctx.strokeStyle = this.currentColor;
    this.ctx.lineWidth = this.currentStrokeWidth;
    this.ctx.beginPath();
    this.ctx.moveTo(start.x, start.y);
    this.ctx.lineTo(end.x, end.y);
    this.ctx.stroke();
  }

  drawArrow(start, end) {
    const headLength = Math.max(15, this.currentStrokeWidth * 5);
    const angle = Math.atan2(end.y - start.y, end.x - start.x);

    this.ctx.strokeStyle = this.currentColor;
    this.ctx.fillStyle = this.currentColor;
    this.ctx.lineWidth = this.currentStrokeWidth;

    // Calculate where the line should stop (at the base of the arrowhead)
    const lineEndX = end.x - headLength * Math.cos(angle);
    const lineEndY = end.y - headLength * Math.sin(angle);

    // Draw line (stopping at the base of the arrowhead)
    this.ctx.beginPath();
    this.ctx.moveTo(start.x, start.y);
    this.ctx.lineTo(lineEndX, lineEndY);
    this.ctx.stroke();

    // Draw arrowhead
    this.ctx.beginPath();
    this.ctx.moveTo(end.x, end.y);
    this.ctx.lineTo(
      end.x - headLength * Math.cos(angle - Math.PI / 6),
      end.y - headLength * Math.sin(angle - Math.PI / 6)
    );
    this.ctx.lineTo(
      end.x - headLength * Math.cos(angle + Math.PI / 6),
      end.y - headLength * Math.sin(angle + Math.PI / 6)
    );
    this.ctx.closePath();
    this.ctx.fill();
  }

  saveState() {
    // Remove any states after current index (for redo functionality)
    this.history = this.history.slice(0, this.historyIndex + 1);

    // Save current canvas state
    const imageData = this.canvas.toDataURL();
    this.history.push(imageData);

    // Limit history size
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }
  }

  redrawFromHistory() {
    if (this.historyIndex >= 0 && this.history[this.historyIndex]) {
      const img = new Image();
      img.src = this.history[this.historyIndex];
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(img, 0, 0);
    } else {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.redrawFromHistory();
    } else if (this.historyIndex === 0) {
      this.historyIndex = -1;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.redrawFromHistory();
    }
  }

  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.saveState();
  }
}

// Initialize drawing engine when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.drawingEngine = new DrawingEngine();
});
