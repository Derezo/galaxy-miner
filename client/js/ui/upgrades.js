// Galaxy Miner - Upgrades UI (Terminal Tab)

const UpgradesUI = {
  init() {
    console.log('Upgrades UI initialized');
  },

  refresh() {

    const list = document.getElementById('upgrades-list');
    const components = [
      { key: 'engine', name: 'Engine', effect: 'Speed' },
      { key: 'weapon', name: 'Weapon', effect: 'Damage & Range' },
      { key: 'shield', name: 'Shield', effect: 'Capacity & Recharge' },
      { key: 'mining', name: 'Mining Laser', effect: 'Mining Speed' },
      { key: 'cargo', name: 'Cargo Hold', effect: 'Inventory Capacity' },
      { key: 'radar', name: 'Radar', effect: 'Detection Range' }
    ];

    list.innerHTML = components.map(comp => {
      const tierKey = comp.key === 'engine' ? 'engineTier' :
                      comp.key === 'weapon' ? 'weaponTier' :
                      comp.key === 'shield' ? 'shieldTier' :
                      comp.key === 'mining' ? 'miningTier' :
                      comp.key === 'cargo' ? 'cargoTier' : 'radarTier';
      const currentTier = Player.ship[tierKey] || 1;
      const maxTier = CONSTANTS.MAX_TIER;
      const nextTier = currentTier + 1;
      const cost = CONSTANTS.UPGRADE_COSTS[nextTier] || 0;
      const canAfford = Player.credits >= cost;
      const isMaxed = currentTier >= maxTier;

      return `
        <div class="upgrade-item" style="padding: 10px; margin-bottom: 10px; background: #000022; border: 1px solid #333; border-radius: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="color: #66aaff; font-weight: bold;">${comp.name}</div>
              <div style="color: #888; font-size: 11px;">Improves: ${comp.effect}</div>
              <div style="color: #aaa; font-size: 12px; margin-top: 4px;">
                Tier: ${'★'.repeat(currentTier)}${'☆'.repeat(maxTier - currentTier)}
              </div>
            </div>
            <div style="text-align: right;">
              ${isMaxed ?
                '<span style="color: #66ff66;">MAX</span>' :
                `<div style="color: #ffcc00; font-size: 12px;">${cost} credits</div>
                 <button class="upgrade-btn" data-component="${comp.key}"
                   style="margin-top: 4px; padding: 5px 10px; background: ${canAfford ? '#3366ff' : '#333'}; border: none; border-radius: 3px; color: #fff; cursor: ${canAfford ? 'pointer' : 'not-allowed'};"
                   ${canAfford ? '' : 'disabled'}>
                   Upgrade
                 </button>`
              }
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Add click handlers
    list.querySelectorAll('.upgrade-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const component = btn.dataset.component;
        Network.sendUpgrade(component);
      });
    });
  }
};

// Note: Upgrade event listeners (upgrade:success, upgrade:error) are now
// registered in Network.init() for reliable handling across reconnections
