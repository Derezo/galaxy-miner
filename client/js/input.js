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

    Logger.log('Input system initialized');
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
        // Toggle emote wheel (not while dead)
        if (typeof EmoteWheel !== 'undefined' && !Player.isDead) {
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
        // Cannot perform actions while dead
        if (Player.isDead) break;

        // Priority: Wormhole > Plunder > Mining > Loot collection
        Logger.log('[Input] M pressed - wormhole:', Player._nearestWormhole, 'hasGem:', Player.hasRelic('WORMHOLE_GEM'),
          'nearestBase:', Player._nearestBase, 'hasSkullAndBones:', Player.hasRelic('SKULL_AND_BONES'),
          'mineable:', Player._nearestMineable, 'miningTarget:', Player.miningTarget, 'hasScrapSiphon:', Player.hasRelic('SCRAP_SIPHON'));
        if (Player._nearestWormhole && Player.hasRelic('WORMHOLE_GEM') && !Player.inWormholeTransit) {
          Player.tryEnterWormhole();
        } else if (Player._nearestBase && Player.hasRelic('SKULL_AND_BONES')) {
          Player.tryPlunderBase();
        } else if (Player._nearestMineable && !Player.miningTarget) {
          Player.tryMine();
        } else if (Player.hasRelic('SCRAP_SIPHON')) {
          // Scrap Siphon: Multi-collect wreckage
          Player.tryMultiCollectWreckage();
        } else {
          Player.tryCollectWreckage();
        }
        break;
      case 'Space':
        // Fire weapon (cannot fire while dead)
        if (!Player.isDead) {
          Player.fire();
        }
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

  /**
   * Get mobile movement input from virtual joystick
   * @returns {Object|null} Mobile input or null if not on mobile/no input
   */
  getMobileMovementInput() {
    if (typeof VirtualJoystick === 'undefined' || !VirtualJoystick.active) {
      return null;
    }
    return VirtualJoystick.getMovementInput();
  },

  /**
   * Get unified movement input (mobile or keyboard)
   * @returns {Object} Movement input with support for both input types
   */
  getMovementInput() {
    // Check mobile input first (takes priority when active)
    const mobileInput = this.getMobileMovementInput();
    if (mobileInput && mobileInput.thrustMagnitude > 0) {
      return {
        up: false,
        down: false,
        left: false,
        right: false,
        boost: false,
        // Mobile-specific analog values
        targetRotation: mobileInput.targetRotation,
        thrustMagnitude: mobileInput.thrustMagnitude,
        isMobile: true
      };
    }

    // Fall back to keyboard input
    return {
      up: this.isKeyDown('ArrowUp') || this.isKeyDown('KeyW'),
      down: this.isKeyDown('ArrowDown') || this.isKeyDown('KeyS'),
      left: this.isKeyDown('ArrowLeft') || this.isKeyDown('KeyA'),
      right: this.isKeyDown('ArrowRight') || this.isKeyDown('KeyD'),
      boost: this.isKeyDown('ShiftLeft') || this.isKeyDown('ShiftRight'),
      // No mobile values
      targetRotation: undefined,
      thrustMagnitude: 0,
      isMobile: false
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
