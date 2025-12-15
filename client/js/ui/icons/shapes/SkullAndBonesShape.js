/**
 * Skull and Bones Shape Generator
 * Creates a black pirate flag with white skull and crossbones, waving in the wind.
 * This is a custom icon for the Skull and Bones relic.
 */

const SkullAndBonesShape = {
  /**
   * Generate a skull and bones flag SVG element
   * @param {Object} config - Shape configuration
   * @param {number} config.size - Icon size in pixels
   * @param {number} config.glowIntensity - Glow strength (0-1)
   * @returns {SVGElement}
   */
  create(config) {
    const {
      size = 32,
      glowIntensity = 0.6
    } = config;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.classList.add('resource-icon', 'skull-and-bones-icon');

    // Create definitions
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const uniqueId = Math.random().toString(36).substr(2, 9);

    // Dark glow filter for ominous effect
    const glowFilterId = `skull-glow-${uniqueId}`;
    const glowFilter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    glowFilter.setAttribute('id', glowFilterId);
    glowFilter.setAttribute('x', '-50%');
    glowFilter.setAttribute('y', '-50%');
    glowFilter.setAttribute('width', '200%');
    glowFilter.setAttribute('height', '200%');

    const blur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
    blur.setAttribute('stdDeviation', String(1.5 * glowIntensity));
    blur.setAttribute('result', 'glow');

    const colorMatrix = document.createElementNS('http://www.w3.org/2000/svg', 'feColorMatrix');
    colorMatrix.setAttribute('type', 'matrix');
    colorMatrix.setAttribute('values', '0.3 0 0 0 0  0 0.3 0 0 0  0 0 0.3 0 0  0 0 0 1 0');
    colorMatrix.setAttribute('in', 'glow');
    colorMatrix.setAttribute('result', 'darkGlow');

    const merge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
    const mergeNode1 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
    mergeNode1.setAttribute('in', 'darkGlow');
    const mergeNode2 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
    mergeNode2.setAttribute('in', 'SourceGraphic');
    merge.appendChild(mergeNode1);
    merge.appendChild(mergeNode2);

    glowFilter.appendChild(blur);
    glowFilter.appendChild(colorMatrix);
    glowFilter.appendChild(merge);
    defs.appendChild(glowFilter);

    // Flag gradient (subtle dark texture)
    const flagGradientId = `flag-grad-${uniqueId}`;
    const flagGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    flagGradient.setAttribute('id', flagGradientId);
    flagGradient.setAttribute('x1', '0%');
    flagGradient.setAttribute('y1', '0%');
    flagGradient.setAttribute('x2', '100%');
    flagGradient.setAttribute('y2', '100%');

    const flagStops = [
      { offset: '0%', color: '#1a1a1a' },
      { offset: '50%', color: '#0d0d0d' },
      { offset: '100%', color: '#1a1a1a' }
    ];

    flagStops.forEach(stop => {
      const stopEl = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stopEl.setAttribute('offset', stop.offset);
      stopEl.setAttribute('stop-color', stop.color);
      flagGradient.appendChild(stopEl);
    });
    defs.appendChild(flagGradient);

    svg.appendChild(defs);

    // Main group with filter
    const mainGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    mainGroup.setAttribute('filter', `url(#${glowFilterId})`);

    // Flag pole (left side)
    const pole = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    pole.setAttribute('x', '2');
    pole.setAttribute('y', '2');
    pole.setAttribute('width', '1.5');
    pole.setAttribute('height', '20');
    pole.setAttribute('fill', '#8B7355');
    pole.setAttribute('rx', '0.5');
    mainGroup.appendChild(pole);

    // Rope ties (gold bands)
    const rope1 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rope1.setAttribute('x', '1.5');
    rope1.setAttribute('y', '4');
    rope1.setAttribute('width', '2.5');
    rope1.setAttribute('height', '1');
    rope1.setAttribute('fill', '#D4A017');
    rope1.setAttribute('rx', '0.3');
    mainGroup.appendChild(rope1);

    const rope2 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rope2.setAttribute('x', '1.5');
    rope2.setAttribute('y', '16');
    rope2.setAttribute('width', '2.5');
    rope2.setAttribute('height', '1');
    rope2.setAttribute('fill', '#D4A017');
    rope2.setAttribute('rx', '0.3');
    mainGroup.appendChild(rope2);

    // Flag body with wave animation
    const flagGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    flagGroup.classList.add('pirate-flag-wave');

    // Flag shape (wavy rectangle)
    const flag = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    flag.setAttribute('d', this._createWavyFlagPath());
    flag.setAttribute('fill', `url(#${flagGradientId})`);
    flag.setAttribute('stroke', '#333333');
    flag.setAttribute('stroke-width', '0.3');
    flagGroup.appendChild(flag);

    // Skull
    const skullGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    skullGroup.setAttribute('fill', '#ffffff');

    // Skull head (rounded rectangle/ellipse shape)
    const skullHead = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    skullHead.setAttribute('cx', '13');
    skullHead.setAttribute('cy', '8');
    skullHead.setAttribute('rx', '4');
    skullHead.setAttribute('ry', '3.5');
    skullGroup.appendChild(skullHead);

    // Skull jaw
    const jaw = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    jaw.setAttribute('d', 'M10,10 Q10,12 11,12 L15,12 Q16,12 16,10');
    jaw.setAttribute('fill', '#ffffff');
    skullGroup.appendChild(jaw);

    // Left eye socket
    const leftEye = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    leftEye.setAttribute('cx', '11');
    leftEye.setAttribute('cy', '7.5');
    leftEye.setAttribute('rx', '1.2');
    leftEye.setAttribute('ry', '1.5');
    leftEye.setAttribute('fill', '#0d0d0d');
    skullGroup.appendChild(leftEye);

    // Right eye socket (with eye patch)
    const eyePatch = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    // Eye patch strap
    const strap = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    strap.setAttribute('x1', '9');
    strap.setAttribute('y1', '5');
    strap.setAttribute('x2', '17');
    strap.setAttribute('y2', '8');
    strap.setAttribute('stroke', '#333333');
    strap.setAttribute('stroke-width', '0.8');
    eyePatch.appendChild(strap);

    // Eye patch cover
    const patchCover = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    patchCover.setAttribute('cx', '15');
    patchCover.setAttribute('cy', '7.5');
    patchCover.setAttribute('rx', '1.4');
    patchCover.setAttribute('ry', '1.6');
    patchCover.setAttribute('fill', '#333333');
    eyePatch.appendChild(patchCover);

    skullGroup.appendChild(eyePatch);

    // Nose hole
    const nose = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    nose.setAttribute('d', 'M12.5,9 L13,10 L13.5,9 Z');
    nose.setAttribute('fill', '#0d0d0d');
    skullGroup.appendChild(nose);

    // Teeth
    const teeth = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    teeth.setAttribute('fill', '#ffffff');
    teeth.setAttribute('stroke', '#999999');
    teeth.setAttribute('stroke-width', '0.2');

    for (let i = 0; i < 5; i++) {
      const tooth = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      tooth.setAttribute('x', String(10.5 + i * 1.1));
      tooth.setAttribute('y', '10.5');
      tooth.setAttribute('width', '0.9');
      tooth.setAttribute('height', '1.5');
      tooth.setAttribute('rx', '0.2');
      teeth.appendChild(tooth);
    }
    skullGroup.appendChild(teeth);

    flagGroup.appendChild(skullGroup);

    // Crossbones
    const bonesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    bonesGroup.setAttribute('stroke', '#ffffff');
    bonesGroup.setAttribute('stroke-width', '1.8');
    bonesGroup.setAttribute('stroke-linecap', 'round');
    bonesGroup.setAttribute('fill', 'none');

    // First bone (top-left to bottom-right)
    const bone1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    bone1.setAttribute('x1', '8');
    bone1.setAttribute('y1', '14');
    bone1.setAttribute('x2', '18');
    bone1.setAttribute('y2', '19');
    bonesGroup.appendChild(bone1);

    // Bone 1 knobs
    const knob1a = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    knob1a.setAttribute('cx', '7.5');
    knob1a.setAttribute('cy', '13.5');
    knob1a.setAttribute('r', '1');
    knob1a.setAttribute('fill', '#ffffff');
    knob1a.setAttribute('stroke', 'none');
    bonesGroup.appendChild(knob1a);

    const knob1b = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    knob1b.setAttribute('cx', '18.5');
    knob1b.setAttribute('cy', '19.5');
    knob1b.setAttribute('r', '1');
    knob1b.setAttribute('fill', '#ffffff');
    knob1b.setAttribute('stroke', 'none');
    bonesGroup.appendChild(knob1b);

    // Second bone (bottom-left to top-right)
    const bone2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    bone2.setAttribute('x1', '8');
    bone2.setAttribute('y1', '19');
    bone2.setAttribute('x2', '18');
    bone2.setAttribute('y2', '14');
    bonesGroup.appendChild(bone2);

    // Bone 2 knobs
    const knob2a = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    knob2a.setAttribute('cx', '7.5');
    knob2a.setAttribute('cy', '19.5');
    knob2a.setAttribute('r', '1');
    knob2a.setAttribute('fill', '#ffffff');
    knob2a.setAttribute('stroke', 'none');
    bonesGroup.appendChild(knob2a);

    const knob2b = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    knob2b.setAttribute('cx', '18.5');
    knob2b.setAttribute('cy', '13.5');
    knob2b.setAttribute('r', '1');
    knob2b.setAttribute('fill', '#ffffff');
    knob2b.setAttribute('stroke', 'none');
    bonesGroup.appendChild(knob2b);

    flagGroup.appendChild(bonesGroup);

    mainGroup.appendChild(flagGroup);
    svg.appendChild(mainGroup);

    return svg;
  },

  /**
   * Create a wavy flag path
   * @private
   */
  _createWavyFlagPath() {
    // Flag attached at pole (x=4) and waves to the right
    // Top edge with wave
    // Bottom edge with wave (slightly different phase)
    return `
      M 4,4
      C 8,3 12,5 16,4
      C 18,3.5 20,4 21,4.5
      L 21,17.5
      C 20,18 18,17.5 16,18
      C 12,19 8,17 4,18
      Z
    `.trim().replace(/\s+/g, ' ');
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.SkullAndBonesShape = SkullAndBonesShape;
}
