/**
 * Frame Budget Monitor - Adaptive quality auto-adjustment
 *
 * Tracks rolling 60-frame FPS averages and p95 frame times.
 * When performance drops below target for a sustained period, steps quality DOWN.
 * When performance is comfortably above target for a sustained period, steps quality UP.
 *
 * Quality steps: 100 -> 80 -> 60 -> 40 -> 20 -> 10 -> 0
 * These align with GraphicsSettings presets and QualityScaler thresholds.
 *
 * FPS reduction is interleaved with quality steps as a degradation strategy:
 *   100 -> 80 -> 60 -> 40 -> 20 -> (FPS 45) -> 10 -> (FPS 30) -> 0
 * This preserves visual quality longer by reducing frame rate before
 * stripping the last visual effects.
 *
 * Hysteresis prevents thrashing:
 * - 2s sustained below target -> step down
 * - 5s sustained above target -> step up
 */

const FrameBudgetMonitor = {
  // Configuration
  _enabled: false,
  _targetFPS: 60,                  // Target frame rate (desktop default)
  _mobileTargetFPS: 30,            // Target frame rate (mobile)
  _rollingWindowSize: 60,          // Number of frames for rolling average
  _degradeThresholdMs: 2000,       // 2s sustained below target to step down
  _improveThresholdMs: 5000,       // 5s sustained above target to step up
  _improveFPSHeadroom: 10,         // Must be this many FPS above target to consider improving
  _pauseDurationMs: 0,             // When > 0, monitoring is paused
  _pauseUntil: 0,                  // Timestamp when pause ends

  // Quality stepping ladder (descending order)
  _qualitySteps: [100, 80, 60, 40, 20, 10, 0],

  // FPS reduction steps: when quality drops to this level and FPS is above the step,
  // reduce FPS instead of dropping quality further.
  // Ladder: quality 100->80->60->40->20 -> (FPS 45) -> 10 -> (FPS 30) -> 0
  _fpsSteps: [
    { quality: 20, fps: 45 },  // At quality 20, reduce to 45 FPS before dropping to 10
    { quality: 10, fps: 30 }   // At quality 10, reduce to 30 FPS before dropping to 0
  ],

  // Rolling frame time buffer (circular)
  _frameTimes: null,               // Float64Array for frame times in ms
  _frameIndex: 0,                  // Current write position
  _frameCount: 0,                  // Total frames recorded (capped at window size)

  // Hysteresis state
  _belowTargetSince: 0,            // Timestamp when we first went below target (0 = not below)
  _aboveTargetSince: 0,            // Timestamp when we first went above target (0 = not above)
  _lastAdjustmentTime: 0,          // Timestamp of last quality adjustment
  _adjustmentCooldownMs: 3000,     // Minimum time between adjustments

  // Saved quality before auto-quality was enabled (for restoration)
  _savedQuality: null,

  /**
   * Initialize the monitor
   * Should be called after GraphicsSettings and DeviceDetect are ready
   */
  init() {
    this._frameTimes = new Float64Array(this._rollingWindowSize);
    this._frameIndex = 0;
    this._frameCount = 0;
    this._belowTargetSince = 0;
    this._aboveTargetSince = 0;
    this._lastAdjustmentTime = 0;
    this._pauseUntil = 0;

    // Sync target FPS from GraphicsSettings (user preference or previous auto-adjustment)
    if (typeof GraphicsSettings !== 'undefined') {
      this._targetFPS = GraphicsSettings.getTargetFPS();
    }

    // Load auto-quality preference from GraphicsSettings
    if (typeof GraphicsSettings !== 'undefined' && GraphicsSettings.isAutoQuality()) {
      this._enabled = true;
    }

    Logger.log('[FrameBudgetMonitor] Initialized - enabled:', this._enabled,
      'targetFPS:', this._targetFPS);
  },

  /**
   * Record a frame time from the game loop
   * This is the main entry point called every frame
   *
   * @param {number} frameTimeMs - Frame duration in milliseconds
   */
  recordFrameTime(frameTimeMs) {
    // Always record frame times (useful for debug even when auto-quality is off)
    this._frameTimes[this._frameIndex] = frameTimeMs;
    this._frameIndex = (this._frameIndex + 1) % this._rollingWindowSize;
    if (this._frameCount < this._rollingWindowSize) {
      this._frameCount++;
    }

    // Only evaluate quality adjustments if enabled and not paused
    if (!this._enabled) return;

    const now = performance.now();

    // Check if paused (e.g., after tab visibility change)
    if (now < this._pauseUntil) return;

    // Need at least a full window of samples before making decisions
    if (this._frameCount < this._rollingWindowSize) return;

    this._evaluate(now);
  },

  /**
   * Evaluate whether to adjust quality based on current frame time data
   * @param {number} now - Current timestamp from performance.now()
   * @private
   */
  _evaluate(now) {
    const avgFPS = this.getAverageFPS();
    const targetFPS = this._targetFPS;

    // Check cooldown
    if (now - this._lastAdjustmentTime < this._adjustmentCooldownMs) return;

    // Determine if we're below or above target
    const isBelowTarget = avgFPS < targetFPS;
    const isAboveTarget = avgFPS > targetFPS + this._improveFPSHeadroom;

    // Below target: track sustained underperformance
    if (isBelowTarget) {
      this._aboveTargetSince = 0; // Reset improve timer

      if (this._belowTargetSince === 0) {
        this._belowTargetSince = now;
      } else if (now - this._belowTargetSince >= this._degradeThresholdMs) {
        this._stepDown(now);
        this._belowTargetSince = 0; // Reset after stepping
      }
    }
    // Above target with headroom: track sustained good performance
    else if (isAboveTarget) {
      this._belowTargetSince = 0; // Reset degrade timer

      if (this._aboveTargetSince === 0) {
        this._aboveTargetSince = now;
      } else if (now - this._aboveTargetSince >= this._improveThresholdMs) {
        this._stepUp(now);
        this._aboveTargetSince = 0; // Reset after stepping
      }
    }
    // In the acceptable range: reset both timers
    else {
      this._belowTargetSince = 0;
      this._aboveTargetSince = 0;
    }
  },

  /**
   * Step quality down to the next lower level
   * @param {number} now - Current timestamp
   * @private
   */
  _stepDown(now) {
    if (typeof GraphicsSettings === 'undefined') return;

    const currentQuality = GraphicsSettings.getQuality();
    const currentFPS = GraphicsSettings.getTargetFPS();

    // Check if we should reduce FPS instead of quality
    // Walk through FPS steps to see if one applies at the current quality
    for (const step of this._fpsSteps) {
      if (currentQuality === step.quality && currentFPS > step.fps) {
        // Reduce FPS instead of dropping quality
        Logger.log('[FrameBudgetMonitor] Stepping DOWN FPS:', currentFPS, '->', step.fps,
          '(quality:', currentQuality, ', avgFPS:', this.getAverageFPS().toFixed(1), ')');

        GraphicsSettings.setTargetFPS(step.fps);
        this._targetFPS = step.fps;
        this._lastAdjustmentTime = now;
        this._resetFrameData();
        return;
      }
    }

    const nextStep = this._getNextLowerStep(currentQuality);

    if (nextStep === null) {
      // Already at minimum quality
      return;
    }

    Logger.log('[FrameBudgetMonitor] Stepping DOWN quality:', currentQuality, '->', nextStep,
      '(avgFPS:', this.getAverageFPS().toFixed(1), ', target:', this._targetFPS, ')');

    GraphicsSettings.setQuality(nextStep);
    this._lastAdjustmentTime = now;
    // Reset frame data after adjustment to let new quality stabilize
    this._resetFrameData();
  },

  /**
   * Step quality up to the next higher level
   * @param {number} now - Current timestamp
   * @private
   */
  _stepUp(now) {
    if (typeof GraphicsSettings === 'undefined') return;

    const currentQuality = GraphicsSettings.getQuality();
    const currentFPS = GraphicsSettings.getTargetFPS();

    // Check if we should raise FPS before raising quality
    // Walk through FPS steps in reverse to find if FPS was reduced at this quality level
    for (let i = this._fpsSteps.length - 1; i >= 0; i--) {
      const step = this._fpsSteps[i];
      if (currentQuality === step.quality && currentFPS <= step.fps) {
        // Find the next higher FPS to restore to
        // The previous FPS step (or 60 if this is the first step)
        const prevStepIndex = i - 1;
        const targetFPS = prevStepIndex >= 0 ? this._fpsSteps[prevStepIndex].fps : 60;

        if (currentFPS < targetFPS) {
          Logger.log('[FrameBudgetMonitor] Stepping UP FPS:', currentFPS, '->', targetFPS,
            '(quality:', currentQuality, ', avgFPS:', this.getAverageFPS().toFixed(1), ')');

          GraphicsSettings.setTargetFPS(targetFPS);
          this._targetFPS = targetFPS;
          this._lastAdjustmentTime = now;
          this._resetFrameData();
          return;
        }
      }
    }

    const nextStep = this._getNextHigherStep(currentQuality);

    if (nextStep === null) {
      // Already at maximum quality - but check if FPS can still be raised
      if (currentFPS < 60) {
        // Raise FPS back toward 60
        const targetFPS = currentFPS === 30 ? 45 : 60;
        Logger.log('[FrameBudgetMonitor] Stepping UP FPS:', currentFPS, '->', targetFPS,
          '(quality: max, avgFPS:', this.getAverageFPS().toFixed(1), ')');

        GraphicsSettings.setTargetFPS(targetFPS);
        this._targetFPS = targetFPS;
        this._lastAdjustmentTime = now;
        this._resetFrameData();
      }
      return;
    }

    Logger.log('[FrameBudgetMonitor] Stepping UP quality:', currentQuality, '->', nextStep,
      '(avgFPS:', this.getAverageFPS().toFixed(1), ', target:', this._targetFPS, ')');

    GraphicsSettings.setQuality(nextStep);
    this._lastAdjustmentTime = now;
    // Reset frame data after adjustment to let new quality stabilize
    this._resetFrameData();
  },

  /**
   * Get the next lower quality step
   * @param {number} currentQuality - Current quality level
   * @returns {number|null} Next lower step, or null if already at minimum
   * @private
   */
  _getNextLowerStep(currentQuality) {
    for (let i = 0; i < this._qualitySteps.length; i++) {
      if (this._qualitySteps[i] < currentQuality) {
        return this._qualitySteps[i];
      }
    }
    return null;
  },

  /**
   * Get the next higher quality step
   * @param {number} currentQuality - Current quality level
   * @returns {number|null} Next higher step, or null if already at maximum
   * @private
   */
  _getNextHigherStep(currentQuality) {
    for (let i = this._qualitySteps.length - 1; i >= 0; i--) {
      if (this._qualitySteps[i] > currentQuality) {
        return this._qualitySteps[i];
      }
    }
    return null;
  },

  /**
   * Reset frame data (after a quality adjustment or pause)
   * @private
   */
  _resetFrameData() {
    this._frameCount = 0;
    this._frameIndex = 0;
    this._belowTargetSince = 0;
    this._aboveTargetSince = 0;
  },

  // ============================================
  // Public API
  // ============================================

  /**
   * Check if auto-quality is currently enabled
   * @returns {boolean}
   */
  isAutoQuality() {
    return this._enabled;
  },

  /**
   * Enable or disable auto-quality adjustment
   * When enabled, saves the current quality for potential restoration.
   * When disabled, does NOT restore quality (user may want to keep current level).
   *
   * @param {boolean} enabled
   */
  setAutoQuality(enabled) {
    const wasEnabled = this._enabled;
    this._enabled = enabled;

    if (enabled && !wasEnabled) {
      // Entering auto mode: save current quality
      if (typeof GraphicsSettings !== 'undefined') {
        this._savedQuality = GraphicsSettings.getQuality();
      }
      this._resetFrameData();
      Logger.log('[FrameBudgetMonitor] Auto-quality ENABLED, saved quality:', this._savedQuality);
    } else if (!enabled && wasEnabled) {
      Logger.log('[FrameBudgetMonitor] Auto-quality DISABLED');
    }

    // Persist the preference via GraphicsSettings
    if (typeof GraphicsSettings !== 'undefined') {
      GraphicsSettings.setAutoQuality(enabled);
    }
  },

  /**
   * Get the rolling average FPS
   * @returns {number} Average FPS (0 if no data)
   */
  getAverageFPS() {
    if (this._frameCount === 0) return 0;

    let totalMs = 0;
    for (let i = 0; i < this._frameCount; i++) {
      totalMs += this._frameTimes[i];
    }
    const avgMs = totalMs / this._frameCount;
    return avgMs > 0 ? 1000 / avgMs : 0;
  },

  /**
   * Get the p95 frame time (95th percentile)
   * The frame time that 95% of frames are faster than.
   * High p95 indicates occasional stutters even if average is good.
   *
   * @returns {number} p95 frame time in milliseconds (0 if no data)
   */
  getP95FrameTime() {
    if (this._frameCount === 0) return 0;

    // Copy recorded frame times and sort
    const sorted = new Float64Array(this._frameCount);
    for (let i = 0; i < this._frameCount; i++) {
      sorted[i] = this._frameTimes[i];
    }
    sorted.sort();

    // p95 index (95th percentile = slowest 5%)
    const p95Index = Math.ceil(this._frameCount * 0.95) - 1;
    return sorted[Math.min(p95Index, this._frameCount - 1)];
  },

  /**
   * Pause monitoring for a specified duration
   * Used when tab becomes visible again to let frame times stabilize
   *
   * @param {number} durationMs - Duration to pause in milliseconds
   */
  pause(durationMs) {
    this._pauseUntil = performance.now() + durationMs;
    this._resetFrameData();
    Logger.log('[FrameBudgetMonitor] Paused for', durationMs, 'ms');
  },

  /**
   * Debug: Log current monitoring state to console
   */
  debug() {
    const avgFPS = this.getAverageFPS();
    const p95 = this.getP95FrameTime();
    const now = performance.now();
    const currentQuality = typeof GraphicsSettings !== 'undefined'
      ? GraphicsSettings.getQuality() : 'N/A';

    console.group('[FrameBudgetMonitor] Debug State');
    console.log('Enabled:', this._enabled);
    console.log('Target FPS:', this._targetFPS);
    console.log('Current Quality:', currentQuality);
    console.log('Saved Quality:', this._savedQuality);
    console.log('Frame Count:', this._frameCount, '/', this._rollingWindowSize);
    console.log('Average FPS:', avgFPS.toFixed(1));
    console.log('p95 Frame Time:', p95.toFixed(2), 'ms');
    console.log('Average Frame Time:', (avgFPS > 0 ? (1000 / avgFPS).toFixed(2) : 'N/A'), 'ms');

    if (this._belowTargetSince > 0) {
      console.log('Below target for:', ((now - this._belowTargetSince) / 1000).toFixed(1), 's',
        '(threshold:', (this._degradeThresholdMs / 1000), 's)');
    }
    if (this._aboveTargetSince > 0) {
      console.log('Above target for:', ((now - this._aboveTargetSince) / 1000).toFixed(1), 's',
        '(threshold:', (this._improveThresholdMs / 1000), 's)');
    }
    if (now < this._pauseUntil) {
      console.log('Paused for:', ((this._pauseUntil - now) / 1000).toFixed(1), 's remaining');
    }

    console.log('Quality Steps:', this._qualitySteps.join(' -> '));
    console.log('FPS Steps:', this._fpsSteps.map(s => `q${s.quality}->fps${s.fps}`).join(', '));
    console.log('Current FPS Target:', typeof GraphicsSettings !== 'undefined'
      ? GraphicsSettings.getTargetFPS() : 'N/A');
    console.log('Next step down:', this._getNextLowerStep(currentQuality) || 'at minimum');
    console.log('Next step up:', this._getNextHigherStep(currentQuality) || 'at maximum');
    console.groupEnd();
  }
};

// Auto-initialize and expose globally
if (typeof window !== 'undefined') {
  window.FrameBudgetMonitor = FrameBudgetMonitor;

  // Initialize after DOM is ready (other modules may not be loaded yet,
  // but init() handles missing dependencies gracefully)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => FrameBudgetMonitor.init());
  } else {
    FrameBudgetMonitor.init();
  }
}
