/**
 * Relic Shape Generator
 * Creates a stone monument/obelisk SVG with glowing extraterrestrial glyphs.
 * Used as the default icon for relics that don't have custom icons.
 */

const RelicShape = {
  /**
   * Generate a relic monument SVG element
   * @param {Object} config - Shape configuration
   * @param {number} config.size - Icon size in pixels
   * @param {string} config.glyphVariant - Glyph pattern: 'constellation', 'void', 'organic', 'currency'
   * @param {string} config.glowColor - Glow color for glyphs (hex or hsl)
   * @param {number} config.glowIntensity - Glow strength (0-1)
   * @returns {SVGElement}
   */
  create(config) {
    const {
      size = 32,
      glyphVariant = 'constellation',
      glowColor = '#00aaff',
      glowIntensity = 0.7
    } = config;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.classList.add('resource-icon', 'relic-icon');

    // Create definitions for gradients and filters
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const uniqueId = Math.random().toString(36).substr(2, 9);

    // Stone gradient (weathered gray)
    const stoneGradientId = `relic-stone-${uniqueId}`;
    const stoneGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    stoneGradient.setAttribute('id', stoneGradientId);
    stoneGradient.setAttribute('x1', '0%');
    stoneGradient.setAttribute('y1', '0%');
    stoneGradient.setAttribute('x2', '100%');
    stoneGradient.setAttribute('y2', '100%');

    const stoneStops = [
      { offset: '0%', color: '#5a5a5a' },
      { offset: '30%', color: '#4a4a4a' },
      { offset: '70%', color: '#3a3a3a' },
      { offset: '100%', color: '#2a2a2a' }
    ];

    stoneStops.forEach(stop => {
      const stopEl = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stopEl.setAttribute('offset', stop.offset);
      stopEl.setAttribute('stop-color', stop.color);
      stoneGradient.appendChild(stopEl);
    });
    defs.appendChild(stoneGradient);

    // Glyph glow filter
    const glowFilterId = `relic-glow-${uniqueId}`;
    const glowFilter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    glowFilter.setAttribute('id', glowFilterId);
    glowFilter.setAttribute('x', '-100%');
    glowFilter.setAttribute('y', '-100%');
    glowFilter.setAttribute('width', '300%');
    glowFilter.setAttribute('height', '300%');

    const blur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
    blur.setAttribute('stdDeviation', String(1.5 * glowIntensity));
    blur.setAttribute('result', 'glow');

    const merge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
    const mergeNode1 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
    mergeNode1.setAttribute('in', 'glow');
    const mergeNode2 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
    mergeNode2.setAttribute('in', 'glow');
    const mergeNode3 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
    mergeNode3.setAttribute('in', 'SourceGraphic');
    merge.appendChild(mergeNode1);
    merge.appendChild(mergeNode2);
    merge.appendChild(mergeNode3);

    glowFilter.appendChild(blur);
    glowFilter.appendChild(merge);
    defs.appendChild(glowFilter);

    svg.appendChild(defs);

    // Create monument group
    const monument = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    // Stone base (wider at bottom, narrower at top - obelisk shape)
    const obelisk = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    obelisk.setAttribute('points', '12,1 16,3 17,20 15,23 9,23 7,20 8,3');
    obelisk.setAttribute('fill', `url(#${stoneGradientId})`);
    obelisk.setAttribute('stroke', '#666666');
    obelisk.setAttribute('stroke-width', '0.5');
    monument.appendChild(obelisk);

    // Add weathering/cracks
    const cracks = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    cracks.setAttribute('stroke', '#333333');
    cracks.setAttribute('stroke-width', '0.3');
    cracks.setAttribute('fill', 'none');
    cracks.setAttribute('opacity', '0.6');

    const crack1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    crack1.setAttribute('d', 'M8,5 L9,7 L8,9');
    cracks.appendChild(crack1);

    const crack2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    crack2.setAttribute('d', 'M16,12 L15,14 L16,16');
    cracks.appendChild(crack2);

    monument.appendChild(cracks);

    // Add glowing glyphs based on variant
    const glyphs = this._createGlyphs(glyphVariant, glowColor, glowFilterId);
    monument.appendChild(glyphs);

    svg.appendChild(monument);

    return svg;
  },

  /**
   * Create glyph patterns based on variant
   * @private
   */
  _createGlyphs(variant, glowColor, filterId) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('filter', `url(#${filterId})`);
    group.setAttribute('fill', glowColor);
    group.setAttribute('stroke', glowColor);
    group.setAttribute('stroke-width', '0.3');
    group.classList.add('relic-glyphs');

    switch (variant) {
      case 'constellation':
        this._addConstellationGlyphs(group);
        break;
      case 'void':
        this._addVoidGlyphs(group);
        break;
      case 'organic':
        this._addOrganicGlyphs(group);
        break;
      case 'currency':
        this._addCurrencyGlyphs(group);
        break;
      default:
        this._addConstellationGlyphs(group);
    }

    return group;
  },

  /**
   * Constellation pattern - stars connected by lines
   */
  _addConstellationGlyphs(group) {
    // Star points
    const stars = [
      { x: 10, y: 6 },
      { x: 14, y: 8 },
      { x: 11, y: 11 },
      { x: 13, y: 15 },
      { x: 10, y: 18 }
    ];

    // Draw connecting lines
    const lines = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    lines.setAttribute('d', 'M10,6 L14,8 L11,11 L13,15 L10,18');
    lines.setAttribute('fill', 'none');
    lines.setAttribute('stroke-width', '0.5');
    group.appendChild(lines);

    // Draw star points
    stars.forEach(star => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', star.x);
      circle.setAttribute('cy', star.y);
      circle.setAttribute('r', '1');
      group.appendChild(circle);
    });
  },

  /**
   * Void pattern - swirling void symbols
   */
  _addVoidGlyphs(group) {
    // Spiral/void symbol
    const spiral = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    spiral.setAttribute('d', 'M12,7 Q14,7 14,9 Q14,11 12,11 Q10,11 10,13 Q10,15 12,15');
    spiral.setAttribute('fill', 'none');
    spiral.setAttribute('stroke-width', '0.6');
    group.appendChild(spiral);

    // Eye symbol
    const eye = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    eye.setAttribute('cx', '12');
    eye.setAttribute('cy', '18');
    eye.setAttribute('rx', '2');
    eye.setAttribute('ry', '1');
    group.appendChild(eye);

    const pupil = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    pupil.setAttribute('cx', '12');
    pupil.setAttribute('cy', '18');
    pupil.setAttribute('r', '0.5');
    group.appendChild(pupil);
  },

  /**
   * Organic pattern - bio-electric veins
   */
  _addOrganicGlyphs(group) {
    // Branching veins
    const veins = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    veins.setAttribute('d', 'M12,5 L12,10 M12,8 L10,6 M12,8 L14,6 M12,10 L12,16 M12,13 L10,15 M12,13 L14,15 M12,16 L11,19 M12,16 L13,19');
    veins.setAttribute('fill', 'none');
    veins.setAttribute('stroke-width', '0.5');
    group.appendChild(veins);

    // Nodes
    const nodes = [
      { x: 12, y: 10 },
      { x: 12, y: 16 }
    ];

    nodes.forEach(node => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', node.x);
      circle.setAttribute('cy', node.y);
      circle.setAttribute('r', '1.2');
      group.appendChild(circle);
    });
  },

  /**
   * Currency pattern - treasure symbols
   */
  _addCurrencyGlyphs(group) {
    // Coin/circle symbol
    const coin = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    coin.setAttribute('cx', '12');
    coin.setAttribute('cy', '8');
    coin.setAttribute('r', '2.5');
    coin.setAttribute('fill', 'none');
    coin.setAttribute('stroke-width', '0.6');
    group.appendChild(coin);

    // Cross/currency mark
    const cross = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    cross.setAttribute('d', 'M12,6 L12,10 M10.5,8 L13.5,8');
    cross.setAttribute('fill', 'none');
    cross.setAttribute('stroke-width', '0.5');
    group.appendChild(cross);

    // Diamond below
    const diamond = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    diamond.setAttribute('points', '12,13 14,16 12,19 10,16');
    diamond.setAttribute('fill', 'none');
    diamond.setAttribute('stroke-width', '0.5');
    group.appendChild(diamond);
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.RelicShape = RelicShape;
}
