/**
 * Credit Animation Module
 * Handles animated credit counting and visual effects for credit collection
 */

const CreditAnimation = {
  // Current displayed value (may differ from actual during animation)
  displayValue: 0,
  targetValue: 0,

  // Animation state
  animating: false,
  animationFrame: null,

  // Counting animation speed (credits per second)
  countSpeed: 500,

  // DOM references
  creditValueEl: null,
  creditIconContainer: null,

  /**
   * Initialize the credit animation system
   */
  init() {
    this.creditValueEl = document.getElementById('credit-value');
    this.creditIconContainer = document.getElementById('credit-icon-container');

    // Set initial value from Player
    if (typeof Player !== 'undefined' && Player.credits !== undefined) {
      this.displayValue = Player.credits;
      this.targetValue = Player.credits;
      this.updateDisplay();
    }

    Logger.log('CreditAnimation initialized');
  },

  /**
   * Add credits with animation
   * @param {number} amount - Amount of credits to add
   */
  addCredits(amount) {
    if (amount <= 0) return;

    // Update target
    this.targetValue += amount;

    // Show floating text
    this.showFloatingText(`+${amount.toLocaleString()}`);

    // Trigger coin animation
    this.playCollectionEffect();

    // Start counting animation if not already running
    if (!this.animating) {
      this.startCountAnimation();
    }
  },

  /**
   * Set credits directly (for initial load or large changes)
   * @param {number} value - New credit value
   * @param {boolean} animate - Whether to animate the change
   */
  setCredits(value, animate = false) {
    if (animate && value > this.displayValue) {
      const delta = value - this.displayValue;
      this.addCredits(delta);
    } else {
      this.displayValue = value;
      this.targetValue = value;
      this.updateDisplay();
    }
  },

  /**
   * Start the counting animation
   */
  startCountAnimation() {
    if (this.animating) return;

    this.animating = true;
    let lastTime = performance.now();

    const animate = (currentTime) => {
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      // Calculate increment based on time and speed
      const diff = this.targetValue - this.displayValue;
      if (Math.abs(diff) < 1) {
        // Close enough, snap to target
        this.displayValue = this.targetValue;
        this.animating = false;
        this.updateDisplay();
        return;
      }

      // Accelerate counting for large differences
      const speedMultiplier = Math.max(1, Math.abs(diff) / 100);
      const increment = this.countSpeed * speedMultiplier * deltaTime;

      if (diff > 0) {
        this.displayValue = Math.min(this.targetValue, this.displayValue + increment);
      } else {
        this.displayValue = Math.max(this.targetValue, this.displayValue - increment);
      }

      this.updateDisplay();

      this.animationFrame = requestAnimationFrame(animate);
    };

    this.animationFrame = requestAnimationFrame(animate);
  },

  /**
   * Update the displayed credit value
   */
  updateDisplay() {
    if (this.creditValueEl) {
      this.creditValueEl.textContent = Math.floor(this.displayValue).toLocaleString();
    }
  },

  /**
   * Show floating "+X" text above credits
   * @param {string} text - Text to display
   */
  showFloatingText(text) {
    const container = document.getElementById('profile-display');
    if (!container) return;

    const float = document.createElement('div');
    float.className = 'credit-float';
    float.textContent = text;

    // Position above the credits display
    const creditsDisplay = document.getElementById('credits-display');
    if (creditsDisplay) {
      const rect = creditsDisplay.getBoundingClientRect();
      float.style.left = `${rect.left + rect.width / 2}px`;
      float.style.top = `${rect.top - 10}px`;
      float.style.transform = 'translateX(-50%)';
    }

    document.body.appendChild(float);

    // Remove after animation completes
    setTimeout(() => {
      float.remove();
    }, 1500);
  },

  /**
   * Play coin collection animation
   */
  playCollectionEffect() {
    if (!this.creditIconContainer) return;

    // Remove existing animation class
    this.creditIconContainer.classList.remove('collecting');

    // Force reflow to restart animation
    void this.creditIconContainer.offsetWidth;

    // Add animation class
    this.creditIconContainer.classList.add('collecting');

    // Remove class after animation completes
    setTimeout(() => {
      this.creditIconContainer.classList.remove('collecting');
    }, 600);
  },

  /**
   * Sync with player credits (call periodically to stay in sync)
   */
  sync() {
    if (typeof Player !== 'undefined' && Player.credits !== undefined) {
      if (this.targetValue !== Player.credits) {
        const diff = Player.credits - this.targetValue;
        if (diff > 0) {
          // Credits increased - animate
          this.addCredits(diff);
        } else {
          // Credits decreased (spent) - direct set
          this.targetValue = Player.credits;
          this.displayValue = Player.credits;
          this.updateDisplay();
        }
      }
    }
  }
};

// Auto-initialize when DOM is ready
if (typeof window !== 'undefined') {
  window.CreditAnimation = CreditAnimation;

  // Initialize after DOM loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => CreditAnimation.init());
  } else {
    // DOM already loaded
    setTimeout(() => CreditAnimation.init(), 0);
  }
}
