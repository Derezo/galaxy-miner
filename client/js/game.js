// Galaxy Miner - Game Loop

const Game = {
  running: false,
  paused: false,
  lastTime: 0,
  deltaTime: 1 / 60,
  SIMULATION_HZ: 60,
  HUD_UPDATE_HZ: 10,
  MAX_CATCH_UP_STEPS: 5,
  TIMING_EPSILON_MS: 1e-7,
  _tabVisible: true,
  _visibilityHandler: null,
  _boundLoop: null,
  _simulationAccumulator: 0,
  _renderAccumulator: 0,
  _lastRenderTime: 0,
  _hudAccumulator: 0.1,
  _visibleWorldObjects: null,

  _resetFrameTiming(now = performance.now()) {
    this.lastTime = now;
    this._simulationAccumulator = 0;
    this._renderAccumulator = 0;
    // Refresh immediately on the next simulation step, then at HUD_UPDATE_HZ.
    this._hudAccumulator = 1 / this.HUD_UPDATE_HZ;
    this._lastRenderTime = now;
  },

  /**
   * Cover every world consumer with one procedural query. World returns a
   * reusable snapshot, so all consumers must finish before another query.
   */
  getWorldQueryDistance() {
    const renderDistance = typeof Renderer !== 'undefined'
      ? Math.max(Number(Renderer.width) || 0, Number(Renderer.height) || 0) * 2
      : 0;

    let radarDistance = 0;
    if (typeof Player !== 'undefined' && typeof Player.getRadarRange === 'function') {
      const radarRange = Player.getRadarRange();
      radarDistance = typeof Radar !== 'undefined' &&
        typeof Radar.getWorldQueryDiameter === 'function'
        ? Radar.getWorldQueryDiameter(radarRange)
        : radarRange * 2;
    }

    // Player gravity, mining, and wormhole checks need a 2,000-unit query.
    return Math.max(2000, renderDistance, Number(radarDistance) || 0);
  },

  start() {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this._visibleWorldObjects = null;
    this._tabVisible = !document.hidden;
    this._resetFrameTiming();

    if (!this._boundLoop) {
      this._boundLoop = () => this.loop();
    }

    // Background tab optimization: pause work and discard elapsed hidden time.
    this._visibilityHandler = () => {
      this._tabVisible = !document.hidden;
      this._visibleWorldObjects = null;
      this._resetFrameTiming();

      if (document.hidden) {
        Logger.log('Tab hidden - pausing game loop work');
      } else {
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
    this.paused = false;
    this._visibleWorldObjects = null;
    if (this._visibilityHandler) {
      document.removeEventListener('visibilitychange', this._visibilityHandler);
      this._visibilityHandler = null;
    }
    Logger.log('Game loop stopped');
  },

  pause() {
    if (!this.running) return;
    this.paused = true;
    this._visibleWorldObjects = null;
    this._resetFrameTiming();
  },

  resume() {
    if (!this.running) {
      this.start();
      return;
    }
    this.paused = false;
    this._visibleWorldObjects = null;
    this._resetFrameTiming();
  },

  loop() {
    if (!this.running) return;

    const currentTime = performance.now();
    const elapsed = currentTime - this.lastTime;
    const frameTimeMs = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
    this.lastTime = currentTime;

    if (this._tabVisible && !this.paused) {
      const fixedStepMs = 1000 / this.SIMULATION_HZ;
      const fixedStepSeconds = 1 / this.SIMULATION_HZ;
      const maxAccumulatedMs = fixedStepMs * this.MAX_CATCH_UP_STEPS;

      // Fixed-step simulation keeps input and prediction independent of display Hz.
      // Capping the accumulator prevents a stalled frame from causing a death spiral.
      this._simulationAccumulator = Math.min(
        this._simulationAccumulator + frameTimeMs,
        maxAccumulatedMs
      );

      let updateCount = 0;
      while (
        this._simulationAccumulator + this.TIMING_EPSILON_MS >= fixedStepMs &&
        updateCount < this.MAX_CATCH_UP_STEPS
      ) {
        this.deltaTime = fixedStepSeconds;
        this.update(fixedStepSeconds);
        this._simulationAccumulator -= fixedStepMs;
        updateCount++;
      }

      // Avoid retaining a tiny negative value from floating-point subtraction.
      if (this._simulationAccumulator < 0) {
        this._simulationAccumulator = 0;
      }

      // Render independently at the selected presentation rate.
      this._renderAccumulator += frameTimeMs;
      const configuredFPS = (
        typeof GraphicsSettings !== 'undefined'
          ? GraphicsSettings.getTargetFPS()
          : 60
      );
      const targetFPS = Number.isFinite(configuredFPS) && configuredFPS > 0
        ? configuredFPS
        : 60;
      const targetInterval = 1000 / targetFPS;

      if (this._renderAccumulator + this.TIMING_EPSILON_MS >= targetInterval) {
        this.render();

        // The quality monitor consumes intervals between frames that were actually
        // rendered, rather than every rAF callback (including throttled skips).
        if (typeof FrameBudgetMonitor !== 'undefined') {
          FrameBudgetMonitor.recordFrameTime(currentTime - this._lastRenderTime);
        }
        this._lastRenderTime = currentTime;

        // Only one render is useful per rAF; retain at most the fractional remainder.
        // Subtract first because the epsilon comparison may accept a value a few
        // floating-point ulps below the exact interval.
        this._renderAccumulator = Math.max(
          0,
          this._renderAccumulator - targetInterval
        );
        if (this._renderAccumulator >= targetInterval) {
          this._renderAccumulator %= targetInterval;
        }
      }
    }

    requestAnimationFrame(this._boundLoop || (() => this.loop()));
  },

  update(dt) {
    // A single query supplies player physics, effects, radar, background, and
    // drawing. World snapshots are intentionally reused to avoid per-frame GC.
    const visibleWorldObjects = typeof World !== 'undefined' &&
      typeof World.getVisibleObjects === 'function'
      ? World.getVisibleObjects(Player.position, this.getWorldQueryDistance())
      : null;
    this._visibleWorldObjects = visibleWorldObjects;

    // Update player (movement prediction)
    Player.update(dt, visibleWorldObjects);

    // Mobile auto-fire system
    if (typeof AutoFire !== 'undefined') {
      AutoFire.update(dt);
    }

    // Update other entities
    Entities.update(dt);

    // Update world (sector loading, etc.)
    World.update(Player.position);

    // Update graphics systems (particles, weapon projectiles)
    Renderer.update(dt, visibleWorldObjects);

    // DOM and radar work need not run at the 60 Hz physics rate.
    const hudInterval = 1 / this.HUD_UPDATE_HZ;
    this._hudAccumulator += dt;
    if (this._hudAccumulator >= hudInterval) {
      HUD.update(visibleWorldObjects);
      this._hudAccumulator %= hudInterval;
    }
  },

  render() {
    let visibleWorldObjects = this._visibleWorldObjects;
    if (!visibleWorldObjects && typeof World !== 'undefined' &&
        typeof World.getVisibleObjects === 'function') {
      visibleWorldObjects = World.getVisibleObjects(
        Player.position,
        this.getWorldQueryDistance()
      );
      this._visibleWorldObjects = visibleWorldObjects;
    }

    Renderer.clear(visibleWorldObjects);
    Renderer.drawWorld(visibleWorldObjects);
    Renderer.drawEntities();
    Renderer.drawPlayer();
    Renderer.drawUI();
  }
};
