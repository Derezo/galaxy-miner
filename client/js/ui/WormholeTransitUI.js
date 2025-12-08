/**
 * Wormhole Transit UI
 * Full-screen overlay for wormhole destination selection and transit animation
 */

const WormholeTransitUI = {
  visible: false,
  phase: null,  // 'selecting' | 'transit'
  destinations: [],
  selectedDestination: null,
  transitDuration: 5000,
  transitProgress: 0,

  // Animation state
  animationFrame: null,
  startTime: 0,
  spiralAngle: 0,
  particles: [],

  // DOM elements
  overlay: null,
  canvas: null,
  ctx: null,
  destinationsContainer: null,
  progressBar: null,
  cancelBtn: null,

  /**
   * Initialize the UI - create DOM elements
   */
  init() {
    // Create overlay container
    this.overlay = document.createElement('div');
    this.overlay.id = 'wormhole-transit-overlay';
    this.overlay.className = 'wormhole-transit-overlay hidden';

    this.overlay.innerHTML = `
      <canvas id="wormhole-transit-canvas"></canvas>
      <div class="wormhole-transit-content">
        <div class="wormhole-title">WORMHOLE TRANSIT</div>
        <div class="wormhole-destinations"></div>
        <div class="wormhole-progress hidden">
          <div class="progress-label">Transiting...</div>
          <div class="progress-bar-container">
            <div class="progress-bar-fill"></div>
          </div>
        </div>
        <button class="wormhole-cancel-btn">Cancel (ESC)</button>
      </div>
    `;

    document.getElementById('ui-container').appendChild(this.overlay);

    // Get references
    this.canvas = document.getElementById('wormhole-transit-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.destinationsContainer = this.overlay.querySelector('.wormhole-destinations');
    this.progressBar = this.overlay.querySelector('.wormhole-progress');
    this.cancelBtn = this.overlay.querySelector('.wormhole-cancel-btn');

    // Size canvas
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Cancel button handler
    this.cancelBtn.addEventListener('click', () => {
      if (this.phase === 'selecting') {
        Player.cancelWormholeTransit();
      }
    });

    Logger.log('WormholeTransitUI initialized');
  },

  /**
   * Resize canvas to fill screen
   */
  resizeCanvas() {
    if (this.canvas) {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }
  },

  /**
   * Show the transit UI with destination options
   * @param {Array} destinations - Array of wormhole destinations
   */
  show(destinations) {
    this.visible = true;
    this.phase = 'selecting';
    this.destinations = destinations || [];
    this.transitProgress = 0;
    this.particles = [];
    this.spiralAngle = 0;

    // Show overlay
    this.overlay.classList.remove('hidden');
    this.progressBar.classList.add('hidden');
    this.cancelBtn.classList.remove('hidden');

    // Render destination buttons
    this.renderDestinations();

    // Start animation loop
    this.startAnimation();
  },

  /**
   * Render destination selection buttons in cardinal positions around wormhole
   */
  renderDestinations() {
    this.destinationsContainer.innerHTML = '';

    if (this.destinations.length === 0) {
      this.destinationsContainer.innerHTML = '<div class="no-destinations">No destinations available</div>';
      return;
    }

    // Cardinal positions: top, right, bottom, left (+ diagonal for 5th)
    // Each position is defined relative to center with button dimensions considered
    const buttonWidth = 160;
    const buttonHeight = 70;
    const wormholeRadius = 120; // Clear the wormhole visualization
    const padding = 30;

    const positions = [
      { // Top
        x: -buttonWidth / 2,
        y: -(wormholeRadius + buttonHeight + padding)
      },
      { // Right
        x: wormholeRadius + padding,
        y: -buttonHeight / 2
      },
      { // Bottom
        x: -buttonWidth / 2,
        y: wormholeRadius + padding
      },
      { // Left
        x: -(wormholeRadius + buttonWidth + padding),
        y: -buttonHeight / 2
      },
      { // Top-right diagonal (for 5th destination)
        x: wormholeRadius * 0.7 + padding,
        y: -(wormholeRadius * 0.7 + buttonHeight + padding * 0.5)
      }
    ];

    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    this.destinations.forEach((dest, index) => {
      if (index >= positions.length) return; // Max 5 destinations

      const pos = positions[index];
      const x = centerX + pos.x;
      const y = centerY + pos.y;

      const btn = document.createElement('button');
      btn.className = 'wormhole-destination-btn';
      btn.dataset.position = ['top', 'right', 'bottom', 'left', 'top-right'][index];
      btn.style.left = `${x}px`;
      btn.style.top = `${y}px`;

      btn.innerHTML = `
        <div class="dest-sector">Sector ${dest.sectorX}, ${dest.sectorY}</div>
        <div class="dest-distance">${this.formatDistance(dest.distance)}</div>
      `;

      btn.addEventListener('click', () => {
        this.selectDestination(dest);
      });

      this.destinationsContainer.appendChild(btn);
    });
  },

  /**
   * Format distance for display
   * @param {number} distance - Distance in world units
   * @returns {string}
   */
  formatDistance(distance) {
    if (distance < 1000) {
      return `${Math.round(distance)} units`;
    }
    return `${(distance / 1000).toFixed(1)}k units`;
  },

  /**
   * Handle destination selection
   * @param {Object} destination - Selected destination
   */
  selectDestination(destination) {
    this.selectedDestination = destination;
    Player.selectWormholeDestination(destination.id);

    // Disable other buttons visually
    const buttons = this.destinationsContainer.querySelectorAll('.wormhole-destination-btn');
    buttons.forEach(btn => btn.classList.add('disabled'));
  },

  /**
   * Start the transit animation
   * @param {number} duration - Transit duration in ms
   * @param {Object} destination - Destination wormhole
   */
  startTransit(duration, destination) {
    this.phase = 'transit';
    this.transitDuration = duration;
    this.selectedDestination = destination;
    this.startTime = Date.now();
    this.transitProgress = 0;

    // Hide destination buttons, show progress
    this.destinationsContainer.innerHTML = '';
    this.progressBar.classList.remove('hidden');
    this.cancelBtn.classList.add('hidden');

    // Spawn initial transit particles
    this.spawnTransitParticles(100);
  },

  /**
   * Update transit progress
   * @param {number} progress - Progress 0-1
   */
  updateProgress(progress) {
    this.transitProgress = progress;

    // Update progress bar
    const fill = this.progressBar.querySelector('.progress-bar-fill');
    if (fill) {
      fill.style.width = `${progress * 100}%`;
    }

    // Add more particles as we progress
    if (progress > 0.2 && this.particles.length < 200) {
      this.spawnTransitParticles(20);
    }
  },

  /**
   * Spawn particles for transit tunnel effect
   * @param {number} count - Number of particles to spawn
   */
  spawnTransitParticles(count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 50 + Math.random() * 300;

      this.particles.push({
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        z: Math.random() * 500 + 100,
        speed: 200 + Math.random() * 300,
        color: this.getParticleColor(),
        size: 2 + Math.random() * 4
      });
    }
  },

  /**
   * Get random particle color (cyan, blue, orange, white - matching wormhole style)
   * @returns {string}
   */
  getParticleColor() {
    const colors = [
      '#00ffff', '#88ddff', '#4488ff', '#0066cc',
      '#ff8844', '#ffaa44', '#ffcc66',
      '#ffffff', '#aaddff', '#00ccff'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  },

  /**
   * Hide the transit UI
   */
  hide() {
    this.visible = false;
    this.phase = null;
    this.overlay.classList.add('hidden');

    // Stop animation
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    // Clear particles
    this.particles = [];
  },

  /**
   * Start the animation loop
   */
  startAnimation() {
    const animate = () => {
      if (!this.visible) return;

      this.render();
      this.animationFrame = requestAnimationFrame(animate);
    };

    animate();
  },

  /**
   * Render the wormhole effect on canvas
   */
  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    // Clear with fade effect - darker background
    ctx.fillStyle = 'rgba(0, 5, 15, 0.25)';
    ctx.fillRect(0, 0, w, h);

    // Update spiral angle - faster rotation
    this.spiralAngle += 0.035;

    if (this.phase === 'selecting') {
      this.renderSelectingPhase(ctx, cx, cy);
    } else if (this.phase === 'transit') {
      this.renderTransitPhase(ctx, cx, cy);
    }

    // Render central wormhole
    this.renderWormholeCenter(ctx, cx, cy);
  },

  /**
   * Render ambient effect during destination selection
   */
  renderSelectingPhase(ctx, cx, cy) {
    // Ambient swirl rings - cyan/blue colors
    const ringColors = ['#00ffff', '#4488ff', '#00ccff', '#88ddff', '#0066cc'];
    for (let i = 0; i < 5; i++) {
      const radius = 100 + i * 45;
      const alpha = 0.35 - i * 0.05;

      ctx.strokeStyle = ringColors[i];
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, this.spiralAngle + i * 0.5, this.spiralAngle + i * 0.5 + Math.PI * 1.5);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;

    // Floating particles being pulled in - mixed colors
    const particleColors = ['#00ffff', '#ff8844', '#ffffff', '#88ddff', '#ffaa44'];
    for (let i = 0; i < 40; i++) {
      const angle = this.spiralAngle * 1.5 + (i / 40) * Math.PI * 2;
      const spiralOffset = (i / 40) * Math.PI * 2;
      const r = 180 + Math.sin(angle * 3 + this.spiralAngle * 2) * 60 - (i % 10) * 5;
      const x = cx + Math.cos(angle + spiralOffset * 0.3) * r;
      const y = cy + Math.sin(angle + spiralOffset * 0.3) * r;

      ctx.beginPath();
      ctx.arc(x, y, 2 + Math.sin(angle * 5) * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = particleColors[i % particleColors.length];
      ctx.globalAlpha = 0.5 + Math.sin(angle * 2 + this.spiralAngle) * 0.3;
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  },

  /**
   * Render tunnel effect during transit
   */
  renderTransitPhase(ctx, cx, cy) {
    // Update and render particles
    const dt = 0.016; // ~60fps
    const speed = 1 + this.transitProgress * 2; // Speed up as we progress

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // Move toward camera (z decreases)
      p.z -= p.speed * speed * dt;

      // Remove if passed camera
      if (p.z <= 0) {
        this.particles.splice(i, 1);
        // Respawn at far end
        this.spawnTransitParticles(1);
        continue;
      }

      // Project 3D to 2D
      const scale = 300 / p.z;
      const x = cx + p.x * scale;
      const y = cy + p.y * scale;
      const size = p.size * scale;

      // Skip if off screen
      if (x < -50 || x > ctx.canvas.width + 50 || y < -50 || y > ctx.canvas.height + 50) continue;

      // Draw particle with motion blur
      const alpha = Math.min(1, (500 - p.z) / 200);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha * 0.8;

      // Streak effect
      ctx.beginPath();
      ctx.ellipse(x, y, size * 0.5, size * 2, Math.atan2(p.y, p.x), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;

    // Screen shake at high progress
    if (this.transitProgress > 0.7) {
      const shake = (this.transitProgress - 0.7) * 10;
      this.overlay.style.transform = `translate(${(Math.random() - 0.5) * shake}px, ${(Math.random() - 0.5) * shake}px)`;
    } else {
      this.overlay.style.transform = '';
    }
  },

  /**
   * Render the central wormhole portal
   */
  renderWormholeCenter(ctx, cx, cy) {
    const time = Date.now() / 1000;

    // Outer glow - reversed gradient (bright center, dark outer, transparent edge)
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 100);
    gradient.addColorStop(0, 'rgba(200, 230, 255, 0.9)');   // Bright center
    gradient.addColorStop(0.2, 'rgba(0, 200, 255, 0.6)');   // Cyan
    gradient.addColorStop(0.5, 'rgba(0, 100, 180, 0.3)');   // Deep blue
    gradient.addColorStop(0.8, 'rgba(10, 30, 60, 0.15)');   // Dark blue
    gradient.addColorStop(1, 'transparent');                 // No border

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, 100, 0, Math.PI * 2);
    ctx.fill();

    // Multiple spiral arms with mixed colors
    const armColors = ['#00ffff', '#ff8844', '#4488ff', '#88ddff', '#ffaa44', '#00ccff'];
    for (let arm = 0; arm < 6; arm++) {
      const rotationSpeed = 1.8 + (arm % 2) * 0.4;
      const baseRotation = this.spiralAngle * rotationSpeed + (arm / 6) * Math.PI * 2;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(baseRotation);

      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const angle = t * Math.PI * 3;  // Spiral turns
        const radius = 80 - 70 * Math.pow(t, 0.7);
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }

      ctx.strokeStyle = armColors[arm];
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = 0.5 + Math.sin(time * 5 + arm) * 0.25;
      ctx.stroke();
      ctx.restore();
    }

    ctx.globalAlpha = 1;

    // Pulsing ring effect
    const ringPhase = (time * 2) % 1;
    const ringRadius = 20 + ringPhase * 60;
    const ringAlpha = 0.5 * (1 - ringPhase);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = ringAlpha;
    ctx.beginPath();
    ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 1;

    // Bright center core with glow
    const coreGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30);
    coreGlow.addColorStop(0, 'rgba(255, 255, 255, 1)');
    coreGlow.addColorStop(0.3, 'rgba(180, 230, 255, 0.8)');
    coreGlow.addColorStop(0.7, 'rgba(0, 200, 255, 0.4)');
    coreGlow.addColorStop(1, 'transparent');

    ctx.fillStyle = coreGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    ctx.fill();

    // Inner pulsing white core
    const corePulse = 0.7 + Math.sin(time * 8) * 0.3;
    ctx.fillStyle = `rgba(255, 255, 255, ${corePulse})`;
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fill();
  }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => WormholeTransitUI.init());
} else {
  // DOM already loaded
  setTimeout(() => WormholeTransitUI.init(), 0);
}
