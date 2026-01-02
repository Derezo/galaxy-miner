/**
 * Subspace Warp Drive Shape Generator
 * Creates a black hole with swirling void energy - the Leviathan's relic.
 * Dark core with purple void tendrils spiraling inward.
 */

const SubspaceWarpDriveShape = {
  /**
   * Generate a subspace warp drive SVG element
   * @param {Object} config - Shape configuration
   * @param {number} config.size - Icon size in pixels
   * @param {number} config.glowIntensity - Glow strength (0-1)
   * @returns {SVGElement}
   */
  create(config) {
    const {
      size = 32,
      glowIntensity = 0.9
    } = config;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.classList.add('resource-icon', 'subspace-warp-drive-icon');

    // Create definitions
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const uniqueId = Math.random().toString(36).substring(2, 11);

    // Void gradient (black center, purple edge)
    const voidGradientId = `subspace-void-${uniqueId}`;
    const voidGradient = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
    voidGradient.setAttribute('id', voidGradientId);
    voidGradient.setAttribute('cx', '50%');
    voidGradient.setAttribute('cy', '50%');
    voidGradient.setAttribute('r', '50%');

    const voidStops = [
      { offset: '0%', color: '#000000' },     // Pure black core
      { offset: '30%', color: '#1a0033' },    // Very dark purple
      { offset: '60%', color: '#330066' },    // Dark purple
      { offset: '85%', color: '#660099' },    // Deep purple
      { offset: '100%', color: '#9900ff' }    // Bright purple edge
    ];

    voidStops.forEach(stop => {
      const stopEl = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stopEl.setAttribute('offset', stop.offset);
      stopEl.setAttribute('stop-color', stop.color);
      voidGradient.appendChild(stopEl);
    });
    defs.appendChild(voidGradient);

    // Event horizon ring gradient
    const horizonGradientId = `subspace-horizon-${uniqueId}`;
    const horizonGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    horizonGradient.setAttribute('id', horizonGradientId);
    horizonGradient.setAttribute('x1', '0%');
    horizonGradient.setAttribute('y1', '0%');
    horizonGradient.setAttribute('x2', '100%');
    horizonGradient.setAttribute('y2', '100%');

    const horizonStops = [
      { offset: '0%', color: '#ff00ff' },   // Magenta
      { offset: '50%', color: '#9900ff' },  // Purple
      { offset: '100%', color: '#cc66ff' }  // Light purple
    ];

    horizonStops.forEach(stop => {
      const stopEl = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stopEl.setAttribute('offset', stop.offset);
      stopEl.setAttribute('stop-color', stop.color);
      horizonGradient.appendChild(stopEl);
    });
    defs.appendChild(horizonGradient);

    // Glow filter (purple)
    const glowFilterId = `subspace-glow-${uniqueId}`;
    const glowFilter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    glowFilter.setAttribute('id', glowFilterId);
    glowFilter.setAttribute('x', '-50%');
    glowFilter.setAttribute('y', '-50%');
    glowFilter.setAttribute('width', '200%');
    glowFilter.setAttribute('height', '200%');

    const blur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
    blur.setAttribute('stdDeviation', String(2.5 * glowIntensity));
    blur.setAttribute('result', 'glow');

    const colorMatrix = document.createElementNS('http://www.w3.org/2000/svg', 'feColorMatrix');
    colorMatrix.setAttribute('in', 'glow');
    colorMatrix.setAttribute('type', 'matrix');
    colorMatrix.setAttribute('values', '1 0 0 0 0.4  0 1 0 0 0  0 0 1 0 0.6  0 0 0 1 0');
    colorMatrix.setAttribute('result', 'purpleGlow');

    const merge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
    const mergeNode1 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
    mergeNode1.setAttribute('in', 'purpleGlow');
    const mergeNode2 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
    mergeNode2.setAttribute('in', 'SourceGraphic');
    merge.appendChild(mergeNode1);
    merge.appendChild(mergeNode2);

    glowFilter.appendChild(blur);
    glowFilter.appendChild(colorMatrix);
    glowFilter.appendChild(merge);
    defs.appendChild(glowFilter);

    svg.appendChild(defs);

    // Create main group
    const mainGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    mainGroup.setAttribute('filter', `url(#${glowFilterId})`);

    // Outer energy ring (event horizon)
    const outerRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    outerRing.setAttribute('cx', '12');
    outerRing.setAttribute('cy', '12');
    outerRing.setAttribute('r', '10');
    outerRing.setAttribute('fill', 'none');
    outerRing.setAttribute('stroke', `url(#${horizonGradientId})`);
    outerRing.setAttribute('stroke-width', '1.5');
    outerRing.setAttribute('opacity', '0.8');
    mainGroup.appendChild(outerRing);

    // Black hole core
    const core = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    core.setAttribute('cx', '12');
    core.setAttribute('cy', '12');
    core.setAttribute('r', '8');
    core.setAttribute('fill', `url(#${voidGradientId})`);
    mainGroup.appendChild(core);

    // Void tendrils spiraling inward (animated via CSS)
    const tendrilGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    tendrilGroup.classList.add('void-tendrils');
    tendrilGroup.setAttribute('transform-origin', '12 12');

    // Create 5 spiral tendrils
    const tendrilColors = ['#660099', '#9900ff', '#aa00ff', '#cc66ff', '#ff00ff'];
    for (let i = 0; i < 5; i++) {
      const tendril = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const rotation = i * 72; // 360/5
      tendril.setAttribute('d', this._createTendrilPath(12, 12, 2, 8, rotation));
      tendril.setAttribute('fill', 'none');
      tendril.setAttribute('stroke', tendrilColors[i]);
      tendril.setAttribute('stroke-width', '0.8');
      tendril.setAttribute('opacity', '0.7');
      tendrilGroup.appendChild(tendril);
    }
    mainGroup.appendChild(tendrilGroup);

    // Inner accretion disk (ring around singularity)
    const accretionDisk = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    accretionDisk.setAttribute('cx', '12');
    accretionDisk.setAttribute('cy', '12');
    accretionDisk.setAttribute('rx', '5');
    accretionDisk.setAttribute('ry', '2');
    accretionDisk.setAttribute('fill', 'none');
    accretionDisk.setAttribute('stroke', '#cc66ff');
    accretionDisk.setAttribute('stroke-width', '0.6');
    accretionDisk.setAttribute('opacity', '0.6');
    accretionDisk.classList.add('accretion-disk');
    mainGroup.appendChild(accretionDisk);

    // Singularity (pure black center)
    const singularity = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    singularity.setAttribute('cx', '12');
    singularity.setAttribute('cy', '12');
    singularity.setAttribute('r', '2.5');
    singularity.setAttribute('fill', '#000000');
    mainGroup.appendChild(singularity);

    // Inner bright ring around singularity
    const innerRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    innerRing.setAttribute('cx', '12');
    innerRing.setAttribute('cy', '12');
    innerRing.setAttribute('r', '2.5');
    innerRing.setAttribute('fill', 'none');
    innerRing.setAttribute('stroke', '#ff00ff');
    innerRing.setAttribute('stroke-width', '0.5');
    innerRing.classList.add('singularity-ring');
    mainGroup.appendChild(innerRing);

    // Energy particles being sucked in
    const particles = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    particles.classList.add('void-particles');

    const particlePositions = [
      { x: 6, y: 6 },
      { x: 18, y: 8 },
      { x: 16, y: 16 },
      { x: 8, y: 17 },
      { x: 5, y: 12 },
      { x: 19, y: 12 }
    ];

    particlePositions.forEach((pos, i) => {
      const particle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      particle.setAttribute('cx', pos.x);
      particle.setAttribute('cy', pos.y);
      particle.setAttribute('r', '0.6');
      particle.setAttribute('fill', i % 2 === 0 ? '#9900ff' : '#ff00ff');
      particle.classList.add('void-particle');
      particle.style.animationDelay = `${i * 0.4}s`;
      particles.appendChild(particle);
    });

    mainGroup.appendChild(particles);

    svg.appendChild(mainGroup);

    return svg;
  },

  /**
   * Create a tendril path spiraling inward
   * @private
   */
  _createTendrilPath(cx, cy, innerRadius, outerRadius, startAngle) {
    const points = [];
    const turns = 0.8; // Partial turn inward
    const steps = 15;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // Spiral inward (start from outer, go to inner)
      const angle = (startAngle * Math.PI / 180) + (t * turns * 2 * Math.PI);
      const radius = outerRadius - (outerRadius - innerRadius) * t;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;

      if (i === 0) {
        points.push(`M${x.toFixed(2)},${y.toFixed(2)}`);
      } else {
        points.push(`L${x.toFixed(2)},${y.toFixed(2)}`);
      }
    }

    return points.join(' ');
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.SubspaceWarpDriveShape = SubspaceWarpDriveShape;
}
