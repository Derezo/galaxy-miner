// Ship Upgrade Panel - Two-panel UI for ship component upgrades
// Left: Ship preview + part selector | Right: Upgrade details + requirements

const ShipUpgradePanel = {
  container: null,
  selectedPart: 'engine',
  shipData: null,
  inventory: {},
  credits: 0,
  isUpgrading: false,
  isAwaitingInventorySync: false,
  isAwaitingFullSync: false,
  isVisible: false,
  lastError: null,
  _upgradeTimeoutId: null,
  _errorTimeoutId: null,

  // Component display info. Every value is derived from the same shared
  // constants used by the authoritative server; keep presentation math here
  // free of independent balance constants.
  COMPONENT_INFO: {
    engine: {
      name: 'Engine',
      description: 'Increases maximum flight speed',
      stats: (tier) => {
        const config = window.CONSTANTS || {};
        const multiplier = config.TIER_MULTIPLIER || 1;
        const currentScale = Math.pow(multiplier, tier - 1);
        const nextScale = Math.pow(multiplier, tier);
        const currentSpeed = (config.BASE_SPEED || 0) * currentScale;
        const nextSpeed = (config.BASE_SPEED || 0) * nextScale;
        return {
          'Max Speed': {
            value: `${currentSpeed.toFixed(0)} u/s`,
            change: tier < (config.MAX_TIER || 5) ? `+${(nextSpeed - currentSpeed).toFixed(0)} u/s` : null
          },
          'Speed Multiplier': {
            value: `${currentScale.toFixed(2)}x`,
            change: tier < (config.MAX_TIER || 5) ? `+${(nextScale - currentScale).toFixed(2)}x` : null
          }
        };
      }
    },
    weapon: {
      name: 'Weapons',
      description: 'Increases weapon damage, range, and fire rate',
      stats: (tier) => {
        const config = window.CONSTANTS || {};
        const multiplier = config.TIER_MULTIPLIER || 1;
        const maxTier = config.MAX_TIER || 5;
        const currentDamage = (config.BASE_WEAPON_DAMAGE || 0) * Math.pow(multiplier, tier - 1);
        const nextDamage = (config.BASE_WEAPON_DAMAGE || 0) * Math.pow(multiplier, tier);
        const ranges = config.WEAPON_RANGES || [];
        const currentRange = ranges[tier] || (config.BASE_WEAPON_RANGE || 0) * Math.pow(multiplier, tier - 1);
        const nextRange = ranges[tier + 1] || currentRange;
        const currentCooldown = (config.BASE_WEAPON_COOLDOWN || 0) / Math.pow(multiplier, tier - 1);
        const nextCooldown = (config.BASE_WEAPON_COOLDOWN || 0) / Math.pow(multiplier, tier);
        return {
          'Damage': {
            value: currentDamage.toFixed(1),
            change: tier < maxTier ? `+${(nextDamage - currentDamage).toFixed(1)}` : null
          },
          'Range': {
            value: `${currentRange.toFixed(0)} units`,
            change: tier < maxTier && nextRange !== currentRange ? `+${(nextRange - currentRange).toFixed(0)}` : null
          },
          'Base Cooldown': {
            value: `${currentCooldown.toFixed(0)}ms`,
            change: tier < maxTier ? `-${(currentCooldown - nextCooldown).toFixed(0)}ms` : null
          }
        };
      }
    },
    shield: {
      name: 'Shields',
      description: 'Increases maximum shield capacity',
      stats: (tier) => {
        const config = window.CONSTANTS || {};
        const multiplier = config.SHIELD_TIER_MULTIPLIER || 1;
        const current = (config.DEFAULT_SHIELD_HP || 0) * Math.pow(multiplier, tier - 1);
        const next = (config.DEFAULT_SHIELD_HP || 0) * Math.pow(multiplier, tier);
        return {
          'Capacity': {
            value: `${current.toFixed(0)} HP`,
            change: tier < (config.MAX_TIER || 5) ? `+${(next - current).toFixed(0)} HP` : null
          }
        };
      }
    },
    mining: {
      name: 'Mining Beam',
      description: 'Increases mining speed and yield',
      stats: (tier) => {
        const config = window.CONSTANTS || {};
        const multiplier = config.TIER_MULTIPLIER || 1;
        const maxTier = config.MAX_TIER || 5;
        const currentScale = Math.pow(multiplier, tier - 1);
        const nextScale = Math.pow(multiplier, tier);
        const currentTime = (config.BASE_MINING_TIME || 0) / currentScale;
        const nextTime = (config.BASE_MINING_TIME || 0) / nextScale;
        const currentYield = Math.max(1, Math.floor(
          config.MINING_YIELD_BY_TIER?.[tier] || config.BASE_MINING_YIELD || 1
        ));
        const nextYield = Math.max(1, Math.floor(
          config.MINING_YIELD_BY_TIER?.[tier + 1] || currentYield
        ));
        return {
          'Cycle Time': {
            value: `${(currentTime / 1000).toFixed(2)}s`,
            change: tier < maxTier ? `-${((currentTime - nextTime) / 1000).toFixed(2)}s` : null
          },
          'Yield': {
            value: `${currentYield} unit${currentYield === 1 ? '' : 's'}`,
            change: tier < maxTier && nextYield !== currentYield ? `+${nextYield - currentYield}` : null
          }
        };
      }
    },
    cargo: {
      name: 'Cargo Hold',
      description: 'Increases cargo capacity',
      stats: (tier) => {
        const capacities = window.CONSTANTS?.CARGO_CAPACITY || [];
        const current = capacities[tier];
        const next = capacities[tier + 1];
        const change = next ? `+${next - current}` : null;
        return {
          'Capacity': { value: `${current} units`, change }
        };
      }
    },
    radar: {
      name: 'Radar',
      description: 'Increases detection range and unlocks tactical overlays',
      stats: (tier) => {
        const config = window.CONSTANTS || {};
        const currentTier = config.RADAR_TIERS?.[tier] || {};
        const nextTier = config.RADAR_TIERS?.[tier + 1];
        const fallbackRange = (config.BASE_RADAR_RANGE || 0) * Math.pow(config.TIER_MULTIPLIER || 1, tier - 1);
        const currentRange = currentTier.range || fallbackRange;
        return {
          'Range': {
            value: `${currentRange.toFixed(0)} units`,
            change: nextTier ? `+${(nextTier.range - currentRange).toFixed(0)}` : null
          },
          'Radar Mode': {
            value: currentTier.description || `Tier ${tier}`,
            change: null
          }
        };
      }
    },
    energy_core: {
      name: 'Energy Core',
      description: 'Reduces cooldowns, boosts shield regen, enables thrust boost',
      stats: (tier) => {
        const config = window.CONSTANTS || {};
        const energy = config.ENERGY_CORE || {};
        const boost = energy.BOOST || {};
        const nextTier = Math.min(tier + 1, config.MAX_TIER || 5);
        const cooldownReduction = energy.COOLDOWN_REDUCTION?.[tier] || 0;
        const nextCooldownReduction = energy.COOLDOWN_REDUCTION?.[nextTier] || cooldownReduction;
        const shieldBonus = energy.SHIELD_REGEN_BONUS?.[tier] || 0;
        const nextShieldBonus = energy.SHIELD_REGEN_BONUS?.[nextTier] ?? shieldBonus;
        const boostDuration = boost.DURATION?.[tier] || 0;
        const nextBoostDuration = boost.DURATION?.[nextTier] ?? boostDuration;
        const speedMultiplier = boost.SPEED_MULTIPLIER?.[tier] || 1;
        const nextSpeedMultiplier = boost.SPEED_MULTIPLIER?.[nextTier] ?? speedMultiplier;
        const boostCooldown = boost.COOLDOWN?.[tier] || 0;
        const nextBoostCooldown = boost.COOLDOWN?.[nextTier] ?? boostCooldown;
        const canUpgrade = tier < (config.MAX_TIER || 5);
        return {
          'Cooldown Reduction': {
            value: `-${(cooldownReduction * 100).toFixed(0)}%`,
            change: canUpgrade ? `-${((nextCooldownReduction - cooldownReduction) * 100).toFixed(0)}%` : null
          },
          'Shield Regen': {
            value: `+${shieldBonus.toFixed(1)} HP/s`,
            change: canUpgrade ? `+${(nextShieldBonus - shieldBonus).toFixed(1)}` : null
          },
          'Boost Duration': {
            value: `${(boostDuration / 1000).toFixed(2)}s`,
            change: canUpgrade ? `+${((nextBoostDuration - boostDuration) / 1000).toFixed(2)}s` : null
          },
          'Boost Speed': {
            value: `${speedMultiplier.toFixed(1)}x`,
            change: canUpgrade && nextSpeedMultiplier !== speedMultiplier ? `+${(nextSpeedMultiplier - speedMultiplier).toFixed(1)}x` : null
          },
          'Boost Cooldown': {
            value: `${(boostCooldown / 1000).toFixed(0)}s`,
            change: canUpgrade ? `-${((boostCooldown - nextBoostCooldown) / 1000).toFixed(0)}s` : null
          }
        };
      }
    },
    hull: {
      name: 'Hull',
      description: 'Increases hull integrity and damage resistance',
      stats: (tier) => {
        const config = window.CONSTANTS || {};
        const multiplier = config.TIER_MULTIPLIER || 1;
        const nextTier = Math.min(tier + 1, config.MAX_TIER || 5);
        const maxHull = (config.DEFAULT_HULL_HP || 0) * Math.pow(multiplier, tier - 1);
        const nextMaxHull = (config.DEFAULT_HULL_HP || 0) * Math.pow(multiplier, tier);
        const kinetic = config.HULL?.KINETIC_RESIST?.[tier] || 0;
        const energy = config.HULL?.ENERGY_RESIST?.[tier] || 0;
        const explosive = config.HULL?.EXPLOSIVE_RESIST?.[tier] || 0;
        const nextKinetic = config.HULL?.KINETIC_RESIST?.[nextTier] ?? kinetic;
        const nextEnergy = config.HULL?.ENERGY_RESIST?.[nextTier] ?? energy;
        const nextExplosive = config.HULL?.EXPLOSIVE_RESIST?.[nextTier] ?? explosive;
        const canUpgrade = tier < (config.MAX_TIER || 5);
        return {
          'Hull Integrity': {
            value: `${maxHull.toFixed(0)} HP`,
            change: canUpgrade ? `+${(nextMaxHull - maxHull).toFixed(0)} HP` : null
          },
          'Kinetic Resist': {
            value: `${(kinetic * 100).toFixed(0)}%`,
            change: canUpgrade ? `+${((nextKinetic - kinetic) * 100).toFixed(0)}%` : null
          },
          'Energy Resist': {
            value: `${(energy * 100).toFixed(0)}%`,
            change: canUpgrade ? `+${((nextEnergy - energy) * 100).toFixed(0)}%` : null
          },
          'Explosive Resist': {
            value: `${(explosive * 100).toFixed(0)}%`,
            change: canUpgrade ? `+${((nextExplosive - explosive) * 100).toFixed(0)}%` : null
          }
        };
      }
    }
  },

  // Resource display names and icons
  RESOURCE_DISPLAY: {
    HYDROGEN: { name: 'Hydrogen', color: '#88ccff' },
    NITROGEN: { name: 'Nitrogen', color: '#7aa7ff' },
    CARBON: { name: 'Carbon', color: '#555555' },
    IRON: { name: 'Iron', color: '#aa7744' },
    NICKEL: { name: 'Nickel', color: '#99aa88' },
    SILICON: { name: 'Silicon', color: '#8888aa' },
    SULFUR: { name: 'Sulfur', color: '#cccc44' },
    COPPER: { name: 'Copper', color: '#cc8844' },
    PHOSPHORUS: { name: 'Phosphorus', color: '#ff8866' },
    HELIUM3: { name: 'Helium-3', color: '#aaddff' },
    TITANIUM: { name: 'Titanium', color: '#aabbcc' },
    COBALT: { name: 'Cobalt', color: '#4466aa' },
    ICE_CRYSTALS: { name: 'Ice Crystals', color: '#aaffff' },
    LITHIUM: { name: 'Lithium', color: '#ff88aa' },
    SILVER: { name: 'Silver', color: '#ccccdd' },
    NEON: { name: 'Neon', color: '#ff6688' },
    URANIUM: { name: 'Uranium', color: '#44ff44' },
    XENON: { name: 'Xenon', color: '#8866ff' },
    PLATINUM: { name: 'Platinum', color: '#ddddee' },
    IRIDIUM: { name: 'Iridium', color: '#aabbff' },
    GOLD: { name: 'Gold', color: '#ffdd44' },
    QUANTUM_CRYSTALS: { name: 'Quantum Crystals', color: '#ff44ff' },
    DARK_MATTER: { name: 'Dark Matter', color: '#442266' },
    ANTIMATTER: { name: 'Antimatter', color: '#ff2222' },
    EXOTIC_MATTER: { name: 'Exotic Matter', color: '#22ffff' },
    NEUTRONIUM: { name: 'Neutronium', color: '#666688' },
    VOID_CRYSTALS: { name: 'Void Crystals', color: '#110033' }
  },

  /**
   * Initialize the panel
   * @param {HTMLElement} container - Container element for the panel
   */
  init(container) {
    this.reset({ render: false });
    this.container = container;
    this.isVisible = false;
    this.render();
  },

  /**
   * Clear all account-specific and in-flight upgrade state.
   * The container is retained so the already-initialized terminal can be
   * safely reused by a different authenticated account.
   * @param {Object} options
   * @param {boolean} options.render - Whether to immediately redraw the panel
   */
  reset({ render = true } = {}) {
    if (this._upgradeTimeoutId) clearTimeout(this._upgradeTimeoutId);
    if (this._errorTimeoutId) clearTimeout(this._errorTimeoutId);

    this.selectedPart = 'engine';
    this.shipData = null;
    this.inventory = {};
    this.credits = 0;
    this.isUpgrading = false;
    this.isAwaitingInventorySync = false;
    this.isAwaitingFullSync = false;
    this.lastError = null;
    this._upgradeTimeoutId = null;
    this._errorTimeoutId = null;

    if (render) this.render();
  },

  /**
   * Tie preview animation work to the terminal's visible Upgrades tab.
   * The panel remains rendered while hidden so tab switches stay immediate,
   * but it must not retain a background requestAnimationFrame loop.
   * @param {boolean} visible
   */
  setVisible(visible) {
    this.isVisible = !!visible;
    if (!window.ShipPreviewCanvas) return;

    if (this.isVisible && this.container?.querySelector('.ship-preview-canvas')) {
      window.ShipPreviewCanvas.startAnimation();
    } else {
      window.ShipPreviewCanvas.stopAnimation();
    }
  },

  /**
   * Update player data
   * @param {Object} data - { ship, inventory, credits }
   * @param {Object} options
   * @param {boolean} options.authoritativeInventory - Whether inventory came
   *   directly from a server snapshot.
   * @param {boolean} options.authoritativeShip - Whether ship tiers and the
   *   inventory came from the same complete server snapshot. Inventory-only
   *   events cannot resolve a timeout/error whose commit outcome is unknown.
   */
  updateData(data = {}, {
    authoritativeInventory = false,
    authoritativeShip = false
  } = {}) {
    const requiredFullSync = this.isAwaitingFullSync;
    if (data.ship) {
      this.shipData = {
        engineTier: data.ship.engineTier || data.ship.engine_tier || 1,
        weaponTier: data.ship.weaponTier || data.ship.weapon_tier || 1,
        shieldTier: data.ship.shieldTier || data.ship.shield_tier || 1,
        miningTier: data.ship.miningTier || data.ship.mining_tier || 1,
        cargoTier: data.ship.cargoTier || data.ship.cargo_tier || 1,
        radarTier: data.ship.radarTier || data.ship.radar_tier || 1,
        energyCoreTier: data.ship.energyCoreTier || data.ship.energy_core_tier || 1,
        hullTier: data.ship.hullTier || data.ship.hull_tier || 1,
        color: data.ship.color || '#00ffff'
      };
    }
    if (Object.prototype.hasOwnProperty.call(data, 'inventory')) {
      // A terminal refresh may supply cached Player data while an
      // authoritative request is outstanding. Keep the last display values,
      // but do not treat that cache as proof that an upgrade is affordable.
      if (!this.isAwaitingInventorySync || authoritativeInventory) {
        this.inventory = {};
        if (Array.isArray(data.inventory)) {
          data.inventory.forEach(item => {
            if (!item || typeof item.resource_type !== 'string') return;
            this.inventory[item.resource_type] = Number(item.quantity) || 0;
          });
        } else if (data.inventory && typeof data.inventory === 'object') {
          for (const [resource, quantity] of Object.entries(data.inventory)) {
            this.inventory[resource] = Number(quantity) || 0;
          }
        }
      }
      if (authoritativeInventory && (!requiredFullSync || authoritativeShip)) {
        this.isAwaitingInventorySync = false;
      }
    }
    if (authoritativeShip && authoritativeInventory) {
      this.isAwaitingFullSync = false;
    }
    if (typeof data.credits === 'number') {
      this.credits = data.credits;
    }

    // Update ship preview if available
    if (window.ShipPreviewCanvas && this.shipData) {
      window.ShipPreviewCanvas.updateShipData(this.shipData);
    }

    this.render();
  },

  /**
   * Select a part for upgrade details
   * @param {string} partKey - Component key to select
   */
  selectPart(partKey) {
    this.selectedPart = partKey;
    this.render();

    // Highlight in preview
    if (window.ShipPreviewCanvas) {
      window.ShipPreviewCanvas.setHighlightedComponent(partKey);
    }
  },

  /**
   * Get current tier for a component
   * @param {string} partKey - Component key
   * @returns {number} Current tier (1-5)
   */
  getTier(partKey) {
    if (!this.shipData) return 1;
    const tierMap = {
      engine: 'engineTier',
      weapon: 'weaponTier',
      shield: 'shieldTier',
      mining: 'miningTier',
      cargo: 'cargoTier',
      radar: 'radarTier',
      energy_core: 'energyCoreTier',
      hull: 'hullTier'
    };
    return this.shipData[tierMap[partKey]] || 1;
  },

  /**
   * Check if player can afford upgrade
   * @param {string} partKey - Component to check
   * @returns {Object} { canAfford, missingCredits, missingResources }
   */
  checkAffordability(partKey) {
    if (this.isUpgrading || this.isAwaitingInventorySync || this.isAwaitingFullSync) {
      return {
        canAfford: false,
        synchronizing: true,
        missingCredits: 0,
        missingResources: []
      };
    }

    const currentTier = this.getTier(partKey);
    const maxTier = window.CONSTANTS?.MAX_TIER || 5;
    if (currentTier >= maxTier) {
      return { canAfford: false, maxTier: true };
    }

    const nextTier = currentTier + 1;
    const requirements = window.CONSTANTS?.UPGRADE_REQUIREMENTS?.[partKey]?.[nextTier];

    if (!requirements) {
      return { canAfford: false, noRequirements: true };
    }

    const result = {
      canAfford: true,
      missingCredits: 0,
      missingResources: []
    };

    // Check credits
    if (this.credits < requirements.credits) {
      result.canAfford = false;
      result.missingCredits = requirements.credits - this.credits;
    }

    // Check resources
    for (const [resource, needed] of Object.entries(requirements.resources || {})) {
      const have = this.inventory[resource] || 0;
      if (have < needed) {
        result.canAfford = false;
        result.missingResources.push({
          resource,
          have,
          need: needed,
          missing: needed - have
        });
      }
    }

    return result;
  },

  /**
   * Attempt to upgrade selected component
   */
  upgrade() {
    if (this.isUpgrading) return;

    const affordability = this.checkAffordability(this.selectedPart);
    if (!affordability.canAfford) return;

    this.isUpgrading = true;
    this.isAwaitingFullSync = false;
    this.render();
    if (typeof HUD !== 'undefined' &&
        typeof HUD.updateUpgradeIndicator === 'function') {
      HUD.updateUpgradeIndicator();
    }

    // Send upgrade request via socket
    if (typeof Network !== 'undefined' && Network.socket) {
      Network.socket.emit('ship:upgrade', { component: this.selectedPart });
    } else {
      Logger.error('[UPGRADE] Network.socket is undefined!');
      this.isUpgrading = false;
      this.isAwaitingInventorySync = true;
      this.isAwaitingFullSync = true;
      this.render();
      if (typeof HUD !== 'undefined' &&
          typeof HUD.updateUpgradeIndicator === 'function') {
        HUD.updateUpgradeIndicator();
      }
      if (typeof NotificationManager !== 'undefined') {
        NotificationManager.error('Connection error. Please refresh the page.');
      }
      return;
    }

    // Reset upgrading state after timeout if no server response received
    this._upgradeTimeoutId = setTimeout(() => {
      if (this.isUpgrading) {
        this.isUpgrading = false;
        // The request may have committed even if its response was delayed or
        // lost. Fail closed until a complete server snapshot proves the current
        // tier, credits, and consumed resources.
        this.isAwaitingInventorySync = true;
        this.isAwaitingFullSync = true;
        this._upgradeTimeoutId = null;
        this.render();
        if (typeof Network !== 'undefined' &&
            typeof Network.requestShipData === 'function') {
          Network.requestShipData();
        } else if (typeof Network !== 'undefined' && Network.socket) {
          Network.socket.emit('ship:getData');
        }
        if (typeof HUD !== 'undefined' &&
            typeof HUD.updateUpgradeIndicator === 'function') {
          HUD.updateUpgradeIndicator();
        }
        // Show error notification if no response was received
        if (typeof NotificationManager !== 'undefined') {
          NotificationManager.error('Upgrade request timed out. Synchronizing ship data...');
        }
      }
    }, 5000);
  },

  /**
   * Handle successful upgrade
   * @param {Object} data - Upgrade result from server
   */
  onUpgradeSuccess(data, { awaitingInventory = true } = {}) {
    if (this._upgradeTimeoutId) {
      clearTimeout(this._upgradeTimeoutId);
      this._upgradeTimeoutId = null;
    }
    this.isUpgrading = false;
    this.isAwaitingFullSync = false;
    this.isAwaitingInventorySync = awaitingInventory;

    // Play upgrade success sound
    if (typeof AudioManager !== 'undefined') {
      AudioManager.play('upgrade_purchase');
    }

    // Flash success animation
    if (this.container) {
      this.container.classList.add('upgrade-success-flash');
      setTimeout(() => {
        this.container.classList.remove('upgrade-success-flash');
      }, 500);
    }

    this.render();
  },

  /**
   * Handle upgrade failure
   * @param {string} error - Error message
   */
  onUpgradeError(error) {
    if (this._upgradeTimeoutId) {
      clearTimeout(this._upgradeTimeoutId);
      this._upgradeTimeoutId = null;
    }
    this.isUpgrading = false;
    // The server rejected a request that the client believed was affordable.
    // Require one complete ship/inventory snapshot before advertising another
    // purchase; an inventory-only event cannot prove which tier is current.
    this.isAwaitingInventorySync = true;
    this.isAwaitingFullSync = true;
    this.lastError = error;

    // Play upgrade failed sound
    if (typeof AudioManager !== 'undefined') {
      AudioManager.play('notification_error');
    }

    this.render();

    // Clear error after a few seconds
    if (this._errorTimeoutId) clearTimeout(this._errorTimeoutId);
    this._errorTimeoutId = setTimeout(() => {
      this.lastError = null;
      this._errorTimeoutId = null;
      this.render();
    }, 3000);
  },

  /**
   * Render the panel
   */
  render() {
    if (!this.container) return;

    const html = `
      <div class="ship-upgrade-panel">
        ${this._renderLeftPanel()}
        ${this._renderRightPanel()}
      </div>
    `;

    this.container.innerHTML = html;

    // Initialize ship preview canvas
    const canvas = this.container.querySelector('.ship-preview-canvas');
    if (canvas && window.ShipPreviewCanvas) {
      canvas.width = 248;
      canvas.height = 180;
      window.ShipPreviewCanvas.init(canvas);
      if (this.shipData) {
        window.ShipPreviewCanvas.updateShipData(this.shipData);
      }
      if (this.isVisible) {
        window.ShipPreviewCanvas.startAnimation();
      } else {
        window.ShipPreviewCanvas.stopAnimation();
        window.ShipPreviewCanvas.render();
      }
    }

    // Render part icons with ShipPartShape
    this._renderPartIcons();

    // Bind events
    this._bindEvents();
  },

  _renderLeftPanel() {
    return `
      <div class="ship-upgrade-left">
        <div class="ship-preview-container">
          <span class="ship-preview-label">Ship Preview</span>
          <canvas class="ship-preview-canvas"></canvas>
        </div>
        <div class="part-selector">
          ${this._renderPartSelectorIcons()}
        </div>
      </div>
    `;
  },

  _renderPartSelectorIcons() {
    const parts = ['engine', 'weapon', 'shield', 'mining', 'cargo', 'radar', 'energy_core', 'hull'];

    return parts.map(part => {
      const tier = this.getTier(part);
      const info = this.COMPONENT_INFO[part];
      const selected = this.selectedPart === part ? 'selected' : '';

      return `
        <div class="part-icon-wrapper ${selected}" data-part="${part}">
          <div class="part-icon" data-part-icon="${part}" data-tier="${tier}"></div>
          <span class="part-tier-badge tier-${tier}">T${tier}</span>
          <div class="part-tooltip">${info.name}</div>
        </div>
      `;
    }).join('');
  },

  _renderPartIcons() {
    if (!window.ShipPartShape) return;

    const iconContainers = this.container.querySelectorAll('[data-part-icon]');
    iconContainers.forEach(container => {
      const part = container.dataset.partIcon;
      const tier = parseInt(container.dataset.tier) || 1;
      const state = this.selectedPart === part ? 'selected' : 'idle';

      const svg = window.ShipPartShape.createSVG(part, 48, tier, state);
      container.innerHTML = '';
      container.appendChild(svg);
    });
  },

  _renderRightPanel() {
    const part = this.selectedPart;
    const info = this.COMPONENT_INFO[part];
    const currentTier = this.getTier(part);
    const isMaxTier = currentTier >= 5;

    return `
      <div class="ship-upgrade-right">
        ${this._renderComponentHeader(part, info, currentTier, isMaxTier)}
        ${this._renderStatsSection(part, info, currentTier, isMaxTier)}
        ${isMaxTier ? this._renderMaxTierMessage() : this._renderRequirementsSection(part, currentTier)}
        ${this.lastError ? `<div class="upgrade-error">${this.lastError}</div>` : ''}
      </div>
    `;
  },

  _renderComponentHeader(part, info, tier, isMaxTier) {
    return `
      <div class="component-header">
        <div class="component-icon-large" data-part-icon="${part}" data-tier="${tier}"></div>
        <div class="component-title">
          <h3 class="component-name">${info.name}</h3>
          <div class="component-tier-display">
            <div class="tier-dots">
              ${[1, 2, 3, 4, 5].map(t => `
                <div class="tier-dot ${t <= tier ? 'filled' : ''} ${t === tier + 1 ? 'next' : ''}"></div>
              `).join('')}
            </div>
          </div>
        </div>
        ${this._renderUpgradeButton(part, isMaxTier)}
      </div>
    `;
  },

  _renderStatsSection(part, info, tier, isMaxTier) {
    const currentStats = info.stats(tier);
    const nextStats = !isMaxTier ? info.stats(tier + 1) : null;

    return `
      <div class="stats-section">
        <div class="stats-column">
          <div class="stats-column-header">Current Stats</div>
          ${Object.entries(currentStats).map(([name, data]) => `
            <div class="stat-row">
              <span class="stat-name">${name}</span>
              <span class="stat-value">${data.value}</span>
            </div>
          `).join('')}
        </div>
        ${nextStats ? `
          <div class="stats-column next-tier">
            <div class="stats-column-header">Next Tier</div>
            ${Object.entries(nextStats).map(([name, data]) => `
              <div class="stat-row">
                <span class="stat-name">${name}</span>
                <span class="stat-value improved">${data.value}</span>
                ${currentStats[name]?.change ? `<span class="stat-change">${currentStats[name].change}</span>` : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  },

  _renderMaxTierMessage() {
    return `
      <div class="max-tier-message">
        <div class="max-tier-badge">MAXIMUM TIER</div>
        <p>This component has reached its maximum upgrade level.</p>
      </div>
    `;
  },

  _renderRequirementsSection(part, currentTier) {
    const nextTier = currentTier + 1;
    const requirements = window.CONSTANTS?.UPGRADE_REQUIREMENTS?.[part]?.[nextTier];

    if (!requirements) {
      return '<div class="requirements-section">Requirements data unavailable</div>';
    }

    const affordability = this.checkAffordability(part);

    return `
      <div class="requirements-section">
        <div class="requirements-header">Requirements</div>

        <div class="requirement-row">
          <span class="requirement-name">
            <span class="requirement-icon">$</span>
            Credits
          </span>
          <div class="requirement-values">
            <span class="requirement-have">${this.credits.toLocaleString()} /</span>
            <span class="requirement-need ${this.credits >= requirements.credits ? 'affordable' : 'insufficient'}">
              ${requirements.credits.toLocaleString()}
            </span>
            <span class="requirement-check ${this.credits >= requirements.credits ? 'met' : 'unmet'}"></span>
          </div>
        </div>

        ${Object.entries(requirements.resources || {}).map(([resource, needed]) => {
          const have = this.inventory[resource] || 0;
          const displayInfo = this.RESOURCE_DISPLAY[resource] || { name: resource, color: '#888' };

          return `
            <div class="requirement-row">
              <span class="requirement-name">
                <span class="requirement-icon" style="color: ${displayInfo.color};">&#9670;</span>
                ${displayInfo.name}
              </span>
              <div class="requirement-values">
                <span class="requirement-have">${have} /</span>
                <span class="requirement-need ${have >= needed ? 'affordable' : 'insufficient'}">
                  ${needed}
                </span>
                <span class="requirement-check ${have >= needed ? 'met' : 'unmet'}"></span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  _renderUpgradeButton(part, isMaxTier) {
    if (isMaxTier) {
      return `<button class="upgrade-button max-tier" disabled></button>`;
    }

    const affordability = this.checkAffordability(part);
    const canUpgrade = affordability.canAfford &&
      !this.isUpgrading &&
      !this.isAwaitingInventorySync &&
      !this.isAwaitingFullSync;

    if (this.isUpgrading || this.isAwaitingInventorySync || this.isAwaitingFullSync) {
      return `
        <button class="upgrade-button unavailable" disabled>
          ${this.isUpgrading ? `
            <div class="upgrade-loading">
              <div class="upgrade-loading-spinner"></div>
            </div>
          ` : 'SYNCING...'}
        </button>
      `;
    }

    return `
      <button class="upgrade-button ${canUpgrade ? 'available' : 'unavailable'}" ${!canUpgrade ? 'disabled' : ''} data-action="upgrade">
        UPGRADE
      </button>
    `;
  },

  _bindEvents() {
    // Part selection
    const partWrappers = this.container.querySelectorAll('.part-icon-wrapper');
    partWrappers.forEach(wrapper => {
      wrapper.addEventListener('click', () => {
        const part = wrapper.dataset.part;
        if (part) this.selectPart(part);
      });
    });

    // Upgrade button
    const upgradeBtn = this.container.querySelector('[data-action="upgrade"]');
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', () => this.upgrade());
    }
  },

  /**
   * Clean up resources
   */
  destroy() {
    this.isVisible = false;
    if (window.ShipPreviewCanvas) {
      window.ShipPreviewCanvas.stopAnimation();
      window.ShipPreviewCanvas.destroy();
    }
    this.container = null;
    this.reset({ render: false });
  }
};

// Export for use in browser
if (typeof window !== 'undefined') {
  window.ShipUpgradePanel = ShipUpgradePanel;
}
