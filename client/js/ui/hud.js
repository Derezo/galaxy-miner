// Galaxy Miner - HUD UI

const HUD = {
  latency: 0,
  radarCanvas: null,
  radarCtx: null,

  init() {
    this.radarCanvas = document.getElementById('radar-canvas');
    this.radarCtx = this.radarCanvas.getContext('2d');

    // Set radar canvas size
    this.radarCanvas.width = 150;
    this.radarCanvas.height = 150;

    // Initialize the modular radar system
    if (typeof Radar !== 'undefined') {
      Radar.init(this.radarCanvas);
    }

    // Button handlers
    document.getElementById('btn-terminal').addEventListener('click', () => TerminalUI.toggle());

    // Start latency ping
    setInterval(() => Network.ping(), 5000);

    console.log('HUD initialized');
  },

  update() {
    if (!GalaxyMiner.gameStarted) return;

    // Update player info
    document.getElementById('player-name').textContent = Player.username;
    document.getElementById('player-credits').textContent = `Credits: ${Player.credits}`;

    // Update sector coords
    const sectorX = Math.floor(Player.position.x / CONSTANTS.SECTOR_SIZE);
    const sectorY = Math.floor(Player.position.y / CONSTANTS.SECTOR_SIZE);
    document.getElementById('sector-coords').textContent = `${sectorX}, ${sectorY}`;

    // Update health bars
    const hullPercent = (Player.hull.current / Player.hull.max) * 100;
    const shieldPercent = (Player.shield.current / Player.shield.max) * 100;
    document.getElementById('hull-bar').style.width = `${hullPercent}%`;
    document.getElementById('shield-bar').style.width = `${shieldPercent}%`;

    // Update boost bar
    this.updateBoostBar();

    // Update radar
    this.drawRadar();
  },

  drawRadar() {
    const ctx = this.radarCtx;
    const radarRange = Player.getRadarRange();
    const radarTier = Player.ship.radarTier || 1;

    // Use the modular radar system if available
    if (typeof Radar !== 'undefined' && Radar.initialized) {
      Radar.draw(ctx, radarRange, radarTier);
      return;
    }

    // Fallback to basic radar rendering if modules not loaded
    const size = 150;
    const center = size / 2;

    // Clear
    ctx.fillStyle = 'rgba(0, 0, 34, 0.8)';
    ctx.beginPath();
    ctx.arc(center, center, center, 0, Math.PI * 2);
    ctx.fill();

    // Draw range circles
    ctx.strokeStyle = '#333366';
    ctx.lineWidth = 1;
    for (let r = 0.25; r <= 1; r += 0.25) {
      ctx.beginPath();
      ctx.arc(center, center, center * r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw crosshairs
    ctx.beginPath();
    ctx.moveTo(center, 0);
    ctx.lineTo(center, size);
    ctx.moveTo(0, center);
    ctx.lineTo(size, center);
    ctx.stroke();

    // Scale factor
    const scale = center / radarRange;

    // Draw world objects (asteroids, planets)
    const objects = World.getVisibleObjects(Player.position, radarRange);

    // Asteroids as small gray dots
    ctx.fillStyle = '#666666';
    for (const asteroid of objects.asteroids) {
      const dx = asteroid.x - Player.position.x;
      const dy = asteroid.y - Player.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radarRange) continue;

      const rx = center + dx * scale;
      const ry = center + dy * scale;
      ctx.beginPath();
      ctx.arc(rx, ry, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Planets as blue dots
    ctx.fillStyle = '#4488ff';
    for (const planet of objects.planets) {
      const dx = planet.x - Player.position.x;
      const dy = planet.y - Player.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radarRange) continue;

      const rx = center + dx * scale;
      const ry = center + dy * scale;
      ctx.beginPath();
      ctx.arc(rx, ry, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw other players as triangles showing heading
    ctx.fillStyle = '#00aaff';
    for (const [id, player] of Entities.players) {
      const dx = player.position.x - Player.position.x;
      const dy = player.position.y - Player.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radarRange) continue;

      const rx = center + dx * scale;
      const ry = center + dy * scale;
      const rotation = player.rotation || 0;

      // Draw triangle pointing in player's direction
      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(rotation);
      ctx.beginPath();
      ctx.moveTo(5, 0);       // nose
      ctx.lineTo(-3.5, -3);   // left tail
      ctx.lineTo(-3.5, 3);    // right tail
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Draw NPCs
    ctx.fillStyle = '#ff4444';
    for (const [id, npc] of Entities.npcs) {
      const dx = npc.position.x - Player.position.x;
      const dy = npc.position.y - Player.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radarRange) continue;

      const rx = center + dx * scale;
      const ry = center + dy * scale;
      ctx.beginPath();
      ctx.arc(rx, ry, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw player at center (triangle pointing in direction)
    ctx.fillStyle = '#00ff00';
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(Player.rotation);
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -4);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  updateLatency(latency) {
    this.latency = latency;
  },

  updateBoostBar() {
    const boostBar = document.getElementById('boost-bar');
    const boostStatus = document.getElementById('boost-status');
    const boostContainer = document.querySelector('.boost-bar-container');

    if (!boostBar || !Player.isBoostActive) {
      // Player module not fully loaded or no boost methods
      if (boostContainer) boostContainer.style.display = 'none';
      return;
    }

    boostContainer.style.display = 'block';

    if (Player.isBoostActive()) {
      // Boost is active - show remaining duration
      const remaining = Player.boostEndTime - Date.now();
      const duration = CONSTANTS.ENERGY_CORE?.BOOST?.DURATION?.[Player.ship.energyCoreTier || 1] || 1000;
      const percent = Math.max(0, (remaining / duration) * 100);

      boostBar.style.width = `${percent}%`;
      boostBar.classList.add('active');
      boostBar.classList.remove('cooldown');
      boostStatus.textContent = 'ACTIVE';
      boostStatus.className = 'boost-status active';
    } else if (Player.isBoostOnCooldown()) {
      // Boost is on cooldown
      const percent = Player.getBoostCooldownPercent();

      boostBar.style.width = `${percent}%`;
      boostBar.classList.add('cooldown');
      boostBar.classList.remove('active');

      const remainingSec = Math.ceil(Player.getBoostCooldownRemaining() / 1000);
      boostStatus.textContent = `${remainingSec}s`;
      boostStatus.className = 'boost-status cooldown';
    } else {
      // Boost is ready
      boostBar.style.width = '100%';
      boostBar.classList.remove('active', 'cooldown');
      boostStatus.textContent = 'READY';
      boostStatus.className = 'boost-status ready';
    }
  }
};
