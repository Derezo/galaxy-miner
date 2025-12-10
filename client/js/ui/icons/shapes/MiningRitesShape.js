/**
 * Mining Rites Shape Generator
 * Creates a dual-claw obsidian pickaxe icon blessed by the Rogue Foremen.
 * Two curved prongs with glowing amethyst inlays and purple energy effects.
 */

const MiningRitesShape = {
  /**
   * Generate a mining rites SVG element
   * @param {Object} config - Shape configuration
   * @param {number} config.size - Icon size in pixels
   * @param {number} config.glowIntensity - Glow strength (0-1)
   * @returns {SVGElement}
   */
  create(config) {
    const {
      size = 32,
      glowIntensity = 0.7
    } = config;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.classList.add('resource-icon', 'mining-rites-icon');

    // Create definitions
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const uniqueId = Math.random().toString(36).substr(2, 9);

    // Obsidian gradient (black with grey shine)
    const obsidianGradientId = `obsidian-${uniqueId}`;
    const obsidianGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    obsidianGradient.setAttribute('id', obsidianGradientId);
    obsidianGradient.setAttribute('x1', '0%');
    obsidianGradient.setAttribute('y1', '0%');
    obsidianGradient.setAttribute('x2', '100%');
    obsidianGradient.setAttribute('y2', '100%');

    [
      { offset: '0%', color: '#1a1a1a' },
      { offset: '25%', color: '#2d2d2d' },
      { offset: '50%', color: '#404040' },
      { offset: '75%', color: '#2d2d2d' },
      { offset: '100%', color: '#1a1a1a' }
    ].forEach(stop => {
      const stopEl = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stopEl.setAttribute('offset', stop.offset);
      stopEl.setAttribute('stop-color', stop.color);
      obsidianGradient.appendChild(stopEl);
    });
    defs.appendChild(obsidianGradient);

    // Amethyst gradient for inlays
    const amethystGradientId = `amethyst-${uniqueId}`;
    const amethystGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    amethystGradient.setAttribute('id', amethystGradientId);
    amethystGradient.setAttribute('x1', '0%');
    amethystGradient.setAttribute('y1', '0%');
    amethystGradient.setAttribute('x2', '100%');
    amethystGradient.setAttribute('y2', '100%');

    [
      { offset: '0%', color: '#e0b0ff' },
      { offset: '30%', color: '#9b59b6' },
      { offset: '60%', color: '#8e44ad' },
      { offset: '100%', color: '#6c3483' }
    ].forEach(stop => {
      const stopEl = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stopEl.setAttribute('offset', stop.offset);
      stopEl.setAttribute('stop-color', stop.color);
      amethystGradient.appendChild(stopEl);
    });
    defs.appendChild(amethystGradient);

    // Purple glow filter for amethyst parts
    const glowFilterId = `mining-glow-${uniqueId}`;
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
    colorMatrix.setAttribute('in', 'glow');
    colorMatrix.setAttribute('type', 'matrix');
    colorMatrix.setAttribute('values', '0.6 0 0.8 0 0  0 0.3 0.6 0 0  0.8 0 1 0 0  0 0 0 1 0');
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

    // === HANDLE (OBSIDIAN SHAFT) ===
    // Slightly tilted handle (~20 degrees from vertical)
    const handleGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    handleGroup.classList.add('mining-handle');

    const handle = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    // Handle runs from bottom center upward with slight tilt
    handle.setAttribute('d', 'M10.5,22 L13.5,22 L13,11 L11,11 Z');
    handle.setAttribute('fill', `url(#${obsidianGradientId})`);
    handle.setAttribute('stroke', '#111');
    handle.setAttribute('stroke-width', '0.3');
    handleGroup.appendChild(handle);

    // Grip bands on handle
    const gripPositions = [
      { x1: 10.8, y1: 20, x2: 13.2, y2: 20 },
      { x1: 10.9, y1: 18, x2: 13.1, y2: 18 },
      { x1: 11, y1: 16, x2: 13, y2: 16 },
      { x1: 11, y1: 14, x2: 13, y2: 14 }
    ];

    gripPositions.forEach(pos => {
      const grip = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      grip.setAttribute('x1', pos.x1);
      grip.setAttribute('y1', pos.y1);
      grip.setAttribute('x2', pos.x2);
      grip.setAttribute('y2', pos.y2);
      grip.setAttribute('stroke', '#2a2a2a');
      grip.setAttribute('stroke-width', '0.6');
      grip.setAttribute('stroke-linecap', 'round');
      handleGroup.appendChild(grip);
    });

    svg.appendChild(handleGroup);

    // === COLLAR (Where prongs meet handle) ===
    const collarGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    collarGroup.classList.add('mining-collar');

    const collar = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    collar.setAttribute('d', 'M9,11 L15,11 L14.5,9 L9.5,9 Z');
    collar.setAttribute('fill', `url(#${obsidianGradientId})`);
    collar.setAttribute('stroke', '#111');
    collar.setAttribute('stroke-width', '0.3');
    collarGroup.appendChild(collar);

    // Central amethyst gem in collar
    const centralGemGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    centralGemGroup.setAttribute('filter', `url(#${glowFilterId})`);

    const centralGem = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    centralGem.setAttribute('d', 'M11,10.5 L12,9.5 L13,10.5 L12,11.5 Z');
    centralGem.setAttribute('fill', `url(#${amethystGradientId})`);
    centralGem.setAttribute('stroke', '#6c3483');
    centralGem.setAttribute('stroke-width', '0.3');
    centralGemGroup.appendChild(centralGem);
    collarGroup.appendChild(centralGemGroup);

    svg.appendChild(collarGroup);

    // === DUAL CURVED PRONGS (CLAWS) ===
    const prongsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    prongsGroup.classList.add('mining-prongs');

    // Left prong - curved claw sweeping up and left
    const leftProng = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    leftProng.setAttribute('d', `
      M9.5,9
      L8,8
      C6,6.5 4.5,5 3,3
      L4,2
      C5.5,3.5 7,5.5 9,7.5
      L10,8.5
      Z
    `);
    leftProng.setAttribute('fill', `url(#${obsidianGradientId})`);
    leftProng.setAttribute('stroke', '#111');
    leftProng.setAttribute('stroke-width', '0.4');
    prongsGroup.appendChild(leftProng);

    // Right prong - curved claw sweeping up and right
    const rightProng = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    rightProng.setAttribute('d', `
      M14.5,9
      L16,8
      C18,6.5 19.5,5 21,3
      L20,2
      C18.5,3.5 17,5.5 15,7.5
      L14,8.5
      Z
    `);
    rightProng.setAttribute('fill', `url(#${obsidianGradientId})`);
    rightProng.setAttribute('stroke', '#111');
    rightProng.setAttribute('stroke-width', '0.4');
    prongsGroup.appendChild(rightProng);

    // Sharp tips with purple energy glow
    const tipsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    tipsGroup.setAttribute('filter', `url(#${glowFilterId})`);

    // Left tip
    const leftTip = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    leftTip.setAttribute('d', 'M3,3 L2,1.5 L4,2 Z');
    leftTip.setAttribute('fill', '#9b59b6');
    leftTip.setAttribute('stroke', '#6c3483');
    leftTip.setAttribute('stroke-width', '0.3');
    tipsGroup.appendChild(leftTip);

    // Right tip
    const rightTip = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    rightTip.setAttribute('d', 'M21,3 L22,1.5 L20,2 Z');
    rightTip.setAttribute('fill', '#9b59b6');
    rightTip.setAttribute('stroke', '#6c3483');
    rightTip.setAttribute('stroke-width', '0.3');
    tipsGroup.appendChild(rightTip);

    prongsGroup.appendChild(tipsGroup);

    // === AMETHYST INLAYS ON PRONGS ===
    const inlaysGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    inlaysGroup.setAttribute('filter', `url(#${glowFilterId})`);
    inlaysGroup.classList.add('mining-inlays');

    // Left prong amethyst vein
    const leftInlay = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    leftInlay.setAttribute('d', 'M8,8 C6.5,6.5 5.5,5.5 4.5,4');
    leftInlay.setAttribute('stroke', `url(#${amethystGradientId})`);
    leftInlay.setAttribute('stroke-width', '1.2');
    leftInlay.setAttribute('fill', 'none');
    leftInlay.setAttribute('stroke-linecap', 'round');
    inlaysGroup.appendChild(leftInlay);

    // Right prong amethyst vein
    const rightInlay = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    rightInlay.setAttribute('d', 'M16,8 C17.5,6.5 18.5,5.5 19.5,4');
    rightInlay.setAttribute('stroke', `url(#${amethystGradientId})`);
    rightInlay.setAttribute('stroke-width', '1.2');
    rightInlay.setAttribute('fill', 'none');
    rightInlay.setAttribute('stroke-linecap', 'round');
    inlaysGroup.appendChild(rightInlay);

    // Small gem on each prong
    const leftGem = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    leftGem.setAttribute('cx', '6');
    leftGem.setAttribute('cy', '6');
    leftGem.setAttribute('r', '0.8');
    leftGem.setAttribute('fill', '#e0b0ff');
    inlaysGroup.appendChild(leftGem);

    const rightGem = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    rightGem.setAttribute('cx', '18');
    rightGem.setAttribute('cy', '6');
    rightGem.setAttribute('r', '0.8');
    rightGem.setAttribute('fill', '#e0b0ff');
    inlaysGroup.appendChild(rightGem);

    prongsGroup.appendChild(inlaysGroup);
    svg.appendChild(prongsGroup);

    // === SPARKLE EFFECTS ===
    const sparkles = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    sparkles.classList.add('mining-rites-sparkles');

    const sparklePositions = [
      { x: 2.5, y: 2, delay: 0 },      // Left tip
      { x: 21.5, y: 2, delay: 0.5 },   // Right tip
      { x: 12, y: 10, delay: 1.0 },    // Central gem
      { x: 6, y: 6, delay: 1.5 }       // Left gem
    ];

    sparklePositions.forEach(pos => {
      const sparkle = this._createSparkle(pos.x, pos.y);
      sparkle.style.animationDelay = `${pos.delay}s`;
      sparkles.appendChild(sparkle);
    });

    svg.appendChild(sparkles);

    return svg;
  },

  /**
   * Create a sparkle/shine effect
   * @private
   */
  _createSparkle(x, y) {
    const sparkle = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    sparkle.classList.add('mining-rites-sparkle');
    sparkle.setAttribute('transform', `translate(${x}, ${y})`);

    // 4-pointed star sparkle
    const star = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    star.setAttribute('d', 'M0,-1 L0.15,0 L0,1 L-0.15,0 Z M-1,0 L0,-0.15 L1,0 L0,0.15 Z');
    star.setAttribute('fill', '#e0b0ff');
    star.setAttribute('opacity', '0.9');
    sparkle.appendChild(star);

    return sparkle;
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.MiningRitesShape = MiningRitesShape;
}
