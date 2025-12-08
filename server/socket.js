const config = require('./config');
const auth = require('./auth');
const { statements, safeUpdateCredits, getSafeCredits, performUpgrade, safeUpsertInventory } = require('./database');
const mining = require('./game/mining');
const combat = require('./game/combat');
const marketplace = require('./game/marketplace');
const npc = require('./game/npc');
const engine = require('./game/engine');
const wormhole = require('./game/wormhole');
const world = require('./world');
const logger = require('../shared/logger');

// Track connected players: socketId -> { userId, username, position, etc. }
const connectedPlayers = new Map();
// Reverse lookup: userId -> socketId
const userSockets = new Map();
// Track player status: userId -> { status, statusTimeout }
const playerStatus = new Map();
// Track active intervals per socket for cleanup: socketId -> Set of intervalIds
const activeIntervals = new Map();

// Pre-computed Sets for O(1) validation (avoid Array.includes in hot paths)
const VALID_COMPONENTS = new Set(['engine', 'weapon', 'shield', 'mining', 'cargo', 'radar', 'energy_core', 'hull']);
const VALID_COLORS = new Set(config.PLAYER_COLOR_OPTIONS.map(c => c.id));
const VALID_PROFILES = new Set((config.PROFILE_OPTIONS || []).map(p => p.id));

