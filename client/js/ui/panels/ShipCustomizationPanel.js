/**
 * ShipCustomizationPanel Component
 * Color picker for ship customization with live preview canvas.
 */

const ShipCustomizationPanel = {
  // Component state
  selectedColorId: null,
  previewCanvas: null,
  previewCtx: null,

  /**
   * Initialize the customization panel
   */
  init() {
    this.selectedColorId = Player.colorId || 'green';
  },

  /**
   * Render the customization panel content
   * @param {HTMLElement} container - Container element to render into
   */
  render(container = null) {
    const targetContainer = container || document.getElementById('customize-content');
    if (!targetContainer) return;

    const colorOptions = CONSTANTS.PLAYER_COLOR_OPTIONS || [];
    const currentColor = Player.colorId || 'green';

    // Sync selectedColorId with player's actual color on render
    this.selectedColorId = currentColor;

    const html = `
      <div class="customize-panel">
        <div class="customize-section">
          <h3 class="customize-title">Ship Color</h3>
          <div class="color-preview-container">
            <canvas id="ship-preview-canvas" width="120" height="120"></canvas>
          </div>
          <div class="color-options">
            ${colorOptions.map(color => this._renderColorOption(color, currentColor)).join('')}
          </div>
        </div>
      </div>
    `;

    targetContainer.innerHTML = html;
    this._bindEvents(targetContainer);
    this._initPreviewCanvas();
    this._drawShipPreview();
  },

  /**
   * Render a single color option
   * @param {Object} color - Color option from CONSTANTS
   * @param {string} currentColor - Currently selected color ID
   */
  _renderColorOption(color, currentColor) {
    const isSelected = color.id === currentColor;
    return `
      <div class="color-option ${isSelected ? 'selected' : ''}"
           data-color-id="${color.id}"
           title="${color.name}">
        <div class="color-swatch" style="background: ${color.primary}; box-shadow: 0 0 8px ${color.glow};"></div>
        <div class="color-name">${color.name}</div>
      </div>
    `;
  },

  /**
   * Bind event handlers
   * @param {HTMLElement} container - Container element
   */
  _bindEvents(container) {
    // Color option clicks
    container.querySelectorAll('.color-option').forEach(option => {
      option.addEventListener('click', () => {
        const colorId = option.dataset.colorId;
        this._selectColor(colorId, container);
      });
    });
  },

  /**
   * Select a color and update preview
   * @param {string} colorId - Color ID to select
   * @param {HTMLElement} container - Container for re-rendering selection state
   */
  _selectColor(colorId, container) {
    this.selectedColorId = colorId;

    // Update selection visual
    container.querySelectorAll('.color-option').forEach(opt => {
      opt.classList.toggle('selected', opt.dataset.colorId === colorId);
    });

    // Update preview
    this._drawShipPreview();

    // Send to server
    Network.sendSetColor(colorId);
  },

  /**
   * Initialize the preview canvas
   */
  _initPreviewCanvas() {
    this.previewCanvas = document.getElementById('ship-preview-canvas');
    if (this.previewCanvas) {
      this.previewCtx = this.previewCanvas.getContext('2d');
    }
  },

  /**
   * Draw ship preview with current color
   */
  _drawShipPreview() {
    if (!this.previewCtx || !this.previewCanvas) return;

    const ctx = this.previewCtx;
    const width = this.previewCanvas.width;
    const height = this.previewCanvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    // Clear canvas
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, width, height);

    // Get color palette
    const colorId = this.selectedColorId || Player.colorId || 'green';
    const colorOption = (CONSTANTS.PLAYER_COLOR_OPTIONS || []).find(c => c.id === colorId);
    const primary = colorOption ? colorOption.primary : '#00ff00';
    const accent = colorOption ? colorOption.accent : '#00cc00';
    const glow = colorOption ? colorOption.glow : '#00ff0060';

    // Draw glow effect
    const glowGradient = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, 50);
    glowGradient.addColorStop(0, glow);
    glowGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 50, 0, Math.PI * 2);
    ctx.fill();

    // Draw ship shape (facing right, rotated to face up for preview)
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(-Math.PI / 2); // Face upward

    const size = 30;

    // Create gradient for hull
    const hullGradient = ctx.createLinearGradient(-size * 0.7, 0, size, 0);
    hullGradient.addColorStop(0, accent);
    hullGradient.addColorStop(0.4, primary);
    hullGradient.addColorStop(1, this._lightenColor(primary, 1.2));

    // Draw ship path (tier 3 style)
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(size * 0.3, -size * 0.2);
    ctx.lineTo(-size * 0.4, -size * 0.8);
    ctx.lineTo(-size * 0.6, -size * 0.5);
    ctx.lineTo(-size * 0.5, 0);
    ctx.lineTo(-size * 0.6, size * 0.5);
    ctx.lineTo(-size * 0.4, size * 0.8);
    ctx.lineTo(size * 0.3, size * 0.2);
    ctx.closePath();

    ctx.fillStyle = hullGradient;
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw cockpit
    ctx.beginPath();
    ctx.moveTo(size * 0.6, 0);
    ctx.lineTo(size * 0.2, -size * 0.12);
    ctx.lineTo(size * 0.05, 0);
    ctx.lineTo(size * 0.2, size * 0.12);
    ctx.closePath();
    ctx.fillStyle = this._lightenColor(primary, 1.3);
    ctx.fill();

    ctx.restore();

    // Draw border
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, width, height);
  },

  /**
   * Lighten a hex color
   * @param {string} hex - Hex color
   * @param {number} factor - Brightness factor
   * @returns {string} Lightened color
   */
  _lightenColor(hex, factor) {
    const cleanHex = hex.replace('#', '');
    let r = parseInt(cleanHex.substring(0, 2), 16);
    let g = parseInt(cleanHex.substring(2, 4), 16);
    let b = parseInt(cleanHex.substring(4, 6), 16);

    r = Math.min(255, Math.round(r * factor));
    g = Math.min(255, Math.round(g * factor));
    b = Math.min(255, Math.round(b * factor));

    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  },

  /**
   * Refresh the panel (called when player data changes)
   */
  refresh() {
    this.selectedColorId = Player.colorId || 'green';
    this.render();
  }
};
