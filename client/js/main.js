// Galaxy Miner - Main Entry Point

const GalaxyMiner = {
  initialized: false,
  gameStarted: false,

  init() {
    if (this.initialized) return;
    this.initialized = true;

    console.log('Galaxy Miner initializing...');

    // Initialize modules
    Network.init();
    Input.init();
    Renderer.init();
    AuthUI.init();
    HUD.init();
    InventoryUI.init();
    MarketplaceUI.init();
    ChatUI.init();

    console.log('Galaxy Miner ready');
  },

  startGame(playerData) {
    if (this.gameStarted) return;
    this.gameStarted = true;

    console.log('Starting game for player:', playerData.username);

    // Initialize player and world
    Player.init(playerData);
    World.init(CONSTANTS.GALAXY_SEED);
    Entities.init();

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
