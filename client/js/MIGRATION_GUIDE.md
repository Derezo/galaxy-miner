# DOMCache Migration Guide for Galaxy Miner

## Quick Reference

Replace direct `getElementById` calls with DOMCache for better performance, especially in frequently-called functions.

### Quick Find & Replace Patterns

```javascript
// Pattern 1: Simple assignment
document.getElementById('element-id')
→ DOMCache.get('element-id')

// Pattern 2: Common elements (use named getters)
document.getElementById('hud')
→ DOMCache.hud

document.getElementById('terminal-panel')
→ DOMCache.terminalPanel

document.getElementById('auth-screen')
→ DOMCache.authScreen
```

## Priority Files to Migrate

### High Priority (60 FPS render loops)
These files are called every frame and will benefit most from caching:

1. **`/client/js/ui/hud.js`**
   - Update credit display
   - Update sector coordinates
   - Radar rendering

2. **`/client/js/player.js`**
   - Mining hint updates (lines 299, 654, 821)
   - Frequent DOM access in game loop callbacks

3. **`/client/js/ui/credit-animation.js`**
   - Lines 26-27: Credit display updates
   - Called frequently during credit animations

### Medium Priority (Event handlers & UI updates)

4. **`/client/js/ui/auth.js`**
   - Lines 6-90: Login/register form handlers
   - Form visibility toggles

5. **`/client/js/ui/terminal.js`**
   - Lines 8-136: Panel management
   - Tab switching logic

6. **`/client/js/ui/chat.js`**
   - Lines 12-319: Chat UI updates
   - Message rendering

7. **`/client/js/main.js`**
   - Lines 49-62: Screen visibility toggles

8. **`/client/js/ui/inventory.js`**
   - Lines 12-16: Cargo display updates

### Low Priority (One-time initialization)

9. **`/client/js/ui/upgrades.js`**
   - Line 10: Upgrades list access

10. **`/client/js/ui/marketplace.js`**
    - Lines 31, 88-91: Market UI updates

## Example Migrations

### Example 1: HUD.js (High Priority)

**File**: `/client/js/ui/hud.js`

**Before** (lines 12-13):
```javascript
init() {
  this.radarCanvas = document.getElementById('radar-canvas');
  this.radarCtx = this.radarCanvas.getContext('2d');
  // ...
}
```

**After**:
```javascript
init() {
  this.radarCanvas = DOMCache.radarCanvas;
  this.radarCtx = this.radarCanvas.getContext('2d');
  // ...
}
```

**Before** (lines 43-44):
```javascript
initTerminalIcon() {
  const terminalIcon = document.getElementById('terminal-icon');
  const radialMenu = document.getElementById('terminal-radial-menu');
  // ...
}
```

**After**:
```javascript
initTerminalIcon() {
  const terminalIcon = DOMCache.terminalIcon;
  const radialMenu = DOMCache.terminalRadialMenu;
  // ...
}
```

**Before** (lines 196, 202, 211, 227):
```javascript
updatePlayerInfo(playerData) {
  const usernameEl = document.getElementById('profile-username');
  // ...
  const creditValue = document.getElementById('credit-value');
  // ...
  const sectorEl = document.getElementById('sector-coords');
  // ...
  const terminalIcon = document.getElementById('terminal-icon');
  // ...
}
```

**After**:
```javascript
updatePlayerInfo(playerData) {
  const usernameEl = DOMCache.profileUsername;
  // ...
  const creditValue = DOMCache.creditValue;
  // ...
  const sectorEl = DOMCache.sectorCoords;
  // ...
  const terminalIcon = DOMCache.terminalIcon;
  // ...
}
```

### Example 2: player.js (High Priority)

**File**: `/client/js/player.js`

**Before** (line 299):
```javascript
updateMiningHint() {
  const hint = document.getElementById('mining-hint');
  // ...
}
```

**After**:
```javascript
updateMiningHint() {
  const hint = DOMCache.miningHint;
  // ...
}
```

**Before** (line 654):
```javascript
updateLootHint() {
  const hint = document.getElementById('loot-hint');
  // ...
}
```

**After**:
```javascript
updateLootHint() {
  const hint = DOMCache.lootHint;
  // ...
}
```

**Before** (line 821):
```javascript
updateWormholeHint() {
  const hint = document.getElementById('wormhole-hint');
  // ...
}
```

