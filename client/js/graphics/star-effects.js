/**
 * Star Effects - Corona flares, heat overlay, and danger zone warnings
 * Uses ParticleSystem for corona flares with periodic bursts
 */

const StarEffects = {
  // Track flare timers per star
  flareTimers: new Map(),

  // Heat overlay intensity (0-1)
  heatIntensity: 0,
  targetHeatIntensity: 0,

  // Current zone for warning display
  currentZone: null,
  zoneTransitionAlpha: 0,

  // Player position for distance calculations
  playerPosition: null,

  init() {
    this.flareTimers.clear();
    this.heatIntensity = 0;
    this.targetHeatIntensity = 0;
    this.currentZone = null;
    this.zoneTransitionAlpha = 0;
  },

  /**
   * Update star effects
   * @param {number} dt - Delta time in seconds
   * @param {Array} stars - Array of visible stars
   * @param {{x: number, y: number}} playerPosition - Player world position
   */
  update(dt, stars, playerPosition) {
    this.playerPosition = playerPosition;

    // Check if corona flares are enabled in graphics settings
    const coronaFlaresEnabled = typeof GraphicsSettings === 'undefined' ||
      GraphicsSettings.get('coronaFlares') !== false;

    if (!coronaFlaresEnabled) {
      // Skip flare spawning, just update heat overlay
      this.updateHeatOverlay(stars, playerPosition, dt);
      return;
    }

    const config = CONSTANTS.CORONA_FLARE || {};
    const spawnMin = config.SPAWN_INTERVAL_MIN || 2000;
    const spawnMax = config.SPAWN_INTERVAL_MAX || 5000;

    // Update flare timers and spawn flares for visible stars
    for (const star of stars) {
      if (!star || !star.id) continue;

      // Skip stars too far from player (optimization)
      const dx = star.x - playerPosition.x;
      const dy = star.y - playerPosition.y;
      const distSq = dx * dx + dy * dy;
      const maxRange = (star.size || 400) * 4;
      if (distSq > maxRange * maxRange) continue;

      // Initialize or update flare timer
      if (!this.flareTimers.has(star.id)) {
        // Random initial delay
        this.flareTimers.set(star.id, {
          nextFlare: Date.now() + Math.random() * spawnMin,
          starData: star
        });
      }

      const timer = this.flareTimers.get(star.id);
      timer.starData = star; // Update position

      if (Date.now() >= timer.nextFlare) {
        this.spawnFlare(star);
        timer.nextFlare = Date.now() + spawnMin + Math.random() * (spawnMax - spawnMin);
      }
    }

    // Clean up timers for stars no longer visible
    const visibleIds = new Set(stars.map(s => s.id));
    for (const [id] of this.flareTimers) {
      if (!visibleIds.has(id)) {
        this.flareTimers.delete(id);
      }
    }

    // Update heat overlay based on proximity to stars
    this.updateHeatOverlay(stars, playerPosition, dt);
  },

  /**
   * Spawn a corona flare burst from a star
   * @param {Object} star - Star to spawn flare from
   */
  spawnFlare(star) {
    const config = CONSTANTS.CORONA_FLARE || {};
    const particleCount = config.PARTICLES_PER_FLARE || 8;
    const speed = config.PARTICLE_SPEED || 80;
    const life = config.PARTICLE_LIFE || 1500;

    // Random angle for flare direction
    const baseAngle = Math.random() * Math.PI * 2;
    const spread = Math.PI / 4; // 45 degree spread

    // Flare origin at star surface
    const flareOriginRadius = (star.size || 400) * 0.9;
    const originX = star.x + Math.cos(baseAngle) * flareOriginRadius;
    const originY = star.y + Math.sin(baseAngle) * flareOriginRadius;

    // Star color variants for flare
    const colors = this.getFlareColors(star.color || '#ffff00');

    for (let i = 0; i < particleCount; i++) {
      const angle = baseAngle + (Math.random() - 0.5) * spread;
      const particleSpeed = speed * (0.6 + Math.random() * 0.8);
      const size = 4 + Math.random() * 8;

      // Slight variation in origin
      const ox = originX + (Math.random() - 0.5) * star.size * 0.2;
      const oy = originY + (Math.random() - 0.5) * star.size * 0.2;

      ParticleSystem.spawn({
        x: ox,
        y: oy,
        vx: Math.cos(angle) * particleSpeed,
        vy: Math.sin(angle) * particleSpeed,
        life: life * (0.7 + Math.random() * 0.6),
        color: colors.outer,
        secondaryColor: colors.inner,
        size: size,
        type: 'flame',
        decay: 0.8,
        drag: 0.99
      });
    }

    // Spawn a few spark particles for extra visual
    for (let i = 0; i < 3; i++) {
      const angle = baseAngle + (Math.random() - 0.5) * spread * 0.5;
      const particleSpeed = speed * 1.5;

      ParticleSystem.spawn({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * particleSpeed,
        vy: Math.sin(angle) * particleSpeed,
        life: life * 0.5,
        color: '#ffffff',
        size: 2,
        type: 'spark',
        decay: 1.2
      });
    }
  },

  /**
   * Get flare colors based on star color
   */
  getFlareColors(starColor) {
    // Color mapping for different star types
    const colorMap = {
      '#ffff00': { outer: '#ff6600', inner: '#ffff00' }, // Yellow star
      '#ffaa00': { outer: '#ff4400', inner: '#ffaa00' }, // Orange star
      '#ff6600': { outer: '#ff2200', inner: '#ff8800' }, // Red-orange star
      '#ffffff': { outer: '#aaddff', inner: '#ffffff' }, // White star
      '#aaaaff': { outer: '#6688ff', inner: '#ffffff' }  // Blue star
    };

    return colorMap[starColor] || { outer: '#ff6600', inner: '#ffff00' };
  },

  /**
   * Update heat overlay intensity based on star proximity
   */
  updateHeatOverlay(stars, playerPosition, dt) {
    let maxIntensity = 0;
    let closestZone = null;

    for (const star of stars) {
      if (!star) continue;

      const dx = star.x - playerPosition.x;
      const dy = star.y - playerPosition.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const starSize = star.size || 400;

      // Calculate zone
      const zoneInfo = Physics.getStarZone(playerPosition.x, playerPosition.y, star);

      if (zoneInfo.zone) {
        // Calculate intensity based on zone
        let intensity = 0;
        switch (zoneInfo.zone) {
          case 'surface':
            intensity = 1.0;
            break;
          case 'hot':
            intensity = 0.7 + (1 - zoneInfo.ratio) * 0.3;
            break;
          case 'warm':
            intensity = 0.3 + (1.3 - zoneInfo.ratio) * 0.4;
            break;
          case 'corona':
            intensity = 0.1 + (1.5 - zoneInfo.ratio) * 0.2;
            break;
        }

        if (intensity > maxIntensity) {
          maxIntensity = intensity;
          closestZone = zoneInfo.zone;
        }
      }
    }

    this.targetHeatIntensity = maxIntensity;

    // Smooth transition
    const transitionSpeed = 3;
    if (this.heatIntensity < this.targetHeatIntensity) {
      this.heatIntensity = Math.min(this.targetHeatIntensity, this.heatIntensity + dt * transitionSpeed);
    } else {
      this.heatIntensity = Math.max(this.targetHeatIntensity, this.heatIntensity - dt * transitionSpeed);
    }

    // Update zone warning
    if (closestZone !== this.currentZone) {
      this.currentZone = closestZone;
      this.zoneTransitionAlpha = 1.0; // Flash on zone change
    }

    // Fade zone warning
    if (this.zoneTransitionAlpha > 0.5) {
      this.zoneTransitionAlpha = Math.max(0.5, this.zoneTransitionAlpha - dt * 2);
    }
  },

  /**
   * Draw heat overlay (red vignette) when near stars
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} width - Viewport width
   * @param {number} height - Viewport height
   */
  drawHeatOverlay(ctx, width, height) {
    if (this.heatIntensity <= 0.05) return;

    ctx.save();

    // Pulsing effect
    const pulse = 0.9 + Math.sin(Date.now() * 0.003) * 0.1;
    const intensity = this.heatIntensity * pulse;

    // Create radial gradient from center (clear) to edges (red)
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.max(width, height) * 0.8;

    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(0.3, 'transparent');
    gradient.addColorStop(0.6, `rgba(255, 80, 0, ${intensity * 0.1})`);
    gradient.addColorStop(0.8, `rgba(255, 50, 0, ${intensity * 0.2})`);
    gradient.addColorStop(1, `rgba(255, 20, 0, ${intensity * 0.4})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Add screen shake simulation via subtle position offset (handled elsewhere)

    ctx.restore();
  },

  /**
   * Draw danger zone warning text
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} width - Viewport width
   * @param {number} height - Viewport height
   */
  drawZoneWarning(ctx, width, height) {
    if (!this.currentZone || this.heatIntensity <= 0.05) return;

    ctx.save();

    let text = '';
    let color = '#ffcc00';

    switch (this.currentZone) {
      case 'corona':
        text = 'STELLAR PROXIMITY';
        color = '#ffdd44';
        break;
      case 'warm':
        text = 'STELLAR HEAT';
        color = '#ff9900';
        break;
      case 'hot':
        text = 'DANGER - EXTREME HEAT';
        color = '#ff4400';
        break;
      case 'surface':
        text = 'CRITICAL - HULL DAMAGE';
        color = '#ff0000';
        break;
    }

    if (!text) {
      ctx.restore();
      return;
    }

    // Flashing effect for danger zones
    let alpha = this.zoneTransitionAlpha;
    if (this.currentZone === 'hot' || this.currentZone === 'surface') {
      alpha = 0.5 + Math.sin(Date.now() * 0.01) * 0.5;
    }

    ctx.globalAlpha = alpha;
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Shadow for readability
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // Warning text at top of screen
    ctx.fillStyle = color;
    ctx.fillText(text, width / 2, 60);

    // Optional icon (triangle warning)
    if (this.currentZone === 'hot' || this.currentZone === 'surface') {
      const iconX = width / 2 - ctx.measureText(text).width / 2 - 30;
      const iconY = 60;

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(iconX, iconY + 15);
      ctx.lineTo(iconX + 10, iconY);
      ctx.lineTo(iconX + 20, iconY + 15);
      ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.font = 'bold 12px Arial';
      ctx.fillText('!', iconX + 10, iconY + 3);
    }

    ctx.restore();
  },

  /**
   * Draw ambient corona glow around star (called from renderer)
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} screenX - Star screen X position
   * @param {number} screenY - Star screen Y position
   * @param {Object} star - Star data
   */
  drawCoronaGlow(ctx, screenX, screenY, star) {
    const size = star.size || 400;
    const coronaRadius = size * 1.5;

    ctx.save();

    // Animated corona shimmer
    const time = Date.now() * 0.001;
    const shimmer = 0.85 + Math.sin(time * 2) * 0.15;

    // Get colors for this star type
    const colors = this.getFlareColors(star.color || '#ffff00');

    // Outer corona glow
    const gradient = ctx.createRadialGradient(screenX, screenY, size * 0.9, screenX, screenY, coronaRadius);
    gradient.addColorStop(0, colors.outer + '40');
    gradient.addColorStop(0.5, colors.outer + '15');
    gradient.addColorStop(1, 'transparent');

    ctx.globalAlpha = shimmer;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(screenX, screenY, coronaRadius, 0, Math.PI * 2);
    ctx.fill();

    // Inner corona detail
    const innerGradient = ctx.createRadialGradient(screenX, screenY, size * 0.8, screenX, screenY, size * 1.1);
    innerGradient.addColorStop(0, colors.inner + '60');
    innerGradient.addColorStop(1, colors.outer + '20');

    ctx.globalAlpha = 0.5 + shimmer * 0.3;
    ctx.fillStyle = innerGradient;
    ctx.beginPath();
    ctx.arc(screenX, screenY, size * 1.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
};
