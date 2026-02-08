// Galaxy Miner - Auto Quality Detection
// Runs a brief canvas benchmark on first mobile launch to determine optimal quality setting.
// Uses offscreen canvas rendering operations that approximate the game's actual workload.

const AutoQuality = {
  _benchmarkDuration: 1500, // 1.5 seconds
  _canvasSize: 400,
  _batchSize: 50,
  _manualKey: 'galaxy_miner_quality_manual',

  /**
   * Run a 1.5-second offscreen canvas benchmark to determine optimal quality.
   * Skips if not mobile or if quality was manually set by the user.
   * @param {function} callback - Called with quality (number) or null if skipped
   */
  detect(callback) {
    // Skip if not mobile (check both DeviceDetect and UA fallback since
    // DeviceDetect.init() may not have been called yet)
    const isMobile = (typeof DeviceDetect !== 'undefined' && DeviceDetect.isMobile) ||
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (!isMobile) {
      callback(null);
      return;
    }

    // Skip if user has manually set quality before
    if (localStorage.getItem(this._manualKey)) {
      callback(null);
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = this._canvasSize;
    canvas.height = this._canvasSize;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      console.warn('[AutoQuality] Could not create canvas context, skipping benchmark');
      callback(null);
      return;
    }

    let ops = 0;
    const startTime = performance.now();
    const duration = this._benchmarkDuration;
    const batchSize = this._batchSize;
    const size = this._canvasSize;
    const halfSize = size / 2;

    const benchmark = () => {
      const elapsed = performance.now() - startTime;
      if (elapsed >= duration) {
        const opsPerSec = ops / (elapsed / 1000);
        const quality = AutoQuality.scoreToQuality(opsPerSec);
        console.log('[AutoQuality] Benchmark complete:', {
          opsPerSec: Math.round(opsPerSec),
          cores: navigator.hardwareConcurrency || 'unknown',
          memory: navigator.deviceMemory || 'unknown',
          quality
        });
        callback(quality);
        return;
      }

      // Run a batch of rendering operations that approximate the game workload
      for (let i = 0; i < batchSize; i++) {
        // Gradient creation (tests GPU gradient rasterization)
        const grad = ctx.createRadialGradient(halfSize, halfSize, 10, halfSize, halfSize, 100);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(1, '#000000');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);

        // Arc drawing (tests path rendering)
        ctx.beginPath();
        ctx.arc(halfSize, halfSize, 50 + Math.random() * 100, 0, Math.PI * 2);
        ctx.fill();

        // Alpha compositing (tests blend modes)
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = `hsl(${Math.random() * 360}, 70%, 50%)`;
        ctx.fillRect(Math.random() * 300, Math.random() * 300, 100, 100);
        ctx.globalAlpha = 1;

        ops++;
      }

      requestAnimationFrame(benchmark);
    };

    // Show toast so user knows optimization is happening
    if (typeof Toast !== 'undefined' && Toast.show) {
      Toast.show('Optimizing for your device...', 'info');
    }

    requestAnimationFrame(benchmark);
  },

  /**
   * Convert benchmark ops/sec score to a quality value (0-100).
   * Factors in hardware heuristics from browser APIs for a more accurate result.
   * @param {number} opsPerSec - Raw benchmark operations per second
   * @returns {number} Quality value (10, 25, 40, 70, or 100)
   */
  scoreToQuality(opsPerSec) {
    const cores = navigator.hardwareConcurrency || 2;
    const memory = navigator.deviceMemory || 2; // GB, Chrome-only API

    let score = opsPerSec;

    // Boost or penalize based on hardware capabilities
    if (cores >= 8) score *= 1.2;
    else if (cores <= 2) score *= 0.8;

    if (memory >= 8) score *= 1.1;
    else if (memory <= 2) score *= 0.8;

    // Map score to quality presets
    if (score < 800) return 10;    // ultraLow
    if (score < 1500) return 25;   // low
    if (score < 3000) return 40;   // medium
    if (score < 5000) return 70;   // high
    return 100;                     // ultra
  },

  /**
   * Mark that the user has manually set quality (disables future auto-detection)
   */
  markManualQuality() {
    try {
      localStorage.setItem(this._manualKey, '1');
    } catch (e) {
      // localStorage may be unavailable
    }
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.AutoQuality = AutoQuality;
}
