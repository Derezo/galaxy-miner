// Galaxy Miner - Mobile HUD
// Touch-friendly action buttons for mobile play

const MobileHUD = {
  elements: {},
  firingInterval: null,
  contextUpdateIntervalId: null,
  _manualFiringActive: false,

  init() {
    if (typeof DeviceDetect === 'undefined' || !DeviceDetect.isMobile) {
      Logger.log('MobileHUD: Not initializing (not mobile)');
      return;
    }

    this.createActionButtons();
    this.bindEvents();
    this.startContextUpdateLoop();
    Logger.log('MobileHUD initialized');
  },

  createActionButtons() {
    const container = document.createElement('div');
    container.className = 'mobile-action-buttons';
    container.innerHTML = `
      <button class="mobile-btn mobile-btn-menu" data-action="menu">
        <span class="btn-icon">☰</span>
      </button>
      <button class="mobile-btn mobile-btn-action" data-action="context">
        <span class="btn-icon">⛏</span>
        <span class="btn-label">Action</span>
      </button>
      <button class="mobile-btn mobile-btn-fire" data-action="fire">
        <span class="btn-icon">⚡</span>
      </button>
    `;

    // Add to UI container
    const uiContainer = document.getElementById('ui-container');
    if (uiContainer) {
      uiContainer.appendChild(container);
    } else {
      document.body.appendChild(container);
    }

    this.elements.container = container;
    this.elements.fireBtn = container.querySelector('[data-action="fire"]');
    this.elements.actionBtn = container.querySelector('[data-action="context"]');
    this.elements.menuBtn = container.querySelector('[data-action="menu"]');

    // Create auto-fire indicator (CSS already exists in mobile.css)
    this.createAutofireIndicator();
  },

  /**
   * Create the auto-fire target indicator element
   */
  createAutofireIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'autofire-indicator';
    indicator.innerHTML = `
      <span class="autofire-icon">🎯</span>
      <span class="autofire-label">AUTO</span>
    `;

    const uiContainer = document.getElementById('ui-container');
    if (uiContainer) {
      uiContainer.appendChild(indicator);
    } else {
      document.body.appendChild(indicator);
    }

    this.elements.autofireIndicator = indicator;
  },

  bindEvents() {
    // Track fire button touch ID for multi-touch support
    this.fireTouchId = null;

    // Fire button - continuous fire while held
    this.elements.fireBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation(); // Prevent canvas from seeing this touch
      // Track this touch for multi-touch support
      if (e.changedTouches.length > 0) {
        this.fireTouchId = e.changedTouches[0].identifier;
      }
      this.startFiring();
    }, { passive: false });

    this.elements.fireBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Only stop firing if this is our tracked touch
      for (const touch of e.changedTouches) {
        if (touch.identifier === this.fireTouchId) {
          this.fireTouchId = null;
          this.stopFiring();
          break;
        }
      }
    }, { passive: false });

    this.elements.fireBtn.addEventListener('touchcancel', (e) => {
      e.stopPropagation();
      this.fireTouchId = null;
      this.stopFiring();
    }, { passive: false });

    // Context action button (replaces M key)
    this.elements.actionBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.triggerContextAction();
    }, { passive: false });

    // Menu button (opens terminal)
    this.elements.menuBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.openMenu();
    }, { passive: false });
  },

  startFiring() {
    // Mark manual firing as active (AutoFire checks this flag)
    this._manualFiringActive = true;

    // Fire immediately
    if (typeof Player !== 'undefined') {
      Player.fire();
    }

    // Get weapon cooldown for proper firing rate
    const cooldown = this.getWeaponCooldown();

    // Continue firing while held at weapon's fire rate
    this.firingInterval = setInterval(() => {
      if (typeof Player !== 'undefined' && !Player.isDead) {
        Player.fire();
      }
    }, Math.max(cooldown, 100));
  },

  stopFiring() {
    this._manualFiringActive = false;

    if (this.firingInterval) {
      clearInterval(this.firingInterval);
      this.firingInterval = null;
    }
  },

  /**
   * Get current weapon cooldown in ms
   */
  getWeaponCooldown() {
    if (typeof Player === 'undefined' || typeof CONSTANTS === 'undefined') {
      return 200; // Default fallback
    }

    const weaponTier = Player.tiers?.weapon || 1;
    const baseCooldown = CONSTANTS.BASE_FIRE_RATE || 500;
    const cooldownReduction = CONSTANTS.FIRE_RATE_REDUCTION_PER_TIER || 50;

    return Math.max(100, baseCooldown - (weaponTier - 1) * cooldownReduction);
  },

  triggerContextAction() {
    if (typeof Player === 'undefined') return;

    // Priority order matches desktop M key behavior
    // Mining/wreckage take precedence over plunder so players can interact near bases
    // 1. Wormhole (if gem equipped and near wormhole)
    if (Player._nearestWormhole && Player.hasRelic('WORMHOLE_GEM') && !Player.inWormholeTransit) {
      Player.tryEnterWormhole();
      return;
    }

    // 2. Mining (if near mineable and not already mining)
    if (Player._nearestMineable && !Player.miningTarget) {
      Player.tryMine();
      return;
    }

    // 3. Multi-collect wreckage (if has Scrap Siphon and wreckage in range)
    if (Player.hasRelic('SCRAP_SIPHON') && typeof Entities !== 'undefined' &&
        Entities.hasNonDerelictWreckageInRange(Player.position, CONSTANTS.RELIC_TYPES?.SCRAP_SIPHON?.effects?.multiWreckageRange || 300)) {
      Player.tryMultiCollectWreckage();
      return;
    }

    // 4. Single collect wreckage (if wreckage in range)
    if (typeof Entities !== 'undefined' && Entities.getClosestWreckage(Player.position, CONSTANTS.MINING_RANGE || 100)) {
      Player.tryCollectWreckage();
      return;
    }

    // 5. Derelict salvage
    if (Player._nearestDerelict) {
      Player.trySalvageDerelict();
      return;
    }

    // 6. Base plunder (if skull & bones equipped and near base)
    if (Player._nearestBase && Player.hasRelic('SKULL_AND_BONES')) {
      Player.tryPlunderBase();
      return;
    }

    // 7. Fallback: try wreckage/siphon even if nothing detected in range
    if (Player.hasRelic('SCRAP_SIPHON')) {
      Player.tryMultiCollectWreckage();
      return;
    }
    Player.tryCollectWreckage();
  },

  openMenu() {
    if (typeof TerminalUI !== 'undefined') {
      TerminalUI.toggle();
    }
  },

  /**
   * Update action button label and icon based on context
   */
  updateActionButton() {
    if (!this.elements.actionBtn) return;
    if (typeof Player === 'undefined') return;

    const iconEl = this.elements.actionBtn.querySelector('.btn-icon');
    const labelEl = this.elements.actionBtn.querySelector('.btn-label');

    let icon = '⛏';
    let label = 'Action';

    // Check context in priority order
    if (Player._nearestWormhole && Player.hasRelic('WORMHOLE_GEM') && !Player.inWormholeTransit) {
      icon = '🌀';
      label = 'Wormhole';
    } else if (Player._nearestBase && Player.hasRelic('SKULL_AND_BONES')) {
      icon = '💀';
      label = 'Plunder';
    } else if (Player._nearestMineable && !Player.miningTarget) {
      icon = '⛏';
      label = 'Mine';
    } else if (this.checkNearbyWreckage()) {
      icon = '📦';
      label = 'Collect';
    }

    if (iconEl) iconEl.textContent = icon;
    if (labelEl) labelEl.textContent = label;
  },

  /**
   * Check if there's wreckage nearby
   */
  checkNearbyWreckage() {
    if (typeof Entities === 'undefined') return false;

    const collectRange = (typeof CONSTANTS !== 'undefined' && CONSTANTS.MINING_RANGE) || 100;
    const closestWreckage = Entities.getClosestWreckage(Player.position, collectRange);
    return closestWreckage !== null;
  },

  /**
   * Start periodic context updates
   */
  startContextUpdateLoop() {
    // Clear any existing interval first
    if (this.contextUpdateIntervalId) {
      clearInterval(this.contextUpdateIntervalId);
    }

    // Update context button every 250ms
    this.contextUpdateIntervalId = setInterval(() => {
      if (typeof GalaxyMiner !== 'undefined' && GalaxyMiner.gameStarted) {
        this.updateActionButton();
        this.updateAutofireIndicator();
      }
    }, 250);
  },

  /**
   * Update auto-fire indicator visibility
   */
  updateAutofireIndicator() {
    if (!this.elements.autofireIndicator) return;

    const hasTarget = typeof AutoFire !== 'undefined' &&
                      AutoFire.enabled &&
                      AutoFire.hasTarget();

    this.elements.autofireIndicator.classList.toggle('has-target', hasTarget);
  },

  /**
   * Show/hide the mobile HUD
   */
  show() {
    if (this.elements.container) {
      this.elements.container.style.display = 'flex';
    }
  },

  hide() {
    if (this.elements.container) {
      this.elements.container.style.display = 'none';
    }
    this.stopFiring();
  },

  /**
   * Clean up all intervals and resources
   */
  destroy() {
    if (this.contextUpdateIntervalId) {
      clearInterval(this.contextUpdateIntervalId);
      this.contextUpdateIntervalId = null;
    }
    this.stopFiring();

    // Remove elements
    if (this.elements.container && this.elements.container.parentNode) {
      this.elements.container.parentNode.removeChild(this.elements.container);
    }
    if (this.elements.autofireIndicator && this.elements.autofireIndicator.parentNode) {
      this.elements.autofireIndicator.parentNode.removeChild(this.elements.autofireIndicator);
    }

    this.elements = {};
    Logger.log('MobileHUD destroyed');
  }
};
