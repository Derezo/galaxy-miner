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

    // Initialize base destruction sequence if available
    if (typeof BaseDestructionSequence !== 'undefined') {
      BaseDestructionSequence.init();
    }

    // Initialize linked damage effect if available
    if (typeof LinkedDamageEffect !== 'undefined') {
      LinkedDamageEffect.init();
    }

    // Initialize formation succession effect if available
    if (typeof FormationSuccessionEffect !== 'undefined') {
      FormationSuccessionEffect.init();
    }

    // Initialize NPC weapon effects if available
    if (typeof NPCWeaponEffects !== 'undefined') {
      NPCWeaponEffects.init();
    }

    // Initialize faction bases if available
    if (typeof FactionBases !== 'undefined') {
      FactionBases.init();
    }

    // Initialize star effects if available
    if (typeof StarEffects !== 'undefined') {
      StarEffects.init();
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

    // Update base destruction sequences
    if (typeof BaseDestructionSequence !== 'undefined') {
      BaseDestructionSequence.update(dt);
    }

    // Update linked damage effect
    if (typeof LinkedDamageEffect !== 'undefined') {
      LinkedDamageEffect.update(dt);
    }

    // Update formation succession effect
    if (typeof FormationSuccessionEffect !== 'undefined') {
      FormationSuccessionEffect.update(dt);
    }

    // Update faction bases animation
    if (typeof FactionBases !== 'undefined') {
      FactionBases.update(dt);
    }

    // Update star effects (corona flares, heat overlay)
    if (typeof StarEffects !== 'undefined' && typeof Player !== 'undefined') {
      const objects = World.getVisibleObjects(Player.position, Math.max(this.canvas.width, this.canvas.height));
      StarEffects.update(dt, objects.stars, Player.position);
    }

    // Update player death effect sequence
    if (typeof PlayerDeathEffect !== 'undefined') {
      PlayerDeathEffect.update(dt);
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

    // Apply screen shake offset from base destruction sequences
    if (typeof BaseDestructionSequence !== 'undefined') {
      const shake = BaseDestructionSequence.getScreenShakeOffset();
      this.camera.x += shake.x;
      this.camera.y += shake.y;
    }

    // Apply screen shake from player death effect
    if (typeof PlayerDeathEffect !== 'undefined') {
      const deathShake = PlayerDeathEffect.getScreenShakeOffset();
      this.camera.x += deathShake.x;
      this.camera.y += deathShake.y;
    }
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
    // Use server-sent positions when available for accurate hit detection
    for (const base of objects.bases) {
      // Skip destroyed bases
      if (typeof Entities !== 'undefined' && Entities.isBaseDestroyed(base.id)) continue;

      // Get server-authoritative position and state if available
      let renderBase = base;
      if (typeof Entities !== 'undefined') {
        const serverBase = Entities.bases.get(base.id);
        if (serverBase && serverBase.position) {
          // Use server position for rendering to match hit detection
          renderBase = {
            ...base,
            x: serverBase.position.x,
            y: serverBase.position.y,
            health: serverBase.health,
            maxHealth: serverBase.maxHealth
          };
        } else {
          // Fallback: check for health state only
          const state = Entities.getBaseState(base.id);
          if (state && state.health !== undefined) {
            renderBase = { ...base, health: state.health, maxHealth: state.maxHealth };
          }
        }
      }

      if (!this.isOnScreen(renderBase.x, renderBase.y, renderBase.size)) continue;

      // Merge health state from Entities into base object for rendering
      let baseWithHealth = renderBase;

      // Use FactionBases module for rendering (with fallback)
      if (typeof FactionBases !== 'undefined' && FactionBases.draw) {
        FactionBases.draw(this.ctx, baseWithHealth, this.camera);
      } else {
        this.drawBase(baseWithHealth);
      }
    }

    // Also render server-known bases that aren't in the procedural list
    if (typeof Entities !== 'undefined') {
      const proceduralIds = new Set(objects.bases.map(b => b.id));
      for (const [baseId, serverBase] of Entities.bases) {
        if (proceduralIds.has(baseId)) continue; // Already rendered
        if (Entities.isBaseDestroyed(baseId)) continue;
        if (!serverBase.position) continue;

        const base = {
          id: baseId,
          x: serverBase.position.x,
          y: serverBase.position.y,
          size: serverBase.size || 100,
          faction: serverBase.faction,
          type: serverBase.type,
          name: serverBase.name,
          health: serverBase.health,
          maxHealth: serverBase.maxHealth
        };

        if (!this.isOnScreen(base.x, base.y, base.size)) continue;

        if (typeof FactionBases !== 'undefined' && FactionBases.draw) {
          FactionBases.draw(this.ctx, base, this.camera);
        } else {
          this.drawBase(base);
        }
      }
    }
  },

  drawStar(star) {
    const screen = this.worldToScreen(star.x, star.y);
    const ctx = this.ctx;
    const size = star.size || 400;

    // Draw corona glow effect first (background layer)
    if (typeof StarEffects !== 'undefined') {
      StarEffects.drawCoronaGlow(ctx, screen.x, screen.y, star);
    }

    // Animated surface turbulence
    const time = Date.now() * 0.001;
    const turbulence = 0.95 + Math.sin(time * 3 + star.x * 0.01) * 0.05;

    // Main star body with multi-layer gradient
    const gradient = ctx.createRadialGradient(
      screen.x, screen.y, 0,
      screen.x, screen.y, size * turbulence
    );

    // Get star colors based on type
    const colorSchemes = {
      '#ffff00': { core: '#ffffff', mid: '#ffff88', outer: '#ffaa00' },
      '#ffaa00': { core: '#ffffff', mid: '#ffcc44', outer: '#ff6600' },
      '#ff6600': { core: '#ffff88', mid: '#ff8844', outer: '#cc2200' },
      '#ffffff': { core: '#ffffff', mid: '#ddddff', outer: '#8888cc' },
      '#aaaaff': { core: '#ffffff', mid: '#aaddff', outer: '#4466aa' }
    };
    const scheme = colorSchemes[star.color] || colorSchemes['#ffff00'];

    gradient.addColorStop(0, scheme.core);
    gradient.addColorStop(0.25, scheme.mid);
    gradient.addColorStop(0.7, star.color);
    gradient.addColorStop(0.9, scheme.outer + 'aa');
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, size * turbulence, 0, Math.PI * 2);
    ctx.fill();

    // Animated dark spots on surface (sunspots)
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#000000';
    for (let i = 0; i < 3; i++) {
      const spotAngle = time * 0.2 + i * 2;
      const spotDist = size * 0.4 * (0.5 + Math.sin(time * 0.5 + i) * 0.3);
      const spotX = screen.x + Math.cos(spotAngle) * spotDist;
      const spotY = screen.y + Math.sin(spotAngle) * spotDist;
      const spotSize = size * 0.08 * (0.5 + Math.sin(time + i * 1.5) * 0.5);

      ctx.beginPath();
      ctx.arc(spotX, spotY, spotSize, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Bright white core
    const coreGradient = ctx.createRadialGradient(
      screen.x, screen.y, 0,
      screen.x, screen.y, size * 0.3
    );
    coreGradient.addColorStop(0, '#ffffff');
    coreGradient.addColorStop(0.5, '#ffffee');
    coreGradient.addColorStop(1, 'transparent');

    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, size * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Draw danger zone indicator (subtle ring at warm zone boundary)
    const zones = CONSTANTS.STAR_ZONES || { CORONA: 1.5, WARM: 1.3 };
    ctx.save();
    ctx.globalAlpha = 0.1 + Math.sin(time * 2) * 0.05;
    ctx.strokeStyle = '#ff6600';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 20]);
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, size * zones.WARM, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
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

  /**
   * Legacy fallback for base drawing (only used if FactionBases module is unavailable)
   * @deprecated Use FactionBases module for rendering
   */
  drawBase(base) {
    const screen = this.worldToScreen(base.x, base.y);
    const ctx = this.ctx;

    // Simple fallback rendering - octagonal base with faction color
    const colors = {
      pirate: '#ff3300',
      scavenger: '#999966',
      swarm: '#8b0000',
      void: '#9900ff',
      rogue_miner: '#ff9900'
    };

    const color = colors[base.faction] || '#888888';

    ctx.save();
    ctx.translate(screen.x, screen.y);

    // Simple octagonal base
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const x = Math.cos(angle) * base.size * 0.8;
      const y = Math.sin(angle) * base.size * 0.8;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    // Border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Name label
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(base.name, 0, base.size + 20);

    ctx.restore();
  },

  drawWreckage() {
    const ctx = this.ctx;
    const dt = this.lastDt;

    // Faction colors for wreckage
    const FACTION_COLORS = {
      pirate: '#ff3300',
      scavenger: '#999966',
      swarm: '#8b0000',
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

      this.drawShip(player.position, player.rotation, 'other', player.username, 1, player.colorId);

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

    // Draw player death wreckage particles (in world space)
    if (typeof PlayerDeathEffect !== 'undefined') {
      PlayerDeathEffect.drawWreckage(ctx, this.camera);
    }

    // Draw base destruction sequences
    if (typeof BaseDestructionSequence !== 'undefined') {
      BaseDestructionSequence.draw(ctx, this.camera);
    }

    // Draw linked damage effects (swarm)
    if (typeof LinkedDamageEffect !== 'undefined') {
      LinkedDamageEffect.draw(ctx, this.camera);
    }

    // Draw formation succession effects (void)
    if (typeof FormationSuccessionEffect !== 'undefined') {
      FormationSuccessionEffect.draw(ctx, this.camera);
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
    const screen = this.worldToScreen(Player.position.x, Player.position.y);

    // Draw invulnerability glow if active (behind ship)
    if (typeof PlayerDeathEffect !== 'undefined' && PlayerDeathEffect.isInvulnerable()) {
      PlayerDeathEffect.drawInvulnerabilityGlow(ctx, screen.x, screen.y, ShipGeometry.SIZE);
    }

    // Draw player ship with custom color
    this.drawShip(Player.position, Player.rotation, 'player', Player.username, visualTier, Player.colorId);

    // Draw thrust effect
    if (Player.isThrusting()) {
      const isBoosting = Player.isBoostActive && Player.isBoostActive();
      ThrustRenderer.draw(
        ctx,
        Player.position,
        Player.rotation,
        Player.velocity,
        this.camera,
        Player.ship.engineTier,
        Player.getThrustIntensity(),
        dt,
        isBoosting
      );
    } else if (Player.isBoostActive && Player.isBoostActive()) {
      // Clear boost trail when not thrusting
      ThrustRenderer.clearBoostTrail();
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
   * Draw a ship with tier-based graphics and custom colors
   * @param {Object} position - World position
   * @param {number} rotation - Rotation in radians
   * @param {string} type - 'player', 'other', or 'npc'
   * @param {string} name - Player name (null for NPCs)
   * @param {number} tier - Visual tier 1-5
   * @param {string} colorId - Optional custom color ID for players
   */
  drawShip(position, rotation, type, name, tier, colorId = null) {
    tier = tier || 1;
    const screen = this.worldToScreen(position.x, position.y);
    const ctx = this.ctx;

    // Get colors using the new getShipColors method that supports custom colors
    const colors = ShipGeometry.getShipColors(type, tier, colorId);
    const scale = ShipGeometry.SIZE_SCALE[tier] || 1;
    const glowIntensity = ShipGeometry.GLOW_INTENSITY[tier] || 0;
    const isPlayer = type === 'player';

    ctx.save();
    ctx.translate(screen.x, screen.y);
    ctx.rotate(rotation);

    // Use the gradient-based drawing for better visuals
    ShipGeometry.drawWithGradient(ctx, tier, colors, isPlayer);

    ctx.restore();

    // Draw cockpit accent (tier 2+) - handled by drawWithGradient

    // Draw name tag below ship
    if (name) {
      ctx.fillStyle = colors.accent;
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(name, screen.x, screen.y + ShipGeometry.SIZE * scale + 5);
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
    if (target.resources) {
      // Handle both array and string resources
      const resourceList = Array.isArray(target.resources) ? target.resources : [target.resources];
      if (resourceList.length > 0) {
        // Show potential resources
        const resourceNames = resourceList.map(r => {
          const info = CONSTANTS.RESOURCE_TYPES[r];
          return info ? info.name : r;
        });
        targetName = resourceNames.slice(0, 2).join(', ');
        if (resourceList.length > 2) targetName += '...';
      }
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
    // Draw heat overlay when near stars
    if (typeof StarEffects !== 'undefined') {
      StarEffects.drawHeatOverlay(this.ctx, this.canvas.width, this.canvas.height);
      StarEffects.drawZoneWarning(this.ctx, this.canvas.width, this.canvas.height);
    }

    // Draw mining result notification
    this.drawMiningNotification();

    // Draw player death effect overlay (on top of everything)
    if (typeof PlayerDeathEffect !== 'undefined') {
      PlayerDeathEffect.draw(this.ctx, this.canvas.width, this.canvas.height);
    }
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

      if (effect.type === 'damage_number') {
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

// Global callback for PlayerDeathEffect to complete respawn after death sequence
window.handleRespawnComplete = function(respawnData) {
  if (typeof Player !== 'undefined') {
    Player.onRespawn(respawnData);
  }
};
