const config = require('./config');
const auth = require('./auth');
const { statements } = require('./database');
const mining = require('./game/mining');
const combat = require('./game/combat');
const marketplace = require('./game/marketplace');
const npc = require('./game/npc');
const engine = require('./game/engine');

// Track connected players: socketId -> { userId, username, position, etc. }
const connectedPlayers = new Map();
// Reverse lookup: userId -> socketId
const userSockets = new Map();
// Track player status: oderId -> { status, statusTimeout }
const playerStatus = new Map();

module.exports = function(io) {
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    let authenticatedUserId = null;

    // Authentication: Login
    socket.on('auth:login', async (data) => {
      const { username, password } = data;

      // Rate limiting by IP
      const ip = socket.handshake.address;
      if (auth.isLoginRateLimited(ip)) {
        socket.emit('auth:error', { message: 'Too many login attempts. Please wait.' });
        return;
      }

      const result = await auth.login(username, password);

      if (result.success) {
        authenticatedUserId = result.player.id;
        setupAuthenticatedPlayer(socket, result.player, result.token);
        socket.emit('auth:success', { token: result.token, player: result.player });
      } else {
        socket.emit('auth:error', { message: result.error });
      }
    });

    // Authentication: Register
    socket.on('auth:register', async (data) => {
      const { username, password } = data;

      // Rate limiting by IP
      const ip = socket.handshake.address;
      if (auth.isRegisterRateLimited(ip)) {
        socket.emit('auth:error', { message: 'Too many registration attempts. Please wait.' });
        return;
      }

      const result = await auth.register(username, password);

      if (result.success) {
        authenticatedUserId = result.player.id;
        setupAuthenticatedPlayer(socket, result.player, result.token);
        socket.emit('auth:success', { token: result.token, player: result.player });
      } else {
        socket.emit('auth:error', { message: result.error });
      }
    });

    // Authentication: Token (reconnect)
    socket.on('auth:token', (data) => {
      const { token } = data;
      const userId = auth.validateToken(token);

      if (userId) {
        const playerData = auth.getPlayerData(userId);
        authenticatedUserId = userId;
        setupAuthenticatedPlayer(socket, playerData, token);
        socket.emit('auth:success', { token, player: playerData });
      } else {
        socket.emit('auth:error', { message: 'Invalid or expired session' });
      }
    });

    // Authentication: Logout
    socket.on('auth:logout', () => {
      if (authenticatedUserId) {
        cleanupPlayer(socket, authenticatedUserId);
        authenticatedUserId = null;
      }
    });

    // Player movement input
    socket.on('player:input', (data) => {
      if (!authenticatedUserId) return;

      const player = connectedPlayers.get(socket.id);
      if (!player) return;

      // Validate and update position
      // For MVP, we trust the client position with basic sanity checks
      const maxSpeed = config.BASE_SPEED * Math.pow(config.TIER_MULTIPLIER, 5); // Max possible speed

      // Basic sanity check on velocity
      const speed = Math.sqrt(data.vx * data.vx + data.vy * data.vy);
      if (speed > maxSpeed * 2) {
        console.warn(`Player ${player.username} moving too fast: ${speed}`);
        return;
      }

      // Update player state
      player.position = { x: data.x, y: data.y };
      player.velocity = { x: data.vx, y: data.vy };
      player.rotation = data.rotation;

      // Calculate sector
      const sectorX = Math.floor(data.x / config.SECTOR_SIZE);
      const sectorY = Math.floor(data.y / config.SECTOR_SIZE);

      // Save to database periodically (throttled)
      if (!player.lastSave || Date.now() - player.lastSave > 5000) {
        statements.updateShipPosition.run(
          data.x, data.y, data.rotation,
          data.vx, data.vy,
          sectorX, sectorY,
          authenticatedUserId
        );
        player.lastSave = Date.now();
      }

      // Broadcast to nearby players
      broadcastToNearby(socket, player, 'player:update', {
        id: authenticatedUserId,
        username: player.username,
        x: data.x,
        y: data.y,
        rotation: data.rotation,
        hull: player.hull,
        shield: player.shield,
        status: getPlayerStatus(authenticatedUserId)
      });
    });

    // Combat: Fire weapon
    socket.on('combat:fire', (data) => {
      if (!authenticatedUserId) return;

      const player = connectedPlayers.get(socket.id);
      if (!player) return;

      // Set player status to combat (with timeout back to idle)
      setPlayerStatus(authenticatedUserId, 'combat', 3000);

      // Broadcast the fire event with weapon tier for visuals
      broadcastToNearby(socket, player, 'combat:fire', {
        playerId: authenticatedUserId,
        x: player.position.x,
        y: player.position.y,
        rotation: player.rotation,
        direction: data.direction,
        weaponTier: player.weaponTier || 1
      });

      // Hit detection for NPCs
      const weaponTier = player.weaponTier || 1;
      const weaponRange = config.BASE_WEAPON_RANGE * Math.pow(config.TIER_MULTIPLIER, weaponTier - 1);
      const fireDirection = data.direction || player.rotation;

      // Get all NPCs in range
      const npcsInRange = npc.getNPCsInRange(player.position, weaponRange);

      for (const npcData of npcsInRange) {
        // Calculate angle to NPC
        const dx = npcData.position.x - player.position.x;
        const dy = npcData.position.y - player.position.y;
        const angleToNpc = Math.atan2(dy, dx);

        // Check if NPC is in firing cone (within ~15 degrees)
        let angleDiff = angleToNpc - fireDirection;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        const hitAngle = 0.26; // ~15 degrees in radians
        if (Math.abs(angleDiff) <= hitAngle) {
          // Hit! Apply damage to NPC
          const result = engine.playerAttackNPC(
            authenticatedUserId,
            npcData.id,
            player.weaponType || 'kinetic',
            weaponTier
          );

          if (result) {
            // Send hit feedback to the player
            socket.emit('combat:npcHit', {
              npcId: npcData.id,
              damage: config.BASE_WEAPON_DAMAGE * Math.pow(config.TIER_MULTIPLIER, weaponTier - 1),
              destroyed: result.destroyed,
              loot: result.loot || null
            });

            // If NPC was destroyed, give loot and credits to player
            if (result.destroyed) {
              // Award credit reward (with team bonus)
              if (result.creditsPerPlayer > 0) {
                const ship = statements.getShipByUserId.get(authenticatedUserId);
                if (ship) {
                  statements.updateShipCredits.run(ship.credits + result.creditsPerPlayer, authenticatedUserId);
                }
              }

              // Add loot to player inventory
              if (result.loot) {
                for (const item of result.loot) {
                  statements.upsertInventory.run(authenticatedUserId, item.resourceType, item.quantity);
                }
              }

              // Send updated inventory and credits
              const inventory = statements.getInventory.all(authenticatedUserId);
              const updatedShip = statements.getShipByUserId.get(authenticatedUserId);
              socket.emit('inventory:update', {
                inventory,
                credits: updatedShip ? updatedShip.credits : 0
              });

              // Notify player of rewards
              socket.emit('npc:reward', {
                credits: result.creditsPerPlayer,
                teamMultiplier: result.teamMultiplier,
                participantCount: result.participantCount,
                loot: result.loot
              });
            }
          }
          break; // Only hit one NPC per shot
        }
      }

      // Hit detection for faction bases (only if no NPC was hit)
      const basesInRange = npc.getBasesInRange(player.position, weaponRange);
      for (const baseData of basesInRange) {
        // Calculate angle to base center
        const dx = baseData.x - player.position.x;
        const dy = baseData.y - player.position.y;
        const angleToBase = Math.atan2(dy, dx);

        // Bases are larger targets - use wider hit angle based on size
        let angleDiff = angleToBase - fireDirection;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        // Calculate angular size of base from player's perspective
        const distToBase = Math.sqrt(dx * dx + dy * dy);
        const baseAngularSize = Math.atan2(baseData.size, distToBase);
        const hitAngle = Math.max(0.26, baseAngularSize); // At least 15 degrees

        if (Math.abs(angleDiff) <= hitAngle) {
          // Hit! Apply damage to base
          const result = engine.playerAttackBase(
            authenticatedUserId,
            baseData.id,
            player.weaponType || 'kinetic',
            weaponTier
          );

          if (result) {
            // Send hit feedback to the player
            socket.emit('combat:baseHit', {
              baseId: baseData.id,
              damage: config.BASE_WEAPON_DAMAGE * Math.pow(config.TIER_MULTIPLIER, weaponTier - 1),
              destroyed: result.destroyed,
              health: result.health,
              maxHealth: result.maxHealth
            });

            // If base was destroyed, give rewards to player
            if (result.destroyed) {
              // Award credit reward (with team bonus)
              if (result.creditsPerPlayer > 0) {
                const ship = statements.getShipByUserId.get(authenticatedUserId);
                if (ship) {
                  statements.updateShipCredits.run(ship.credits + result.creditsPerPlayer, authenticatedUserId);
                }
              }

              // Send updated inventory and credits
              const inventory = statements.getInventory.all(authenticatedUserId);
              const updatedShip = statements.getShipByUserId.get(authenticatedUserId);
              socket.emit('inventory:update', {
                inventory,
                credits: updatedShip ? updatedShip.credits : 0
              });

              // Notify player of rewards
              socket.emit('base:reward', {
                credits: result.creditsPerPlayer,
                teamMultiplier: result.teamMultiplier,
                participantCount: result.participantCount,
                baseName: baseData.name,
                faction: baseData.faction
              });
            }
          }
          break; // Only hit one base per shot
        }
      }
    });

    // Mining: Start mining
    socket.on('mining:start', (data) => {
      if (!authenticatedUserId) return;

      const player = connectedPlayers.get(socket.id);
      if (!player) return;

      const result = mining.startMining(authenticatedUserId, player.position, data.objectId);

      if (result.success) {
        socket.emit('mining:started', {
          objectId: data.objectId,
          miningTime: config.BASE_MINING_TIME / Math.pow(config.TIER_MULTIPLIER, player.miningTier - 1 || 0)
        });

        // Set player status to mining
        setPlayerStatus(authenticatedUserId, 'mining');

        // Broadcast mining start to nearby players
        broadcastToNearby(socket, player, 'mining:playerStarted', {
          playerId: authenticatedUserId,
          targetX: result.target.x,
          targetY: result.target.y,
          resourceType: result.target.resourceType || 'default',
          miningTier: player.miningTier || 1
        });

        // Set up mining completion check
        const checkMining = setInterval(() => {
          const progress = mining.updateMining(authenticatedUserId, player.position);

          if (!progress) {
            clearInterval(checkMining);
            return;
          }

          if (progress.cancelled) {
            clearInterval(checkMining);
            socket.emit('mining:cancelled', { reason: progress.reason });
            // Clear player status
            setPlayerStatus(authenticatedUserId, 'idle');
            // Broadcast mining stopped to nearby players
            broadcastToNearby(socket, player, 'mining:playerStopped', {
              playerId: authenticatedUserId
            });
            return;
          }

          if (progress.success) {
            clearInterval(checkMining);
            socket.emit('mining:complete', {
              resourceType: progress.resourceType,
              resourceName: progress.resourceName,
              quantity: progress.quantity
            });
            // Get current credits from database
            const ship = statements.getShipByUserId.get(authenticatedUserId);
            socket.emit('inventory:update', {
              inventory: progress.inventory,
              credits: ship ? ship.credits : 0
            });
            // Notify nearby players of depletion
            broadcastToNearby(socket, player, 'world:update', {
              depleted: true,
              objectId: progress.objectId
            });
            // Clear player status
            setPlayerStatus(authenticatedUserId, 'idle');
            // Broadcast mining stopped to nearby players
            broadcastToNearby(socket, player, 'mining:playerStopped', {
              playerId: authenticatedUserId
            });
          }
        }, 100);
      } else {
        socket.emit('mining:error', { message: result.error });
      }
    });

    // Mining: Cancel
    socket.on('mining:cancel', () => {
      if (!authenticatedUserId) return;
      mining.cancelMining(authenticatedUserId);
    });

    // Chat: Send message
    socket.on('chat:send', (data) => {
      if (!authenticatedUserId) return;

      const player = connectedPlayers.get(socket.id);
      if (!player) return;

      // Rate limiting
      if (player.lastChat && Date.now() - player.lastChat < config.CHAT_RATE_LIMIT) {
        return;
      }
      player.lastChat = Date.now();

      // Validate message
      let message = (data.message || '').trim();
      if (!message || message.length > config.CHAT_MAX_LENGTH) return;

      // Save to database
      statements.addChatMessage.run(authenticatedUserId, player.username, message);

      // Broadcast to all players
      io.emit('chat:message', {
        username: player.username,
        message: message,
        timestamp: Date.now()
      });

      // Prune old messages
      statements.pruneOldChat.run(config.CHAT_HISTORY_SIZE);
    });

    // Marketplace: List item
    socket.on('market:list', (data) => {
      if (!authenticatedUserId) return;

      const result = marketplace.listItem(
        authenticatedUserId,
        data.resourceType,
        data.quantity,
        data.price
      );

      if (result.success) {
        socket.emit('market:listed', { listingId: result.listingId });
        // Get current credits from database
        const ship = statements.getShipByUserId.get(authenticatedUserId);
        socket.emit('inventory:update', {
          inventory: result.inventory,
          credits: ship ? ship.credits : 0
        });
        // Notify all players of new listing
        io.emit('market:update', { action: 'new_listing' });
      } else {
        socket.emit('market:error', { message: result.error });
      }
    });

    // Marketplace: Buy item
    socket.on('market:buy', (data) => {
      if (!authenticatedUserId) return;

      // Get listing info before purchase (for seller notification)
      const listing = statements.getListingById.get(data.listingId);
      if (!listing) {
        socket.emit('market:error', { message: 'Listing not found' });
        return;
      }

      const result = marketplace.buyItem(
        authenticatedUserId,
        data.listingId,
        data.quantity
      );

      if (result.success) {
        // Update buyer
        const player = connectedPlayers.get(socket.id);
        if (player) player.credits = result.credits;

        socket.emit('market:bought', { cost: result.cost });
        socket.emit('inventory:update', {
          inventory: result.inventory,
          credits: result.credits
        });
        // Notify all players
        io.emit('market:update', { action: 'purchase' });

        // Notify seller if they're online
        const sellerSocketId = userSockets.get(listing.seller_id);
        if (sellerSocketId) {
          const resourceInfo = config.RESOURCE_TYPES[listing.resource_type];
          io.to(sellerSocketId).emit('market:sold', {
            resourceType: listing.resource_type,
            resourceName: resourceInfo ? resourceInfo.name : listing.resource_type,
            quantity: data.quantity,
            totalCredits: result.cost,
            buyerName: player ? player.username : 'Unknown'
          });
        }
      } else {
        socket.emit('market:error', { message: result.error });
      }
    });

    // Marketplace: Cancel listing
    socket.on('market:cancel', (data) => {
      if (!authenticatedUserId) return;

      const result = marketplace.cancelListing(authenticatedUserId, data.listingId);

      if (result.success) {
        socket.emit('market:cancelled', {});
        // Get current credits from database
        const ship = statements.getShipByUserId.get(authenticatedUserId);
        socket.emit('inventory:update', {
          inventory: result.inventory,
          credits: ship ? ship.credits : 0
        });
        io.emit('market:update', { action: 'cancelled' });
      } else {
        socket.emit('market:error', { message: result.error });
      }
    });

    // Marketplace: Get listings
    socket.on('market:getListings', (data) => {
      if (!authenticatedUserId) return;

      const listings = data.resourceType
        ? marketplace.getListings(data.resourceType)
        : marketplace.getListings();

      socket.emit('market:listings', { listings });
    });

    // Marketplace: Get my listings
    socket.on('market:getMyListings', () => {
      if (!authenticatedUserId) return;

      const listings = marketplace.getMyListings(authenticatedUserId);
      socket.emit('market:myListings', { listings });
    });

    // Ship upgrade
    socket.on('ship:upgrade', (data) => {
      if (!authenticatedUserId) return;

      const player = connectedPlayers.get(socket.id);
      if (!player) return;

      const ship = statements.getShipByUserId.get(authenticatedUserId);
      if (!ship) return;

      const { component } = data;
      const validComponents = ['engine', 'weapon', 'shield', 'mining', 'cargo', 'radar'];

      if (!validComponents.includes(component)) {
        socket.emit('upgrade:error', { message: 'Invalid component' });
        return;
      }

      // Get current tier
      const currentTier = ship[`${component}_tier`];
      if (currentTier >= config.MAX_TIER) {
        socket.emit('upgrade:error', { message: 'Already at max tier' });
        return;
      }

      // Check cost
      const nextTier = currentTier + 1;
      const cost = config.UPGRADE_COSTS[nextTier];

      if (ship.credits < cost) {
        socket.emit('upgrade:error', { message: 'Not enough credits' });
        return;
      }

      // Apply upgrade
      const updateParams = [null, null, null, null, null, null, null, authenticatedUserId];
      const componentIndex = validComponents.indexOf(component);
      updateParams[componentIndex] = nextTier;

      statements.upgradeShipComponent.run(...updateParams);
      statements.updateShipCredits.run(ship.credits - cost, authenticatedUserId);

      // Update player state
      player.credits = ship.credits - cost;
      if (component === 'radar') player.radarTier = nextTier;
      if (component === 'mining') player.miningTier = nextTier;
      if (component === 'weapon') player.weaponTier = nextTier;

      socket.emit('upgrade:success', {
        component,
        newTier: nextTier,
        credits: ship.credits - cost
      });
    });

    // Get ship data
    socket.on('ship:getData', () => {
      if (!authenticatedUserId) return;

      const ship = statements.getShipByUserId.get(authenticatedUserId);
      if (ship) {
        socket.emit('ship:data', {
          engine_tier: ship.engine_tier,
          weapon_type: ship.weapon_type,
          weapon_tier: ship.weapon_tier,
          shield_tier: ship.shield_tier,
          mining_tier: ship.mining_tier,
          cargo_tier: ship.cargo_tier,
          radar_tier: ship.radar_tier,
          credits: ship.credits
        });
      }
    });

    // Emotes: Send emote to nearby players
    socket.on('emote:send', (data) => {
      if (!authenticatedUserId) return;

      const player = connectedPlayers.get(socket.id);
      if (!player) return;

      // Validate emote type
      if (!config.EMOTES || !config.EMOTES[data.emoteType]) return;

      // Broadcast to nearby players
      broadcastToNearby(socket, player, 'emote:broadcast', {
        playerId: authenticatedUserId,
        playerName: player.username,
        emoteType: data.emoteType,
        x: player.position.x,
        y: player.position.y
      });
    });

    // Loot: Start collecting wreckage
    socket.on('loot:startCollect', (data) => {
      if (!authenticatedUserId) return;

      const player = connectedPlayers.get(socket.id);
      if (!player) return;

      const { wreckageId } = data;

      // Check if wreckage exists and is in range
      const wreckage = engine.getWreckage(wreckageId);
      if (!wreckage) {
        socket.emit('loot:error', { message: 'Wreckage not found' });
        return;
      }

      // Check range (use mining range)
      const dx = wreckage.position.x - player.position.x;
      const dy = wreckage.position.y - player.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const collectRange = config.MINING_RANGE || 100;

      if (dist > collectRange) {
        socket.emit('loot:error', { message: 'Too far from wreckage' });
        return;
      }

      // Start collection
      const result = engine.startWreckageCollection(wreckageId, authenticatedUserId);

      if (result && result.error) {
        socket.emit('loot:error', { message: result.error });
        return;
      }

      if (result && result.success) {
        socket.emit('loot:started', {
          wreckageId,
          totalTime: result.totalTime
        });

        // Set player status to collecting
        setPlayerStatus(authenticatedUserId, 'collecting');

        // Broadcast collection start to nearby players
        broadcastToNearby(socket, player, 'loot:playerCollecting', {
          playerId: authenticatedUserId,
          wreckageId,
          x: wreckage.position.x,
          y: wreckage.position.y
        });

        // Set up collection progress check
        const checkCollection = setInterval(() => {
          const currentPlayer = connectedPlayers.get(socket.id);
          if (!currentPlayer) {
            clearInterval(checkCollection);
            engine.cancelWreckageCollection(wreckageId, authenticatedUserId);
            return;
          }

          // Check if still in range
          const cdx = wreckage.position.x - currentPlayer.position.x;
          const cdy = wreckage.position.y - currentPlayer.position.y;
          const cdist = Math.sqrt(cdx * cdx + cdy * cdy);

          if (cdist > collectRange * 1.5) {
            clearInterval(checkCollection);
            engine.cancelWreckageCollection(wreckageId, authenticatedUserId);
            socket.emit('loot:cancelled', { reason: 'Moved out of range' });
            setPlayerStatus(authenticatedUserId, 'idle');
            broadcastToNearby(socket, currentPlayer, 'loot:playerStopped', {
              playerId: authenticatedUserId
            });
            return;
          }

          // Update collection progress
          const progress = engine.updateWreckageCollection(wreckageId, authenticatedUserId, 100);

          if (!progress) {
            clearInterval(checkCollection);
            setPlayerStatus(authenticatedUserId, 'idle');
            return;
          }

          if (progress.complete) {
            clearInterval(checkCollection);

            // Process collected loot
            const lootResults = processCollectedLoot(authenticatedUserId, progress.contents);

            socket.emit('loot:complete', {
              wreckageId,
              contents: progress.contents,
              results: lootResults
            });

            // Update inventory and credits
            const inventory = statements.getInventory.all(authenticatedUserId);
            const ship = statements.getShipByUserId.get(authenticatedUserId);
            socket.emit('inventory:update', {
              inventory,
              credits: ship ? ship.credits : 0
            });

            // Clear player status
            setPlayerStatus(authenticatedUserId, 'idle');

            // Broadcast wreckage collected to nearby players
            broadcastToNearby(socket, currentPlayer, 'loot:playerStopped', {
              playerId: authenticatedUserId
            });
            broadcastToNearby(socket, currentPlayer, 'wreckage:collected', {
              wreckageId,
              collectedBy: authenticatedUserId
            });
          } else {
            // Send progress update
            socket.emit('loot:progress', {
              wreckageId,
              progress: progress.progress
            });
          }
        }, 100);
      }
    });

    // Loot: Cancel collection
    socket.on('loot:cancelCollect', (data) => {
      if (!authenticatedUserId) return;

      const player = connectedPlayers.get(socket.id);
      if (!player) return;

      engine.cancelWreckageCollection(data.wreckageId, authenticatedUserId);
      socket.emit('loot:cancelled', { reason: 'Cancelled by player' });
      setPlayerStatus(authenticatedUserId, 'idle');
      broadcastToNearby(socket, player, 'loot:playerStopped', {
        playerId: authenticatedUserId
      });
    });

    // Loot: Get nearby wreckage
    socket.on('loot:getNearby', () => {
      if (!authenticatedUserId) return;

      const player = connectedPlayers.get(socket.id);
      if (!player) return;

      const radarRange = config.BASE_RADAR_RANGE * Math.pow(config.TIER_MULTIPLIER, player.radarTier - 1);
      const nearby = engine.getWreckageInRange(player.position, radarRange);

      socket.emit('loot:nearby', {
        wreckage: nearby.map(w => ({
          id: w.id,
          x: w.position.x,
          y: w.position.y,
          faction: w.faction,
          npcName: w.npcName,
          contentCount: w.contents.length,
          distance: w.distance,
          despawnTime: w.despawnTime
        }))
      });
    });

    // Ping for latency measurement
    socket.on('ping', (timestamp) => {
      socket.emit('pong', timestamp);
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      if (authenticatedUserId) {
        cleanupPlayer(socket, authenticatedUserId);
      }
    });
  });

  // Helper: Setup authenticated player
  function setupAuthenticatedPlayer(socket, playerData, token) {
    // Check if already connected elsewhere
    const existingSocketId = userSockets.get(playerData.id);
    if (existingSocketId && existingSocketId !== socket.id) {
      // Disconnect old socket
      const oldSocket = io.sockets.sockets.get(existingSocketId);
      if (oldSocket) {
        oldSocket.emit('auth:error', { message: 'Connected from another location' });
        oldSocket.disconnect();
      }
    }

    // Setup player data
    const player = {
      id: playerData.id,
      username: playerData.username,
      position: { x: playerData.position_x, y: playerData.position_y },
      velocity: { x: playerData.velocity_x, y: playerData.velocity_y },
      rotation: playerData.rotation,
      hull: playerData.hull_hp,
      hullMax: playerData.hull_max,
      shield: playerData.shield_hp,
      shieldMax: playerData.shield_max,
      radarTier: playerData.radar_tier,
      miningTier: playerData.mining_tier,
      weaponTier: playerData.weapon_tier,
      credits: playerData.credits
    };

    connectedPlayers.set(socket.id, player);
    userSockets.set(playerData.id, socket.id);

    console.log(`Player ${playerData.username} authenticated`);

    // Notify nearby players of new player
    broadcastToNearby(socket, player, 'player:update', {
      id: playerData.id,
      username: playerData.username,
      x: player.position.x,
      y: player.position.y,
      rotation: player.rotation,
      hull: player.hull,
      shield: player.shield
    });
  }

  // Helper: Cleanup player on disconnect
  function cleanupPlayer(socket, userId) {
    const player = connectedPlayers.get(socket.id);
    if (player) {
      // Save final position
      statements.updateShipPosition.run(
        player.position.x, player.position.y, player.rotation,
        player.velocity.x, player.velocity.y,
        Math.floor(player.position.x / config.SECTOR_SIZE),
        Math.floor(player.position.y / config.SECTOR_SIZE),
        userId
      );

      // Notify others
      broadcastToNearby(socket, player, 'player:leave', userId);

      console.log(`Player ${player.username} disconnected`);
    }

    connectedPlayers.delete(socket.id);
    userSockets.delete(userId);
    // Clean up player status
    const statusData = playerStatus.get(userId);
    if (statusData && statusData.timeout) {
      clearTimeout(statusData.timeout);
    }
    playerStatus.delete(userId);
  }

  // Helper: Set player status with optional timeout
  function setPlayerStatus(userId, status, timeout = 0) {
    // Clear any existing timeout
    const existing = playerStatus.get(userId);
    if (existing && existing.timeout) {
      clearTimeout(existing.timeout);
    }

    if (timeout > 0) {
      // Set status with auto-clear timeout
      const timeoutId = setTimeout(() => {
        setPlayerStatus(userId, 'idle');
      }, timeout);
      playerStatus.set(userId, { status, timeout: timeoutId });
    } else {
      playerStatus.set(userId, { status, timeout: null });
    }
  }

  // Helper: Get player status
  function getPlayerStatus(userId) {
    const statusData = playerStatus.get(userId);
    return statusData ? statusData.status : 'idle';
  }

  // Helper: Broadcast to nearby players
  function broadcastToNearby(socket, player, event, data) {
    const radarRange = config.BASE_RADAR_RANGE * Math.pow(config.TIER_MULTIPLIER, player.radarTier - 1);
    const broadcastRange = radarRange * 2; // Broadcast slightly further than radar

    for (const [socketId, otherPlayer] of connectedPlayers) {
      if (socketId === socket.id) continue;

      const dx = otherPlayer.position.x - player.position.x;
      const dy = otherPlayer.position.y - player.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= broadcastRange) {
        io.to(socketId).emit(event, data);
      }
    }
  }

  // Helper: Process collected loot and add to player
  function processCollectedLoot(userId, contents) {
    const results = {
      credits: 0,
      resources: [],
      components: [],
      relics: [],
      buffs: []
    };

    for (const item of contents) {
      switch (item.type) {
        case 'credits':
          // Add credits to player
          const ship = statements.getShipByUserId.get(userId);
          if (ship) {
            statements.updateShipCredits.run(ship.credits + item.amount, userId);
            results.credits += item.amount;
          }
          break;

        case 'resource':
          // Add resource to inventory
          statements.upsertInventory.run(userId, item.resourceType, item.quantity);
          results.resources.push({
            type: item.resourceType,
            quantity: item.quantity
          });
          break;

        case 'component':
          // Add component to components table
          statements.upsertComponent.run(userId, item.componentType, 1);
          results.components.push({
            type: item.componentType
          });
          break;

        case 'relic':
          // Add relic to relics table (only if not already owned)
          statements.addRelic.run(userId, item.relicType);
          results.relics.push({
            type: item.relicType
          });
          break;

        case 'buff':
          // Apply temporary buff
          const buffConfig = config.BUFF_TYPES ? config.BUFF_TYPES[item.buffType] : null;
          const duration = buffConfig ? buffConfig.duration : 60000; // Default 60s
          const expiresAt = Date.now() + duration;
          statements.addBuff.run(userId, item.buffType, expiresAt);
          results.buffs.push({
            type: item.buffType,
            duration,
            expiresAt
          });

          // Notify player of buff application
          const socketId = userSockets.get(userId);
          if (socketId) {
            io.to(socketId).emit('buff:applied', {
              buffType: item.buffType,
              duration,
              expiresAt
            });
          }
          break;
      }
    }

    return results;
  }

  // Export for use by other modules
  return {
    io,
    connectedPlayers,
    userSockets
  };
};
