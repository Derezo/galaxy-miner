/**
 * RewardDisplay - Canvas-Rendered Reward Pop-ups
 * Displays animated reward notifications above the player's ship.
 * Part of the notification system overhaul.
 */

const RewardDisplay = {
  // Queue of rewards waiting to display
  pendingQueue: [],

  // Currently animating rewards
  activeRewards: [],

  // Configuration
  DISPLAY_DURATION: 500,   // 0.5s per reward item
  FADE_DURATION: 300,      // Additional fade time
  FLOAT_SPEED: 40,         // Pixels per second upward
  Y_OFFSET: -70,           // Initial offset above player
  ICON_SIZE: 28,           // Icon size in pixels
  SPAWN_INTERVAL: 100,     // Minimum ms between spawning rewards

  // State tracking
  lastSpawnTime: 0,
  _debugLogged: false,  // Prevent log spam

  /**
   * Initialize the reward display system
   */
  init() {
    // Nothing to initialize - uses Renderer's canvas
  },

  /**
   * Queue rewards for display
   * Order: credits, buffs, common, uncommon, rare, ultrarare, components, relics
   * @param {Object} rewards - Reward data
   * @param {number} [rewards.credits] - Credit amount
   * @param {Array} [rewards.resources] - Array of {type, name, quantity}
   * @param {Array} [rewards.relics] - Array of relic types
   * @param {Array} [rewards.components] - Array of component types
   * @param {Array} [rewards.buffs] - Array of {type} objects
   */
  queue(rewards) {
    if (!rewards) return;

    // Build items array then sort by desired order
    const items = [];

    // Credits (sortOrder: 0)
    if (rewards.credits && rewards.credits > 0) {
      items.push({
        type: 'credits',
        value: rewards.credits,
        text: `+${rewards.credits.toLocaleString()}`,
        sortOrder: 0
      });
    }

    // Buffs (sortOrder: 1)
    if (rewards.buffs && Array.isArray(rewards.buffs)) {
      rewards.buffs.forEach(b => {
        const buffType = typeof b === 'string' ? b : b.type;
        if (buffType) {
          const buffNames = {
            SHIELD_BOOST: 'Shield Boost',
            SPEED_BURST: 'Speed Burst',
            DAMAGE_AMP: 'Damage Amp',
            RADAR_PULSE: 'Radar Pulse'
          };
          items.push({
            type: 'buff',
            buffType: buffType,
            text: buffNames[buffType] || buffType,
            sortOrder: 1
          });
        }
      });
    }

    // Resources - sorted by rarity (sortOrder: 2-5)
    const raritySortOrder = {
      'common': 2,
      'uncommon': 3,
      'rare': 4,
      'ultrarare': 5
    };

    if (rewards.resources && Array.isArray(rewards.resources)) {
      rewards.resources.forEach(r => {
        if (r && r.quantity > 0) {
          // Get friendly name: use provided name, lookup from CONSTANTS, or format type
          let resourceName = r.name;
          let rarity = 'common';
          if (typeof CONSTANTS !== 'undefined' && CONSTANTS.RESOURCE_TYPES && CONSTANTS.RESOURCE_TYPES[r.type]) {
            const resourceInfo = CONSTANTS.RESOURCE_TYPES[r.type];
            if (!resourceName) resourceName = resourceInfo.name;
            if (resourceInfo.rarity) rarity = resourceInfo.rarity;
          }
          if (!resourceName) {
            // Convert "DARK_MATTER" to "Dark Matter"
            resourceName = this._formatTypeName(r.type);
          }
          items.push({
            type: 'resource',
            resourceType: r.type,
            value: r.quantity,
            text: `+${r.quantity} ${resourceName}`,
            sortOrder: raritySortOrder[rarity] || 2
          });
        }
      });
    }

    // Components (sortOrder: 6)
    if (rewards.components && Array.isArray(rewards.components)) {
      rewards.components.forEach(c => {
        const componentType = typeof c === 'string' ? c : c.type;
        if (componentType) {
          items.push({
            type: 'component',
            componentType: componentType,
            text: componentType.replace(/_/g, ' '),
            sortOrder: 6
          });
        }
      });
    }

    // Relics (sortOrder: 7)
    if (rewards.relics && Array.isArray(rewards.relics)) {
      rewards.relics.forEach(r => {
        const relicType = typeof r === 'string' ? r : r.type;
        if (relicType) {
          // Get friendly name from CONSTANTS if available
          let relicName = relicType;
          if (typeof CONSTANTS !== 'undefined' && CONSTANTS.RELIC_TYPES && CONSTANTS.RELIC_TYPES[relicType]) {
            relicName = CONSTANTS.RELIC_TYPES[relicType].name || relicType;
          }
          items.push({
            type: 'relic',
            relicType: relicType,
            text: relicName,
            sortOrder: 7
          });
        }
      });
    }

    // Sort by sortOrder and add to queue
    items.sort((a, b) => a.sortOrder - b.sortOrder);
    items.forEach(item => {
      delete item.sortOrder; // Remove helper property before queueing
      this.pendingQueue.push(item);
    });
  },

  /**
   * Update the reward display (call each frame)
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    const now = Date.now();
    const dtMs = dt * 1000;

    // Guard against bad dt values that could corrupt reward state
    const dtValid = Number.isFinite(dtMs) && dtMs >= 0 && dtMs <= 1000;
    if (!dtValid) {
      // Log bad dt values (once to avoid spam)
      if (!this._debugLogged && (this.activeRewards.length > 0 || this.pendingQueue.length > 0)) {
        Logger.category('ui', 'RewardDisplay: Invalid dt detected:', dt, 'dtMs:', dtMs,
          '| activeRewards:', this.activeRewards.length,
          '| pendingQueue:', this.pendingQueue.length);
        this._debugLogged = true;
      }
    }

    // Update active rewards (only if dt is valid to prevent corruption)
    if (dtValid) {
      this.activeRewards = this.activeRewards.filter(reward => {
        reward.elapsed += dtMs;
        reward.y -= this.FLOAT_SPEED * dt;

        // Calculate alpha based on elapsed time
        const totalDuration = this.DISPLAY_DURATION + this.FADE_DURATION;
        if (reward.elapsed > this.DISPLAY_DURATION) {
          reward.alpha = 1 - ((reward.elapsed - this.DISPLAY_DURATION) / this.FADE_DURATION);
        }

        // Keep if not fully faded
        return reward.elapsed < totalDuration && reward.alpha > 0;
      });
    }

    // Spawn next reward from queue if ready
    if (this.pendingQueue.length > 0 &&
        this.activeRewards.length === 0 &&
        now - this.lastSpawnTime >= this.SPAWN_INTERVAL) {
      const reward = this.pendingQueue.shift();
      this.activeRewards.push({
        ...reward,
        elapsed: 0,
        y: 0,
        alpha: 1
      });
      this.lastSpawnTime = now;

      // Play sound when reward is displayed
      this._playRewardSound(reward);
    }
  },

  /**
   * Play the appropriate sound for a reward type
   * @param {Object} reward - The reward being displayed
   */
  _playRewardSound(reward) {
    if (typeof AudioManager === 'undefined') return;

    let soundId = null;

    switch (reward.type) {
      case 'credits':
        // Large credits sound for amounts > 500
        soundId = (reward.value > 500) ? 'reward_credits_large' : 'reward_credits';
        break;

      case 'resource':
        // Use reward_* sounds based on resource rarity
        if (typeof CONSTANTS !== 'undefined' && CONSTANTS.RESOURCE_TYPES && reward.resourceType) {
          const resourceInfo = CONSTANTS.RESOURCE_TYPES[reward.resourceType];
          if (resourceInfo && resourceInfo.rarity) {
            const raritySounds = {
              'common': 'reward_common',
              'uncommon': 'reward_uncommon',
              'rare': 'reward_rare',
              'ultrarare': 'reward_ultrarare'
            };
            soundId = raritySounds[resourceInfo.rarity] || 'reward_common';
          }
        }
        if (!soundId) soundId = 'reward_common';
        break;

      case 'relic':
        // Relic-specific sounds
        const relicSounds = {
          'ANCIENT_STAR_MAP': 'reward_relic_starmap',
          'VOID_CRYSTAL': 'reward_relic_void',
          'SWARM_HIVE_CORE': 'reward_relic_swarm',
          'PIRATE_TREASURE': 'reward_relic_pirate',
          'WORMHOLE_GEM': 'reward_relic_wormhole'
        };
        soundId = relicSounds[reward.relicType] || 'reward_relic_starmap';
        break;

      case 'component':
        soundId = 'reward_component';
        break;

      case 'buff':
        // Buff-specific sounds
        const buffSounds = {
          'SHIELD_BOOST': 'reward_buff_shield',
          'SPEED_BURST': 'reward_buff_speed',
          'DAMAGE_AMP': 'reward_buff_damage',
          'RADAR_PULSE': 'reward_buff_radar'
        };
        soundId = buffSounds[reward.buffType] || 'reward_buff_shield';
        break;
    }

    if (soundId) {
      AudioManager.play(soundId);
    }
  },

  /**
   * Draw the reward display (call in render loop)
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} camera - Camera position {x, y}
   */
  draw(ctx, camera) {
    // Skip if player doesn't exist
    if (typeof Player === 'undefined' || !Player.position) {
      return;
    }

    // Skip if player is dead AND death effect is still active (cinematic playing)
    // But allow rendering if isDead is stuck true (death effect completed but isDead not reset)
    const deathEffectActive = typeof PlayerDeathEffect !== 'undefined' && PlayerDeathEffect.isActive();
    if (Player.isDead && deathEffectActive) {
      return;
    }

    // Debug: Warn if isDead is stuck (death effect done but isDead still true)
    if (Player.isDead && !deathEffectActive && !this._debugLogged) {
      Logger.category('ui', 'RewardDisplay: Player.isDead=true but death effect not active - possible stuck state');
      this._debugLogged = true;
    }

    // Skip if no active rewards
    if (this.activeRewards.length === 0) {
      // Debug: Log if queue has items but activeRewards is empty
      if (this.pendingQueue.length > 0 && !this._debugLogged) {
        Logger.category('ui', 'RewardDisplay: draw() has empty activeRewards but queue has items:',
          this.pendingQueue.length, '| Check if update() is being called');
        this._debugLogged = true;
      }
      return;
    }

    // Reset debug flag when successfully drawing
    this._debugLogged = false;

    // Calculate player screen position
    const playerScreenX = Player.position.x - camera.x;
    const playerScreenY = Player.position.y - camera.y;

    // Draw each active reward
    this.activeRewards.forEach(reward => {
      this._drawReward(ctx, playerScreenX, playerScreenY + this.Y_OFFSET + reward.y, reward);
    });
  },

  /**
   * Draw a single reward
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x - Screen X position
   * @param {number} y - Screen Y position
   * @param {Object} reward - Reward data
   */
  _drawReward(ctx, x, y, reward) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, reward.alpha));

    // Get icon
    const icon = this._getIcon(reward);
    const iconSize = this.ICON_SIZE;
    const text = reward.text;
    const color = this._getColor(reward);

    // Set up text style to measure
    ctx.font = 'bold 14px monospace';
    const textWidth = ctx.measureText(text).width;

    // Calculate total width for centering: icon + gap + text
    const gap = 6;
    const totalWidth = iconSize + gap + textWidth;
    const startX = x - totalWidth / 2;

    // Draw icon on the left
    if (icon && icon.complete && icon.naturalWidth > 0) {
      ctx.drawImage(icon, startX, y - iconSize / 2, iconSize, iconSize);
    } else {
      // Draw placeholder circle while icon loads
      ctx.beginPath();
      ctx.arc(startX + iconSize / 2, y, iconSize / 2 - 2, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    // Draw text to the right of icon on the same line
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // Draw text shadow for readability
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    ctx.fillText(text, startX + iconSize + gap, y);

    ctx.restore();
  },

  /**
   * Get the icon for a reward type
   * @param {Object} reward
   * @returns {HTMLImageElement|null}
   */
  _getIcon(reward) {
    if (typeof IconCache === 'undefined') return null;

    switch (reward.type) {
      case 'credits':
        return IconCache.getCreditIcon();

      case 'resource':
        return IconCache.getResourceIcon(reward.resourceType, this.ICON_SIZE);

      case 'relic':
        return IconCache.getRelicIcon(reward.relicType, this.ICON_SIZE);

      case 'component':
        return IconCache.getComponentIcon();

      case 'buff':
        return IconCache.getBuffIcon();

      default:
        return null;
    }
  },

  /**
   * Get the color for a reward type
   * @param {Object} reward
   * @returns {string} CSS color
   */
  _getColor(reward) {
    // For resources, use rarity-based colors
    if (reward.type === 'resource' && reward.resourceType) {
      const rarityColors = {
        common: '#888888',
        uncommon: '#00cc00',
        rare: '#4488ff',
        ultrarare: '#aa44ff'
      };
      // Look up resource rarity from CONSTANTS
      if (typeof CONSTANTS !== 'undefined' && CONSTANTS.RESOURCE_TYPES && CONSTANTS.RESOURCE_TYPES[reward.resourceType]) {
        const rarity = CONSTANTS.RESOURCE_TYPES[reward.resourceType].rarity;
        if (rarity && rarityColors[rarity]) {
          return rarityColors[rarity];
        }
      }
    }

    // Default colors for other types
    const colors = {
      credits: '#ffcc00',     // Gold
      resource: '#00ff88',    // Green (fallback)
      relic: '#ff44ff',       // Magenta
      component: '#4488ff',   // Blue
      buff: '#00ffff'         // Cyan
    };
    return colors[reward.type] || '#ffffff';
  },

  /**
   * Clear all pending and active rewards
   */
  clear() {
    this.pendingQueue = [];
    this.activeRewards = [];
  },

  /**
   * Check if there are pending or active rewards
   * @returns {boolean}
   */
  hasRewards() {
    return this.pendingQueue.length > 0 || this.activeRewards.length > 0;
  },

  /**
   * Format a type name for display (e.g., "DARK_MATTER" -> "Dark Matter")
   * @param {string} type - The raw type name
   * @returns {string} Formatted name
   */
  _formatTypeName(type) {
    if (!type) return '';
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.RewardDisplay = RewardDisplay;
}