**After**:
```javascript
updateWormholeHint() {
  const hint = DOMCache.wormholeHint;
  // ...
}
```

### Example 3: auth.js (Medium Priority)

**File**: `/client/js/ui/auth.js`

**Before** (lines 6-11):
```javascript
init() {
  document.getElementById('show-register').addEventListener('click', (e) => {
    // ...
  });

  document.getElementById('show-login').addEventListener('click', (e) => {
    // ...
  });
}
```

**After**:
```javascript
init() {
  DOMCache.showRegister.addEventListener('click', (e) => {
    // ...
  });

  DOMCache.showLogin.addEventListener('click', (e) => {
    // ...
  });
}
```

**Before** (lines 38-39, 44-45):
```javascript
showLogin() {
  document.getElementById('login-form').classList.add('active');
  document.getElementById('register-form').classList.remove('active');
}

showRegister() {
  document.getElementById('login-form').classList.remove('active');
  document.getElementById('register-form').classList.add('active');
}
```

**After**:
```javascript
showLogin() {
  DOMCache.loginForm.classList.add('active');
  DOMCache.registerForm.classList.remove('active');
}

showRegister() {
  DOMCache.loginForm.classList.remove('active');
  DOMCache.registerForm.classList.add('active');
}
```

**Before** (lines 50-51, 62-64):
```javascript
login() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  // ...
}

register() {
  const username = document.getElementById('register-username').value.trim();
  const password = document.getElementById('register-password').value;
  const confirm = document.getElementById('register-confirm').value;
  // ...
}
```

**After**:
```javascript
login() {
  const username = DOMCache.loginUsername.value.trim();
  const password = DOMCache.loginPassword.value;
  // ...
}

register() {
  const username = DOMCache.registerUsername.value.trim();
  const password = DOMCache.registerPassword.value;
  const confirm = DOMCache.registerConfirm.value;
  // ...
}
```

### Example 4: main.js (Medium Priority)

**File**: `/client/js/main.js`

**Before** (lines 49-50):
```javascript
startGame(playerData) {
  // ...
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  // ...
}
```

**After**:
```javascript
startGame(playerData) {
  // ...
  DOMCache.authScreen.classList.add('hidden');
  DOMCache.hud.classList.remove('hidden');
  // ...
}
```

**Before** (lines 61-62):
```javascript
stopGame() {
  // ...
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('hud').classList.add('hidden');
}
```

**After**:
```javascript
stopGame() {
  // ...
  DOMCache.authScreen.classList.remove('hidden');
  DOMCache.hud.classList.add('hidden');
}
```

### Example 5: terminal.js (Medium Priority)

**File**: `/client/js/ui/terminal.js`

**Before** (lines 8, 39, 68, 88):
```javascript
init() {
  const panel = document.getElementById('terminal-panel');
  // ...
  const upgradesContainer = document.getElementById('upgrades-content');
  // ...
}

show() {
  // ...
  document.getElementById('terminal-panel').classList.remove('hidden');
  // ...
}

hide() {
  // ...
  document.getElementById('terminal-panel').classList.add('hidden');
  // ...
}
```

**After**:
```javascript
init() {
  const panel = DOMCache.terminalPanel;
  // ...
  const upgradesContainer = DOMCache.upgradesContent;
  // ...
}

show() {
  // ...
  DOMCache.terminalPanel.classList.remove('hidden');
  // ...
}

hide() {
  // ...
  DOMCache.terminalPanel.classList.add('hidden');
  // ...
}
```

**Before** (lines 121-136):
```javascript
switchTab(tabName) {
  // ...
  document.getElementById('cargo-content').classList.add('active');
  // ...
  document.getElementById('upgrades-content').classList.add('active');
  // ...
  document.getElementById('market-content').classList.add('active');
  // ...
  document.getElementById('customize-content').classList.add('active');
  // ...
  document.getElementById('relics-content').classList.add('active');
  // ...
  document.getElementById('settings-content').classList.add('active');
  // ...
}
```

**After**:
```javascript
switchTab(tabName) {
  // ...
  DOMCache.cargoContent.classList.add('active');
  // ...
  DOMCache.upgradesContent.classList.add('active');
  // ...
  DOMCache.marketContent.classList.add('active');
  // ...
  DOMCache.customizeContent.classList.add('active');
  // ...
  DOMCache.relicsContent.classList.add('active');
  // ...
  DOMCache.settingsContent.classList.add('active');
  // ...
}
```

