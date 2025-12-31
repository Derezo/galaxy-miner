/**
 * Respawn Location UI
 * Full-screen overlay for selecting respawn location after death
 * Follows the WormholeTransitUI pattern
 */

const RespawnLocationUI = {
  visible: false,
  respawnOptions: null,
  selectedOption: null,
  autoRespawnTimer: null,
  autoRespawnCountdown: 30, // 30 seconds until auto-respawn

  // Animation state
  animationFrame: null,
  startTime: 0,
  particles: [],

  // DOM elements
  overlay: null,
  canvas: null,
  ctx: null,
  optionsContainer: null,
  timerDisplay: null,

  /**
   * Initialize the UI - create DOM elements
   */
  init() {
    // Create overlay container
    this.overlay = document.createElement('div');
    this.overlay.id = 'respawn-location-overlay';
    this.overlay.className = 'respawn-location-overlay hidden';

    this.overlay.innerHTML = `
      <canvas id="respawn-location-canvas"></canvas>
      <div class="respawn-content">
        <div class="respawn-title">CHOOSE RESPAWN LOCATION</div>
        <div class="respawn-options"></div>
        <div class="respawn-timer">
          Auto-respawn in: <span class="timer-value">30</span>s
        </div>
      </div>
    `;

    document.getElementById('ui-container').appendChild(this.overlay);

    // Get references
    this.canvas = document.getElementById('respawn-location-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.optionsContainer = this.overlay.querySelector('.respawn-options');
    this.timerDisplay = this.overlay.querySelector('.timer-value');

    // Size canvas
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    Logger.log('RespawnLocationUI initialized');
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
   * Show the respawn location selector
   * @param {Object} options - Respawn options from server
   */
  show(options) {
    this.visible = true;
    this.respawnOptions = options || {};
    this.selectedOption = null;
    this.particles = [];
    this.startTime = Date.now();
    this.autoRespawnCountdown = 30;

    // Show overlay
    this.overlay.classList.remove('hidden');

    // Render option buttons
    this.renderOptions();

    // Start animation loop
    this.startAnimation();

    // Start auto-respawn timer
    this.startAutoRespawnTimer();
  },

  /**
   * Render respawn option buttons
   */
  renderOptions() {
    this.optionsContainer.innerHTML = '';

    // Deep Space option (always available)
    if (this.respawnOptions.deepSpace?.available !== false) {
      const btn = this.createOptionButton({
        type: 'deep_space',
        icon: '&#10026;', // Star symbol
        name: 'Deep Space',
        description: 'Safe start in empty void',
        recommended: true
      });
      this.optionsContainer.appendChild(btn);
    }

    // Last Safe Location option
    if (this.respawnOptions.lastSafe?.available) {
      const btn = this.createOptionButton({
        type: 'last_safe',
        icon: '&#128205;', // Pin symbol
        name: 'Last Safe Location',
        description: 'Return to your last known safe area'
      });
      this.optionsContainer.appendChild(btn);
    }

    // Faction base options
    if (this.respawnOptions.factionBases && this.respawnOptions.factionBases.length > 0) {
      for (const base of this.respawnOptions.factionBases) {
        const btn = this.createOptionButton({
          type: 'faction_base',
          targetId: base.id,
          icon: '&#9733;', // Star
          name: base.name,
          description: `${base.faction} base - ${this.formatDistance(base.distance)}`
        });
        this.optionsContainer.appendChild(btn);
      }
    }
  },

  /**
   * Create an option button element
   * @param {Object} option - Option configuration
   * @returns {HTMLElement} Button element
   */
  createOptionButton(option) {
    const btn = document.createElement('button');
    btn.className = 'respawn-option' + (option.recommended ? ' recommended' : '');
    btn.dataset.type = option.type;
    if (option.targetId) {
      btn.dataset.targetId = option.targetId;
    }

    btn.innerHTML = `
      <span class="option-icon">${option.icon}</span>
      <div class="option-text">
        <span class="option-name">${option.name}${option.recommended ? ' (Recommended)' : ''}</span>
        <span class="option-desc">${option.description}</span>
      </div>
    `;

    btn.addEventListener('click', () => {
      this.selectOption(option.type, option.targetId);
    });

    return btn;
  },

  /**
   * Format distance for display
   * @param {number} distance - Distance in world units
   * @returns {string}
   */
  formatDistance(distance) {
    if (!distance || distance < 1000) {
      return `${Math.round(distance || 0)} units`;
    }
    return `${(distance / 1000).toFixed(1)}k units`;
  },

  /**
   * Handle option selection
   * @param {string} type - Respawn type
   * @param {string} targetId - Optional target ID
   */
  selectOption(type, targetId = null) {
    this.selectedOption = { type, targetId };

    // Play selection sound
    if (typeof AudioManager !== 'undefined') {
      AudioManager.play('ui_click');
    }

    // Stop auto-respawn timer
    this.stopAutoRespawnTimer();

    // Disable all buttons
    const buttons = this.optionsContainer.querySelectorAll('.respawn-option');
    buttons.forEach(btn => btn.classList.add('disabled'));

    // Send respawn selection to server
    if (typeof Network !== 'undefined') {
      Network.sendRespawnSelect(type, targetId);
    }

    // Hide after a short delay (server will trigger respawn)
    setTimeout(() => {
      this.hide();
    }, 500);
  },

  /**
   * Start auto-respawn countdown timer
   */
  startAutoRespawnTimer() {
    this.stopAutoRespawnTimer(); // Clear any existing timer

    this.autoRespawnTimer = setInterval(() => {
      this.autoRespawnCountdown--;
      if (this.timerDisplay) {
        this.timerDisplay.textContent = this.autoRespawnCountdown;
      }

      if (this.autoRespawnCountdown <= 0) {
        // Auto-respawn to deep space
        this.selectOption('deep_space');
      }
    }, 1000);
  },

  /**
   * Stop auto-respawn timer
   */
  stopAutoRespawnTimer() {
    if (this.autoRespawnTimer) {
      clearInterval(this.autoRespawnTimer);
      this.autoRespawnTimer = null;
    }
  },

  /**
   * Hide the respawn location UI
   */
  hide() {
    this.visible = false;
    this.overlay.classList.add('hidden');

    // Stop animation
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    // Stop timer
    this.stopAutoRespawnTimer();

    // Clear particles
    this.particles = [];
  },

  /**
   * Start the animation loop
   */
  startAnimation() {
    // Spawn initial particles
    this.spawnParticles(30);

    const animate = () => {
      if (!this.visible) return;

      this.render();
      this.animationFrame = requestAnimationFrame(animate);
    };

    animate();
  },

  /**
   * Spawn floating particles
   * @param {number} count - Number of particles to spawn
   */
  spawnParticles(count) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        size: 1 + Math.random() * 3,
        speedX: (Math.random() - 0.5) * 20,
        speedY: (Math.random() - 0.5) * 20,
        alpha: 0.3 + Math.random() * 0.5,
        color: this.getParticleColor()
      });
    }
  },

  /**
   * Get random particle color (blues, cyans, purples)
   * @returns {string}
   */
  getParticleColor() {
    const colors = [
      '#4488ff', '#00ccff', '#88aaff', '#6666ff',
      '#aa88ff', '#00aaff', '#5588dd', '#7799ff'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  },

  /**
   * Render the UI background effect
   */
  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const elapsed = Date.now() - this.startTime;

    // Clear with dark fade effect
    ctx.fillStyle = 'rgba(0, 5, 20, 0.15)';
    ctx.fillRect(0, 0, w, h);

    // Update and render particles
    const dt = 0.016; // ~60fps
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // Update position
      p.x += p.speedX * dt;
      p.y += p.speedY * dt;

      // Wrap around screen
      if (p.x < 0) p.x = w;
      if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h;
      if (p.y > h) p.y = 0;

      // Draw particle
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha * (0.5 + 0.5 * Math.sin(elapsed / 1000 + i));
      ctx.fill();
    }

    ctx.globalAlpha = 1;

    // Central glow effect
    const glowRadius = 150 + Math.sin(elapsed / 500) * 20;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
    gradient.addColorStop(0, 'rgba(100, 150, 255, 0.15)');
    gradient.addColorStop(0.5, 'rgba(50, 100, 200, 0.08)');
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // Pulsing ring
    const ringPhase = (elapsed / 2000) % 1;
    const ringRadius = 50 + ringPhase * 100;
    const ringAlpha = 0.3 * (1 - ringPhase);
    ctx.strokeStyle = '#4488ff';
    ctx.lineWidth = 2;
    ctx.globalAlpha = ringAlpha;
    ctx.beginPath();
    ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 1;
  },

  /**
   * Check if UI is currently visible
   * @returns {boolean}
   */
  isVisible() {
    return this.visible;
  }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => RespawnLocationUI.init());
} else {
  // DOM already loaded
  setTimeout(() => RespawnLocationUI.init(), 0);
}
