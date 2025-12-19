// Galaxy Miner - Main Entry Point

const GalaxyMiner = {
  initialized: false,
  gameStarted: false,
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
    InventoryUI.init();
    MarketplaceUI.init();
    ChatUI.init();
    UpgradesUI.init();
    TerminalUI.init();
    Toast.init();
    NotificationManager.init();
    EmoteWheel.init();
    AudioManager.init();

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

    Logger.log('Galaxy Miner ready');
  },

  startGame(playerData) {
    if (this.gameStarted) return;
    this.gameStarted = true;

    Logger.log('Starting game for player:', playerData.username);

    // Initialize player and world
    Player.init(playerData);
    World.init(CONSTANTS.GALAXY_SEED);
    Entities.init();

    // Sync credit animation with loaded player credits
    if (typeof CreditAnimation !== 'undefined') {
      CreditAnimation.setCredits(Player.credits);
    }

    // Hide auth, show HUD
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');

    // Request fullscreen on mobile
    if (typeof DeviceDetect !== 'undefined' && DeviceDetect.isMobile) {
      this.requestFullscreen();
    }

    // Start game loop
    Game.start();
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
    Game.stop();

    // Show auth, hide HUD
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('hud').classList.add('hidden');
  }
};

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  GalaxyMiner.init();
});
