/**
 * NotificationManager - Central Notification Orchestrator
 * Routes notifications to MessageStack or RewardDisplay based on type.
 * Part of the notification system overhaul.
 */

const NotificationManager = {
  initialized: false,

  /**
   * Initialize the notification system
   * Must be called after MessageStack, IconCache, and RewardDisplay are available
   */
  init() {
    if (this.initialized) return;

    // Initialize subsystems
    if (typeof MessageStack !== 'undefined') {
      MessageStack.init();
    }

    if (typeof IconCache !== 'undefined') {
      IconCache.init();
    }

    if (typeof RewardDisplay !== 'undefined') {
      RewardDisplay.init();
    }

    this.initialized = true;
  },

  /**
   * Show an info/error/warning/success message (top-left stack)
   * @param {string} message - Message to display
   * @param {string} type - 'error', 'warning', 'success', 'info'
   * @param {number} [duration] - Optional duration in ms
   * @returns {number|null} Message ID or null if MessageStack unavailable
   */
  showMessage(message, type = 'info', duration) {
    // Play notification sound based on type
    if (typeof AudioManager !== 'undefined') {
      const soundMap = {
        'error': 'notification_error',
        'warning': 'notification_warning',
        'success': 'notification_success',
        'info': 'notification_info'
      };
      const soundId = soundMap[type] || 'notification_info';
      AudioManager.play(soundId);
    }

    if (typeof MessageStack !== 'undefined') {
      return MessageStack.show(message, type, duration);
    }
    // Fallback to console
    Logger.log(`[${type.toUpperCase()}] ${message}`);
    return null;
  },

  /**
   * Show an error message
   * @param {string} message
   * @param {number} [duration]
   * @returns {number|null} Message ID
   */
  error(message, duration) {
    return this.showMessage(message, 'error', duration);
  },

  /**
   * Show a warning message
   * @param {string} message
   * @param {number} [duration]
   * @returns {number|null} Message ID
   */
  warning(message, duration) {
    return this.showMessage(message, 'warning', duration);
  },

  /**
   * Show a success message
   * @param {string} message
   * @param {number} [duration]
   * @returns {number|null} Message ID
   */
  success(message, duration) {
    return this.showMessage(message, 'success', duration);
  },

  /**
   * Show an info message
   * @param {string} message
   * @param {number} [duration]
   * @returns {number|null} Message ID
   */
  info(message, duration) {
    return this.showMessage(message, 'info', duration);
  },

  /**
   * Queue rewards for display (above player ship)
   * @param {Object} rewards - Reward data
   * @param {number} [rewards.credits] - Credit amount
   * @param {Array} [rewards.resources] - Array of {type, name, quantity}
   * @param {Array} [rewards.relics] - Array of relic types or {type} objects
   * @param {Array} [rewards.components] - Array of component types
   * @param {Array} [rewards.buffs] - Array of {type} objects
   */
  queueReward(rewards) {
    if (!rewards) return;

    // Sounds are played in RewardDisplay.update() when each reward is actually displayed
    if (typeof RewardDisplay !== 'undefined') {
      RewardDisplay.queue(rewards);
    } else {
      // Fallback: show as messages
      if (rewards.credits && rewards.credits > 0) {
        this.success(`+${rewards.credits.toLocaleString()} credits`);
      }
      if (rewards.resources && Array.isArray(rewards.resources)) {
        rewards.resources.forEach(r => {
          if (r && r.quantity > 0) {
            this.success(`+${r.quantity} ${r.name || r.type}`);
          }
        });
      }
      if (rewards.relics && Array.isArray(rewards.relics)) {
        rewards.relics.forEach(r => {
          const relicType = typeof r === 'string' ? r : r.type;
          if (relicType) {
            this.success(`Relic acquired: ${relicType}`);
          }
        });
      }
      if (rewards.components && Array.isArray(rewards.components)) {
        rewards.components.forEach(c => {
          const componentType = typeof c === 'string' ? c : c.type;
          if (componentType) {
            this.success(`Component acquired: ${componentType}`);
          }
        });
      }
      if (rewards.buffs && Array.isArray(rewards.buffs)) {
        rewards.buffs.forEach(b => {
          const buffType = typeof b === 'string' ? b : b.type;
          if (buffType) {
            this.success(`Buff activated: ${buffType}`);
          }
        });
      }
    }
  },

  /**
   * Dismiss a specific message by ID
   * @param {number} id - Message ID
   */
  dismissMessage(id) {
    if (typeof MessageStack !== 'undefined') {
      MessageStack.dismiss(id);
    }
  },

  /**
   * Clear all messages
   */
  clearMessages() {
    if (typeof MessageStack !== 'undefined') {
      MessageStack.clear();
    }
  },

  /**
   * Clear all pending/active rewards
   */
  clearRewards() {
    if (typeof RewardDisplay !== 'undefined') {
      RewardDisplay.clear();
    }
  },

  /**
   * Clear all notifications (messages and rewards)
   */
  clearAll() {
    this.clearMessages();
    this.clearRewards();
  },

  /**
   * Check if there are active rewards being displayed
   * @returns {boolean}
   */
  hasActiveRewards() {
    if (typeof RewardDisplay !== 'undefined') {
      return RewardDisplay.hasRewards();
    }
    return false;
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.NotificationManager = NotificationManager;
}
