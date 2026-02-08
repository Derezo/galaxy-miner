// Galaxy Miner - Fleet Network Handlers

/**
 * Registers fleet-related socket event handlers
 * @param {Socket} socket - Socket.io client instance
 */
function register(socket) {
  // Fleet created successfully
  socket.on('fleet:created', (data) => {
    if (typeof UIState !== 'undefined') {
      UIState.set('fleet', data.fleet);
      UIState.set('fleetInvites', []);
    }
    if (typeof FleetPanel !== 'undefined') {
      FleetPanel.refresh();
    }
    if (typeof Toast !== 'undefined') {
      Toast.show(`Fleet "${data.fleet.name}" created!`, 'success');
    }
  });

  // Joined a fleet
  socket.on('fleet:joined', (data) => {
    if (typeof UIState !== 'undefined') {
      UIState.set('fleet', data.fleet);
      UIState.set('fleetInvites', []);
    }
    if (typeof FleetPanel !== 'undefined') {
      FleetPanel.refresh();
    }
    if (typeof Toast !== 'undefined') {
      Toast.show(`Joined "${data.fleet.name}"!`, 'success');
    }
  });

  // Received a fleet invite
  socket.on('fleet:invite', (data) => {
    if (typeof UIState !== 'undefined') {
      const invites = UIState.get('fleetInvites') || [];
      invites.push({
        fleetId: data.fleetId,
        fleetName: data.fleetName,
        inviterName: data.inviterName
      });
      UIState.set('fleetInvites', invites);
    }
    if (typeof FleetPanel !== 'undefined') {
      FleetPanel.refresh();
    }
    if (typeof Toast !== 'undefined') {
      Toast.show(`${data.inviterName} invited you to fleet "${data.fleetName}"`, 'info');
    }
    if (typeof AudioManager !== 'undefined' && AudioManager.isReady && AudioManager.isReady()) {
      AudioManager.play('notification_info');
    }
  });

  // Invite was sent successfully
  socket.on('fleet:inviteSent', (data) => {
    if (typeof Toast !== 'undefined') {
      Toast.show(`Invite sent to ${data.username}`, 'success');
    }
  });

  // Declined invite
  socket.on('fleet:inviteDeclined', (data) => {
    if (typeof UIState !== 'undefined') {
      const invites = UIState.get('fleetInvites') || [];
      UIState.set('fleetInvites', invites.filter(i => i.fleetId !== data.fleetId));
    }
    if (typeof FleetPanel !== 'undefined') {
      FleetPanel.refresh();
    }
  });

  // Left the fleet
  socket.on('fleet:left', (data) => {
    if (typeof UIState !== 'undefined') {
      UIState.set('fleet', null);
    }
    if (typeof FleetPanel !== 'undefined') {
      FleetPanel.refresh();
    }
    if (typeof Toast !== 'undefined') {
      if (data.disbanded) {
        Toast.show('Fleet disbanded', 'info');
      } else {
        Toast.show('Left the fleet', 'info');
      }
    }
  });

  // Was kicked from fleet
  socket.on('fleet:kicked', () => {
    if (typeof UIState !== 'undefined') {
      UIState.set('fleet', null);
    }
    if (typeof FleetPanel !== 'undefined') {
      FleetPanel.refresh();
    }
    if (typeof Toast !== 'undefined') {
      Toast.show('You were removed from the fleet', 'warning');
    }
  });

  // Another member joined
  socket.on('fleet:memberJoined', (data) => {
    if (typeof UIState !== 'undefined') {
      UIState.set('fleet', data.fleet);
    }
    if (typeof FleetPanel !== 'undefined') {
      FleetPanel.refresh();
    }
    // Find the new member to show their name
    const newMember = data.fleet.members.find(m =>
      !UIState.get('fleet')?.members.some(existing => existing.id === m.id)
    );
    if (typeof Toast !== 'undefined' && newMember) {
      Toast.show(`${newMember.username} joined the fleet`, 'info');
    }
  });

  // A member left or was kicked
  socket.on('fleet:memberLeft', (data) => {
    if (typeof UIState !== 'undefined') {
      UIState.set('fleet', data.fleet);
    }
    if (typeof FleetPanel !== 'undefined') {
      FleetPanel.refresh();
    }
    // Get username from entities if available
    let leftUsername = 'A member';
    if (typeof Entities !== 'undefined') {
      const leftPlayer = Entities.players.get(data.userId);
      if (leftPlayer) {
        leftUsername = leftPlayer.username;
      }
    }
    if (typeof Toast !== 'undefined') {
      if (data.kicked) {
        Toast.show(`${leftUsername} was removed from the fleet`, 'info');
      } else if (data.newLeaderId) {
        Toast.show(`${leftUsername} left. Leadership transferred.`, 'info');
      } else {
        Toast.show(`${leftUsername} left the fleet`, 'info');
      }
    }
  });

  // Successfully kicked a member
  socket.on('fleet:memberKicked', (data) => {
    if (typeof UIState !== 'undefined') {
      UIState.set('fleet', data.fleet);
    }
    if (typeof FleetPanel !== 'undefined') {
      FleetPanel.refresh();
    }
  });

  // Fleet chat message
  socket.on('fleet:message', (data) => {
    if (typeof FleetPanel !== 'undefined') {
      FleetPanel.addChatMessage(data);
    }
    // Play chat sound if not our own message
    if (data.userId !== Player?.id) {
      if (typeof AudioManager !== 'undefined' && AudioManager.isReady && AudioManager.isReady()) {
        AudioManager.play('chat_receive');
      }
    }
  });

  // Fleet data response (initial load or refresh)
  socket.on('fleet:data', (data) => {
    if (typeof UIState !== 'undefined') {
      UIState.set('fleet', data.fleet);
      UIState.set('fleetInvites', data.pendingInvites || []);
    }
    if (typeof FleetPanel !== 'undefined') {
      FleetPanel.refresh();
    }
  });

  // Fleet error
  socket.on('fleet:error', (data) => {
    if (typeof Toast !== 'undefined') {
      Toast.show(data.message || 'Fleet error', 'error');
    }
  });
}

// Export for use in Network module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { register };
} else {
  window.NetworkHandlers = window.NetworkHandlers || {};
  window.NetworkHandlers.fleet = { register };
}