module.exports = function(io) {
  io.on('connection', (socket) => {
    logger.log(`Client connected: ${socket.id}`);
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
        logger.warn(`Player ${player.username} moving too fast: ${speed}`);
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
        status: getPlayerStatus(authenticatedUserId),
        colorId: player.colorId || 'green'
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
      // Use per-tier weapon ranges that match client visual projectile distance
      const weaponRange = (config.WEAPON_RANGES && config.WEAPON_RANGES[weaponTier])
        || config.BASE_WEAPON_RANGE * Math.pow(config.TIER_MULTIPLIER, weaponTier - 1);
      const fireDirection = data.direction || player.rotation;

      // Get all NPCs in range
      const npcsInRange = npc.getNPCsInRange(player.position, weaponRange);
      const projectileSpeed = config.PROJECTILE_SPEED || 800;

      for (const npcData of npcsInRange) {
        // Calculate distance to NPC
        const dx = npcData.position.x - player.position.x;
        const dy = npcData.position.y - player.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Calculate projectile travel time to current NPC position
        const travelTime = dist / projectileSpeed;

        // Predict NPC position at impact time (account for NPC movement)
        const npcVelocity = npcData.velocity || { x: 0, y: 0 };
        const predictedX = npcData.position.x + npcVelocity.x * travelTime;
        const predictedY = npcData.position.y + npcVelocity.y * travelTime;

        // Calculate angle to PREDICTED position
        const predictedDx = predictedX - player.position.x;
        const predictedDy = predictedY - player.position.y;
        const angleToNpc = Math.atan2(predictedDy, predictedDx);

        // Check if NPC is in firing cone
        let angleDiff = angleToNpc - fireDirection;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        // Slightly wider hit angle for prediction tolerance (~17 degrees)
        const hitAngle = 0.30;
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
              destroyed: result.destroyed
              // Note: rewards are now granted only when collecting wreckage/scrap
            });
          }
          break; // Only hit one NPC per shot
        }
      }

      // Hit detection for faction bases (only if no NPC was hit)
      const basesInRange = npc.getBasesInRange(player.position, weaponRange);
      for (const baseData of basesInRange) {
        // Calculate distance and angle to base center
        const dx = baseData.x - player.position.x;
        const dy = baseData.y - player.position.y;
        const distToBase = Math.sqrt(dx * dx + dy * dy);
        const baseSize = baseData.size || 100;

        // Effective distance subtracts base size (edge of base, not center)
        const effectiveDistance = distToBase - baseSize;

        // Skip if actually out of weapon range (accounting for size)
        if (effectiveDistance > weaponRange) continue;

        const angleToBase = Math.atan2(dy, dx);

        // Bases are larger targets - use wider hit angle based on size
        let angleDiff = angleToBase - fireDirection;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        // Calculate angular size of base from player's perspective
        const baseAngularSize = Math.atan2(baseSize, distToBase);
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
              try {
                // Award credit reward (with team bonus)
                if (result.creditsPerPlayer > 0) {
                  const ship = statements.getShipByUserId.get(authenticatedUserId);
                  const currentCredits = getSafeCredits(ship);
                  safeUpdateCredits(currentCredits + result.creditsPerPlayer, authenticatedUserId);
                }

                // Send updated inventory and credits
                const inventory = statements.getInventory.all(authenticatedUserId);
                const updatedShip = statements.getShipByUserId.get(authenticatedUserId);
                socket.emit('inventory:update', {
                  inventory,
                  credits: getSafeCredits(updatedShip)
                });

                // Notify player of rewards
                socket.emit('base:reward', {
                  credits: result.creditsPerPlayer,
                  teamMultiplier: result.teamMultiplier,
                  participantCount: result.participantCount,
                  baseName: baseData.name,
                  faction: baseData.faction
                });
              } catch (err) {
                logger.error(`[COMBAT REWARD ERROR] User ${authenticatedUserId} base loot:`, err.message);
                socket.emit('error:generic', { message: 'Failed to award base destruction rewards. Please check your inventory.' });
              }
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
            untrackInterval(socket.id, checkMining);
            return;
          }

          if (progress.cancelled) {
            clearInterval(checkMining);
            untrackInterval(socket.id, checkMining);
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
            untrackInterval(socket.id, checkMining);
            socket.emit('mining:complete', {
              resourceType: progress.resourceType,
              resourceName: progress.resourceName,
              quantity: progress.quantity
            });
            // Get current credits from database
            const ship = statements.getShipByUserId.get(authenticatedUserId);
            socket.emit('inventory:update', {
              inventory: progress.inventory,
              credits: getSafeCredits(ship)
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
        // Track interval for cleanup on disconnect
        trackInterval(socket.id, checkMining);
      } else {
        logger.log('[Socket] Mining error for user', authenticatedUserId, ':', result.error, 'objectId:', data.objectId);
        socket.emit('mining:error', { message: result.error, objectId: data.objectId });
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
          credits: getSafeCredits(ship)
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
          credits: getSafeCredits(ship)
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

    // Ship upgrade (with resource requirements)
    socket.on('ship:upgrade', (data) => {
      logger.log('[UPGRADE] Received upgrade request:', data, 'from user:', authenticatedUserId);
      try {
        if (!authenticatedUserId) {
          socket.emit('upgrade:error', { message: 'Not authenticated' });
          return;
        }

        const player = connectedPlayers.get(socket.id);
        if (!player) {
          socket.emit('upgrade:error', { message: 'Player not found' });
          return;
        }

        const ship = statements.getShipByUserId.get(authenticatedUserId);
        if (!ship) {
          socket.emit('upgrade:error', { message: 'Ship data not found' });
          return;
        }

        const { component } = data;

        if (!VALID_COMPONENTS.has(component)) {
          socket.emit('upgrade:error', { message: 'Invalid component' });
          return;
        }

        // Get current tier using the correct column name
        const dbColumnMap = {
          'engine': 'engine_tier',
          'weapon': 'weapon_tier',
          'shield': 'shield_tier',
          'mining': 'mining_tier',
          'cargo': 'cargo_tier',
          'radar': 'radar_tier',
          'energy_core': 'energy_core_tier',
          'hull': 'hull_tier'
        };
        const currentTier = ship[dbColumnMap[component]] || 1;

        if (currentTier >= config.MAX_TIER) {
          socket.emit('upgrade:error', { message: 'Already at max tier' });
          return;
        }

        // Get requirements from UPGRADE_REQUIREMENTS
        const nextTier = currentTier + 1;
        const requirements = config.UPGRADE_REQUIREMENTS[component]?.[nextTier];

        if (!requirements) {
          socket.emit('upgrade:error', { message: 'Invalid upgrade tier' });
          return;
        }

        // Use transaction to perform upgrade atomically (checks credits + resources)
        const result = performUpgrade(authenticatedUserId, component, requirements, config.MAX_TIER);

        if (!result.success) {
          socket.emit('upgrade:error', { message: result.error });
          return;
        }

        // Get updated ship and inventory
        const updatedShip = statements.getShipByUserId.get(authenticatedUserId);
        const updatedInventory = statements.getInventory.all(authenticatedUserId);

        // Update player state cache
        player.credits = getSafeCredits(updatedShip);
        if (component === 'radar') player.radarTier = result.newTier;
        if (component === 'mining') player.miningTier = result.newTier;
        if (component === 'weapon') player.weaponTier = result.newTier;
        if (component === 'energy_core') player.energyCoreTier = result.newTier;
        if (component === 'hull') {
          player.hullTier = result.newTier;
          player.hullMax = updatedShip.hull_max;
        }
        if (component === 'shield') {
          player.shieldTier = result.newTier;
          player.shieldMax = updatedShip.shield_max;
        }

        // Send upgrade success with updated max values for shield/hull
        socket.emit('upgrade:success', {
          component,
          newTier: result.newTier,
          credits: player.credits,
          shieldMax: updatedShip.shield_max,
          hullMax: updatedShip.hull_max
        });

        // Also send updated inventory since resources were consumed
        socket.emit('inventory:update', {
          inventory: updatedInventory,
          credits: player.credits
        });
      } catch (err) {
        logger.error(`[UPGRADE ERROR] User ${authenticatedUserId} upgrading ${data?.component}:`, err.message);
        logger.error(err.stack);
        socket.emit('upgrade:error', { message: 'Upgrade failed due to a server error. Please try again.' });
      }
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
          energy_core_tier: ship.energy_core_tier || 1,
          hull_tier: ship.hull_tier || 1,
          credits: ship.credits,
          ship_color_id: ship.ship_color_id || 'green',
          profile_id: ship.profile_id || 'pilot'
        });
      }
    });

    // Ship color customization
    socket.on('ship:setColor', (data) => {
      if (!authenticatedUserId) return;

      const player = connectedPlayers.get(socket.id);
      if (!player) return;

      const { colorId } = data;

      // Validate color ID against available options (O(1) Set lookup)
      if (!VALID_COLORS.has(colorId)) {
        socket.emit('ship:colorError', { message: 'Invalid color selection' });
        return;
      }

      // Update database
      try {
        statements.updateShipColor.run(colorId, authenticatedUserId);
      } catch (err) {
        logger.error(`[COLOR ERROR] User ${authenticatedUserId} setting color:`, err.message);
        socket.emit('ship:colorError', { message: 'Failed to save color preference' });
        return;
      }

      // Update player state
      player.colorId = colorId;

      // Confirm to the player
      socket.emit('ship:colorChanged', { colorId });

      // Broadcast to nearby players
      broadcastToNearby(socket, player, 'player:colorChanged', {
        playerId: authenticatedUserId,
        colorId
      });
    });

    // Ship profile customization
    socket.on('ship:setProfile', (data) => {
      if (!authenticatedUserId) return;

      const player = connectedPlayers.get(socket.id);
      if (!player) return;

      const { profileId } = data;

      // Validate profile ID against available options (O(1) Set lookup)
      if (!VALID_PROFILES.has(profileId)) {
        socket.emit('ship:profileError', { message: 'Invalid profile selection' });
        return;
      }

      // Update database
      try {
        statements.updateShipProfile.run(profileId, authenticatedUserId);
      } catch (err) {
        logger.error(`[PROFILE ERROR] User ${authenticatedUserId} setting profile:`, err.message);
        socket.emit('ship:profileError', { message: 'Failed to save profile preference' });
        return;
      }

      // Update player state
      player.profileId = profileId;

      // Confirm to the player
      socket.emit('ship:profileChanged', { profileId });

      // Broadcast to nearby players (in case we want to show profiles on ships)
      broadcastToNearby(socket, player, 'player:profileChanged', {
        playerId: authenticatedUserId,
        profileId
      });
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

      // Check range (use mining range, subtract wreckage size like mining does)
      const dx = wreckage.position.x - player.position.x;
      const dy = wreckage.position.y - player.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const wreckageSize = wreckage.size || 20; // Standard wreckage size
      const effectiveDistance = dist - wreckageSize;
      const collectRange = config.MINING_RANGE || 100;

      if (effectiveDistance > collectRange) {
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
        // Once collection starts, it continues regardless of movement (beam locks onto target)
        const checkCollection = setInterval(() => {
          const currentPlayer = connectedPlayers.get(socket.id);
          if (!currentPlayer) {
            clearInterval(checkCollection);
            untrackInterval(socket.id, checkCollection);
            engine.cancelWreckageCollection(wreckageId, authenticatedUserId);
            return;
          }

          // Update collection progress
          const progress = engine.updateWreckageCollection(wreckageId, authenticatedUserId, 100);

          if (!progress) {
            clearInterval(checkCollection);
            untrackInterval(socket.id, checkCollection);
            setPlayerStatus(authenticatedUserId, 'idle');
            return;
          }

          if (progress.complete) {
            clearInterval(checkCollection);
            untrackInterval(socket.id, checkCollection);

            // Distribute credits to team members who contributed damage
            const teamCredits = distributeTeamCredits(
              progress.creditReward,
              progress.damageContributors,
              authenticatedUserId
            );

            // Process collected loot (non-credit items go to collector only)
            // Filter out credits from contents - they're handled via team distribution
            const nonCreditContents = progress.contents.filter(item => item.type !== 'credits');
            const lootResults = processCollectedLoot(authenticatedUserId, nonCreditContents);
            lootResults.credits = teamCredits.collectorCredits;

            socket.emit('loot:complete', {
              wreckageId,
              contents: progress.contents,
              results: lootResults,
              teamCredits: teamCredits.total
            });

            // Update inventory and credits
            const inventory = statements.getInventory.all(authenticatedUserId);
            const ship = statements.getShipByUserId.get(authenticatedUserId);
            socket.emit('inventory:update', {
              inventory,
              credits: getSafeCredits(ship)
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
        // Track interval for cleanup on disconnect
        trackInterval(socket.id, checkCollection);
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

    // Wormhole: Enter wormhole
    socket.on('wormhole:enter', (data) => {
      if (!authenticatedUserId) return;

      const player = connectedPlayers.get(socket.id);
      if (!player) return;

      const { wormholeId } = data;

      // Create player object with required properties
      const playerData = {
        id: authenticatedUserId,
        x: player.position.x,
        y: player.position.y
      };

      const result = wormhole.enterWormhole(playerData, wormholeId);

      if (result.success) {
        // Set player status to show they're in wormhole
        setPlayerStatus(authenticatedUserId, 'wormhole');

        socket.emit('wormhole:entered', {
          wormholeId,
          destinations: result.destinations
        });

        // Broadcast to nearby players that player entered wormhole
        broadcastToNearby(socket, player, 'wormhole:playerEntered', {
          playerId: authenticatedUserId,
          wormholeId
        });
      } else {
        socket.emit('wormhole:error', { message: result.error });
      }
    });

    // Wormhole: Select destination
    socket.on('wormhole:selectDestination', (data) => {
      if (!authenticatedUserId) return;

      const player = connectedPlayers.get(socket.id);
      if (!player) return;

      const { destinationId } = data;

      const result = wormhole.selectDestination(authenticatedUserId, destinationId);

      if (result.success) {
        socket.emit('wormhole:transitStarted', {
          destinationId,
          destination: result.destination,
          duration: result.duration
        });

        // Broadcast transit start to nearby players
        broadcastToNearby(socket, player, 'wormhole:playerTransiting', {
          playerId: authenticatedUserId,
          destinationId
        });

        // Set up transit completion check
        setTimeout(() => {
          const completeResult = wormhole.completeTransit(authenticatedUserId);

          if (completeResult.success) {
            // Update player position
            player.position = { x: completeResult.position.x, y: completeResult.position.y };
            player.velocity = { x: 0, y: 0 };

            // Save new position to database
            const sectorX = Math.floor(completeResult.position.x / config.SECTOR_SIZE);
            const sectorY = Math.floor(completeResult.position.y / config.SECTOR_SIZE);
            statements.updateShipPosition.run(
              completeResult.position.x, completeResult.position.y, player.rotation,
              0, 0,
              sectorX, sectorY,
              authenticatedUserId
            );

            // Clear player status
            setPlayerStatus(authenticatedUserId, 'idle');

            socket.emit('wormhole:exitComplete', {
              position: completeResult.position,
              wormholeId: completeResult.wormholeId
            });

            // Broadcast exit to nearby players at new location
            broadcastToNearby(socket, player, 'wormhole:playerExited', {
              playerId: authenticatedUserId,
              x: completeResult.position.x,
              y: completeResult.position.y
            });
          }
        }, wormhole.TRANSIT_DURATION);
      } else {
        socket.emit('wormhole:error', { message: result.error });
      }
    });

    // Wormhole: Cancel transit
    socket.on('wormhole:cancel', () => {
      if (!authenticatedUserId) return;

      const player = connectedPlayers.get(socket.id);
      if (!player) return;

      const result = wormhole.cancelTransit(authenticatedUserId, 'Cancelled by player');

      if (result.success) {
        setPlayerStatus(authenticatedUserId, 'idle');
        socket.emit('wormhole:cancelled', { reason: result.reason });

        // Broadcast cancellation to nearby players
        broadcastToNearby(socket, player, 'wormhole:playerCancelled', {
          playerId: authenticatedUserId
        });
      }
    });

    // Wormhole: Get transit progress
    socket.on('wormhole:getProgress', () => {
      if (!authenticatedUserId) return;

      const progress = wormhole.getTransitProgress(authenticatedUserId);
      socket.emit('wormhole:progress', progress);
    });

    // Wormhole: Get nearest wormhole position (for wormhole gem directional indicator)
    socket.on('wormhole:getNearestPosition', () => {
      if (!authenticatedUserId) return;

      const player = connectedPlayers.get(socket.id);
      if (!player || !player.position) {
        console.log('[Wormhole] getNearestPosition - no player or position');
        return;
      }

      console.log('[Wormhole] getNearestPosition request from player at', Math.round(player.position.x), Math.round(player.position.y));

      const nearestWormhole = world.findNearestWormhole(
        player.position.x,
        player.position.y
      );

      if (nearestWormhole) {
        console.log('[Wormhole] Found nearest at', Math.round(nearestWormhole.x), Math.round(nearestWormhole.y), 'distance:', Math.round(nearestWormhole.distance));
      } else {
        console.log('[Wormhole] No wormhole found in search radius');
      }

      socket.emit('wormhole:nearestPosition', nearestWormhole);
    });

    // Ping for latency measurement
    socket.on('ping', (timestamp) => {
      socket.emit('pong', timestamp);
    });

    // Disconnect
    socket.on('disconnect', () => {
      logger.log(`Client disconnected: ${socket.id}`);
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
      credits: playerData.credits,
      colorId: playerData.ship_color_id || 'green',
      profileId: playerData.profile_id || 'pilot'
    };

    connectedPlayers.set(socket.id, player);
    userSockets.set(playerData.id, socket.id);

    logger.log(`Player ${playerData.username} authenticated`);

    // Notify nearby players of new player
    broadcastToNearby(socket, player, 'player:update', {
      id: playerData.id,
      username: playerData.username,
      x: player.position.x,
      y: player.position.y,
      rotation: player.rotation,
      hull: player.hull,
      shield: player.shield,
      colorId: player.colorId || 'green'
    });
  }

  // Helper: Cleanup player on disconnect
  function cleanupPlayer(socket, userId) {
    const player = connectedPlayers.get(socket.id);
    if (player) {
      // Save final position
      try {
        statements.updateShipPosition.run(
          player.position.x, player.position.y, player.rotation,
          player.velocity.x, player.velocity.y,
          Math.floor(player.position.x / config.SECTOR_SIZE),
          Math.floor(player.position.y / config.SECTOR_SIZE),
          userId
        );
      } catch (err) {
        logger.error(`[DISCONNECT ERROR] Failed to save position for user ${userId}:`, err.message);
      }

      // Notify others
      broadcastToNearby(socket, player, 'player:leave', userId);

      logger.log(`Player ${player.username} disconnected`);
    }

    // Clean up any active intervals (mining, loot collection, etc.)
    const intervals = activeIntervals.get(socket.id);
    if (intervals) {
      for (const intervalId of intervals) {
        clearInterval(intervalId);
      }
      activeIntervals.delete(socket.id);
    }

    // Cancel any active mining session
    mining.cancelMining(userId);

    connectedPlayers.delete(socket.id);
    userSockets.delete(userId);
    // Clean up player status
    const statusData = playerStatus.get(userId);
    if (statusData && statusData.timeout) {
      clearTimeout(statusData.timeout);
    }
    playerStatus.delete(userId);

    // Clean up any active wormhole transit
    wormhole.cleanupPlayer(userId);
  }

  // Helper: Track an interval for cleanup on disconnect
  function trackInterval(socketId, intervalId) {
    if (!activeIntervals.has(socketId)) {
      activeIntervals.set(socketId, new Set());
    }
    activeIntervals.get(socketId).add(intervalId);
  }

  // Helper: Remove a tracked interval (when it completes normally)
  function untrackInterval(socketId, intervalId) {
    const intervals = activeIntervals.get(socketId);
    if (intervals) {
      intervals.delete(intervalId);
      if (intervals.size === 0) {
        activeIntervals.delete(socketId);
      }
    }
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

  // Helper: Distribute credits to team members who contributed damage
  function distributeTeamCredits(baseCredits, damageContributors, collectorId) {
    // If no base credits or invalid, return 0 for all
    if (!baseCredits || typeof baseCredits !== 'number' || baseCredits <= 0) {
      return { total: 0, collectorCredits: 0, distributed: [] };
    }

    // If no damage contributors, collector gets all credits
    if (!damageContributors || Object.keys(damageContributors).length === 0) {
      // Solo kill - collector gets base credits
      const ship = statements.getShipByUserId.get(collectorId);
      if (ship) {
        const currentCredits = getSafeCredits(ship);
        safeUpdateCredits(currentCredits + baseCredits, collectorId);
      }
      return { total: baseCredits, collectorCredits: baseCredits, distributed: [{ playerId: collectorId, credits: baseCredits }] };
    }

    const participants = Object.keys(damageContributors);
    const participantCount = participants.length;
    // Convert collectorId to string to match Object.keys() output (keys are always strings)
    const collectorIdStr = String(collectorId);

    // Apply team bonus multiplier
    const teamMultipliers = config.TEAM_MULTIPLIERS || { 1: 1.0, 2: 1.5, 3: 2.0, 4: 2.5 };
    const teamMultiplier = teamMultipliers[Math.min(participantCount, 4)] || 2.5;
    const totalCredits = Math.round(baseCredits * teamMultiplier);
    const creditsPerPlayer = Math.round(totalCredits / participantCount);

    const distributed = [];
    let collectorCredits = 0;

    // Distribute credits to all contributors
    for (const playerId of participants) {
      try {
        const ship = statements.getShipByUserId.get(playerId);
        if (ship) {
          const currentCredits = getSafeCredits(ship);
          safeUpdateCredits(currentCredits + creditsPerPlayer, playerId);

          distributed.push({ playerId, credits: creditsPerPlayer });

          if (playerId === collectorIdStr) {
            collectorCredits = creditsPerPlayer;
          }

          // Notify non-collector team members of their credit reward
          if (playerId !== collectorIdStr) {
            const socketId = userSockets.get(playerId);
            if (socketId) {
              io.to(socketId).emit('team:creditReward', {
                credits: creditsPerPlayer,
                totalTeamCredits: totalCredits,
                participantCount
              });

              // Also update their inventory display
              const inventory = statements.getInventory.all(playerId);
              const updatedShip = statements.getShipByUserId.get(playerId);
              io.to(socketId).emit('inventory:update', {
                inventory,
                credits: getSafeCredits(updatedShip)
              });
            }
          }
        }
      } catch (err) {
        logger.error(`[TEAM CREDITS] Error distributing to ${playerId}:`, err.message);
      }
    }

    // If collector wasn't a contributor (rare - e.g., collected someone else's kill), they still get share
    if (!participants.includes(collectorIdStr)) {
      const ship = statements.getShipByUserId.get(collectorId);
      if (ship) {
        const currentCredits = getSafeCredits(ship);
        safeUpdateCredits(currentCredits + creditsPerPlayer, collectorId);
        collectorCredits = creditsPerPlayer;
        distributed.push({ playerId: collectorId, credits: creditsPerPlayer });
      }
    }

    logger.log(`[TEAM CREDITS] Distributed ${totalCredits} credits (${teamMultiplier}x bonus) to ${participantCount} players`);

    return { total: totalCredits, collectorCredits, distributed };
  }

  // Helper: Process collected loot and add to player
  function processCollectedLoot(userId, contents) {
    const results = {
      credits: 0,
      resources: [],
      components: [],
      relics: [],
      buffs: [],
      errors: []
    };

    for (const item of contents) {
      try {
        switch (item.type) {
          case 'credits':
            // Add credits to player (only if amount is valid)
            if (typeof item.amount === 'number' && item.amount > 0 && !Number.isNaN(item.amount)) {
              const ship = statements.getShipByUserId.get(userId);
              const currentCredits = getSafeCredits(ship);
              safeUpdateCredits(currentCredits + item.amount, userId);
              results.credits += item.amount;
            }
            break;

          case 'resource':
            // Add resource to inventory using safe wrapper
            const resourceResult = safeUpsertInventory(userId, item.resourceType, item.quantity);
            if (resourceResult.changes > 0) {
              results.resources.push({
                type: item.resourceType,
                quantity: item.quantity
              });
            }
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
      } catch (err) {
        logger.error(`[LOOT ERROR] User ${userId} processing ${item.type}:`, err.message);
        results.errors.push({ type: item.type, error: err.message });
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
