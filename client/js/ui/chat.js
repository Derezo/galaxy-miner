// Galaxy Miner - Chat UI (Integrated into HUD)

const ChatUI = {
  visible: false,
  messages: [],
  lastMessageTime: 0,
  unreadCount: 0,
  autoHideTimeout: null,

  init() {
    // Chat indicator click handler
    document.getElementById('chat-indicator').addEventListener('click', () => this.toggle());

    // Chat input and send handlers
    document.getElementById('chat-send').addEventListener('click', () => this.sendMessage());
    document.getElementById('chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.sendMessage();
        e.preventDefault();
      } else if (e.key === 'Escape') {
        this.hide();
        e.preventDefault();
      }
    });

    // Auto-hide when clicking outside
    document.addEventListener('click', (e) => {
      const overlay = document.getElementById('chat-overlay');
      const indicator = document.getElementById('chat-indicator');
      if (this.visible && !overlay.contains(e.target) && !indicator.contains(e.target)) {
        this.hide();
      }
    });

    console.log('Chat UI initialized');
  },

  toggle() {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  },

  show() {
    this.visible = true;
    this.unreadCount = 0;
    this.updateUnreadBadge();
    document.getElementById('chat-overlay').classList.remove('hidden');
    document.getElementById('chat-input').focus();
    this.scrollToBottom();
    this.clearAutoHide();
  },

  hide() {
    this.visible = false;
    document.getElementById('chat-overlay').classList.add('hidden');
    this.clearAutoHide();
  },

  clearAutoHide() {
    if (this.autoHideTimeout) {
      clearTimeout(this.autoHideTimeout);
      this.autoHideTimeout = null;
    }
  },

  scheduleAutoHide() {
    this.clearAutoHide();
    this.autoHideTimeout = setTimeout(() => {
      if (this.visible && document.getElementById('chat-input').value === '') {
        this.hide();
      }
    }, 5000);
  },

  updateUnreadBadge() {
    const badge = document.getElementById('chat-unread-badge');
    if (this.unreadCount > 0) {
      badge.textContent = this.unreadCount > 9 ? '9+' : this.unreadCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  },

  sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();

    if (!message) return;

    // Rate limiting
    const now = Date.now();
    if (now - this.lastMessageTime < CONSTANTS.CHAT_RATE_LIMIT) {
      return;
    }

    this.lastMessageTime = now;
    Network.sendChat(message);
    input.value = '';
  },

  addMessage(data) {
    this.messages.push(data);

    // Keep only last N messages
    if (this.messages.length > CONSTANTS.CHAT_HISTORY_SIZE) {
      this.messages.shift();
    }

    // Increment unread if chat is not visible
    if (!this.visible) {
      this.unreadCount++;
      this.updateUnreadBadge();
    }

    this.renderMessages();
  },

  renderMessages() {
    const container = document.getElementById('chat-messages');

    // Add new message
    const div = document.createElement('div');
    div.className = 'chat-message';

    const latestMsg = this.messages[this.messages.length - 1];
    div.innerHTML = `
      <span class="sender">${this.escapeHtml(latestMsg.username)}:</span>
      <span class="text">${this.escapeHtml(latestMsg.message)}</span>
    `;

    container.appendChild(div);
    this.scrollToBottom();
  },

  scrollToBottom() {
    const container = document.getElementById('chat-messages');
    container.scrollTop = container.scrollHeight;
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};
