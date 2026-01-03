// Galaxy Miner - Fleet System (Server-side)
// Manages player parties/fleets for group play

const { db, statements } = require('../database');
const logger = require('../../shared/logger');
const CONSTANTS = require('../../shared/constants');

const MAX_FLEET_SIZE = CONSTANTS.FLEET?.MAX_SIZE || 4;
const INVITE_EXPIRY_MS = CONSTANTS.FLEET?.INVITE_EXPIRY_MS || 300000; // 5 minutes

/**
 * Create a new fleet with the given player as leader
 * @param {number} leaderId - User ID of the fleet leader
 * @param {string} name - Fleet name (optional)
 * @returns {Object} { success: boolean, fleetId?: number, error?: string }
 */
function create(leaderId, name = 'Fleet') {
  try {
    // Check if user already leads or is in a fleet
    const existingFleet = getPlayerFleet(leaderId);
    if (existingFleet) {
      return { success: false, error: 'Already in a fleet' };
    }

    // Create fleet
    const result = statements.createFleet.run(leaderId, name);
    const fleetId = result.lastInsertRowid;

    // Add leader as first member
    statements.addFleetMember.run(fleetId, leaderId, 'leader');

    logger.log(`[FLEET] Created fleet ${fleetId} "${name}" with leader ${leaderId}`);
    return { success: true, fleetId };
  } catch (error) {
    logger.error('[FLEET] Error creating fleet:', error);
    return { success: false, error: 'Failed to create fleet' };
  }
}

/**
 * Send an invite to a player
 * @param {number} fleetId - Fleet ID
 * @param {number} inviterId - User ID sending the invite
 * @param {number} inviteeId - User ID to invite
 * @returns {Object} { success: boolean, inviteId?: number, error?: string }
 */
function invite(fleetId, inviterId, inviteeId) {
  try {
    const fleet = statements.getFleetById.get(fleetId);
    if (!fleet) {
      return { success: false, error: 'Fleet not found' };
    }

    // Check inviter is in fleet
    const inviterMember = statements.getFleetMember.get(fleetId, inviterId);
    if (!inviterMember) {
      return { success: false, error: 'Not a member of this fleet' };
    }

    // Check fleet size limit
    const memberCount = statements.getMemberCount.get(fleetId);
    if (memberCount.count >= MAX_FLEET_SIZE) {
      return { success: false, error: 'Fleet is full' };
    }

    // Check if invitee is already in a fleet
    const inviteeFleet = getPlayerFleet(inviteeId);
    if (inviteeFleet) {
      return { success: false, error: 'Player is already in a fleet' };
    }

    // Check for existing invite
    const existingInvite = statements.getFleetInviteByFleetAndInvitee.get(fleetId, inviteeId);
    if (existingInvite) {
      return { success: false, error: 'Invite already pending' };
    }

    // Create invite with expiry
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS).toISOString();
    const result = statements.createFleetInvite.run(fleetId, inviterId, inviteeId, expiresAt);

    logger.log(`[FLEET] Player ${inviterId} invited ${inviteeId} to fleet ${fleetId}`);
    return { success: true, inviteId: result.lastInsertRowid };
  } catch (error) {
    logger.error('[FLEET] Error creating invite:', error);
    return { success: false, error: 'Failed to send invite' };
  }
}

/**
 * Accept a fleet invite
 * @param {number} inviteeId - User ID accepting the invite
 * @param {number} fleetId - Fleet ID to join
 * @returns {Object} { success: boolean, error?: string }
 */
