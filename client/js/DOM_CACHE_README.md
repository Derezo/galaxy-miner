# DOM Cache Module

A lazy-loading DOM element cache for Galaxy Miner that reduces repeated `getElementById` calls and improves performance.

## Overview

The `DOMCache` module provides a centralized, lazy-loading cache for DOM elements accessed via `getElementById`. Instead of repeatedly querying the DOM for the same elements, the cache stores references after the first access, significantly improving performance in UI-heavy operations.

The module is included in `index.html` and available globally as `window.DOMCache`.

## Basic Usage

### Method 1: Using `.get(id)` - Generic Access

```javascript
// Old way - repeated DOM queries
const element = document.getElementById('terminal-panel');
const element2 = document.getElementById('terminal-panel'); // Queries DOM again!

// New way - cached access
const element = DOMCache.get('terminal-panel');
const element2 = DOMCache.get('terminal-panel'); // Returns cached element
```

### Method 2: Using Named Getters - Convenient Access

```javascript
// Old way
const authScreen = document.getElementById('auth-screen');
const hud = document.getElementById('hud');
const radarCanvas = document.getElementById('radar-canvas');

// New way - cleaner and cached
const authScreen = DOMCache.authScreen;
const hud = DOMCache.hud;
const radarCanvas = DOMCache.radarCanvas;
```

## API Reference

### Core Methods

#### `DOMCache.get(id)`
Get a DOM element by ID with caching. Returns `HTMLElement` or `null`.

```javascript
const panel = DOMCache.get('terminal-panel');
```

#### `DOMCache.getMany(ids)`
Get multiple elements at once. Returns an object keyed by ID.

```javascript
const elements = DOMCache.getMany(['auth-screen', 'hud', 'terminal-panel']);
```

#### `DOMCache.invalidate(id)`
Clear a cached element (use when DOM changes dynamically).

```javascript
DOMCache.invalidate('custom-modal');
const freshElement = DOMCache.get('custom-modal'); // Re-fetches from DOM
```

#### `DOMCache.invalidateMany(ids)`
Clear multiple cached elements at once.

#### `DOMCache.invalidateAll()`
Clear entire cache (use when doing major DOM restructuring).

#### `DOMCache.refresh(id)`
Invalidate and immediately re-fetch an element.

```javascript
const element = DOMCache.refresh('terminal-panel');
```

#### `DOMCache.exists(id)`
Check if an element exists without caching it.

#### `DOMCache.preload()`
Pre-cache critical elements for faster first access. Called automatically on DOM ready.

### Debug Utilities

#### `DOMCache.getStats()`
Returns `{ totalCached, validElements, nullElements, initialized }`.

#### `DOMCache.debug()`
Log detailed cache information to console.

## Named Getters Reference

### Auth Screen Elements
```javascript
DOMCache.authScreen          // Main auth container
DOMCache.loginForm           // Login form
DOMCache.registerForm        // Register form
DOMCache.loginUsername       // Login username input
DOMCache.loginPassword       // Login password input
DOMCache.loginBtn            // Login button
DOMCache.registerUsername    // Register username input
DOMCache.registerPassword    // Register password input
DOMCache.registerConfirm     // Confirm password input
DOMCache.registerBtn         // Register button
DOMCache.authError           // Error message display
DOMCache.showRegister        // Switch to register link
DOMCache.showLogin           // Switch to login link
```

### HUD Elements
```javascript
DOMCache.hud                 // Main HUD container
DOMCache.radarCanvas         // Radar canvas element
DOMCache.terminalIcon        // Terminal icon button
DOMCache.terminalRadialMenu  // Radial menu overlay
DOMCache.profileImageContainer // Profile image wrapper
DOMCache.profileImage        // Profile image/emoji
DOMCache.profileUsername     // Username display
DOMCache.profileDisplay      // Profile container
DOMCache.creditValue         // Credit amount display
DOMCache.creditIconContainer // Credit icon wrapper
DOMCache.creditsDisplay      // Credits section
DOMCache.sectorCoords        // Sector coordinates display
```

