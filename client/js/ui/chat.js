// Galaxy Miner - Chat UI

const ChatUI = {
  visible: false,
  messages: [],
  lastMessageTime: 0,

  init() {
    const panel = document.getElementById('chat-panel');
    panel.querySelector('.close-btn').addEventListener('click', () => this.hide());

    document.getElementById('chat-send').addEventListener('click', () => this.sendMessage());
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendMessage();
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
    document.getElementById('chat-panel').classList.remove('hidden');
    document.getElementById('chat-input').focus();
    this.scrollToBottom();
  },

  hide() {
    this.visible = false;
    document.getElementById('chat-panel').classList.add('hidden');
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
