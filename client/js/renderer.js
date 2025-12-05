// Galaxy Miner - Canvas Renderer

const Renderer = {
  canvas: null,
  ctx: null,
  camera: { x: 0, y: 0 },
  effects: [],

  init() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    // Handle resize
    window.addEventListener('resize', () => this.resize());
    this.resize();

    console.log('Renderer initialized');
  },

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
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

  drawEntities() {
    const ctx = this.ctx;

    // Draw other players
    for (const [id, player] of Entities.players) {
      if (!this.isOnScreen(player.position.x, player.position.y)) continue;
      this.drawShip(player.position, player.rotation, CONSTANTS.COLORS.SHIP_OTHER, player.username);
    }

    // Draw NPCs
    for (const [id, npc] of Entities.npcs) {
      if (!this.isOnScreen(npc.position.x, npc.position.y)) continue;
      this.drawShip(npc.position, npc.rotation, CONSTANTS.COLORS.SHIP_NPC);
    }

    // Draw projectiles
    for (const proj of Entities.projectiles) {
      if (!this.isOnScreen(proj.x, proj.y)) continue;
      this.drawProjectile(proj);
    }

    // Draw effects
    this.drawEffects();
  },

  drawPlayer() {
    this.drawShip(Player.position, Player.rotation, CONSTANTS.COLORS.SHIP_PLAYER, Player.username, true);

    // Draw mining progress if mining
    if (Player.miningTarget && Player.miningProgress > 0) {
      this.drawMiningProgress();
    }
  },

  drawShip(position, rotation, color, name = null, isPlayer = false) {
    const screen = this.worldToScreen(position.x, position.y);
    const ctx = this.ctx;
    const size = CONSTANTS.SHIP_SIZE;

    ctx.save();
    ctx.translate(screen.x, screen.y);
    ctx.rotate(rotation);

    // Draw triangle ship
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.7, -size * 0.6);
    ctx.lineTo(-size * 0.4, 0);
    ctx.lineTo(-size * 0.7, size * 0.6);
    ctx.closePath();
    ctx.fill();

    // Border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Engine glow when thrusting
    if (isPlayer && Input.isKeyDown('ArrowUp')) {
      ctx.fillStyle = '#ff6600';
      ctx.beginPath();
      ctx.moveTo(-size * 0.4, -size * 0.3);
      ctx.lineTo(-size * 0.9, 0);
      ctx.lineTo(-size * 0.4, size * 0.3);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();

    // Draw name above ship
    if (name) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(name, screen.x, screen.y - size - 10);
    }
  },

  drawProjectile(proj) {
    const screen = this.worldToScreen(proj.x, proj.y);
    const ctx = this.ctx;

    const colors = {
      kinetic: '#ffff00',
      energy: '#00ffff',
      explosive: '#ff6600'
    };

    ctx.fillStyle = colors[proj.type] || '#ffffff';
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, 3, 0, Math.PI * 2);
    ctx.fill();
  },

  drawMiningProgress() {
    const screen = this.worldToScreen(Player.miningTarget.x, Player.miningTarget.y);
    const ctx = this.ctx;

    // Draw progress bar
    const barWidth = 50;
    const barHeight = 6;
    const x = screen.x - barWidth / 2;
    const y = screen.y - Player.miningTarget.size - 20;

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
  },

  drawUI() {
    // Any additional canvas-based UI elements
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
        const alpha = 1 - elapsed / effect.duration;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      return true;
    });
  }
};
