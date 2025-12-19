// Galaxy Miner - Virtual Joystick
// Floating touch joystick for mobile movement control

const VirtualJoystick = {
  active: false,
  element: null,
  knob: null,

  // Touch tracking
  touchId: null,
  originX: 0,
  originY: 0,
  currentX: 0,
  currentY: 0,

  // Output values
  targetRotation: 0,
  thrust: 0,

  // Configuration
  config: {
    size: 120,           // Joystick base diameter
    knobSize: 50,        // Knob diameter
    maxDistance: 50,     // Max knob travel from center
    deadzone: 0.15,      // 15% deadzone
    zoneWidth: 0.4       // Left 40% of screen for joystick
  },

  init() {
    if (typeof DeviceDetect === 'undefined' || !DeviceDetect.isMobile) {
      Logger.log('VirtualJoystick: Not initializing (not mobile)');
      return;
    }

    this.createElements();
    this.bindEvents();
    Logger.log('VirtualJoystick initialized');
  },

  createElements() {
    // Create joystick container
    this.element = document.createElement('div');
    this.element.className = 'virtual-joystick';
    this.element.innerHTML = `
      <div class="joystick-base">
        <div class="joystick-knob"></div>
      </div>
    `;

    // Add to UI container
    const uiContainer = document.getElementById('ui-container');
    if (uiContainer) {
      uiContainer.appendChild(this.element);
    } else {
      document.body.appendChild(this.element);
    }

    this.knob = this.element.querySelector('.joystick-knob');
  },

  bindEvents() {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) {
      Logger.error('VirtualJoystick: Canvas not found');
      return;
    }

    // Use the canvas for touch events in the joystick zone
    canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
    canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
    canvas.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });
    // touchcancel should always reset - canceled touches may not appear in changedTouches
    canvas.addEventListener('touchcancel', () => {
      if (this.touchId !== null) {
        this.reset();
      }
    }, { passive: false });
  },

  /**
   * Check if touch coordinates are in the joystick activation zone
   * Landscape: left 40% of screen width
   * Portrait: bottom-left quadrant (left 50%, bottom 50%)
   */
  isInJoystickZone(x, y) {
    const isLandscape = window.innerWidth > window.innerHeight;

    if (isLandscape) {
      // Landscape: left 40% of width (original behavior)
      return x < window.innerWidth * this.config.zoneWidth;
    } else {
      // Portrait: bottom-left quadrant for thumb reach
      return x < window.innerWidth * 0.5 && y > window.innerHeight * 0.5;
    }
  },

  onTouchStart(e) {
    // Skip if already tracking a touch for joystick
    if (this.touchId !== null) return;

    for (const touch of e.changedTouches) {
      if (this.isInJoystickZone(touch.clientX, touch.clientY)) {
        e.preventDefault();

        this.touchId = touch.identifier;
        this.originX = touch.clientX;
        this.originY = touch.clientY;
        this.currentX = touch.clientX;
        this.currentY = touch.clientY;

        // Position joystick at touch origin
        this.element.style.left = (touch.clientX - this.config.size / 2) + 'px';
        this.element.style.top = (touch.clientY - this.config.size / 2) + 'px';
        this.element.classList.add('active');
        this.active = true;

        this.updateOutput();
        break;
      }
    }
  },

  onTouchMove(e) {
    if (this.touchId === null) return;

    for (const touch of e.changedTouches) {
      if (touch.identifier === this.touchId) {
        e.preventDefault();

        this.currentX = touch.clientX;
        this.currentY = touch.clientY;
        this.updateOutput();
        break;
      }
    }
  },

  onTouchEnd(e) {
    for (const touch of e.changedTouches) {
      if (touch.identifier === this.touchId) {
        this.reset();
        break;
      }
    }

    // Fallback: If no touches remain, force reset to prevent stuck state
    if (e.touches.length === 0 && this.touchId !== null) {
      this.reset();
    }
  },

  /**
   * Reset joystick to inactive state
   * Ensures touchId is cleared to allow new touch interactions
   */
  reset() {
    this.touchId = null;
    this.active = false;
    this.thrust = 0;
    this.element.classList.remove('active');

    // Reset knob position
    if (this.knob) {
      this.knob.style.transform = 'translate(-50%, -50%)';
    }
  },

  updateOutput() {
    const dx = this.currentX - this.originX;
    const dy = this.currentY - this.originY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDist = this.config.maxDistance;

    // Clamp to max distance
    const clampedDist = Math.min(distance, maxDist);
    const angle = Math.atan2(dy, dx);

    // Calculate knob position (visual)
    const knobX = (clampedDist / maxDist) * maxDist * Math.cos(angle);
    const knobY = (clampedDist / maxDist) * maxDist * Math.sin(angle);

    if (this.knob) {
      this.knob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
    }

    // Calculate thrust (0-1) with deadzone
    const normalizedDist = clampedDist / maxDist;
    if (normalizedDist < this.config.deadzone) {
      this.thrust = 0;
    } else {
      // Remap from deadzone-1 to 0-1
      this.thrust = (normalizedDist - this.config.deadzone) / (1 - this.config.deadzone);
    }

    // Calculate target rotation (radians) - only if past deadzone
    if (this.thrust > 0) {
      this.targetRotation = angle;
    }
  },

  /**
   * Get movement input in the same format as Input.getMovementInput()
   * @returns {Object} Movement input with analog values for mobile
   */
  getMovementInput() {
    if (!this.active || this.thrust === 0) {
      return {
        up: false,
        down: false,
        left: false,
        right: false,
        boost: false,
        targetRotation: undefined,
        thrustMagnitude: 0
      };
    }

    // Get player's current rotation for comparison
    const playerRotation = (typeof Player !== 'undefined') ? Player.rotation : 0;

    // Calculate angle difference to determine left/right
    let angleDiff = this.normalizeAngle(this.targetRotation - playerRotation);

    return {
      up: this.thrust > 0.3,                    // Thrust if joystick pulled significantly
      down: false,                               // No reverse on mobile
      left: angleDiff < -0.1,                   // Turn left
      right: angleDiff > 0.1,                   // Turn right
      boost: this.thrust > 0.9,                 // Boost at max thrust
      // Analog values for smooth mobile control
      targetRotation: this.targetRotation,
      thrustMagnitude: this.thrust
    };
  },

  /**
   * Normalize angle to -PI to PI range
   */
  normalizeAngle(angle) {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  },

  /**
   * Check if joystick is currently being used
   */
  isActive() {
    return this.active;
  },

  /**
   * Get raw thrust value (0-1)
   */
  getThrust() {
    return this.thrust;
  },

  /**
   * Get target rotation in radians
   */
  getTargetRotation() {
    return this.targetRotation;
  }
};
