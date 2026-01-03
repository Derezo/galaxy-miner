/**
 * RenderContext - Shared rendering state and utilities
 * Contains canvas management, camera, DPR, screen shake, and mobile helpers.
 */
const RenderContext = {
  canvas: null,
  ctx: null,
  camera: { x: 0, y: 0 },
  dpr: 1, // Device pixel ratio for high-DPI displays
  width: 0, // Logical width (CSS pixels)
  height: 0, // Logical height (CSS pixels)
  portraitMode: false,
  lastDt: 0,

  // Screen shake system
  screenShake: {
    intensity: 0, // Current shake intensity (pixels)
    duration: 0, // Total shake duration (ms)
    startTime: 0, // When shake started
    offset: { x: 0, y: 0 } // Current shake offset
  },

  /**
   * Initialize the render context
   */
  init() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    // Set DPI scaling (cap at 2 for performance on high-DPI mobile)
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Handle resize
    window.addEventListener('resize', () => this.resize());
    this.resize();

    Logger.log('RenderContext initialized');
  },

  /**
   * Handle canvas resize
   */
  resize() {
    // Get CSS (logical) dimensions
    const cssWidth = window.innerWidth;
    const cssHeight = window.innerHeight;

    // Set canvas buffer size (scaled by DPR for crisp rendering)
    this.canvas.width = cssWidth * this.dpr;
    this.canvas.height = cssHeight * this.dpr;

    // Set CSS display size
    this.canvas.style.width = cssWidth + 'px';
    this.canvas.style.height = cssHeight + 'px';

    // Scale context to match DPR
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Store logical dimensions for game code
    this.width = cssWidth;
    this.height = cssHeight;

    // Track portrait mode for responsive game systems
    this.portraitMode = cssWidth < cssHeight;
  },

  /**
   * Check if currently in portrait orientation
   * @returns {boolean} True if portrait mode
   */
  isPortrait() {
    return this.portraitMode;
  },

  /**
   * Check if we're on a mobile device
   * @returns {boolean} True if mobile
   */
  isMobile() {
    return typeof DeviceDetect !== 'undefined' && DeviceDetect.isMobile;
  },

  // ============================================
  // MOBILE SCALING HELPERS
  // ============================================

  /**
   * Get scaled font size for mobile displays
   * @param {number} baseSize - Base font size in pixels
   * @param {number} minScale - Minimum scale factor (default 0.7)
   * @returns {number} Scaled font size
   */
  getFontSize(baseSize, minScale = 0.7) {
    if (!this.isMobile()) return baseSize;

    // Scale based on screen width, with floor
    const screenScale = Math.min(this.width / 800, 1);
    const scale = Math.max(screenScale, minScale);
    return Math.round(baseSize * scale);
  },

  /**
   * Get a font string with scaled size for canvas
   * @param {number} baseSize - Base font size in pixels
   * @param {string} weight - Font weight (e.g., 'bold', 'normal', '600')
   * @param {string} family - Font family (default 'monospace')
   * @returns {string} CSS font string for ctx.font
   */
  getFont(baseSize, weight = 'normal', family = 'monospace') {
    const size = this.getFontSize(baseSize);
    return `${weight} ${size}px ${family}`;
  },

  /**
   * Get scaled line height for text
   * @param {number} baseFontSize - Base font size used
   * @param {number} lineHeightRatio - Line height multiplier (default 1.4)
   * @returns {number} Line height in pixels
   */
  getLineHeight(baseFontSize, lineHeightRatio = 1.4) {
    return Math.round(this.getFontSize(baseFontSize) * lineHeightRatio);
  },

  /**
   * Get scaled spacing/margin for mobile
   * @param {number} baseSpacing - Base spacing in pixels
   * @returns {number} Scaled spacing
   */
  getSpacing(baseSpacing) {
    if (!this.isMobile()) return baseSpacing;
    return Math.round(baseSpacing * 0.75);
  },

  // ============================================
  // SCREEN SHAKE SYSTEM
  // ============================================

  /**
   * Trigger a screen shake effect
   * @param {number} intensity - Maximum shake offset in pixels
   * @param {number} duration - Duration of shake in milliseconds
   */
  triggerScreenShake(intensity, duration) {
    // Apply screen shake multiplier from graphics settings
    const shakeMultiplier = typeof GraphicsSettings !== 'undefined'
      ? (GraphicsSettings.get('screenShakeMultiplier') || 1.0)
      : 1.0;

    this.screenShake.intensity = intensity * shakeMultiplier;
    this.screenShake.duration = duration;
    this.screenShake.startTime = Date.now();
  },

  /**
   * Set screen shake intensity directly (for continuous effects like queen death)
   * @param {number} intensity - Current shake intensity in pixels
   */
  setScreenShake(intensity) {
    const shakeMultiplier = typeof GraphicsSettings !== 'undefined'
      ? (GraphicsSettings.get('screenShakeMultiplier') || 1.0)
      : 1.0;

    this.screenShake.intensity = intensity * shakeMultiplier;
    this.screenShake.duration = 100; // Short duration, updated continuously
    this.screenShake.startTime = Date.now();
  },

  /**
   * Update screen shake offset
   */
  updateScreenShake() {
    if (this.screenShake.intensity <= 0) {
      this.screenShake.offset.x = 0;
      this.screenShake.offset.y = 0;
      return;
    }

    const elapsed = Date.now() - this.screenShake.startTime;
    const progress = elapsed / this.screenShake.duration;

    if (progress >= 1) {
      this.screenShake.intensity = 0;
      this.screenShake.offset.x = 0;
      this.screenShake.offset.y = 0;
      return;
    }

    // Calculate current shake intensity with falloff
    const currentIntensity = this.screenShake.intensity * (1 - progress * 0.3);

    // Random shake offset with perlin-like smoothness
    const time = Date.now() * 0.015;
    this.screenShake.offset.x =
      Math.sin(time * 1.3) * currentIntensity +
      Math.sin(time * 2.7) * currentIntensity * 0.5;
    this.screenShake.offset.y =
      Math.cos(time * 1.1) * currentIntensity +
      Math.cos(time * 2.3) * currentIntensity * 0.5;
  },

  /**
   * Get camera position with shake offset applied
   * @returns {{ x: number, y: number }} Camera position with shake
   */
  getCameraWithShake() {
    return {
      x: this.camera.x + this.screenShake.offset.x,
      y: this.camera.y + this.screenShake.offset.y
    };
  },

  // ============================================
  // COORDINATE CONVERSION
  // ============================================

  /**
   * Update camera position centered on player
   */
  updateCamera() {
    // Center camera on player using logical dimensions
    this.camera.x = Player.position.x - this.width / 2;
    this.camera.y = Player.position.y - this.height / 2;

    // Apply screen shake offset from base destruction sequences
    if (typeof BaseDestructionSequence !== 'undefined') {
      const shake = BaseDestructionSequence.getScreenShakeOffset();
      this.camera.x += shake.x;
      this.camera.y += shake.y;
    }

    // Apply screen shake from player death effect
    if (typeof PlayerDeathEffect !== 'undefined') {
      const deathShake = PlayerDeathEffect.getScreenShakeOffset();
      this.camera.x += deathShake.x;
      this.camera.y += deathShake.y;
    }
  },

  /**
   * Convert world coordinates to screen coordinates
   * @param {number} x - World X
   * @param {number} y - World Y
   * @returns {{ x: number, y: number }} Screen coordinates
   */
  worldToScreen(x, y) {
    return {
      x: x - this.camera.x,
      y: y - this.camera.y
    };
  },

  /**
   * Check if world coordinates are visible on screen
   * @param {number} x - World X
   * @param {number} y - World Y
   * @param {number} margin - Extra margin around screen edges
   * @returns {boolean} True if on screen
   */
  isOnScreen(x, y, margin = 100) {
    const screen = this.worldToScreen(x, y);
    return (
      screen.x > -margin &&
      screen.x < this.canvas.width + margin &&
      screen.y > -margin &&
      screen.y < this.canvas.height + margin
    );
  }
};
