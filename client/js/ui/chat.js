// Galaxy Miner - Chat UI (Integrated into HUD)

const ChatUI = {
  visible: false,
  messages: [],
  lastMessageTime: 0,
  unreadCount: 0,
  autoHideTimeout: null,

  init() {
    // Chat icon click handler (now in bottom-left)
    const chatIcon = document.getElementById('chat-icon');
    if (chatIcon) {
      chatIcon.addEventListener('click', () => this.toggle());
    }

    // Chat input and send handlers
    document.getElementById('chat-send').addEventListener('click', () => this.sendMessage());
    document.getElementById('chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.sendMessage();
        e.preventDefault();
      } else if (e.key === 'Escape') {
        this.hide();
        e.preventDefault();
      }
    });

    // Auto-hide when clicking outside
    document.addEventListener('click', (e) => {
      const overlay = document.getElementById('chat-overlay');
      const icon = document.getElementById('chat-icon');
      if (this.visible && !overlay.contains(e.target) && (!icon || !icon.contains(e.target))) {
        this.hide();
      }
    });

    Logger.log('Chat UI initialized');
  },

  // Expose toggleOverlay for HUD to call
  toggleOverlay() {
    this.toggle();
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
    this.unreadCount = 0;
    this.updateUnreadBadge();
    document.getElementById('chat-overlay').classList.remove('hidden');
    document.getElementById('chat-input').focus();
    this.scrollToBottom();
    this.clearAutoHide();
  },

  hide() {
    this.visible = false;
    document.getElementById('chat-overlay').classList.add('hidden');
    this.clearAutoHide();
  },

  clearAutoHide() {
    if (this.autoHideTimeout) {
      clearTimeout(this.autoHideTimeout);
      this.autoHideTimeout = null;
    }
  },

  scheduleAutoHide() {
    this.clearAutoHide();
    this.autoHideTimeout = setTimeout(() => {
      if (this.visible && document.getElementById('chat-input').value === '') {
        this.hide();
      }
    }, 5000);
  },

  updateUnreadBadge() {
    const badge = document.getElementById('chat-unread-badge');
    if (this.unreadCount > 0) {
      badge.textContent = this.unreadCount > 9 ? '9+' : this.unreadCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  },

  sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();

    if (!message) return;

    // Check for local debug commands
    if (message.startsWith('/debug')) {
      this.handleDebugCommand(message);
      input.value = '';
      return;
    }

    // Rate limiting
    const now = Date.now();
    if (now - this.lastMessageTime < CONSTANTS.CHAT_RATE_LIMIT) {
      return;
    }

    this.lastMessageTime = now;
    Network.sendChat(message);
    input.value = '';
  },

  // Handle /debug commands locally
  handleDebugCommand(command) {
    const parts = command.split(' ');
    const subCommand = parts[1] || 'help';

    switch (subCommand) {
      case 'enable':
        if (typeof debugSync !== 'undefined') {
          debugSync.enable();
          // Also save to localStorage for persistence
          localStorage.setItem('DEBUG_SYNC', 'true');
          this.addLocalMessage('Debug sync logging ENABLED');
        } else {
          this.addLocalMessage('Error: debugSync module not loaded');
        }
        break;

      case 'disable':
        if (typeof debugSync !== 'undefined') {
          debugSync.disable();
          localStorage.removeItem('DEBUG_SYNC');
          this.addLocalMessage('Debug sync logging DISABLED');
        }
        break;

      case 'sync':
        this.showSyncStatus();
        break;

      case 'sector':
        this.showSectorInfo();
        break;

      case 'radar':
        this.showRadarInfo();
        break;

      case 'stats':
        if (typeof debugSync !== 'undefined') {
          const stats = debugSync.getStats();
          this.addLocalMessage(`Desync Stats: ${stats.total} total events`);
          for (const [type, count] of Object.entries(stats.byType)) {
            this.addLocalMessage(`  ${type}: ${count}`);
          }
        }
        break;

      case 'clear':
        if (typeof debugSync !== 'undefined') {
          debugSync.clearRecent();
          this.addLocalMessage('Cleared recent desync log');
        }
        break;

      case 'help':
      default:
        this.addLocalMessage('Debug Commands:');
        this.addLocalMessage('  /debug enable   - Enable desync logging');
        this.addLocalMessage('  /debug disable  - Disable desync logging');
        this.addLocalMessage('  /debug sync     - Show entity sync status');
        this.addLocalMessage('  /debug sector   - Show current sector info');
        this.addLocalMessage('  /debug radar    - Show radar range info');
        this.addLocalMessage('  /debug stats    - Show desync statistics');
        this.addLocalMessage('  /debug clear    - Clear desync log');
        break;
    }
  },

  // Add a local system message (not sent to server)
  addLocalMessage(text) {
    this.addMessage({
      username: '[SYSTEM]',
      message: text
    });
  },

  // Show entity synchronization status
  showSyncStatus() {
    const now = Date.now();
    this.addLocalMessage('=== Entity Sync Status ===');

    // NPCs
    let staleNpcs = 0;
    let totalNpcs = Entities.npcs.size;
    for (const [id, npc] of Entities.npcs) {
      if (npc.lastUpdateTime && now - npc.lastUpdateTime > 2000) {
        staleNpcs++;
      }
    }
    this.addLocalMessage(`NPCs: ${totalNpcs} total, ${staleNpcs} stale`);

    // Players
    let stalePlayers = 0;
    let totalPlayers = Entities.players.size;
    for (const [id, player] of Entities.players) {
      if (player.lastUpdateTime && now - player.lastUpdateTime > 2000) {
        stalePlayers++;
      }
    }
    this.addLocalMessage(`Players: ${totalPlayers} total, ${stalePlayers} stale`);

    // Bases
    this.addLocalMessage(`Bases: ${Entities.bases.size} tracked`);

    // Wreckage
    this.addLocalMessage(`Wreckage: ${Entities.wreckage.size} active`);

    // Debug status
    const debugEnabled = typeof debugSync !== 'undefined' && debugSync.isEnabled();
    this.addLocalMessage(`Debug logging: ${debugEnabled ? 'ENABLED' : 'disabled'}`);
  },

  // Show current sector information
  showSectorInfo() {
    if (typeof Player === 'undefined' || !Player.position) {
      this.addLocalMessage('Player position not available');
      return;
    }

    const sectorSize = CONSTANTS.SECTOR_SIZE || 1000;
    const sectorX = Math.floor(Player.position.x / sectorSize);
    const sectorY = Math.floor(Player.position.y / sectorSize);

    this.addLocalMessage('=== Sector Info ===');
    this.addLocalMessage(`Position: (${Math.round(Player.position.x)}, ${Math.round(Player.position.y)})`);
    this.addLocalMessage(`Sector: (${sectorX}, ${sectorY})`);

    // Get sector data if World is available
    if (typeof World !== 'undefined' && World.getCurrentSector) {
      const sector = World.getCurrentSector();
      if (sector) {
        this.addLocalMessage(`Asteroids: ${sector.asteroids?.length || 0}`);
        this.addLocalMessage(`Planets: ${sector.planets?.length || 0}`);
      }
    }
  },

  // Show radar range information
  showRadarInfo() {
    if (typeof Player === 'undefined') {
      this.addLocalMessage('Player not available');
      return;
    }

    const radarTier = Player.radarTier || 1;
    const baseRange = CONSTANTS.BASE_RADAR_RANGE || 500;
    const tierMult = CONSTANTS.TIER_MULTIPLIER || 1.5;
    const radarRange = baseRange * Math.pow(tierMult, radarTier - 1);
    const broadcastRange = radarRange * 2;

    this.addLocalMessage('=== Radar Info ===');
    this.addLocalMessage(`Radar Tier: ${radarTier}`);
    this.addLocalMessage(`Radar Range: ${Math.round(radarRange)} units`);
    this.addLocalMessage(`Broadcast Range: ${Math.round(broadcastRange)} units`);

    // Count entities in range
    if (typeof Player.position !== 'undefined') {
      const npcsInRange = Entities.getNPCsInRange(Player.position, radarRange);
      const playersInRange = Entities.getPlayersInRange(Player.position, radarRange);
      this.addLocalMessage(`NPCs in range: ${npcsInRange.length}`);
      this.addLocalMessage(`Players in range: ${playersInRange.length}`);
    }
  },

  addMessage(data) {
    this.messages.push(data);

    // Keep only last N messages
    if (this.messages.length > CONSTANTS.CHAT_HISTORY_SIZE) {
      this.messages.shift();
    }

    // Increment unread if chat is not visible
    if (!this.visible) {
      this.unreadCount++;
      this.updateUnreadBadge();
    }

    this.renderMessages();
  },

  renderMessages() {
    const container = document.getElementById('chat-messages');

    // Add new message
    const div = document.createElement('div');
    div.className = 'chat-message';

    const latestMsg = this.messages[this.messages.length - 1];
    div.innerHTML = `
      <span class="sender">${this.escapeHtml(latestMsg.username)}:</span>
      <span class="text">${this.escapeHtml(latestMsg.message)}</span>
    `;

    container.appendChild(div);
    this.scrollToBottom();
  },

  scrollToBottom() {
    const container = document.getElementById('chat-messages');
    container.scrollTop = container.scrollHeight;
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};