function accept(inviteeId, fleetId) {
  try {
    // Verify invite exists and is valid
    const inviteRecord = statements.getFleetInviteByFleetAndInvitee.get(fleetId, inviteeId);
    if (!inviteRecord) {
      return { success: false, error: 'Invite not found or expired' };
    }

    // Check fleet still exists and has space
    const fleet = statements.getFleetById.get(fleetId);
    if (!fleet) {
      statements.deleteFleetInviteByFleetAndInvitee.run(fleetId, inviteeId);
      return { success: false, error: 'Fleet no longer exists' };
    }

    const memberCount = statements.getMemberCount.get(fleetId);
    if (memberCount.count >= MAX_FLEET_SIZE) {
      return { success: false, error: 'Fleet is now full' };
    }

    // Check if player is already in a fleet
    const existingFleet = getPlayerFleet(inviteeId);
    if (existingFleet) {
      statements.deleteFleetInviteByFleetAndInvitee.run(fleetId, inviteeId);
      return { success: false, error: 'Already in a fleet' };
    }

    // Add to fleet
    statements.addFleetMember.run(fleetId, inviteeId, 'member');

    // Delete the invite
    statements.deleteFleetInviteByFleetAndInvitee.run(fleetId, inviteeId);

    logger.log(`[FLEET] Player ${inviteeId} joined fleet ${fleetId}`);
    return { success: true };
  } catch (error) {
    logger.error('[FLEET] Error accepting invite:', error);
    return { success: false, error: 'Failed to join fleet' };
  }
}

/**
 * Decline a fleet invite
 * @param {number} inviteeId - User ID declining the invite
 * @param {number} fleetId - Fleet ID
 * @returns {Object} { success: boolean, error?: string }
 */
function decline(inviteeId, fleetId) {
  try {
    statements.deleteFleetInviteByFleetAndInvitee.run(fleetId, inviteeId);
    logger.log(`[FLEET] Player ${inviteeId} declined invite to fleet ${fleetId}`);
    return { success: true };
  } catch (error) {
    logger.error('[FLEET] Error declining invite:', error);
    return { success: false, error: 'Failed to decline invite' };
  }
}

/**
 * Leave the current fleet
 * @param {number} userId - User ID leaving
 * @returns {Object} { success: boolean, disbanded?: boolean, newLeaderId?: number, error?: string }
 */
function leave(userId) {
  try {
    const fleet = getPlayerFleet(userId);
    if (!fleet) {
      return { success: false, error: 'Not in a fleet' };
    }

    const isLeader = fleet.leader_id === userId;
    const members = getMembers(fleet.id);

    // Remove from fleet
    statements.removeFleetMember.run(fleet.id, userId);

    // If leader leaving, handle succession or disband
    if (isLeader) {
      const remainingMembers = members.filter(m => m.user_id !== userId);

      if (remainingMembers.length === 0) {
        // No one left, disband fleet
        statements.deleteFleet.run(fleet.id);
        logger.log(`[FLEET] Fleet ${fleet.id} disbanded (last member left)`);
        return { success: true, disbanded: true };
      } else {
        // Promote next member to leader
        const newLeader = remainingMembers[0];
        statements.updateFleetLeader.run(newLeader.user_id, fleet.id);
        statements.updateMemberRole.run('leader', fleet.id, newLeader.user_id);
        logger.log(`[FLEET] Player ${userId} left, ${newLeader.user_id} promoted to leader`);
        return { success: true, newLeaderId: newLeader.user_id };
      }
    }

    logger.log(`[FLEET] Player ${userId} left fleet ${fleet.id}`);
    return { success: true };
  } catch (error) {
    logger.error('[FLEET] Error leaving fleet:', error);
    return { success: false, error: 'Failed to leave fleet' };
  }
}

/**
 * Kick a member from the fleet (leader only)
 * @param {number} kickerId - User ID doing the kicking
 * @param {number} targetId - User ID to kick
 * @returns {Object} { success: boolean, error?: string }
 */
function kick(kickerId, targetId) {
  try {
    const fleet = getPlayerFleet(kickerId);
    if (!fleet) {
      return { success: false, error: 'Not in a fleet' };
    }

    // Only leader can kick
    if (fleet.leader_id !== kickerId) {
      return { success: false, error: 'Only the leader can kick members' };
    }

    // Can't kick yourself
    if (kickerId === targetId) {
      return { success: false, error: 'Cannot kick yourself (use leave instead)' };
    }

    // Verify target is in same fleet
    const targetMember = statements.getFleetMember.get(fleet.id, targetId);
    if (!targetMember) {
      return { success: false, error: 'Player is not in your fleet' };
    }

    // Remove the member
    statements.removeFleetMember.run(fleet.id, targetId);

    logger.log(`[FLEET] Leader ${kickerId} kicked ${targetId} from fleet ${fleet.id}`);
    return { success: true };
  } catch (error) {
    logger.error('[FLEET] Error kicking member:', error);
    return { success: false, error: 'Failed to kick member' };
  }
}

