// Galaxy Miner - Network Module

const Network = {
  socket: null,
  connected: false,
  token: null,

  init() {
    this.socket = io();

    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.connected = true;

      // Try to restore session
      const savedToken = localStorage.getItem('galaxy-miner-token');
      if (savedToken) {
        this.authenticate(savedToken);
      }
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      this.connected = false;
    });

    this.socket.on('auth:success', (data) => {
      console.log('Authentication successful');
      this.token = data.token;
      localStorage.setItem('galaxy-miner-token', data.token);
      GalaxyMiner.startGame(data.player);
    });

    this.socket.on('auth:error', (error) => {
      console.error('Authentication error:', error);
      AuthUI.showError(error.message);
    });

    this.socket.on('player:update', (data) => {
      Entities.updatePlayer(data);
    });

    this.socket.on('player:leave', (playerId) => {
      Entities.removePlayer(playerId);
    });

    this.socket.on('world:update', (data) => {
      World.handleUpdate(data);
    });

    this.socket.on('inventory:update', (data) => {
      Player.updateInventory(data);
      InventoryUI.refresh();
    });

    this.socket.on('combat:event', (data) => {
      // Handle combat events (hits, deaths, etc.)
    });

    this.socket.on('chat:message', (data) => {
      ChatUI.addMessage(data);
    });

    this.socket.on('market:update', (data) => {
      MarketplaceUI.refresh();
    });

    // Latency measurement
    this.socket.on('pong', (timestamp) => {
      const latency = Date.now() - timestamp;
      HUD.updateLatency(latency);
    });
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

  sendUpgrade(component) {
    if (!this.connected) return;
    this.socket.emit('ship:upgrade', { component });
  },

  ping() {
    this.socket.emit('ping', Date.now());
  }
};
