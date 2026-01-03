/**
 * MarketPanel Component
 * Browse marketplace listings and manage your own listings.
 * Two tabs: Browse (all listings) and My Listings (your active listings).
 */

const MarketPanel = {
  // Component state
  currentTab: 'browse',
  listings: [],
  myListings: [],
  filterResource: 'all',
  sortBy: 'price',

  /**
   * Initialize the market panel
   */
  init() {
    // Subscribe to state updates
    UIState.subscribe('marketListings', (listings) => {
      this.listings = listings;
      if (this.currentTab === 'browse') {
        this.render();
      }
    });

    UIState.subscribe('myListings', (listings) => {
      this.myListings = listings;
      if (this.currentTab === 'my-listings') {
        this.render();
      }
    });

    // Request initial data when market tab is shown
    document.addEventListener('terminal:tabchange', (e) => {
      if (e.detail && e.detail.tab === 'market') {
        this._requestListings();
      }
    });

    // Also request when terminal opens if market is active tab
    document.addEventListener('terminal:open', () => {
      if (this.currentTab === 'browse') {
        this._requestListings();
      } else {
        this._requestMyListings();
      }
    });
  },

  /**
   * Render the market panel content
   * @param {HTMLElement} container - Container element to render into
   */
  render(container = null) {
    const targetContainer = container || document.getElementById('market-content');
    if (!targetContainer) return;

    const html = `
      <div id="market-tabs">
        <button class="market-tab ${this.currentTab === 'browse' ? 'active' : ''}" data-tab="browse">
          Browse Market
        </button>
        <button class="market-tab ${this.currentTab === 'my-listings' ? 'active' : ''}" data-tab="my-listings">
          My Listings
        </button>
      </div>
      <div id="market-tab-content">
        ${this.currentTab === 'browse' ? this._renderBrowseTab() : this._renderMyListingsTab()}
      </div>
    `;

    targetContainer.innerHTML = html;
    this._bindEvents(targetContainer);
  },

  /**
   * Render the browse tab content
   */
  _renderBrowseTab() {
    const listings = this._getFilteredListings();

    return `
      <div class="market-filters">
        <div class="market-filter">
          <label>Filter by resource</label>
          <select class="select" id="filter-resource">
            <option value="all" ${this.filterResource === 'all' ? 'selected' : ''}>All Resources</option>
            ${Object.entries(CONSTANTS.RESOURCE_TYPES).map(([key, info]) =>
              `<option value="${key}" ${this.filterResource === key ? 'selected' : ''}>${info.name}</option>`
            ).join('')}
          </select>
        </div>
        <div class="market-filter">
          <label>Sort by</label>
          <select class="select" id="sort-by">
            <option value="price" ${this.sortBy === 'price' ? 'selected' : ''}>Lowest Price</option>
            <option value="price-desc" ${this.sortBy === 'price-desc' ? 'selected' : ''}>Highest Price</option>
            <option value="quantity" ${this.sortBy === 'quantity' ? 'selected' : ''}>Quantity</option>
            <option value="newest" ${this.sortBy === 'newest' ? 'selected' : ''}>Newest First</option>
          </select>
        </div>
      </div>
      <div class="market-list" id="market-list">
        ${listings.length === 0 ? this._renderEmptyBrowse() : listings.map(l => this._renderListing(l)).join('')}
      </div>
    `;
  },

  /**
   * Render my listings tab content
   */
  _renderMyListingsTab() {
    const listings = this.myListings || [];

    return `
      <div class="market-list" id="market-list">
        ${listings.length === 0 ? this._renderEmptyMyListings() : listings.map(l => this._renderMyListing(l)).join('')}
      </div>
    `;
  },

  /**
   * Render a marketplace listing
   * @param {Object} listing - Listing data
   */
  _renderListing(listing) {
    const resourceInfo = CONSTANTS.RESOURCE_TYPES[listing.resource_type];
    if (!resourceInfo) return '';

    const totalPrice = listing.price_per_unit * listing.quantity;

    return `
      <div class="market-listing" data-listing-id="${listing.id}">
        <div class="market-listing-icon" id="listing-icon-${listing.id}"></div>
        <div class="market-listing-info">
          <div class="market-listing-title">
            <span class="market-listing-name">${resourceInfo.name}</span>
            <span class="market-listing-quantity">x${listing.quantity}</span>
          </div>
          <div class="market-listing-price">
            ${listing.price_per_unit} cr/unit | Total: ${totalPrice} cr
          </div>
          <div class="market-listing-seller">
            Seller: ${listing.seller_name || 'Unknown'}
          </div>
        </div>
        <div class="market-listing-actions">
          <button class="btn btn-sm btn-primary buy-quick-btn" data-listing-id="${listing.id}">
            Buy
          </button>
        </div>
      </div>
    `;
  },

  /**
   * Render one of my listings
   * @param {Object} listing - Listing data
   */
  _renderMyListing(listing) {
    const resourceInfo = CONSTANTS.RESOURCE_TYPES[listing.resource_type];
    if (!resourceInfo) return '';

    const totalPrice = listing.price_per_unit * listing.quantity;

    return `
      <div class="market-listing" data-listing-id="${listing.id}">
        <div class="market-listing-icon" id="my-listing-icon-${listing.id}"></div>
        <div class="market-listing-info">
          <div class="market-listing-title">
            <span class="market-listing-name">${resourceInfo.name}</span>
            <span class="market-listing-quantity">x${listing.quantity}</span>
          </div>
          <div class="market-listing-price">
            ${listing.price_per_unit} cr/unit | Total: ${totalPrice} cr
          </div>
          <div class="market-listing-seller" style="color: var(--color-success);">
            Your listing
          </div>
        </div>
        <div class="market-listing-actions">
          <button class="btn btn-sm btn-danger cancel-listing-btn" data-listing-id="${listing.id}">
            Cancel
          </button>
        </div>
      </div>
    `;
  },

  /**
   * Render empty browse state
   */
  _renderEmptyBrowse() {
    return `
      <div class="empty-state">
        <p>No listings available</p>
        <p style="font-size: 12px; margin-top: 8px;">
          ${this.filterResource !== 'all' ? 'Try changing the filter or ' : ''}Check back later for new listings
        </p>
      </div>
    `;
  },

  /**
   * Render empty my listings state
   */
  _renderEmptyMyListings() {
    return `
      <div class="empty-state">
        <p>You have no active listings</p>
        <p style="font-size: 12px; margin-top: 8px;">
          Sell resources from your Cargo tab
        </p>
      </div>
    `;
  },

  /**
   * Get filtered and sorted listings
   */
  _getFilteredListings() {
    let listings = [...(this.listings || [])];

    // Filter by resource
    if (this.filterResource !== 'all') {
      listings = listings.filter(l => l.resource_type === this.filterResource);
    }

    // Sort
    switch (this.sortBy) {
      case 'price':
        listings.sort((a, b) => a.price_per_unit - b.price_per_unit);
        break;
      case 'price-desc':
        listings.sort((a, b) => b.price_per_unit - a.price_per_unit);
        break;
      case 'quantity':
        listings.sort((a, b) => b.quantity - a.quantity);
        break;
      case 'newest':
        listings.sort((a, b) => new Date(b.listed_at) - new Date(a.listed_at));
        break;
    }

    return listings;
  },

  /**
   * Bind event handlers
   * @param {HTMLElement} container - Container element
   */
  _bindEvents(container) {
    // Inject icons
    this._injectIcons(container);

    // Tab click handlers
    const tabs = container.querySelectorAll('.market-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // Play tab switch sound
        if (typeof AudioManager !== 'undefined') {
          AudioManager.play('ui_click');
        }
        this.currentTab = tab.dataset.tab;
        this.render();

        // Request fresh data
        if (this.currentTab === 'browse') {
          this._requestListings();
        } else {
          this._requestMyListings();
        }
      });
    });

    // Filter change handlers
    const filterResource = container.querySelector('#filter-resource');
    if (filterResource) {
      filterResource.addEventListener('change', () => {
        this.filterResource = filterResource.value;
        this.render();
      });
    }

    const sortBy = container.querySelector('#sort-by');
    if (sortBy) {
      sortBy.addEventListener('change', () => {
        this.sortBy = sortBy.value;
        this.render();
      });
    }

    // Quick buy buttons
    const buyBtns = container.querySelectorAll('.buy-quick-btn');
    buyBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const listingId = btn.dataset.listingId;
        this._openBuyModal(listingId);
      });
    });

    // Cancel listing buttons
    const cancelBtns = container.querySelectorAll('.cancel-listing-btn');
    cancelBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const listingId = btn.dataset.listingId;
        this._cancelListing(listingId);
      });
    });

    // Listing row click for detail view
    const listings = container.querySelectorAll('.market-listing');
    listings.forEach(listing => {
      listing.addEventListener('click', (e) => {
        // Don't trigger if clicking a button
        if (e.target.closest('button')) return;
        const listingId = listing.dataset.listingId;
        this._openDetailModal(listingId);
      });
    });
  },

  /**
   * Inject SVG icons into listings
   * @param {HTMLElement} container - Container element
   */
  _injectIcons(container) {
    // Browse listings
    (this.listings || []).forEach(listing => {
      const iconContainer = container.querySelector(`#listing-icon-${listing.id}`);
      if (iconContainer && typeof IconFactory !== 'undefined') {
        const icon = IconFactory.createResourceIcon(listing.resource_type, 24);
        iconContainer.appendChild(icon);
      }
    });

    // My listings
    (this.myListings || []).forEach(listing => {
      const iconContainer = container.querySelector(`#my-listing-icon-${listing.id}`);
      if (iconContainer && typeof IconFactory !== 'undefined') {
        const icon = IconFactory.createResourceIcon(listing.resource_type, 24);
        iconContainer.appendChild(icon);
      }
    });
  },

  /**
   * Open buy modal for a listing
   * @param {string} listingId - Listing ID
   */
  _openBuyModal(listingId) {
    const listing = this.listings.find(l => String(l.id) === String(listingId));
    if (!listing) return;

    const resourceInfo = CONSTANTS.RESOURCE_TYPES[listing.resource_type];
    if (!resourceInfo) return;

    const playerCredits = UIState.get('credits') || 0;
    const maxAffordable = Math.floor(playerCredits / listing.price_per_unit);
    const maxQuantity = Math.min(listing.quantity, maxAffordable);

    const content = document.createElement('div');
    content.className = 'sell-form';
    content.innerHTML = `
      <div style="text-align: center; margin-bottom: 16px;">
        <div id="buy-modal-icon" style="margin-bottom: 8px;"></div>
        <div style="color: var(--color-primary-lighter); font-weight: bold;">${resourceInfo.name}</div>
        <div style="font-size: 12px; color: var(--color-text-muted);">
          ${listing.price_per_unit} cr/unit | Available: ${listing.quantity}
        </div>
        <div style="font-size: 12px; color: var(--color-text-muted);">
          Seller: ${listing.seller_name || 'Unknown'}
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Quantity to buy</label>
        <div class="input-number-group">
          <button class="btn btn-sm" id="buy-qty-minus">-</button>
          <input type="number" class="input" id="buy-quantity" value="1" min="1" max="${maxQuantity}">
          <button class="btn btn-sm" id="buy-qty-plus">+</button>
          <button class="btn btn-sm" id="buy-qty-max">Max</button>
        </div>
        ${maxAffordable < listing.quantity ?
          `<div style="font-size: 11px; color: var(--color-warning); margin-top: 4px;">
            You can afford up to ${maxAffordable} units
          </div>` : ''}
      </div>

      <div class="sell-form-preview">
        <div class="sell-form-preview-label">Total cost</div>
        <div class="sell-form-preview-value" id="buy-total">${listing.price_per_unit} cr</div>
        <div style="font-size: 11px; color: var(--color-text-muted); margin-top: 4px;">
          Your credits: ${playerCredits} cr
        </div>
      </div>
    `;

    const modal = Modal.open({
      content,
      title: 'Buy Resource',
      className: 'modal-dialog'
    });

    // Inject icon
    const iconContainer = content.querySelector('#buy-modal-icon');
    if (iconContainer && typeof IconFactory !== 'undefined') {
      const icon = IconFactory.createResourceIcon(listing.resource_type, 48);
      iconContainer.appendChild(icon);
    }

    // Get input elements
    const qtyInput = content.querySelector('#buy-quantity');
    const totalDisplay = content.querySelector('#buy-total');

    // Update total preview
    const updateTotal = () => {
      const qty = parseInt(qtyInput.value) || 0;
      const total = qty * listing.price_per_unit;
      totalDisplay.textContent = `${total} cr`;

      // Highlight if can't afford
      if (total > playerCredits) {
        totalDisplay.style.color = 'var(--color-danger)';
      } else {
        totalDisplay.style.color = 'var(--color-warning)';
      }
    };

    // Quantity controls
    content.querySelector('#buy-qty-minus').addEventListener('click', () => {
      qtyInput.value = Math.max(1, parseInt(qtyInput.value) - 1);
      updateTotal();
    });

    content.querySelector('#buy-qty-plus').addEventListener('click', () => {
      qtyInput.value = Math.min(maxQuantity, parseInt(qtyInput.value) + 1);
      updateTotal();
    });

    content.querySelector('#buy-qty-max').addEventListener('click', () => {
      qtyInput.value = maxQuantity;
      updateTotal();
    });

    qtyInput.addEventListener('input', () => {
      let val = parseInt(qtyInput.value) || 1;
      val = Math.max(1, Math.min(maxQuantity, val));
      qtyInput.value = val;
      updateTotal();
    });

    // Add action buttons
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    actions.innerHTML = `
      <button class="btn" id="buy-cancel">Cancel</button>
      <button class="btn btn-success" id="buy-confirm" ${maxQuantity === 0 ? 'disabled' : ''}>
        ${maxQuantity === 0 ? 'Cannot Afford' : 'Buy'}
      </button>
    `;
    content.appendChild(actions);

    // Cancel
    actions.querySelector('#buy-cancel').addEventListener('click', () => {
      modal.close();
    });

    // Confirm
    actions.querySelector('#buy-confirm').addEventListener('click', () => {
      const quantity = parseInt(qtyInput.value);
      const total = quantity * listing.price_per_unit;

      if (quantity > 0 && total <= playerCredits) {
        // Play buy sound
        if (typeof AudioManager !== 'undefined') {
          AudioManager.play('market_buy');
        }
        // Send to server
        if (typeof Network !== 'undefined' && Network.sendMarketBuy) {
          Network.sendMarketBuy(listing.id, quantity);
        }
        modal.close();
      }
    });
  },

  /**
   * Open detail modal for a listing
   * @param {string} listingId - Listing ID
   */
  _openDetailModal(listingId) {
    const listing = this.listings.find(l => String(l.id) === String(listingId));
    if (!listing) return;

    const resourceInfo = CONSTANTS.RESOURCE_TYPES[listing.resource_type];
    if (!resourceInfo) return;

    const description = resourceInfo.description || IconFactory.getDescription(listing.resource_type);
    const totalPrice = listing.price_per_unit * listing.quantity;

    const content = document.createElement('div');
    content.innerHTML = `
      <div style="text-align: center; margin-bottom: 20px;">
        <div id="detail-modal-icon" style="margin-bottom: 12px;"></div>
        <div style="font-size: 18px; color: var(--color-primary-lighter); font-weight: bold;">${resourceInfo.name}</div>
        <span class="badge badge-${resourceInfo.rarity}" style="margin-top: 8px;">${resourceInfo.rarity}</span>
      </div>

      <p style="color: var(--color-text-muted); font-size: 13px; line-height: 1.6; margin-bottom: 20px; text-align: center;">
        ${description}
      </p>

      <div style="border-top: 1px solid var(--color-border-lighter); padding-top: 16px;">
        <div class="panel-detail-stat">
          <span class="panel-detail-stat-label">Quantity</span>
          <span class="panel-detail-stat-value">${listing.quantity}</span>
        </div>
        <div class="panel-detail-stat">
          <span class="panel-detail-stat-label">Price per unit</span>
          <span class="panel-detail-stat-value" style="color: var(--color-warning);">${listing.price_per_unit} cr</span>
        </div>
        <div class="panel-detail-stat">
          <span class="panel-detail-stat-label">Total price</span>
          <span class="panel-detail-stat-value" style="color: var(--color-warning);">${totalPrice} cr</span>
        </div>
        <div class="panel-detail-stat">
          <span class="panel-detail-stat-label">Seller</span>
          <span class="panel-detail-stat-value">${listing.seller_name || 'Unknown'}</span>
        </div>
      </div>
    `;

    const modal = Modal.open({
      content,
      title: 'Listing Details',
      className: 'modal-dialog'
    });

    // Inject icon
    const iconContainer = content.querySelector('#detail-modal-icon');
    if (iconContainer && typeof IconFactory !== 'undefined') {
      const icon = IconFactory.createResourceIcon(listing.resource_type, 64);
      iconContainer.appendChild(icon);
    }

    // Add action buttons
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    actions.innerHTML = `
      <button class="btn" id="detail-close">Close</button>
      <button class="btn btn-success" id="detail-buy">Buy This</button>
    `;
    content.appendChild(actions);

    actions.querySelector('#detail-close').addEventListener('click', () => {
      modal.close();
    });

    actions.querySelector('#detail-buy').addEventListener('click', () => {
      modal.close();
      this._openBuyModal(listingId);
    });
  },

  /**
   * Cancel a listing
   * @param {string} listingId - Listing ID
   */
  async _cancelListing(listingId) {
    const confirmed = await Modal.confirm({
      title: 'Cancel Listing',
      message: 'Are you sure you want to cancel this listing? Resources will be returned to your cargo.',
      confirmText: 'Cancel Listing',
      cancelText: 'Keep Listed',
      confirmClass: 'btn-danger'
    });

    if (confirmed && typeof Network !== 'undefined' && Network.sendMarketCancel) {
      // Play cancel sound
      if (typeof AudioManager !== 'undefined') {
        AudioManager.play('market_cancel');
      }
      Network.sendMarketCancel(listingId);
    }
  },

  /**
   * Request market listings from server
   */
  _requestListings() {
    if (typeof Network !== 'undefined' && Network.sendMarketGetListings) {
      Network.sendMarketGetListings();
    }
  },

  /**
   * Request my listings from server
   */
  _requestMyListings() {
    if (typeof Network !== 'undefined' && Network.sendMarketGetMyListings) {
      Network.sendMarketGetMyListings();
    }
  },

  /**
   * Refresh the panel (called externally)
   */
  refresh() {
    if (this.currentTab === 'browse') {
      this._requestListings();
    } else {
      this._requestMyListings();
    }
    this.render();
  },

  /**
   * Switch to a specific tab
   * @param {string} tab - Tab name ('browse' or 'my-listings')
   */
  switchTab(tab) {
    this.currentTab = tab;
    this.render();
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.MarketPanel = MarketPanel;
}
