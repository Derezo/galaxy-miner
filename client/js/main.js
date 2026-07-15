// Galaxy Miner - Main Entry Point

const GalaxyMiner = {
  initialized: false,
  gameStarted: false,
  connectionPaused: false,
  _fullscreenPending: false,

  init() {
    if (this.initialized) return;
    this.initialized = true;

    Logger.log('Galaxy Miner initializing...');

    // Initialize device detection first (needed for mobile-aware initialization)
    if (typeof DeviceDetect !== 'undefined') {
      DeviceDetect.init();
    }

    // Initialize core modules
    Network.init();
    Input.init();
    Renderer.init();
    AuthUI.init();
    HUD.init();
    ChatUI.init();
    UpgradesUI.init();
    TerminalUI.init();
    Toast.init();
    NotificationManager.init();
    EmoteWheel.init();
    AudioManager.init();
    if (typeof MusicManager !== 'undefined') MusicManager.init();

    // Load saved control preferences before creating mobile controls.
    if (typeof MobileSettingsPanel !== 'undefined' &&
        typeof DeviceDetect !== 'undefined' && DeviceDetect.isMobile) {
      MobileSettingsPanel.init();
    }

    // Initialize mobile modules (only activate on mobile devices)
    if (typeof VirtualJoystick !== 'undefined') {
      VirtualJoystick.init();
    }
    if (typeof AutoFire !== 'undefined') {
      AutoFire.init();
    }
    if (typeof MobileHUD !== 'undefined') {
      MobileHUD.init();
    }
    if (typeof MobileGestures !== 'undefined' && typeof DeviceDetect !== 'undefined' && DeviceDetect.isMobile) {
      MobileGestures.init();
    }

    Logger.log('Galaxy Miner ready');
  },

  startGame(playerData) {
    const reconnecting = this.gameStarted || this.connectionPaused;
    const preserveLifeState = reconnecting && Player.id === playerData.id;
    this.gameStarted = true;
    this.connectionPaused = false;

    Logger.log(reconnecting ? 'Resynchronizing game for player:' : 'Starting game for player:', playerData.username);

    // Authentication snapshots are authoritative on both initial login and
    // reconnect. Clear predicted/stale state before resuming simulation.
    Player.init(playerData, { preserveLifeState });
    World.init(CONSTANTS.GALAXY_SEED, Player.position);
    Entities.init();
    if (typeof Input !== 'undefined' && typeof Input.reset === 'function') Input.reset();

    // Sync credit animation with loaded player credits
    if (typeof CreditAnimation !== 'undefined') {
      CreditAnimation.setCredits(Player.credits);
    }

    // Hide auth, show HUD
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');

    // Request fullscreen on the initial mobile login only.
    if (!reconnecting && typeof DeviceDetect !== 'undefined' && DeviceDetect.isMobile) {
      this.requestFullscreen();
    }

    if (reconnecting) Game.resume();
    else Game.start();

    if (!reconnecting && typeof MusicManager !== 'undefined') MusicManager.start();
    if (reconnecting && typeof NotificationManager !== 'undefined') {
      NotificationManager.success('Connection restored');
    }
  },

  handleDisconnect() {
    if (!this.gameStarted || this.connectionPaused) return;
    this.connectionPaused = true;
    Game.pause();
    if (typeof Input !== 'undefined' && typeof Input.reset === 'function') Input.reset();
    if (typeof MobileHUD !== 'undefined') MobileHUD.stopFiring();
    if (typeof VirtualJoystick !== 'undefined') VirtualJoystick.reset();
    if (typeof AutoFire !== 'undefined') AutoFire.currentTarget = null;
    if (typeof AudioManager !== 'undefined' && typeof AudioManager.stopAllLoops === 'function') {
      AudioManager.stopAllLoops();
    }
    if (typeof NotificationManager !== 'undefined') {
      NotificationManager.warning('Connection lost — reconnecting…');
    }
  },

  /**
   * Request fullscreen mode on mobile devices
   * Falls back to pending state if blocked (requires user gesture)
   */
  requestFullscreen() {
    const elem = document.documentElement;
    const request = elem.requestFullscreen || elem.webkitRequestFullscreen || elem.mozRequestFullScreen;
    if (request) {
      request.call(elem).catch(() => {
        // Blocked by browser - will try on first touch
        this._fullscreenPending = true;
        Logger.log('Fullscreen blocked, will try on user gesture');
      });
    }
  },

  /**
   * Try to enter fullscreen if pending (called from touch handler)
   */
  tryPendingFullscreen() {
    if (this._fullscreenPending && this.gameStarted) {
      this._fullscreenPending = false;
      this.requestFullscreen();
    }
  },

  stopGame() {
    this.gameStarted = false;
    this.connectionPaused = false;
    Game.stop();
    if (typeof Input !== 'undefined' && typeof Input.reset === 'function') Input.reset();
    if (typeof AutoFire !== 'undefined') AutoFire.currentTarget = null;
    // The terminal is outside #hud. Close it explicitly so forced auth
    // termination cannot leave the panel or upgrade-preview rAF over login.
    if (typeof TerminalUI !== 'undefined' && typeof TerminalUI.hide === 'function') {
      TerminalUI.hide({ silent: true });
    } else if (typeof ShipUpgradePanel !== 'undefined' &&
               typeof ShipUpgradePanel.setVisible === 'function') {
      ShipUpgradePanel.setVisible(false);
    }
    if (typeof AudioManager !== 'undefined') AudioManager.stopAllLoops();
    if (typeof MusicManager !== 'undefined') MusicManager.stop();

    // Show auth, hide HUD
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('hud').classList.add('hidden');
  }
};

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  GalaxyMiner.init();
});
