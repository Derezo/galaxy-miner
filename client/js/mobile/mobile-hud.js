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
      if (!this.isGameplayAvailable()) return;
      if (this.fireTouchId !== null) return;
      // Track this touch for multi-touch support
      if (e.changedTouches.length > 0) {
        this.fireTouchId = e.changedTouches[0].identifier;
        this.startFiring();
      }
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
      const canceledOwner = Array.from(e.changedTouches || [])
        .some(touch => touch.identifier === this.fireTouchId);
      const ownerStillActive = Array.from(e.touches || [])
        .some(touch => touch.identifier === this.fireTouchId);
      if (canceledOwner || (e.touches && !ownerStillActive)) {
        this.fireTouchId = null;
        this.stopFiring();
      }
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
    if (!this.isGameplayAvailable()) return;
    if (this.firingInterval) return;
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
    }, cooldown);
  },

  stopFiring() {
    this._manualFiringActive = false;
    // A blur/disconnect/visibility reset may not deliver the owner's final
    // touchend. Release ownership together with the firing interval.
    this.fireTouchId = null;

    if (this.firingInterval) {
      clearInterval(this.firingInterval);
      this.firingInterval = null;
    }
  },

  /**
   * Get current weapon cooldown in ms
   */
  getWeaponCooldown() {
    if (typeof Player !== 'undefined' && typeof Player.getWeaponCooldown === 'function') {
      return Player.getWeaponCooldown();
    }

    if (typeof AutoFire !== 'undefined' && typeof AutoFire.getWeaponCooldown === 'function') {
      return AutoFire.getWeaponCooldown();
    }

    return 500;
  },

  triggerContextAction() {
    if (!this.isGameplayAvailable() || typeof Player === 'undefined' || Player.isDead) return;

    switch (this.getContextAction()) {
      case 'wormhole':
        Player.tryEnterWormhole();
        break;
      case 'mine':
        Player.tryMine();
        break;
      case 'multiCollect':
        Player.tryMultiCollectWreckage();
        break;
      case 'salvage':
        Player.trySalvageDerelict();
        break;
      case 'plunder':
        Player.tryPlunderBase();
        break;
      case 'collect':
        Player.tryCollectWreckage();
        break;
    }
  },

  isGameplayAvailable() {
    if (typeof GalaxyMiner === 'undefined') return true;
    return GalaxyMiner.gameStarted === true && GalaxyMiner.connectionPaused !== true;
  },

  /**
   * Resolve the context action once so the visible label and touch behavior
   * always share the desktop action priority.
   */
  getContextAction() {
    if (typeof Player === 'undefined') return 'none';

    const hasWormholeGem = Player.hasRelic('WORMHOLE_GEM');
    const hasScrapSiphon = Player.hasRelic('SCRAP_SIPHON');
    const hasSkullAndBones = Player.hasRelic('SKULL_AND_BONES');

    if (Player._nearestWormhole && hasWormholeGem && !Player.inWormholeTransit) {
      return 'wormhole';
    }
    if (Player._nearestMineable && !Player.miningTarget) {
      return 'mine';
    }

    const siphonRange = (typeof CONSTANTS !== 'undefined' &&
      CONSTANTS.RELIC_TYPES?.SCRAP_SIPHON?.effects?.multiWreckageRange) || 300;
    if (hasScrapSiphon && typeof Entities !== 'undefined' &&
        Entities.hasNonDerelictWreckageInRange(Player.position, siphonRange)) {
      return 'multiCollect';
    }

    const collectRange = (typeof CONSTANTS !== 'undefined' && CONSTANTS.MINING_RANGE) || 100;
    if (typeof Entities !== 'undefined' && Entities.getClosestWreckage(Player.position, collectRange)) {
      return 'collect';
    }
    if (Player._nearestDerelict) {
      return 'salvage';
    }
    if (Player._nearestBase && hasSkullAndBones) {
      return 'plunder';
    }

    return hasScrapSiphon ? 'multiCollect' : 'collect';
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

    let icon;
    let label;

    switch (this.getContextAction()) {
      case 'wormhole':
        icon = '🌀';
        label = 'Wormhole';
        break;
      case 'mine':
        icon = '⛏';
        label = 'Mine';
        break;
      case 'multiCollect':
        icon = '🧲';
        label = 'Siphon';
        break;
      case 'salvage':
        icon = '🛠';
        label = 'Salvage';
        break;
      case 'plunder':
        icon = '💀';
        label = 'Plunder';
        break;
      case 'collect':
        icon = '📦';
        label = 'Collect';
        break;
      default:
        icon = '⛏';
        label = 'Action';
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
