// Galaxy Miner - Gesture Handler
// Foundation for advanced touch gestures: long-press, swipe, pinch

const GestureHandler = {
  // Active touch tracking
  touches: {},

  // Gesture configuration
  config: {
    longPressDelay: 500,      // ms before long-press triggers
    swipeThreshold: 50,       // min pixels for swipe
    swipeVelocity: 0.3,       // min velocity (px/ms)
    pinchThreshold: 0.1,      // min scale change for pinch
    doubleTapDelay: 300       // max ms between taps for double-tap
  },

  // Callbacks for gestures
  handlers: {
    onLongPress: null,
    onSwipe: null,
    onPinch: null,
    onDoubleTap: null
  },

  // State tracking
  _longPressTimer: null,
  _lastTapTime: 0,
  _lastTapPosition: null,
  _initialPinchDistance: 0,

  /**
   * Initialize gesture detection on an element
   * @param {HTMLElement} element - Element to detect gestures on
   * @param {Object} handlers - Callback functions for gestures
   */
  init(element, handlers = {}) {
    if (!element) {
      Logger.error('GestureHandler: Element required');
      return;
    }

    this.element = element;
    this.handlers = { ...this.handlers, ...handlers };

    this.bindEvents();
    Logger.log('GestureHandler initialized');
  },

  /**
   * Bind touch event listeners
   */
  bindEvents() {
    const options = { passive: false };

    this.element.addEventListener('touchstart', (e) => this.onTouchStart(e), options);
    this.element.addEventListener('touchmove', (e) => this.onTouchMove(e), options);
    this.element.addEventListener('touchend', (e) => this.onTouchEnd(e), options);
    this.element.addEventListener('touchcancel', (e) => this.onTouchCancel(e), options);
  },

  /**
   * Handle touch start
   */
  onTouchStart(e) {
    const now = Date.now();

    for (const touch of e.changedTouches) {
      this.touches[touch.identifier] = {
        id: touch.identifier,
        startX: touch.clientX,
        startY: touch.clientY,
        currentX: touch.clientX,
        currentY: touch.clientY,
        startTime: now,
        moved: false
      };
    }

    const touchCount = Object.keys(this.touches).length;

    // Single touch gestures
    if (touchCount === 1) {
      const touch = Object.values(this.touches)[0];

      // Check for double tap
      if (this._lastTapPosition &&
          now - this._lastTapTime < this.config.doubleTapDelay) {
        const dx = touch.startX - this._lastTapPosition.x;
        const dy = touch.startY - this._lastTapPosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 30) {
          // Double tap detected
          this.cancelLongPress();
          this.triggerDoubleTap(touch.startX, touch.startY);
          this._lastTapTime = 0;
          this._lastTapPosition = null;
          return;
        }
      }

      // Start long press timer
      this.startLongPressTimer(touch);
    }

    // Two-finger gestures (pinch)
    if (touchCount === 2) {
      this.cancelLongPress();
      this._initialPinchDistance = this.getPinchDistance();
    }
  },

  /**
   * Handle touch move
   */
  onTouchMove(e) {
    for (const touch of e.changedTouches) {
      const tracked = this.touches[touch.identifier];
      if (tracked) {
        tracked.currentX = touch.clientX;
        tracked.currentY = touch.clientY;

        // Check if moved significantly
        const dx = tracked.currentX - tracked.startX;
        const dy = tracked.currentY - tracked.startY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 10) {
          tracked.moved = true;
          this.cancelLongPress();
        }
      }
    }

    // Check for pinch gesture
    const touchCount = Object.keys(this.touches).length;
    if (touchCount === 2 && this._initialPinchDistance > 0) {
      const currentDistance = this.getPinchDistance();
      const scale = currentDistance / this._initialPinchDistance;

      if (Math.abs(scale - 1) > this.config.pinchThreshold) {
        this.triggerPinch(scale, this.getPinchCenter());
      }
    }
  },

  /**
   * Handle touch end
   */
  onTouchEnd(e) {
    const now = Date.now();

    for (const touch of e.changedTouches) {
      const tracked = this.touches[touch.identifier];
      if (!tracked) continue;

      const duration = now - tracked.startTime;
      const dx = tracked.currentX - tracked.startX;
      const dy = tracked.currentY - tracked.startY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const velocity = distance / duration;

      // Check for swipe
      if (tracked.moved &&
          distance >= this.config.swipeThreshold &&
          velocity >= this.config.swipeVelocity) {
        this.triggerSwipe(dx, dy, velocity, tracked);
      }

      // Track for double-tap detection (only if not moved)
      if (!tracked.moved && duration < 200) {
        this._lastTapTime = now;
        this._lastTapPosition = { x: tracked.startX, y: tracked.startY };
      }

      delete this.touches[touch.identifier];
    }

    this.cancelLongPress();

    // Reset pinch state
    if (Object.keys(this.touches).length < 2) {
      this._initialPinchDistance = 0;
    }
  },

  /**
   * Handle touch cancel
   */
  onTouchCancel(e) {
    for (const touch of e.changedTouches) {
      delete this.touches[touch.identifier];
    }
    this.cancelLongPress();
    this._initialPinchDistance = 0;
  },

  /**
   * Start long press detection timer
   */
  startLongPressTimer(touch) {
    this.cancelLongPress();

    this._longPressTimer = setTimeout(() => {
      if (!touch.moved) {
        this.triggerLongPress(touch.startX, touch.startY);
      }
    }, this.config.longPressDelay);
  },

  /**
   * Cancel long press timer
   */
  cancelLongPress() {
    if (this._longPressTimer) {
      clearTimeout(this._longPressTimer);
      this._longPressTimer = null;
    }
  },

  /**
   * Get distance between two touch points
   */
  getPinchDistance() {
    const touchList = Object.values(this.touches);
    if (touchList.length < 2) return 0;

    const dx = touchList[1].currentX - touchList[0].currentX;
    const dy = touchList[1].currentY - touchList[0].currentY;
    return Math.sqrt(dx * dx + dy * dy);
  },

  /**
   * Get center point between two touches
   */
  getPinchCenter() {
    const touchList = Object.values(this.touches);
    if (touchList.length < 2) return null;

    return {
      x: (touchList[0].currentX + touchList[1].currentX) / 2,
      y: (touchList[0].currentY + touchList[1].currentY) / 2
    };
  },

  /**
   * Trigger long press callback
   */
  triggerLongPress(x, y) {
    Logger.log('GestureHandler: Long press at', x, y);

    if (this.handlers.onLongPress) {
      this.handlers.onLongPress({ x, y });
    }

    // Haptic feedback
    if (typeof MobileSettingsPanel !== 'undefined') {
      MobileSettingsPanel.vibrate(50);
    }
  },

  /**
   * Trigger swipe callback
   */
  triggerSwipe(dx, dy, velocity, touch) {
    // Determine swipe direction
    const angle = Math.atan2(dy, dx);
    let direction;

    if (angle > -Math.PI / 4 && angle <= Math.PI / 4) {
      direction = 'right';
    } else if (angle > Math.PI / 4 && angle <= 3 * Math.PI / 4) {
      direction = 'down';
    } else if (angle > -3 * Math.PI / 4 && angle <= -Math.PI / 4) {
      direction = 'up';
    } else {
      direction = 'left';
    }

    Logger.log('GestureHandler: Swipe', direction, 'velocity:', velocity.toFixed(2));

    if (this.handlers.onSwipe) {
      this.handlers.onSwipe({
        direction,
        dx,
        dy,
        velocity,
        startX: touch.startX,
        startY: touch.startY,
        endX: touch.currentX,
        endY: touch.currentY
      });
    }
  },

  /**
   * Trigger pinch callback
   */
  triggerPinch(scale, center) {
    Logger.log('GestureHandler: Pinch scale:', scale.toFixed(2));

    if (this.handlers.onPinch) {
      this.handlers.onPinch({
        scale,
        center,
        isZoomIn: scale > 1,
        isZoomOut: scale < 1
      });
    }
  },

  /**
   * Trigger double tap callback
   */
  triggerDoubleTap(x, y) {
    Logger.log('GestureHandler: Double tap at', x, y);

    if (this.handlers.onDoubleTap) {
      this.handlers.onDoubleTap({ x, y });
    }

    // Haptic feedback
    if (typeof MobileSettingsPanel !== 'undefined') {
      MobileSettingsPanel.vibrate([30, 30, 30]);
    }
  },

  /**
   * Update gesture handlers
   */
  setHandlers(handlers) {
    this.handlers = { ...this.handlers, ...handlers };
  },

  /**
   * Update configuration
   */
  setConfig(config) {
    this.config = { ...this.config, ...config };
  },

  /**
   * Clean up and remove listeners
   */
  destroy() {
    this.cancelLongPress();
    this.touches = {};
    this._initialPinchDistance = 0;
    this._lastTapTime = 0;
    this._lastTapPosition = null;

    // Note: Event listeners on element remain unless element is removed
    Logger.log('GestureHandler destroyed');
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.GestureHandler = GestureHandler;
}
