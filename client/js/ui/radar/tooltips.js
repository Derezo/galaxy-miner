// Galaxy Miner - Radar Tooltips System
// Hover-for-details feature (Tier 4+)

const RadarTooltips = {
  canvas: null,
  ctx: null,
  tooltip: null,
  hoveredEntity: null,
  center: 75,
  scale: 1,
  radarRange: 500,
  playerPos: { x: 0, y: 0 },

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.center = canvas.width / 2;

    // Create tooltip element
    this.createTooltipElement();

    // Add mouse event listeners
    canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    canvas.addEventListener('mouseleave', () => this.hideTooltip());
  },

  createTooltipElement() {
    // Check if tooltip already exists
    if (document.getElementById('radar-tooltip')) {
      this.tooltip = document.getElementById('radar-tooltip');
      return;
    }

    this.tooltip = document.createElement('div');
    this.tooltip.id = 'radar-tooltip';
    this.tooltip.style.cssText = `
      position: fixed;
      background: rgba(0, 0, 20, 0.9);
      border: 1px solid #00aaff;
      border-radius: 4px;
      padding: 6px 10px;
      font-size: 11px;
      color: #ffffff;
      pointer-events: none;
      z-index: 1000;
      display: none;
      max-width: 150px;
      font-family: 'Courier New', monospace;
    `;
    document.body.appendChild(this.tooltip);
  },

  // Update scale and range for current frame
  updateParams(center, scale, radarRange, playerPos) {
    this.center = center;
    this.scale = scale;
    this.radarRange = radarRange;
    this.playerPos = playerPos;
  },

  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Convert mouse position to world coordinates
    const worldX = this.playerPos.x + (mouseX - this.center) / this.scale;
    const worldY = this.playerPos.y + (mouseY - this.center) / this.scale;

    // Find closest entity within hover distance (10 pixels on radar)
    const hoverRadius = 10 / this.scale;
    const entity = this.findEntityAt(worldX, worldY, hoverRadius);

    if (entity) {
      this.showTooltip(e.clientX, e.clientY, entity);
      this.hoveredEntity = entity;
    } else {
      this.hideTooltip();
      this.hoveredEntity = null;
    }
  },

  findEntityAt(worldX, worldY, radius) {
    // Check NPCs
    if (typeof Entities !== 'undefined' && Entities.npcs) {
      for (const [id, npc] of Entities.npcs) {
        const dist = RadarBaseRenderer.getDistance(worldX, worldY, npc.position.x, npc.position.y);
        if (dist <= radius) {
          return { type: 'npc', data: npc };
        }
      }
    }

    // Check players
    if (typeof Entities !== 'undefined' && Entities.players) {
      for (const [id, player] of Entities.players) {
        const dist = RadarBaseRenderer.getDistance(worldX, worldY, player.position.x, player.position.y);
        if (dist <= radius) {
          return { type: 'player', data: player };
        }
      }
    }

    // Check bases
    if (typeof Entities !== 'undefined' && Entities.bases) {
      for (const [id, base] of Entities.bases) {
        const dist = RadarBaseRenderer.getDistance(worldX, worldY, base.position.x, base.position.y);
        if (dist <= radius + 50) { // Bases are larger
          return { type: 'base', data: base };
        }
      }
    }

    // Check wreckage
    if (typeof Entities !== 'undefined' && Entities.wreckage) {
      for (const [id, wreck] of Entities.wreckage) {
        const dist = RadarBaseRenderer.getDistance(worldX, worldY, wreck.position.x, wreck.position.y);
        if (dist <= radius) {
          return { type: 'wreckage', data: wreck };
        }
      }
    }

    return null;
  },

  showTooltip(x, y, entity) {
    if (!this.tooltip) return;

    const content = this.formatTooltip(entity);
    this.tooltip.innerHTML = content;
    this.tooltip.style.display = 'block';

    // Position tooltip near cursor, keeping it on screen
    const tooltipRect = this.tooltip.getBoundingClientRect();
    let left = x + 15;
    let top = y + 15;

    if (left + tooltipRect.width > window.innerWidth) {
      left = x - tooltipRect.width - 15;
    }
    if (top + tooltipRect.height > window.innerHeight) {
      top = y - tooltipRect.height - 15;
    }

    this.tooltip.style.left = left + 'px';
    this.tooltip.style.top = top + 'px';
  },

  hideTooltip() {
    if (this.tooltip) {
      this.tooltip.style.display = 'none';
    }
  },

  formatTooltip(entity) {
    const { type, data } = entity;
    let html = '';

    // Calculate distance to player
    const distance = Math.round(RadarBaseRenderer.getDistance(
      this.playerPos.x, this.playerPos.y,
      data.position.x, data.position.y
    ));

    switch (type) {
      case 'npc':
        const npcHullPercent = Math.round((data.hull / (data.hullMax || 100)) * 100);
        const factionColor = CONSTANTS.FACTION_RADAR_COLORS[data.faction] || '#ff4444';
        html = `
          <div style="color: ${factionColor}; font-weight: bold;">${data.name || data.type}</div>
          <div style="margin-top: 4px;">
            <div>Hull: ${this.formatHealthBar(npcHullPercent, '#ff4444')}</div>
            ${data.shield > 0 ? `<div>Shield: ${this.formatHealthBar(Math.round((data.shield / (data.shieldMax || 50)) * 100), '#00aaff')}</div>` : ''}
          </div>
          <div style="color: #888; margin-top: 4px;">${distance}u away</div>
        `;
        break;

      case 'player':
        html = `
          <div style="color: #00ff00; font-weight: bold;">${data.username}</div>
          <div style="margin-top: 4px;">
            <div>Hull: ${this.formatHealthBar(Math.round((data.hull / 100) * 100), '#ff4444')}</div>
            <div>Shield: ${this.formatHealthBar(Math.round((data.shield / 50) * 100), '#00aaff')}</div>
          </div>
          <div style="color: #888; margin-top: 4px;">${distance}u away</div>
        `;
        break;

      case 'base':
        const baseColor = CONSTANTS.FACTION_RADAR_COLORS[data.faction] || '#ff4444';
        const baseHullPercent = Math.round((data.health / (data.maxHealth || 1000)) * 100);
        html = `
          <div style="color: ${baseColor}; font-weight: bold;">${data.name || data.type}</div>
          <div style="margin-top: 4px;">
            <div>Health: ${this.formatHealthBar(baseHullPercent, baseColor)}</div>
          </div>
          <div style="color: #888; margin-top: 4px;">${distance}u away</div>
        `;
        break;

      case 'wreckage':
        html = `
          <div style="color: #ffcc00; font-weight: bold;">Wreckage</div>
          <div style="margin-top: 4px;">From: ${data.npcName || 'Unknown'}</div>
          <div>Items: ${data.contentCount || 0}</div>
          <div style="color: #888; margin-top: 4px;">${distance}u away</div>
        `;
        break;
    }

    return html;
  },

  formatHealthBar(percent, color) {
    const width = 60;
    const filled = Math.round((percent / 100) * width);
    return `<span style="display: inline-block; width: ${width}px; height: 6px; background: #333; border-radius: 2px; overflow: hidden;">
      <span style="display: block; width: ${filled}px; height: 100%; background: ${color};"></span>
    </span> <span style="font-size: 10px;">${percent}%</span>`;
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.RadarTooltips = RadarTooltips;
}
