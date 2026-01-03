/**
 * SpatialHash - O(1) spatial indexing for efficient range queries
 *
 * Instead of iterating all entities for range queries (O(n)), this class
 * uses a grid-based spatial hash for O(k) lookups where k = nearby entities.
 *
 * Cell size should be roughly equal to the typical query range for best performance.
 */

class SpatialHash {
  /**
   * @param {number} cellSize - Size of each cell in world units (default 200)
   */
  constructor(cellSize = 200) {
    this.cellSize = cellSize;
    this.cells = new Map(); // 'x:y' -> Set of entity IDs
    this.entityCells = new Map(); // entityId -> 'x:y' (for update/remove)
  }

  /**
   * Get cell key from world coordinates
   * @param {number} x
   * @param {number} y
   * @returns {string}
   */
  getKey(x, y) {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX}:${cellY}`;
  }

  /**
   * Insert an entity into the spatial hash
   * @param {string|number} id - Entity ID
   * @param {number} x - World X coordinate
   * @param {number} y - World Y coordinate
   */
  insert(id, x, y) {
    const key = this.getKey(x, y);

    // Create cell if it doesn't exist
    if (!this.cells.has(key)) {
      this.cells.set(key, new Set());
    }

    this.cells.get(key).add(id);
    this.entityCells.set(id, key);
  }

  /**
   * Remove an entity from the spatial hash
   * @param {string|number} id - Entity ID
   */
  remove(id) {
    const key = this.entityCells.get(id);
    if (key) {
      const cell = this.cells.get(key);
      if (cell) {
        cell.delete(id);
        // Clean up empty cells to prevent memory bloat
        if (cell.size === 0) {
          this.cells.delete(key);
        }
      }
      this.entityCells.delete(id);
    }
  }

  /**
   * Update an entity's position (remove + re-insert)
   * @param {string|number} id - Entity ID
   * @param {number} x - New world X coordinate
   * @param {number} y - New world Y coordinate
   */
  update(id, x, y) {
    const newKey = this.getKey(x, y);
    const currentKey = this.entityCells.get(id);

    // Only update if cell changed
    if (currentKey !== newKey) {
      this.remove(id);
      this.insert(id, x, y);
    }
  }

  /**
   * Query entities within a range from a position
   * Returns entity IDs - caller must look up actual entity data
   * @param {number} x - Query center X
   * @param {number} y - Query center Y
   * @param {number} range - Query radius
   * @returns {Set<string|number>} Set of entity IDs in range cells
   */
  query(x, y, range) {
    const results = new Set();

    // Calculate cell range to check
    const cellRange = Math.ceil(range / this.cellSize);
    const centerCellX = Math.floor(x / this.cellSize);
    const centerCellY = Math.floor(y / this.cellSize);

    // Check all cells that could contain entities within range
    for (let dx = -cellRange; dx <= cellRange; dx++) {
      for (let dy = -cellRange; dy <= cellRange; dy++) {
        const key = `${centerCellX + dx}:${centerCellY + dy}`;
        const cell = this.cells.get(key);
        if (cell) {
          for (const id of cell) {
            results.add(id);
          }
        }
      }
    }

    return results;
  }

  /**
   * Clear all entries from the spatial hash
   */
  clear() {
    this.cells.clear();
    this.entityCells.clear();
  }

  /**
   * Rebuild the spatial hash from a Map of entities
   * Useful when entities are updated frequently and tracking individual updates is complex
   * @param {Map} entities - Map of id -> entity with {position: {x, y}}
   */
  rebuild(entities) {
    this.clear();
    for (const [id, entity] of entities) {
      if (entity && entity.position) {
        this.insert(id, entity.position.x, entity.position.y);
      }
    }
  }

  /**
   * Get statistics about the spatial hash
   * @returns {{cells: number, entities: number, avgPerCell: number}}
   */
  getStats() {
    let totalEntities = 0;
    for (const cell of this.cells.values()) {
      totalEntities += cell.size;
    }
    return {
      cells: this.cells.size,
      entities: totalEntities,
      avgPerCell: this.cells.size > 0 ? totalEntities / this.cells.size : 0
    };
  }
}

module.exports = SpatialHash;
