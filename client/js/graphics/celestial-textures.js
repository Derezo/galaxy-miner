/**
 * Celestial Textures - Procedural rendering for planets, asteroids, and comets
 * Uses seeded RNG for deterministic textures across client/server
 */

const CelestialRenderer = {
  // Caches for performance
  textureCache: new Map(),
  asteroidShapeCache: new Map(),
  asteroidRotations: new Map(),

  // Animation state
  animationTime: 0,

  init() {
    this.textureCache.clear();
    this.asteroidShapeCache.clear();
    this.asteroidRotations.clear();
    this.animationTime = 0;
  },

  update(dt) {
    this.animationTime += dt;

    // Update asteroid rotations
    for (const [id, rotation] of this.asteroidRotations) {
      rotation.angle += rotation.speed * dt;
    }
  },

  // Seeded random number generator (Mulberry32)
  seededRandom(seed) {
    let t = seed + 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  },

  // Create seeded RNG function from string seed
  createRNG(seed) {
    let hash = 0;
    const str = String(seed);
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    let state = hash;
    return () => {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return state / 0x7fffffff;
    };
  },

  // Get LOD level based on screen size
  getLODLevel(screenSize) {
    if (screenSize < 10) return 'minimal';
    if (screenSize < 25) return 'low';
    if (screenSize < 50) return 'medium';
    return 'high';
  },

  // ==================== PLANETS ====================

  drawPlanet(ctx, planet, screen, depleted) {
    const size = planet.size;
    const lod = this.getLODLevel(size);
    const typeConfig = CONSTANTS.PLANET_TYPES?.[planet.type] || {};

    ctx.save();
    ctx.translate(screen.x, screen.y);

    if (depleted) {
      // Depleted planet - simple gray circle
      ctx.fillStyle = '#444444';
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      return;
    }

    // Get planet colors
    const colors = planet.colors || typeConfig.colors || ['#888888', '#666666'];
    const rng = this.createRNG(planet.id || planet.x * 1000 + planet.y);
    const hasRings = typeConfig.hasRings || planet.hasRings;

    // Draw back rings first (behind planet)
    let ringData = null;
    if (hasRings) {
      const ringRng = this.createRNG((planet.id || planet.x * 1000 + planet.y) + '_rings');
      ringData = this.drawRingsBack(ctx, size, colors, ringRng);
    }

    // Draw based on planet type features
    if (typeConfig.hasBands || planet.hasBands) {
      this.drawGasGiant(ctx, size, colors, rng, lod);
    } else if (typeConfig.hasLavaGlow || planet.hasLavaGlow) {
      this.drawLavaPlanet(ctx, size, colors, rng, lod);
    } else if (typeConfig.hasPolarCaps || planet.hasPolarCaps) {
      this.drawIcePlanet(ctx, size, colors, rng, lod);
    } else {
      this.drawRockyPlanet(ctx, size, colors, rng, lod);
    }

    // Add craters if applicable
    if ((typeConfig.hasCraters || planet.hasCraters) && lod !== 'minimal') {
      this.drawCraters(ctx, size, rng, lod);
    }

    // Add clouds if applicable (now with animation)
    if ((typeConfig.hasClouds || planet.hasClouds) && lod !== 'minimal') {
      this.drawClouds(ctx, size, rng, lod);
    }

    // Add terminator shading for 3D effect (before atmosphere)
    if (lod !== 'minimal') {
      this.drawTerminator(ctx, size);
    }

    // Add atmosphere halo if applicable
    if (typeConfig.hasAtmosphere || planet.hasAtmosphere) {
      this.drawAtmosphereHalo(ctx, size, colors[0]);
    }

    // Add heat glow for hot planets
    if (typeConfig.hasHeatGlow || planet.hasHeatGlow) {
      this.drawHeatGlow(ctx, size);
    }

    // Add toxic clouds for toxic planets
    if (typeConfig.hasToxicClouds || planet.hasToxicClouds) {
      this.drawToxicClouds(ctx, size, rng);
    }

    // Draw front rings last (over planet)
    if (hasRings && ringData) {
      const ringRng = this.createRNG((planet.id || planet.x * 1000 + planet.y) + '_rings_front');
      this.drawRingsFront(ctx, size, colors, ringRng, ringData);
    }

    ctx.restore();
  },

  drawGasGiant(ctx, size, colors, rng, lod) {
    // Base gradient
    const gradient = ctx.createLinearGradient(-size, -size, size, size);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(1, colors[1] || colors[0]);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();

    // Draw cloud bands
    if (lod !== 'minimal') {
      const numBands = lod === 'high' ? 8 : (lod === 'medium' ? 5 : 3);
      ctx.save();
      ctx.clip();

      for (let i = 0; i < numBands; i++) {
        const y = -size + (size * 2 * i / numBands) + (rng() - 0.5) * size * 0.2;
        const bandHeight = size * 0.15 + rng() * size * 0.1;
        const alpha = 0.15 + rng() * 0.2;

        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.ellipse(0, y, size * 1.1, bandHeight, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Add storm spots (Jupiter's Great Red Spot style)
      if (lod === 'high' || lod === 'medium') {
        const stormCount = 1 + Math.floor(rng() * 2); // 1-2 storms
        for (let i = 0; i < stormCount; i++) {
          const stormX = (rng() - 0.5) * size * 0.6;
          const stormY = (rng() - 0.5) * size * 0.6;
          const stormW = size * (0.12 + rng() * 0.15);
          const stormH = stormW * (0.5 + rng() * 0.3);

          // Storm with swirl gradient
          const stormGrad = ctx.createRadialGradient(
            stormX, stormY, 0,
            stormX, stormY, stormW
          );
          const stormColor = this.darkenColor(colors[0], 20 + rng() * 20);
          stormGrad.addColorStop(0, this.darkenColor(stormColor, 15));
          stormGrad.addColorStop(0.4, stormColor);
          stormGrad.addColorStop(0.7, this.alphaColor(stormColor, 0.5));
          stormGrad.addColorStop(1, 'transparent');

          ctx.fillStyle = stormGrad;
          ctx.beginPath();
          ctx.ellipse(stormX, stormY, stormW, stormH, rng() * 0.3, 0, Math.PI * 2);
          ctx.fill();

          // Inner eye of storm (slightly lighter)
          if (lod === 'high') {
            const eyeGrad = ctx.createRadialGradient(
              stormX - stormW * 0.1, stormY - stormH * 0.1, 0,
              stormX, stormY, stormW * 0.3
            );
            eyeGrad.addColorStop(0, this.alphaColor(colors[0], 0.4));
            eyeGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = eyeGrad;
            ctx.beginPath();
            ctx.ellipse(stormX, stormY, stormW * 0.4, stormH * 0.4, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      ctx.restore();
    }

    // Border
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
  },

  drawRockyPlanet(ctx, size, colors, rng, lod) {
    // Base color with noise-like texture
    const gradient = ctx.createRadialGradient(-size * 0.3, -size * 0.3, 0, 0, 0, size);
    gradient.addColorStop(0, this.lightenColor(colors[0], 30));
    gradient.addColorStop(0.7, colors[0]);
    gradient.addColorStop(1, this.darkenColor(colors[1] || colors[0], 30));

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();

    // Add terrain patches (highlands/maria) for higher LODs
    if (lod === 'high' || lod === 'medium') {
      ctx.save();
      ctx.clip();

      // Irregular polygon terrain patches instead of simple circles
      const patchCount = lod === 'high' ? 12 : 6;
      for (let i = 0; i < patchCount; i++) {
        const angle = rng() * Math.PI * 2;
        const dist = rng() * size * 0.75;
        const px = Math.cos(angle) * dist;
        const py = Math.sin(angle) * dist;
        const pSize = size * (0.12 + rng() * 0.18);

        // Draw irregular polygon for terrain patch
        ctx.beginPath();
        const vertices = 5 + Math.floor(rng() * 4); // 5-8 vertices
        for (let v = 0; v < vertices; v++) {
          const va = (v / vertices) * Math.PI * 2;
          const vr = pSize * (0.6 + rng() * 0.8);
          const vx = px + Math.cos(va) * vr;
          const vy = py + Math.sin(va) * vr;
          if (v === 0) ctx.moveTo(vx, vy);
          else ctx.lineTo(vx, vy);
        }
        ctx.closePath();

        // Alternate between lighter highlands and darker maria
        if (rng() > 0.4) {
          // Dark maria (low-lying plains)
          ctx.fillStyle = this.alphaColor(this.darkenColor(colors[0], 25), 0.4);
        } else {
          // Light highlands
          ctx.fillStyle = this.alphaColor(this.lightenColor(colors[0], 20), 0.3);
        }
        ctx.fill();
      }

      ctx.restore();
    }

    // Border
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 2;
    ctx.stroke();
  },

  drawIcePlanet(ctx, size, colors, rng, lod) {
    // Icy blue base
    const gradient = ctx.createRadialGradient(-size * 0.3, -size * 0.3, 0, 0, 0, size);
    gradient.addColorStop(0, '#FFFFFF');
    gradient.addColorStop(0.3, colors[0]);
    gradient.addColorStop(1, colors[1] || this.darkenColor(colors[0], 30));

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();

    // Polar caps and ice features
    if (lod !== 'minimal') {
      ctx.save();
      ctx.clip();

      // North pole
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.ellipse(0, -size * 0.7, size * 0.6, size * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();

      // South pole
      ctx.beginPath();
      ctx.ellipse(0, size * 0.7, size * 0.5, size * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();

      // Ice crack fissures (Europa-style)
      if (lod === 'high' || lod === 'medium') {
        ctx.strokeStyle = this.alphaColor(this.darkenColor(colors[0], 40), 0.5);
        ctx.lineWidth = lod === 'high' ? 1.5 : 1;

        const crackCount = lod === 'high' ? 8 : 5;
        for (let i = 0; i < crackCount; i++) {
          ctx.beginPath();

          // Start from random point
          let x = (rng() - 0.5) * size * 1.6;
          let y = (rng() - 0.5) * size * 1.6;
          ctx.moveTo(x, y);

          // Jagged line across surface
          const segments = 3 + Math.floor(rng() * 4);
          for (let s = 0; s < segments; s++) {
            // Random direction with tendency to continue
            x += (rng() - 0.5) * size * 0.5;
            y += (rng() - 0.5) * size * 0.5;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        }

        // Some cracks have a subtle blue tint (cryovolcanic)
        ctx.strokeStyle = this.alphaColor('#6688AA', 0.3);
        ctx.lineWidth = 2;
        for (let i = 0; i < 2; i++) {
          ctx.beginPath();
          let x = (rng() - 0.5) * size;
          let y = (rng() - 0.5) * size;
          ctx.moveTo(x, y);
          const segments = 2 + Math.floor(rng() * 3);
          for (let s = 0; s < segments; s++) {
            x += (rng() - 0.5) * size * 0.4;
            y += (rng() - 0.5) * size * 0.4;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }

      ctx.restore();
    }

    // Border
    ctx.strokeStyle = '#88AACC';
    ctx.lineWidth = 2;
    ctx.stroke();
  },

  drawLavaPlanet(ctx, size, colors, rng, lod) {
    // Dark base with glowing cracks
    ctx.fillStyle = '#1a0a0a';
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();

    // Lava glow
    const gradient = ctx.createRadialGradient(0, 0, size * 0.5, 0, 0, size);
    gradient.addColorStop(0, 'rgba(255, 100, 0, 0.4)');
    gradient.addColorStop(1, 'rgba(255, 50, 0, 0.1)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Lava cracks
    if (lod !== 'minimal') {
      ctx.save();
      ctx.clip();

      const cracks = lod === 'high' ? 12 : (lod === 'medium' ? 8 : 4);
      ctx.strokeStyle = colors[0] || '#FF4500';
      ctx.lineWidth = 2;
      ctx.shadowColor = colors[0] || '#FF4500';
      ctx.shadowBlur = 5;

      for (let i = 0; i < cracks; i++) {
        const startX = (rng() - 0.5) * size * 2;
        const startY = (rng() - 0.5) * size * 2;

        ctx.beginPath();
        ctx.moveTo(startX, startY);

        let x = startX, y = startY;
        const segments = 3 + Math.floor(rng() * 4);
        for (let j = 0; j < segments; j++) {
          x += (rng() - 0.5) * size * 0.4;
          y += (rng() - 0.5) * size * 0.4;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      ctx.restore();
    }

    // Glow border
    ctx.strokeStyle = '#FF6600';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#FF4400';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
  },

  drawCraters(ctx, size, rng, lod) {
    const numCraters = lod === 'high' ? 6 : (lod === 'medium' ? 4 : 2);

    for (let i = 0; i < numCraters; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = rng() * size * 0.7;
      const x = Math.cos(angle) * dist;
      const y = Math.sin(angle) * dist;
      const r = size * (0.05 + rng() * 0.1);

      // Crater shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.arc(x + r * 0.2, y + r * 0.2, r, 0, Math.PI * 2);
      ctx.fill();

      // Crater
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      // Crater rim highlight
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, r, Math.PI * 0.75, Math.PI * 1.75);
      ctx.stroke();
    }
  },

  drawClouds(ctx, size, rng, lod) {
    ctx.save();

    // Clip to planet
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.clip();

    // Use animation time for subtle cloud drift
    const time = this.animationTime;
    const cloudCount = (lod === 'high') ? 6 : 4;

    for (let i = 0; i < cloudCount; i++) {
      // Base position from RNG (deterministic per cloud)
      const baseSeed = rng();
      const baseX = (baseSeed - 0.5) * size * 1.5;
      const baseY = (rng() - 0.5) * size * 1.2;
      const w = size * (0.25 + rng() * 0.35);
      const h = size * (0.08 + rng() * 0.12);
      const rotation = rng() * Math.PI;
      const driftSpeed = 0.00003 + baseSeed * 0.00002; // Different speed per cloud

      // Animate X position with slow drift (wraps around)
      const driftOffset = ((time * driftSpeed) % 1) * size * 2;
      let animX = baseX + driftOffset;
      // Wrap around when cloud goes off edge
      if (animX > size * 1.2) animX -= size * 2.4;

      ctx.save();
      ctx.translate(animX, baseY);
      ctx.rotate(rotation);

      // Slightly varied opacity for depth
      const alpha = 0.2 + baseSeed * 0.15;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;

      ctx.beginPath();
      ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  },

  // Terminator shading for 3D spherical effect (day/night gradient)
  drawTerminator(ctx, size) {
    // Light source from upper-left, shadow on right side
    const termGrad = ctx.createLinearGradient(-size, -size * 0.3, size, size * 0.3);
    termGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');       // Lit side (left)
    termGrad.addColorStop(0.45, 'rgba(0, 0, 0, 0)');    // Still lit
    termGrad.addColorStop(0.55, 'rgba(0, 0, 0, 0.1)');  // Terminator transition
    termGrad.addColorStop(0.75, 'rgba(0, 0, 0, 0.25)'); // Penumbra
    termGrad.addColorStop(1, 'rgba(0, 0, 0, 0.4)');     // Shadow side (right)

    ctx.fillStyle = termGrad;
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();
  },

  // Ring system with back/front split and Cassini-style divisions
  drawRingsBack(ctx, size, colors, rng) {
    const ringInner = size * 1.3;
    const ringOuter = size * 2.0;
    const tilt = 0.2 + rng() * 0.3; // Variable tilt (0.2-0.5)
    const divisions = 3 + Math.floor(rng() * 3); // 3-5 ring bands

    ctx.save();

    // Draw each ring band (back half only: PI*0.05 to PI*0.95)
    for (let i = 0; i < divisions; i++) {
      const bandInner = ringInner + (ringOuter - ringInner) * (i / divisions) * 1.02;
      const bandOuter = ringInner + (ringOuter - ringInner) * ((i + 0.85) / divisions);
      const bandAlpha = 0.3 + rng() * 0.3;

      // Each band has slightly different color
      const colorShift = (rng() - 0.5) * 30;
      const bandColor = this.lightenColor('#C8B496', colorShift);

      ctx.beginPath();
      ctx.ellipse(0, 0, bandOuter, bandOuter * tilt, 0, Math.PI * 0.05, Math.PI * 0.95);
      ctx.ellipse(0, 0, bandInner, bandInner * tilt, 0, Math.PI * 0.95, Math.PI * 0.05, true);
      ctx.closePath();

      ctx.fillStyle = this.alphaColor(bandColor, bandAlpha);
      ctx.fill();
    }

    // Planet shadow on rings (subtle darkening on right side)
    const shadowGrad = ctx.createLinearGradient(-ringOuter, 0, ringOuter * 0.3, 0);
    shadowGrad.addColorStop(0, 'transparent');
    shadowGrad.addColorStop(0.6, 'transparent');
    shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, ringOuter, ringOuter * tilt, 0, Math.PI * 0.05, Math.PI * 0.95);
    ctx.ellipse(0, 0, ringInner, ringInner * tilt, 0, Math.PI * 0.95, Math.PI * 0.05, true);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // Return tilt for front rings to use same value
    return { tilt, divisions, ringInner, ringOuter };
  },

  drawRingsFront(ctx, size, colors, rng, ringData) {
    const { tilt, divisions, ringInner, ringOuter } = ringData;

    ctx.save();

    // Reset RNG to same state for consistent band colors
    const rngState = rng();

    // Draw each ring band (front half: PI*1.05 to PI*1.95)
    for (let i = 0; i < divisions; i++) {
      const bandInner = ringInner + (ringOuter - ringInner) * (i / divisions) * 1.02;
      const bandOuter = ringInner + (ringOuter - ringInner) * ((i + 0.85) / divisions);
      const bandAlpha = 0.3 + rng() * 0.3;

      const colorShift = (rng() - 0.5) * 30;
      const bandColor = this.lightenColor('#C8B496', colorShift);

      ctx.beginPath();
      ctx.ellipse(0, 0, bandOuter, bandOuter * tilt, 0, Math.PI * 1.05, Math.PI * 1.95);
      ctx.ellipse(0, 0, bandInner, bandInner * tilt, 0, Math.PI * 1.95, Math.PI * 1.05, true);
      ctx.closePath();

      ctx.fillStyle = this.alphaColor(bandColor, bandAlpha);
      ctx.fill();
    }

    ctx.restore();
  },

  // Legacy wrapper for backwards compatibility
  drawPlanetRings(ctx, size, colors, rng) {
    this.drawRingsBack(ctx, size, colors, rng);
  },

  drawAtmosphereHalo(ctx, size, color) {
    const gradient = ctx.createRadialGradient(0, 0, size * 0.9, 0, 0, size * 1.2);
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(0.5, this.alphaColor(color, 0.15));
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 1.2, 0, Math.PI * 2);
    ctx.fill();
  },

  drawHeatGlow(ctx, size) {
    const gradient = ctx.createRadialGradient(0, 0, size * 0.5, 0, 0, size * 1.3);
    gradient.addColorStop(0, 'rgba(255, 150, 50, 0.2)');
    gradient.addColorStop(0.7, 'rgba(255, 100, 0, 0.1)');
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 1.3, 0, Math.PI * 2);
    ctx.fill();
  },

  drawToxicClouds(ctx, size, rng) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.clip();

    // Swirling toxic green clouds
    for (let i = 0; i < 4; i++) {
      const x = (rng() - 0.5) * size;
      const y = (rng() - 0.5) * size;
      const r = size * (0.2 + rng() * 0.3);

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, 'rgba(150, 200, 50, 0.3)');
      gradient.addColorStop(1, 'transparent');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  },

  // ==================== ASTEROIDS ====================

  drawAsteroid(ctx, asteroid, screen, depleted) {
    const size = asteroid.size;
    const typeConfig = CONSTANTS.ASTEROID_TYPES?.[asteroid.type] || {};
    const sizeConfig = CONSTANTS.ASTEROID_SIZE_CLASSES?.[asteroid.sizeClass] || {};

    ctx.save();
    ctx.translate(screen.x, screen.y);

    // Get or create rotation state
    let rotation = this.asteroidRotations.get(asteroid.id);
    if (!rotation) {
      const rotSpeed = asteroid.rotationSpeed ||
        (sizeConfig.rotationSpeed ?
          sizeConfig.rotationSpeed[0] + Math.random() * (sizeConfig.rotationSpeed[1] - sizeConfig.rotationSpeed[0]) :
          0.5);
      rotation = { angle: Math.random() * Math.PI * 2, speed: rotSpeed };
      this.asteroidRotations.set(asteroid.id, rotation);
    }

    ctx.rotate(rotation.angle);

    if (depleted) {
      // Depleted asteroid - simple gray
      this.drawAsteroidShape(ctx, asteroid, size, '#333333', '#222222');
      ctx.restore();
      return;
    }

    // Get colors from type or defaults
    const colors = typeConfig.colors || ['#808080', '#606060'];
    const highlightColor = typeConfig.highlightColor || '#909090';

    this.drawAsteroidShape(ctx, asteroid, size, colors[0], colors[1], highlightColor);

    ctx.restore();
  },

  drawAsteroidShape(ctx, asteroid, size, fillColor, strokeColor, highlightColor) {
    // Get or generate shape
    let shape = asteroid.shape;
    if (!shape) {
      shape = this.asteroidShapeCache.get(asteroid.id);
      if (!shape) {
        const sizeConfig = CONSTANTS.ASTEROID_SIZE_CLASSES?.[asteroid.sizeClass] || {};
        const vertices = sizeConfig.vertices || [6, 8];
        const irregularity = sizeConfig.irregularity || 0.25;
        const numVertices = vertices[0] + Math.floor(Math.random() * (vertices[1] - vertices[0] + 1));

        shape = [];
        for (let i = 0; i < numVertices; i++) {
          const angle = (i / numVertices) * Math.PI * 2;
          const variance = 1 - irregularity + Math.random() * irregularity * 2;
          shape.push({
            angle,
            radius: variance
          });
        }
        this.asteroidShapeCache.set(asteroid.id, shape);
      }
    }

    // Draw the irregular polygon
    ctx.beginPath();
    for (let i = 0; i < shape.length; i++) {
      const vertex = shape[i];
      const r = size * vertex.radius;
      const x = Math.cos(vertex.angle) * r;
      const y = Math.sin(vertex.angle) * r;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();

    // Fill with gradient for 3D effect
    const gradient = ctx.createRadialGradient(-size * 0.3, -size * 0.3, 0, 0, 0, size);
    gradient.addColorStop(0, highlightColor || this.lightenColor(fillColor, 20));
    gradient.addColorStop(0.7, fillColor);
    gradient.addColorStop(1, strokeColor || this.darkenColor(fillColor, 20));

    ctx.fillStyle = gradient;
    ctx.fill();

    // Stroke
    ctx.strokeStyle = strokeColor || '#444444';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Add some surface detail for larger asteroids
    if (size > 15) {
      this.drawAsteroidDetail(ctx, size, asteroid.id);
    }
  },

  drawAsteroidDetail(ctx, size, seed) {
    const rng = this.createRNG(seed || 12345);

    // Small surface marks
    for (let i = 0; i < 3; i++) {
      const x = (rng() - 0.5) * size;
      const y = (rng() - 0.5) * size;
      const r = size * 0.1 * rng();

      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // ==================== COMETS ====================

  drawComet(ctx, comet, cometState, camera) {
    if (!cometState.visible) return;

    const screen = {
      x: (cometState.x - camera.x) * camera.zoom + camera.width / 2,
      y: (cometState.y - camera.y) * camera.zoom + camera.height / 2
    };

    const size = comet.size;
    const angle = cometState.angle;
    const tailLength = size * (comet.tailLengthFactor || 8);

    ctx.save();
    ctx.translate(screen.x, screen.y);

    // Draw tails first (behind nucleus)
    this.drawDustTail(ctx, size, angle, tailLength);
    this.drawIonTail(ctx, size, angle, tailLength);

    // Draw coma (fuzzy halo)
    this.drawComa(ctx, size);

    // Draw nucleus
    this.drawNucleus(ctx, size);

    ctx.restore();
  },

  drawIonTail(ctx, size, angle, length) {
    const config = CONSTANTS.COMET_CONFIG || {};
    const colors = config.ION_TAIL_COLORS || ['#88CCFF', '#AADDFF', '#FFFFFF'];

    // Ion tail points directly away from sun (opposite direction of travel)
    const tailAngle = angle + Math.PI;

    ctx.save();
    ctx.rotate(tailAngle);

    // Main ion tail - narrow and straight
    const gradient = ctx.createLinearGradient(0, 0, length, 0);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(0.3, this.alphaColor(colors[1], 0.6));
    gradient.addColorStop(0.7, this.alphaColor(colors[2], 0.3));
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.3);
    ctx.lineTo(length, -size * 0.1);
    ctx.lineTo(length, size * 0.1);
    ctx.lineTo(0, size * 0.3);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  },

  drawDustTail(ctx, size, angle, length) {
    const config = CONSTANTS.COMET_CONFIG || {};
    const colors = config.DUST_TAIL_COLORS || ['#FFE4B5', '#F5DEB3', '#DEB887'];
    const curve = config.DUST_TAIL_CURVE || 0.3;

    // Dust tail curves away from ion tail
    const tailAngle = angle + Math.PI;

    ctx.save();
    ctx.rotate(tailAngle);

    // Curved dust tail
    const gradient = ctx.createLinearGradient(0, 0, length * 0.8, 0);
    gradient.addColorStop(0, this.alphaColor(colors[0], 0.5));
    gradient.addColorStop(0.4, this.alphaColor(colors[1], 0.3));
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.2);

    // Curved path using quadratic bezier
    const curveOffset = length * curve;
    ctx.quadraticCurveTo(
      length * 0.5, size * 0.4 + curveOffset,
      length * 0.8, size * 0.2 + curveOffset * 1.5
    );
    ctx.lineTo(length * 0.8, size * 0.6 + curveOffset * 1.5);
    ctx.quadraticCurveTo(
      length * 0.5, size * 0.8 + curveOffset,
      0, size * 0.5
    );
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  },

  drawComa(ctx, size) {
    const config = CONSTANTS.COMET_CONFIG || {};
    const comaColor = config.COMA_COLOR || '#AADDFF';

    // Fuzzy glow around nucleus
    const gradient = ctx.createRadialGradient(0, 0, size * 0.3, 0, 0, size * 2);
    gradient.addColorStop(0, this.alphaColor(comaColor, 0.6));
    gradient.addColorStop(0.3, this.alphaColor(comaColor, 0.3));
    gradient.addColorStop(0.6, this.alphaColor(comaColor, 0.1));
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 2, 0, Math.PI * 2);
    ctx.fill();
  },

  drawNucleus(ctx, size) {
    const config = CONSTANTS.COMET_CONFIG || {};
    const coreColor = config.CORE_COLOR || '#88CCFF';

    // Solid icy core
    const gradient = ctx.createRadialGradient(-size * 0.2, -size * 0.2, 0, 0, 0, size * 0.5);
    gradient.addColorStop(0, '#FFFFFF');
    gradient.addColorStop(0.5, coreColor);
    gradient.addColorStop(1, this.darkenColor(coreColor, 30));

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Bright center spot
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(-size * 0.1, -size * 0.1, size * 0.15, 0, Math.PI * 2);
    ctx.fill();
  },

  // ==================== UTILITY ====================

  lightenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  },

  darkenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
    const B = Math.max(0, (num & 0x0000FF) - amt);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  },

  alphaColor(color, alpha) {
    const num = parseInt(color.replace('#', ''), 16);
    const R = (num >> 16) & 0xFF;
    const G = (num >> 8) & 0xFF;
    const B = num & 0xFF;
    return `rgba(${R}, ${G}, ${B}, ${alpha})`;
  }
};

// Make available globally
window.CelestialRenderer = CelestialRenderer;
