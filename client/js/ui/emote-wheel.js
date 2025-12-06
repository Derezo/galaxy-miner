/**
 * Emote Wheel UI
 * Circular menu for selecting and sending emotes
 */

const EmoteWheel = {
  isOpen: false,
  container: null,

  /**
   * Initialize the emote wheel
   */
  init() {
    // Create container
    this.container = document.createElement('div');
    this.container.id = 'emote-wheel';
    this.container.className = 'emote-wheel hidden';
    document.body.appendChild(this.container);

    // Add styles
    this.addStyles();
  },

  /**
   * Add CSS styles for the emote wheel
   */
  addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .emote-wheel {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 200px;
        height: 200px;
        z-index: 1000;
        pointer-events: none;
      }

      .emote-wheel.hidden {
        display: none;
      }

      .emote-wheel-bg {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 34, 0.9);
        border: 2px solid #00aaff;
        border-radius: 50%;
        box-shadow: 0 0 20px rgba(0, 170, 255, 0.3);
      }

      .emote-option {
        position: absolute;
        width: 60px;
        height: 60px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        pointer-events: auto;
        transition: transform 0.15s, background-color 0.15s;
        border-radius: 50%;
        background: rgba(0, 100, 150, 0.5);
        border: 1px solid #00aaff40;
      }

      .emote-option:hover {
        transform: scale(1.15);
        background: rgba(0, 170, 255, 0.4);
        border-color: #00aaff;
      }

      .emote-option .emote-icon {
        font-size: 28px;
        line-height: 1;
      }

      .emote-option .emote-label {
        font-size: 9px;
        color: #aaddff;
        margin-top: 2px;
        text-align: center;
      }

      .emote-wheel-hint {
        position: absolute;
        bottom: -30px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 11px;
        color: #888;
        white-space: nowrap;
      }
    `;
    document.head.appendChild(style);
  },

  /**
   * Open the emote wheel
   */
  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.render();
    this.container.classList.remove('hidden');
  },

  /**
   * Close the emote wheel
   */
  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.container.classList.add('hidden');
  },

  /**
   * Toggle the emote wheel
   */
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  },

  /**
   * Render the emote wheel content
   */
  render() {
    const emotes = Object.entries(CONSTANTS.EMOTES);
    const count = emotes.length;
    const radius = 55; // Distance from center to option

    let html = '<div class="emote-wheel-bg"></div>';

    emotes.forEach(([type, emote], i) => {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2; // Start from top
      const x = 100 + Math.cos(angle) * radius - 30; // Center at 100, option is 60px wide
      const y = 100 + Math.sin(angle) * radius - 30;

      html += `
        <div class="emote-option" style="left: ${x}px; top: ${y}px;" data-emote="${type}">
          <span class="emote-icon">${emote.icon}</span>
          <span class="emote-label">${emote.name}</span>
        </div>
      `;
    });

    html += '<div class="emote-wheel-hint">Click to send, [E] to close</div>';

    this.container.innerHTML = html;

    // Add click handlers
    this.container.querySelectorAll('.emote-option').forEach(el => {
      el.addEventListener('click', (e) => {
        const emoteType = el.dataset.emote;
        this.send(emoteType);
      });
    });
  },

  /**
   * Send an emote
   * @param {string} emoteType
   */
  send(emoteType) {
    Network.sendEmote(emoteType);
    this.close();

    // Also show our own emote locally
    EmoteRenderer.show(
      Player.position.x,
      Player.position.y,
      emoteType,
      Player.username
    );
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.EmoteWheel = EmoteWheel;
}
