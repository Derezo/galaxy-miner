/**
 * CargoPanel Component
 * Two-column cargo display with slide-out detail panel for selling items.
 */

const CargoPanel = {
  // Component state
  selectedItem: null,
  inventory: [],

  /**
   * Initialize the cargo panel
   */
  init() {
    // Subscribe to inventory updates
    UIState.subscribe('inventory', (inventory) => {
      this.inventory = inventory;
      this.render();
    });
  },

  /**
   * Render the cargo panel content
   * @param {HTMLElement} container - Container element to render into
   */
  render(container = null) {
    const targetContainer = container || document.getElementById('cargo-content');
    if (!targetContainer) return;

    // Save scroll position before re-render
    const panelMain = targetContainer.querySelector('.panel-main');
    const scrollTop = panelMain ? panelMain.scrollTop : 0;

    const inventory = UIState.get('inventory') || [];
    const cargoUsed = inventory.reduce((sum, item) => sum + item.quantity, 0);
    const cargoMax = Player.getCargoMax ? Player.getCargoMax() : 50;

    const html = `
      <div class="panel-two-column ${this.selectedItem ? '' : 'detail-closed'}">
        <div class="panel-main">
          <div id="cargo-info">Cargo: ${cargoUsed}/${cargoMax}</div>
          <div class="cargo-list" id="cargo-list">
            ${inventory.length === 0 ? this._renderEmpty() : inventory.map(item => this._renderItem(item)).join('')}
          </div>
        </div>
        ${this.selectedItem ? this._renderDetail() : ''}
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
   * Render a single cargo item row
   * @param {Object} item - Inventory item { resource_type, quantity }
   */
  _renderItem(item) {
    const resourceInfo = CONSTANTS.RESOURCE_TYPES[item.resource_type];
    if (!resourceInfo) return '';

    const isSelected = this.selectedItem && this.selectedItem.resource_type === item.resource_type;
    const value = resourceInfo.baseValue * item.quantity;

    return `
      <div class="cargo-item ${isSelected ? 'selected' : ''}" data-resource="${item.resource_type}">
        <div class="cargo-item-icon" id="icon-${item.resource_type}"></div>
        <div class="cargo-item-info">
          <div class="cargo-item-name">${resourceInfo.name}</div>
        </div>
        <div class="cargo-item-quantity">x${item.quantity}</div>
      </div>
    `;
  },

  /**
   * Render empty state
   */
  _renderEmpty() {
    return `
      <div class="empty-state">
        <p>No resources in cargo</p>
        <p style="font-size: 12px; margin-top: 8px;">Mine asteroids to collect resources</p>
      </div>
    `;
  },

  /**
   * Render the detail side panel
   */
  _renderDetail() {
    if (!this.selectedItem) return '';

    const resourceInfo = CONSTANTS.RESOURCE_TYPES[this.selectedItem.resource_type];
    if (!resourceInfo) return '';

    const description = resourceInfo.description || IconFactory.getDescription(this.selectedItem.resource_type);
    const totalValue = resourceInfo.baseValue * this.selectedItem.quantity;

    return `
      <div class="panel-detail">
        <div class="panel-detail-header">
          <div class="panel-detail-icon" id="detail-icon"></div>
          <div class="panel-detail-title">${resourceInfo.name}</div>
          <div class="panel-detail-subtitle">
            <span class="badge badge-${resourceInfo.rarity}">${resourceInfo.rarity}</span>
          </div>
        </div>
        <div class="panel-detail-body">
          <p style="margin-bottom: 16px; color: var(--color-text-muted); font-size: 12px; line-height: 1.5;">
            ${description}
          </p>
          <div class="panel-detail-stat">
            <span class="panel-detail-stat-label">Base Value</span>
            <span class="panel-detail-stat-value">${resourceInfo.baseValue} cr</span>
          </div>
        </div>
        <div class="panel-detail-actions">
          <button class="btn btn-primary" style="width: 100%;" id="sell-btn">
            Sell ${resourceInfo.name}
          </button>
        </div>
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

    // Cargo item click handlers
    const items = container.querySelectorAll('.cargo-item');
    items.forEach(item => {
      item.addEventListener('click', () => {
        const resourceType = item.dataset.resource;
        this._selectItem(resourceType);
      });
    });

    // Sell button handler
    const sellBtn = container.querySelector('#sell-btn');
    if (sellBtn) {
      sellBtn.addEventListener('click', () => {
        this._openSellModal();
      });
    }
  },

  /**
   * Inject SVG icons into placeholders
   * @param {HTMLElement} container - Container element
   */
  _injectIcons(container) {
    // Small icons in list
    const inventory = UIState.get('inventory') || [];
    inventory.forEach(item => {
      const iconContainer = container.querySelector(`#icon-${item.resource_type}`);
      if (iconContainer && typeof IconFactory !== 'undefined') {
        const icon = IconFactory.createResourceIcon(item.resource_type, 24);
        iconContainer.appendChild(icon);
      }
    });

    // Large icon in detail panel
    const detailIcon = container.querySelector('#detail-icon');
    if (detailIcon && this.selectedItem && typeof IconFactory !== 'undefined') {
      const largeIcon = IconFactory.createResourceIcon(this.selectedItem.resource_type, 64);
      detailIcon.appendChild(largeIcon);
    }
  },

  /**
   * Select a cargo item
   * @param {string} resourceType - Resource type key
   */
  _selectItem(resourceType) {
    const inventory = UIState.get('inventory') || [];
    const item = inventory.find(i => i.resource_type === resourceType);

    if (item && this.selectedItem && this.selectedItem.resource_type === resourceType) {
      // Deselect if clicking same item
      this.selectedItem = null;
    } else {
      this.selectedItem = item || null;
    }

    this.render();
  },

  /**
   * Open the sell modal
   */
  _openSellModal() {
    if (!this.selectedItem) return;

    const resourceInfo = CONSTANTS.RESOURCE_TYPES[this.selectedItem.resource_type];
    if (!resourceInfo) return;

    const maxQuantity = this.selectedItem.quantity;
    const suggestedPrice = resourceInfo.baseValue;

    const content = document.createElement('div');
    content.className = 'sell-form';
    content.innerHTML = `
      <div style="text-align: center; margin-bottom: 16px;">
        <div id="sell-modal-icon" style="margin-bottom: 8px;"></div>
        <div style="color: var(--color-primary-lighter); font-weight: bold;">${resourceInfo.name}</div>
        <div style="font-size: 12px; color: var(--color-text-muted);">Available: ${maxQuantity}</div>
      </div>

      <div class="form-group">
        <label class="form-label">Quantity to sell</label>
        <div class="input-number-group">
          <button class="btn btn-sm" id="qty-minus">-</button>
          <input type="number" class="input" id="sell-quantity" value="1" min="1" max="${maxQuantity}">
          <button class="btn btn-sm" id="qty-plus">+</button>
          <button class="btn btn-sm" id="qty-max">Max</button>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Price per unit (cr)</label>
        <input type="number" class="input" id="sell-price" value="${suggestedPrice}" min="1">
        <div style="font-size: 11px; color: var(--color-text-muted); margin-top: 4px;">
          Base value: ${suggestedPrice} cr
        </div>
      </div>

      <div class="sell-form-preview">
        <div class="sell-form-preview-label">Total listing value</div>
        <div class="sell-form-preview-value" id="sell-total">${suggestedPrice} cr</div>
      </div>
    `;

    const modal = Modal.open({
      content,
      title: 'List for Sale',
      className: 'modal-dialog'
    });

    // Inject icon
    const iconContainer = content.querySelector('#sell-modal-icon');
    if (iconContainer && typeof IconFactory !== 'undefined') {
      const icon = IconFactory.createResourceIcon(this.selectedItem.resource_type, 48);
      iconContainer.appendChild(icon);
    }

    // Get input elements
    const qtyInput = content.querySelector('#sell-quantity');
    const priceInput = content.querySelector('#sell-price');
    const totalDisplay = content.querySelector('#sell-total');

    // Update total preview
    const updateTotal = () => {
      const qty = parseInt(qtyInput.value) || 0;
      const price = parseInt(priceInput.value) || 0;
      totalDisplay.textContent = `${qty * price} cr`;
    };

    // Quantity controls
    content.querySelector('#qty-minus').addEventListener('click', () => {
      qtyInput.value = Math.max(1, parseInt(qtyInput.value) - 1);
      updateTotal();
    });

    content.querySelector('#qty-plus').addEventListener('click', () => {
      qtyInput.value = Math.min(maxQuantity, parseInt(qtyInput.value) + 1);
      updateTotal();
    });

    content.querySelector('#qty-max').addEventListener('click', () => {
      qtyInput.value = maxQuantity;
      updateTotal();
    });

    qtyInput.addEventListener('input', () => {
      let val = parseInt(qtyInput.value) || 1;
      val = Math.max(1, Math.min(maxQuantity, val));
      qtyInput.value = val;
      updateTotal();
    });

    priceInput.addEventListener('input', updateTotal);

    // Add action buttons
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    actions.innerHTML = `
      <button class="btn" id="sell-cancel">Cancel</button>
      <button class="btn btn-success" id="sell-confirm">List for Sale</button>
    `;
    content.appendChild(actions);

    // Cancel
    actions.querySelector('#sell-cancel').addEventListener('click', () => {
      modal.close();
    });

    // Confirm
    actions.querySelector('#sell-confirm').addEventListener('click', () => {
      const quantity = parseInt(qtyInput.value);
      const price = parseInt(priceInput.value);

      if (quantity > 0 && price > 0) {
        // Send to server
        if (typeof Network !== 'undefined' && Network.sendMarketList) {
          Network.sendMarketList(this.selectedItem.resource_type, quantity, price);
        }
        modal.close();

        // Clear selection after selling
        this.selectedItem = null;
        this.render();
      }
    });
  },

  /**
   * Refresh the panel (called externally)
   */
  refresh() {
    this.render();
  },

  /**
   * Clear selection
   */
  clearSelection() {
    this.selectedItem = null;
    this.render();
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.CargoPanel = CargoPanel;
}
