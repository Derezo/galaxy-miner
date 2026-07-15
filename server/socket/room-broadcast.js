'use strict';

/**
 * Emit once to the union of several Socket.io rooms.
 *
 * Socket.io de-duplicates sockets that belong to more than one room when the
 * room array is passed to a single BroadcastOperator. Calling emit once per
 * room would instead deliver duplicate gameplay events to overlapping members.
 */
function emitToRoomUnion(socket, rooms, event, data) {
  if (!socket || typeof socket.to !== 'function' || typeof event !== 'string') {
    return false;
  }

  const uniqueRooms = Array.from(new Set(
    (Array.isArray(rooms) ? rooms : [rooms])
      .filter(room => typeof room === 'string' && room.length > 0)
  ));
  if (uniqueRooms.length === 0) return false;

  const broadcaster = socket.to(uniqueRooms);
  if (!broadcaster || typeof broadcaster.emit !== 'function') return false;
  broadcaster.emit(event, data);
  return true;
}

module.exports = { emitToRoomUnion };
