#!/usr/bin/env node
// Quick test to validate star system generation

const StarSystem = require('./shared/star-system');
const CONSTANTS = require('./shared/constants');

console.log('=== Star System Generation Test ===\n');

console.log('Config values:');
console.log('  SUPER_SECTOR_SIZE:', CONSTANTS.SUPER_SECTOR_SIZE);
console.log('  MIN_STAR_SEPARATION:', CONSTANTS.MIN_STAR_SEPARATION);
console.log('  SYSTEMS_PER_SUPER_SECTOR_MIN:', CONSTANTS.SYSTEMS_PER_SUPER_SECTOR_MIN);
console.log('  SYSTEMS_PER_SUPER_SECTOR_MAX:', CONSTANTS.SYSTEMS_PER_SUPER_SECTOR_MAX);
console.log('');

// Test: Generate systems for a few sectors and count stars
const testSectors = [
  { x: 0, y: 0 },
  { x: -115, y: -8 },  // The sector from the screenshot
  { x: 50, y: 50 },
  { x: -50, y: -50 },
];

for (const sector of testSectors) {
  // Clear cache between tests
  StarSystem.clearCache();

  const systems = StarSystem.getStarSystemsForSector(sector.x, sector.y);

  console.log(`Sector (${sector.x}, ${sector.y}):`);
  console.log(`  Super-sector: (${Math.floor((sector.x * 1000) / CONSTANTS.SUPER_SECTOR_SIZE)}, ${Math.floor((sector.y * 1000) / CONSTANTS.SUPER_SECTOR_SIZE)})`);
  console.log(`  Systems found: ${systems.length}`);

  if (systems.length > 0) {
    for (const sys of systems) {
      console.log(`    - Star at (${Math.round(sys.primaryStar.x)}, ${Math.round(sys.primaryStar.y)}), size: ${Math.round(sys.primaryStar.size)}`);
    }
  }
  console.log('');
}

// Test: Check how many stars appear in a 3x3 sector grid (what player sees)
console.log('=== Simulating Player View ===\n');

const playerSector = { x: -115, y: -8 };
const allStars = new Map(); // Use map to dedupe by ID

StarSystem.clearCache();

for (let dx = -1; dx <= 1; dx++) {
  for (let dy = -1; dy <= 1; dy++) {
    const sx = playerSector.x + dx;
    const sy = playerSector.y + dy;
    const systems = StarSystem.getStarSystemsForSector(sx, sy);

    for (const sys of systems) {
      // Check if star is actually IN this sector
      const starSectorX = Math.floor(sys.primaryStar.x / CONSTANTS.SECTOR_SIZE);
      const starSectorY = Math.floor(sys.primaryStar.y / CONSTANTS.SECTOR_SIZE);

      if (starSectorX === sx && starSectorY === sy) {
        allStars.set(sys.primaryStar.id, sys.primaryStar);
      }
    }
  }
}

console.log(`Player at sector (${playerSector.x}, ${playerSector.y})`);
console.log(`Stars visible in 3x3 sector grid: ${allStars.size}`);

for (const [id, star] of allStars) {
  const starSectorX = Math.floor(star.x / CONSTANTS.SECTOR_SIZE);
  const starSectorY = Math.floor(star.y / CONSTANTS.SECTOR_SIZE);
  console.log(`  - ${id} at sector (${starSectorX}, ${starSectorY}), pos (${Math.round(star.x)}, ${Math.round(star.y)})`);
}

// Test: Check super-sector generation directly
console.log('\n=== Super-Sector Generation Test ===\n');

StarSystem.clearCache();

let totalStars = 0;
const superSectorsToTest = 25; // 5x5 grid

for (let sx = -2; sx <= 2; sx++) {
  for (let sy = -2; sy <= 2; sy++) {
    const systems = StarSystem.generateSuperSector(sx, sy);
    totalStars += systems.length;
    if (systems.length > 0) {
      console.log(`Super-sector (${sx}, ${sy}): ${systems.length} systems`);
    }
  }
}

console.log(`\nTotal stars in ${superSectorsToTest} super-sectors: ${totalStars}`);
console.log(`Average stars per super-sector: ${(totalStars / superSectorsToTest).toFixed(2)}`);
console.log(`Expected (with 0-1 per super-sector): ~0.5`);
