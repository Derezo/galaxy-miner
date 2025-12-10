/**
 * RelicsPanel Component
 * Two-column relics display showing collected relics with details.
 * Relics are permanent collectibles that grant special abilities.
 */

const RelicsPanel = {
  // Component state
  selectedRelic: null,
  relics: [],

  /**
   * Initialize the relics panel
   */
  init() {
    // Subscribe to relics updates
    UIState.subscribe('relics', (relics) => {
      this.relics = relics || [];
      this.render();
    });
  },

  /**
   * Render the relics panel content
   * @param {HTMLElement} container - Container element to render into
   */
  render(container = null) {
    const targetContainer = container || document.getElementById('relics-content');
    if (!targetContainer) return;

    // Save scroll position before re-render
    const panelMain = targetContainer.querySelector('.panel-main');
    const scrollTop = panelMain ? panelMain.scrollTop : 0;

    const relics = UIState.get('relics') || [];

    const html = `
      <div class="panel-two-column ${this.selectedRelic ? '' : 'detail-closed'}">
        <div class="panel-main">
          <div id="relics-info">Relics Collected: ${relics.length}</div>
          <div class="relics-list" id="relics-list">
            ${relics.length === 0 ? this._renderEmpty() : relics.map(relic => this._renderItem(relic)).join('')}
          </div>
        </div>
        ${this.selectedRelic ? this._renderDetail() : ''}
      </div>
    `;

    targetContainer.innerHTML = html;
    this._bindEvents(targetContainer);

    // Restore scroll position after re-render
    const newPanelMain = targetContainer.querySelector('.panel-main');
    if (newPanelMain && scrollTop > 0) {
      newPanelMain.scrollTop = scrollTop;
    }
  },

  /**
   * Render a single relic item row
   * @param {Object} relic - Relic data { relic_type, obtained_at }
   */
  _renderItem(relic) {
    const relicType = relic.relic_type;
    // Normalize to uppercase for lookup (database may have mixed case)
    const normalizedType = relicType.toUpperCase();
    const relicInfo = CONSTANTS.RELIC_TYPES[normalizedType];
    if (!relicInfo) {
      Logger.warn('Unknown relic type:', relicType);
      return '';
    }

    const isSelected = this.selectedRelic && this.selectedRelic.relic_type.toUpperCase() === normalizedType;
    const obtainedDate = new Date(relic.obtained_at).toLocaleDateString();

    return `
      <div class="relic-item ${isSelected ? 'selected' : ''}" data-relic="${normalizedType}">
        <div class="relic-item-icon" id="relic-icon-${normalizedType}"></div>
        <div class="relic-item-info">
          <div class="relic-item-name">${relicInfo.name}</div>
          <div class="relic-item-date">Found: ${obtainedDate}</div>
        </div>
        <span class="badge badge-${relicInfo.rarity}">${relicInfo.rarity}</span>
      </div>
    `;
  },

  /**
   * Render empty state
   */
  _renderEmpty() {
    return `
      <div class="empty-state">
        <div class="empty-state-icon" id="empty-relic-icon"></div>
        <p>No relics discovered yet</p>
        <p style="font-size: 12px; margin-top: 8px; color: var(--color-text-muted);">
          Defeat powerful enemies and explore the galaxy to find ancient relics
        </p>
      </div>
    `;
  },

  /**
   * Render the detail side panel
   */
  _renderDetail() {
    if (!this.selectedRelic) return '';

    const relicType = this.selectedRelic.relic_type;
    const normalizedType = relicType.toUpperCase();
    const relicInfo = CONSTANTS.RELIC_TYPES[normalizedType];
    if (!relicInfo) return '';

    const obtainedDate = new Date(this.selectedRelic.obtained_at).toLocaleDateString();
    const hasEffect = relicInfo.effect || relicInfo.effects ? true : false;

    return `
      <div class="panel-detail">
        <div class="panel-detail-header">
          <div class="panel-detail-icon" id="detail-relic-icon"></div>
          <div class="panel-detail-title">${relicInfo.name}</div>
          <div class="panel-detail-subtitle">
            <span class="badge badge-${relicInfo.rarity}">${relicInfo.rarity}</span>
          </div>
        </div>
        <div class="panel-detail-body">
          <p class="relic-description">
            ${relicInfo.description || 'An ancient artifact of unknown origin.'}
          </p>

          ${hasEffect ? this._renderEffect(relicInfo) : this._renderNoEffect()}

          <div class="panel-detail-stat">
            <span class="panel-detail-stat-label">Trade Value</span>
            <span class="panel-detail-stat-value">${relicInfo.value} cr</span>
          </div>
          <div class="panel-detail-stat">
            <span class="panel-detail-stat-label">Discovered</span>
            <span class="panel-detail-stat-value">${obtainedDate}</span>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Render effect information for relics with abilities
   */
  _renderEffect(relicInfo) {
    let effectName = 'Unknown Effect';
    let effectDesc = 'The properties of this artifact are being analyzed.';

    if (relicInfo.effect === 'wormhole_transit') {
      effectName = 'Wormhole Transit';
      effectDesc = 'Approach a wormhole and press [M] to enter. Select a destination from nearby wormholes to instantly travel.';
    } else if (relicInfo.effects) {
      // Handle relics with multiple effects (like SCRAP_SIPHON)
      const effects = relicInfo.effects;

      if (effects.wreckageCollectionSpeed !== undefined) {
        effectName = 'Scrap Siphon';
        const speedPct = Math.round((1 - effects.wreckageCollectionSpeed) * 100);
        const multiCount = effects.multiWreckageCount || 1;
        const multiRange = effects.multiWreckageRange || 100;

        let descParts = [];
        descParts.push(`Press [M] near wreckage to instantly collect up to ${multiCount} pieces within ${multiRange} units.`);
        descParts.push(`Collection is ${speedPct}% faster than normal.`);
        if (effects.scavengerWreckageImmunity) {
          descParts.push('Scavengers will ignore your wreckage collection.');
        }
        effectDesc = descParts.join(' ');
      }
    }

    return `
      <div class="relic-effect">
        <div class="relic-effect-header">
          <span class="relic-effect-icon">&#10022;</span>
          <span class="relic-effect-name">${effectName}</span>
        </div>
        <p class="relic-effect-desc">${effectDesc}</p>
      </div>
    `;
  },

  /**
   * Render placeholder for relics without implemented effects
   */
  _renderNoEffect() {
    return `
      <div class="relic-effect relic-effect-inactive">
        <div class="relic-effect-header">
          <span class="relic-effect-icon">&#9679;</span>
          <span class="relic-effect-name">Dormant Power</span>
        </div>
        <p class="relic-effect-desc">
          This artifact's true power has not yet been unlocked. Future discoveries may reveal its purpose.
        </p>
      </div>
    `;
  },

  /**
   * Bind event handlers
   * @param {HTMLElement} container - Container element
   */
  _bindEvents(container) {
    // Inject icons after rendering
    this._injectIcons(container);

    // Relic item click handlers
    const items = container.querySelectorAll('.relic-item');
    items.forEach(item => {
      item.addEventListener('click', () => {
        const relicType = item.dataset.relic;
        this._selectRelic(relicType);
      });
    });
  },

  /**
   * Inject SVG icons into placeholders
   * @param {HTMLElement} container - Container element
   */
  _injectIcons(container) {
    const relics = UIState.get('relics') || [];

    // Icons in list
    relics.forEach(relic => {
      const normalizedType = relic.relic_type.toUpperCase();
      const iconContainer = container.querySelector(`#relic-icon-${normalizedType}`);
      if (iconContainer && typeof IconFactory !== 'undefined') {
        const icon = IconFactory.createRelicIcon(normalizedType, 32);
        iconContainer.appendChild(icon);
      }
    });

    // Large icon in detail panel
    const detailIcon = container.querySelector('#detail-relic-icon');
    if (detailIcon && this.selectedRelic && typeof IconFactory !== 'undefined') {
      const normalizedType = this.selectedRelic.relic_type.toUpperCase();
      const largeIcon = IconFactory.createRelicIcon(normalizedType, 64);
      detailIcon.appendChild(largeIcon);
    }

    // Empty state icon
    const emptyIcon = container.querySelector('#empty-relic-icon');
    if (emptyIcon && typeof RelicShape !== 'undefined') {
      const icon = RelicShape.create({
        size: 48,
        glyphVariant: 'constellation',
        glowColor: '#666666',
        glowIntensity: 0.3
      });
      icon.style.opacity = '0.5';
      emptyIcon.appendChild(icon);
    }
  },

  /**
   * Select a relic
   * @param {string} relicType - Relic type key
   */
  _selectRelic(relicType) {
    const relics = UIState.get('relics') || [];
    // relicType from data-relic is already normalized to uppercase
    const relic = relics.find(r => r.relic_type.toUpperCase() === relicType);

    if (relic && this.selectedRelic && this.selectedRelic.relic_type.toUpperCase() === relicType) {
      // Deselect if clicking same item
      this.selectedRelic = null;
      UIState.set('selectedRelic', null);
    } else {
      this.selectedRelic = relic || null;
      UIState.set('selectedRelic', this.selectedRelic);
    }

    this.render();
  },

  /**
   * Refresh the panel (called externally)
   */
  refresh() {
    this.relics = UIState.get('relics') || [];
    this.render();
  },

  /**
   * Clear selection
   */
  clearSelection() {
    this.selectedRelic = null;
    UIState.set('selectedRelic', null);
    this.render();
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.RelicsPanel = RelicsPanel;
}
