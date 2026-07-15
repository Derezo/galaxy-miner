// Galaxy Miner - Mobile Gestures Integration
// Connects GestureHandler to UI actions for navigation and radar control

const MobileGestures = {
  /**
   * Initialize gesture integration
   * Called from main.js after GestureHandler is available
   */
  init() {
    if (typeof GestureHandler === 'undefined') {
      Logger.warn('MobileGestures: GestureHandler not available');
      return;
    }

    const canvas = document.getElementById('gameCanvas');
    if (!canvas) {
      Logger.warn('MobileGestures: Canvas not found');
      return;
    }

    // Radar and terminal controls are siblings of the game canvas. Listen at
    // the document boundary so their gestures are reachable as well; the
    // gesture handler filters native interactive controls.
    GestureHandler.init(document, {
      onSwipe: this.handleSwipe.bind(this),
      onPinch: this.handlePinch.bind(this),
      onLongPress: this.handleLongPress.bind(this),
      onDoubleTap: this.handleDoubleTap.bind(this)
    });

    Logger.log('MobileGestures initialized');
  },

  /**
   * Handle swipe gestures
   * - Right swipe on terminal: Dismiss terminal
   * - Left swipe on right edge: Open terminal
   */
  handleSwipe(data) {
    if (!this._isGameplayAvailable()) return;
    const { direction, startX, startY, endX, endY } = data;

    // Check if swipe started on terminal panel
    if (this._isOnTerminal(startX, startY)) {
      if (direction === 'right') {
        // Swipe right to dismiss terminal
        if (typeof TerminalUI !== 'undefined' && TerminalUI.visible) {
          TerminalUI.hide();
          return;
        }
      }
    }

    // Check if swipe from right edge (to open terminal)
    const screenWidth = window.innerWidth;
    if (startX > screenWidth - 50 && direction === 'left') {
      if (typeof TerminalUI !== 'undefined' && !TerminalUI.visible) {
        TerminalUI.show();
        return;
      }
    }

    // Swipe up from bottom edge could open radar zoom
    const screenHeight = window.innerHeight;
    if (startY > screenHeight - 80 && direction === 'up') {
      // Could toggle sector map mode at Tier 5
      if (typeof RadarAdvanced !== 'undefined' &&
          typeof Player !== 'undefined' &&
          (Player.ship.radarTier || 1) >= 5) {
        RadarAdvanced.toggleSectorMap();
      }
    }
  },

  /**
   * Handle pinch gestures
   * - Pinch on radar: Zoom radar in/out
   */
  handlePinch(data) {
    if (!this._isGameplayAvailable()) return;
    const { scale, center, isZoomIn, isZoomOut } = data;

    // Check if pinch is on radar area
    if (this._isOnRadar(center.x, center.y)) {
      if (typeof RadarAdvanced !== 'undefined') {
        RadarAdvanced.setZoomScale(scale);
      }
      return;
    }

    // Pinch on main canvas could adjust camera (future feature)
  },

  /**
   * Handle long press gestures
   * - Long press on entity: Show info/target
   */
  handleLongPress(data) {
    if (!this._isGameplayAvailable()) return;
    const { x, y } = data;

    // Check if on radar - could show entity details
    if (this._isOnRadar(x, y)) {
      // Future: show radar entity tooltip
      return;
    }

    // UI interactions must never leak through into a gameplay boost.
    if (this._isOnTerminal(x, y) || this._isOnHUD(x, y)) return;

    // Long press on game area - could auto-target nearest enemy
    if (typeof Combat !== 'undefined' && typeof Player !== 'undefined') {
      // Could implement target lock here
    }
  },

  /**
   * Handle double tap gestures
   * - Double tap: Auto-fire toggle or boost
   */
  handleDoubleTap(data) {
    if (!this._isGameplayAvailable()) return;
    const { x, y } = data;

    // Double tap on radar - toggle sector map
    if (this._isOnRadar(x, y)) {
      if (typeof RadarAdvanced !== 'undefined' &&
          typeof Player !== 'undefined' &&
          (Player.ship.radarTier || 1) >= 5) {
        RadarAdvanced.toggleSectorMap();
      }
      return;
    }

    // UI interactions must never leak through into a gameplay boost.
    if (this._isOnTerminal(x, y) || this._isOnHUD(x, y)) return;

    // Double tap on game area - activate the real player ability. Going through
    // Player keeps duration, audio, relic modifiers, and cooldown state in sync.
    if (typeof Player === 'undefined' || typeof Player.activateBoost !== 'function') return;
    if (Player.isDead || Player.inWormholeTransit) return;

    const boostActive = typeof Player.isBoostActive === 'function'
      ? Player.isBoostActive()
      : Player.boostActive;
    const boostOnCooldown = typeof Player.isBoostOnCooldown === 'function'
      ? Player.isBoostOnCooldown()
      : Date.now() < (Player.boostCooldownEnd || 0);

    if (!boostActive && !boostOnCooldown) {
      Player.activateBoost();
    }
  },

  /**
   * Check if coordinates are within terminal panel bounds
   */
  _isOnTerminal(x, y) {
    const terminal = document.getElementById('terminal-panel');
    if (!terminal || terminal.classList.contains('hidden')) return false;

    const rect = terminal.getBoundingClientRect();
    return x >= rect.left && x <= rect.right &&
           y >= rect.top && y <= rect.bottom;
  },

  _isGameplayAvailable() {
    if (typeof GalaxyMiner === 'undefined') return true;
    return GalaxyMiner.gameStarted === true && GalaxyMiner.connectionPaused !== true;
  },

  /**
   * Check if coordinates are within radar bounds
   */
  _isOnRadar(x, y) {
    const radarCanvas = document.getElementById('radar-canvas');
    if (!radarCanvas) return false;

    const rect = radarCanvas.getBoundingClientRect();
    return x >= rect.left && x <= rect.right &&
           y >= rect.top && y <= rect.bottom;
  },

  /**
   * Check if coordinates are within HUD bounds
   */
  _isOnHUD(x, y) {
    if (typeof document.elementFromPoint !== 'function') return false;
    const target = document.elementFromPoint(x, y);
    if (!target || typeof target.closest !== 'function') return false;

    // #hud itself covers the full viewport with pointer-events disabled. Test
    // the actual hit element so empty gameplay canvas remains boost-capable.
    return !!target.closest('#hud, .mobile-action-buttons, .virtual-joystick');
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.MobileGestures = MobileGestures;
}
