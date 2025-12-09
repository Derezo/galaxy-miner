/**
 * IconCache - SVG to Canvas Image Caching
 * Converts SVG icons to Image objects for efficient canvas rendering.
 * Part of the notification system overhaul.
 */

const IconCache = {
  cache: new Map(),
  creditIcon: null,
  genericBuffIcon: null,
  genericComponentIcon: null,

  /**
   * Initialize the icon cache
   * Pre-renders commonly used icons
   */
  init() {
    this._createCreditIcon();
    this._createGenericBuffIcon();
    this._createGenericComponentIcon();
  },

  /**
   * Get a resource icon as an Image object
   * @param {string} resourceType - Resource type key (e.g., 'IRON', 'PLATINUM')
   * @param {number} size - Icon size in pixels
   * @returns {HTMLImageElement|null} Cached or new Image
   */
  getResourceIcon(resourceType, size = 32) {
    const key = `resource_${resourceType}_${size}`;

    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    // Create icon using IconFactory if available
    if (typeof IconFactory !== 'undefined') {
      try {
        const svg = IconFactory.createResourceIcon(resourceType, size);
        const img = this._svgToImage(svg);
        this.cache.set(key, img);
        return img;
      } catch (e) {
        Logger.warn(`Failed to create resource icon for ${resourceType}:`, e);
      }
    }

    return this._getFallbackIcon(size);
  },

  /**
   * Get a relic icon as an Image object
   * @param {string} relicType - Relic type key
   * @param {number} size - Icon size in pixels
   * @returns {HTMLImageElement|null} Cached or new Image
   */
  getRelicIcon(relicType, size = 32) {
    const key = `relic_${relicType}_${size}`;

    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    // Create icon using IconFactory if available
    if (typeof IconFactory !== 'undefined') {
      try {
        const svg = IconFactory.createRelicIcon(relicType, size);
        const img = this._svgToImage(svg);
        this.cache.set(key, img);
        return img;
      } catch (e) {
        Logger.warn(`Failed to create relic icon for ${relicType}:`, e);
      }
    }

    return this._getFallbackRelicIcon(size);
  },

  /**
   * Get the credit coin icon
   * @returns {HTMLImageElement} Credit icon image
   */
  getCreditIcon() {
    return this.creditIcon;
  },

  /**
   * Get the generic buff icon
   * @returns {HTMLImageElement} Buff icon image
   */
  getBuffIcon() {
    return this.genericBuffIcon;
  },

  /**
   * Get the generic component icon
   * @returns {HTMLImageElement} Component icon image
   */
  getComponentIcon() {
    return this.genericComponentIcon;
  },

  /**
   * Convert an SVG element to an Image object
   * @param {SVGElement} svg - SVG element to convert
   * @returns {HTMLImageElement} Image with SVG as data URL
   */
  _svgToImage(svg) {
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const img = new Image();
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)));
    return img;
  },

  /**
   * Create the standardized credit coin icon
   */
  _createCreditIcon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '32');
    svg.setAttribute('height', '32');
    svg.setAttribute('viewBox', '0 0 32 32');

    // Outer gold ring
    const outer = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    outer.setAttribute('cx', '16');
    outer.setAttribute('cy', '16');
    outer.setAttribute('r', '14');
    outer.setAttribute('fill', '#ffd700');
    outer.setAttribute('stroke', '#b8860b');
    outer.setAttribute('stroke-width', '2');
    svg.appendChild(outer);

    // Inner highlight
    const inner = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    inner.setAttribute('cx', '16');
    inner.setAttribute('cy', '16');
    inner.setAttribute('r', '10');
    inner.setAttribute('fill', '#ffec8b');
    svg.appendChild(inner);

    // Dollar sign
    const dollar = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    dollar.setAttribute('x', '16');
    dollar.setAttribute('y', '21');
    dollar.setAttribute('text-anchor', 'middle');
    dollar.setAttribute('fill', '#8b6914');
    dollar.setAttribute('font-size', '14');
    dollar.setAttribute('font-weight', 'bold');
    dollar.setAttribute('font-family', 'monospace');
    dollar.textContent = '$';
    svg.appendChild(dollar);

    this.creditIcon = this._svgToImage(svg);
  },

  /**
   * Create the generic buff icon (star shape)
   */
  _createGenericBuffIcon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '32');
    svg.setAttribute('height', '32');
    svg.setAttribute('viewBox', '0 0 32 32');

    // Star shape
    const star = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    star.setAttribute('points', '16,2 20,12 30,12 22,19 25,30 16,23 7,30 10,19 2,12 12,12');
    star.setAttribute('fill', '#00ffff');
    star.setAttribute('stroke', '#008b8b');
    star.setAttribute('stroke-width', '1');
    svg.appendChild(star);

    // Center glow
    const glow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    glow.setAttribute('cx', '16');
    glow.setAttribute('cy', '16');
    glow.setAttribute('r', '4');
    glow.setAttribute('fill', '#ffffff');
    glow.setAttribute('opacity', '0.8');
    svg.appendChild(glow);

    this.genericBuffIcon = this._svgToImage(svg);
  },

  /**
   * Create the generic component icon (hexagon shape)
   */
  _createGenericComponentIcon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '32');
    svg.setAttribute('height', '32');
    svg.setAttribute('viewBox', '0 0 32 32');

    // Hexagon shape
    const hex = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    hex.setAttribute('points', '16,2 28,9 28,23 16,30 4,23 4,9');
    hex.setAttribute('fill', '#4488ff');
    hex.setAttribute('stroke', '#2244aa');
    hex.setAttribute('stroke-width', '2');
    svg.appendChild(hex);

    // Inner detail
    const inner = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    inner.setAttribute('points', '16,8 22,12 22,20 16,24 10,20 10,12');
    inner.setAttribute('fill', '#6699ff');
    svg.appendChild(inner);

    // Center circle
    const center = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    center.setAttribute('cx', '16');
    center.setAttribute('cy', '16');
    center.setAttribute('r', '3');
    center.setAttribute('fill', '#aaccff');
    svg.appendChild(center);

    this.genericComponentIcon = this._svgToImage(svg);
  },

  /**
   * Get a fallback icon for unknown resource types
   * @param {number} size - Icon size
   * @returns {HTMLImageElement} Fallback icon
   */
  _getFallbackIcon(size) {
    const key = `fallback_${size}`;
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', '0 0 32 32');

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '16');
    circle.setAttribute('cy', '16');
    circle.setAttribute('r', '12');
    circle.setAttribute('fill', '#00ff88');
    circle.setAttribute('stroke', '#00aa55');
    circle.setAttribute('stroke-width', '2');
    svg.appendChild(circle);

    const img = this._svgToImage(svg);
    this.cache.set(key, img);
    return img;
  },

  /**
   * Get a fallback relic icon
   * @param {number} size - Icon size
   * @returns {HTMLImageElement} Fallback relic icon
   */
  _getFallbackRelicIcon(size) {
    const key = `fallback_relic_${size}`;
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', '0 0 32 32');

    // Diamond shape for relics
    const diamond = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    diamond.setAttribute('points', '16,2 30,16 16,30 2,16');
    diamond.setAttribute('fill', '#ff44ff');
    diamond.setAttribute('stroke', '#aa00aa');
    diamond.setAttribute('stroke-width', '2');
    svg.appendChild(diamond);

    // Inner glow
    const glow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    glow.setAttribute('points', '16,8 24,16 16,24 8,16');
    glow.setAttribute('fill', '#ff88ff');
    svg.appendChild(glow);

    const img = this._svgToImage(svg);
    this.cache.set(key, img);
    return img;
  },

  /**
   * Clear the icon cache
   */
  clear() {
    this.cache.clear();
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.IconCache = IconCache;
}
