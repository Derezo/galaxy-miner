# UI System

Comprehensive guide to Galaxy Miner's component-based UI architecture.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Core Modules](#core-modules)
- [Panel System](#panel-system)
- [State Management](#state-management)
- [Icon System](#icon-system)
- [Modal System](#modal-system)
- [Component Factory](#component-factory)
- [CSS Architecture](#css-architecture)
- [Creating New Panels](#creating-new-panels)

## Overview

Galaxy Miner uses a **lightweight component-based UI architecture** built on vanilla JavaScript with reactive state management. No frameworks required—just clean, modular code.

### Key Features

- **Reactive State Store**: Pub/sub pattern for automatic UI updates
- **Component Factory**: Reusable UI components with lifecycle hooks
- **Modal Controller**: Centralized modal management with stacking
- **Icon System**: Parameterized SVG icons for 26 resource types
- **Panel System**: Modular panels for Terminal UI (Cargo, Market, Upgrades, etc.)
- **CSS Custom Properties**: Themeable design system

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        UIState                               │
│  (Reactive state store - inventory, credits, listings)       │
└────────────────┬─────────────────────┬──────────────────────┘
                 │                     │
                 ▼                     ▼
┌────────────────────────┐  ┌────────────────────────┐
│      CargoPanel        │  │     MarketPanel        │
│  (Cargo tab content)   │  │  (Market tab content)  │
└────────────────────────┘  └────────────────────────┘
                 │                     │
                 ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                        Modal                                 │
│  (Centralized modal controller - sell, buy, confirm dialogs) │
└─────────────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                      IconFactory                             │
│  (Parameterized SVG icons for all resource types)            │
└─────────────────────────────────────────────────────────────┘
```

## Architecture

### File Structure

```
client/js/ui/
├── core/
│   ├── State.js              # Reactive state store
│   ├── Modal.js              # Modal controller
│   ├── Component.js          # Component factory
│   ├── Toast.js              # Toast notifications
│   ├── MessageStack.js       # Message notifications (new)
│   └── NotificationManager.js # Unified notifications
│
├── panels/
│   ├── BasePanel.js          # Base panel class
│   ├── CargoPanel.js         # Cargo/inventory panel
│   ├── MarketPanel.js        # Marketplace panel
│   ├── ShipUpgradePanel.js   # Ship upgrades panel
│   ├── ShipCustomizationPanel.js # Ship customization
│   ├── RelicsPanel.js        # Relics collection panel
│   └── SettingsPanel.js      # Settings panel
│
├── icons/
│   ├── IconFactory.js        # Icon generator
│   ├── IconCache.js          # SVG caching
│   └── shapes/
│       ├── CrystalShape.js   # Crystal geometry
│       ├── OrbitalShape.js   # Atom/molecule geometry
│       ├── MaterialShape.js  # Metal/ingot geometry
│       ├── RelicShape.js     # Relic glyph shapes
│       └── WormholeGemShape.js
│
├── radar/
│   ├── index.js              # Main radar module
│   ├── base-renderer.js      # Core rendering
│   ├── entities.js           # Players/NPCs
│   ├── objects.js            # Stars/planets/asteroids
│   ├── combat.js             # Weapon fire
│   ├── loot.js               # Wreckage
│   ├── tooltips.js           # Hover info
│   └── advanced.js           # Tier 4+ features
│
├── ship-preview/
│   └── ShipPreviewCanvas.js  # Live ship preview
│
├── hud.js                    # HUD overlay
├── chat.js                   # Chat system
├── terminal.js               # Terminal window controller
├── upgrades.js               # Upgrade UI (legacy)
├── inventory.js              # Inventory UI (legacy)
├── marketplace.js            # Marketplace UI (legacy)
├── auth.js                   # Authentication UI
├── emote-wheel.js            # Emote radial menu
├── credit-animation.js       # Credit gain animations
├── profile-modal.js          # Profile customization
└── WormholeTransitUI.js      # Wormhole travel interface
```

## Core Modules

### 1. UIState (`core/State.js`)

Reactive pub/sub state store for UI data synchronization.

#### API

```javascript
// Get state
const inventory = UIState.get('inventory');
const allState = UIState.get();

// Set state (triggers subscriptions)
UIState.set('credits', 500);
UIState.set({ inventory: [...], credits: 500 });

// Subscribe to changes
const unsubscribe = UIState.subscribe('inventory', (newValue, key, fullState) => {
  console.log('Inventory changed:', newValue);
});

// Unsubscribe when done
unsubscribe();

// Batch updates (single notification)
UIState.batch((set) => {
  set('inventory', [...]);
  set('credits', 500);
});

// Derived/computed values
const getTotalValue = UIState.derive(['inventory'], (inventory) => {
  return inventory.reduce((sum, item) => sum + item.quantity * item.baseValue, 0);
});
console.log(getTotalValue()); // Cached until inventory changes
```

#### Default State Keys

| Key | Type | Description |
|-----|------|-------------|
| `inventory` | Array | Player's cargo items `{ resource_type, quantity }` |
| `credits` | Number | Player's credit balance |
| `ship` | Object | Ship stats and tiers |
| `relics` | Array | Collected relics |
| `marketListings` | Array | All marketplace listings |
| `myListings` | Array | Player's active sell orders |
| `selectedItem` | Object | Currently selected cargo item |
| `selectedListing` | Object | Currently selected market listing |
| `selectedRelic` | Object | Currently selected relic |
| `detailPanelOpen` | Boolean | Cargo detail panel visibility |
| `terminalOpen` | Boolean | Terminal panel visibility |
| `currentTab` | String | Active terminal tab |
| `messages` | Array | Notification messages |

#### Integration with Network

```javascript
// /client/js/network.js - Update UIState on server events
socket.on('inventory:update', (data) => {
  UIState.set({
    inventory: data.inventory,
    credits: data.credits
  });
});

socket.on('market:listings', (data) => {
  UIState.set('marketListings', data.listings);
});
```

### 2. Modal (`core/Modal.js`)

Centralized modal controller with stacking support and helper methods.

#### API

```javascript
// Initialize (call once at startup)
Modal.init();

// Open a custom modal
const modal = Modal.open({
  title: 'My Modal',
  content: '<p>Hello world</p>',  // String or HTMLElement
  className: 'modal-dialog',       // Optional CSS class
  closeOnBackdrop: true,           // Close when clicking outside (default: true)
  closeOnEsc: true,                // Close on Escape key (default: true)
  onClose: () => console.log('closed')
});

// Close programmatically
modal.close();

// Confirmation dialog (returns Promise)
const confirmed = await Modal.confirm({
  title: 'Delete Item',
  message: 'Are you sure you want to delete this?',
  confirmText: 'Delete',
  cancelText: 'Cancel',
  confirmClass: 'btn-danger'
});
if (confirmed) { /* do delete */ }

// Prompt dialog (returns Promise with input value)
const name = await Modal.prompt({
  title: 'Enter Name',
  message: 'What should we call this?',
  placeholder: 'Name...',
  defaultValue: '',
  inputType: 'text'  // or 'number', 'password', etc.
});
if (name !== null) { /* use name */ }

// Check modal state
Modal.isOpen();    // boolean
Modal.count();     // number of open modals
Modal.closeAll();  // close all modals
```

#### Example: Sell Confirmation

```javascript
// /client/js/ui/panels/CargoPanel.js
async function handleSellItem(resourceType, maxQuantity) {
  const quantity = await Modal.prompt({
    title: 'Sell ' + resourceType,
    message: `How many units? (Max: ${maxQuantity})`,
    inputType: 'number',
    defaultValue: '1'
  });

  if (quantity === null) return; // Cancelled

  const price = await Modal.prompt({
    title: 'Set Price',
    message: 'Price per unit (credits):',
    inputType: 'number',
    defaultValue: '10'
  });

  if (price === null) return;

  // Emit to server
  socket.emit('market:list', {
    resourceType,
    quantity: parseInt(quantity),
    pricePerUnit: parseInt(price)
  });
}
```

### 3. Component (`core/Component.js`)

Lightweight component factory for creating reusable UI elements with lifecycle hooks.

#### API

```javascript
// Create a component
const counter = createComponent({
  initialState: { count: 0 },

  render(state, component) {
    const div = document.createElement('div');
    div.innerHTML = `
      <span>Count: ${state.count}</span>
      <button id="inc">+</button>
    `;

    // Bind events (auto-cleanup on destroy)
    const btn = div.querySelector('#inc');
    component.on(btn, 'click', () => {
      component.update({ count: state.count + 1 });
    });

    return div;
  },

  onMount(el) {
    console.log('Component mounted');
  },

  onUpdate(prevState, newState) {
    console.log('State changed:', prevState, '->', newState);
  },

  onDestroy() {
    console.log('Component destroyed');
  }
});

// Mount to DOM
counter.mount(document.getElementById('container'));

// Update state (triggers re-render)
counter.update({ count: 10 });

// Query within component
counter.$('button');   // querySelector
counter.$$('button');  // querySelectorAll

// Cleanup
counter.destroy();
```

#### Helper: createElement

```javascript
const el = createElement('div', { className: 'card', dataset: { id: '123' } }, [
  createElement('h2', {}, 'Title'),
  createElement('p', {}, 'Content'),
  createElement('button', { onClick: () => alert('clicked') }, 'Click me')
]);
```

### 4. IconFactory (`icons/IconFactory.js`)

Generates parameterized SVG icons for all 26 resource types.

#### API

```javascript
// Create an icon (returns SVGElement)
const icon = IconFactory.createResourceIcon('PLATINUM', 24);
document.getElementById('container').appendChild(icon);

// Large icon for detail views
const largeIcon = IconFactory.createResourceIcon('QUANTUM_CRYSTALS', 64);

// Get resource description
const desc = IconFactory.getDescription('IRON');
// "Common structural metal, essential for basic ship repairs..."

// Get full config
const config = IconFactory.getConfig('DARK_MATTER');
// { iconType: 'orbital', variant: 'cloud', hue: 270, ... }

// Preload all icons
const allIcons = IconFactory.createAll(24);
// { IRON: SVGElement, PLATINUM: SVGElement, ... }

// Clone an icon (faster than recreating)
const iconClone = IconFactory.clone(icon);
```

#### Icon Types

| Type | Variant | Resources |
|------|---------|-----------|
| `crystal` | `gem`, `prism`, `cluster` | Ice Crystals, Quantum Crystals, Exotic Matter, Void Crystals |
| `orbital` | `atom`, `molecule`, `cloud` | Hydrogen, Carbon, Helium-3, Dark Matter, Antimatter, Phosphorus, Nitrogen, Neon, Xenon |
| `material` | `ingot`, `cube`, `hexagon`, `nugget` | Iron, Copper, Titanium, Platinum, Silicon, Nickel, Silver, Cobalt, Lithium, Gold, Uranium, Iridium, Neutronium, Sulfur |

#### Modulation Variables

```javascript
{
  hue: 0-360,             // Base color
  saturation: 0-100,      // Color intensity
  facets: 3-8,            // Shape complexity (crystals)
  rings: 1-3,             // Orbital rings (atoms)
  electrons: 1-4,         // Electrons per ring
  glowIntensity: 0-1,     // Rarity glow
  pulseSpeed: 1-3         // Animation speed (seconds)
}
```

## Panel System

### BasePanel (`panels/BasePanel.js`)

Abstract base class for all Terminal panels.

```javascript
class BasePanel {
  constructor() {
    this.container = null;
    this.unsubscribers = [];
  }

  // Override in subclass
  render(container) {
    throw new Error('render() must be implemented');
  }

  // Subscribe to UIState with auto-cleanup
  subscribe(key, callback) {
    const unsub = UIState.subscribe(key, callback);
    this.unsubscribers.push(unsub);
  }

  // Cleanup subscriptions
  destroy() {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
  }
}
```

### CargoPanel (`panels/CargoPanel.js`)

Two-column cargo display with slide-out detail panel.

#### Features

- Lists inventory items with icons, names, quantities
- Click item → slide-out detail panel
- Detail shows: large icon, description, value, rarity badge
- Sell button → quantity/price modal
- Integrates with UIState for reactive updates

#### API

```javascript
// Initialize (called by TerminalUI)
CargoPanel.init();

// Render into container
CargoPanel.render(document.getElementById('cargo-content'));

// Refresh (re-render with current state)
CargoPanel.refresh();

// Clear selection
CargoPanel.clearSelection();
```

### MarketPanel (`panels/MarketPanel.js`)

Marketplace browser with two tabs: Browse and My Listings.

#### Features

- **Browse tab**: Filter by resource, sort by price/quantity/date
- Quick-buy button on each listing
- Click listing → detail modal with buy option
- **My Listings tab**: View/cancel your sell orders
- Integrates with Network for real-time updates

#### API

```javascript
// Initialize
MarketPanel.init();

// Render
MarketPanel.render(document.getElementById('market-content'));

// Switch tabs programmatically
MarketPanel.switchTab('browse');      // or 'my-listings'

// Refresh (requests fresh data from server)
MarketPanel.refresh();
```

### ShipUpgradePanel (`panels/ShipUpgradePanel.js`)

Ship component upgrade interface.

#### Features

- Lists all 8 components with current tiers
- Shows upgrade costs (credits + resources)
- Validates requirements before upgrade
- Displays upgrade effects (damage, speed, capacity, etc.)
- Animated progress bars for tiers

#### API

```javascript
ShipUpgradePanel.init();
ShipUpgradePanel.render(container);
ShipUpgradePanel.refresh();
```

### ShipCustomizationPanel (`panels/ShipCustomizationPanel.js`)

Ship color and profile customization.

#### Features

- Live ship preview canvas
- Color palette selection (9 colors)
- Profile avatar selection (8 profiles)
- Instant preview on hover
- Save confirmation

#### API

```javascript
ShipCustomizationPanel.init();
ShipCustomizationPanel.render(container);
```

### RelicsPanel (`panels/RelicsPanel.js`)

Relics collection viewer.

#### Features

- Grid layout with large relic icons
- Rarity badges and glow effects
- Detail panel on click (lore, value)
- Progress indicator (X/5 relics)

#### API

```javascript
RelicsPanel.init();
RelicsPanel.render(container);
```

## State Management

### Reactive Updates

UIState automatically updates panels when data changes:

```javascript
// Network receives update
socket.on('inventory:update', (data) => {
  UIState.set({ inventory: data.inventory, credits: data.credits });
  // CargoPanel automatically re-renders due to subscription
});

// CargoPanel subscribes in init()
CargoPanel.init = function() {
  UIState.subscribe('inventory', () => this.refresh());
  UIState.subscribe('credits', () => this.refresh());
};
```

### Batch Updates

Avoid multiple re-renders with batch updates:

```javascript
UIState.batch((set) => {
  set('inventory', newInventory);
  set('credits', newCredits);
  set('selectedItem', null);
});
// Only triggers ONE notification to subscribers
```

## Icon System

### SVG Generation

Icons are procedurally generated with modulation:

```javascript
// /client/js/ui/icons/IconFactory.js
createResourceIcon(resourceType, size) {
  const config = this.getConfig(resourceType);
  const { iconType, variant, hue, saturation, ... } = config;

  if (iconType === 'crystal') {
    return CrystalShape.generate(size, variant, hue, saturation, ...);
  } else if (iconType === 'orbital') {
    return OrbitalShape.generate(size, variant, hue, saturation, ...);
  } else if (iconType === 'material') {
    return MaterialShape.generate(size, variant, hue, saturation, ...);
  }
}
```

### Caching

Icons are cached for performance:

```javascript
// /client/js/ui/icons/IconCache.js
const cache = new Map();

function getCachedIcon(resourceType, size) {
  const key = `${resourceType}-${size}`;
  if (cache.has(key)) {
    return cache.get(key).cloneNode(true); // Return clone
  }

  const icon = IconFactory.createResourceIcon(resourceType, size);
  cache.set(key, icon);
  return icon.cloneNode(true);
}
```

## Modal System

### Modal Stack

Multiple modals can be open simultaneously:

```javascript
const modal1 = Modal.open({ title: 'First Modal', ... });
const modal2 = Modal.open({ title: 'Second Modal', ... }); // Stacks on top

Modal.count(); // 2
Modal.closeAll(); // Close all
```

### Backdrop Clicks

```javascript
Modal.open({
  title: 'Modal',
  content: '...',
  closeOnBackdrop: false  // Prevent accidental closes
});
```

## CSS Architecture

### Files

| File | Purpose |
|------|---------|
| `css/index.css` | Import aggregator |
| `css/base.css` | Reset, CSS variables, utilities |
| `css/components.css` | Buttons, inputs, badges, tabs |
| `css/icons.css` | Icon animations |
| `css/hud.css` | HUD overlay styles |
| `css/panels.css` | Modal and panel containers |

### CSS Custom Properties

```css
/* /client/css/base.css */
:root {
  /* Colors */
  --color-primary: #4466ff;
  --color-success: #66ff88;
  --color-warning: #ffcc44;
  --color-danger: #ff6666;
  --color-text: #e0e0ff;
  --color-bg-dark: rgba(10, 10, 40, 0.85);

  /* Spacing */
  --spacing-sm: 8px;
  --spacing-md: 12px;
  --spacing-lg: 16px;

  /* Border radius */
  --radius-sm: 6px;
  --radius-md: 8px;

  /* Animation durations */
  --animation-fast: 0.2s;
  --animation-normal: 0.3s;

  /* Shadows */
  --shadow-md: 0 4px 15px rgba(0, 0, 0, 0.5);
  --shadow-glow-primary: 0 0 15px rgba(68, 102, 255, 0.5);

  /* Z-index layers */
  --z-hud: 100;
  --z-terminal: 500;
  --z-modal: 1000;
}
```

### Component Classes

```css
/* Buttons */
.btn                 /* Base button */
.btn-primary         /* Blue primary action */
.btn-success         /* Green confirm */
.btn-danger          /* Red destructive */
.btn-sm, .btn-lg     /* Size variants */

/* Inputs */
.input               /* Text input */
.select              /* Dropdown select */
.input-number-group  /* Number with +/- buttons */

/* Badges */
.badge               /* Base badge */
.badge-common        /* Rarity: common */
.badge-uncommon      /* Rarity: uncommon */
.badge-rare          /* Rarity: rare */
.badge-ultrarare     /* Rarity: ultra-rare */

/* Layout */
.panel-two-column    /* Two-column panel layout */
.panel-main          /* Left column */
.panel-detail        /* Right slide-out panel */
.cargo-list          /* Vertical cargo item list */
.market-list         /* Market listing list */
```

## Creating New Panels

### Step 1: Create Panel Class

```javascript
// /client/js/ui/panels/MyPanel.js
const MyPanel = {
  init() {
    // Subscribe to relevant state
    UIState.subscribe('myData', () => this.render());
  },

  render(container = null) {
    const target = container || document.getElementById('my-content');
    const data = UIState.get('myData') || [];

    target.innerHTML = `
      <div class="my-panel">
        ${data.map(item => this._renderItem(item)).join('')}
      </div>
    `;

    this._bindEvents(target);
  },

  _renderItem(item) {
    return `<div class="list-item">${item.name}</div>`;
  },

  _bindEvents(container) {
    // Add click handlers, etc.
    container.querySelectorAll('.list-item').forEach(el => {
      el.addEventListener('click', () => {
        console.log('Clicked:', el.textContent);
      });
    });
  },

  refresh() {
    this.render();
  }
};

window.MyPanel = MyPanel;
```

### Step 2: Add to HTML

```html
<!-- /client/index.html -->
<script src="js/ui/panels/MyPanel.js"></script>
```

### Step 3: Initialize in Terminal

```javascript
// /client/js/ui/terminal.js
if (typeof MyPanel !== 'undefined') {
  MyPanel.init();
}
```

### Step 4: Add Tab to Terminal

```html
<!-- In Terminal UI -->
<button class="terminal-tab" data-tab="my-panel">My Panel</button>

<div id="my-panel-content" class="terminal-content">
  <!-- MyPanel renders here -->
</div>
```

## Related Files

- `/client/js/ui/core/State.js` - Reactive state store
- `/client/js/ui/core/Modal.js` - Modal controller
- `/client/js/ui/core/Component.js` - Component factory
- `/client/js/ui/icons/IconFactory.js` - Icon generator
- `/client/js/ui/panels/*.js` - Panel implementations
- `/client/js/ui/README.md` - Detailed UI API reference
- `/client/css/*.css` - Stylesheets

## See Also

- [UI README](../../client/js/ui/README.md) - Complete UI API documentation
- [Socket Events](../api/socket-events.md) - Network integration
- [Resources System](resources.md) - Resource icons
- [Ship Upgrades](ship-upgrades.md) - Upgrade panel
