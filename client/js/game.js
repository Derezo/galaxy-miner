// Galaxy Miner - Game Loop

const Game = {
  running: false,
  lastTime: 0,
  deltaTime: 0,

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.loop();
    Logger.log('Game loop started');
  },

  stop() {
    this.running = false;
    Logger.log('Game loop stopped');
  },

  loop() {
    if (!this.running) return;

    const currentTime = performance.now();
    this.deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
    this.lastTime = currentTime;

    this.update(this.deltaTime);
    this.render();

    requestAnimationFrame(() => this.loop());
  },

  update(dt) {
    // Update player (movement prediction)
    Player.update(dt);

    // Mobile auto-fire system
    if (typeof AutoFire !== 'undefined') {
      AutoFire.update(dt);
    }

    // Update other entities
    Entities.update(dt);

    // Update world (sector loading, etc.)
    World.update(Player.position);

    // Update graphics systems (particles, weapon projectiles)
    Renderer.update(dt);

    // Update HUD
    HUD.update();
  },

  render() {
    Renderer.clear();
    Renderer.drawWorld();
    Renderer.drawEntities();
    Renderer.drawPlayer();
    Renderer.drawUI();
  }
};
