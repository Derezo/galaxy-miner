// Galaxy Miner - Input Handling

const Input = {
  keys: {},
  mousePosition: { x: 0, y: 0 },
  mouseDown: false,

  init() {
    document.addEventListener('keydown', (e) => this.onKeyDown(e));
    document.addEventListener('keyup', (e) => this.onKeyUp(e));
    document.addEventListener('mousemove', (e) => this.onMouseMove(e));
    document.addEventListener('mousedown', (e) => this.onMouseDown(e));
    document.addEventListener('mouseup', (e) => this.onMouseUp(e));

    console.log('Input system initialized');
  },

  onKeyDown(e) {
    // Ignore if typing in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    this.keys[e.code] = true;

    // Handle UI shortcuts
    if (!GalaxyMiner.gameStarted) return;

    switch (e.code) {
      case 'KeyI':
        InventoryUI.toggle();
        break;
      case 'KeyU':
        // Upgrades panel toggle (to be implemented)
        break;
      case 'KeyK':
        MarketplaceUI.toggle();
        break;
      case 'Enter':
        ChatUI.toggle();
        break;
      case 'Escape':
        this.closeAllPanels();
        break;
      case 'KeyM':
        // Mine action
        Player.tryMine();
        break;
      case 'Space':
        // Fire weapon
        Player.fire();
        break;
    }
  },

  onKeyUp(e) {
    this.keys[e.code] = false;
  },

  onMouseMove(e) {
    this.mousePosition.x = e.clientX;
    this.mousePosition.y = e.clientY;
  },

  onMouseDown(e) {
    if (e.button === 0) {
      this.mouseDown = true;
    }
  },

  onMouseUp(e) {
    if (e.button === 0) {
      this.mouseDown = false;
    }
  },

  isKeyDown(code) {
    return this.keys[code] === true;
  },

  getMovementInput() {
    return {
      up: this.isKeyDown('ArrowUp') || this.isKeyDown('KeyW'),
      down: this.isKeyDown('ArrowDown') || this.isKeyDown('KeyS'),
      left: this.isKeyDown('ArrowLeft') || this.isKeyDown('KeyA'),
      right: this.isKeyDown('ArrowRight') || this.isKeyDown('KeyD'),
      boost: this.isKeyDown('ShiftLeft') || this.isKeyDown('ShiftRight')
    };
  },

  closeAllPanels() {
    InventoryUI.hide();
    MarketplaceUI.hide();
    ChatUI.hide();
    // Close other panels as needed
  }
};
