/**
 * Unit tests for server/game/spatial-hash.js
 * Tests spatial hash data structure for O(k) range queries
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const SpatialHash = require('../../../server/game/spatial-hash');

describe('SpatialHash', () => {
  let hash;

  beforeEach(() => {
    hash = new SpatialHash(200); // 200 unit cells
  });

  describe('constructor', () => {
    it('should create with default cell size', () => {
      const defaultHash = new SpatialHash();
      expect(defaultHash.cellSize).toBe(200);
    });

    it('should create with custom cell size', () => {
      const customHash = new SpatialHash(100);
      expect(customHash.cellSize).toBe(100);
    });

    it('should initialize empty cells and entityCells maps', () => {
      expect(hash.cells.size).toBe(0);
      expect(hash.entityCells.size).toBe(0);
    });
  });

  describe('getKey', () => {
    it('should return cell key for positive coordinates', () => {
      expect(hash.getKey(100, 150)).toBe('0:0');
      expect(hash.getKey(200, 200)).toBe('1:1');
      expect(hash.getKey(450, 350)).toBe('2:1');
    });

    it('should return cell key for negative coordinates', () => {
      expect(hash.getKey(-100, -150)).toBe('-1:-1');
      expect(hash.getKey(-200, -200)).toBe('-1:-1');
      expect(hash.getKey(-201, -201)).toBe('-2:-2');
    });

    it('should handle zero coordinates', () => {
      expect(hash.getKey(0, 0)).toBe('0:0');
    });
  });

  describe('insert', () => {
    it('should insert entity into correct cell', () => {
      hash.insert('entity1', 100, 150);
      expect(hash.cells.get('0:0').has('entity1')).toBe(true);
      expect(hash.entityCells.get('entity1')).toBe('0:0');
    });

    it('should create new cell if it does not exist', () => {
      hash.insert('entity1', 500, 500);
      expect(hash.cells.has('2:2')).toBe(true);
    });

    it('should allow multiple entities in same cell', () => {
      hash.insert('entity1', 100, 100);
      hash.insert('entity2', 150, 150);
      const cell = hash.cells.get('0:0');
      expect(cell.has('entity1')).toBe(true);
      expect(cell.has('entity2')).toBe(true);
    });
  });

  describe('remove', () => {
    it('should remove entity from cell', () => {
      hash.insert('entity1', 100, 100);
      hash.remove('entity1');
      expect(hash.entityCells.has('entity1')).toBe(false);
    });

    it('should clean up empty cells', () => {
      hash.insert('entity1', 100, 100);
      hash.remove('entity1');
      expect(hash.cells.has('0:0')).toBe(false);
    });

    it('should handle removing non-existent entity', () => {
      expect(() => hash.remove('nonexistent')).not.toThrow();
    });

    it('should not affect other entities in same cell', () => {
      hash.insert('entity1', 100, 100);
      hash.insert('entity2', 150, 150);
      hash.remove('entity1');
      expect(hash.cells.get('0:0').has('entity2')).toBe(true);
    });
  });

  describe('update', () => {
    it('should move entity to new cell when position changes', () => {
      hash.insert('entity1', 100, 100);
      hash.update('entity1', 500, 500);
      expect(hash.cells.get('0:0')).toBeUndefined();
      expect(hash.cells.get('2:2').has('entity1')).toBe(true);
    });

    it('should not re-insert if cell has not changed', () => {
      hash.insert('entity1', 100, 100);
      hash.update('entity1', 150, 150); // Still in cell 0:0
      expect(hash.cells.get('0:0').has('entity1')).toBe(true);
    });
  });

  describe('query', () => {
    beforeEach(() => {
      // Create a grid of entities
      hash.insert('e1', 100, 100);   // Cell 0:0
      hash.insert('e2', 300, 100);   // Cell 1:0
      hash.insert('e3', 500, 500);   // Cell 2:2
      hash.insert('e4', -100, -100); // Cell -1:-1
    });

    it('should return entities in range', () => {
      const results = hash.query(100, 100, 250);
      expect(results.has('e1')).toBe(true);
      expect(results.has('e2')).toBe(true);
    });

    it('should return empty set if no entities in range', () => {
      const results = hash.query(1000, 1000, 100);
      expect(results.size).toBe(0);
    });

    it('should return entities from multiple cells', () => {
      const results = hash.query(200, 200, 500);
      expect(results.size).toBeGreaterThan(1);
    });

    it('should include entities from negative coordinate cells', () => {
      const results = hash.query(0, 0, 300);
      expect(results.has('e1')).toBe(true);
      expect(results.has('e4')).toBe(true);
    });
  });

  describe('clear', () => {
    it('should remove all entities', () => {
      hash.insert('e1', 100, 100);
      hash.insert('e2', 300, 300);
      hash.clear();
      expect(hash.cells.size).toBe(0);
      expect(hash.entityCells.size).toBe(0);
    });
  });

  describe('rebuild', () => {
    it('should rebuild from entity map', () => {
      const entities = new Map([
        ['e1', { position: { x: 100, y: 100 } }],
        ['e2', { position: { x: 500, y: 500 } }]
      ]);
      hash.rebuild(entities);
      expect(hash.entityCells.has('e1')).toBe(true);
      expect(hash.entityCells.has('e2')).toBe(true);
    });

    it('should skip entities without position', () => {
      const entities = new Map([
        ['e1', { position: { x: 100, y: 100 } }],
        ['e2', null],
        ['e3', { noPosition: true }]
      ]);
      hash.rebuild(entities);
      expect(hash.entityCells.has('e1')).toBe(true);
      expect(hash.entityCells.has('e2')).toBe(false);
      expect(hash.entityCells.has('e3')).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      hash.insert('e1', 100, 100);
      hash.insert('e2', 150, 150);
      hash.insert('e3', 500, 500);
      const stats = hash.getStats();
      expect(stats.cells).toBe(2);
      expect(stats.entities).toBe(3);
      expect(stats.avgPerCell).toBe(1.5);
    });

    it('should handle empty hash', () => {
      const stats = hash.getStats();
      expect(stats.cells).toBe(0);
      expect(stats.entities).toBe(0);
      expect(stats.avgPerCell).toBe(0);
    });
  });
});
