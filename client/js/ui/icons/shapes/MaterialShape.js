/**
 * Material Shape Generator
 * Creates material/metallic SVG shapes for metal and structural-type resources.
 * Features metallic sheen, reflections, and subtle pulse animations.
 */

const MaterialShape = {
  /**
   * Generate a material SVG element
   * @param {Object} config - Shape configuration
   * @param {number} config.size - Icon size in pixels
   * @param {number} config.hue - Base hue (0-360)
   * @param {number} config.saturation - Color saturation (0-100)
   * @param {number} config.glowIntensity - Glow strength (0-1)
   * @param {string} config.variant - Shape variant: 'ingot', 'cube', 'hexagon', 'nugget'
   * @returns {SVGElement}
   */
  create(config) {
    const {
      size = 24,
      hue = 30,
      saturation = 50,
      glowIntensity = 0.3,
      variant = 'ingot'
    } = config;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.classList.add('resource-icon', 'material-icon');

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

    // Metallic gradient
    const gradientId = `material-grad-${Math.random().toString(36).substr(2, 9)}`;
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.setAttribute('id', gradientId);
    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('x2', '100%');
    gradient.setAttribute('y2', '100%');

    const stops = [
      { offset: '0%', lightness: 70 },
      { offset: '30%', lightness: 55 },
      { offset: '50%', lightness: 65 },
      { offset: '70%', lightness: 45 },
      { offset: '100%', lightness: 35 }
    ];

    stops.forEach(s => {
      const stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop.setAttribute('offset', s.offset);
      stop.setAttribute('stop-color', `hsl(${hue}, ${saturation}%, ${s.lightness}%)`);
      gradient.appendChild(stop);
    });

    defs.appendChild(gradient);

    // Side gradient (darker for 3D effect)
    const sideGradId = `material-side-${Math.random().toString(36).substr(2, 9)}`;
    const sideGrad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    sideGrad.setAttribute('id', sideGradId);
    sideGrad.setAttribute('x1', '0%');
    sideGrad.setAttribute('y1', '0%');
    sideGrad.setAttribute('x2', '0%');
    sideGrad.setAttribute('y2', '100%');

    const sideStop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    sideStop1.setAttribute('offset', '0%');
    sideStop1.setAttribute('stop-color', `hsl(${hue}, ${saturation}%, 45%)`);

    const sideStop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    sideStop2.setAttribute('offset', '100%');
    sideStop2.setAttribute('stop-color', `hsl(${hue}, ${saturation}%, 25%)`);

    sideGrad.appendChild(sideStop1);
    sideGrad.appendChild(sideStop2);
    defs.appendChild(sideGrad);

    // Glow filter
    if (glowIntensity > 0) {
      const filterId = `material-glow-${Math.random().toString(36).substr(2, 9)}`;
      const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
      filter.setAttribute('id', filterId);
      filter.setAttribute('x', '-30%');
      filter.setAttribute('y', '-30%');
      filter.setAttribute('width', '160%');
      filter.setAttribute('height', '160%');

      const blur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
      blur.setAttribute('stdDeviation', String(1 * glowIntensity));
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
    let content;
    switch (variant) {
      case 'cube':
        content = this._createCube(hue, saturation, gradientId, sideGradId);
        break;
      case 'hexagon':
        content = this._createHexagon(hue, saturation, gradientId, sideGradId);
        break;
      case 'nugget':
        content = this._createNugget(hue, saturation, gradientId);
        break;
      case 'ingot':
      default:
        content = this._createIngot(hue, saturation, gradientId, sideGradId);
    }

    // Apply filter
    if (svg.dataset.filterId) {
      content.setAttribute('filter', `url(#${svg.dataset.filterId})`);
    }

    svg.appendChild(content);

    return svg;
  },

  /**
   * Create ingot shape (trapezoidal bar)
   */
  _createIngot(hue, saturation, gradientId, sideGradId) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    // Top face
    const top = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    top.setAttribute('points', '5,8 19,8 17,6 7,6');
    top.setAttribute('fill', `hsl(${hue}, ${saturation}%, 75%)`);
    group.appendChild(top);

    // Front face
    const front = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    front.setAttribute('points', '5,8 19,8 21,18 3,18');
    front.setAttribute('fill', `url(#${gradientId})`);
    group.appendChild(front);

    // Right side
    const right = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    right.setAttribute('points', '19,8 17,6 19,16 21,18');
    right.setAttribute('fill', `url(#${sideGradId})`);
    group.appendChild(right);

    // Highlight stripe
    const highlight = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    highlight.setAttribute('points', '6,9 8,9 9,17 5,17');
    highlight.setAttribute('fill', 'white');
    highlight.setAttribute('opacity', '0.2');
    highlight.classList.add('material-highlight');
    group.appendChild(highlight);

    // Edge lines
    const edge = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    edge.setAttribute('points', '3,18 5,8 19,8 21,18');
    edge.setAttribute('fill', 'none');
    edge.setAttribute('stroke', `hsl(${hue}, ${saturation}%, 30%)`);
    edge.setAttribute('stroke-width', '0.5');
    group.appendChild(edge);

    return group;
  },

  /**
   * Create 3D cube shape
   */
  _createCube(hue, saturation, gradientId, sideGradId) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    // Top face
    const top = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    top.setAttribute('points', '12,3 20,7 12,11 4,7');
    top.setAttribute('fill', `hsl(${hue}, ${saturation}%, 70%)`);
    group.appendChild(top);

    // Left face
    const left = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    left.setAttribute('points', '4,7 12,11 12,21 4,17');
    left.setAttribute('fill', `url(#${gradientId})`);
    group.appendChild(left);

    // Right face
    const right = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    right.setAttribute('points', '20,7 12,11 12,21 20,17');
    right.setAttribute('fill', `url(#${sideGradId})`);
    group.appendChild(right);

    // Highlight on top
    const highlight = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    highlight.setAttribute('points', '10,5 14,5 12,7');
    highlight.setAttribute('fill', 'white');
    highlight.setAttribute('opacity', '0.4');
    highlight.classList.add('material-highlight');
    group.appendChild(highlight);

    // Edge lines
    const edges = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    edges.setAttribute('stroke', `hsl(${hue}, ${saturation}%, 25%)`);
    edges.setAttribute('stroke-width', '0.3');
    edges.setAttribute('fill', 'none');

    const edge1 = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    edge1.setAttribute('points', '4,7 12,11 20,7');
    edges.appendChild(edge1);

    const edge2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    edge2.setAttribute('x1', '12');
    edge2.setAttribute('y1', '11');
    edge2.setAttribute('x2', '12');
    edge2.setAttribute('y2', '21');
    edges.appendChild(edge2);

    group.appendChild(edges);

    return group;
  },

  /**
   * Create hexagon shape
   */
  _createHexagon(hue, saturation, gradientId, sideGradId) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    // Main hexagon
    const hex = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    hex.setAttribute('points', '12,3 20,7 20,15 12,19 4,15 4,7');
    hex.setAttribute('fill', `url(#${gradientId})`);
    hex.setAttribute('stroke', `hsl(${hue}, ${saturation}%, 30%)`);
    hex.setAttribute('stroke-width', '0.5');
    group.appendChild(hex);

    // Inner hexagon for depth
    const inner = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    inner.setAttribute('points', '12,6 16,8 16,14 12,16 8,14 8,8');
    inner.setAttribute('fill', `hsl(${hue}, ${saturation}%, 55%)`);
    inner.setAttribute('stroke', `hsl(${hue}, ${saturation}%, 40%)`);
    inner.setAttribute('stroke-width', '0.3');
    group.appendChild(inner);

    // Center highlight
    const highlight = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    highlight.setAttribute('points', '10,7 14,7 12,10');
    highlight.setAttribute('fill', 'white');
    highlight.setAttribute('opacity', '0.3');
    highlight.classList.add('material-highlight');
    group.appendChild(highlight);

    return group;
  },

  /**
   * Create nugget shape (irregular blob)
   */
  _createNugget(hue, saturation, gradientId) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    // Main blob shape
    const blob = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    blob.setAttribute('d', 'M12,4 Q18,5 20,10 Q21,15 17,18 Q12,21 8,18 Q3,15 4,10 Q5,5 12,4');
    blob.setAttribute('fill', `url(#${gradientId})`);
    blob.setAttribute('stroke', `hsl(${hue}, ${saturation}%, 30%)`);
    blob.setAttribute('stroke-width', '0.5');
    group.appendChild(blob);

    // Surface details
    const detail1 = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    detail1.setAttribute('cx', '10');
    detail1.setAttribute('cy', '12');
    detail1.setAttribute('rx', '3');
    detail1.setAttribute('ry', '2');
    detail1.setAttribute('fill', `hsl(${hue}, ${saturation}%, 45%)`);
    detail1.setAttribute('opacity', '0.5');
    group.appendChild(detail1);

    const detail2 = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    detail2.setAttribute('cx', '15');
    detail2.setAttribute('cy', '14');
    detail2.setAttribute('rx', '2');
    detail2.setAttribute('ry', '1.5');
    detail2.setAttribute('fill', `hsl(${hue}, ${saturation}%, 40%)`);
    detail2.setAttribute('opacity', '0.4');
    group.appendChild(detail2);

    // Highlight
    const highlight = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    highlight.setAttribute('cx', '9');
    highlight.setAttribute('cy', '7');
    highlight.setAttribute('rx', '3');
    highlight.setAttribute('ry', '2');
    highlight.setAttribute('fill', 'white');
    highlight.setAttribute('opacity', '0.3');
    highlight.classList.add('material-highlight');
    group.appendChild(highlight);

    return group;
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.MaterialShape = MaterialShape;
}