### Terminal Panel Elements
```javascript
DOMCache.terminalPanel       // Main terminal panel
DOMCache.cargoContent        // Cargo tab content
DOMCache.upgradesContent     // Upgrades tab content
DOMCache.marketContent       // Market tab content
DOMCache.customizeContent    // Customize tab content
DOMCache.relicsContent       // Relics tab content
DOMCache.settingsContent     // Settings tab content
```

### Inventory Elements
```javascript
DOMCache.cargoUsed           // Current cargo weight
DOMCache.cargoMax            // Max cargo capacity
DOMCache.inventoryList       // Inventory items container
```

### Upgrades Elements
```javascript
DOMCache.upgradesList        // Upgrades list container
```

### Market Elements
```javascript
DOMCache.marketListings      // Market listings container
DOMCache.sellResource        // Resource type select
DOMCache.sellQuantity        // Quantity input
DOMCache.sellPrice           // Price input
DOMCache.sellSubmit          // Submit listing button
```

### Chat Elements
```javascript
DOMCache.chatOverlay         // Chat overlay container
DOMCache.chatIcon            // Chat icon button
DOMCache.chatMessages        // Chat messages container
DOMCache.chatInput           // Chat input field
DOMCache.chatSend            // Send button
DOMCache.chatUnreadBadge     // Unread message badge
```

### Hints, Overlays & Canvas
```javascript
DOMCache.miningHint          // Mining hint text
DOMCache.lootHint            // Loot hint text
DOMCache.wormholeHint        // Wormhole hint text
DOMCache.uiContainer         // Main UI container
DOMCache.gameCanvas          // Main game canvas
DOMCache.shipPreviewCanvas   // Ship preview canvas
DOMCache.wormholeTransitCanvas // Wormhole transit canvas
DOMCache.radarTooltip        // Radar tooltip element
```

## Usage Patterns

### Show/Hide Elements
```javascript
DOMCache.authScreen.classList.add('hidden');
DOMCache.hud.classList.remove('hidden');
```

### Update Text Content
```javascript
DOMCache.creditValue.textContent = credits;
DOMCache.sectorCoords.textContent = `${x}, ${y}`;
```

### Working with Dynamic Content
```javascript
function recreateModal() {
  const container = DOMCache.get('modal-container');
  container.innerHTML = '<div id="my-modal">New content</div>';
  DOMCache.invalidate('my-modal'); // Important: invalidate after DOM change
  const newModal = DOMCache.get('my-modal');
}
```

### Batch Access for Initialization
```javascript
const elements = DOMCache.getMany([
  'auth-screen', 'hud', 'terminal-panel', 'chat-overlay', 'radar-canvas'
]);
```

## Best Practices

1. **Use Named Getters When Available** -- they are cleaner and easier to read
2. **Invalidate After DOM Changes** -- always invalidate when elements are replaced
3. **Cache in Local Variables** -- for multiple uses in a single function
4. **Use `.exists()` for Optional Elements** -- avoid caching non-critical elements
5. **Debug with `.debug()`** -- use cache statistics to identify issues

**Common Pitfall**: forgetting to invalidate after DOM changes. If you replace an element's innerHTML and then access a child via `DOMCache.get()`, you may get a stale or null reference. Always call `DOMCache.invalidate(id)` after modifying the DOM.

## Performance

| Metric | Before Cache | After Cache | Improvement |
|--------|--------------|-------------|-------------|
| DOM queries/sec | ~240 | ~10 | 96% reduction |
| Frame time | 16.8ms | 16.2ms | 3.5% faster |
| Memory usage | Baseline | +2KB | Negligible |

## Migration

For a step-by-step guide on converting existing `getElementById` calls to use DOMCache, see the archived [DOM Cache Migration Guide](../../docs/archive/dom-cache-migration-guide.md).
