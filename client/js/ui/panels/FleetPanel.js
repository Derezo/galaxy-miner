/**
 * FleetPanel Component
 * Manages fleet creation, invites, members, and fleet chat.
 */

const FleetPanel = {
  // Chat messages (kept in memory, not persisted)
  chatMessages: [],
  MAX_CHAT_MESSAGES: 50,

  /**
   * Initialize the fleet panel
   */
  init() {
    // Subscribe to fleet state changes
    UIState.subscribe('fleet', () => {
      this.render();
    });

    UIState.subscribe('fleetInvites', () => {
      this.render();
    });

    // Request fleet data when terminal opens on fleet tab
    document.addEventListener('terminal:tabchange', (e) => {
      if (e.detail && e.detail.tab === 'fleet') {
        this._requestFleetData();
      }
    });

    // Initial render to show no-fleet view
    this.render();
  },

  /**
   * Refresh the panel
   */
  refresh() {
    this.render();
  },

  /**
   * Request current fleet data from server
   */
  _requestFleetData() {
    if (typeof Network !== 'undefined' && Network.socket) {
      Network.socket.emit('fleet:getData');
    }
  },

  /**
   * Render the fleet panel
   */
  render() {
    const container = document.getElementById('fleet-content');
    if (!container) return;

    const fleet = UIState.get('fleet');
    const invites = UIState.get('fleetInvites') || [];

    let html;
    if (fleet) {
      html = this._renderFleetView(fleet);
    } else {
      html = this._renderNoFleetView(invites);
    }

    container.innerHTML = html;
    this._bindEvents(container);
  },

  /**
   * Render view when player is in a fleet
   */
  _renderFleetView(fleet) {
    const isLeader = fleet.leaderId === Player?.id;
    const members = fleet.members || [];

    return `
      <div class="fleet-panel">
        <div class="fleet-header">
          <div class="fleet-name">${this._escapeHtml(fleet.name)}</div>
          <div class="fleet-count">${members.length}/4 members</div>
        </div>

        <div class="fleet-members">
          ${members.map(m => this._renderMember(m, isLeader)).join('')}
        </div>

        <div class="fleet-actions">
          ${isLeader ? `
            <div class="fleet-invite-form">
              <input type="text" id="fleet-invite-username" placeholder="Invite player..." maxlength="20">
              <button id="fleet-invite-btn" class="hud-btn">Invite</button>
            </div>
          ` : ''}
          <button id="fleet-leave-btn" class="hud-btn danger">${isLeader ? 'Disband Fleet' : 'Leave Fleet'}</button>
        </div>

        <div class="fleet-chat">
          <div class="fleet-chat-header">Fleet Chat</div>
          <div class="fleet-chat-messages" id="fleet-chat-messages">
            ${this.chatMessages.length === 0 ?
              '<div class="chat-empty">No messages yet</div>' :
              this.chatMessages.map(m => this._renderChatMessage(m)).join('')
            }
          </div>
          <div class="fleet-chat-input">
            <input type="text" id="fleet-chat-input" placeholder="Message fleet..." maxlength="500">
            <button id="fleet-chat-send" class="hud-btn">Send</button>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Render a single member row
   */
  _renderMember(member, isLeader) {
    const isMe = member.id === Player?.id;
    const isMemberLeader = member.role === 'leader';

    // Try to get live position/health from Entities
    let healthPercent = 100;
    if (typeof Entities !== 'undefined' && !isMe) {
      const entityPlayer = Entities.players.get(member.id);
      if (entityPlayer && entityPlayer.hull) {
        healthPercent = Math.round((entityPlayer.hull.current / entityPlayer.hull.max) * 100);
      }
    } else if (isMe && typeof Player !== 'undefined') {
      healthPercent = Math.round((Player.hull / Player.hullMax) * 100);
    }

    return `
      <div class="fleet-member ${isMe ? 'is-me' : ''} ${isMemberLeader ? 'is-leader' : ''}">
        <div class="member-info">
          <span class="member-name">${this._escapeHtml(member.username)}</span>
          ${isMemberLeader ? '<span class="member-role">Leader</span>' : ''}
        </div>
        <div class="member-health">
          <div class="health-bar">
            <div class="health-fill" style="width: ${healthPercent}%"></div>
          </div>
        </div>
        ${isLeader && !isMe && !isMemberLeader ? `
          <button class="kick-btn" data-user-id="${member.id}" title="Remove from fleet">&times;</button>
        ` : ''}
      </div>
    `;
  },

  /**
   * Render view when player is not in a fleet
   */
  _renderNoFleetView(invites) {
    return `
      <div class="fleet-panel no-fleet">
        <div class="fleet-create-section">
          <h3>Create a Fleet</h3>
          <p>Form a fleet to team up with other players.</p>
          <div class="fleet-create-form">
            <input type="text" id="fleet-create-name" placeholder="Fleet name..." maxlength="30" value="Fleet">
            <button id="fleet-create-btn" class="hud-btn">Create Fleet</button>
          </div>
        </div>

        ${invites.length > 0 ? `
          <div class="fleet-invites-section">
            <h3>Pending Invites</h3>
            <div class="fleet-invites">
              ${invites.map(inv => this._renderInvite(inv)).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  },

  /**
   * Render a fleet invite
   */
  _renderInvite(invite) {
    return `
      <div class="fleet-invite" data-fleet-id="${invite.fleetId}">
        <div class="invite-info">
          <span class="invite-fleet">${this._escapeHtml(invite.fleetName)}</span>
          <span class="invite-from">from ${this._escapeHtml(invite.inviterName)}</span>
        </div>
        <div class="invite-actions">
          <button class="accept-btn hud-btn" data-fleet-id="${invite.fleetId}">Join</button>
          <button class="decline-btn hud-btn danger" data-fleet-id="${invite.fleetId}">Decline</button>
        </div>
      </div>
    `;
  },

  /**
   * Render a chat message
   */
  _renderChatMessage(msg) {
    const isMe = msg.userId === Player?.id;
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return `
      <div class="chat-message ${isMe ? 'is-me' : ''}">
        <span class="chat-time">${time}</span>
        <span class="chat-user">${this._escapeHtml(msg.username)}:</span>
        <span class="chat-text">${this._escapeHtml(msg.message)}</span>
      </div>
    `;
  },

  /**
   * Add a chat message to the panel
   */
  addChatMessage(msg) {
    this.chatMessages.push(msg);
    if (this.chatMessages.length > this.MAX_CHAT_MESSAGES) {
      this.chatMessages.shift();
    }

    // Update just the chat area if panel is visible
    const chatContainer = document.getElementById('fleet-chat-messages');
    if (chatContainer) {
      chatContainer.innerHTML = this.chatMessages.map(m => this._renderChatMessage(m)).join('');
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  },

  /**
   * Bind event handlers
   */
  _bindEvents(container) {
    // Create fleet
    const createBtn = container.querySelector('#fleet-create-btn');
    if (createBtn) {
      createBtn.addEventListener('click', () => {
        const nameInput = container.querySelector('#fleet-create-name');
        const name = (nameInput?.value || 'Fleet').trim();
        if (typeof Network !== 'undefined' && Network.socket) {
          Network.socket.emit('fleet:create', { name });
        }
      });
    }

    // Invite player
    const inviteBtn = container.querySelector('#fleet-invite-btn');
    if (inviteBtn) {
      inviteBtn.addEventListener('click', () => {
        const usernameInput = container.querySelector('#fleet-invite-username');
        const username = (usernameInput?.value || '').trim();
        if (username && typeof Network !== 'undefined' && Network.socket) {
          Network.socket.emit('fleet:invite', { username });
          usernameInput.value = '';
        }
      });
    }

    // Leave fleet
    const leaveBtn = container.querySelector('#fleet-leave-btn');
    if (leaveBtn) {
      leaveBtn.addEventListener('click', () => {
        if (typeof Network !== 'undefined' && Network.socket) {
          Network.socket.emit('fleet:leave');
        }
      });
    }

    // Kick member
    container.querySelectorAll('.kick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const userId = parseInt(btn.dataset.userId);
        if (userId && typeof Network !== 'undefined' && Network.socket) {
          Network.socket.emit('fleet:kick', { userId });
        }
      });
    });

    // Accept invite
    container.querySelectorAll('.accept-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const fleetId = parseInt(btn.dataset.fleetId);
        if (fleetId && typeof Network !== 'undefined' && Network.socket) {
          Network.socket.emit('fleet:accept', { fleetId });
        }
      });
    });

    // Decline invite
    container.querySelectorAll('.decline-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const fleetId = parseInt(btn.dataset.fleetId);
        if (fleetId && typeof Network !== 'undefined' && Network.socket) {
          Network.socket.emit('fleet:decline', { fleetId });
        }
      });
    });

    // Chat send
    const chatSendBtn = container.querySelector('#fleet-chat-send');
    const chatInput = container.querySelector('#fleet-chat-input');

    if (chatSendBtn && chatInput) {
      const sendMessage = () => {
        const message = chatInput.value.trim();
        if (message && typeof Network !== 'undefined' && Network.socket) {
          Network.socket.emit('fleet:chat', { message });
          chatInput.value = '';
        }
      };

      chatSendBtn.addEventListener('click', sendMessage);
      chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          sendMessage();
        }
      });
    }

    // Scroll chat to bottom
    const chatMessages = container.querySelector('#fleet-chat-messages');
    if (chatMessages) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  },

  /**
   * Escape HTML to prevent XSS
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.FleetPanel = FleetPanel;
}
