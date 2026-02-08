# Galaxy Miner UI System

A lightweight component-based UI architecture for the Galaxy Miner game client.

For comprehensive documentation including deep implementation details, CSS architecture, and panel creation guides, see [UI System Documentation](../../../docs/systems/ui-system.md).

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

## Module Quick Reference

### UIState (`core/State.js`)

Reactive pub/sub state store for UI data.

```javascript
UIState.get('inventory');                  // Read state
UIState.set('credits', 500);               // Write state (triggers subscriptions)
UIState.set({ inventory: [...], credits: 500 }); // Batch write

const unsub = UIState.subscribe('inventory', (newVal) => { ... });
unsub();  // Unsubscribe

UIState.batch((set) => {                   // Batch updates (single notification)
  set('inventory', [...]);
  set('credits', 500);
});

const getTotal = UIState.derive(['inventory'], (inv) => // Derived/computed values
  inv.reduce((sum, item) => sum + item.quantity * item.baseValue, 0)
);
```

**Default keys:** `inventory`, `credits`, `marketListings`, `myListings`, `selectedItem`, `terminalOpen`, `currentTab`

### Modal (`core/Modal.js`)

Centralized modal controller with stacking support.

```javascript
Modal.init();

// Custom modal
const modal = Modal.open({ title: 'Title', content: '<p>Body</p>', closeOnBackdrop: true });
modal.close();

// Confirmation dialog (returns Promise<boolean>)
const confirmed = await Modal.confirm({ title: 'Delete?', confirmText: 'Delete' });

// Prompt dialog (returns Promise<string|null>)
const name = await Modal.prompt({ title: 'Name?', placeholder: 'Enter name...' });

Modal.isOpen();    // boolean
Modal.count();     // number of stacked modals
Modal.closeAll();  // close all
```

### Component (`core/Component.js`)

Lightweight component factory with lifecycle hooks.

```javascript
const counter = createComponent({
  initialState: { count: 0 },
  render(state, component) {
    const div = document.createElement('div');
    div.innerHTML = `<span>Count: ${state.count}</span><button id="inc">+</button>`;
    component.on(div.querySelector('#inc'), 'click', () => {
      component.update({ count: state.count + 1 });
    });
    return div;
  },
  onMount(el) { },
  onUpdate(prev, next) { },
  onDestroy() { }
});

counter.mount(document.getElementById('container'));
counter.update({ count: 10 });
counter.$('button');   // querySelector within component
counter.$$('button');  // querySelectorAll within component
counter.destroy();
```

**createElement helper (aliased as `h`):**

```javascript
const el = createElement('div', { className: 'card' }, [
  createElement('h2', {}, 'Title'),
  createElement('button', { onClick: handler }, 'Click')
]);
```

### IconFactory (`icons/IconFactory.js`)

Generates parameterized SVG icons for all resource types.

```javascript
IconFactory.createResourceIcon('PLATINUM', 24);  // Returns SVGElement
IconFactory.getDescription('IRON');               // Resource description string
IconFactory.getConfig('DARK_MATTER');              // Full icon config
IconFactory.createAll(24);                         // All icons as { name: SVGElement }
IconFactory.clone(icon);                           // Clone existing icon (faster)
```

**Icon types:** `crystal` (gem/prism/cluster), `orbital` (atom/molecule/cloud), `material` (ingot/cube/hexagon/nugget)

## Panels

### CargoPanel (`panels/CargoPanel.js`)

Two-column cargo display with slide-out detail panel. Lists inventory items with icons; click for detail view with sell button.

```javascript
CargoPanel.init();
CargoPanel.render(container);
CargoPanel.refresh();
CargoPanel.clearSelection();
```

### MarketPanel (`panels/MarketPanel.js`)

Marketplace browser with Browse and My Listings tabs.

```javascript
MarketPanel.init();
MarketPanel.render(container);
MarketPanel.switchTab('browse');  // or 'my-listings'
MarketPanel.refresh();
```

## Network Integration

```javascript
// Network updates UIState on server events
socket.on('inventory:update', (data) => {
  UIState.set({ inventory: data.inventory, credits: data.credits });
});

// Panels subscribe to UIState for reactive re-renders
UIState.subscribe('inventory', () => CargoPanel.refresh());
```

## CSS Files

| File | Purpose |
|------|---------|
| `css/index.css` | Import aggregator |
| `css/base.css` | Reset, CSS variables, utilities |
| `css/components.css` | Buttons, inputs, badges, tabs |
| `css/icons.css` | Icon animations |
| `css/hud.css` | HUD overlay styles |
| `css/panels.css` | Modal and panel containers |

## Migration Notes

The old UI modules (`InventoryUI`, `MarketplaceUI`) are still present for backwards compatibility. The new system (`CargoPanel`, `MarketPanel`) takes precedence when available.
