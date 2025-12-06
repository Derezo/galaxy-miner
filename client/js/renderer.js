// Galaxy Miner - Canvas Renderer
// Integrated with advanced graphics systems

const Renderer = {
  canvas: null,
  ctx: null,
  camera: { x: 0, y: 0 },
  effects: [],
  miningNotification: null,
  lastDt: 0,

  init() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    // Handle resize
    window.addEventListener('resize', () => this.resize());
    this.resize();

    // Initialize graphics systems
    ParticleSystem.init();
    ShipGeometry.init();

    // Initialize NPC ship geometry if available
    if (typeof NPCShipGeometry !== 'undefined') {
      NPCShipGeometry.init();
    }

    // Initialize death effects if available
    if (typeof DeathEffects !== 'undefined') {
      DeathEffects.init();
    }

    // Initialize NPC weapon effects if available
    if (typeof NPCWeaponEffects !== 'undefined') {
      NPCWeaponEffects.init();
    }

    // Initialize faction bases if available
    if (typeof FactionBases !== 'undefined') {
      FactionBases.init();
    }

    console.log('Renderer initialized with advanced graphics');
  },

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },

  /**
   * Update graphics systems (call once per frame before drawing)
   */
  update(dt) {
    this.lastDt = dt;
    ParticleSystem.update(dt);
    WeaponRenderer.update(dt);

    // Update NPC weapon effects
    if (typeof NPCWeaponEffects !== 'undefined') {
      NPCWeaponEffects.update(dt);
    }

    // Update death effects
    if (typeof DeathEffects !== 'undefined') {
      DeathEffects.update(dt);
    }

    // Update faction bases animation
    if (typeof FactionBases !== 'undefined') {
      FactionBases.update(dt);
    }
  },

  clear() {
    this.ctx.fillStyle = CONSTANTS.COLORS.BACKGROUND;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw stars background (parallax effect)
    this.drawStarfield();
  },

  drawStarfield() {
    // Simple static starfield for background
    const ctx = this.ctx;
    ctx.fillStyle = '#ffffff';

    // Use camera position to create parallax
    const offsetX = (this.camera.x * 0.1) % 100;
    const offsetY = (this.camera.y * 0.1) % 100;

    for (let i = 0; i < 100; i++) {
      const x = ((i * 73) % this.canvas.width) - offsetX;
      const y = ((i * 137) % this.canvas.height) - offsetY;
      const size = (i % 3) + 1;
      ctx.globalAlpha = 0.3 + (i % 5) * 0.1;
      ctx.fillRect(x, y, size, size);
    }
    ctx.globalAlpha = 1;
  },

  updateCamera() {
    // Center camera on player
    this.camera.x = Player.position.x - this.canvas.width / 2;
    this.camera.y = Player.position.y - this.canvas.height / 2;
  },

  worldToScreen(x, y) {
    return {
      x: x - this.camera.x,
      y: y - this.camera.y
    };
  },

  isOnScreen(x, y, margin = 100) {
    const screen = this.worldToScreen(x, y);
    return screen.x > -margin &&
           screen.x < this.canvas.width + margin &&
           screen.y > -margin &&
           screen.y < this.canvas.height + margin;
  },

  drawWorld() {
    this.updateCamera();

    const objects = World.getVisibleObjects(Player.position, Math.max(this.canvas.width, this.canvas.height));

    // Draw stars (background layer)
    for (const star of objects.stars) {
      if (!this.isOnScreen(star.x, star.y, star.size)) continue;
      this.drawStar(star);
    }

    // Draw wormholes
    for (const wormhole of objects.wormholes) {
      if (!this.isOnScreen(wormhole.x, wormhole.y, wormhole.size)) continue;
      this.drawWormhole(wormhole);
    }

    // Draw planets
    for (const planet of objects.planets) {
      if (!this.isOnScreen(planet.x, planet.y, planet.size)) continue;
      this.drawPlanet(planet);
    }

    // Draw asteroids
    for (const asteroid of objects.asteroids) {
      if (!this.isOnScreen(asteroid.x, asteroid.y, asteroid.size)) continue;
      this.drawAsteroid(asteroid);
    }

    // Draw faction bases (skip destroyed ones)
    for (const base of objects.bases) {
      if (!this.isOnScreen(base.x, base.y, base.size)) continue;
      // Skip destroyed bases
      if (typeof Entities !== 'undefined' && Entities.isBaseDestroyed(base.id)) continue;
      this.drawBase(base);
    }
  },

  drawStar(star) {
    const screen = this.worldToScreen(star.x, star.y);
    const ctx = this.ctx;

    // Glow effect
    const gradient = ctx.createRadialGradient(
      screen.x, screen.y, 0,
      screen.x, screen.y, star.size
    );
    gradient.addColorStop(0, star.color);
    gradient.addColorStop(0.5, star.color + '88');
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, star.size, 0, Math.PI * 2);
    ctx.fill();

    // Core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, star.size * 0.3, 0, Math.PI * 2);
    ctx.fill();
  },

  drawPlanet(planet) {
    const screen = this.worldToScreen(planet.x, planet.y);
    const ctx = this.ctx;
    const depleted = World.isObjectDepleted(planet.id);

    // Planet body
    const colors = {
      rocky: '#8B4513',
      gas: '#DEB887',
      ice: '#ADD8E6',
      lava: '#FF4500',
      ocean: '#4169E1'
    };

    ctx.fillStyle = depleted ? '#444444' : (colors[planet.type] || CONSTANTS.COLORS.PLANET);
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, planet.size, 0, Math.PI * 2);
    ctx.fill();

    // Border
    ctx.strokeStyle = depleted ? '#333333' : '#666666';
    ctx.lineWidth = 2;
    ctx.stroke();
  },

  drawAsteroid(asteroid) {
    const screen = this.worldToScreen(asteroid.x, asteroid.y);
    const ctx = this.ctx;
    const depleted = World.isObjectDepleted(asteroid.id);

    ctx.fillStyle = depleted ? '#333333' : CONSTANTS.COLORS.ASTEROID;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, asteroid.size, 0, Math.PI * 2);
    ctx.fill();

    // Rough edges (simple polygon)
    ctx.strokeStyle = depleted ? '#222222' : '#666666';
    ctx.lineWidth = 1;
    ctx.stroke();
  },

  drawWormhole(wormhole) {
    const screen = this.worldToScreen(wormhole.x, wormhole.y);
    const ctx = this.ctx;

    // Swirling effect
    const gradient = ctx.createRadialGradient(
      screen.x, screen.y, 0,
      screen.x, screen.y, wormhole.size
    );
    gradient.addColorStop(0, '#000000');
    gradient.addColorStop(0.5, CONSTANTS.COLORS.WORMHOLE);
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, wormhole.size, 0, Math.PI * 2);
    ctx.fill();

    // Inner ring
    ctx.strokeStyle = CONSTANTS.COLORS.WORMHOLE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, wormhole.size * 0.5, 0, Math.PI * 2);
    ctx.stroke();
  },

  drawBase(base) {
    const screen = this.worldToScreen(base.x, base.y);
    const ctx = this.ctx;
    const time = Date.now() / 1000;

    // Faction colors
    const FACTION_COLORS = {
      pirate: { primary: '#ff3300', secondary: '#cc2200', glow: '#ff6600' },
      scavenger: { primary: '#999966', secondary: '#666644', glow: '#cccc88' },
      swarm: { primary: '#00ff66', secondary: '#00cc44', glow: '#66ff99' },
      void: { primary: '#9900ff', secondary: '#6600cc', glow: '#cc66ff' },
      rogue_miner: { primary: '#ff9900', secondary: '#cc7700', glow: '#ffcc00' }
    };

    const colors = FACTION_COLORS[base.faction] || FACTION_COLORS.pirate;

    ctx.save();
    ctx.translate(screen.x, screen.y);

    // Draw based on base type
    switch (base.type) {
      case 'pirate_outpost':
        this.drawPirateOutpost(ctx, base.size, colors, time);
        break;
      case 'scavenger_yard':
        this.drawScavengerYard(ctx, base.size, colors, time);
        break;
      case 'swarm_hive':
        this.drawSwarmHive(ctx, base.size, colors, time);
        break;
      case 'void_rift':
        this.drawVoidRift(ctx, base.size, colors, time);
        break;
      case 'mining_claim':
        this.drawMiningClaim(ctx, base.size, colors, time);
        break;
      default:
        // Generic base
        this.drawGenericBase(ctx, base.size, colors, time);
    }

    // Draw name label
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(base.name, 0, base.size + 20);

    // Draw health bar if damaged
    if (base.health < base.maxHealth) {
      const barWidth = base.size * 1.5;
      const barHeight = 6;
      const healthPct = base.health / base.maxHealth;

      ctx.fillStyle = '#333333';
      ctx.fillRect(-barWidth / 2, base.size + 25, barWidth, barHeight);
      ctx.fillStyle = healthPct > 0.5 ? '#00ff00' : healthPct > 0.25 ? '#ffff00' : '#ff0000';
      ctx.fillRect(-barWidth / 2, base.size + 25, barWidth * healthPct, barHeight);
    }

    ctx.restore();
  },

  drawPirateOutpost(ctx, size, colors, time) {
    // Central station - angular, aggressive design
    const pulse = 0.9 + Math.sin(time * 2) * 0.1;

    // Main structure (hexagonal)
    ctx.fillStyle = colors.primary;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * size * 0.7;
      const y = Math.sin(angle) * size * 0.7;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    // Center core
    ctx.fillStyle = colors.glow;
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Docking arms (3 extending outward)
    ctx.strokeStyle = colors.secondary;
    ctx.lineWidth = 8;
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + time * 0.1;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * size * 0.5, Math.sin(angle) * size * 0.5);
      ctx.lineTo(Math.cos(angle) * size, Math.sin(angle) * size);
      ctx.stroke();

      // Docked ship indicator
      ctx.fillStyle = colors.glow;
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * size, Math.sin(angle) * size, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Warning lights
    ctx.fillStyle = Math.sin(time * 5) > 0 ? '#ff0000' : '#440000';
    ctx.beginPath();
    ctx.arc(size * 0.6, 0, 5, 0, Math.PI * 2);
    ctx.fill();
  },

  drawScavengerYard(ctx, size, colors, time) {
    // Debris field with hidden ships - asymmetric, patched together
    const pulse = 0.8 + Math.sin(time * 1.5) * 0.2;

    // Scattered debris (irregular shapes)
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + i * 0.3;
      const dist = size * (0.3 + (i % 3) * 0.25);
      const debrisSize = 10 + (i % 4) * 8;

      ctx.save();
      ctx.translate(Math.cos(angle) * dist, Math.sin(angle) * dist);
      ctx.rotate(time * 0.2 + i);

      ctx.fillStyle = i % 3 === 0 ? colors.primary : colors.secondary;
      ctx.fillRect(-debrisSize / 2, -debrisSize / 3, debrisSize, debrisSize * 0.6);
      ctx.restore();
    }

    // Hidden glow at center
    ctx.fillStyle = colors.glow;
    ctx.globalAlpha = pulse * 0.5;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Central salvager ship
    ctx.fillStyle = colors.primary;
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.2);
    ctx.lineTo(size * 0.15, size * 0.15);
    ctx.lineTo(-size * 0.15, size * 0.15);
    ctx.closePath();
    ctx.fill();
  },

  drawSwarmHive(ctx, size, colors, time) {
    // Organic biomass cluster with pulsing veins
    const pulse = 0.8 + Math.sin(time * 3) * 0.2;
    const breathe = 1 + Math.sin(time * 1.5) * 0.05;

    // Outer membrane
    ctx.fillStyle = colors.secondary;
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const wobble = Math.sin(time * 2 + i) * size * 0.1;
      const r = size * breathe + wobble;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else {
        const cp1x = Math.cos(angle - 0.15) * r * 1.1;
        const cp1y = Math.sin(angle - 0.15) * r * 1.1;
        ctx.quadraticCurveTo(cp1x, cp1y, x, y);
      }
    }
    ctx.closePath();
    ctx.fill();

    // Inner core (pulsing)
    ctx.fillStyle = colors.glow;
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.5 * breathe, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Bioluminescent veins
    ctx.strokeStyle = colors.glow;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + time * 0.3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      const endX = Math.cos(angle) * size * 0.9;
      const endY = Math.sin(angle) * size * 0.9;
      const cpX = Math.cos(angle + 0.3) * size * 0.5;
      const cpY = Math.sin(angle + 0.3) * size * 0.5;
      ctx.quadraticCurveTo(cpX, cpY, endX, endY);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  },

  drawVoidRift(ctx, size, colors, time) {
    // Swirling dark portal with purple energy
    const pulse = 0.7 + Math.sin(time * 4) * 0.3;

    // Outer energy ring
    ctx.strokeStyle = colors.glow;
    ctx.lineWidth = 4;
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Dark center (the rift itself)
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.8);
    gradient.addColorStop(0, '#000000');
    gradient.addColorStop(0.5, colors.secondary);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.8, 0, Math.PI * 2);
    ctx.fill();

    // Swirling energy tendrils
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const baseAngle = time * 2 + (i / 4) * Math.PI * 2;
      ctx.beginPath();
      for (let j = 0; j < 20; j++) {
        const t = j / 20;
        const angle = baseAngle + t * Math.PI * 2;
        const r = size * 0.2 + t * size * 0.6;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (j === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Central singularity
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.15, 0, Math.PI * 2);
    ctx.fill();
  },

  drawMiningClaim(ctx, size, colors, time) {
    // Industrial platform with asteroid
    const pulse = 0.9 + Math.sin(time * 2) * 0.1;

    // Industrial platform (rectangular)
    ctx.fillStyle = colors.secondary;
    ctx.fillRect(-size * 0.8, -size * 0.3, size * 1.6, size * 0.6);

    // Platform details (stripes)
    ctx.fillStyle = '#000000';
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(-size * 0.7 + i * size * 0.35, -size * 0.25, size * 0.05, size * 0.5);
    }

    // Warning stripes
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(-size * 0.8, -size * 0.35, size * 1.6, size * 0.05);
    ctx.fillRect(-size * 0.8, size * 0.3, size * 1.6, size * 0.05);

    // Central drill/mining rig
    ctx.fillStyle = colors.primary;
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.5);
    ctx.lineTo(size * 0.2, 0);
    ctx.lineTo(-size * 0.2, 0);
    ctx.closePath();
    ctx.fill();

    // Attached asteroid
    ctx.fillStyle = '#666666';
    ctx.beginPath();
    ctx.arc(size * 0.5, -size * 0.4, size * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Mining laser (active)
    ctx.strokeStyle = colors.glow;
    ctx.lineWidth = 2;
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.3);
    ctx.lineTo(size * 0.35, -size * 0.35);
    ctx.stroke();
    ctx.globalAlpha = 1;
  },

  drawGenericBase(ctx, size, colors, time) {
    // Simple octagonal base
    ctx.fillStyle = colors.primary;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const x = Math.cos(angle) * size * 0.8;
      const y = Math.sin(angle) * size * 0.8;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    // Border
    ctx.strokeStyle = colors.glow;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Center
    ctx.fillStyle = colors.glow;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
    ctx.fill();
  },

  drawWreckage() {
    const ctx = this.ctx;
    const dt = this.lastDt;

    // Faction colors for wreckage
    const FACTION_COLORS = {
      pirate: '#ff3300',
      scavenger: '#999966',
      swarm: '#00ff66',
      void: '#9900ff',
      rogue_miner: '#ff9900',
      unknown: '#888888'
    };

    // Update wreckage rotation
    Entities.updateWreckageRotation(dt);

    for (const [id, wreckage] of Entities.wreckage) {
      if (!this.isOnScreen(wreckage.position.x, wreckage.position.y, 50)) continue;

      const screen = this.worldToScreen(wreckage.position.x, wreckage.position.y);
      const color = FACTION_COLORS[wreckage.faction] || FACTION_COLORS.unknown;

      ctx.save();
      ctx.translate(screen.x, screen.y);
      ctx.rotate(wreckage.rotation);

      // Draw debris pieces (3-5 scattered pieces)
      const pieceCount = 3 + (wreckage.contentCount % 3);
      const baseSize = 8;

      for (let i = 0; i < pieceCount; i++) {
        const angle = (i / pieceCount) * Math.PI * 2;
        const dist = 5 + (i % 2) * 5;
        const px = Math.cos(angle) * dist;
        const py = Math.sin(angle) * dist;
        const size = baseSize - (i % 3) * 2;

        // Draw piece
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(px, py - size);
        ctx.lineTo(px + size * 0.8, py + size * 0.5);
        ctx.lineTo(px - size * 0.8, py + size * 0.5);
        ctx.closePath();
        ctx.fill();

        // Outline
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5;
        ctx.stroke();
      }

      // Pulsing glow to indicate loot value
      const pulsePhase = (Date.now() / 500) % (Math.PI * 2);
      const pulseIntensity = 0.3 + Math.sin(pulsePhase) * 0.2;
      const glowRadius = 20 + wreckage.contentCount * 2;

      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius);
      gradient.addColorStop(0, color + '66');
      gradient.addColorStop(1, 'transparent');

      ctx.globalAlpha = pulseIntensity;
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Draw label below wreckage
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = color;
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(wreckage.npcName || 'Wreckage', screen.x, screen.y + 25);

      // Draw loot count indicator
      if (wreckage.contentCount > 0) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px monospace';
        ctx.fillText(`x${wreckage.contentCount}`, screen.x, screen.y + 35);
      }

      ctx.globalAlpha = 1;
    }
  },

  // Draw collection progress bar for wreckage
  drawCollectionProgress() {
    if (!Player.collectingWreckage || Player.collectProgress <= 0) return;

    const wreckage = Player.collectingWreckage;
    const screen = this.worldToScreen(wreckage.position.x, wreckage.position.y);
    const ctx = this.ctx;

    const barWidth = 60;
    const barHeight = 8;
    const x = screen.x - barWidth / 2;
    const y = screen.y - 40;

    // Background
    ctx.fillStyle = '#333333';
    ctx.fillRect(x, y, barWidth, barHeight);

    // Progress (golden color for loot)
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(x, y, barWidth * Math.min(1, Player.collectProgress), barHeight);

    // Border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, barWidth, barHeight);

    // Label
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Collecting...', screen.x, y - 4);
  },

  drawEntities() {
    const ctx = this.ctx;
    const dt = this.lastDt;

    // Draw wreckage (behind beams and ships)
    this.drawWreckage();

    // Draw tractor beam first (behind everything)
    if (Player.miningTarget && Player.miningProgress > 0) {
      const resourceType = Player.miningTarget.resources?.[0] || 'default';
      TractorBeamRenderer.draw(
        ctx,
        Player.position,
        { x: Player.miningTarget.x, y: Player.miningTarget.y },
        this.camera,
        Player.ship.miningTier,
        Player.miningProgress,
        resourceType,
        dt
      );
    }

    // Draw loot collection tractor beam
    if (Player.collectingWreckage && Player.collectProgress > 0) {
      TractorBeamRenderer.draw(
        ctx,
        Player.position,
        Player.collectingWreckage.position,
        this.camera,
        Player.ship.miningTier,
        Player.collectProgress,
        'loot',
        dt
      );
    }

    // Draw other players
    for (const [id, player] of Entities.players) {
      if (!this.isOnScreen(player.position.x, player.position.y)) continue;

      // Draw tractor beam if player is mining
      if (player.mining) {
        TractorBeamRenderer.draw(
          ctx,
          player.position,
          { x: player.mining.targetX, y: player.mining.targetY },
          this.camera,
          player.mining.miningTier || 1,
          0.7, // constant intensity for other players
          player.mining.resourceType || 'default',
          dt
        );
      }

      this.drawShip(player.position, player.rotation, 'other', player.username, 1);

      // Draw status icon above player if not idle
      if (player.status && player.status !== 'idle') {
        const screen = this.worldToScreen(player.position.x, player.position.y);
        StatusIconRenderer.draw(ctx, screen.x, screen.y, player.status);
      }
    }

    // Draw NPCs with faction-specific graphics
    for (const [id, npc] of Entities.npcs) {
      if (!this.isOnScreen(npc.position.x, npc.position.y)) continue;

      // Use faction-specific ship renderer if available
      if (typeof NPCShipGeometry !== 'undefined' && npc.type) {
        const screen = this.worldToScreen(npc.position.x, npc.position.y);
        NPCShipGeometry.draw(ctx, npc.position, npc.rotation, npc.type, npc.faction, screen);

        // Draw name above NPC
        if (npc.name) {
          ctx.fillStyle = NPCShipGeometry.FACTION_COLORS[npc.faction]?.outline || '#ffffff';
          ctx.font = '10px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(npc.name, screen.x, screen.y - NPCShipGeometry.SIZE * 1.5);
        }

        // Draw health bar for damaged NPCs
        if (npc.hull < npc.hullMax || npc.shield < npc.shieldMax) {
          this.drawNPCHealthBar(npc, screen);
        }
      } else {
        // Fallback to generic ship
        this.drawShip(npc.position, npc.rotation, 'npc', npc.name, 1);
      }
    }

    // Draw weapon projectiles
    WeaponRenderer.draw(ctx, this.camera);

    // Draw NPC weapon effects
    if (typeof NPCWeaponEffects !== 'undefined') {
      NPCWeaponEffects.draw(ctx, this.camera);
    }

    // Draw death effects
    if (typeof DeathEffects !== 'undefined') {
      DeathEffects.draw(ctx, this.camera);
    }

    // Draw emotes
    if (typeof EmoteRenderer !== 'undefined') {
      EmoteRenderer.update();
      EmoteRenderer.draw(ctx, this.camera);
    }

    // Draw particles
    ParticleSystem.draw(ctx, this.camera, this.canvas.width, this.canvas.height);

    // Draw legacy effects
    this.drawEffects();
  },

  drawPlayer() {
    const ctx = this.ctx;
    const dt = this.lastDt;
    const visualTier = ShipGeometry.getVisualTier(Player.ship);

    // Draw player ship
    this.drawShip(Player.position, Player.rotation, 'player', Player.username, visualTier);

    // Draw thrust effect
    if (Player.isThrusting()) {
      ThrustRenderer.draw(
        ctx,
        Player.position,
        Player.rotation,
        Player.velocity,
        this.camera,
        Player.ship.engineTier,
        Player.getThrustIntensity(),
        dt
      );
    }

    // Draw mining progress bar if mining
    if (Player.miningTarget && Player.miningProgress > 0) {
      this.drawMiningProgress();
    }

    // Draw collection progress bar if collecting wreckage
    if (Player.collectingWreckage && Player.collectProgress > 0) {
      this.drawCollectionProgress();
    }
  },

  /**
   * Draw a ship with tier-based graphics
   * @param {Object} position - World position
   * @param {number} rotation - Rotation in radians
   * @param {string} type - 'player', 'other', or 'npc'
   * @param {string} name - Player name (null for NPCs)
   * @param {number} tier - Visual tier 1-5
   */
  drawShip(position, rotation, type, name, tier) {
    tier = tier || 1;
    const screen = this.worldToScreen(position.x, position.y);
    const ctx = this.ctx;

    // Get colors and scale for this tier
    const colors = ShipGeometry.COLORS[type]?.[tier] || ShipGeometry.COLORS.other[1];
    const scale = ShipGeometry.SIZE_SCALE[tier] || 1;
    const glowIntensity = ShipGeometry.GLOW_INTENSITY[tier] || 0;

    ctx.save();
    ctx.translate(screen.x, screen.y);
    ctx.rotate(rotation);
    ctx.scale(scale, scale);

    // Draw outer glow for tier 3+
    if (glowIntensity > 0) {
      const glowRadius = CONSTANTS.SHIP_SIZE * (1.5 + tier * 0.2);
      const gradient = ctx.createRadialGradient(0, 0, CONSTANTS.SHIP_SIZE * 0.5, 0, 0, glowRadius);
      gradient.addColorStop(0, colors.glow);
      gradient.addColorStop(1, 'transparent');

      ctx.globalAlpha = glowIntensity;
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Draw main hull using cached Path2D
    const shipPath = ShipGeometry.cachedPaths[tier];
    if (shipPath) {
      ctx.fillStyle = colors.hull;
      ctx.fill(shipPath);

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke(shipPath);
    }

    // Draw cockpit accent (tier 2+)
    const cockpitPath = ShipGeometry.cachedCockpits[tier];
    if (cockpitPath) {
      ctx.fillStyle = colors.accent;
      ctx.fill(cockpitPath);

      ctx.strokeStyle = '#ffffff40';
      ctx.lineWidth = 0.5;
      ctx.stroke(cockpitPath);
    }

    ctx.restore();

    // Draw name above ship
    if (name) {
      const size = CONSTANTS.SHIP_SIZE * scale;
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(name, screen.x, screen.y - size - 8);
    }
  },

  /**
   * Draw health bar for NPC
   */
  drawNPCHealthBar(npc, screen) {
    const ctx = this.ctx;
    const barWidth = 40;
    const barHeight = 4;
    const x = screen.x - barWidth / 2;
    const y = screen.y - 30;

    // Shield bar (if NPC has shields)
    if (npc.shieldMax > 0) {
      const shieldRatio = Math.max(0, npc.shield / npc.shieldMax);
      ctx.fillStyle = '#333333';
      ctx.fillRect(x, y - 6, barWidth, barHeight);
      ctx.fillStyle = '#00aaff';
      ctx.fillRect(x, y - 6, barWidth * shieldRatio, barHeight);
    }

    // Hull bar
    const hullRatio = Math.max(0, npc.hull / npc.hullMax);
    ctx.fillStyle = '#333333';
    ctx.fillRect(x, y, barWidth, barHeight);

    // Color based on health
    let hullColor = '#00ff00';
    if (hullRatio < 0.3) hullColor = '#ff3300';
    else if (hullRatio < 0.6) hullColor = '#ffaa00';

    ctx.fillStyle = hullColor;
    ctx.fillRect(x, y, barWidth * hullRatio, barHeight);
  },

  /**
   * Fire weapon - creates visual effect
   */
  fireWeapon() {
    const visualTier = ShipGeometry.getVisualTier(Player.ship);
    WeaponRenderer.fire(
      Player.position,
      Player.rotation,
      Player.ship.weaponTier,
      visualTier
    );
  },

  drawMiningProgress() {
    const screen = this.worldToScreen(Player.miningTarget.x, Player.miningTarget.y);
    const ctx = this.ctx;
    const target = Player.miningTarget;

    // Get target name and resources
    let targetName = target.type || 'Asteroid';
    if (target.resources && target.resources.length > 0) {
      // Show potential resources
      const resourceNames = target.resources.map(r => {
        const info = CONSTANTS.RESOURCE_TYPES[r];
        return info ? info.name : r;
      });
      targetName = resourceNames.slice(0, 2).join(', ');
      if (target.resources.length > 2) targetName += '...';
    }

    // Draw progress bar
    const barWidth = 60;
    const barHeight = 8;
    const x = screen.x - barWidth / 2;
    const y = screen.y - (target.size || 20) - 30;

    // Background
    ctx.fillStyle = '#333333';
    ctx.fillRect(x, y, barWidth, barHeight);

    // Progress
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(x, y, barWidth * Math.min(1, Player.miningProgress), barHeight);

    // Border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, barWidth, barHeight);

    // Label showing what's being mined
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Mining: ' + targetName, screen.x, y - 4);
  },

  showMiningResult(resourceName, quantity) {
    this.miningNotification = {
      text: `+${quantity} ${resourceName}`,
      startTime: Date.now(),
      duration: 2000
    };
  },

  drawMiningNotification() {
    if (!this.miningNotification) return;

    const elapsed = Date.now() - this.miningNotification.startTime;
    if (elapsed > this.miningNotification.duration) {
      this.miningNotification = null;
      return;
    }

    const ctx = this.ctx;
    const alpha = 1 - (elapsed / this.miningNotification.duration);
    const yOffset = -30 - (elapsed * 0.03); // Float upward

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#00ff00';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      this.miningNotification.text,
      this.canvas.width / 2,
      this.canvas.height / 2 + yOffset
    );
    ctx.restore();
  },

  drawUI() {
    // Draw mining result notification
    this.drawMiningNotification();
  },

  addEffect(effect) {
    effect.startTime = Date.now();
    this.effects.push(effect);
  },

  drawEffects() {
    const now = Date.now();
    this.effects = this.effects.filter(effect => {
      const elapsed = now - effect.startTime;
      if (elapsed > effect.duration) return false;

      const screen = this.worldToScreen(effect.x, effect.y);
      const ctx = this.ctx;

      if (effect.type === 'fire') {
        // Legacy fire effect - now handled by WeaponRenderer
        const alpha = 1 - elapsed / effect.duration;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (effect.type === 'damage_number') {
        // Floating damage number
        const alpha = 1 - elapsed / effect.duration;
        const yOffset = -30 - (elapsed * 0.05); // Float upward
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ff4444';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        const text = `-${Math.round(effect.damage)}`;
        ctx.strokeText(text, screen.x, screen.y + yOffset);
        ctx.fillText(text, screen.x, screen.y + yOffset);
        ctx.restore();
      }

      return true;
    });
  }
};
