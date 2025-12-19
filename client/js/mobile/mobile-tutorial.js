// Galaxy Miner - Mobile Tutorial
// First-launch tutorial overlay introducing touch controls

const MobileTutorial = {
  currentStep: 0,
  isActive: false,
  elements: {},

  STORAGE_KEY: 'galaxyMiner_mobileTutorialComplete',

  steps: [
    {
      id: 'welcome',
      title: 'Welcome to Galaxy Miner',
      content: 'This quick tutorial will show you how to play on mobile. Tap to continue.',
      highlight: null
    },
    {
      id: 'joystick',
      title: 'Movement Controls',
      content: 'Touch and drag on the LEFT side of the screen to move your ship. The virtual joystick appears where you touch.',
      highlight: 'left-zone',
      action: 'try-joystick'
    },
    {
      id: 'fire',
      title: 'Fire Button',
      content: 'Tap and hold the FIRE button to shoot. Your ship will auto-fire at enemies when aimed correctly.',
      highlight: 'fire-button'
    },
    {
      id: 'action',
      title: 'Action Button',
      content: 'The ACTION button changes based on context: Mine asteroids, collect loot, enter wormholes, and more.',
      highlight: 'action-button'
    },
    {
      id: 'autofire',
      title: 'Auto-Fire',
      content: 'When enemies are in your sights, your ship fires automatically. Adjust sensitivity in Settings.',
      highlight: null
    },
    {
      id: 'complete',
      title: 'Ready to Play!',
      content: 'Open the Menu for settings, cargo, and upgrades. Good luck, miner!',
      highlight: 'menu-button'
    }
  ],

  /**
   * Initialize the tutorial system
   */
  init() {
    // Only show on mobile
    if (typeof DeviceDetect === 'undefined' || !DeviceDetect.isMobile) {
      return;
    }

    // Check if tutorial was already completed
    if (this.hasCompletedTutorial()) {
      Logger.log('MobileTutorial: Already completed, skipping');
      return;
    }

    this.createElements();
    Logger.log('MobileTutorial initialized');
  },

  /**
   * Check if tutorial was previously completed
   */
  hasCompletedTutorial() {
    try {
      return localStorage.getItem(this.STORAGE_KEY) === 'true';
    } catch (e) {
      return false;
    }
  },

  /**
   * Mark tutorial as completed
   */
  markComplete() {
    try {
      localStorage.setItem(this.STORAGE_KEY, 'true');
    } catch (e) {
      Logger.warn('MobileTutorial: Could not save completion state');
    }
  },

  /**
   * Reset tutorial (for testing or user request)
   */
  reset() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      this.currentStep = 0;
      Logger.log('MobileTutorial: Reset');
    } catch (e) {
      // Ignore
    }
  },

  /**
   * Create tutorial overlay elements
   */
  createElements() {
    // Main overlay container
    const overlay = document.createElement('div');
    overlay.className = 'mobile-tutorial-overlay';
    overlay.innerHTML = `
      <div class="tutorial-backdrop"></div>
      <div class="tutorial-highlight-zone"></div>
      <div class="tutorial-dialog">
        <div class="tutorial-step-indicator"></div>
        <h3 class="tutorial-title"></h3>
        <p class="tutorial-content"></p>
        <div class="tutorial-actions">
          <button class="tutorial-btn tutorial-skip">Skip</button>
          <button class="tutorial-btn tutorial-next">Next</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    this.elements = {
      overlay: overlay,
      backdrop: overlay.querySelector('.tutorial-backdrop'),
      highlight: overlay.querySelector('.tutorial-highlight-zone'),
      dialog: overlay.querySelector('.tutorial-dialog'),
      stepIndicator: overlay.querySelector('.tutorial-step-indicator'),
      title: overlay.querySelector('.tutorial-title'),
      content: overlay.querySelector('.tutorial-content'),
      skipBtn: overlay.querySelector('.tutorial-skip'),
      nextBtn: overlay.querySelector('.tutorial-next')
    };

    // Bind events
    this.elements.skipBtn.addEventListener('click', () => this.skip());
    this.elements.nextBtn.addEventListener('click', () => this.next());
    this.elements.backdrop.addEventListener('click', () => this.next());

    // Touch events
    this.elements.skipBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.skip();
    }, { passive: false });

    this.elements.nextBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.next();
    }, { passive: false });

    // Add tutorial styles
    this.addStyles();
  },

  /**
   * Add tutorial CSS styles
   */
  addStyles() {
    if (document.getElementById('mobile-tutorial-styles')) return;

    const style = document.createElement('style');
    style.id = 'mobile-tutorial-styles';
    style.textContent = `
      .mobile-tutorial-overlay {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .mobile-tutorial-overlay.active {
        display: block;
      }

      .tutorial-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 10, 0.85);
      }

      .tutorial-highlight-zone {
        position: absolute;
        border: 3px solid #4466ff;
        border-radius: 12px;
        box-shadow: 0 0 0 9999px rgba(0, 0, 10, 0.85),
                    0 0 30px rgba(68, 102, 255, 0.5),
                    inset 0 0 20px rgba(68, 102, 255, 0.3);
        pointer-events: none;
        transition: all 0.3s ease-out;
        display: none;
      }

      .tutorial-highlight-zone.visible {
        display: block;
      }

      .tutorial-dialog {
        position: absolute;
        bottom: 20%;
        left: 50%;
        transform: translateX(-50%);
        width: 90%;
        max-width: 400px;
        background: linear-gradient(145deg, rgba(20, 20, 60, 0.95), rgba(10, 10, 40, 0.95));
        border: 2px solid rgba(68, 102, 255, 0.5);
        border-radius: 16px;
        padding: 24px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5),
                    0 0 20px rgba(68, 102, 255, 0.2);
      }

      .tutorial-step-indicator {
        display: flex;
        justify-content: center;
        gap: 8px;
        margin-bottom: 16px;
      }

      .tutorial-step-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: rgba(68, 102, 255, 0.3);
        transition: all 0.2s;
      }

      .tutorial-step-dot.active {
        background: #4466ff;
        transform: scale(1.3);
      }

      .tutorial-step-dot.completed {
        background: #44ff88;
      }

      .tutorial-title {
        color: #88aaff;
        font-size: 20px;
        font-weight: 600;
        margin: 0 0 12px 0;
        text-align: center;
      }

      .tutorial-content {
        color: #e0e0ff;
        font-size: 16px;
        line-height: 1.5;
        margin: 0 0 20px 0;
        text-align: center;
      }

      .tutorial-actions {
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }

      .tutorial-btn {
        flex: 1;
        padding: 14px 20px;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
      }

      .tutorial-skip {
        background: rgba(100, 100, 100, 0.3);
        color: #aaa;
        border: 1px solid rgba(150, 150, 150, 0.3);
      }

      .tutorial-skip:active {
        background: rgba(100, 100, 100, 0.5);
      }

      .tutorial-next {
        background: linear-gradient(145deg, #4466ff, #3355dd);
        color: white;
        box-shadow: 0 4px 15px rgba(68, 102, 255, 0.4);
      }

      .tutorial-next:active {
        background: linear-gradient(145deg, #3355dd, #4466ff);
        transform: scale(0.98);
      }

      /* Highlight specific zones */
      .tutorial-highlight-zone.left-zone {
        left: 0;
        top: 20%;
        width: 40%;
        height: 60%;
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
      }

      .tutorial-highlight-zone.fire-button,
      .tutorial-highlight-zone.action-button,
      .tutorial-highlight-zone.menu-button {
        border-radius: 50%;
      }
    `;

    document.head.appendChild(style);
  },

  /**
   * Start the tutorial
   */
  start() {
    if (this.hasCompletedTutorial()) {
      Logger.log('MobileTutorial: Already completed');
      return;
    }

    if (!this.elements.overlay) {
      this.createElements();
    }

    this.isActive = true;
    this.currentStep = 0;
    this.elements.overlay.classList.add('active');
    this.showStep(0);

    Logger.log('MobileTutorial: Started');
  },

  /**
   * Show a specific tutorial step
   */
  showStep(stepIndex) {
    if (stepIndex >= this.steps.length) {
      this.complete();
      return;
    }

    const step = this.steps[stepIndex];
    this.currentStep = stepIndex;

    // Update step indicator
    this.updateStepIndicator();

    // Update dialog content
    this.elements.title.textContent = step.title;
    this.elements.content.textContent = step.content;

    // Update button text for last step
    if (stepIndex === this.steps.length - 1) {
      this.elements.nextBtn.textContent = 'Start Playing';
      this.elements.skipBtn.style.display = 'none';
    } else {
      this.elements.nextBtn.textContent = 'Next';
      this.elements.skipBtn.style.display = 'block';
    }

    // Position highlight
    this.positionHighlight(step.highlight);
  },

  /**
   * Update the step indicator dots
   */
  updateStepIndicator() {
    let html = '';
    for (let i = 0; i < this.steps.length; i++) {
      let classes = 'tutorial-step-dot';
      if (i === this.currentStep) classes += ' active';
      else if (i < this.currentStep) classes += ' completed';
      html += `<div class="${classes}"></div>`;
    }
    this.elements.stepIndicator.innerHTML = html;
  },

  /**
   * Position highlight zone for a specific element
   */
  positionHighlight(highlightId) {
    const highlight = this.elements.highlight;

    if (!highlightId) {
      highlight.classList.remove('visible');
      return;
    }

    // Reset classes
    highlight.className = 'tutorial-highlight-zone visible ' + highlightId;

    // Special positioning for mobile UI elements
    switch (highlightId) {
      case 'left-zone':
        // Highlight left side joystick zone
        highlight.style.left = '0';
        highlight.style.top = '20%';
        highlight.style.width = '40%';
        highlight.style.height = '60%';
        highlight.style.right = 'auto';
        highlight.style.bottom = 'auto';
        break;

      case 'fire-button':
        this.highlightElement('.mobile-btn-fire');
        break;

      case 'action-button':
        this.highlightElement('.mobile-btn-action');
        break;

      case 'menu-button':
        this.highlightElement('.mobile-btn-menu');
        break;

      default:
        highlight.classList.remove('visible');
    }
  },

  /**
   * Position highlight around a specific DOM element
   */
  highlightElement(selector) {
    const element = document.querySelector(selector);
    const highlight = this.elements.highlight;

    if (!element) {
      highlight.classList.remove('visible');
      return;
    }

    const rect = element.getBoundingClientRect();
    const padding = 8;

    highlight.style.left = (rect.left - padding) + 'px';
    highlight.style.top = (rect.top - padding) + 'px';
    highlight.style.width = (rect.width + padding * 2) + 'px';
    highlight.style.height = (rect.height + padding * 2) + 'px';
    highlight.style.right = 'auto';
    highlight.style.bottom = 'auto';
  },

  /**
   * Advance to next step
   */
  next() {
    this.showStep(this.currentStep + 1);
  },

  /**
   * Skip the tutorial
   */
  skip() {
    this.complete();
  },

  /**
   * Complete the tutorial
   */
  complete() {
    this.isActive = false;
    this.elements.overlay.classList.remove('active');
    this.markComplete();

    Logger.log('MobileTutorial: Completed');

    // Trigger haptic feedback if available
    if (typeof MobileSettingsPanel !== 'undefined') {
      MobileSettingsPanel.vibrate([50, 50, 50]);
    }
  },

  /**
   * Check if tutorial should auto-start
   */
  shouldAutoStart() {
    return typeof DeviceDetect !== 'undefined' &&
           DeviceDetect.isMobile &&
           !this.hasCompletedTutorial();
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.MobileTutorial = MobileTutorial;
}
