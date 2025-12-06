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
      wormholes: [],
      bases: []
    };

    // Track all placed objects for spacing checks
    const placedObjects = [];
    const sectorMinX = sectorX * CONSTANTS.SECTOR_SIZE;
    const sectorMinY = sectorY * CONSTANTS.SECTOR_SIZE;
    const sectorMaxX = sectorMinX + CONSTANTS.SECTOR_SIZE;
    const sectorMaxY = sectorMinY + CONSTANTS.SECTOR_SIZE;

    // Helper: check if position is valid (not too close to existing objects)
    const canPlace = (x, y, size) => {
      for (const obj of placedObjects) {
        const dx = x - obj.x;
        const dy = y - obj.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = size + obj.size + CONSTANTS.MIN_OBJECT_SPACING;
        if (dist < minDist) return false;
      }
      return true;
    };

    // Generate stars (with spacing)
    const starCount = Math.floor(rng() * (CONSTANTS.STARS_PER_SECTOR_MAX - CONSTANTS.STARS_PER_SECTOR_MIN + 1)) + CONSTANTS.STARS_PER_SECTOR_MIN;
    for (let i = 0; i < starCount; i++) {
      const size = CONSTANTS.STAR_SIZE_MIN + rng() * (CONSTANTS.STAR_SIZE_MAX - CONSTANTS.STAR_SIZE_MIN);
      let x, y, placed = false;

      for (let attempt = 0; attempt < CONSTANTS.PLACEMENT_MAX_ATTEMPTS; attempt++) {
        x = sectorMinX + size + rng() * (CONSTANTS.SECTOR_SIZE - size * 2);
        y = sectorMinY + size + rng() * (CONSTANTS.SECTOR_SIZE - size * 2);
        if (canPlace(x, y, size)) {
          placed = true;
          break;
        }
      }

      if (!placed) continue;

      const star = {
        id: `${sectorX}_${sectorY}_star_${i}`,
        x,
        y,
        size,
        color: this.getStarColor(rng),
        mass: size * CONSTANTS.STAR_MASS_FACTOR,
        gravityRadius: size * CONSTANTS.GRAVITY_RADIUS_FACTOR
      };
      sector.stars.push(star);
      placedObjects.push({ x, y, size });

      // Generate planets around star (with spacing)
      const planetCount = Math.floor(rng() * (CONSTANTS.PLANETS_PER_STAR_MAX - CONSTANTS.PLANETS_PER_STAR_MIN + 1)) + CONSTANTS.PLANETS_PER_STAR_MIN;
      for (let j = 0; j < planetCount; j++) {
        const orbitRadius = star.size + 50 + rng() * 200;
        const planetSize = CONSTANTS.PLANET_SIZE_MIN + rng() * (CONSTANTS.PLANET_SIZE_MAX - CONSTANTS.PLANET_SIZE_MIN);
        let angle, px, py, planetPlaced = false;

        for (let attempt = 0; attempt < CONSTANTS.PLACEMENT_MAX_ATTEMPTS; attempt++) {
          angle = rng() * Math.PI * 2;
          px = star.x + Math.cos(angle) * orbitRadius;
          py = star.y + Math.sin(angle) * orbitRadius;
          if (canPlace(px, py, planetSize)) {
            planetPlaced = true;
            break;
          }
        }

        if (!planetPlaced) continue;

        // Orbit speed inversely proportional to orbit radius (Kepler-ish)
        const orbitSpeed = CONSTANTS.PLANET_ORBIT_SPEED_BASE * (star.mass / orbitRadius);

        const planet = {
          id: `${sectorX}_${sectorY}_planet_${i}_${j}`,
          x: px,
          y: py,
          size: planetSize,
          type: this.getPlanetType(rng),
          resources: this.getPlanetResources(rng),
          starId: star.id,
          orbitRadius,
          orbitAngle: angle,
          orbitSpeed
        };
        sector.planets.push(planet);
        placedObjects.push({ x: px, y: py, size: planetSize });
      }
    }

    // Generate asteroids (with spacing and velocity)
    const sectorBounds = {
      minX: sectorMinX,
      minY: sectorMinY,
      maxX: sectorMaxX,
      maxY: sectorMaxY
    };

    const asteroidCount = Math.floor(rng() * (CONSTANTS.ASTEROIDS_PER_SECTOR_MAX - CONSTANTS.ASTEROIDS_PER_SECTOR_MIN + 1)) + CONSTANTS.ASTEROIDS_PER_SECTOR_MIN;
    for (let i = 0; i < asteroidCount; i++) {
      const size = CONSTANTS.ASTEROID_SIZE_MIN + rng() * (CONSTANTS.ASTEROID_SIZE_MAX - CONSTANTS.ASTEROID_SIZE_MIN);
      let x, y, placed = false;

      for (let attempt = 0; attempt < CONSTANTS.PLACEMENT_MAX_ATTEMPTS; attempt++) {
        x = sectorMinX + size + rng() * (CONSTANTS.SECTOR_SIZE - size * 2);
        y = sectorMinY + size + rng() * (CONSTANTS.SECTOR_SIZE - size * 2);
        if (canPlace(x, y, size)) {
          placed = true;
          break;
        }
      }

      if (!placed) continue;

      // Generate velocity (random direction, varying speed)
      const speed = CONSTANTS.ASTEROID_VELOCITY_MIN + rng() * (CONSTANTS.ASTEROID_VELOCITY_MAX - CONSTANTS.ASTEROID_VELOCITY_MIN);
      const angle = rng() * Math.PI * 2;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      const asteroid = {
        id: `${sectorX}_${sectorY}_asteroid_${i}`,
        x,
        y,
        size,
        resources: this.getAsteroidResources(rng),
        initialX: x,
        initialY: y,
        initialVx: vx,
        initialVy: vy,
        sectorBounds
      };
      sector.asteroids.push(asteroid);
      placedObjects.push({ x, y, size });
    }

    // Maybe generate wormhole (with spacing)
    if (rng() < CONSTANTS.WORMHOLE_CHANCE) {
      const size = CONSTANTS.WORMHOLE_SIZE;
      let x, y, placed = false;

      for (let attempt = 0; attempt < CONSTANTS.PLACEMENT_MAX_ATTEMPTS; attempt++) {
        x = sectorMinX + size + rng() * (CONSTANTS.SECTOR_SIZE - size * 2);
        y = sectorMinY + size + rng() * (CONSTANTS.SECTOR_SIZE - size * 2);
        if (canPlace(x, y, size)) {
          placed = true;
          break;
        }
      }

      if (placed) {
        const wormhole = {
          id: `${sectorX}_${sectorY}_wormhole_0`,
          x,
          y,
          size,
          destinationSector: {
            x: Math.floor(rng() * 100 - 50),
            y: Math.floor(rng() * 100 - 50)
          }
        };
        sector.wormholes.push(wormhole);
        placedObjects.push({ x, y, size });
      }
    }

    // Generate faction bases (deterministic based on sector coordinates)
    const spawnHubTypes = Object.values(CONSTANTS.SPAWN_HUB_TYPES || {});
    for (const hubType of spawnHubTypes) {
      if (!hubType.spawnChance) continue;

      // Roll for this base type in this sector
      if (rng() < hubType.spawnChance) {
        const size = hubType.size || 100;
        let x, y, placed = false;

        for (let attempt = 0; attempt < CONSTANTS.PLACEMENT_MAX_ATTEMPTS; attempt++) {
          x = sectorMinX + size + rng() * (CONSTANTS.SECTOR_SIZE - size * 2);
          y = sectorMinY + size + rng() * (CONSTANTS.SECTOR_SIZE - size * 2);
          if (canPlace(x, y, size)) {
            placed = true;
            break;
          }
        }

        if (placed) {
          const base = {
            id: `${sectorX}_${sectorY}_base_${hubType.id}`,
            x,
            y,
            size,
            type: hubType.id,
            faction: hubType.faction,
            name: hubType.name,
            health: hubType.health,
            maxHealth: hubType.health,
            patrolRadius: hubType.patrolRadius || 3,
            continuousSpawn: hubType.continuousSpawn || false,
            spawnInterval: hubType.spawnInterval || null,
            territoryRadius: hubType.territoryRadius || null
          };
          sector.bases.push(base);
          placedObjects.push({ x, y, size });
        }
      }
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
      wormholes: [],
      bases: []
    };

    const orbitTime = Physics.getOrbitTime();
    const asteroidTime = Physics.getPhysicsTime();

    // Get objects from nearby sectors
    const sectorX = Math.floor(position.x / CONSTANTS.SECTOR_SIZE);
    const sectorY = Math.floor(position.y / CONSTANTS.SECTOR_SIZE);

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const sector = this.getSector(sectorX + dx, sectorY + dy);

        // Stars don't move - push as-is
        objects.stars.push(...sector.stars);

        // Planets orbit their stars - compute current positions
        for (const planet of sector.planets) {
          const star = sector.stars.find(s => s.id === planet.starId);
          if (star && planet.orbitSpeed) {
            const pos = Physics.computePlanetPosition(planet, star, orbitTime);
            objects.planets.push({ ...planet, x: pos.x, y: pos.y });
          } else {
            objects.planets.push(planet);
          }
        }

        // Asteroids move - compute current positions
        for (const asteroid of sector.asteroids) {
          if (asteroid.initialX !== undefined) {
            const state = Physics.getAsteroidPosition(asteroid, sector.stars, asteroidTime);
            objects.asteroids.push({
              ...asteroid,
              x: state.x,
              y: state.y,
              state: state.state,
              capturedBy: state.capturedBy
            });
          } else {
            objects.asteroids.push(asteroid);
          }
        }

        // Wormholes don't move
        objects.wormholes.push(...sector.wormholes);

        // Bases don't move
        objects.bases.push(...sector.bases);
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

  // Seeded random number generator - Mulberry32 (deterministic across platforms)
  seededRandom(seed) {
    let s = seed >>> 0;
    return function() {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
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
