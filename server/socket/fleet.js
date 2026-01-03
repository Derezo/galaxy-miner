'use strict';

/**
 * Fleet Socket Handler
 * Events: fleet:create, fleet:invite, fleet:accept, fleet:decline,
 *         fleet:leave, fleet:kick, fleet:chat, fleet:getData
 */

const fleet = require('../game/fleet');
const { statements } = require('../database');

/**
 * Register fleet socket event handlers
 * @param {Object} socket - Socket.io socket instance
 * @param {Object} deps - Shared dependencies
 */
function register(socket, deps) {
  const { io, getAuthenticatedUserId, logger } = deps;
  const { connectedPlayers, userSockets } = deps.state;

  // Fleet: Create new fleet
  socket.on('fleet:create', (data) => {
    const authenticatedUserId = getAuthenticatedUserId();
    if (!authenticatedUserId) return;

    const name = (data?.name || 'Fleet').trim().slice(0, 30);
    const result = fleet.create(authenticatedUserId, name);

    if (result.success) {
      const fleetData = fleet.getFullFleetData(result.fleetId);
      socket.emit('fleet:created', { fleet: fleetData });
    } else {
      socket.emit('fleet:error', { message: result.error });
    }
  });

  // Fleet: Invite player
  socket.on('fleet:invite', (data) => {
    const authenticatedUserId = getAuthenticatedUserId();
    if (!authenticatedUserId) return;

    const { username } = data || {};
    if (!username) {
      socket.emit('fleet:error', { message: 'Username required' });
      return;
    }

    // Find invitee by username
    const invitee = statements.getUserByUsername.get(username);
    if (!invitee) {
      socket.emit('fleet:error', { message: 'Player not found' });
      return;
    }

    // Get inviter's fleet
    const inviterFleet = fleet.getPlayerFleet(authenticatedUserId);
    if (!inviterFleet) {
      socket.emit('fleet:error', { message: 'You are not in a fleet' });
      return;
    }

    const result = fleet.invite(inviterFleet.id, authenticatedUserId, invitee.id);

    if (result.success) {
      // Notify inviter
      socket.emit('fleet:inviteSent', { username: invitee.username });

      // Notify invitee if online
      const inviteeSocketId = userSockets.get(invitee.id);
      if (inviteeSocketId) {
        const inviterPlayer = connectedPlayers.get(socket.id);
        io.to(inviteeSocketId).emit('fleet:invite', {
          fleetId: inviterFleet.id,
          fleetName: inviterFleet.name,
          inviterName: inviterPlayer?.username || 'Unknown'
        });
      }
    } else {
      socket.emit('fleet:error', { message: result.error });
    }
  });

  // Fleet: Accept invite
  socket.on('fleet:accept', (data) => {
    const authenticatedUserId = getAuthenticatedUserId();
    if (!authenticatedUserId) return;

    const { fleetId } = data || {};
    if (!fleetId) {
      socket.emit('fleet:error', { message: 'Fleet ID required' });
      return;
    }

    const result = fleet.accept(authenticatedUserId, fleetId);

    if (result.success) {
      const fleetData = fleet.getFullFleetData(fleetId);

      // Notify new member
      socket.emit('fleet:joined', { fleet: fleetData });

      // Notify other fleet members
      const members = fleet.getMembers(fleetId);
      for (const member of members) {
        if (member.user_id === authenticatedUserId) continue;
        const memberSocketId = userSockets.get(member.user_id);
        if (memberSocketId) {
          io.to(memberSocketId).emit('fleet:memberJoined', {
            fleet: fleetData
          });
        }
      }
    } else {
      socket.emit('fleet:error', { message: result.error });
    }
  });

  // Fleet: Decline invite
  socket.on('fleet:decline', (data) => {
    const authenticatedUserId = getAuthenticatedUserId();
    if (!authenticatedUserId) return;

    const { fleetId } = data || {};
    if (!fleetId) return;

    fleet.decline(authenticatedUserId, fleetId);
    socket.emit('fleet:inviteDeclined', { fleetId });
  });

  // Fleet: Leave fleet
  socket.on('fleet:leave', () => {
    const authenticatedUserId = getAuthenticatedUserId();
    if (!authenticatedUserId) return;

    const playerFleet = fleet.getPlayerFleet(authenticatedUserId);
    if (!playerFleet) {
      socket.emit('fleet:error', { message: 'Not in a fleet' });
      return;
    }

    const fleetId = playerFleet.id;
    const membersBefore = fleet.getMembers(fleetId);
    const result = fleet.leave(authenticatedUserId);

    if (result.success) {
      // Notify the leaving player
      socket.emit('fleet:left', { disbanded: result.disbanded });

      // Notify remaining members
      if (!result.disbanded) {
        const fleetData = fleet.getFullFleetData(fleetId);
        for (const member of membersBefore) {
          if (member.user_id === authenticatedUserId) continue;
          const memberSocketId = userSockets.get(member.user_id);
          if (memberSocketId) {
            io.to(memberSocketId).emit('fleet:memberLeft', {
              userId: authenticatedUserId,
              fleet: fleetData,
              newLeaderId: result.newLeaderId
            });
          }
        }
      }
    } else {
      socket.emit('fleet:error', { message: result.error });
    }
  });

  // Fleet: Kick member (leader only)
  socket.on('fleet:kick', (data) => {
    const authenticatedUserId = getAuthenticatedUserId();
    if (!authenticatedUserId) return;

    const { userId } = data || {};
    if (!userId) {
      socket.emit('fleet:error', { message: 'User ID required' });
      return;
    }

    const playerFleet = fleet.getPlayerFleet(authenticatedUserId);
    if (!playerFleet) return;

    const fleetId = playerFleet.id;
    const result = fleet.kick(authenticatedUserId, userId);

    if (result.success) {
      const fleetData = fleet.getFullFleetData(fleetId);

      // Notify leader
      socket.emit('fleet:memberKicked', { userId, fleet: fleetData });

      // Notify kicked player
      const kickedSocketId = userSockets.get(userId);
      if (kickedSocketId) {
        io.to(kickedSocketId).emit('fleet:kicked', {});
      }

      // Notify other members
      const members = fleet.getMembers(fleetId);
      for (const member of members) {
        if (member.user_id === authenticatedUserId) continue;
        const memberSocketId = userSockets.get(member.user_id);
        if (memberSocketId) {
          io.to(memberSocketId).emit('fleet:memberLeft', {
            userId,
            fleet: fleetData,
            kicked: true
          });
        }
      }
    } else {
      socket.emit('fleet:error', { message: result.error });
    }
  });

  // Fleet: Chat message
  socket.on('fleet:chat', (data) => {
    const authenticatedUserId = getAuthenticatedUserId();
    if (!authenticatedUserId) return;

    const { message } = data || {};
    if (!message || typeof message !== 'string') return;

    const cleanMessage = message.trim().slice(0, 500);
    if (!cleanMessage) return;

    const playerFleet = fleet.getPlayerFleet(authenticatedUserId);
    if (!playerFleet) {
      socket.emit('fleet:error', { message: 'Not in a fleet' });
      return;
    }

    const player = connectedPlayers.get(socket.id);
    const chatMessage = {
      userId: authenticatedUserId,
      username: player?.username || 'Unknown',
      message: cleanMessage,
      timestamp: Date.now()
    };

    // Send to all fleet members
    const members = fleet.getMembers(playerFleet.id);
    for (const member of members) {
      const memberSocketId = userSockets.get(member.user_id);
      if (memberSocketId) {
        io.to(memberSocketId).emit('fleet:message', chatMessage);
      }
    }
  });

  // Fleet: Get fleet data and pending invites
  socket.on('fleet:getData', () => {
    const authenticatedUserId = getAuthenticatedUserId();
    if (!authenticatedUserId) return;

    const playerFleet = fleet.getPlayerFleet(authenticatedUserId);
    const pendingInvites = fleet.getPendingInvites(authenticatedUserId);

    socket.emit('fleet:data', {
      fleet: playerFleet ? fleet.getFullFleetData(playerFleet.id) : null,
      pendingInvites: pendingInvites.map(inv => ({
        fleetId: inv.fleet_id,
        fleetName: inv.fleet_name,
        inviterName: inv.inviter_name,
        expiresAt: inv.expires_at
      }))
    });
  });
}

module.exports = { register };
