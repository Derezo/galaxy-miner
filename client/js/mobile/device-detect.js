// Galaxy Miner - Device Detection
// Detects mobile devices and manages body classes for CSS targeting

const DeviceDetect = {
  isMobile: false,
  isTouchDevice: false,
  isLandscape: true,

  init() {
    // Primary detection via user agent
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // Secondary detection via touch capability
    this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    // Hybrid devices (touch laptops) - prefer desktop mode if fine pointer available
    if (this.isTouchDevice && !this.isMobile) {
      // Check for fine pointer (mouse) - if present, use desktop mode
      const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
      if (hasFinePointer) {
        this.isMobile = false;
      } else {
        // Touch-only device (tablet without mouse)
        this.isMobile = true;
      }
    }

    // Set body classes for CSS targeting
    document.body.classList.toggle('is-mobile', this.isMobile);
    document.body.classList.toggle('is-touch', this.isTouchDevice);

    // Track orientation
    this.updateOrientation();
    window.addEventListener('resize', () => this.updateOrientation());

    // Screen orientation API (if available)
    if (screen.orientation) {
      screen.orientation.addEventListener('change', () => this.updateOrientation());
    }

    // Also listen for orientation change event (iOS Safari)
    window.addEventListener('orientationchange', () => {
      // Small delay to let the browser update dimensions
      setTimeout(() => this.updateOrientation(), 100);
    });

    // Prevent default touch behaviors that interfere with game
    if (this.isMobile) {
      this.preventDefaultTouchBehaviors();
    }

    Logger.log('DeviceDetect initialized:', {
      isMobile: this.isMobile,
      isTouchDevice: this.isTouchDevice,
      isLandscape: this.isLandscape
    });
  },

  updateOrientation() {
    this.isLandscape = window.innerWidth > window.innerHeight;
    document.body.classList.toggle('is-landscape', this.isLandscape);
    document.body.classList.toggle('is-portrait', !this.isLandscape);
  },

  preventDefaultTouchBehaviors() {
    // Prevent pull-to-refresh and overscroll
    document.body.style.overscrollBehavior = 'none';

    // Prevent double-tap zoom on iOS
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (this._lastTouchEnd && now - this._lastTouchEnd < 300) {
        e.preventDefault();
      }
      this._lastTouchEnd = now;
    }, { passive: false });

    // Prevent context menu on long press
    document.addEventListener('contextmenu', (e) => {
      if (this.isMobile) {
        e.preventDefault();
      }
    });

    // Prevent iOS elastic scrolling on body
    document.body.addEventListener('touchmove', (e) => {
      // Only prevent if not scrolling within a scrollable element
      if (e.target === document.body || e.target === document.documentElement) {
        e.preventDefault();
      }
    }, { passive: false });

    // Try pending fullscreen on first touch (if browser blocked auto-request)
    document.addEventListener('touchstart', () => {
      if (typeof GalaxyMiner !== 'undefined') {
        GalaxyMiner.tryPendingFullscreen();
      }
    }, { once: false, passive: true });
  },

  /**
   * Force mobile mode (for testing on desktop)
   */
  forceMobileMode(enabled = true) {
    this.isMobile = enabled;
    document.body.classList.toggle('is-mobile', this.isMobile);
    Logger.log('Mobile mode forced:', enabled);
  }
};
