/**
 * Crystal Shape Generator
 * Creates geometric crystal/gem SVG shapes for mineral-type resources.
 * Supports varying facets, refraction effects, and shimmer animations.
 */

const CrystalShape = {
  /**
   * Generate a crystal SVG element
   * @param {Object} config - Shape configuration
   * @param {number} config.size - Icon size in pixels
   * @param {number} config.hue - Base hue (0-360)
   * @param {number} config.saturation - Color saturation (0-100)
   * @param {number} config.facets - Number of facets (3-8)
   * @param {number} config.glowIntensity - Glow strength (0-1)
   * @param {string} config.variant - Shape variant: 'gem', 'prism', 'cluster'
   * @returns {SVGElement}
   */
  create(config) {
    const {
      size = 24,
      hue = 200,
      saturation = 70,
      facets = 5,
      glowIntensity = 0.5,
      variant = 'gem'
    } = config;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.classList.add('resource-icon', 'crystal-icon');

    // Create gradient definitions
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

    // Main gradient
    const gradientId = `crystal-grad-${Math.random().toString(36).substr(2, 9)}`;
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.setAttribute('id', gradientId);
    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('x2', '100%');
    gradient.setAttribute('y2', '100%');

    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', `hsl(${hue}, ${saturation}%, 70%)`);

    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop2.setAttribute('offset', '50%');
    stop2.setAttribute('stop-color', `hsl(${hue}, ${saturation}%, 50%)`);

    const stop3 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop3.setAttribute('offset', '100%');
    stop3.setAttribute('stop-color', `hsl(${hue}, ${saturation}%, 30%)`);

    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    gradient.appendChild(stop3);
    defs.appendChild(gradient);

    // Glow filter
    if (glowIntensity > 0) {
      const filterId = `crystal-glow-${Math.random().toString(36).substr(2, 9)}`;
      const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
      filter.setAttribute('id', filterId);
      filter.setAttribute('x', '-50%');
      filter.setAttribute('y', '-50%');
      filter.setAttribute('width', '200%');
      filter.setAttribute('height', '200%');

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

      filter.appendChild(blur);
      filter.appendChild(merge);
      defs.appendChild(filter);

      svg.dataset.filterId = filterId;
    }

    svg.appendChild(defs);

    // Generate shape based on variant
    let path;
    switch (variant) {
      case 'prism':
        path = this._createPrism(facets, hue, saturation, gradientId);
        break;
      case 'cluster':
        path = this._createCluster(facets, hue, saturation, gradientId);
        break;
      case 'gem':
      default:
        path = this._createGem(facets, hue, saturation, gradientId);
    }

    svg.appendChild(path);

    // Add highlight
    const highlight = this._createHighlight(variant);
    svg.appendChild(highlight);

    // Apply filter
    if (svg.dataset.filterId) {
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('filter', `url(#${svg.dataset.filterId})`);
      while (svg.childNodes.length > 1) {
        group.appendChild(svg.childNodes[1]);
      }
      svg.appendChild(group);
    }

    return svg;
  },

  /**
   * Create gem-shaped crystal (classic diamond shape)
   */
  _createGem(facets, hue, saturation, gradientId) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    // Main body
    const body = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    body.setAttribute('points', '12,2 22,9 18,22 6,22 2,9');
    body.setAttribute('fill', `url(#${gradientId})`);
    body.setAttribute('stroke', `hsl(${hue}, ${saturation}%, 80%)`);
    body.setAttribute('stroke-width', '0.5');
    group.appendChild(body);

    // Facet lines based on complexity
    const facetLines = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    facetLines.setAttribute('stroke', `hsl(${hue}, ${saturation}%, 60%)`);
    facetLines.setAttribute('stroke-width', '0.3');
    facetLines.setAttribute('fill', 'none');

    // Center lines
    const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line1.setAttribute('x1', '12'); line1.setAttribute('y1', '2');
    line1.setAttribute('x2', '12'); line1.setAttribute('y2', '14');
    facetLines.appendChild(line1);

    if (facets >= 4) {
      const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line2.setAttribute('x1', '2'); line2.setAttribute('y1', '9');
      line2.setAttribute('x2', '12'); line2.setAttribute('y2', '14');
      facetLines.appendChild(line2);

      const line3 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line3.setAttribute('x1', '22'); line3.setAttribute('y1', '9');
      line3.setAttribute('x2', '12'); line3.setAttribute('y2', '14');
      facetLines.appendChild(line3);
    }

    if (facets >= 6) {
      const line4 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line4.setAttribute('x1', '12'); line4.setAttribute('y1', '14');
      line4.setAttribute('x2', '6'); line4.setAttribute('y2', '22');
      facetLines.appendChild(line4);

      const line5 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line5.setAttribute('x1', '12'); line5.setAttribute('y1', '14');
      line5.setAttribute('x2', '18'); line5.setAttribute('y2', '22');
      facetLines.appendChild(line5);
    }

    group.appendChild(facetLines);
    return group;
  },

  /**
   * Create prism-shaped crystal (tall elongated)
   */
  _createPrism(facets, hue, saturation, gradientId) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    // Main body - tall hexagonal prism
    const body = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    body.setAttribute('points', '12,1 17,4 17,18 12,23 7,18 7,4');
    body.setAttribute('fill', `url(#${gradientId})`);
    body.setAttribute('stroke', `hsl(${hue}, ${saturation}%, 80%)`);
    body.setAttribute('stroke-width', '0.5');
    group.appendChild(body);

    // Side facet
    const side = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    side.setAttribute('points', '12,1 17,4 17,18 12,23');
    side.setAttribute('fill', `hsl(${hue}, ${saturation}%, 40%)`);
    side.setAttribute('opacity', '0.4');
    group.appendChild(side);

    return group;
  },

  /**
   * Create cluster of small crystals
   */
  _createCluster(facets, hue, saturation, gradientId) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    // Multiple small crystals
    const crystals = [
      { points: '12,2 15,8 12,12 9,8', x: 0, y: 0 },
      { points: '6,10 9,14 6,20 3,14', x: 0, y: 0 },
      { points: '18,10 21,14 18,20 15,14', x: 0, y: 0 }
    ];

    crystals.forEach((c, i) => {
      const crystal = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      crystal.setAttribute('points', c.points);
      crystal.setAttribute('fill', `url(#${gradientId})`);
      crystal.setAttribute('stroke', `hsl(${hue}, ${saturation}%, 80%)`);
      crystal.setAttribute('stroke-width', '0.3');
      crystal.setAttribute('opacity', String(1 - i * 0.15));
      group.appendChild(crystal);
    });

    return group;
  },

  /**
   * Create highlight reflection
   */
  _createHighlight(variant) {
    const highlight = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');

    if (variant === 'cluster') {
      highlight.setAttribute('points', '11,3 13,3 12,6');
    } else if (variant === 'prism') {
      highlight.setAttribute('points', '10,3 14,3 12,8');
    } else {
      highlight.setAttribute('points', '8,4 12,3 10,7');
    }

    highlight.setAttribute('fill', 'white');
    highlight.setAttribute('opacity', '0.6');
    highlight.classList.add('crystal-highlight');

    return highlight;
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.CrystalShape = CrystalShape;
}
