/**
 * Scrap Siphon Shape Generator
 * Creates a trophy-like icon with a pile of multicolored scrap metal (copper, steel, silver)
 * as the base, topped with 3 interlocking golden gears that animate/rotate together.
 */

const ScrapSiphonShape = {
  /**
   * Generate a scrap siphon SVG element
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
    svg.classList.add('resource-icon', 'scrap-siphon-icon');

    // Create definitions
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const uniqueId = Math.random().toString(36).substr(2, 9);

    // Gold gradient for gears
    const goldGradientId = `scrap-gold-${uniqueId}`;
    const goldGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    goldGradient.setAttribute('id', goldGradientId);
    goldGradient.setAttribute('x1', '0%');
    goldGradient.setAttribute('y1', '0%');
    goldGradient.setAttribute('x2', '100%');
    goldGradient.setAttribute('y2', '100%');

    const goldStops = [
      { offset: '0%', color: '#FFD700' },    // Bright gold
      { offset: '25%', color: '#FFC125' },   // Golden yellow
      { offset: '50%', color: '#DAA520' },   // Goldenrod
      { offset: '75%', color: '#B8860B' },   // Dark goldenrod
      { offset: '100%', color: '#CD853F' }   // Peru (darker gold edge)
    ];

    goldStops.forEach(stop => {
      const stopEl = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stopEl.setAttribute('offset', stop.offset);
      stopEl.setAttribute('stop-color', stop.color);
      goldGradient.appendChild(stopEl);
    });
    defs.appendChild(goldGradient);

    // Gold highlight gradient (for 3D effect on gears)
    const goldHighlightId = `scrap-gold-hi-${uniqueId}`;
    const goldHighlight = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    goldHighlight.setAttribute('id', goldHighlightId);
    goldHighlight.setAttribute('x1', '0%');
    goldHighlight.setAttribute('y1', '0%');
    goldHighlight.setAttribute('x2', '0%');
    goldHighlight.setAttribute('y2', '100%');

    [
      { offset: '0%', color: '#FFFACD' },   // Lemon chiffon (bright highlight)
      { offset: '40%', color: '#FFD700' },  // Gold
      { offset: '100%', color: '#B8860B' }  // Dark goldenrod
    ].forEach(stop => {
      const stopEl = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stopEl.setAttribute('offset', stop.offset);
      stopEl.setAttribute('stop-color', stop.color);
      goldHighlight.appendChild(stopEl);
    });
    defs.appendChild(goldHighlight);

    // Golden glow filter
    const glowFilterId = `scrap-glow-${uniqueId}`;
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
    colorMatrix.setAttribute('values', '1 0.8 0 0 0  0.8 0.6 0 0 0  0 0 0.2 0 0  0 0 0 1 0');
    colorMatrix.setAttribute('result', 'goldGlow');

    const merge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
    const mergeNode1 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
    mergeNode1.setAttribute('in', 'goldGlow');
    const mergeNode2 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
    mergeNode2.setAttribute('in', 'SourceGraphic');
    merge.appendChild(mergeNode1);
    merge.appendChild(mergeNode2);

    glowFilter.appendChild(blur);
    glowFilter.appendChild(colorMatrix);
    glowFilter.appendChild(merge);
    defs.appendChild(glowFilter);

    svg.appendChild(defs);

    // === SCRAP PILE BASE ===
    const scrapPile = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    scrapPile.classList.add('scrap-pile');

    // Scrap colors
    const copper = '#B87333';
    const steel = '#71797E';
    const silver = '#C0C0C0';
    const bronze = '#CD7F32';
    const darkSteel = '#4A4A4A';

    // Create irregular scrap pile shapes (bottom layer)
    const scrapPieces = [
      // Large base pieces
      { type: 'rect', x: 3, y: 18, w: 4, h: 2.5, color: steel, rotation: -15 },
      { type: 'rect', x: 8, y: 19, w: 5, h: 2, color: darkSteel, rotation: 5 },
      { type: 'rect', x: 15, y: 18, w: 4, h: 2.5, color: copper, rotation: 12 },
      // Middle layer
      { type: 'rect', x: 5, y: 16, w: 3, h: 2, color: copper, rotation: -25 },
      { type: 'rect', x: 10, y: 17, w: 4, h: 1.5, color: silver, rotation: 8 },
      { type: 'rect', x: 14, y: 16, w: 3, h: 2, color: bronze, rotation: 20 },
      // Top layer (smaller pieces)
      { type: 'rect', x: 7, y: 15, w: 2.5, h: 1.5, color: silver, rotation: -10 },
      { type: 'rect', x: 11, y: 15.5, w: 2, h: 1, color: steel, rotation: 15 },
      { type: 'rect', x: 14, y: 15, w: 2, h: 1.5, color: copper, rotation: -5 },
      // Accent pieces
      { type: 'circle', cx: 6, cy: 17.5, r: 1.2, color: bronze },
      { type: 'circle', cx: 16, cy: 17, r: 1, color: silver },
      { type: 'polygon', points: '9,16 10,14.5 11,16', color: copper }, // Triangle scrap
      { type: 'polygon', points: '13,16 14.5,15 15,16.5', color: steel } // Triangle scrap
    ];

    scrapPieces.forEach(piece => {
      let el;
      if (piece.type === 'rect') {
        el = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        el.setAttribute('x', piece.x);
        el.setAttribute('y', piece.y);
        el.setAttribute('width', piece.w);
        el.setAttribute('height', piece.h);
        el.setAttribute('rx', '0.3');
        if (piece.rotation) {
          const cx = piece.x + piece.w / 2;
          const cy = piece.y + piece.h / 2;
          el.setAttribute('transform', `rotate(${piece.rotation} ${cx} ${cy})`);
        }
      } else if (piece.type === 'circle') {
        el = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        el.setAttribute('cx', piece.cx);
        el.setAttribute('cy', piece.cy);
        el.setAttribute('r', piece.r);
      } else if (piece.type === 'polygon') {
        el = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        el.setAttribute('points', piece.points);
      }
      el.setAttribute('fill', piece.color);
      el.setAttribute('stroke', '#333');
      el.setAttribute('stroke-width', '0.2');
      scrapPile.appendChild(el);
    });

    svg.appendChild(scrapPile);

    // === GOLDEN GEARS (TROPHY TOP) ===
    const gearsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gearsGroup.setAttribute('filter', `url(#${glowFilterId})`);
    gearsGroup.classList.add('scrap-gears');

    // Central large gear (main gear)
    const mainGear = this._createGear(12, 9, 4.5, 8, `url(#${goldHighlightId})`, '#B8860B', uniqueId + '-main');
    mainGear.classList.add('scrap-gear-main');
    gearsGroup.appendChild(mainGear);

    // Left smaller gear (meshes with main)
    const leftGear = this._createGear(6.5, 10, 2.8, 6, `url(#${goldGradientId})`, '#CD853F', uniqueId + '-left');
    leftGear.classList.add('scrap-gear-left');
    gearsGroup.appendChild(leftGear);

    // Right smaller gear (meshes with main)
    const rightGear = this._createGear(17.5, 10, 2.8, 6, `url(#${goldGradientId})`, '#CD853F', uniqueId + '-right');
    rightGear.classList.add('scrap-gear-right');
    gearsGroup.appendChild(rightGear);

    // Gear center caps (3D effect)
    const caps = [
      { cx: 12, cy: 9, r: 1.8 },
      { cx: 6.5, cy: 10, r: 1.1 },
      { cx: 17.5, cy: 10, r: 1.1 }
    ];

    caps.forEach((cap, i) => {
      const capEl = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      capEl.setAttribute('cx', cap.cx);
      capEl.setAttribute('cy', cap.cy);
      capEl.setAttribute('r', cap.r);
      capEl.setAttribute('fill', i === 0 ? '#FFD700' : '#FFC125');
      capEl.setAttribute('stroke', '#B8860B');
      capEl.setAttribute('stroke-width', '0.3');

      // Add inner highlight for 3D effect
      const highlight = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      highlight.setAttribute('cx', cap.cx - cap.r * 0.2);
      highlight.setAttribute('cy', cap.cy - cap.r * 0.2);
      highlight.setAttribute('r', cap.r * 0.4);
      highlight.setAttribute('fill', '#FFFACD');
      highlight.setAttribute('opacity', '0.6');

      gearsGroup.appendChild(capEl);
      gearsGroup.appendChild(highlight);
    });

    svg.appendChild(gearsGroup);

    // === SPARKLE EFFECTS ===
    const sparkles = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    sparkles.classList.add('scrap-sparkles');

    const sparklePositions = [
      { x: 12, y: 5, delay: 0 },
      { x: 8, y: 8, delay: 0.4 },
      { x: 16, y: 7, delay: 0.8 },
      { x: 5, y: 11, delay: 1.2 },
      { x: 19, y: 11, delay: 1.6 }
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
   * Create a gear shape
   * @private
   */
  _createGear(cx, cy, outerRadius, teeth, fill, stroke, id) {
    const gear = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gear.setAttribute('transform-origin', `${cx} ${cy}`);

    const innerRadius = outerRadius * 0.7;
    const toothDepth = outerRadius * 0.25;
    const toothWidth = (2 * Math.PI) / teeth * 0.4;

    let pathData = '';

    for (let i = 0; i < teeth; i++) {
      const angle = (i / teeth) * 2 * Math.PI - Math.PI / 2;
      const nextAngle = ((i + 1) / teeth) * 2 * Math.PI - Math.PI / 2;

      // Outer tooth point
      const outerX1 = cx + Math.cos(angle - toothWidth / 2) * (outerRadius + toothDepth);
      const outerY1 = cy + Math.sin(angle - toothWidth / 2) * (outerRadius + toothDepth);
      const outerX2 = cx + Math.cos(angle + toothWidth / 2) * (outerRadius + toothDepth);
      const outerY2 = cy + Math.sin(angle + toothWidth / 2) * (outerRadius + toothDepth);

      // Inner points (between teeth)
      const innerX1 = cx + Math.cos(angle + toothWidth) * innerRadius;
      const innerY1 = cy + Math.sin(angle + toothWidth) * innerRadius;
      const innerX2 = cx + Math.cos(nextAngle - toothWidth) * innerRadius;
      const innerY2 = cy + Math.sin(nextAngle - toothWidth) * innerRadius;

      // Connection points on the outer radius
      const connX1 = cx + Math.cos(angle - toothWidth) * outerRadius;
      const connY1 = cy + Math.sin(angle - toothWidth) * outerRadius;
      const connX2 = cx + Math.cos(angle + toothWidth) * outerRadius;
      const connY2 = cy + Math.sin(angle + toothWidth) * outerRadius;

      if (i === 0) {
        pathData += `M ${connX1.toFixed(2)} ${connY1.toFixed(2)} `;
      }

      // Draw tooth
      pathData += `L ${outerX1.toFixed(2)} ${outerY1.toFixed(2)} `;
      pathData += `L ${outerX2.toFixed(2)} ${outerY2.toFixed(2)} `;
      pathData += `L ${connX2.toFixed(2)} ${connY2.toFixed(2)} `;

      // Draw valley
      pathData += `L ${innerX1.toFixed(2)} ${innerY1.toFixed(2)} `;
      pathData += `L ${innerX2.toFixed(2)} ${innerY2.toFixed(2)} `;
    }

    pathData += 'Z';

    const gearPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    gearPath.setAttribute('d', pathData);
    gearPath.setAttribute('fill', fill);
    gearPath.setAttribute('stroke', stroke);
    gearPath.setAttribute('stroke-width', '0.4');

    gear.appendChild(gearPath);

    // Inner circle (hub)
    const hub = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    hub.setAttribute('cx', cx);
    hub.setAttribute('cy', cy);
    hub.setAttribute('r', innerRadius * 0.5);
    hub.setAttribute('fill', 'none');
    hub.setAttribute('stroke', stroke);
    hub.setAttribute('stroke-width', '0.3');
    gear.appendChild(hub);

    return gear;
  },

  /**
   * Create a sparkle/shine effect
   * @private
   */
  _createSparkle(x, y) {
    const sparkle = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    sparkle.classList.add('scrap-sparkle');
    sparkle.setAttribute('transform', `translate(${x}, ${y})`);

    // 4-pointed star sparkle
    const star = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    star.setAttribute('d', 'M0,-1.5 L0.3,0 L0,1.5 L-0.3,0 Z M-1.5,0 L0,-0.3 L1.5,0 L0,0.3 Z');
    star.setAttribute('fill', '#FFFACD');
    star.setAttribute('opacity', '0.9');
    sparkle.appendChild(star);

    return sparkle;
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.ScrapSiphonShape = ScrapSiphonShape;
}
