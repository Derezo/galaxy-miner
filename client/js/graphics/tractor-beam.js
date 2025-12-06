/**
 * Tractor Beam Renderer
 * Renders mining beam effects with 5 tier styles
 */

const RESOURCE_COLORS = {
  iron: '#888899',
  silicon: '#aabbcc',
  carbon: '#556666',
  copper: '#cc7744',
  titanium: '#99aacc',
  hydrogen: '#aaddff',
  gold: '#ffdd44',
  platinum: '#ddddee',
  helium3: '#ff88ff',
  uranium: '#44ff66',
  darkMatter: '#8844ff',
  antimatter: '#ff4488',
  exoticMatter: '#44ffff',
  default: '#88ffff'
};

const BEAM_CONFIG = {
  1: { style: 'single', width: 8, particleCount: 15, pulseSpeed: 0, color: { beam: '#88ffff', core: '#ffffff' } },
  2: { style: 'single', width: 12, particleCount: 20, pulseSpeed: 3, color: { beam: '#66eeff', core: '#ffffff' } },
  3: { style: 'dual', width: 8, particleCount: 25, pulseSpeed: 4, separation: 12, color: { beam: '#44ddff', core: '#ccffff' } },
  4: { style: 'focused', width: 16, particleCount: 30, pulseSpeed: 6, color: { beam: '#22ccff', core: '#ffffff' }, hasTerminus: true },
  5: { style: 'tendril', width: 6, tendrilCount: 4, particleCount: 35, pulseSpeed: 8, color: { beam: '#00bbff', core: '#88ffff' }, hasGraviton: true }
};

