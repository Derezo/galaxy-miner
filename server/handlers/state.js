/**
 * Shared state for socket handlers
 * All handler modules access this shared state
 */

// Track connected players: socketId -> { userId, username, position, velocity, etc. }
const connectedPlayers = new Map();

// Reverse lookup: userId -> socketId
const userSockets = new Map();

// Track player status: userId -> { status, timeout }
const playerStatus = new Map();

// Track active intervals per socket for cleanup: socketId -> Set of intervalIds
const activeIntervals = new Map();

/**
 * Track an interval for cleanup on disconnect
 * @param {string} socketId - Socket ID
 * @param {number} intervalId - Interval ID from setInterval
 */
function trackInterval(socketId, intervalId) {
  if (!activeIntervals.has(socketId)) {
    activeIntervals.set(socketId, new Set());
  }
  activeIntervals.get(socketId).add(intervalId);
}

/**
 * Remove a tracked interval (when it completes normally)
 * @param {string} socketId - Socket ID
 * @param {number} intervalId - Interval ID
 */
function untrackInterval(socketId, intervalId) {
  const intervals = activeIntervals.get(socketId);
  if (intervals) {
    intervals.delete(intervalId);
    if (intervals.size === 0) {
      activeIntervals.delete(socketId);
    }
  }
}

/**
 * Clear all intervals for a socket
 * @param {string} socketId - Socket ID
 */
function clearAllIntervals(socketId) {
  const intervals = activeIntervals.get(socketId);
  if (intervals) {
    for (const intervalId of intervals) {
      clearInterval(intervalId);
    }
    activeIntervals.delete(socketId);
  }
}

/**
 * Set player status with optional auto-clear timeout
 * @param {number} userId - User ID
 * @param {string} status - Status string ('idle', 'mining', 'collecting', etc.)
 * @param {number} timeout - Optional timeout in ms to auto-clear to 'idle'
 */
function setPlayerStatus(userId, status, timeout = 0) {
  // Clear any existing timeout
  const existing = playerStatus.get(userId);
  if (existing && existing.timeout) {
    clearTimeout(existing.timeout);
  }

  if (timeout > 0) {
    // Set status with auto-clear timeout
    const timeoutId = setTimeout(() => {
      setPlayerStatus(userId, 'idle');
    }, timeout);
    playerStatus.set(userId, { status, timeout: timeoutId });
  } else {
    playerStatus.set(userId, { status, timeout: null });
  }
}

/**
 * Get player status
 * @param {number} userId - User ID
 * @returns {string} Status or 'idle' if not set
 */
function getPlayerStatus(userId) {
  const data = playerStatus.get(userId);
  return data ? data.status : 'idle';
}

/**
 * Clear player status (including any timeout)
 * @param {number} userId - User ID
 */
function clearPlayerStatus(userId) {
  const statusData = playerStatus.get(userId);
  if (statusData && statusData.timeout) {
    clearTimeout(statusData.timeout);
  }
  playerStatus.delete(userId);
}

module.exports = {
  connectedPlayers,
  userSockets,
  playerStatus,
  activeIntervals,
  trackInterval,
  untrackInterval,
  clearAllIntervals,
  setPlayerStatus,
  getPlayerStatus,
  clearPlayerStatus
};
