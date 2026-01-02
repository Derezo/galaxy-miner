// Galaxy Miner - Network Module

const Network = {
  socket: null,
  connected: false,
  token: null,

  init() {
    this.socket = io();

    // Debug: Log ALL incoming socket events
    this.socket.onAny((eventName, ...args) => {
      if (eventName.startsWith('loot:') || eventName.startsWith('wreckage:')) {
        Logger.log('[SOCKET] Received event:', eventName, args);
      }
    });

    this.socket.on('connect', () => {
      Logger.log('Connected to server');
      this.connected = true;

      // Try to restore session
      const savedToken = localStorage.getItem('galaxy-miner-token');
      if (savedToken) {
        this.authenticate(savedToken);
      }
    });

    this.socket.on('disconnect', () => {
      Logger.log('Disconnected from server');
      this.connected = false;
    });

    // Auth events - handled in /client/js/network/auth.js
    // Ship events (colorChanged, colorError, profileChanged, profileError, upgrade:success, upgrade:error, error:generic) - handled in /client/js/network/ship.js
    // Player events (colorChanged, damaged, death, debuff, dot) - handled in /client/js/network/player.js
    // Mining events - handled in /client/js/network/mining.js
    // Combat events - handled in /client/js/network/combat.js
    // NPC events (spawn, update, destroyed, swarm, queen, base, formation, hive) - handled in /client/js/network/npc.js
    // Scavenger events - handled in /client/js/network/scavenger.js
    // Pirate events - handled in /client/js/network/pirate.js
    // Loot events (wreckage, loot, buff, relic, plunder) - handled in /client/js/network/loot.js
    // Market events - handled in /client/js/network/marketplace.js
    // Chat events - handled in /client/js/network/chat.js
    // Wormhole events - handled in /client/js/network/wormhole.js
    // Derelict events - handled in /client/js/network/derelict.js


    // Register modular network handlers (npc:destroyed, wreckage:spawn, etc.)
    if (window.NetworkHandlers && window.NetworkHandlers.registerAll) {
      window.NetworkHandlers.registerAll(this.socket);
      Logger.log('[Network] Registered modular network handlers');
    }
  },

  authenticate(token) {
    this.socket.emit('auth:token', { token });
  },

  login(username, password) {
    this.socket.emit('auth:login', { username, password });
  },

  register(username, password) {
    this.socket.emit('auth:register', { username, password });
  },

  logout() {
    localStorage.removeItem('galaxy-miner-token');
    this.token = null;
    this.socket.emit('auth:logout');
    GalaxyMiner.stopGame();
  },

  sendMovement(input) {
    if (!this.connected) return;
    this.socket.emit('player:input', input);
  },

  sendFire(direction) {
    if (!this.connected) return;
    this.socket.emit('combat:fire', { direction });
  },

  sendMine(objectId) {
    if (!this.connected) return;
    this.socket.emit('mining:start', { objectId });
  },

  sendChat(message) {
    if (!this.connected) return;
    this.socket.emit('chat:send', { message });
  },

  sendMarketList(resourceType, quantity, price) {
    if (!this.connected) return;
    this.socket.emit('market:list', { resourceType, quantity, price });
  },

  sendMarketBuy(listingId, quantity) {
    if (!this.connected) return;
    this.socket.emit('market:buy', { listingId, quantity });
  },

  sendMarketCancel(listingId) {
    if (!this.connected) return;
    this.socket.emit('market:cancel', { listingId });
  },

  sendMarketGetListings(resourceType = null) {
    if (!this.connected) return;
    this.socket.emit('market:getListings', { resourceType });
  },

  sendMarketGetMyListings() {
    if (!this.connected) return;
    this.socket.emit('market:getMyListings', {});
  },

  sendUpgrade(component) {
    if (!this.connected) return;
    this.socket.emit('ship:upgrade', { component });
  },

  ping() {
    this.socket.emit('ping', Date.now());
  },

  sendEmote(emoteType) {
    if (!this.connected) return;
    this.socket.emit('emote:send', { emoteType });
  },

  // Loot collection
  sendLootCollect(wreckageId) {
    if (!this.connected) return;
    this.socket.emit('loot:startCollect', { wreckageId });
  },

  sendLootCancel(wreckageId) {
    if (!this.connected) return;
    this.socket.emit('loot:cancelCollect', { wreckageId });
  },

  // Scrap Siphon multi-collect
  sendMultiCollect() {
    if (!this.connected) return;
    this.socket.emit('wreckage:multiCollect');
  },

  requestNearbyWreckage() {
    if (!this.connected) return;
    this.socket.emit('loot:getNearby');
  },

  // Ship color customization
  sendSetColor(colorId) {
    if (!this.connected) return;
    this.socket.emit('ship:setColor', { colorId });
  },

  requestShipData() {
    if (!this.connected) return;
    this.socket.emit('ship:getData');
  },

  // Wormhole transit
  sendEnterWormhole(wormholeId) {
    if (!this.connected) return;
    this.socket.emit('wormhole:enter', { wormholeId });
  },

  sendSelectWormholeDestination(destinationId) {
    if (!this.connected) return;
    this.socket.emit('wormhole:selectDestination', { destinationId });
  },

  sendCancelWormhole() {
    if (!this.connected) return;
    this.socket.emit('wormhole:cancel');
  },

  requestNearestWormholePosition() {
    if (!this.connected) return;
    this.socket.emit('wormhole:getNearestPosition');
  },

  // Skull and Bones plunder
  sendPlunderBase(baseId) {
    if (!this.connected) return;
    this.socket.emit('relic:plunder', { baseId });
  },

  // Respawn location selection
  sendRespawnSelect(type, targetId = null) {
    if (!this.connected) return;
    this.socket.emit('respawn:select', { type, targetId });
  }
};
