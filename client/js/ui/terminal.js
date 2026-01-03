// Galaxy Miner - Terminal UI (Combined Inventory, Upgrades, Marketplace)

const TerminalUI = {
  visible: false,
  currentTab: 'cargo',

  init() {
    const panel = document.getElementById('terminal-panel');
    panel.querySelector('.close-btn').addEventListener('click', () => this.hide());

    // Tab handlers
    const tabs = panel.querySelectorAll('.terminal-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.switchTab(tab.dataset.tab);
      });
    });

    // Initialize Modal system
    if (typeof Modal !== 'undefined') {
      Modal.init();
    }

    // Initialize new panels
    if (typeof CargoPanel !== 'undefined') {
      CargoPanel.init();
    }

    if (typeof MarketPanel !== 'undefined') {
      MarketPanel.init();
    }

    if (typeof ShipCustomizationPanel !== 'undefined') {
      ShipCustomizationPanel.init();
    }

    // Initialize new ShipUpgradePanel
    if (typeof ShipUpgradePanel !== 'undefined') {
      const upgradesContainer = document.getElementById('upgrades-content');
      if (upgradesContainer) {
        ShipUpgradePanel.init(upgradesContainer);
      }
    }

    // Initialize RelicsPanel
    if (typeof RelicsPanel !== 'undefined') {
      RelicsPanel.init();
    }

    // Initialize FleetPanel
    if (typeof FleetPanel !== 'undefined') {
      FleetPanel.init();
    }

    // SettingsPanel is now initialized by ProfileModal, not Terminal

    Logger.log('Terminal UI initialized');
  },

  toggle() {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  },

  show() {
    this.visible = true;
    document.getElementById('terminal-panel').classList.remove('hidden');

    // Play panel open sound
    if (typeof AudioManager !== 'undefined') {
      AudioManager.play('ui_open_panel');
    }

    // Sync current inventory to UIState
    if (typeof UIState !== 'undefined' && typeof Player !== 'undefined') {
      UIState.set({
        inventory: Player.inventory || [],
        credits: Player.credits || 0
      });
    }

    this.refreshCurrentTab();
  },

  hide() {
    this.visible = false;
    document.getElementById('terminal-panel').classList.add('hidden');

    // Play panel close sound
    if (typeof AudioManager !== 'undefined') {
      AudioManager.play('ui_close_panel');
    }

    // Clear selection when closing
    if (typeof CargoPanel !== 'undefined') {
      CargoPanel.clearSelection();
    }
  },

  switchTab(tab) {
    // Play tab switch sound
    if (typeof AudioManager !== 'undefined') {
      AudioManager.play('ui_click');
    }

    this.currentTab = tab;

    // Update tab buttons
    document.querySelectorAll('.terminal-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });

    // Update content visibility
    document.querySelectorAll('.terminal-content').forEach(content => {
      content.classList.remove('active');
    });

    switch (tab) {
      case 'cargo':
        document.getElementById('cargo-content').classList.add('active');
        break;
      case 'upgrades':
        document.getElementById('upgrades-content').classList.add('active');
        break;
      case 'market':
        document.getElementById('market-content').classList.add('active');
        break;
      case 'customize':
        document.getElementById('customize-content').classList.add('active');
        break;
      case 'relics':
        document.getElementById('relics-content').classList.add('active');
        break;
      // Settings tab removed - now in Profile Modal
    }

    this.refreshCurrentTab();
  },

  refreshCurrentTab() {
    if (!this.visible) return;

    // Sync state before refresh
    if (typeof UIState !== 'undefined' && typeof Player !== 'undefined') {
      UIState.set({
        inventory: Player.inventory || [],
        credits: Player.credits || 0
      }, undefined, true); // Silent update to avoid loops
    }

    switch (this.currentTab) {
      case 'cargo':
        if (typeof CargoPanel !== 'undefined') {
          CargoPanel.refresh();
        }
        break;
      case 'upgrades':
        // Use new ShipUpgradePanel if available, fallback to old UpgradesUI
        if (typeof ShipUpgradePanel !== 'undefined') {
          ShipUpgradePanel.updateData({
            ship: Player.ship,
            inventory: Player.inventory || [],
            credits: Player.credits || 0
          });
        } else if (typeof UpgradesUI !== 'undefined') {
          UpgradesUI.refresh();
        }
        break;
      case 'market':
        if (typeof MarketPanel !== 'undefined') {
          MarketPanel.refresh();
        }
        break;
      case 'customize':
        if (typeof ShipCustomizationPanel !== 'undefined') {
          ShipCustomizationPanel.render();
        }
        break;
      case 'relics':
        if (typeof RelicsPanel !== 'undefined') {
          RelicsPanel.refresh();
        }
        break;
      case 'fleet':
        if (typeof FleetPanel !== 'undefined') {
          FleetPanel.refresh();
        }
        break;
      // Settings tab removed - now in Profile Modal
    }
  },

  refresh() {
    this.refreshCurrentTab();
  }
};
