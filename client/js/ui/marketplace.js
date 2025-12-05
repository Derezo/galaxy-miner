// Galaxy Miner - Marketplace UI

const MarketplaceUI = {
  visible: false,
  currentTab: 'buy',
  listings: [],

  init() {
    const panel = document.getElementById('market-panel');
    panel.querySelector('.close-btn').addEventListener('click', () => this.hide());

    // Tab handlers
    const tabs = panel.querySelectorAll('.market-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.switchTab(tab.dataset.tab);
      });
    });

    console.log('Marketplace UI initialized');
  },

  toggle() {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  },

  show() {
    this.visible = true;
    document.getElementById('market-panel').classList.remove('hidden');
    this.refresh();
  },

  hide() {
    this.visible = false;
    document.getElementById('market-panel').classList.add('hidden');
  },

  switchTab(tab) {
    this.currentTab = tab;

    // Update tab buttons
    document.querySelectorAll('.market-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });

    this.refresh();
  },

  refresh() {
    if (!this.visible) return;

    const content = document.getElementById('market-content');

    switch (this.currentTab) {
      case 'buy':
        this.renderBuyTab(content);
        break;
      case 'sell':
        this.renderSellTab(content);
        break;
      case 'my-listings':
        this.renderMyListingsTab(content);
        break;
    }
  },

  renderBuyTab(container) {
    container.innerHTML = `
      <div class="market-listings">
        <p style="color: #888;">Loading listings...</p>
      </div>
    `;

    // TODO: Request listings from server
    // For now, show placeholder
    setTimeout(() => {
      if (this.listings.length === 0) {
        container.innerHTML = '<p style="color: #888;">No listings available</p>';
      }
    }, 500);
  },

  renderSellTab(container) {
    container.innerHTML = `
      <div class="sell-form">
        <label>Resource:</label>
        <select id="sell-resource">
          ${Player.inventory.map(item => {
            const info = CONSTANTS.RESOURCE_TYPES[item.resource_type];
            return `<option value="${item.resource_type}">${info ? info.name : item.resource_type} (${item.quantity})</option>`;
          }).join('')}
        </select>

        <label>Quantity:</label>
        <input type="number" id="sell-quantity" min="1" value="1">

        <label>Price per unit:</label>
        <input type="number" id="sell-price" min="1" value="10">

        <button id="sell-submit" class="hud-btn" style="margin-top: 10px;">List for Sale</button>
      </div>
    `;

    if (Player.inventory.length === 0) {
      container.innerHTML = '<p style="color: #888;">No resources to sell</p>';
      return;
    }

    document.getElementById('sell-submit').addEventListener('click', () => {
      const resourceType = document.getElementById('sell-resource').value;
      const quantity = parseInt(document.getElementById('sell-quantity').value);
      const price = parseInt(document.getElementById('sell-price').value);

      if (quantity > 0 && price > 0) {
        Network.sendMarketList(resourceType, quantity, price);
      }
    });
  },

  renderMyListingsTab(container) {
    container.innerHTML = '<p style="color: #888;">Loading your listings...</p>';
    // TODO: Request user's listings from server
  },

  updateListings(listings) {
    this.listings = listings;
    this.refresh();
  }
};
