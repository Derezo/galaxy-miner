// Galaxy Miner - World Generation (Client)

const World = {
  seed: null,
  sectors: new Map(),
  currentSector: { x: 0, y: 0 },
  worldChanges: new Map(),

  init(seed) {
    this.seed = seed;
    this.sectors.clear();
    this.worldChanges.clear();
    console.log('World initialized with seed:', seed);
  },

  update(playerPosition) {
    // Calculate current sector
    const sectorX = Math.floor(playerPosition.x / CONSTANTS.SECTOR_SIZE);
    const sectorY = Math.floor(playerPosition.y / CONSTANTS.SECTOR_SIZE);

    // Load adjacent sectors if needed
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = `${sectorX + dx}_${sectorY + dy}`;
        if (!this.sectors.has(key)) {
          this.generateSector(sectorX + dx, sectorY + dy);
        }
      }
    }

    // Unload distant sectors (keep memory low)
    for (const [key, sector] of this.sectors) {
      const [sx, sy] = key.split('_').map(Number);
      if (Math.abs(sx - sectorX) > 2 || Math.abs(sy - sectorY) > 2) {
        this.sectors.delete(key);
      }
    }

    this.currentSector = { x: sectorX, y: sectorY };
  },

  generateSector(sectorX, sectorY) {
    const key = `${sectorX}_${sectorY}`;
    const rng = this.seededRandom(this.hash(this.seed, sectorX, sectorY));

    const sector = {
      x: sectorX,
      y: sectorY,
      stars: [],
      planets: [],
      asteroids: [],
      wormholes: []
    };

    // Generate stars
    const starCount = Math.floor(rng() * (CONSTANTS.STARS_PER_SECTOR_MAX - CONSTANTS.STARS_PER_SECTOR_MIN + 1)) + CONSTANTS.STARS_PER_SECTOR_MIN;
    for (let i = 0; i < starCount; i++) {
      const star = {
        id: `${sectorX}_${sectorY}_star_${i}`,
        x: sectorX * CONSTANTS.SECTOR_SIZE + rng() * CONSTANTS.SECTOR_SIZE,
        y: sectorY * CONSTANTS.SECTOR_SIZE + rng() * CONSTANTS.SECTOR_SIZE,
        size: CONSTANTS.STAR_SIZE_MIN + rng() * (CONSTANTS.STAR_SIZE_MAX - CONSTANTS.STAR_SIZE_MIN),
        color: this.getStarColor(rng)
      };
      sector.stars.push(star);

      // Generate planets around star
      const planetCount = Math.floor(rng() * (CONSTANTS.PLANETS_PER_STAR_MAX - CONSTANTS.PLANETS_PER_STAR_MIN + 1)) + CONSTANTS.PLANETS_PER_STAR_MIN;
      for (let j = 0; j < planetCount; j++) {
        const orbitRadius = star.size + 50 + rng() * 200;
        const angle = rng() * Math.PI * 2;
        const planet = {
          id: `${sectorX}_${sectorY}_planet_${i}_${j}`,
          x: star.x + Math.cos(angle) * orbitRadius,
          y: star.y + Math.sin(angle) * orbitRadius,
          size: CONSTANTS.PLANET_SIZE_MIN + rng() * (CONSTANTS.PLANET_SIZE_MAX - CONSTANTS.PLANET_SIZE_MIN),
          type: this.getPlanetType(rng),
          resources: this.getPlanetResources(rng),
          starId: star.id,
          orbitRadius,
          orbitAngle: angle
        };
        sector.planets.push(planet);
      }
    }

    // Generate asteroids
    const asteroidCount = Math.floor(rng() * (CONSTANTS.ASTEROIDS_PER_SECTOR_MAX - CONSTANTS.ASTEROIDS_PER_SECTOR_MIN + 1)) + CONSTANTS.ASTEROIDS_PER_SECTOR_MIN;
    for (let i = 0; i < asteroidCount; i++) {
      const asteroid = {
        id: `${sectorX}_${sectorY}_asteroid_${i}`,
        x: sectorX * CONSTANTS.SECTOR_SIZE + rng() * CONSTANTS.SECTOR_SIZE,
        y: sectorY * CONSTANTS.SECTOR_SIZE + rng() * CONSTANTS.SECTOR_SIZE,
        size: CONSTANTS.ASTEROID_SIZE_MIN + rng() * (CONSTANTS.ASTEROID_SIZE_MAX - CONSTANTS.ASTEROID_SIZE_MIN),
        resources: this.getAsteroidResources(rng)
      };
      sector.asteroids.push(asteroid);
    }

    // Maybe generate wormhole
    if (rng() < CONSTANTS.WORMHOLE_CHANCE) {
      const wormhole = {
        id: `${sectorX}_${sectorY}_wormhole_0`,
        x: sectorX * CONSTANTS.SECTOR_SIZE + rng() * CONSTANTS.SECTOR_SIZE,
        y: sectorY * CONSTANTS.SECTOR_SIZE + rng() * CONSTANTS.SECTOR_SIZE,
        size: CONSTANTS.WORMHOLE_SIZE,
        destinationSector: {
          x: Math.floor(rng() * 100 - 50),
          y: Math.floor(rng() * 100 - 50)
        }
      };
      sector.wormholes.push(wormhole);
    }

    this.sectors.set(key, sector);
    return sector;
  },

  getSector(sectorX, sectorY) {
    const key = `${sectorX}_${sectorY}`;
    if (!this.sectors.has(key)) {
      this.generateSector(sectorX, sectorY);
    }
    return this.sectors.get(key);
  },

  getVisibleObjects(position, viewDistance) {
    const objects = {
      stars: [],
      planets: [],
      asteroids: [],
      wormholes: []
    };

    // Get objects from nearby sectors
    const sectorX = Math.floor(position.x / CONSTANTS.SECTOR_SIZE);
    const sectorY = Math.floor(position.y / CONSTANTS.SECTOR_SIZE);

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const sector = this.getSector(sectorX + dx, sectorY + dy);
        objects.stars.push(...sector.stars);
        objects.planets.push(...sector.planets);
        objects.asteroids.push(...sector.asteroids);
        objects.wormholes.push(...sector.wormholes);
      }
    }

    return objects;
  },

  isObjectDepleted(objectId) {
    return this.worldChanges.has(objectId);
  },

  handleUpdate(data) {
    // Handle world change updates from server
    if (data.depleted) {
      this.worldChanges.set(data.objectId, data.respawnAt);
    } else if (data.respawned) {
      this.worldChanges.delete(data.objectId);
    }
  },

  // Seeded random number generator
  seededRandom(seed) {
    let s = seed;
    return function() {
      s = Math.sin(s * 9999) * 10000;
      return s - Math.floor(s);
    };
  },

  // Hash function for combining seed with coordinates
  hash(seed, x, y) {
    let h = 0;
    const str = `${seed}_${x}_${y}`;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h = h & h;
    }
    return Math.abs(h);
  },

  getStarColor(rng) {
    const colors = ['#ffff00', '#ffaa00', '#ff6600', '#ffffff', '#aaaaff'];
    return colors[Math.floor(rng() * colors.length)];
  },

  getPlanetType(rng) {
    const types = ['rocky', 'gas', 'ice', 'lava', 'ocean'];
    return types[Math.floor(rng() * types.length)];
  },

  getPlanetResources(rng) {
    const resources = [];
    const types = Object.keys(CONSTANTS.RESOURCE_TYPES);
    const count = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < count; i++) {
      resources.push(types[Math.floor(rng() * types.length)]);
    }
    return resources;
  },

  getAsteroidResources(rng) {
    const resources = [];
    const commonTypes = ['IRON', 'CARBON', 'SILICON'];
    resources.push(commonTypes[Math.floor(rng() * commonTypes.length)]);
    if (rng() < 0.3) {
      const rareTypes = ['COPPER', 'TITANIUM', 'PLATINUM'];
      resources.push(rareTypes[Math.floor(rng() * rareTypes.length)]);
    }
    return resources;
  }
};
