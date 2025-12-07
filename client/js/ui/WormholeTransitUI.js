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

    console.log('WormholeTransitUI initialized');
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
   * Render destination selection buttons
   */
  renderDestinations() {
    this.destinationsContainer.innerHTML = '';

    if (this.destinations.length === 0) {
      this.destinationsContainer.innerHTML = '<div class="no-destinations">No destinations available</div>';
      return;
    }

    // Position destinations in a circle
    const radius = Math.min(200, window.innerWidth * 0.2);
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    this.destinations.forEach((dest, index) => {
      const angle = (index / this.destinations.length) * Math.PI * 2 - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius - 80; // -80 to center button
      const y = centerY + Math.sin(angle) * radius - 40; // -40 to center button

      const btn = document.createElement('button');
      btn.className = 'wormhole-destination-btn';
      btn.style.left = `${x}px`;
      btn.style.top = `${y}px`;

      // Format distance
      const distanceKm = Math.round(dest.distance / 10); // Approximate scale

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
   * Get random particle color (purples and blues)
   * @returns {string}
   */
  getParticleColor() {
    const colors = [
      '#9900ff', '#6600cc', '#cc00ff', '#aa00ff',
      '#7700dd', '#5500bb', '#dd00ff', '#8800ee',
      '#ffffff', '#ccccff'
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

    // Clear with fade effect
    ctx.fillStyle = 'rgba(5, 0, 15, 0.3)';
    ctx.fillRect(0, 0, w, h);

    // Update spiral angle
    this.spiralAngle += 0.02;

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
    // Ambient swirl rings
    for (let i = 0; i < 5; i++) {
      const radius = 100 + i * 40;
      const alpha = 0.3 - i * 0.05;

      ctx.strokeStyle = `rgba(153, 0, 255, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, this.spiralAngle + i * 0.5, this.spiralAngle + i * 0.5 + Math.PI * 1.5);
      ctx.stroke();
    }

    // Floating particles
    for (let i = 0; i < 30; i++) {
      const angle = this.spiralAngle + (i / 30) * Math.PI * 2;
      const r = 150 + Math.sin(angle * 3 + this.spiralAngle) * 50;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;

      ctx.beginPath();
      ctx.arc(x, y, 2 + Math.sin(angle * 5) * 1, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200, 100, 255, ${0.5 + Math.sin(angle * 2) * 0.3})`;
      ctx.fill();
    }
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
    // Outer glow
    const gradient = ctx.createRadialGradient(cx, cy, 20, cx, cy, 100);
    gradient.addColorStop(0, 'rgba(153, 0, 255, 0.8)');
    gradient.addColorStop(0.3, 'rgba(100, 0, 200, 0.5)');
    gradient.addColorStop(0.7, 'rgba(50, 0, 100, 0.2)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, 100, 0, Math.PI * 2);
    ctx.fill();

    // Inner spiral
    ctx.strokeStyle = 'rgba(200, 100, 255, 0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();

    for (let i = 0; i < 100; i++) {
      const angle = this.spiralAngle + (i / 100) * Math.PI * 4;
      const r = 10 + (i / 100) * 50;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Dark center
    const centerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 25);
    centerGrad.addColorStop(0, 'rgba(0, 0, 20, 1)');
    centerGrad.addColorStop(1, 'rgba(50, 0, 80, 0.5)');

    ctx.fillStyle = centerGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 25, 0, Math.PI * 2);
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
