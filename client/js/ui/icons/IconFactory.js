/**
 * Icon Factory
 * Creates resource icons using the appropriate shape generator based on resource type.
 * Provides a unified API for generating parameterized SVG icons.
 */

const IconFactory = {
  /**
   * Resource icon configurations
   * Maps resource types to their visual parameters
   */
  RESOURCE_ICONS: {
    // Metals - Material shapes
    IRON: {
      iconType: 'material',
      variant: 'ingot',
      hue: 25,
      saturation: 30,
      glowIntensity: 0.2,
      description: 'Common structural metal, essential for basic ship repairs and construction.'
    },
    COPPER: {
      iconType: 'material',
      variant: 'nugget',
      hue: 25,
      saturation: 70,
      glowIntensity: 0.3,
      description: 'Conductive metal used in electrical systems and advanced circuitry.'
    },
    TITANIUM: {
      iconType: 'material',
      variant: 'hexagon',
      hue: 200,
      saturation: 20,
      glowIntensity: 0.3,
      description: 'Lightweight yet incredibly strong, ideal for hull reinforcement.'
    },
    PLATINUM: {
      iconType: 'material',
      variant: 'ingot',
      hue: 45,
      saturation: 10,
      glowIntensity: 0.5,
      description: 'Precious metal with excellent catalytic properties, highly valued.'
    },
    SILICON: {
      iconType: 'material',
      variant: 'cube',
      hue: 220,
      saturation: 25,
      glowIntensity: 0.25,
      description: 'Essential for computer chips and solar panel construction.'
    },

    // Gases - Orbital shapes
    HYDROGEN: {
      iconType: 'orbital',
      variant: 'atom',
      rings: 1,
      electrons: 1,
      hue: 200,
      saturation: 80,
      glowIntensity: 0.4,
      description: 'Lightest element, primary fuel source for fusion reactors.'
    },
    CARBON: {
      iconType: 'orbital',
      variant: 'molecule',
      rings: 2,
      electrons: 4,
      hue: 30,
      saturation: 20,
      glowIntensity: 0.3,
      description: 'Versatile element forming the basis of organic compounds.'
    },
    HELIUM3: {
      iconType: 'orbital',
      variant: 'atom',
      rings: 1,
      electrons: 2,
      hue: 50,
      saturation: 60,
      glowIntensity: 0.5,
      description: 'Rare helium isotope, ideal for clean fusion power generation.'
    },

    // Crystals - Crystal shapes
    ICE_CRYSTALS: {
      iconType: 'crystal',
      variant: 'cluster',
      facets: 6,
      hue: 195,
      saturation: 60,
      glowIntensity: 0.4,
      description: 'Frozen water containing trace minerals, useful for life support systems.'
    },
    QUANTUM_CRYSTALS: {
      iconType: 'crystal',
      variant: 'gem',
      facets: 8,
      hue: 280,
      saturation: 70,
      glowIntensity: 0.7,
      description: 'Rare crystals exhibiting quantum properties, used in FTL navigation.'
    },

    // Exotic - Special animated variants
    DARK_MATTER: {
      iconType: 'orbital',
      variant: 'cloud',
      hue: 270,
      saturation: 50,
      glowIntensity: 0.8,
      pulseSpeed: 2,
      description: 'Mysterious substance that interacts only through gravity.'
    },
    EXOTIC_MATTER: {
      iconType: 'crystal',
      variant: 'prism',
      facets: 7,
      hue: 320,
      saturation: 80,
      glowIntensity: 0.9,
      pulseSpeed: 1.5,
      description: 'Theoretically impossible material with negative mass properties.'
    },
    ANTIMATTER: {
      iconType: 'orbital',
      variant: 'atom',
      rings: 3,
      electrons: 3,
      hue: 0,
      saturation: 90,
      glowIntensity: 1.0,
      pulseSpeed: 1,
      description: 'Highly volatile matter-antimatter annihilation fuel source.'
    },

    // Common - New additions
    PHOSPHORUS: {
      iconType: 'orbital',
      variant: 'molecule',
      rings: 2,
      electrons: 3,
      hue: 120,
      saturation: 60,
      glowIntensity: 0.35,
      description: 'Essential element for organic compounds and agricultural systems.'
    },
    NICKEL: {
      iconType: 'material',
      variant: 'hexagon',
      hue: 40,
      saturation: 25,
      glowIntensity: 0.2,
      description: 'Abundant in asteroids, used for corrosion-resistant alloys and plating.'
    },
    SULFUR: {
      iconType: 'crystal',
      variant: 'cluster',
      facets: 5,
      hue: 55,
      saturation: 85,
      glowIntensity: 0.3,
      description: 'Volcanic mineral deposits, essential for industrial chemical processes.'
    },
    NITROGEN: {
      iconType: 'orbital',
      variant: 'cloud',
      hue: 210,
      saturation: 40,
      glowIntensity: 0.25,
      description: 'Atmospheric gas crucial for life support and cooling systems.'
    },

    // Uncommon - New additions
    SILVER: {
      iconType: 'material',
      variant: 'ingot',
      hue: 220,
      saturation: 8,
      glowIntensity: 0.5,
      description: 'Precious conductive metal with antimicrobial properties.'
    },
    COBALT: {
      iconType: 'material',
      variant: 'cube',
      hue: 240,
      saturation: 70,
      glowIntensity: 0.4,
      description: 'Deep blue metal used in battery technology and superalloys.'
    },
    LITHIUM: {
      iconType: 'material',
      variant: 'nugget',
      hue: 0,
      saturation: 50,
      glowIntensity: 0.35,
      description: 'Lightweight reactive metal essential for power cell production.'
    },
    NEON: {
      iconType: 'orbital',
      variant: 'atom',
      rings: 2,
      electrons: 2,
      hue: 340,
      saturation: 90,
      glowIntensity: 0.7,
      description: 'Noble gas used in holographic displays and signage systems.'
    },

    // Rare - New additions
    GOLD: {
      iconType: 'material',
      variant: 'ingot',
      hue: 45,
      saturation: 90,
      glowIntensity: 0.6,
      description: 'Universal precious metal, prized for electronics and currency.'
    },
    URANIUM: {
      iconType: 'material',
      variant: 'hexagon',
      hue: 100,
      saturation: 80,
      glowIntensity: 0.7,
      pulseSpeed: 3,
      description: 'Radioactive heavy metal used for nuclear fuel and weapons systems.'
    },
    IRIDIUM: {
      iconType: 'material',
      variant: 'cube',
      hue: 280,
      saturation: 50,
      glowIntensity: 0.65,
      description: 'Ultra-hard asteroid-origin metal, iridescent and nearly indestructible.'
    },
    XENON: {
      iconType: 'orbital',
      variant: 'atom',
      rings: 3,
      electrons: 2,
      hue: 180,
      saturation: 70,
      glowIntensity: 0.55,
      description: 'Heavy noble gas, primary propellant for ion thrusters.'
    },

    // Ultra-rare - New additions
    NEUTRONIUM: {
      iconType: 'material',
      variant: 'cube',
      hue: 200,
      saturation: 15,
      glowIntensity: 0.9,
      pulseSpeed: 2,
      description: 'Degenerate matter from neutron stars, impossibly dense.'
    },
    VOID_CRYSTALS: {
      iconType: 'crystal',
      variant: 'prism',
      facets: 6,
      hue: 260,
      saturation: 70,
      glowIntensity: 1.0,
      pulseSpeed: 1.5,
      description: 'Formed in space-time anomalies, capable of bending reality itself.'
    }
  },

  /**
   * Create a resource icon
   * @param {string} resourceType - Resource type key (e.g., 'IRON', 'PLATINUM')
   * @param {number} size - Icon size in pixels (default: 24)
   * @returns {SVGElement} Generated SVG icon
   */
  createResourceIcon(resourceType, size = 24) {
    const config = this.RESOURCE_ICONS[resourceType];

    if (!config) {
      console.warn(`No icon config for resource type: ${resourceType}`);
      return this._createFallbackIcon(size);
    }

    const iconConfig = {
      size,
      hue: config.hue,
      saturation: config.saturation,
      glowIntensity: config.glowIntensity,
      variant: config.variant
    };

    let icon;
    switch (config.iconType) {
      case 'crystal':
        iconConfig.facets = config.facets || 5;
        icon = CrystalShape.create(iconConfig);
        break;

      case 'orbital':
        iconConfig.rings = config.rings || 2;
        iconConfig.electrons = config.electrons || 2;
        icon = OrbitalShape.create(iconConfig);
        break;

      case 'material':
        icon = MaterialShape.create(iconConfig);
        break;

      default:
        icon = this._createFallbackIcon(size);
    }

    // Add data attributes for styling/animation
    icon.dataset.resourceType = resourceType;
    icon.dataset.iconType = config.iconType;

    // Add pulse animation class for exotic materials
    if (config.pulseSpeed) {
      icon.classList.add('icon-pulse');
      icon.style.setProperty('--pulse-speed', `${config.pulseSpeed}s`);
    }

    return icon;
  },

  /**
   * Get resource description
   * @param {string} resourceType - Resource type key
   * @returns {string} Description text
   */
  getDescription(resourceType) {
    const config = this.RESOURCE_ICONS[resourceType];
    return config ? config.description : 'Unknown resource.';
  },

  /**
   * Get icon configuration for a resource
   * @param {string} resourceType - Resource type key
   * @returns {Object|null} Icon configuration
   */
  getConfig(resourceType) {
    return this.RESOURCE_ICONS[resourceType] || null;
  },

  /**
   * Create all icons as a sprite/cache (for preloading)
   * @param {number} size - Icon size
   * @returns {Object} Map of resourceType -> SVG element
   */
  createAll(size = 24) {
    const icons = {};
    for (const resourceType of Object.keys(this.RESOURCE_ICONS)) {
      icons[resourceType] = this.createResourceIcon(resourceType, size);
    }
    return icons;
  },

  /**
   * Create fallback icon for unknown resources
   * @param {number} size - Icon size
   * @returns {SVGElement}
   */
  _createFallbackIcon(size) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.classList.add('resource-icon', 'fallback-icon');

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '12');
    circle.setAttribute('cy', '12');
    circle.setAttribute('r', '8');
    circle.setAttribute('fill', '#666');
    circle.setAttribute('stroke', '#999');
    circle.setAttribute('stroke-width', '1');

    const question = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    question.setAttribute('x', '12');
    question.setAttribute('y', '16');
    question.setAttribute('text-anchor', 'middle');
    question.setAttribute('fill', '#fff');
    question.setAttribute('font-size', '12');
    question.textContent = '?';

    svg.appendChild(circle);
    svg.appendChild(question);

    return svg;
  },

  /**
   * Clone an existing icon (faster than regenerating)
   * @param {SVGElement} icon - Icon to clone
   * @returns {SVGElement} Cloned icon
   */
  clone(icon) {
    return icon.cloneNode(true);
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.IconFactory = IconFactory;
}
