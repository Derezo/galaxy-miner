// Galaxy Miner - Inventory UI (Terminal Tab)

const InventoryUI = {
  init() {
    console.log('Inventory UI initialized');
  },

  refresh() {
    // Update cargo info
    const cargoUsed = Player.getCargoUsed();
    const cargoMax = Math.floor(Player.getCargoMax());
    document.getElementById('cargo-used').textContent = cargoUsed;
    document.getElementById('cargo-max').textContent = cargoMax;

    // Update inventory list
    const list = document.getElementById('inventory-list');
    list.innerHTML = '';

    if (Player.inventory.length === 0) {
      list.innerHTML = '<p style="color: #888; grid-column: 1/-1;">No resources in cargo</p>';
      return;
    }

    for (const item of Player.inventory) {
      const resourceInfo = CONSTANTS.RESOURCE_TYPES[item.resource_type];
      if (!resourceInfo) continue;

      const div = document.createElement('div');
      div.className = 'inventory-item';
      div.innerHTML = `
        <div class="name">${resourceInfo.name}</div>
        <div class="quantity">${item.quantity}</div>
        <div class="value" style="color: #888; font-size: 11px;">~${resourceInfo.baseValue * item.quantity} cr</div>
      `;
      list.appendChild(div);
    }
  }
};
