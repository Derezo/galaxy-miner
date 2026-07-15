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
            <span class="panel-detail-stat-label">Archive Rating</span>
            <span class="panel-detail-stat-value">${relicInfo.value}</span>
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
      effectDesc = 'Approach a wormhole and press [M] to enter. Select a destination, then remain protected during the server-controlled transit sequence.';
    } else if (relicInfo.effect === 'strategic_radar') {
      effectName = 'Strategic Cartography';
      const rangeMultiplier = relicInfo.effects?.strategicContactRangeMultiplier || 2;
      const maxContacts = relicInfo.effects?.maxStrategicContacts || 8;
      effectDesc = `Marks up to ${maxContacts} server-confirmed faction bases and boss-class contacts between normal radar range and ${rangeMultiplier}x range. Cyan-ticked edge diamonds reveal bearing only, not combat state.`;
    } else if (relicInfo.effect === 'faction_damage') {
      effectName = 'Resonant Fracture';
      const bonus = Math.round((relicInfo.effects?.factionDamageBonus || 0.1) * 100);
      const factions = (relicInfo.effects?.targetFactions || ['void', 'swarm'])
        .map(faction => faction.charAt(0).toUpperCase() + faction.slice(1))
        .join(' and ');
      effectDesc = `Weapon damage against ${factions} NPCs and faction bases is increased by ${bonus}%. Applied automatically by the authoritative combat server.`;
    } else if (relicInfo.effect === 'plunder') {
      effectName = 'Plunder';
      const cooldownSec = Math.round((relicInfo.cooldown || 15000) / 1000);
      const baseCooldownSec = Math.round((relicInfo.baseCooldown || 90000) / 1000);
      const aggroRange = relicInfo.aggroRange || 600;
      effectDesc = `Press [M] near a faction base to steal from its finite reserve. Player cooldown: ${cooldownSec}s; each base enters a ${baseCooldownSec}s alert. Cargo limits apply, unclaimed cargo remains, and NPCs within ${aggroRange} units become hostile.`;
    } else if (relicInfo.effect === 'credit_bonus') {
      effectName = "Pirate's Share";
      const bonusPct = relicInfo.effects?.npcWreckageCreditBonus ? Math.round(relicInfo.effects.npcWreckageCreditBonus * 100) : 10;
      effectDesc = `Your own credit share from NPC wreckage is increased by ${bonusPct}%, including shares collected by teammates. Other players only receive the bonus if they own the relic too.`;
    } else if (relicInfo.effect === 'hive_respawn') {
      effectName = 'Hive Rejection';
      const radius = relicInfo.effects?.hiveDestructionRadius || 500;
      effectDesc = `On death, unlocks the nearest active Swarm hive as a respawn destination. Choosing it destroys the host hive and releases a ${radius}-unit rejection blast.`;
    } else if (relicInfo.effect === 'warp_enhancement') {
      effectName = 'Subspace Warp';
      const durationBonus = relicInfo.effects?.boostDurationMultiplier
        ? Math.round((relicInfo.effects.boostDurationMultiplier - 1) * 100)
        : 150;
      const cooldownReduction = relicInfo.effects?.boostCooldownMultiplier
        ? Math.round((1 - relicInfo.effects.boostCooldownMultiplier) * 100)
        : 25;
      const transitSpeed = relicInfo.effects?.wormholeTransitSpeedMultiplier || 2.5;
      effectDesc = `Boost duration is increased by ${durationBonus}% and boost cooldown is reduced by ${cooldownReduction}%. Wormhole transit runs ${transitSpeed}x faster. Effect is always active.`;
    } else if (relicInfo.effects) {
      // Handle relics with multiple effects (like SCRAP_SIPHON)
      const effects = relicInfo.effects;

      if (effects.wreckageCollectionSpeed !== undefined) {
        effectName = 'Scrap Siphon';
        const speedPct = Math.round((1 - effects.wreckageCollectionSpeed) * 100);
        const multiCount = effects.multiWreckageCount || 1;
        const multiRange = effects.multiWreckageRange || 100;

        let descParts = [];
        descParts.push(`Press [M] near wreckage to collect up to ${multiCount} pieces in parallel within ${multiRange} units.`);
        descParts.push(`Collection is ${speedPct}% faster than normal.`);
        if (effects.scavengerWreckageImmunity) {
          descParts.push('Scavengers will ignore your wreckage collection.');
        }
        effectDesc = descParts.join(' ');
      } else if (effects.miningYieldMultiplier !== undefined) {
        effectName = 'Ritual Extraction';
        effectDesc = `Mining yield is multiplied by ${effects.miningYieldMultiplier}x before cargo capacity is applied. Quantities remain whole units and the server uses this configured value directly.`;
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
