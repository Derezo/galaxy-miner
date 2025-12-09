/**
 * Tesla Coil Effect
 * Renders electrical discharge on base impacts for Tesla Cannon
 */

const TeslaCoilEffect = {
  coils: [],

  // Tesla color palette
  colors: {
    primary: '#00ccff',
    secondary: '#44ffaa',
    core: '#ffffff',
    glow: '#00ccff60'
  },

  /**
   * Process server tesla coil event
   * @param {Object} data - Tesla coil data from server
   */
  triggerFromEvent(data) {
    const { impactX, impactY, baseSize, duration, targets } = data;

    this.coils.push({
      x: impactX,
      y: impactY,
      baseSize: baseSize || 50,
      startTime: Date.now(),
      duration: duration || 500,
      targets: targets || [],
      // Generate surface crawl paths
      surfacePaths: this.generateSurfacePaths(8, baseSize || 50),
      // Initial spark burst
      burstParticles: this.generateBurstParticles(30)
    });
  },

  /**
   * Generate electrical crawl paths across base surface
   */
  generateSurfacePaths(count, baseSize) {
    const paths = [];
    for (let i = 0; i < count; i++) {
      const startAngle = (i / count) * Math.PI * 2;
      const endAngle = startAngle + (Math.random() - 0.5) * Math.PI * 0.5;

      paths.push({
        startAngle,
        endAngle,
        radius: baseSize * (0.4 + Math.random() * 0.3),
        segments: 4 + Math.floor(Math.random() * 3),
        speed: 0.5 + Math.random() * 0.5,
        offset: Math.random()
      });
    }
    return paths;
  },

  /**
   * Generate initial burst particles
   */
  generateBurstParticles(count) {
    const particles = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 120;
      particles.push({
        x: 0,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        size: 2 + Math.random() * 3
      });
    }
    return particles;
  },

  /**
   * Update tesla coil effects
   */
  update(dt) {
    const now = Date.now();

    // Update coils
    this.coils = this.coils.filter(coil => {
      const elapsed = now - coil.startTime;
      if (elapsed >= coil.duration) return false;

      // Update burst particles
      const progress = elapsed / coil.duration;
      for (const particle of coil.burstParticles) {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vx *= 0.95;
        particle.vy *= 0.95;
        particle.life = 1 - progress;
      }

      return true;
    });
  },

  /**
   * Draw all active tesla coil effects
   */
  draw(ctx, camera) {
    const now = Date.now();

    for (const coil of this.coils) {
      const elapsed = now - coil.startTime;
      const progress = elapsed / coil.duration;
      const alpha = 1 - progress * progress; // Ease out

      const screenX = coil.x - camera.x;
      const screenY = coil.y - camera.y;

      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.globalAlpha = alpha;

      // Draw central glow
      this.drawCentralGlow(ctx, coil, progress);

      // Draw surface crawl electricity
      this.drawSurfaceCrawl(ctx, coil, progress, now);

      // Draw arcs to nearby NPCs
      this.drawTargetArcs(ctx, coil, progress, camera);

      // Draw burst particles
      this.drawBurstParticles(ctx, coil, progress);

      ctx.restore();
    }
  },

  /**
   * Draw central discharge glow
   */
  drawCentralGlow(ctx, coil, progress) {
    const pulseScale = 1 + Math.sin(progress * Math.PI * 4) * 0.2;
    const glowSize = 25 * pulseScale * (1 - progress * 0.5);

    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, glowSize);
    gradient.addColorStop(0, this.colors.core);
    gradient.addColorStop(0.3, this.colors.secondary);
    gradient.addColorStop(0.6, this.colors.primary);
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, glowSize, 0, Math.PI * 2);
    ctx.fill();
  },

  /**
   * Draw electrical lines crawling across base surface
   */
  drawSurfaceCrawl(ctx, coil, progress, now) {
    const time = now * 0.001;

    for (const path of coil.surfacePaths) {
      const crawlProgress = ((time * path.speed + path.offset) % 1);
      const fadeIn = Math.min(crawlProgress * 4, 1);
      const fadeOut = 1 - Math.max((crawlProgress - 0.75) * 4, 0);
      const pathAlpha = fadeIn * fadeOut * (1 - progress);

      if (pathAlpha <= 0) continue;

      ctx.globalAlpha = pathAlpha;

      // Glow layer
      ctx.strokeStyle = this.colors.glow;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      this.strokeSurfacePath(ctx, path, coil.baseSize, crawlProgress);

      // Primary layer
      ctx.strokeStyle = this.colors.primary;
      ctx.lineWidth = 2;
      this.strokeSurfacePath(ctx, path, coil.baseSize, crawlProgress);

      // Core layer
      ctx.strokeStyle = this.colors.core;
      ctx.lineWidth = 1;
      this.strokeSurfacePath(ctx, path, coil.baseSize, crawlProgress);
    }
  },

  /**
   * Stroke a single surface crawl path
   */
  strokeSurfacePath(ctx, path, baseSize, crawlProgress) {
    ctx.beginPath();

    const angleRange = path.endAngle - path.startAngle;
    const currentEndProgress = Math.min(crawlProgress * 1.5, 1);

    for (let i = 0; i <= path.segments; i++) {
      const t = (i / path.segments) * currentEndProgress;
      const angle = path.startAngle + angleRange * t;
      const radiusJitter = (Math.sin(i * 3.7 + Date.now() * 0.01) * 0.1 + 1) * path.radius;

      const x = Math.cos(angle) * radiusJitter;
      const y = Math.sin(angle) * radiusJitter;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
  },

  /**
   * Draw lightning arcs to nearby NPCs
   */
  drawTargetArcs(ctx, coil, progress, camera) {
    if (!coil.targets || coil.targets.length === 0) return;

    const arcAlpha = Math.sin(progress * Math.PI) * 0.8;
    if (arcAlpha <= 0) return;

    ctx.globalAlpha = arcAlpha;

    for (const target of coil.targets) {
      // Target position relative to coil (coil is at origin after translate)
      const targetX = target.x - coil.x;
      const targetY = target.y - coil.y;

      // Draw 3-layer arc
      this.drawArcToTarget(ctx, 0, 0, targetX, targetY, progress);
    }
  },

  /**
   * Draw a single arc to target
   */
  drawArcToTarget(ctx, startX, startY, endX, endY, progress) {
    const segments = 8;
    const points = [{ x: startX, y: startY }];

    const dx = endX - startX;
    const dy = endY - startY;
    const perpAngle = Math.atan2(dy, dx) + Math.PI / 2;
    const amplitude = 15 * (1 - progress * 0.5);

    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const baseX = startX + dx * t;
      const baseY = startY + dy * t;

      const jitter = (Math.sin(t * Math.PI * 3 + Date.now() * 0.015) + Math.random() - 0.5) * amplitude;

      points.push({
        x: baseX + Math.cos(perpAngle) * jitter,
        y: baseY + Math.sin(perpAngle) * jitter
      });
    }

    points.push({ x: endX, y: endY });

    // Glow layer
    ctx.strokeStyle = this.colors.glow;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    this.strokePoints(ctx, points);

    // Primary layer
    ctx.strokeStyle = this.colors.primary;
    ctx.lineWidth = 3;
    this.strokePoints(ctx, points);

    // Core layer
    ctx.strokeStyle = this.colors.core;
    ctx.lineWidth = 1.5;
    this.strokePoints(ctx, points);
  },

  /**
   * Stroke through points
   */
  strokePoints(ctx, points) {
    if (points.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }

    ctx.stroke();
  },

  /**
   * Draw initial burst particles
   */
  drawBurstParticles(ctx, coil, progress) {
    if (progress > 0.5) return; // Only visible in first half

    const particleAlpha = 1 - progress * 2;

    for (const particle of coil.burstParticles) {
      if (particle.life <= 0) continue;

      ctx.globalAlpha = particleAlpha * particle.life;

      const gradient = ctx.createRadialGradient(
        particle.x, particle.y, 0,
        particle.x, particle.y, particle.size * particle.life
      );
      gradient.addColorStop(0, this.colors.core);
      gradient.addColorStop(0.5, this.colors.primary);
      gradient.addColorStop(1, 'transparent');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * particle.life * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  /**
   * Clear all effects
   */
  clear() {
    this.coils = [];
  }
};