## Special Cases

### Case 1: Dynamic Modal IDs
Don't cache dynamically generated modal IDs. Use direct `getElementById` or invalidate cache:

```javascript
// Dynamic modal creation - don't use cache
function showModal(modalId) {
  // Create modal dynamically
  createModal(modalId);

  // Option 1: Use getElementById directly (recommended for dynamic content)
  const modal = document.getElementById(modalId);

  // Option 2: Use cache with invalidation
  DOMCache.invalidate(modalId);
  const modal = DOMCache.get(modalId);
}
```

### Case 2: querySelector/querySelectorAll
These are not covered by DOMCache. Continue using them for:
- Class-based selectors
- Complex selectors
- NodeLists

```javascript
// These should NOT use DOMCache
const tabs = document.querySelectorAll('.terminal-tab');
const activeContent = document.querySelector('.terminal-content.active');
```

### Case 3: Canvas Context Caching
Cache both canvas and context in module initialization:

```javascript
const Renderer = {
  canvas: null,
  ctx: null,

  init() {
    this.canvas = DOMCache.gameCanvas; // Cache canvas
    this.ctx = this.canvas.getContext('2d'); // Cache context
  },

  render() {
    // Use cached references - no DOM queries!
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
};
```

## Testing Migration

After migrating a file, test these scenarios:

1. **Functionality**: Ensure all features work as before
2. **Console Errors**: Check for null reference errors
3. **Performance**: Use browser DevTools Performance tab
4. **Cache Stats**: Run `DOMCache.debug()` in console

```javascript
// In browser console after loading page
DOMCache.debug();
// Should show cached elements and stats
```

## Performance Testing

To verify performance improvements:

```javascript
// Before migration
console.time('updateUI');
for (let i = 0; i < 1000; i++) {
  document.getElementById('credit-value').textContent = i;
}
console.timeEnd('updateUI');

// After migration
console.time('updateUI');
for (let i = 0; i < 1000; i++) {
  DOMCache.creditValue.textContent = i;
}
console.timeEnd('updateUI');
```

## Rollback Plan

If issues occur after migration:

1. **Revert file**: Use git to revert specific file
2. **Check cache**: Run `DOMCache.debug()` to identify issues
3. **Invalidate**: Try `DOMCache.invalidateAll()` if stale references
4. **Test file**: Open `/client/test-dom-cache.html` to verify cache works

## Automated Migration Script

For bulk migration, use this regex find/replace pattern (use with caution):

```regex
Find:    document\.getElementById\('([^']+)'\)
Replace: DOMCache.get('$1')
```

Then manually replace with named getters where appropriate:
- `DOMCache.get('hud')` → `DOMCache.hud`
- `DOMCache.get('auth-screen')` → `DOMCache.authScreen`
- etc.

## Common Named Getter Mappings

```javascript
// Auth
'auth-screen' → DOMCache.authScreen
'login-form' → DOMCache.loginForm
'register-form' → DOMCache.registerForm
'login-username' → DOMCache.loginUsername
'login-password' → DOMCache.loginPassword
'login-btn' → DOMCache.loginBtn
'auth-error' → DOMCache.authError

// HUD
'hud' → DOMCache.hud
'radar-canvas' → DOMCache.radarCanvas
'terminal-icon' → DOMCache.terminalIcon
'terminal-radial-menu' → DOMCache.terminalRadialMenu
'profile-username' → DOMCache.profileUsername
'credit-value' → DOMCache.creditValue
'sector-coords' → DOMCache.sectorCoords

// Terminal
'terminal-panel' → DOMCache.terminalPanel
'cargo-content' → DOMCache.cargoContent
'upgrades-content' → DOMCache.upgradesContent
'market-content' → DOMCache.marketContent

// Chat
'chat-overlay' → DOMCache.chatOverlay
'chat-icon' → DOMCache.chatIcon
'chat-messages' → DOMCache.chatMessages
'chat-input' → DOMCache.chatInput

// Canvas
'gameCanvas' → DOMCache.gameCanvas
```

## Questions?

Refer to:
- `/client/js/DOM_CACHE_README.md` - Full API documentation
- `/client/js/dom-cache-examples.js` - Code examples
- `/client/test-dom-cache.html` - Interactive tests
