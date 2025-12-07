// Ship Preview Canvas - Isometric ship renderer for upgrade panel
// Renders an isometric/pseudo-3D view of the player's ship with tier-based visual effects

const ShipPreviewCanvas = {
  canvas: null,
  ctx: null,
  animationId: null,
  shipData: null,

  // Colors for tier-based glow effects
  TIER_COLORS: {
    1: { primary: '#666666', glow: 'rgba(100, 100, 100, 0.3)' },
    2: { primary: '#4a9eff', glow: 'rgba(74, 158, 255, 0.4)' },
    3: { primary: '#9b4aff', glow: 'rgba(155, 74, 255, 0.5)' },
    4: { primary: '#ff9b4a', glow: 'rgba(255, 155, 74, 0.6)' },
    5: { primary: '#ff4a4a', glow: 'rgba(255, 74, 74, 0.7)' }
  },

  // Component visual positions (relative to ship center)
  COMPONENT_POSITIONS: {
    engine: { x: 0, y: 35, z: 0 },
    weapon: { x: 0, y: -25, z: 5 },
    shield: { x: 0, y: 0, z: 15 },
    mining: { x: 0, y: -35, z: -5 },
    cargo: { x: 0, y: 15, z: -10 },
    radar: { x: 0, y: -10, z: 20 },
    energy_core: { x: 0, y: 5, z: 0 },
    hull: { x: 0, y: 0, z: 0 }
  },

  /**
   * Initialize the ship preview canvas
   * @param {HTMLCanvasElement} canvas - The canvas element to render to
   */
  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.shipData = this._getDefaultShipData();
    this.time = 0;
  },

  /**
   * Update ship data from player state
   * @param {Object} tiers - Object with tier values for each component
   */
  updateShipData(tiers) {
    this.shipData = {
      engineTier: tiers.engineTier || tiers.engine_tier || 1,
      weaponTier: tiers.weaponTier || tiers.weapon_tier || 1,
      shieldTier: tiers.shieldTier || tiers.shield_tier || 1,
      miningTier: tiers.miningTier || tiers.mining_tier || 1,
      cargoTier: tiers.cargoTier || tiers.cargo_tier || 1,
      radarTier: tiers.radarTier || tiers.radar_tier || 1,
      energyCoreTier: tiers.energyCoreTier || tiers.energy_core_tier || 1,
      hullTier: tiers.hullTier || tiers.hull_tier || 1,
      color: tiers.color || '#00ffff'
    };
  },

  _getDefaultShipData() {
    return {
      engineTier: 1,
      weaponTier: 1,
      shieldTier: 1,
      miningTier: 1,
      cargoTier: 1,
      radarTier: 1,
      energyCoreTier: 1,
      hullTier: 1,
      color: '#00ffff'
    };
  },

  /**
   * Start the animation loop
   */
  startAnimation() {
    if (this.animationId) return;

    const animate = () => {
      this.time += 0.016; // ~60fps
      this.render();
      this.animationId = requestAnimationFrame(animate);
    };
    animate();
  },

  /**
   * Stop the animation loop
   */
  stopAnimation() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  },

  /**
   * Render the ship preview
   */
  render() {
    if (!this.ctx || !this.canvas) return;

    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background grid (subtle)
    this._drawGrid(ctx, width, height);

    // Draw ship components from back to front (painter's algorithm)
    this._drawShieldBubble(ctx, centerX, centerY);
    this._drawHullPlates(ctx, centerX, centerY);
    this._drawShipBody(ctx, centerX, centerY);
    this._drawEnergyCore(ctx, centerX, centerY);
    this._drawEngine(ctx, centerX, centerY);
    this._drawWeapon(ctx, centerX, centerY);
    this._drawMiningBeam(ctx, centerX, centerY);
    this._drawRadar(ctx, centerX, centerY);
    this._drawCargo(ctx, centerX, centerY);
  },

  _drawGrid(ctx, width, height) {
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.05)';
    ctx.lineWidth = 1;

    const gridSize = 20;
    const offsetX = (this.time * 5) % gridSize;

    for (let x = -gridSize + offsetX; x < width + gridSize; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + height * 0.3, height);
      ctx.stroke();
    }

    for (let y = 0; y < height + gridSize; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  },

  _drawShipBody(ctx, cx, cy) {
    const color = this.shipData.color || '#00ffff';
    const hullTier = this.shipData.hullTier;
    const tierColor = this.TIER_COLORS[hullTier];

    // Main hull shape - isometric diamond
    ctx.save();
    ctx.translate(cx, cy);

    // Outer glow based on hull tier
    if (hullTier > 1) {
      ctx.shadowColor = tierColor.glow;
      ctx.shadowBlur = 10 + hullTier * 3;
    }

    // Ship body
    ctx.beginPath();
    ctx.moveTo(0, -50);  // Nose
    ctx.lineTo(25, 0);   // Right wing
    ctx.lineTo(20, 40);  // Right back
    ctx.lineTo(0, 30);   // Center back
    ctx.lineTo(-20, 40); // Left back
    ctx.lineTo(-25, 0);  // Left wing
    ctx.closePath();

    // Fill with gradient
    const gradient = ctx.createLinearGradient(0, -50, 0, 40);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.5, this._shadeColor(color, -30));
    gradient.addColorStop(1, this._shadeColor(color, -50));

    ctx.fillStyle = gradient;
    ctx.fill();

    // Edge highlight
    ctx.strokeStyle = this._shadeColor(color, 30);
    ctx.lineWidth = 2;
    ctx.stroke();

    // Cockpit
    ctx.beginPath();
    ctx.ellipse(0, -20, 8, 15, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(100, 200, 255, 0.8)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(150, 220, 255, 1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  },

  _drawShieldBubble(ctx, cx, cy) {
    const tier = this.shipData.shieldTier;
    if (tier < 1) return;

    const tierColor = this.TIER_COLORS[tier];
    const pulse = Math.sin(this.time * 2) * 0.1 + 0.9;
    const radius = 60 + tier * 5;

    ctx.save();
    ctx.translate(cx, cy);

    // Shield bubble
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * pulse, radius * 0.7 * pulse, 0, 0, Math.PI * 2);

    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    gradient.addColorStop(0, 'rgba(0, 200, 255, 0)');
    gradient.addColorStop(0.7, `rgba(0, 200, 255, ${0.05 * tier})`);
    gradient.addColorStop(1, `rgba(0, 200, 255, ${0.15 * tier})`);

    ctx.fillStyle = gradient;
    ctx.fill();

    // Shield edge
    ctx.strokeStyle = `rgba(0, 200, 255, ${0.3 + tier * 0.1})`;
    ctx.lineWidth = 1 + tier * 0.5;
    ctx.setLineDash([5, 5]);
    ctx.lineDashOffset = -this.time * 20;
    ctx.stroke();
    ctx.setLineDash([]);

    // Hexagonal pattern for higher tiers
    if (tier >= 3) {
      this._drawHexPattern(ctx, radius * 0.8, tier);
    }

    ctx.restore();
  },

  _drawHexPattern(ctx, radius, tier) {
    const hexSize = 15;
    const rows = Math.floor(radius / hexSize);

    ctx.strokeStyle = `rgba(0, 200, 255, ${0.1 + tier * 0.05})`;
    ctx.lineWidth = 0.5;

    for (let row = -rows; row <= rows; row++) {
      for (let col = -rows; col <= rows; col++) {
        const x = col * hexSize * 1.5;
        const y = row * hexSize * Math.sqrt(3) + (col % 2) * hexSize * Math.sqrt(3) / 2;

        if (x * x + y * y < radius * radius * 0.6) {
          this._drawHexagon(ctx, x, y, hexSize * 0.5);
        }
      }
    }
  },

  _drawHexagon(ctx, x, y, size) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i * 60 - 30) * Math.PI / 180;
      const px = x + Math.cos(angle) * size;
      const py = y + Math.sin(angle) * size;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  },

  _drawHullPlates(ctx, cx, cy) {
    const tier = this.shipData.hullTier;
    if (tier < 2) return;

    const tierColor = this.TIER_COLORS[tier];

    ctx.save();
    ctx.translate(cx, cy);

    // Draw armor plates based on tier
    const plateCount = tier + 1;
    const plateAlpha = 0.3 + tier * 0.1;

    ctx.strokeStyle = tierColor.primary;
    ctx.lineWidth = 2;
    ctx.fillStyle = `rgba(100, 100, 120, ${plateAlpha})`;

    // Left armor plate
    ctx.beginPath();
    ctx.moveTo(-28, -10);
    ctx.lineTo(-35, 5);
    ctx.lineTo(-30, 25);
    ctx.lineTo(-22, 20);
    ctx.lineTo(-25, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Right armor plate
    ctx.beginPath();
    ctx.moveTo(28, -10);
    ctx.lineTo(35, 5);
    ctx.lineTo(30, 25);
    ctx.lineTo(22, 20);
    ctx.lineTo(25, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Front armor for tier 4+
    if (tier >= 4) {
      ctx.beginPath();
      ctx.moveTo(-10, -45);
      ctx.lineTo(10, -45);
      ctx.lineTo(8, -35);
      ctx.lineTo(-8, -35);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Draw rivets for tier 3+
    if (tier >= 3) {
      ctx.fillStyle = '#888888';
      const rivets = [
        [-30, 0], [-28, 15], [30, 0], [28, 15]
      ];
      rivets.forEach(([rx, ry]) => {
        ctx.beginPath();
        ctx.arc(rx, ry, 2, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    ctx.restore();
  },

  _drawEngine(ctx, cx, cy) {
    const tier = this.shipData.engineTier;
    const tierColor = this.TIER_COLORS[tier];

    ctx.save();
    ctx.translate(cx, cy + 35);

    // Engine housing
    ctx.fillStyle = '#333333';
    ctx.strokeStyle = tierColor.primary;
    ctx.lineWidth = 2;

    // Left engine
    ctx.beginPath();
    ctx.roundRect(-18, -5, 10, 15, 2);
    ctx.fill();
    ctx.stroke();

    // Right engine
    ctx.beginPath();
    ctx.roundRect(8, -5, 10, 15, 2);
    ctx.fill();
    ctx.stroke();

    // Engine flames
    const flameIntensity = 0.5 + Math.sin(this.time * 10) * 0.3;
    const flameLength = 10 + tier * 5 + Math.sin(this.time * 15) * 3;

    // Left flame
    const leftFlame = ctx.createLinearGradient(-13, 10, -13, 10 + flameLength);
    leftFlame.addColorStop(0, `rgba(255, 200, 50, ${flameIntensity})`);
    leftFlame.addColorStop(0.5, `rgba(255, 100, 0, ${flameIntensity * 0.7})`);
    leftFlame.addColorStop(1, 'rgba(255, 50, 0, 0)');

    ctx.fillStyle = leftFlame;
    ctx.beginPath();
    ctx.moveTo(-18, 10);
    ctx.lineTo(-8, 10);
    ctx.lineTo(-13, 10 + flameLength);
    ctx.closePath();
    ctx.fill();

    // Right flame
    const rightFlame = ctx.createLinearGradient(13, 10, 13, 10 + flameLength);
    rightFlame.addColorStop(0, `rgba(255, 200, 50, ${flameIntensity})`);
    rightFlame.addColorStop(0.5, `rgba(255, 100, 0, ${flameIntensity * 0.7})`);
    rightFlame.addColorStop(1, 'rgba(255, 50, 0, 0)');

    ctx.fillStyle = rightFlame;
    ctx.beginPath();
    ctx.moveTo(8, 10);
    ctx.lineTo(18, 10);
    ctx.lineTo(13, 10 + flameLength);
    ctx.closePath();
    ctx.fill();

    // Glow effect for higher tiers
    if (tier >= 3) {
      ctx.shadowColor = 'rgba(255, 150, 0, 0.8)';
      ctx.shadowBlur = tier * 5;
    }

    ctx.restore();
  },

  _drawWeapon(ctx, cx, cy) {
    const tier = this.shipData.weaponTier;
    const tierColor = this.TIER_COLORS[tier];

    ctx.save();
    ctx.translate(cx, cy - 25);

    ctx.fillStyle = '#444444';
    ctx.strokeStyle = tierColor.primary;
    ctx.lineWidth = 1.5;

    // Dual barrels
    const barrelLength = 15 + tier * 3;

    // Left barrel
    ctx.beginPath();
    ctx.roundRect(-12, -barrelLength, 4, barrelLength, 1);
    ctx.fill();
    ctx.stroke();

    // Right barrel
    ctx.beginPath();
    ctx.roundRect(8, -barrelLength, 4, barrelLength, 1);
    ctx.fill();
    ctx.stroke();

    // Barrel tips glow
    const glowIntensity = 0.5 + Math.sin(this.time * 4) * 0.3;
    ctx.fillStyle = `rgba(255, 100, 100, ${glowIntensity})`;
    ctx.beginPath();
    ctx.arc(-10, -barrelLength, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(10, -barrelLength, 3, 0, Math.PI * 2);
    ctx.fill();

    // Targeting reticle for tier 3+
    if (tier >= 3) {
      ctx.strokeStyle = `rgba(255, 50, 50, ${0.3 + Math.sin(this.time * 2) * 0.2})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, -barrelLength - 10, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-12, -barrelLength - 10);
      ctx.lineTo(12, -barrelLength - 10);
      ctx.moveTo(0, -barrelLength - 22);
      ctx.lineTo(0, -barrelLength + 2);
      ctx.stroke();
    }

    ctx.restore();
  },

  _drawMiningBeam(ctx, cx, cy) {
    const tier = this.shipData.miningTier;
    const tierColor = this.TIER_COLORS[tier];

    ctx.save();
    ctx.translate(cx, cy - 40);

    // Mining beam emitter
    ctx.fillStyle = '#2a5a2a';
    ctx.strokeStyle = tierColor.primary;
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.roundRect(-5, -8, 10, 8, 2);
    ctx.fill();
    ctx.stroke();

    // Beam effect (pulsing)
    const beamLength = 20 + tier * 5;
    const beamWidth = 2 + tier;
    const pulse = Math.sin(this.time * 6) * 0.5 + 0.5;

    const beamGradient = ctx.createLinearGradient(0, -8, 0, -8 - beamLength);
    beamGradient.addColorStop(0, `rgba(0, 255, 100, ${0.6 * pulse})`);
    beamGradient.addColorStop(1, 'rgba(0, 255, 100, 0)');

    ctx.fillStyle = beamGradient;
    ctx.beginPath();
    ctx.moveTo(-beamWidth, -8);
    ctx.lineTo(beamWidth, -8);
    ctx.lineTo(beamWidth * 0.5, -8 - beamLength);
    ctx.lineTo(-beamWidth * 0.5, -8 - beamLength);
    ctx.closePath();
    ctx.fill();

    // Crystal array for tier 4+
    if (tier >= 4) {
      ctx.fillStyle = `rgba(100, 255, 150, ${0.5 + pulse * 0.3})`;
      ctx.beginPath();
      ctx.moveTo(-8, -5);
      ctx.lineTo(-12, 0);
      ctx.lineTo(-8, 0);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(8, -5);
      ctx.lineTo(12, 0);
      ctx.lineTo(8, 0);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  },

  _drawRadar(ctx, cx, cy) {
    const tier = this.shipData.radarTier;
    const tierColor = this.TIER_COLORS[tier];

    ctx.save();
    ctx.translate(cx, cy - 15);

    // Radar dish
    const dishSize = 6 + tier;
    const rotation = this.time * 2;

    ctx.strokeStyle = tierColor.primary;
    ctx.lineWidth = 1.5;
    ctx.fillStyle = '#334433';

    // Dish base
    ctx.beginPath();
    ctx.ellipse(0, 0, dishSize, dishSize * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Rotating element
    ctx.strokeStyle = `rgba(0, 255, 100, ${0.5 + Math.sin(this.time * 3) * 0.3})`;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(
      Math.cos(rotation) * dishSize,
      Math.sin(rotation) * dishSize * 0.4
    );
    ctx.stroke();

    // Scan rings for tier 3+
    if (tier >= 3) {
      for (let i = 1; i <= tier - 2; i++) {
        const ringRadius = dishSize + i * 5;
        const alpha = Math.max(0, 0.3 - (this.time * 0.5 % 1) * 0.3);
        ctx.strokeStyle = `rgba(0, 255, 100, ${alpha})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, ringRadius, ringRadius * 0.4, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  },

  _drawCargo(ctx, cx, cy) {
    const tier = this.shipData.cargoTier;
    const tierColor = this.TIER_COLORS[tier];

    ctx.save();
    ctx.translate(cx, cy + 15);

    // Cargo container
    const containerWidth = 12 + tier * 2;
    const containerHeight = 8 + tier;

    ctx.fillStyle = '#5a4a3a';
    ctx.strokeStyle = tierColor.primary;
    ctx.lineWidth = 1.5;

    // Main container (3D box effect)
    // Top face
    ctx.fillStyle = '#6a5a4a';
    ctx.beginPath();
    ctx.moveTo(-containerWidth / 2, -containerHeight / 2);
    ctx.lineTo(0, -containerHeight / 2 - 5);
    ctx.lineTo(containerWidth / 2, -containerHeight / 2);
    ctx.lineTo(0, -containerHeight / 2 + 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Front face
    ctx.fillStyle = '#5a4a3a';
    ctx.beginPath();
    ctx.rect(-containerWidth / 2, -containerHeight / 2, containerWidth, containerHeight);
    ctx.fill();
    ctx.stroke();

    // Capacity indicator
    const fillLevel = 0.3 + tier * 0.15; // Visual indicator of capacity
    ctx.fillStyle = `rgba(200, 150, 50, ${0.5 + Math.sin(this.time * 2) * 0.2})`;
    ctx.fillRect(
      -containerWidth / 2 + 2,
      containerHeight / 2 - 2 - (containerHeight - 4) * fillLevel,
      containerWidth - 4,
      (containerHeight - 4) * fillLevel
    );

    // Tier badge
    if (tier >= 2) {
      ctx.fillStyle = tierColor.primary;
      ctx.font = 'bold 6px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`T${tier}`, 0, 2);
    }

    ctx.restore();
  },

  _drawEnergyCore(ctx, cx, cy) {
    const tier = this.shipData.energyCoreTier;
    const tierColor = this.TIER_COLORS[tier];

    ctx.save();
    ctx.translate(cx, cy);

    // Core reactor sphere
    const coreRadius = 8 + tier;
    const pulse = Math.sin(this.time * 3) * 0.2 + 1;

    // Outer glow
    const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, coreRadius * 2);
    glowGradient.addColorStop(0, `rgba(255, 200, 50, ${0.3 * tier / 5})`);
    glowGradient.addColorStop(1, 'rgba(255, 200, 50, 0)');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(0, 0, coreRadius * 2, 0, Math.PI * 2);
    ctx.fill();

    // Core sphere
    const coreGradient = ctx.createRadialGradient(-2, -2, 0, 0, 0, coreRadius * pulse);
    coreGradient.addColorStop(0, '#ffffff');
    coreGradient.addColorStop(0.3, '#ffdd44');
    coreGradient.addColorStop(0.7, '#ff8800');
    coreGradient.addColorStop(1, '#ff4400');

    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(0, 0, coreRadius * pulse, 0, Math.PI * 2);
    ctx.fill();

    // Energy arcs for tier 2+
    if (tier >= 2) {
      ctx.strokeStyle = `rgba(255, 255, 100, ${0.5 + Math.sin(this.time * 8) * 0.3})`;
      ctx.lineWidth = 1;

      for (let i = 0; i < tier; i++) {
        const angle = (this.time * 2 + i * (Math.PI * 2 / tier)) % (Math.PI * 2);
        const arcRadius = coreRadius + 5 + Math.sin(this.time * 4 + i) * 3;

        ctx.beginPath();
        ctx.arc(0, 0, arcRadius, angle - 0.3, angle + 0.3);
        ctx.stroke();
      }
    }

    // Lightning bolts for tier 4+
    if (tier >= 4) {
      ctx.strokeStyle = `rgba(255, 255, 200, ${0.3 + Math.random() * 0.4})`;
      ctx.lineWidth = 1;

      for (let i = 0; i < tier - 2; i++) {
        const angle = Math.random() * Math.PI * 2;
        const startRadius = coreRadius * pulse;
        const endRadius = coreRadius + 10 + Math.random() * 5;

        ctx.beginPath();
        ctx.moveTo(
          Math.cos(angle) * startRadius,
          Math.sin(angle) * startRadius
        );

        // Jagged line
        const midAngle = angle + (Math.random() - 0.5) * 0.5;
        const midRadius = (startRadius + endRadius) / 2;
        ctx.lineTo(
          Math.cos(midAngle) * midRadius,
          Math.sin(midAngle) * midRadius
        );
        ctx.lineTo(
          Math.cos(angle) * endRadius,
          Math.sin(angle) * endRadius
        );
        ctx.stroke();
      }
    }

    ctx.restore();
  },

  /**
   * Utility: Shade a hex color
   * @param {string} color - Hex color string
   * @param {number} percent - Positive = lighter, negative = darker
   * @returns {string} New hex color
   */
  _shadeColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, Math.min(255, (num >> 16) + amt));
    const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
    const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
  },

  /**
   * Highlight a specific component (for selection)
   * @param {string|null} componentKey - Component to highlight, or null to clear
   */
  setHighlightedComponent(componentKey) {
    this.highlightedComponent = componentKey;
  },

  /**
   * Clean up resources
   */
  destroy() {
    this.stopAnimation();
    this.canvas = null;
    this.ctx = null;
  }
};

// Export for use in browser
if (typeof window !== 'undefined') {
  window.ShipPreviewCanvas = ShipPreviewCanvas;
}
