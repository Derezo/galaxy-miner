// Galaxy Miner - Main Entry Point

const GalaxyMiner = {
  initialized: false,
  gameStarted: false,

  init() {
    if (this.initialized) return;
    this.initialized = true;

    Logger.log('Galaxy Miner initializing...');

    // Initialize modules
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

    // Start game loop
    Game.start();
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
