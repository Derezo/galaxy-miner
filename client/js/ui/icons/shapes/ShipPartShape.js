// Galaxy Miner - Ship Part Icon Generator
// Creates animated SVG icons for all 8 ship upgrade components

const ShipPartShape = {
  // Icon specifications for each ship part
  PARTS: {
    engine: {
      name: 'Engine',
      colors: { primary: '#ff6600', secondary: '#ffcc00', accent: '#ff3300', glow: '#ff660080' },
      render: (ctx, size, tier, state) => ShipPartShape._renderEngine(ctx, size, tier, state)
    },
    weapon: {
      name: 'Weapons',
      colors: { primary: '#ff3333', secondary: '#cc0000', accent: '#ffff00', glow: '#ff333380' },
      render: (ctx, size, tier, state) => ShipPartShape._renderWeapon(ctx, size, tier, state)
    },
    shield: {
      name: 'Shields',
      colors: { primary: '#00aaff', secondary: '#0066cc', accent: '#66ffff', glow: '#00aaff80' },
      render: (ctx, size, tier, state) => ShipPartShape._renderShield(ctx, size, tier, state)
    },
    mining: {
      name: 'Mining Beam',
      colors: { primary: '#00ff88', secondary: '#00cc66', accent: '#88ffcc', glow: '#00ff8880' },
      render: (ctx, size, tier, state) => ShipPartShape._renderMining(ctx, size, tier, state)
    },
    cargo: {
      name: 'Cargo Hold',
      colors: { primary: '#aa8844', secondary: '#886633', accent: '#ffcc88', glow: '#aa884480' },
      render: (ctx, size, tier, state) => ShipPartShape._renderCargo(ctx, size, tier, state)
    },
    radar: {
      name: 'Radar',
      colors: { primary: '#44ff44', secondary: '#22aa22', accent: '#88ff88', glow: '#44ff4480' },
      render: (ctx, size, tier, state) => ShipPartShape._renderRadar(ctx, size, tier, state)
    },
    energy_core: {
      name: 'Energy Core',
      colors: { primary: '#ffff00', secondary: '#ff9900', accent: '#ffffff', glow: '#ffff0080' },
      render: (ctx, size, tier, state) => ShipPartShape._renderEnergyCore(ctx, size, tier, state)
    },
    hull: {
      name: 'Hull',
      colors: { primary: '#8888aa', secondary: '#666688', accent: '#aaaacc', glow: '#8888aa80' },
      render: (ctx, size, tier, state) => ShipPartShape._renderHull(ctx, size, tier, state)
    }
  },

  /**
   * Create an SVG element for a ship part
   * @param {string} partKey - Part identifier (engine, weapon, etc.)
   * @param {number} size - Icon size in pixels (default 48)
   * @param {number} tier - Current tier (1-5) for visual intensity
   * @param {string} state - Animation state: 'idle', 'hover', 'selected'
   * @returns {SVGElement} Generated SVG icon
   */
  createSVG(partKey, size = 48, tier = 1, state = 'idle') {
    const part = this.PARTS[partKey];
    if (!part) return null;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 48 48');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.classList.add('ship-part-icon', `part-${partKey}`, `state-${state}`, `tier-${tier}`);

    // Add defs for gradients and filters
    const defs = this._createDefs(part.colors, tier);
    svg.appendChild(defs);

    // Render the specific part
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('icon-content');
    part.render(group, 48, tier, state);
    svg.appendChild(group);

    return svg;
  },

  /**
   * Create shared definitions (gradients, filters)
   */
  _createDefs(colors, tier) {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

    // Main gradient
    const mainGrad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    mainGrad.id = 'mainGrad';
    mainGrad.setAttribute('x1', '0%');
    mainGrad.setAttribute('y1', '0%');
    mainGrad.setAttribute('x2', '100%');
    mainGrad.setAttribute('y2', '100%');

    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', colors.accent);
    mainGrad.appendChild(stop1);

    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', colors.primary);
    mainGrad.appendChild(stop2);

    defs.appendChild(mainGrad);

    // Glow filter (intensity based on tier)
    const glowIntensity = 1 + (tier - 1) * 0.5;
    const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    filter.id = 'glow';
    filter.setAttribute('x', '-50%');
    filter.setAttribute('y', '-50%');
    filter.setAttribute('width', '200%');
    filter.setAttribute('height', '200%');

    const blur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
    blur.setAttribute('stdDeviation', (2 * glowIntensity).toString());
    blur.setAttribute('result', 'blur');
    filter.appendChild(blur);

    const merge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
    const mergeNode1 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
    mergeNode1.setAttribute('in', 'blur');
    merge.appendChild(mergeNode1);
    const mergeNode2 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
    mergeNode2.setAttribute('in', 'SourceGraphic');
    merge.appendChild(mergeNode2);
    filter.appendChild(merge);

    defs.appendChild(filter);

    return defs;
  },

  // Engine icon - thruster with flame
  _renderEngine(g, size, tier, state) {
    const colors = this.PARTS.engine.colors;

    // Thruster body
    const body = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    body.setAttribute('d', 'M14,14 L34,14 L36,20 L36,28 L34,34 L14,34 L12,28 L12,20 Z');
    body.setAttribute('fill', '#444');
    body.setAttribute('stroke', colors.primary);
    body.setAttribute('stroke-width', '1');
    g.appendChild(body);

    // Intake vents
    for (let i = 0; i < Math.min(tier, 3); i++) {
      const vent = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      vent.setAttribute('x', (16 + i * 6).toString());
      vent.setAttribute('y', '16');
      vent.setAttribute('width', '4');
      vent.setAttribute('height', '2');
      vent.setAttribute('fill', colors.secondary);
      g.appendChild(vent);
    }

    // Exhaust flame (size based on tier)
    const flameHeight = 8 + tier * 2;
    const flame = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    flame.setAttribute('d', `M18,34 Q24,${34 + flameHeight} 30,34`);
    flame.setAttribute('fill', 'none');
    flame.setAttribute('stroke', colors.secondary);
    flame.setAttribute('stroke-width', (3 + tier).toString());
    flame.setAttribute('stroke-linecap', 'round');
    flame.setAttribute('filter', 'url(#glow)');

    // Add animation
    const animate = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    animate.setAttribute('attributeName', 'd');
    animate.setAttribute('values', `M18,34 Q24,${34 + flameHeight} 30,34;M18,34 Q24,${34 + flameHeight + 3} 30,34;M18,34 Q24,${34 + flameHeight} 30,34`);
    animate.setAttribute('dur', '0.3s');
    animate.setAttribute('repeatCount', 'indefinite');
    flame.appendChild(animate);

    g.appendChild(flame);

    // Inner flame core
    const core = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    core.setAttribute('cx', '24');
    core.setAttribute('cy', '36');
    core.setAttribute('rx', '4');
    core.setAttribute('ry', '2');
    core.setAttribute('fill', colors.accent);
    g.appendChild(core);
  },

  // Weapon icon - dual barrels with targeting reticle
  _renderWeapon(g, size, tier, state) {
    const colors = this.PARTS.weapon.colors;

    // Weapon body
    const body = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    body.setAttribute('x', '16');
    body.setAttribute('y', '20');
    body.setAttribute('width', '16');
    body.setAttribute('height', '12');
    body.setAttribute('rx', '2');
    body.setAttribute('fill', colors.secondary);
    body.setAttribute('stroke', colors.primary);
    g.appendChild(body);

    // Barrels (number based on tier)
    const barrelCount = Math.min(tier, 4);
    const barrelSpacing = 10 / barrelCount;
    for (let i = 0; i < barrelCount; i++) {
      const barrel = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      barrel.setAttribute('x', '32');
      barrel.setAttribute('y', (21 + i * barrelSpacing).toString());
      barrel.setAttribute('width', '8');
      barrel.setAttribute('height', '2');
      barrel.setAttribute('rx', '1');
      barrel.setAttribute('fill', colors.primary);
      g.appendChild(barrel);
    }

    // Targeting reticle
    const reticle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    reticle.setAttribute('cx', '24');
    reticle.setAttribute('cy', '26');
    reticle.setAttribute('r', (6 + tier).toString());
    reticle.setAttribute('fill', 'none');
    reticle.setAttribute('stroke', colors.accent);
    reticle.setAttribute('stroke-width', '1');
    reticle.setAttribute('stroke-dasharray', '4,2');
    reticle.setAttribute('opacity', '0.8');

    // Rotate animation
    const rotateAnim = document.createElementNS('http://www.w3.org/2000/svg', 'animateTransform');
    rotateAnim.setAttribute('attributeName', 'transform');
    rotateAnim.setAttribute('type', 'rotate');
    rotateAnim.setAttribute('from', '0 24 26');
    rotateAnim.setAttribute('to', '360 24 26');
    rotateAnim.setAttribute('dur', '4s');
    rotateAnim.setAttribute('repeatCount', 'indefinite');
    reticle.appendChild(rotateAnim);

    g.appendChild(reticle);

    // Muzzle flash for higher tiers
    if (tier >= 3) {
      const flash = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      flash.setAttribute('cx', '40');
      flash.setAttribute('cy', '26');
      flash.setAttribute('r', '3');
      flash.setAttribute('fill', colors.accent);
      flash.setAttribute('filter', 'url(#glow)');

      const flashAnim = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
      flashAnim.setAttribute('attributeName', 'opacity');
      flashAnim.setAttribute('values', '0.3;1;0.3');
      flashAnim.setAttribute('dur', '0.5s');
      flashAnim.setAttribute('repeatCount', 'indefinite');
      flash.appendChild(flashAnim);

      g.appendChild(flash);
    }
  },

  // Shield icon - hexagonal energy field
  _renderShield(g, size, tier, state) {
    const colors = this.PARTS.shield.colors;

    // Central core
    const core = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    core.setAttribute('cx', '24');
    core.setAttribute('cy', '24');
    core.setAttribute('r', '6');
    core.setAttribute('fill', colors.secondary);
    core.setAttribute('stroke', colors.accent);
    core.setAttribute('stroke-width', '1');
    g.appendChild(core);

    // Hexagonal shield layers (based on tier)
    const hexPoints = (cx, cy, r) => {
      let points = '';
      for (let i = 0; i < 6; i++) {
        const angle = (i * 60 - 30) * Math.PI / 180;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        points += `${x},${y} `;
      }
      return points.trim();
    };

    for (let i = 0; i < tier; i++) {
      const hex = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      hex.setAttribute('points', hexPoints(24, 24, 10 + i * 4));
      hex.setAttribute('fill', 'none');
      hex.setAttribute('stroke', colors.primary);
      hex.setAttribute('stroke-width', '1.5');
      hex.setAttribute('opacity', (0.8 - i * 0.1).toString());

      // Pulse animation
      const pulseAnim = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
      pulseAnim.setAttribute('attributeName', 'opacity');
      pulseAnim.setAttribute('values', `${0.8 - i * 0.1};${1 - i * 0.1};${0.8 - i * 0.1}`);
      pulseAnim.setAttribute('dur', `${1.5 + i * 0.2}s`);
      pulseAnim.setAttribute('repeatCount', 'indefinite');
      hex.appendChild(pulseAnim);

      g.appendChild(hex);
    }

    // Energy field glow
    if (tier >= 3) {
      const glow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      glow.setAttribute('cx', '24');
      glow.setAttribute('cy', '24');
      glow.setAttribute('r', (12 + tier * 2).toString());
      glow.setAttribute('fill', 'none');
      glow.setAttribute('stroke', colors.glow);
      glow.setAttribute('stroke-width', '3');
      glow.setAttribute('filter', 'url(#glow)');
      g.appendChild(glow);
    }
  },

  // Mining beam icon - laser emitter with crystal
  _renderMining(g, size, tier, state) {
    const colors = this.PARTS.mining.colors;

    // Emitter housing
    const housing = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    housing.setAttribute('x', '14');
    housing.setAttribute('y', '18');
    housing.setAttribute('width', '12');
    housing.setAttribute('height', '12');
    housing.setAttribute('rx', '2');
    housing.setAttribute('fill', '#555');
    housing.setAttribute('stroke', colors.secondary);
    g.appendChild(housing);

    // Crystal array (number based on tier)
    const crystalCount = Math.min(tier, 3);
    for (let i = 0; i < crystalCount; i++) {
      const crystal = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      crystal.setAttribute('points', `${16 + i * 4},24 ${18 + i * 4},20 ${20 + i * 4},24 ${18 + i * 4},28`);
      crystal.setAttribute('fill', colors.accent);
      crystal.setAttribute('stroke', colors.primary);
      crystal.setAttribute('stroke-width', '0.5');
      g.appendChild(crystal);
    }

    // Beam
    const beam = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    beam.setAttribute('x1', '26');
    beam.setAttribute('y1', '24');
    beam.setAttribute('x2', '40');
    beam.setAttribute('y2', '24');
    beam.setAttribute('stroke', colors.primary);
    beam.setAttribute('stroke-width', (2 + tier * 0.5).toString());
    beam.setAttribute('stroke-linecap', 'round');
    beam.setAttribute('filter', 'url(#glow)');

    // Flicker animation
    const flickerAnim = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    flickerAnim.setAttribute('attributeName', 'opacity');
    flickerAnim.setAttribute('values', '0.7;1;0.8;1;0.7');
    flickerAnim.setAttribute('dur', '0.2s');
    flickerAnim.setAttribute('repeatCount', 'indefinite');
    beam.appendChild(flickerAnim);

    g.appendChild(beam);

    // Particle effect at beam end
    const particle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    particle.setAttribute('cx', '40');
    particle.setAttribute('cy', '24');
    particle.setAttribute('r', '3');
    particle.setAttribute('fill', colors.accent);
    particle.setAttribute('filter', 'url(#glow)');
    g.appendChild(particle);
  },

  // Cargo hold icon - container with gauge
  _renderCargo(g, size, tier, state) {
    const colors = this.PARTS.cargo.colors;

    // Main container
    const container = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    container.setAttribute('x', '12');
    container.setAttribute('y', '14');
    container.setAttribute('width', '24');
    container.setAttribute('height', '20');
    container.setAttribute('rx', '2');
    container.setAttribute('fill', colors.secondary);
    container.setAttribute('stroke', colors.primary);
    container.setAttribute('stroke-width', '2');
    g.appendChild(container);

    // Capacity lines (more for higher tiers)
    const lineCount = tier + 1;
    for (let i = 0; i < lineCount; i++) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      const y = 18 + i * (16 / lineCount);
      line.setAttribute('x1', '14');
      line.setAttribute('y1', y.toString());
      line.setAttribute('x2', '34');
      line.setAttribute('y2', y.toString());
      line.setAttribute('stroke', colors.accent);
      line.setAttribute('stroke-width', '0.5');
      line.setAttribute('opacity', '0.5');
      g.appendChild(line);
    }

    // Latches
    const latch1 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    latch1.setAttribute('x', '10');
    latch1.setAttribute('y', '20');
    latch1.setAttribute('width', '3');
    latch1.setAttribute('height', '8');
    latch1.setAttribute('fill', colors.accent);
    g.appendChild(latch1);

    const latch2 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    latch2.setAttribute('x', '35');
    latch2.setAttribute('y', '20');
    latch2.setAttribute('width', '3');
    latch2.setAttribute('height', '8');
    latch2.setAttribute('fill', colors.accent);
    g.appendChild(latch2);

    // Capacity gauge
    const gaugeHeight = 4 + tier * 2;
    const gauge = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    gauge.setAttribute('x', '16');
    gauge.setAttribute('y', (30 - gaugeHeight).toString());
    gauge.setAttribute('width', '16');
    gauge.setAttribute('height', gaugeHeight.toString());
    gauge.setAttribute('fill', colors.accent);
    gauge.setAttribute('opacity', '0.6');

    // Pulse animation
    const gaugeAnim = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    gaugeAnim.setAttribute('attributeName', 'opacity');
    gaugeAnim.setAttribute('values', '0.4;0.7;0.4');
    gaugeAnim.setAttribute('dur', '2s');
    gaugeAnim.setAttribute('repeatCount', 'indefinite');
    gauge.appendChild(gaugeAnim);

    g.appendChild(gauge);
  },

  // Radar icon - rotating dish with scan rings
  _renderRadar(g, size, tier, state) {
    const colors = this.PARTS.radar.colors;

    // Dish base
    const base = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    base.setAttribute('x', '20');
    base.setAttribute('y', '30');
    base.setAttribute('width', '8');
    base.setAttribute('height', '6');
    base.setAttribute('fill', '#555');
    g.appendChild(base);

    // Antenna dish
    const dish = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    dish.setAttribute('d', 'M12,24 Q24,12 36,24');
    dish.setAttribute('fill', 'none');
    dish.setAttribute('stroke', colors.secondary);
    dish.setAttribute('stroke-width', '3');
    dish.setAttribute('stroke-linecap', 'round');
    g.appendChild(dish);

    // Scan rings (based on tier)
    for (let i = 0; i < tier; i++) {
      const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      ring.setAttribute('cx', '24');
      ring.setAttribute('cy', '24');
      ring.setAttribute('r', (8 + i * 5).toString());
      ring.setAttribute('fill', 'none');
      ring.setAttribute('stroke', colors.primary);
      ring.setAttribute('stroke-width', '1');
      ring.setAttribute('opacity', (0.8 - i * 0.15).toString());
      g.appendChild(ring);
    }

    // Sweep line
    const sweep = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    sweep.setAttribute('x1', '24');
    sweep.setAttribute('y1', '24');
    sweep.setAttribute('x2', '24');
    sweep.setAttribute('y2', '10');
    sweep.setAttribute('stroke', colors.accent);
    sweep.setAttribute('stroke-width', '2');
    sweep.setAttribute('filter', 'url(#glow)');

    // Rotation animation
    const rotateAnim = document.createElementNS('http://www.w3.org/2000/svg', 'animateTransform');
    rotateAnim.setAttribute('attributeName', 'transform');
    rotateAnim.setAttribute('type', 'rotate');
    rotateAnim.setAttribute('from', '0 24 24');
    rotateAnim.setAttribute('to', '360 24 24');
    rotateAnim.setAttribute('dur', '2s');
    rotateAnim.setAttribute('repeatCount', 'indefinite');
    sweep.appendChild(rotateAnim);

    g.appendChild(sweep);

    // Blip for higher tiers
    if (tier >= 3) {
      const blip = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      blip.setAttribute('cx', '30');
      blip.setAttribute('cy', '18');
      blip.setAttribute('r', '2');
      blip.setAttribute('fill', colors.accent);

      const blipAnim = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
      blipAnim.setAttribute('attributeName', 'opacity');
      blipAnim.setAttribute('values', '0;1;0');
      blipAnim.setAttribute('dur', '2s');
      blipAnim.setAttribute('repeatCount', 'indefinite');
      blip.appendChild(blipAnim);

      g.appendChild(blip);
    }
  },

  // Energy Core icon - reactor sphere with arcs
  _renderEnergyCore(g, size, tier, state) {
    const colors = this.PARTS.energy_core.colors;

    // Containment ring
    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    ring.setAttribute('cx', '24');
    ring.setAttribute('cy', '24');
    ring.setAttribute('r', '16');
    ring.setAttribute('fill', 'none');
    ring.setAttribute('stroke', '#555');
    ring.setAttribute('stroke-width', '2');
    g.appendChild(ring);

    // Core sphere
    const coreSize = 6 + tier;
    const core = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    core.setAttribute('cx', '24');
    core.setAttribute('cy', '24');
    core.setAttribute('r', coreSize.toString());
    core.setAttribute('fill', colors.secondary);
    core.setAttribute('filter', 'url(#glow)');

    // Pulse animation
    const pulseAnim = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    pulseAnim.setAttribute('attributeName', 'r');
    pulseAnim.setAttribute('values', `${coreSize};${coreSize + 2};${coreSize}`);
    pulseAnim.setAttribute('dur', '1s');
    pulseAnim.setAttribute('repeatCount', 'indefinite');
    core.appendChild(pulseAnim);

    g.appendChild(core);

    // Inner bright core
    const innerCore = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    innerCore.setAttribute('cx', '24');
    innerCore.setAttribute('cy', '24');
    innerCore.setAttribute('r', (coreSize / 2).toString());
    innerCore.setAttribute('fill', colors.accent);
    g.appendChild(innerCore);

    // Energy arcs (based on tier)
    const arcCount = Math.min(tier, 4);
    for (let i = 0; i < arcCount; i++) {
      const arc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const angle = (i * 90) * Math.PI / 180;
      const startX = 24 + Math.cos(angle) * (coreSize + 2);
      const startY = 24 + Math.sin(angle) * (coreSize + 2);
      const endX = 24 + Math.cos(angle) * 15;
      const endY = 24 + Math.sin(angle) * 15;
      const controlX = 24 + Math.cos(angle + 0.3) * 12;
      const controlY = 24 + Math.sin(angle + 0.3) * 12;

      arc.setAttribute('d', `M${startX},${startY} Q${controlX},${controlY} ${endX},${endY}`);
      arc.setAttribute('fill', 'none');
      arc.setAttribute('stroke', colors.primary);
      arc.setAttribute('stroke-width', '2');
      arc.setAttribute('filter', 'url(#glow)');

      // Flicker animation
      const flickerAnim = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
      flickerAnim.setAttribute('attributeName', 'opacity');
      flickerAnim.setAttribute('values', '0.5;1;0.7;1;0.5');
      flickerAnim.setAttribute('dur', `${0.3 + i * 0.1}s`);
      flickerAnim.setAttribute('repeatCount', 'indefinite');
      arc.appendChild(flickerAnim);

      g.appendChild(arc);
    }
  },

  // Hull icon - layered armor plates
  _renderHull(g, size, tier, state) {
    const colors = this.PARTS.hull.colors;

    // Base plate
    const basePlate = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    basePlate.setAttribute('x', '10');
    basePlate.setAttribute('y', '14');
    basePlate.setAttribute('width', '28');
    basePlate.setAttribute('height', '20');
    basePlate.setAttribute('rx', '2');
    basePlate.setAttribute('fill', colors.secondary);
    basePlate.setAttribute('stroke', colors.primary);
    basePlate.setAttribute('stroke-width', '1');
    g.appendChild(basePlate);

    // Armor layers (based on tier)
    for (let i = 0; i < Math.min(tier, 3); i++) {
      const layer = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      layer.setAttribute('x', (12 + i * 2).toString());
      layer.setAttribute('y', (16 + i * 2).toString());
      layer.setAttribute('width', (24 - i * 4).toString());
      layer.setAttribute('height', (16 - i * 4).toString());
      layer.setAttribute('rx', '1');
      layer.setAttribute('fill', 'none');
      layer.setAttribute('stroke', colors.accent);
      layer.setAttribute('stroke-width', '1');
      layer.setAttribute('opacity', (0.8 - i * 0.2).toString());
      g.appendChild(layer);
    }

    // Rivets
    const rivetPositions = [[14, 18], [34, 18], [14, 30], [34, 30]];
    for (let i = 0; i < Math.min(tier + 1, rivetPositions.length); i++) {
      const rivet = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      rivet.setAttribute('cx', rivetPositions[i][0].toString());
      rivet.setAttribute('cy', rivetPositions[i][1].toString());
      rivet.setAttribute('r', '2');
      rivet.setAttribute('fill', colors.primary);
      g.appendChild(rivet);
    }

    // Reinforcement pattern for tier 4+
    if (tier >= 4) {
      const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pattern.setAttribute('d', 'M16,24 L32,24 M24,18 L24,30');
      pattern.setAttribute('stroke', colors.accent);
      pattern.setAttribute('stroke-width', '1');
      pattern.setAttribute('opacity', '0.5');
      g.appendChild(pattern);
    }

    // Metallic sheen animation for tier 5
    if (tier >= 5) {
      const sheen = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      sheen.setAttribute('x', '10');
      sheen.setAttribute('y', '14');
      sheen.setAttribute('width', '4');
      sheen.setAttribute('height', '20');
      sheen.setAttribute('fill', 'url(#mainGrad)');
      sheen.setAttribute('opacity', '0.3');

      const sheenAnim = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
      sheenAnim.setAttribute('attributeName', 'x');
      sheenAnim.setAttribute('values', '10;34;10');
      sheenAnim.setAttribute('dur', '3s');
      sheenAnim.setAttribute('repeatCount', 'indefinite');
      sheen.appendChild(sheenAnim);

      g.appendChild(sheen);
    }
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.ShipPartShape = ShipPartShape;
}
