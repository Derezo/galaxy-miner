// Ship Upgrade Panel - Two-panel UI for ship component upgrades
// Left: Ship preview + part selector | Right: Upgrade details + requirements

const ShipUpgradePanel = {
  container: null,
  selectedPart: 'engine',
  shipData: null,
  inventory: {},
  credits: 0,
  isUpgrading: false,

  // Component display info
  COMPONENT_INFO: {
    engine: {
      name: 'Engine',
      description: 'Increases ship speed and maneuverability',
      stats: (tier) => ({
        'Max Speed': { value: `${(100 * Math.pow(1.5, tier - 1)).toFixed(0)}%`, change: tier < 5 ? '+50%' : null },
        'Acceleration': { value: `${(100 * Math.pow(1.3, tier - 1)).toFixed(0)}%`, change: tier < 5 ? '+30%' : null }
      })
    },
    weapon: {
      name: 'Weapons',
      description: 'Increases weapon damage and range',
      stats: (tier) => ({
        'Damage': { value: `${(10 * Math.pow(1.5, tier - 1)).toFixed(1)}`, change: tier < 5 ? '+50%' : null },
        'Range': { value: `${(200 * Math.pow(1.5, tier - 1)).toFixed(0)}`, change: tier < 5 ? '+50%' : null },
        'Cooldown': { value: `${(500 / Math.pow(1.5, tier - 1)).toFixed(0)}ms`, change: tier < 5 ? '-33%' : null }
      })
    },
    shield: {
      name: 'Shields',
      description: 'Increases shield capacity and recharge rate',
      stats: (tier) => ({
        'Capacity': { value: `${(50 * Math.pow(1.5, tier - 1)).toFixed(0)} HP`, change: tier < 5 ? '+50%' : null },
        'Recharge': { value: `${(5 * Math.pow(1.3, tier - 1)).toFixed(1)} HP/s`, change: tier < 5 ? '+30%' : null }
      })
    },
    mining: {
      name: 'Mining Beam',
      description: 'Increases mining speed and yield',
      stats: (tier) => ({
        'Mining Speed': { value: `${(100 * Math.pow(1.4, tier - 1)).toFixed(0)}%`, change: tier < 5 ? '+40%' : null },
        'Yield Bonus': { value: `+${((tier - 1) * 10)}%`, change: tier < 5 ? '+10%' : null }
      })
    },
    cargo: {
      name: 'Cargo Hold',
      description: 'Increases cargo capacity',
      stats: (tier) => {
        const capacities = [0, 100, 250, 500, 750, 2000];
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
      description: 'Increases detection range and target tracking',
      stats: (tier) => ({
        'Range': { value: `${(500 * Math.pow(1.5, tier - 1)).toFixed(0)} units`, change: tier < 5 ? '+50%' : null },
        'Tracking': { value: `${tier * 2} targets`, change: tier < 5 ? '+2' : null }
      })
    },
    energy_core: {
      name: 'Energy Core',
      description: 'Reduces cooldowns, boosts shield regen, enables thrust boost',
      stats: (tier) => {
        const cooldownReduction = [0, 5, 10, 15, 20, 25][tier];
        const shieldBonus = [0, 0.5, 1.0, 1.5, 2.0, 2.5][tier];
        const boostDuration = [0, 1.0, 1.25, 1.5, 1.75, 2.0][tier];
        const boostCooldown = [0, 15, 13, 11, 9, 7][tier];
        return {
          'Cooldown Reduction': { value: `-${cooldownReduction}%`, change: tier < 5 ? '-5%' : null },
          'Shield Regen': { value: `+${shieldBonus.toFixed(1)} HP/s`, change: tier < 5 ? '+0.5' : null },
          'Boost Duration': { value: `${boostDuration.toFixed(2)}s`, change: tier < 5 ? '+0.25s' : null },
          'Boost Cooldown': { value: `${boostCooldown}s`, change: tier < 5 ? '-2s' : null }
        };
      }
    },
    hull: {
      name: 'Hull',
      description: 'Increases damage resistance against all weapon types',
      stats: (tier) => {
        const kinetic = [0, 5, 10, 15, 20, 25][tier];
        const energy = [0, 8, 15, 22, 28, 35][tier];
        const explosive = [0, 3, 6, 9, 12, 15][tier];
        return {
          'Kinetic Resist': { value: `${kinetic}%`, change: tier < 5 ? '+5%' : null },
          'Energy Resist': { value: `${energy}%`, change: tier < 5 ? '+7%' : null },
          'Explosive Resist': { value: `${explosive}%`, change: tier < 5 ? '+3%' : null }
        };
      }
    }
  },

  // Resource display names and icons
  RESOURCE_DISPLAY: {
    HYDROGEN: { name: 'Hydrogen', color: '#88ccff' },
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
    this.container = container;
    this.render();
  },

  /**
   * Update player data
   * @param {Object} data - { ship, inventory, credits }
   */
  updateData(data) {
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
    if (data.inventory) {
      this.inventory = {};
      data.inventory.forEach(item => {
        this.inventory[item.resource_type] = item.quantity;
      });
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
    const currentTier = this.getTier(partKey);
    if (currentTier >= 5) {
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
    this.render();

    // Send upgrade request via socket
    if (typeof Network !== 'undefined' && Network.socket) {
      Network.socket.emit('ship:upgrade', { component: this.selectedPart });
    } else {
      console.error('[UPGRADE] Network.socket is undefined!');
      this.isUpgrading = false;
      this.render();
      if (typeof NotificationManager !== 'undefined') {
        NotificationManager.error('Connection error. Please refresh the page.');
      }
      return;
    }

    // Reset upgrading state after timeout if no server response received
    this._upgradeTimeoutId = setTimeout(() => {
      if (this.isUpgrading) {
        this.isUpgrading = false;
        this.render();
        // Show error notification if no response was received
        if (typeof NotificationManager !== 'undefined') {
          NotificationManager.error('Upgrade request timed out. Please try again.');
        }
      }
    }, 5000);
  },

  /**
   * Handle successful upgrade
   * @param {Object} data - Upgrade result from server
   */
  onUpgradeSuccess(data) {
    if (this._upgradeTimeoutId) {
      clearTimeout(this._upgradeTimeoutId);
      this._upgradeTimeoutId = null;
    }
    this.isUpgrading = false;

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
    this.lastError = error;
    this.render();

    // Clear error after a few seconds
    setTimeout(() => {
      this.lastError = null;
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
      window.ShipPreviewCanvas.startAnimation();
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
    const canUpgrade = affordability.canAfford && !this.isUpgrading;

    if (this.isUpgrading) {
      return `
        <button class="upgrade-button unavailable" disabled>
          <div class="upgrade-loading">
            <div class="upgrade-loading-spinner"></div>
          </div>
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
    if (window.ShipPreviewCanvas) {
      window.ShipPreviewCanvas.stopAnimation();
      window.ShipPreviewCanvas.destroy();
    }
    this.container = null;
  }
};

// Export for use in browser
if (typeof window !== 'undefined') {
  window.ShipUpgradePanel = ShipUpgradePanel;
}
