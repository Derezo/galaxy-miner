/**
 * SimplexNoise - Seedable 2D/3D simplex noise for procedural generation
 * Lightweight implementation with fractional Brownian motion helper
 */

const SimplexNoise = {
  // Gradient vectors for 2D (12 directions)
  _grad2: [
    [1,1],[-1,1],[1,-1],[-1,-1],
    [1,0],[-1,0],[0,1],[0,-1],
    [1,1],[-1,1],[1,-1],[-1,-1]
  ],

  // Gradient vectors for 3D (12 edges of a cube)
  _grad3: [
    [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
    [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
    [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
  ],

  // Skew/unskew factors
  _F2: 0.5 * (Math.sqrt(3) - 1),
  _G2: (3 - Math.sqrt(3)) / 6,
  _F3: 1 / 3,
  _G3: 1 / 6,

  /**
   * Simple seeded PRNG (mulberry32)
   * @param {number} seed
   * @returns {function} - Returns 0-1 float on each call
   */
  _seededRng(seed) {
    let s = seed | 0;
    return function() {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  /**
   * Build a shuffled permutation table from a seed
   * @param {number|string} seed
   * @returns {Uint8Array} - 512-entry permutation table (256 doubled)
   */
  _buildPerm(seed) {
    // Convert string seeds to a numeric hash
    if (typeof seed === 'string') {
      let h = 0;
      for (let i = 0; i < seed.length; i++) {
        h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
      }
      seed = h;
    }

    const rng = this._seededRng(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;

    // Fisher-Yates shuffle
    for (let i = 255; i > 0; i--) {
      const j = (rng() * (i + 1)) | 0;
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }

    // Double the table to avoid index wrapping
    const perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    return perm;
  },

  /**
   * Create a noise instance from a seed
   * @param {number|string} seed
   * @returns {{noise2D: function, noise3D: function}}
   */
  create(seed) {
    const perm = this._buildPerm(seed);
    const grad2 = this._grad2;
    const grad3 = this._grad3;
    const F2 = this._F2, G2 = this._G2;
    const F3 = this._F3, G3 = this._G3;

    return {
      /**
       * 2D simplex noise
       * @param {number} x
       * @param {number} y
       * @returns {number} Value in -1 to 1
       */
      noise2D(x, y) {
        const s = (x + y) * F2;
        const i = Math.floor(x + s);
        const j = Math.floor(y + s);
        const t = (i + j) * G2;
        const x0 = x - (i - t);
        const y0 = y - (j - t);

        const i1 = x0 > y0 ? 1 : 0;
        const j1 = x0 > y0 ? 0 : 1;

        const x1 = x0 - i1 + G2;
        const y1 = y0 - j1 + G2;
        const x2 = x0 - 1 + 2 * G2;
        const y2 = y0 - 1 + 2 * G2;

        const ii = i & 255;
        const jj = j & 255;

        let n0 = 0, n1 = 0, n2 = 0;

        let t0 = 0.5 - x0 * x0 - y0 * y0;
        if (t0 > 0) {
          t0 *= t0;
          const g = grad2[perm[ii + perm[jj]] % 12];
          n0 = t0 * t0 * (g[0] * x0 + g[1] * y0);
        }

        let t1 = 0.5 - x1 * x1 - y1 * y1;
        if (t1 > 0) {
          t1 *= t1;
          const g = grad2[perm[ii + i1 + perm[jj + j1]] % 12];
          n1 = t1 * t1 * (g[0] * x1 + g[1] * y1);
        }

        let t2 = 0.5 - x2 * x2 - y2 * y2;
        if (t2 > 0) {
          t2 *= t2;
          const g = grad2[perm[ii + 1 + perm[jj + 1]] % 12];
          n2 = t2 * t2 * (g[0] * x2 + g[1] * y2);
        }

        return 70 * (n0 + n1 + n2);
      },

      /**
       * 3D simplex noise
       * @param {number} x
       * @param {number} y
       * @param {number} z
       * @returns {number} Value in -1 to 1
       */
      noise3D(x, y, z) {
        const s = (x + y + z) * F3;
        const i = Math.floor(x + s);
        const j = Math.floor(y + s);
        const k = Math.floor(z + s);
        const t = (i + j + k) * G3;
        const x0 = x - (i - t);
        const y0 = y - (j - t);
        const z0 = z - (k - t);

        let i1, j1, k1, i2, j2, k2;
        if (x0 >= y0) {
          if (y0 >= z0) { i1=1;j1=0;k1=0;i2=1;j2=1;k2=0; }
          else if (x0 >= z0) { i1=1;j1=0;k1=0;i2=1;j2=0;k2=1; }
          else { i1=0;j1=0;k1=1;i2=1;j2=0;k2=1; }
        } else {
          if (y0 < z0) { i1=0;j1=0;k1=1;i2=0;j2=1;k2=1; }
          else if (x0 < z0) { i1=0;j1=1;k1=0;i2=0;j2=1;k2=1; }
          else { i1=0;j1=1;k1=0;i2=1;j2=1;k2=0; }
        }

        const x1 = x0 - i1 + G3;
        const y1 = y0 - j1 + G3;
        const z1 = z0 - k1 + G3;
        const x2 = x0 - i2 + 2 * G3;
        const y2 = y0 - j2 + 2 * G3;
        const z2 = z0 - k2 + 2 * G3;
        const x3 = x0 - 1 + 3 * G3;
        const y3 = y0 - 1 + 3 * G3;
        const z3 = z0 - 1 + 3 * G3;

        const ii = i & 255;
        const jj = j & 255;
        const kk = k & 255;

        let n0 = 0, n1 = 0, n2 = 0, n3 = 0;

        let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
        if (t0 > 0) {
          t0 *= t0;
          const g = grad3[perm[ii + perm[jj + perm[kk]]] % 12];
          n0 = t0 * t0 * (g[0] * x0 + g[1] * y0 + g[2] * z0);
        }

        let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
        if (t1 > 0) {
          t1 *= t1;
          const g = grad3[perm[ii + i1 + perm[jj + j1 + perm[kk + k1]]] % 12];
          n1 = t1 * t1 * (g[0] * x1 + g[1] * y1 + g[2] * z1);
        }

        let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
        if (t2 > 0) {
          t2 *= t2;
          const g = grad3[perm[ii + i2 + perm[jj + j2 + perm[kk + k2]]] % 12];
          n2 = t2 * t2 * (g[0] * x2 + g[1] * y2 + g[2] * z2);
        }

        let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
        if (t3 > 0) {
          t3 *= t3;
          const g = grad3[perm[ii + 1 + perm[jj + 1 + perm[kk + 1]]] % 12];
          n3 = t3 * t3 * (g[0] * x3 + g[1] * y3 + g[2] * z3);
        }

        return 32 * (n0 + n1 + n2 + n3);
      }
    };
  },

  /**
   * Fractional Brownian motion - accumulates multiple octaves of noise
   * @param {function} noiseFn - A noise2D or noise3D function
   * @param {number} x
   * @param {number} y
   * @param {number} octaves - Number of octaves to sum
   * @param {number} lacunarity - Frequency multiplier per octave (typically 2.0)
   * @param {number} gain - Amplitude multiplier per octave (typically 0.5)
   * @returns {number} Value roughly in -1 to 1
   */
  fbm(noiseFn, x, y, octaves, lacunarity, gain) {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let ampSum = 0;

    for (let i = 0; i < octaves; i++) {
      value += amplitude * noiseFn(x * frequency, y * frequency);
      ampSum += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }

    return value / ampSum;
  }
};

if (typeof window !== 'undefined') {
  window.SimplexNoise = SimplexNoise;
}
