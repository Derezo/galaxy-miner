/**
 * Wormhole Gem Shape Generator
 * Creates a deep purple faceted gemstone with an animated swirling wormhole inside.
 * This is a custom icon for the Wormhole Gem relic.
 */

const WormholeGemShape = {
  /**
   * Generate a wormhole gem SVG element
   * @param {Object} config - Shape configuration
   * @param {number} config.size - Icon size in pixels
   * @param {number} config.glowIntensity - Glow strength (0-1)
   * @returns {SVGElement}
   */
  create(config) {
    const {
      size = 32,
      glowIntensity = 0.8
    } = config;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.classList.add('resource-icon', 'wormhole-gem-icon');

    // Create definitions
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const uniqueId = Math.random().toString(36).substr(2, 9);

    // Gem gradient (deep purple)
    const gemGradientId = `wormhole-gem-${uniqueId}`;
    const gemGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gemGradient.setAttribute('id', gemGradientId);
    gemGradient.setAttribute('x1', '0%');
    gemGradient.setAttribute('y1', '0%');
    gemGradient.setAttribute('x2', '100%');
    gemGradient.setAttribute('y2', '100%');

    const gemStops = [
      { offset: '0%', color: '#8b5cf6' },   // Light violet
      { offset: '30%', color: '#6b21a8' },  // Purple
      { offset: '70%', color: '#4c1d95' },  // Dark purple
      { offset: '100%', color: '#3b0764' }  // Very dark purple
    ];

    gemStops.forEach(stop => {
      const stopEl = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stopEl.setAttribute('offset', stop.offset);
      stopEl.setAttribute('stop-color', stop.color);
      gemGradient.appendChild(stopEl);
    });
    defs.appendChild(gemGradient);

    // Wormhole swirl gradient
    const swirlGradientId = `wormhole-swirl-${uniqueId}`;
    const swirlGradient = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
    swirlGradient.setAttribute('id', swirlGradientId);
    swirlGradient.setAttribute('cx', '50%');
    swirlGradient.setAttribute('cy', '50%');
    swirlGradient.setAttribute('r', '50%');

    const swirlStops = [
      { offset: '0%', color: '#1e1b4b' },    // Dark indigo core
      { offset: '40%', color: '#4c1d95' },   // Dark purple
      { offset: '70%', color: '#7c3aed' },   // Violet
      { offset: '100%', color: '#a855f7' }   // Light purple edge
    ];

    swirlStops.forEach(stop => {
      const stopEl = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stopEl.setAttribute('offset', stop.offset);
      stopEl.setAttribute('stop-color', stop.color);
      swirlGradient.appendChild(stopEl);
    });
    defs.appendChild(swirlGradient);

    // Glow filter
    const glowFilterId = `wormhole-glow-${uniqueId}`;
    const glowFilter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    glowFilter.setAttribute('id', glowFilterId);
    glowFilter.setAttribute('x', '-50%');
    glowFilter.setAttribute('y', '-50%');
    glowFilter.setAttribute('width', '200%');
    glowFilter.setAttribute('height', '200%');

    const blur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
    blur.setAttribute('stdDeviation', String(2 * glowIntensity));
    blur.setAttribute('result', 'glow');

    const merge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
    const mergeNode1 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
    mergeNode1.setAttribute('in', 'glow');
    const mergeNode2 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
    mergeNode2.setAttribute('in', 'SourceGraphic');
    merge.appendChild(mergeNode1);
    merge.appendChild(mergeNode2);

    glowFilter.appendChild(blur);
    glowFilter.appendChild(merge);
    defs.appendChild(glowFilter);

    // Clip path for wormhole effect inside gem
    const clipId = `wormhole-clip-${uniqueId}`;
    const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
    clipPath.setAttribute('id', clipId);
    const clipShape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    clipShape.setAttribute('points', '12,3 18,7 18,17 12,21 6,17 6,7');
    clipPath.appendChild(clipShape);
    defs.appendChild(clipPath);

    svg.appendChild(defs);

    // Create gem group
    const gem = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gem.setAttribute('filter', `url(#${glowFilterId})`);

    // Gem body (hexagonal)
    const body = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    body.setAttribute('points', '12,3 18,7 18,17 12,21 6,17 6,7');
    body.setAttribute('fill', `url(#${gemGradientId})`);
    body.setAttribute('stroke', '#a855f7');
    body.setAttribute('stroke-width', '0.5');
    gem.appendChild(body);

    // Wormhole effect group (clipped to gem shape)
    const wormholeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    wormholeGroup.setAttribute('clip-path', `url(#${clipId})`);

    // Wormhole background
    const wormholeBg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    wormholeBg.setAttribute('cx', '12');
    wormholeBg.setAttribute('cy', '12');
    wormholeBg.setAttribute('r', '6');
    wormholeBg.setAttribute('fill', `url(#${swirlGradientId})`);
    wormholeGroup.appendChild(wormholeBg);

    // Spiral arms (animated via CSS)
    const swirlGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    swirlGroup.classList.add('wormhole-swirl');
    swirlGroup.setAttribute('transform-origin', '12 12');

    // Create 3 spiral arms
    for (let i = 0; i < 3; i++) {
      const arm = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const rotation = i * 120;
      arm.setAttribute('d', this._createSpiralPath(12, 12, 1, 5, rotation));
      arm.setAttribute('fill', 'none');
      arm.setAttribute('stroke', i === 0 ? '#c084fc' : (i === 1 ? '#a855f7' : '#7c3aed'));
      arm.setAttribute('stroke-width', '0.8');
      arm.setAttribute('opacity', '0.8');
      swirlGroup.appendChild(arm);
    }

    wormholeGroup.appendChild(swirlGroup);

    // Dark core
    const core = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    core.setAttribute('cx', '12');
    core.setAttribute('cy', '12');
    core.setAttribute('r', '1.5');
    core.setAttribute('fill', '#0c0a1a');
    wormholeGroup.appendChild(core);

    gem.appendChild(wormholeGroup);

    // Facet lines
    const facets = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    facets.setAttribute('stroke', '#a855f7');
    facets.setAttribute('stroke-width', '0.3');
    facets.setAttribute('fill', 'none');
    facets.setAttribute('opacity', '0.5');

    // Top facet
    const topFacet = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    topFacet.setAttribute('x1', '12');
    topFacet.setAttribute('y1', '3');
    topFacet.setAttribute('x2', '12');
    topFacet.setAttribute('y2', '8');
    facets.appendChild(topFacet);

    // Side facets
    const leftFacet = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    leftFacet.setAttribute('x1', '6');
    leftFacet.setAttribute('y1', '7');
    leftFacet.setAttribute('x2', '9');
    leftFacet.setAttribute('y2', '12');
    facets.appendChild(leftFacet);

    const rightFacet = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    rightFacet.setAttribute('x1', '18');
    rightFacet.setAttribute('y1', '7');
    rightFacet.setAttribute('x2', '15');
    rightFacet.setAttribute('y2', '12');
    facets.appendChild(rightFacet);

    gem.appendChild(facets);

    // Highlight
    const highlight = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    highlight.setAttribute('points', '10,5 14,5 12,8');
    highlight.setAttribute('fill', 'white');
    highlight.setAttribute('opacity', '0.4');
    gem.appendChild(highlight);

    // Sparkle particles (animated via CSS)
    const sparkles = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    sparkles.classList.add('wormhole-sparkles');

    const sparklePositions = [
      { x: 8, y: 8 },
      { x: 16, y: 10 },
      { x: 10, y: 16 },
      { x: 14, y: 14 }
    ];

    sparklePositions.forEach((pos, i) => {
      const sparkle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      sparkle.setAttribute('cx', pos.x);
      sparkle.setAttribute('cy', pos.y);
      sparkle.setAttribute('r', '0.5');
      sparkle.setAttribute('fill', '#ffffff');
      sparkle.classList.add('sparkle');
      sparkle.style.animationDelay = `${i * 0.6}s`;
      sparkles.appendChild(sparkle);
    });

    gem.appendChild(sparkles);

    svg.appendChild(gem);

    return svg;
  },

  /**
   * Create a spiral path for the wormhole arms
   * @private
   */
  _createSpiralPath(cx, cy, innerRadius, outerRadius, startAngle) {
    const points = [];
    const turns = 0.6; // Partial turn
    const steps = 12;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = (startAngle * Math.PI / 180) + (t * turns * 2 * Math.PI);
      const radius = innerRadius + (outerRadius - innerRadius) * t;
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
  window.WormholeGemShape = WormholeGemShape;
}
