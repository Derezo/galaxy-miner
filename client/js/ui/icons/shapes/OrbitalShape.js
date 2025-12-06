/**
 * Orbital Shape Generator
 * Creates atomic/orbital SVG shapes for gas and liquid-type resources.
 * Features electron rings, nucleus glow, and spin animations.
 */

const OrbitalShape = {
  /**
   * Generate an orbital SVG element
   * @param {Object} config - Shape configuration
   * @param {number} config.size - Icon size in pixels
   * @param {number} config.hue - Base hue (0-360)
   * @param {number} config.saturation - Color saturation (0-100)
   * @param {number} config.rings - Number of orbital rings (1-3)
   * @param {number} config.electrons - Electrons per ring (1-4)
   * @param {number} config.glowIntensity - Glow strength (0-1)
   * @param {string} config.variant - Shape variant: 'atom', 'molecule', 'cloud'
   * @returns {SVGElement}
   */
  create(config) {
    const {
      size = 24,
      hue = 180,
      saturation = 60,
      rings = 2,
      electrons = 2,
      glowIntensity = 0.5,
      variant = 'atom'
    } = config;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.classList.add('resource-icon', 'orbital-icon');

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

    // Radial gradient for nucleus
    const nucleusGradId = `nucleus-grad-${Math.random().toString(36).substr(2, 9)}`;
    const nucleusGrad = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
    nucleusGrad.setAttribute('id', nucleusGradId);

    const nStop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    nStop1.setAttribute('offset', '0%');
    nStop1.setAttribute('stop-color', `hsl(${hue}, ${saturation}%, 80%)`);

    const nStop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    nStop2.setAttribute('offset', '70%');
    nStop2.setAttribute('stop-color', `hsl(${hue}, ${saturation}%, 50%)`);

    const nStop3 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    nStop3.setAttribute('offset', '100%');
    nStop3.setAttribute('stop-color', `hsl(${hue}, ${saturation}%, 30%)`);

    nucleusGrad.appendChild(nStop1);
    nucleusGrad.appendChild(nStop2);
    nucleusGrad.appendChild(nStop3);
    defs.appendChild(nucleusGrad);

    // Glow filter
    if (glowIntensity > 0) {
      const filterId = `orbital-glow-${Math.random().toString(36).substr(2, 9)}`;
      const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
      filter.setAttribute('id', filterId);
      filter.setAttribute('x', '-50%');
      filter.setAttribute('y', '-50%');
      filter.setAttribute('width', '200%');
      filter.setAttribute('height', '200%');

      const blur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
      blur.setAttribute('stdDeviation', String(1.5 * glowIntensity));
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
      case 'molecule':
        content = this._createMolecule(hue, saturation, nucleusGradId);
        break;
      case 'cloud':
        content = this._createCloud(hue, saturation, nucleusGradId);
        break;
      case 'atom':
      default:
        content = this._createAtom(rings, electrons, hue, saturation, nucleusGradId);
    }

    // Apply filter if exists
    if (svg.dataset.filterId) {
      content.setAttribute('filter', `url(#${svg.dataset.filterId})`);
    }

    svg.appendChild(content);

    return svg;
  },

  /**
   * Create atom with orbital rings and electrons
   */
  _createAtom(rings, electrons, hue, saturation, nucleusGradId) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    // Orbital rings
    const ringAngles = [0, 60, -60];
    for (let i = 0; i < Math.min(rings, 3); i++) {
      const ring = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
      ring.setAttribute('cx', '12');
      ring.setAttribute('cy', '12');
      ring.setAttribute('rx', '9');
      ring.setAttribute('ry', '4');
      ring.setAttribute('fill', 'none');
      ring.setAttribute('stroke', `hsl(${hue}, ${saturation}%, 60%)`);
      ring.setAttribute('stroke-width', '0.5');
      ring.setAttribute('opacity', '0.7');
      ring.setAttribute('transform', `rotate(${ringAngles[i]} 12 12)`);
      ring.classList.add('orbital-ring');
      ring.style.setProperty('--ring-index', String(i));
      group.appendChild(ring);

      // Electrons on this ring
      const electronCount = Math.min(electrons, 4);
      for (let e = 0; e < electronCount; e++) {
        const electron = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        const angle = (e / electronCount) * 360 + (i * 30);
        const rad = angle * Math.PI / 180;
        const ex = 12 + Math.cos(rad) * 9;
        const ey = 12 + Math.sin(rad) * 4;

        electron.setAttribute('cx', String(ex));
        electron.setAttribute('cy', String(ey));
        electron.setAttribute('r', '1.5');
        electron.setAttribute('fill', `hsl(${(hue + 40) % 360}, ${saturation}%, 70%)`);
        electron.setAttribute('transform', `rotate(${ringAngles[i]} 12 12)`);
        electron.classList.add('orbital-electron');
        electron.style.setProperty('--electron-index', String(e + i * electronCount));
        group.appendChild(electron);
      }
    }

    // Nucleus
    const nucleus = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    nucleus.setAttribute('cx', '12');
    nucleus.setAttribute('cy', '12');
    nucleus.setAttribute('r', '3');
    nucleus.setAttribute('fill', `url(#${nucleusGradId})`);
    nucleus.classList.add('orbital-nucleus');
    group.appendChild(nucleus);

    // Nucleus highlight
    const highlight = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    highlight.setAttribute('cx', '11');
    highlight.setAttribute('cy', '11');
    highlight.setAttribute('r', '1');
    highlight.setAttribute('fill', 'white');
    highlight.setAttribute('opacity', '0.5');
    group.appendChild(highlight);

    return group;
  },

  /**
   * Create molecule shape (multiple bonded atoms)
   */
  _createMolecule(hue, saturation, nucleusGradId) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    // Bonds
    const bondColor = `hsl(${hue}, ${saturation}%, 50%)`;
    const bonds = [
      { x1: 8, y1: 12, x2: 16, y2: 12 },
      { x1: 12, y1: 8, x2: 12, y2: 16 }
    ];

    bonds.forEach(b => {
      const bond = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      bond.setAttribute('x1', String(b.x1));
      bond.setAttribute('y1', String(b.y1));
      bond.setAttribute('x2', String(b.x2));
      bond.setAttribute('y2', String(b.y2));
      bond.setAttribute('stroke', bondColor);
      bond.setAttribute('stroke-width', '2');
      bond.setAttribute('opacity', '0.6');
      group.appendChild(bond);
    });

    // Atoms
    const atoms = [
      { cx: 12, cy: 12, r: 4 },
      { cx: 6, cy: 12, r: 2.5 },
      { cx: 18, cy: 12, r: 2.5 },
      { cx: 12, cy: 6, r: 2.5 },
      { cx: 12, cy: 18, r: 2.5 }
    ];

    atoms.forEach((a, i) => {
      const atom = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      atom.setAttribute('cx', String(a.cx));
      atom.setAttribute('cy', String(a.cy));
      atom.setAttribute('r', String(a.r));
      atom.setAttribute('fill', `url(#${nucleusGradId})`);
      if (i > 0) {
        atom.setAttribute('opacity', '0.8');
      }
      atom.classList.add('molecule-atom');
      group.appendChild(atom);
    });

    return group;
  },

  /**
   * Create gas cloud shape
   */
  _createCloud(hue, saturation, nucleusGradId) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    // Multiple overlapping circles for cloud effect
    const bubbles = [
      { cx: 12, cy: 12, r: 6, opacity: 0.6 },
      { cx: 8, cy: 10, r: 4, opacity: 0.5 },
      { cx: 16, cy: 10, r: 4, opacity: 0.5 },
      { cx: 10, cy: 15, r: 3.5, opacity: 0.4 },
      { cx: 14, cy: 15, r: 3.5, opacity: 0.4 },
      { cx: 6, cy: 14, r: 2.5, opacity: 0.3 },
      { cx: 18, cy: 14, r: 2.5, opacity: 0.3 }
    ];

    bubbles.forEach((b, i) => {
      const bubble = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      bubble.setAttribute('cx', String(b.cx));
      bubble.setAttribute('cy', String(b.cy));
      bubble.setAttribute('r', String(b.r));
      bubble.setAttribute('fill', `hsl(${hue}, ${saturation}%, 60%)`);
      bubble.setAttribute('opacity', String(b.opacity));
      bubble.classList.add('cloud-bubble');
      bubble.style.setProperty('--bubble-index', String(i));
      group.appendChild(bubble);
    });

    // Highlight
    const highlight = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    highlight.setAttribute('cx', '10');
    highlight.setAttribute('cy', '9');
    highlight.setAttribute('r', '2');
    highlight.setAttribute('fill', 'white');
    highlight.setAttribute('opacity', '0.4');
    group.appendChild(highlight);

    return group;
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.OrbitalShape = OrbitalShape;
}