/**
 * Disband the fleet (leader only)
 * @param {number} leaderId - User ID of the leader
 * @returns {Object} { success: boolean, error?: string }
 */
function disband(leaderId) {
  try {
    const fleet = getPlayerFleet(leaderId);
    if (!fleet) {
      return { success: false, error: 'Not in a fleet' };
    }

    if (fleet.leader_id !== leaderId) {
      return { success: false, error: 'Only the leader can disband the fleet' };
    }

    // Delete fleet (cascade will remove members and invites)
    statements.deleteFleet.run(fleet.id);

    logger.log(`[FLEET] Fleet ${fleet.id} disbanded by leader ${leaderId}`);
    return { success: true };
  } catch (error) {
    logger.error('[FLEET] Error disbanding fleet:', error);
    return { success: false, error: 'Failed to disband fleet' };
  }
}

/**
 * Get fleet by ID
 * @param {number} fleetId - Fleet ID
 * @returns {Object|null} Fleet data or null
 */
function getFleet(fleetId) {
  return statements.getFleetById.get(fleetId);
}

/**
 * Get the fleet a player is in
 * @param {number} userId - User ID
 * @returns {Object|null} Fleet data or null
 */
function getPlayerFleet(userId) {
  return statements.getFleetByMember.get(userId);
}

/**
 * Get all members of a fleet
 * @param {number} fleetId - Fleet ID
 * @returns {Array} Array of member objects
 */
function getMembers(fleetId) {
  return statements.getFleetMembers.all(fleetId);
}

/**
 * Get a player's role in a fleet
 * @param {number} fleetId - Fleet ID
 * @param {number} userId - User ID
 * @returns {string|null} Role ('leader', 'member') or null
 */
function getMemberRole(fleetId, userId) {
  const member = statements.getFleetMember.get(fleetId, userId);
  return member ? member.role : null;
}

/**
 * Get pending invites for a player
 * @param {number} userId - User ID
 * @returns {Array} Array of invite objects
 */
function getPendingInvites(userId) {
  return statements.getPlayerInvites.all(userId);
}

/**
 * Check if two players are in the same fleet
 * @param {number} userId1 - First user ID
 * @param {number} userId2 - Second user ID
 * @returns {boolean} True if in same fleet
 */
function areInSameFleet(userId1, userId2) {
  const fleet1 = getPlayerFleet(userId1);
  const fleet2 = getPlayerFleet(userId2);

  if (!fleet1 || !fleet2) return false;
  return fleet1.id === fleet2.id;
}

/**
 * Clean up expired invites (called periodically)
 */
function cleanupExpiredInvites() {
  try {
    const result = statements.cleanExpiredInvites.run();
    if (result.changes > 0) {
      logger.log(`[FLEET] Cleaned up ${result.changes} expired invite(s)`);
    }
  } catch (error) {
    logger.error('[FLEET] Error cleaning expired invites:', error);
  }
}

/**
 * Get full fleet data including members (for client sync)
 * @param {number} fleetId - Fleet ID
 * @returns {Object|null} Full fleet data or null
 */
function getFullFleetData(fleetId) {
  const fleet = getFleet(fleetId);
  if (!fleet) return null;

  const members = getMembers(fleetId);
  return {
    id: fleet.id,
    name: fleet.name,
    leaderId: fleet.leader_id,
    leaderName: fleet.leader_name,
    members: members.map(m => ({
      id: m.user_id,
      username: m.username,
      role: m.role,
      joinedAt: m.joined_at
    })),
    createdAt: fleet.created_at
  };
}

module.exports = {
  create,
  invite,
  accept,
  decline,
  leave,
  kick,
  disband,
  getFleet,
  getPlayerFleet,
  getMembers,
  getMemberRole,
  getPendingInvites,
  areInSameFleet,
  cleanupExpiredInvites,
  getFullFleetData,
  MAX_FLEET_SIZE,
  INVITE_EXPIRY_MS
};
