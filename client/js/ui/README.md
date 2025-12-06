# Galaxy Miner UI System

A lightweight component-based UI architecture for the Galaxy Miner game client.

## Architecture Overview

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

## Core Modules

### 1. State (`core/State.js`)

Reactive pub/sub state store for UI data.

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

**Default UIState keys:**
- `inventory` - Array of `{ resource_type, quantity }`
- `credits` - Player's credit balance
- `marketListings` - Array of market listings
- `myListings` - Player's active sell orders
- `selectedItem` - Currently selected cargo item
- `terminalOpen` - Terminal panel visibility
- `currentTab` - Active terminal tab

### 2. Modal (`core/Modal.js`)

Centralized modal controller with stacking support.

```javascript
// Initialize (call once at startup)
Modal.init();

// Open a custom modal
const modal = Modal.open({
  title: 'My Modal',
  content: '<p>Hello world</p>',  // String or HTMLElement
  className: 'modal-dialog',       // Optional CSS class
  closeOnBackdrop: true,           // Close when clicking outside
  closeOnEsc: true,                // Close on Escape key
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
  inputType: 'text'
});
if (name !== null) { /* use name */ }

// Check modal state
Modal.isOpen();  // boolean
Modal.count();   // number of open modals
Modal.closeAll(); // close all modals
```

### 3. Component (`core/Component.js`)

Lightweight component factory for creating reusable UI elements.

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

// Update state
counter.update({ count: 10 });

// Query within component
counter.$('button');   // querySelector
counter.$$('button');  // querySelectorAll

// Cleanup
counter.destroy();
```

**Helper: createElement (aliased as `h`)**

```javascript
const el = createElement('div', { className: 'card', dataset: { id: '123' } }, [
  createElement('h2', {}, 'Title'),
  createElement('p', {}, 'Content'),
  createElement('button', { onClick: () => alert('clicked') }, 'Click me')
]);
```

### 4. IconFactory (`icons/IconFactory.js`)

Generates parameterized SVG icons for all resource types.

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

**Icon Types:**

| Type | Variant | Resources |
|------|---------|-----------|
| `crystal` | `gem`, `prism`, `cluster` | Ice Crystals, Quantum Crystals, Exotic Matter |
| `orbital` | `atom`, `molecule`, `cloud` | Hydrogen, Carbon, Helium-3, Dark Matter, Antimatter |
| `material` | `ingot`, `cube`, `hexagon`, `nugget` | Iron, Copper, Titanium, Platinum, Silicon |

**Modulation Variables:**
- `hue` (0-360): Base color
- `saturation` (0-100): Color intensity
- `facets` (3-8): Shape complexity (crystals)
- `rings` (1-3): Orbital rings (atoms)
- `electrons` (1-4): Electrons per ring
- `glowIntensity` (0-1): Rarity glow
- `pulseSpeed` (seconds): Animation speed for exotic

## Panels

### CargoPanel (`panels/CargoPanel.js`)

Two-column cargo display with slide-out detail panel.

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

**Features:**
- Lists inventory items with icons, names, quantities
- Click item → slide-out detail panel
- Detail shows: large icon, description, value, rarity badge
- Sell button → quantity/price modal
- Integrates with UIState for reactive updates

### MarketPanel (`panels/MarketPanel.js`)

Marketplace browser with two tabs.

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

**Features:**
- **Browse tab**: Filter by resource, sort by price/quantity/date
- Quick-buy button on each listing
- Click listing → detail modal with buy option
- **My Listings tab**: View/cancel your sell orders
- Integrates with Network for real-time updates

## CSS Architecture

### Files

| File | Purpose |
|------|---------|
| `css/index.css` | Import aggregator - include this one file |
| `css/base.css` | Reset, CSS variables, utilities |
| `css/components.css` | Buttons, inputs, badges, tabs |
| `css/icons.css` | Icon animations |
| `css/hud.css` | HUD overlay styles |
| `css/panels.css` | Modal and panel containers |

### CSS Custom Properties

All theming is done via CSS custom properties in `base.css`:

```css
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
--z-modal: 1000;
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

## Integration with Network

The UI system integrates with `network.js` via UIState:

```javascript
// Network updates UIState on server events
socket.on('inventory:update', (data) => {
  UIState.set({
    inventory: data.inventory,
    credits: data.credits
  });
});

socket.on('market:listings', (data) => {
  UIState.set('marketListings', data.listings);
});

// Panels subscribe to UIState
UIState.subscribe('inventory', () => {
  CargoPanel.refresh();
});
```

## Creating a New Panel

1. Create `panels/MyPanel.js`:

```javascript
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
  },

  refresh() {
    this.render();
  }
};

window.MyPanel = MyPanel;
```

2. Add to `index.html`:
```html
<script src="js/ui/panels/MyPanel.js"></script>
```

3. Initialize in `terminal.js`:
```javascript
if (typeof MyPanel !== 'undefined') {
  MyPanel.init();
}
```

## Migration Notes

The old UI modules (`InventoryUI`, `MarketplaceUI`) are still present for backwards compatibility. The new system (`CargoPanel`, `MarketPanel`) takes precedence when available. Once the new system is verified, the old modules can be removed:

- `inventory.js` → replaced by `CargoPanel.js`
- `marketplace.js` → replaced by `MarketPanel.js`
