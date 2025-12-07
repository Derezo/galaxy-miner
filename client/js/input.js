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
      case 'KeyT':
        TerminalUI.toggle();
        break;
      case 'KeyE':
        // Toggle emote wheel
        if (typeof EmoteWheel !== 'undefined') {
          EmoteWheel.toggle();
        }
        break;
      case 'Enter':
        ChatUI.toggle();
        break;
      case 'Escape':
        // Cancel wormhole transit during selection, or close panels
        if (Player.inWormholeTransit && Player.wormholeTransitPhase === 'selecting') {
          Player.cancelWormholeTransit();
        } else {
          this.closeAllPanels();
        }
        break;
      case 'KeyM':
        // Priority: Wormhole > Mining > Loot collection
        console.log('[Input] M pressed - wormhole:', Player._nearestWormhole, 'hasGem:', Player.hasRelic('WORMHOLE_GEM'),
          'mineable:', Player._nearestMineable, 'miningTarget:', Player.miningTarget);
        if (Player._nearestWormhole && Player.hasRelic('WORMHOLE_GEM') && !Player.inWormholeTransit) {
          Player.tryEnterWormhole();
        } else if (Player._nearestMineable && !Player.miningTarget) {
          Player.tryMine();
        } else {
          Player.tryCollectWreckage();
        }
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
    TerminalUI.hide();
    ChatUI.hide();
    if (typeof EmoteWheel !== 'undefined') {
      EmoteWheel.close();
    }
  }
};
