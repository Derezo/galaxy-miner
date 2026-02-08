// Galaxy Miner - Game Loop

const Game = {
  running: false,
  lastTime: 0,
  deltaTime: 0,
  _tabVisible: true,
  _visibilityHandler: null,
  _renderAccumulator: 0,

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();

    // Background tab optimization: skip rendering when tab is hidden
    this._visibilityHandler = () => {
      if (document.hidden) {
        this._tabVisible = false;
        Logger.log('Tab hidden - skipping render');
      } else {
        this._tabVisible = true;
        this.lastTime = performance.now(); // Prevent huge deltaTime spike
        this._renderAccumulator = 0; // Reset accumulator to avoid burst rendering
        Logger.log('Tab visible - resuming render');

        // Pause frame budget monitor briefly to let frame times stabilize
        if (typeof FrameBudgetMonitor !== 'undefined') {
          FrameBudgetMonitor.pause(1000);
        }
      }
    };
    document.addEventListener('visibilitychange', this._visibilityHandler);

    this.loop();
    Logger.log('Game loop started');
  },

  stop() {
    this.running = false;
    if (this._visibilityHandler) {
      document.removeEventListener('visibilitychange', this._visibilityHandler);
      this._visibilityHandler = null;
    }
    Logger.log('Game loop stopped');
  },

  loop() {
    if (!this.running) return;

    const currentTime = performance.now();
    const frameTimeMs = currentTime - this.lastTime;
    this.deltaTime = frameTimeMs / 1000; // Convert to seconds
    this.lastTime = currentTime;

    // Feed frame time to the adaptive quality monitor
    if (typeof FrameBudgetMonitor !== 'undefined') {
      FrameBudgetMonitor.recordFrameTime(frameTimeMs);
    }

    // Always update (keeps input responsive, interpolation smooth)
    this.update(this.deltaTime);

    // Only render at target frame rate
    if (this._tabVisible) {
      this._renderAccumulator += frameTimeMs;
      const targetInterval = 1000 / (
        typeof GraphicsSettings !== 'undefined'
          ? GraphicsSettings.getTargetFPS()
          : 60
      );

      if (this._renderAccumulator >= targetInterval) {
        this.render();
        this._renderAccumulator -= targetInterval;
        // Prevent accumulator from growing unbounded after tab switch
        if (this._renderAccumulator > targetInterval) {
          this._renderAccumulator = 0;
        }
      }
    }

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