const TractorBeamRenderer = {
  particleAccumulator: 0,
  tendrilPhases: [0, 0.7, 1.4, 2.1],

  draw(ctx, sourcePos, targetPos, camera, tier, progress, resourceType, dt) {
    if (progress <= 0) return;

    const config = BEAM_CONFIG[tier] || BEAM_CONFIG[1];

    const source = { x: sourcePos.x - camera.x, y: sourcePos.y - camera.y };
    const target = { x: targetPos.x - camera.x, y: targetPos.y - camera.y };

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    const intensity = this.calculateIntensity(progress);
    const particleColor = RESOURCE_COLORS[resourceType] || RESOURCE_COLORS.default;

    ctx.save();

    switch (config.style) {
      case 'single':
        this.drawSingleBeam(ctx, source, target, distance, angle, config, intensity);
        break;
      case 'dual':
        this.drawDualBeam(ctx, source, target, distance, angle, config, intensity);
        break;
      case 'focused':
        this.drawFocusedBeam(ctx, source, target, distance, angle, config, intensity);
        break;
      case 'tendril':
        this.drawTendrilBeam(ctx, source, target, distance, angle, config, intensity, dt);
        break;
    }

    ctx.restore();

    this.spawnParticles(targetPos, sourcePos, particleColor, config, progress, dt);
  },

  calculateIntensity(progress) {
    if (progress < 0.25) return 0.3 + (progress / 0.25) * 0.4;
    if (progress < 0.75) return 0.7 + (progress - 0.25) * 0.2;
    return 0.8 + (progress - 0.75) * 0.8;
  },

  drawSingleBeam(ctx, source, target, distance, angle, config, intensity) {
    const time = Date.now() * 0.001 * config.pulseSpeed;
    const pulseWidth = 1 + Math.sin(time) * 0.2;
    const width = config.width * pulseWidth * intensity;

    const gradient = ctx.createLinearGradient(source.x, source.y, target.x, target.y);
    gradient.addColorStop(0, config.color.beam + 'cc');
    gradient.addColorStop(0.5, config.color.beam);
    gradient.addColorStop(1, config.color.beam + '88');

    ctx.strokeStyle = gradient;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.globalAlpha = intensity * 0.8;

    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();

    ctx.strokeStyle = config.color.core;
    ctx.lineWidth = width * 0.3;
    ctx.globalAlpha = intensity * 0.6;
    ctx.stroke();
  },

  drawDualBeam(ctx, source, target, distance, angle, config, intensity) {
    const time = Date.now() * 0.001 * config.pulseSpeed;
    const wave = Math.sin(time) * 2;
    const separation = config.separation;

    const perpX = Math.cos(angle + Math.PI / 2);
    const perpY = Math.sin(angle + Math.PI / 2);

    for (let i = -1; i <= 1; i += 2) {
      const offset = (separation / 2 + wave) * i;

      const beamSource = { x: source.x + perpX * offset, y: source.y + perpY * offset };
      const beamTarget = { x: target.x + perpX * offset * 0.5, y: target.y + perpY * offset * 0.5 };

      const gradient = ctx.createLinearGradient(beamSource.x, beamSource.y, beamTarget.x, beamTarget.y);
      gradient.addColorStop(0, config.color.beam + 'aa');
      gradient.addColorStop(0.5, config.color.beam);
      gradient.addColorStop(1, config.color.beam + '66');

      ctx.strokeStyle = gradient;
      ctx.lineWidth = config.width * intensity;
      ctx.lineCap = 'round';
      ctx.globalAlpha = intensity * 0.7;

      ctx.beginPath();
      ctx.moveTo(beamSource.x, beamSource.y);
      const midX = (beamSource.x + beamTarget.x) / 2 + perpX * wave * -i * 2;
      const midY = (beamSource.y + beamTarget.y) / 2 + perpY * wave * -i * 2;
      ctx.quadraticCurveTo(midX, midY, beamTarget.x, beamTarget.y);
      ctx.stroke();
    }
  },

  drawFocusedBeam(ctx, source, target, distance, angle, config, intensity) {
    const time = Date.now() * 0.001 * config.pulseSpeed;
    const width = config.width * intensity;

    const gradient = ctx.createLinearGradient(source.x, source.y, target.x, target.y);
    gradient.addColorStop(0, config.color.beam + 'dd');
    gradient.addColorStop(0.7, config.color.beam);
    gradient.addColorStop(1, config.color.core);

    ctx.strokeStyle = gradient;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.globalAlpha = intensity * 0.9;

    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();

    if (config.hasTerminus) {
      const terminusRadius = width * 0.8 * (1 + Math.sin(time * 2) * 0.2);
      const terminusGradient = ctx.createRadialGradient(target.x, target.y, 0, target.x, target.y, terminusRadius);
      terminusGradient.addColorStop(0, config.color.core);
      terminusGradient.addColorStop(0.5, config.color.beam);
      terminusGradient.addColorStop(1, 'transparent');

      ctx.fillStyle = terminusGradient;
      ctx.globalAlpha = intensity;
      ctx.beginPath();
      ctx.arc(target.x, target.y, terminusRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  drawTendrilBeam(ctx, source, target, distance, angle, config, intensity, dt) {
    const time = Date.now() * 0.001;

    for (let i = 0; i < this.tendrilPhases.length; i++) {
      this.tendrilPhases[i] += dt * (2 + i * 0.3);
    }

    const tendrilCount = config.tendrilCount;

    for (let i = 0; i < tendrilCount; i++) {
      const phase = this.tendrilPhases[i] || 0;
      const offsetAngle = (i / tendrilCount) * Math.PI * 2 + phase;

      const attachRadius = 15;
      const attachOffset = { x: Math.cos(offsetAngle) * attachRadius, y: Math.sin(offsetAngle) * attachRadius };
      const tendrilTarget = { x: target.x + attachOffset.x, y: target.y + attachOffset.y };

      const midPoint = {
        x: (source.x + tendrilTarget.x) / 2 + Math.sin(phase * 2 + i) * 20,
        y: (source.y + tendrilTarget.y) / 2 + Math.cos(phase * 2 + i) * 20
      };

      const gradient = ctx.createLinearGradient(source.x, source.y, tendrilTarget.x, tendrilTarget.y);
      gradient.addColorStop(0, config.color.beam + 'cc');
      gradient.addColorStop(0.5, config.color.beam);
      gradient.addColorStop(1, config.color.core);

      ctx.strokeStyle = gradient;
      ctx.lineWidth = config.width * intensity;
      ctx.lineCap = 'round';
      ctx.globalAlpha = intensity * 0.7;

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.quadraticCurveTo(midPoint.x, midPoint.y, tendrilTarget.x, tendrilTarget.y);
      ctx.stroke();
    }

    if (config.hasGraviton) {
      this.drawGravitonRing(ctx, target, intensity, time);
    }
  },

  drawGravitonRing(ctx, target, intensity, time) {
    const ringCount = 3;
    const baseRadius = 25;

    for (let i = 0; i < ringCount; i++) {
      const phase = (time * 2 + i * 0.5) % 1;
      const radius = baseRadius * (0.5 + phase * 0.8);
      const alpha = (1 - phase) * intensity * 0.5;

      ctx.strokeStyle = '#8844ff';
      ctx.lineWidth = 2;
      ctx.globalAlpha = alpha;

      ctx.beginPath();
      ctx.arc(target.x, target.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    const distortGradient = ctx.createRadialGradient(target.x, target.y, 0, target.x, target.y, baseRadius);
    distortGradient.addColorStop(0, '#8844ff40');
    distortGradient.addColorStop(0.5, '#8844ff20');
    distortGradient.addColorStop(1, 'transparent');

    ctx.fillStyle = distortGradient;
    ctx.globalAlpha = intensity * 0.6;
    ctx.beginPath();
    ctx.arc(target.x, target.y, baseRadius, 0, Math.PI * 2);
    ctx.fill();
  },

  spawnParticles(targetPos, sourcePos, color, config, progress, dt) {
    const speedMultiplier = 1 + progress * 2;
    const spawnRate = config.particleCount * (0.5 + progress * 0.5);

    this.particleAccumulator += spawnRate * dt;

    while (this.particleAccumulator >= 1) {
      this.particleAccumulator -= 1;

      const dx = sourcePos.x - targetPos.x;
      const dy = sourcePos.y - targetPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const dirX = dx / dist;
      const dirY = dy / dist;

      const speed = (100 + Math.random() * 80) * speedMultiplier;
      const wobble = (Math.random() - 0.5) * 30;
      const perpX = -dirY;
      const perpY = dirX;

      ParticleSystem.spawn({
        x: targetPos.x + (Math.random() - 0.5) * 20,
        y: targetPos.y + (Math.random() - 0.5) * 20,
        vx: dirX * speed + perpX * wobble,
        vy: dirY * speed + perpY * wobble,
        life: (dist / speed) * 1000 * 0.8,
        color: color,
        size: 2 + Math.random() * 2,
        type: 'glow',
        drag: 1,
        decay: 1
      });
    }
  }
};
