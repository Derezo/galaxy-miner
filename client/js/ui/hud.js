// Galaxy Miner - HUD UI

const HUD = {
  latency: 0,
  radarCanvas: null,
  radarCtx: null,
  radialMenuOpen: false,
  radialMenuTimeout: null,
  longPressDelay: 500, // ms for long press detection

  init() {
    this.radarCanvas = document.getElementById('radar-canvas');
    this.radarCtx = this.radarCanvas.getContext('2d');

    // Set radar canvas size
    this.radarCanvas.width = 150;
    this.radarCanvas.height = 150;

    // Initialize the modular radar system
    if (typeof Radar !== 'undefined') {
      Radar.init(this.radarCanvas);
    }

    // Terminal icon handlers
    this.initTerminalIcon();

    // Profile image handler
    this.initProfileHandlers();

    // Chat icon handler
    this.initChatIcon();

    // Start latency ping
    setInterval(() => Network.ping(), 5000);

    Logger.log('HUD initialized');
  },

  /**
   * Initialize terminal icon with click and long-press handlers
   */
  initTerminalIcon() {
    const terminalIcon = document.getElementById('terminal-icon');
    const radialMenu = document.getElementById('terminal-radial-menu');

    Logger.log('[HUD] initTerminalIcon: terminalIcon=', terminalIcon, 'radialMenu=', radialMenu);

    if (!terminalIcon || !radialMenu) {
      Logger.warn('[HUD] Terminal icon or radial menu not found!');
      return;
    }

    let pressTimer = null;
    let isLongPress = false;

    // Mouse/touch down - start long press detection
    const handlePressStart = (e) => {
      e.preventDefault();
      isLongPress = false;
      pressTimer = setTimeout(() => {
        isLongPress = true;
        this.showRadialMenu();
      }, this.longPressDelay);
    };

    // Mouse/touch up - handle click or long press end
    const handlePressEnd = (e) => {
      e.preventDefault();
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }

      if (!isLongPress) {
        // Short click - open terminal to cargo tab
        TerminalUI.show();
        TerminalUI.switchTab('cargo');
      }
      // Long press menu stays open until item clicked or clicked outside
    };

    // Cancel on mouse/touch leave
    const handlePressCancel = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };

    // Mouse events
    terminalIcon.addEventListener('mousedown', handlePressStart);
    terminalIcon.addEventListener('mouseup', handlePressEnd);
    terminalIcon.addEventListener('mouseleave', handlePressCancel);

    // Touch events
    terminalIcon.addEventListener('touchstart', handlePressStart, { passive: false });
    terminalIcon.addEventListener('touchend', handlePressEnd, { passive: false });
    terminalIcon.addEventListener('touchcancel', handlePressCancel);

    // Radial menu item handlers - use mouseup/touchend since mousedown happens on terminal icon
    const radialItems = radialMenu.querySelectorAll('.radial-item');
    Logger.log('[HUD] Found', radialItems.length, 'radial menu items');

    const handleRadialSelect = (item, e) => {
      // Only handle if radial menu is open (prevents accidental triggers)
      if (!this.radialMenuOpen) return;

      Logger.log('[HUD] Radial item selected! Tab:', item.dataset.tab);
      e.stopPropagation();
      e.preventDefault();

      const tab = item.dataset.tab;
      this.hideRadialMenu();

      if (typeof TerminalUI !== 'undefined') {
        TerminalUI.show();
        TerminalUI.switchTab(tab);
      } else {
        Logger.error('[HUD] TerminalUI is not defined!');
      }
    };

    radialItems.forEach(item => {
      Logger.log('[HUD] Adding mouseup/touchend handler for tab:', item.dataset.tab);
      // Mouse release selects the item
      item.addEventListener('mouseup', (e) => handleRadialSelect(item, e));
      // Touch release selects the item
      item.addEventListener('touchend', (e) => handleRadialSelect(item, e), { passive: false });
      // Also support regular click for users who click after menu is open
      item.addEventListener('click', (e) => handleRadialSelect(item, e));
    });

    // Click outside to close radial menu
    document.addEventListener('mouseup', (e) => {
      if (this.radialMenuOpen && !radialMenu.contains(e.target) && e.target !== terminalIcon) {
        this.hideRadialMenu();
      }
    });
  },

  /**
   * Show the radial menu
   */
  showRadialMenu() {
    const radialMenu = document.getElementById('terminal-radial-menu');
    if (radialMenu) {
      radialMenu.classList.remove('hidden');
      radialMenu.classList.add('visible');
      this.radialMenuOpen = true;
    }
  },

  /**
   * Hide the radial menu
   */
  hideRadialMenu() {
    const radialMenu = document.getElementById('terminal-radial-menu');
    if (radialMenu) {
      radialMenu.classList.remove('visible');
      radialMenu.classList.add('hidden');
      this.radialMenuOpen = false;
    }
  },

  /**
   * Initialize profile image click handler
   */
  initProfileHandlers() {
    const profileContainer = document.getElementById('profile-image-container');
    if (profileContainer) {
      profileContainer.addEventListener('click', () => {
        // Open profile modal if available
        if (typeof ProfileModal !== 'undefined') {
          ProfileModal.show();
        } else {
          Logger.log('Profile modal not yet implemented');
        }
      });
    }
  },

  /**
   * Initialize chat icon handler
   * Note: ChatUI.init() handles the click event - this method is kept
   * for any HUD-specific chat icon setup (badge updates, etc.)
   */
  initChatIcon() {
    // Click handler is in ChatUI.init() to avoid double-toggle
    // This method can be used for HUD-specific badge/state management
  },

  update() {
    if (!GalaxyMiner.gameStarted) return;

    // Update profile username
    const usernameEl = document.getElementById('profile-username');
    if (usernameEl) {
      usernameEl.textContent = Player.username;
    }

    // Update credits display (animated value is handled by CreditAnimation if available)
    const creditValue = document.getElementById('credit-value');
    if (creditValue && typeof CreditAnimation === 'undefined') {
      // Direct update if no animation module
      creditValue.textContent = Player.credits.toLocaleString();
    }

    // Update sector coords (now in radar)
    const sectorX = Math.floor(Player.position.x / CONSTANTS.SECTOR_SIZE);
    const sectorY = Math.floor(Player.position.y / CONSTANTS.SECTOR_SIZE);
    const sectorEl = document.getElementById('sector-coords');
    if (sectorEl) {
      sectorEl.textContent = `${sectorX}, ${sectorY}`;
    }

    // Update radar
    this.drawRadar();

    // Update upgrade availability indicator
    this.updateUpgradeIndicator();
  },

  /**
   * Check if player can afford any upgrade and update UI indicators
   */
  updateUpgradeIndicator() {
    const terminalIcon = document.getElementById('terminal-icon');
    const upgradesRadialItem = document.querySelector('.radial-item[data-tab="upgrades"]');

    if (!terminalIcon || !Player.ship) return;

    const hasUpgradesAvailable = this.checkUpgradesAvailable();

    if (hasUpgradesAvailable) {
      terminalIcon.classList.add('upgrades-available');
      if (upgradesRadialItem) {
        upgradesRadialItem.classList.add('upgrades-available');
      }
    } else {
      terminalIcon.classList.remove('upgrades-available');
      if (upgradesRadialItem) {
        upgradesRadialItem.classList.remove('upgrades-available');
      }
    }
  },

  /**
   * Check if player can afford at least one upgrade (credits + resources)
   * Uses ShipUpgradePanel.checkAffordability when available for consistency
   * @returns {boolean}
   */
  checkUpgradesAvailable() {
    if (!Player.ship || typeof CONSTANTS === 'undefined') return false;
    if (!CONSTANTS.UPGRADE_REQUIREMENTS) return false;

    const components = ['engine', 'weapon', 'shield', 'mining', 'cargo', 'radar', 'hull', 'energy_core'];
    const tierKeys = {
      engine: 'engineTier',
      weapon: 'weaponTier',
      shield: 'shieldTier',
      mining: 'miningTier',
      cargo: 'cargoTier',
      radar: 'radarTier',
      hull: 'hullTier',
      energy_core: 'energyCoreTier'
    };

    // Use ShipUpgradePanel if available and has data (preferred - shared logic)
    if (typeof ShipUpgradePanel !== 'undefined' && ShipUpgradePanel.shipData) {
      for (const comp of components) {
        const affordability = ShipUpgradePanel.checkAffordability(comp);
        if (affordability.canAfford) {
          return true;
        }
      }
      return false;
    }

    // Fallback: manual check when ShipUpgradePanel not ready
    const maxTier = 5;
    const credits = Player.credits || 0;

    // Convert inventory array to object for easy lookup
    // Player.inventory is array of { resource_type, quantity }
    const inventoryMap = {};
    if (Array.isArray(Player.inventory)) {
      for (const item of Player.inventory) {
        inventoryMap[item.resource_type] = item.quantity;
      }
    } else if (Player.inventory && typeof Player.inventory === 'object') {
      // Already an object (shouldn't happen but handle it)
      Object.assign(inventoryMap, Player.inventory);
    }

    for (const comp of components) {
      const currentTier = Player.ship[tierKeys[comp]] || 1;
      if (currentTier >= maxTier) continue;

      const nextTier = currentTier + 1;
      const requirements = CONSTANTS.UPGRADE_REQUIREMENTS[comp]?.[nextTier];

      if (!requirements) continue;

      // Check credits
      if (credits < requirements.credits) continue;

      // Check resources
      let hasAllResources = true;
      for (const [resource, needed] of Object.entries(requirements.resources || {})) {
        const have = inventoryMap[resource] || 0;
        if (have < needed) {
          hasAllResources = false;
          break;
        }
      }

      if (hasAllResources) {
        return true;
      }
    }

    return false;
  },

  /**
   * Update credits with optional animation
   * @param {number} newCredits - New credit value
   * @param {number} delta - Change amount (positive = gain)
   */
  updateCredits(newCredits, delta = 0) {
    if (typeof CreditAnimation !== 'undefined' && delta > 0) {
      CreditAnimation.addCredits(delta);
    } else {
      const creditValue = document.getElementById('credit-value');
      if (creditValue) {
        creditValue.textContent = newCredits.toLocaleString();
      }
    }
  },

  /**
   * Update profile image
   * @param {string} emoji - The emoji to display
   */
  updateProfileImage(emoji) {
    const profileImage = document.getElementById('profile-image');
    if (profileImage) {
      profileImage.textContent = emoji;
    }
  },

  drawRadar() {
    const ctx = this.radarCtx;
    const radarRange = Player.getRadarRange();
    const radarTier = Player.ship.radarTier || 1;

    // Use the modular radar system if available
    if (typeof Radar !== 'undefined' && Radar.initialized) {
      Radar.draw(ctx, radarRange, radarTier);
      return;
    }

    // Fallback to basic radar rendering if modules not loaded
    const size = 150;
    const center = size / 2;

    // Clear
    ctx.fillStyle = 'rgba(0, 0, 34, 0.8)';
    ctx.beginPath();
    ctx.arc(center, center, center, 0, Math.PI * 2);
    ctx.fill();

    // Draw range circles
    ctx.strokeStyle = '#333366';
    ctx.lineWidth = 1;
    for (let r = 0.25; r <= 1; r += 0.25) {
      ctx.beginPath();
      ctx.arc(center, center, center * r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw crosshairs
    ctx.beginPath();
    ctx.moveTo(center, 0);
    ctx.lineTo(center, size);
    ctx.moveTo(0, center);
    ctx.lineTo(size, center);
    ctx.stroke();

    // Scale factor
    const scale = center / radarRange;

    // Draw world objects (asteroids, planets)
    const objects = World.getVisibleObjects(Player.position, radarRange);

    // Asteroids as small gray dots
    ctx.fillStyle = '#666666';
    for (const asteroid of objects.asteroids) {
      const dx = asteroid.x - Player.position.x;
      const dy = asteroid.y - Player.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radarRange) continue;

      const rx = center + dx * scale;
      const ry = center + dy * scale;
      ctx.beginPath();
      ctx.arc(rx, ry, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Planets as blue dots
    ctx.fillStyle = '#4488ff';
    for (const planet of objects.planets) {
      const dx = planet.x - Player.position.x;
      const dy = planet.y - Player.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radarRange) continue;

      const rx = center + dx * scale;
      const ry = center + dy * scale;
      ctx.beginPath();
      ctx.arc(rx, ry, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw other players as triangles showing heading
    ctx.fillStyle = '#00aaff';
    for (const [id, player] of Entities.players) {
      const dx = player.position.x - Player.position.x;
      const dy = player.position.y - Player.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radarRange) continue;

      const rx = center + dx * scale;
      const ry = center + dy * scale;
      const rotation = player.rotation || 0;

      // Draw triangle pointing in player's direction
      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(rotation);
      ctx.beginPath();
      ctx.moveTo(5, 0);       // nose
      ctx.lineTo(-3.5, -3);   // left tail
      ctx.lineTo(-3.5, 3);    // right tail
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Draw NPCs
    ctx.fillStyle = '#ff4444';
    for (const [id, npc] of Entities.npcs) {
      const dx = npc.position.x - Player.position.x;
      const dy = npc.position.y - Player.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radarRange) continue;

      const rx = center + dx * scale;
      const ry = center + dy * scale;
      ctx.beginPath();
      ctx.arc(rx, ry, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw player at center (triangle pointing in direction)
    ctx.fillStyle = '#00ff00';
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(Player.rotation);
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -4);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  updateLatency(latency) {
    this.latency = latency;
  }
};
