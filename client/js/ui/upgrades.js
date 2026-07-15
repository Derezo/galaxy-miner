// Galaxy Miner - Upgrades UI (Terminal Tab)

const UpgradesUI = {
  isUpgrading: false,
  isAwaitingInventorySync: false,
  isAwaitingFullSync: false,
  pendingComponent: null,
  _upgradeTimeoutId: null,

  COMPONENTS: [
    { key: 'engine', tierKey: 'engineTier', name: 'Engine', effect: 'Speed' },
    { key: 'weapon', tierKey: 'weaponTier', name: 'Weapon', effect: 'Damage & Range' },
    { key: 'shield', tierKey: 'shieldTier', name: 'Shield', effect: 'Capacity & Recharge' },
    { key: 'mining', tierKey: 'miningTier', name: 'Mining Laser', effect: 'Mining Speed' },
    { key: 'cargo', tierKey: 'cargoTier', name: 'Cargo Hold', effect: 'Inventory Capacity' },
    { key: 'radar', tierKey: 'radarTier', name: 'Radar', effect: 'Detection Range' },
    { key: 'energy_core', tierKey: 'energyCoreTier', name: 'Energy Core', effect: 'Cooldowns & Boost' },
    { key: 'hull', tierKey: 'hullTier', name: 'Hull', effect: 'Integrity & Resistance' }
  ],

  init() {
    Logger.log('Upgrades UI initialized');
  },

  isSynchronizing() {
    return this.isUpgrading || this.isAwaitingInventorySync || this.isAwaitingFullSync;
  },

  clearUpgradeTimeout() {
    if (this._upgradeTimeoutId) {
      clearTimeout(this._upgradeTimeoutId);
      this._upgradeTimeoutId = null;
    }
  },

  reset({ refresh = true } = {}) {
    this.clearUpgradeTimeout();
    this.isUpgrading = false;
    this.isAwaitingInventorySync = false;
    this.isAwaitingFullSync = false;
    this.pendingComponent = null;
    if (refresh) this.refresh();
  },

  applyAuthoritativeSnapshot({ refresh = true, authoritativeShip = false } = {}) {
    // Inventory/death updates can arrive between a request and its response.
    // They update Player's balances, but must not cancel the request lock or
    // its timeout and thereby allow the same component to be submitted twice.
    if (!this.isUpgrading) {
      if (authoritativeShip) {
        this.isAwaitingFullSync = false;
        this.isAwaitingInventorySync = false;
        this.pendingComponent = null;
      } else if (!this.isAwaitingFullSync) {
        this.isAwaitingInventorySync = false;
      }
    }
    if (refresh) this.refresh();
  },

  onUpgradeSuccess(_data, { awaitingInventory = true } = {}) {
    this.clearUpgradeTimeout();
    this.isUpgrading = false;
    this.isAwaitingFullSync = false;
    this.isAwaitingInventorySync = awaitingInventory;
    this.pendingComponent = null;
    this.refresh();
  },

  onUpgradeError() {
    this.clearUpgradeTimeout();
    this.isUpgrading = false;
    this.isAwaitingInventorySync = true;
    this.isAwaitingFullSync = true;
    this.pendingComponent = null;
    this.refresh();
  },

  updateUpgradeIndicator() {
    if (typeof HUD !== 'undefined' &&
        typeof HUD.updateUpgradeIndicator === 'function') {
      HUD.updateUpgradeIndicator();
    }
  },

  requestAuthoritativeSnapshot() {
    if (typeof Network !== 'undefined' &&
        typeof Network.requestShipData === 'function') {
      Network.requestShipData();
    } else if (typeof Network !== 'undefined' && Network.socket) {
      Network.socket.emit('ship:getData');
    }
  },

  failClosed(message) {
    this.clearUpgradeTimeout();
    this.isUpgrading = false;
    this.isAwaitingInventorySync = true;
    this.isAwaitingFullSync = true;
    this.pendingComponent = null;
    this.refresh();
    this.updateUpgradeIndicator();
    this.requestAuthoritativeSnapshot();
    if (message && typeof NotificationManager !== 'undefined') {
      NotificationManager.error(message);
    }
  },

  requestUpgrade(component) {
    if (this.isSynchronizing()) return false;

    const config = this.COMPONENTS.find(entry => entry.key === component);
    const currentTier = config && Player.ship
      ? (Player.ship[config.tierKey] || 1)
      : 1;
    if (!config || !this.checkAffordability(component, currentTier)) {
      this.refresh();
      this.updateUpgradeIndicator();
      return false;
    }

    this.isUpgrading = true;
    this.isAwaitingInventorySync = false;
    this.isAwaitingFullSync = false;
    this.pendingComponent = component;
    this.refresh();
    this.updateUpgradeIndicator();

    let sent = false;
    try {
      sent = typeof Network !== 'undefined' &&
        typeof Network.sendUpgrade === 'function' &&
        Network.sendUpgrade(component) !== false;
    } catch {
      sent = false;
    }

    if (!sent) {
      this.failClosed('Unable to send upgrade request. Synchronizing ship data...');
      return false;
    }

    this._upgradeTimeoutId = setTimeout(() => {
      if (!this.isUpgrading) return;
      this._upgradeTimeoutId = null;
      this.failClosed('Upgrade request timed out. Synchronizing ship data...');
    }, 5000);
    return true;
  },

  getInventoryMap() {
    const inventory = {};
    if (Array.isArray(Player.inventory)) {
      for (const item of Player.inventory) {
        if (!item || typeof item.resource_type !== 'string') continue;
        inventory[item.resource_type] = Number(item.quantity) || 0;
      }
    } else if (Player.inventory && typeof Player.inventory === 'object') {
      for (const [resource, quantity] of Object.entries(Player.inventory)) {
        inventory[resource] = Number(quantity) || 0;
      }
    }
    return inventory;
  },

  checkAffordability(component, currentTier, inventory = this.getInventoryMap()) {
    if (this.isSynchronizing()) return false;
    if (typeof ShipUpgradePanel !== 'undefined' &&
        (ShipUpgradePanel.isUpgrading ||
         ShipUpgradePanel.isAwaitingInventorySync ||
         ShipUpgradePanel.isAwaitingFullSync)) {
      return false;
    }

    const nextTier = currentTier + 1;
    const requirements = CONSTANTS.UPGRADE_REQUIREMENTS?.[component]?.[nextTier];
    if (!requirements) return false;

    const credits = Number.isFinite(Player.credits) ? Player.credits : 0;
    if (credits < requirements.credits) return false;

    return Object.entries(requirements.resources || {}).every(([resource, needed]) =>
      (inventory[resource] || 0) >= needed
    );
  },

  refresh() {
    if (typeof document === 'undefined') return;
    const list = document.getElementById('upgrades-list');
    if (!list) return;
    const components = this.COMPONENTS;
    const inventory = this.getInventoryMap();

    list.innerHTML = components.map(comp => {
      const currentTier = Player.ship[comp.tierKey] || 1;
      const maxTier = CONSTANTS.MAX_TIER;
      const nextTier = currentTier + 1;
      const requirements = CONSTANTS.UPGRADE_REQUIREMENTS?.[comp.key]?.[nextTier];
      const cost = requirements?.credits || 0;
      const canAfford = this.checkAffordability(comp.key, currentTier, inventory);
      const isMaxed = currentTier >= maxTier;
      const resourceSummary = Object.entries(requirements?.resources || {})
        .map(([resource, needed]) => `${needed} ${resource.replaceAll('_', ' ')}`)
        .join(', ');

      return `
        <div class="upgrade-item" style="padding: 10px; margin-bottom: 10px; background: #000022; border: 1px solid #333; border-radius: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="color: #66aaff; font-weight: bold;">${comp.name}</div>
              <div style="color: #888; font-size: 11px;">Improves: ${comp.effect}</div>
              <div style="color: #aaa; font-size: 12px; margin-top: 4px;">
                Tier: ${'★'.repeat(currentTier)}${'☆'.repeat(maxTier - currentTier)}
              </div>
            </div>
            <div style="text-align: right;">
              ${isMaxed ?
                '<span style="color: #66ff66;">MAX</span>' :
                `<div style="color: #ffcc00; font-size: 12px;">${cost} credits</div>
                 <div style="color: #aaa; font-size: 11px; max-width: 220px;">${resourceSummary || 'Requirements unavailable'}</div>
                 <button class="upgrade-btn" data-component="${comp.key}"
                   style="margin-top: 4px; padding: 5px 10px; background: ${canAfford ? '#3366ff' : '#333'}; border: none; border-radius: 3px; color: #fff; cursor: ${canAfford ? 'pointer' : 'not-allowed'};"
                   ${canAfford ? '' : 'disabled'}>
                   Upgrade
                 </button>`
              }
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Add click handlers
    list.querySelectorAll('.upgrade-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const component = btn.dataset.component;
        const config = components.find(entry => entry.key === component);
        const currentTier = config ? (Player.ship[config.tierKey] || 1) : 1;
        if (!config || !this.checkAffordability(component, currentTier)) {
          this.refresh();
          return;
        }
        this.requestUpgrade(component);
      });
    });
  }
};

// Note: Upgrade event listeners (upgrade:success, upgrade:error) are now
// registered in Network.init() for reliable handling across reconnections
