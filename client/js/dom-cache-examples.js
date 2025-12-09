// DOM Cache Usage Examples for Galaxy Miner
// This file demonstrates practical usage patterns for the DOMCache module

// =============================================================================
// EXAMPLE 1: Basic Element Access
// =============================================================================

// Before: Direct getElementById
function showAuthScreen_OLD() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('hud').classList.add('hidden');
}

// After: Using DOMCache
function showAuthScreen_NEW() {
  DOMCache.authScreen.classList.remove('hidden');
  DOMCache.hud.classList.add('hidden');
}

// =============================================================================
// EXAMPLE 2: Repeated Access in Render Loop (High Performance Impact)
// =============================================================================

// Before: Multiple DOM queries per frame (60 FPS = 360 queries/sec!)
function updateHUD_OLD() {
  const creditEl = document.getElementById('credit-value');
  creditEl.textContent = Player.credits;

  const sectorEl = document.getElementById('sector-coords');
  sectorEl.textContent = `${Player.sector.x}, ${Player.sector.y}`;

  const cargoUsed = document.getElementById('cargo-used');
  const cargoMax = document.getElementById('cargo-max');
  cargoUsed.textContent = Player.cargoUsed;
  cargoMax.textContent = Player.cargoMax;
}

// After: Cached access (First frame = 4 queries, subsequent = 0!)
function updateHUD_NEW() {
  DOMCache.creditValue.textContent = Player.credits;
  DOMCache.sectorCoords.textContent = `${Player.sector.x}, ${Player.sector.y}`;
  DOMCache.cargoUsed.textContent = Player.cargoUsed;
  DOMCache.cargoMax.textContent = Player.cargoMax;
}

// =============================================================================
// EXAMPLE 3: Event Listener Setup
// =============================================================================

// Before
function initAuthUI_OLD() {
  document.getElementById('login-btn').addEventListener('click', () => {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    Network.login(username, password);
  });

  document.getElementById('register-btn').addEventListener('click', () => {
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm').value;
    Network.register(username, password, confirm);
  });
}

// After
function initAuthUI_NEW() {
  DOMCache.loginBtn.addEventListener('click', () => {
    const username = DOMCache.loginUsername.value;
    const password = DOMCache.loginPassword.value;
    Network.login(username, password);
  });

  DOMCache.registerBtn.addEventListener('click', () => {
    const username = DOMCache.registerUsername.value;
    const password = DOMCache.registerPassword.value;
    const confirm = DOMCache.registerConfirm.value;
    Network.register(username, password, confirm);
  });
}

// =============================================================================
// EXAMPLE 4: Batch Access for Initialization
// =============================================================================

// Before: Multiple separate queries
function initTerminalUI_OLD() {
  const cargoContent = document.getElementById('cargo-content');
  const upgradesContent = document.getElementById('upgrades-content');
  const marketContent = document.getElementById('market-content');
  const customizeContent = document.getElementById('customize-content');
  const relicsContent = document.getElementById('relics-content');
  const settingsContent = document.getElementById('settings-content');

  // ... initialize each panel
}

// After: Batch access
function initTerminalUI_NEW() {
  const panels = DOMCache.getMany([
    'cargo-content',
    'upgrades-content',
    'market-content',
    'customize-content',
    'relics-content',
    'settings-content'
  ]);

  // Access via object
  // panels['cargo-content']
  // panels['upgrades-content']
  // etc.
}

// Even better: Use named getters
function initTerminalUI_BETTER() {
  const cargoContent = DOMCache.cargoContent;
  const upgradesContent = DOMCache.upgradesContent;
  const marketContent = DOMCache.marketContent;
  const customizeContent = DOMCache.customizeContent;
  const relicsContent = DOMCache.relicsContent;
  const settingsContent = DOMCache.settingsContent;

  // ... initialize each panel
}

// =============================================================================
// EXAMPLE 5: Working with Dynamic Content (Important!)
// =============================================================================

// Modal that gets dynamically created
function showDynamicModal_BAD() {
  const container = document.getElementById('ui-container');

  // Create modal
  const modalHTML = '<div id="custom-modal">Modal Content</div>';
  container.insertAdjacentHTML('beforeend', modalHTML);

  // BAD: This might return null because the cache doesn't know about the new element
  const modal = DOMCache.get('custom-modal'); // Could be null!
  modal.style.display = 'block'; // ERROR if null!
}

function showDynamicModal_GOOD() {
  const container = DOMCache.get('ui-container');

  // Create modal
  const modalHTML = '<div id="custom-modal">Modal Content</div>';
  container.insertAdjacentHTML('beforeend', modalHTML);

  // GOOD: Either refresh or use getElementById directly for new elements
  const modal = document.getElementById('custom-modal');
  // OR
  const modal2 = DOMCache.refresh('custom-modal');

  modal.style.display = 'block';
}

// When replacing innerHTML content
function updatePanel_BAD() {
  const panel = DOMCache.get('cargo-content');
  panel.innerHTML = '<div id="cargo-item-1">Item</div>';

  // BAD: Old reference might be cached
  const item = DOMCache.get('cargo-item-1'); // Might be stale!
}

function updatePanel_GOOD() {
  const panel = DOMCache.cargoContent;
  panel.innerHTML = '<div id="cargo-item-1">Item</div>';

  // GOOD: Invalidate and fetch fresh
  DOMCache.invalidate('cargo-item-1');
  const item = DOMCache.get('cargo-item-1');

  // OR use refresh (combines invalidate + get)
  const item2 = DOMCache.refresh('cargo-item-1');
}

// =============================================================================
// EXAMPLE 6: Conditional Element Access
// =============================================================================

// Before: Access even if element might not exist
function checkOptionalFeature_OLD() {
  const element = document.getElementById('optional-feature');
  if (element) {
    element.classList.add('active');
  }
}

// After: Use exists() to avoid caching null values
function checkOptionalFeature_NEW() {
  if (DOMCache.exists('optional-feature')) {
    DOMCache.get('optional-feature').classList.add('active');
  }
}

// =============================================================================
// EXAMPLE 7: Local Variable Caching for Multiple Operations
// =============================================================================

// Before: Repeated getElementById in same function
function updateChatUI_OLD() {
  document.getElementById('chat-messages').scrollTop =
    document.getElementById('chat-messages').scrollHeight;

  document.getElementById('chat-messages').classList.add('updated');

  setTimeout(() => {
    document.getElementById('chat-messages').classList.remove('updated');
  }, 1000);
}

// After: Cache in local variable for multiple uses
function updateChatUI_NEW() {
  const chatMessages = DOMCache.chatMessages;
  chatMessages.scrollTop = chatMessages.scrollHeight;
  chatMessages.classList.add('updated');

  setTimeout(() => {
    chatMessages.classList.remove('updated');
  }, 1000);
}

// =============================================================================
// EXAMPLE 8: Canvas Context Caching
// =============================================================================

// Before: Get canvas and context separately
function renderRadar_OLD() {
  const canvas = document.getElementById('radar-canvas');
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // ... render radar
}

// After: Cache canvas, get context once
const RadarRenderer = {
  canvas: null,
  ctx: null,

  init() {
    this.canvas = DOMCache.radarCanvas;
    this.ctx = this.canvas.getContext('2d');
  },

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    // ... render radar
  }
};

// =============================================================================
// EXAMPLE 9: Tab Switching with DOMCache
// =============================================================================

// Before: Query all tabs and content every switch
function switchTab_OLD(tabName) {
  const tabs = document.querySelectorAll('.terminal-tab');
  tabs.forEach(tab => tab.classList.remove('active'));

  const contents = document.querySelectorAll('.terminal-content');
  contents.forEach(content => content.classList.remove('active'));

  document.getElementById(`${tabName}-content`).classList.add('active');
}

// After: Cache content elements, use querySelectorAll for groups
function switchTab_NEW(tabName) {
  // Use querySelectorAll for groups (not in DOMCache scope)
  document.querySelectorAll('.terminal-tab').forEach(tab =>
    tab.classList.remove('active')
  );

  document.querySelectorAll('.terminal-content').forEach(content =>
    content.classList.remove('active')
  );

  // Use DOMCache for specific elements
  DOMCache.get(`${tabName}-content`).classList.add('active');
}

// =============================================================================
// EXAMPLE 10: Debugging Cache Issues
// =============================================================================

function debugCacheIssues() {
  console.log('=== DOMCache Debug ===');

  // Check if element exists
  console.log('Terminal panel exists?', DOMCache.exists('terminal-panel'));

  // Get cache statistics
  const stats = DOMCache.getStats();
  console.log('Cache stats:', stats);

  // Full debug output
  DOMCache.debug();

  // Check specific element
  const panel = DOMCache.get('terminal-panel');
  console.log('Panel cached:', panel !== null);
  console.log('Panel visible:', !panel?.classList.contains('hidden'));

  // Force refresh if needed
  const freshPanel = DOMCache.refresh('terminal-panel');
  console.log('Fresh panel:', freshPanel);
}

// =============================================================================
// EXAMPLE 11: Migration Pattern for Existing Modules
// =============================================================================

// Original HUD module pattern
const HUD_OLD = {
  init() {
    this.radarCanvas = document.getElementById('radar-canvas');
    this.radarCtx = this.radarCanvas.getContext('2d');
  },

  update() {
    document.getElementById('credit-value').textContent = Player.credits;
    document.getElementById('sector-coords').textContent =
      `${Player.sector.x}, ${Player.sector.y}`;
  }
};

// Migrated to use DOMCache
const HUD_NEW = {
  init() {
    this.radarCanvas = DOMCache.radarCanvas;
    this.radarCtx = this.radarCanvas.getContext('2d');
  },

  update() {
    DOMCache.creditValue.textContent = Player.credits;
    DOMCache.sectorCoords.textContent = `${Player.sector.x}, ${Player.sector.y}`;
  }
};

// =============================================================================
// EXAMPLE 12: Performance Testing
// =============================================================================

function benchmarkDOMCache() {
  console.log('=== DOM Cache Benchmark ===');

  // Test 1: getElementById vs DOMCache
  const iterations = 10000;

  // Uncached access
  console.time('getElementById (uncached)');
  for (let i = 0; i < iterations; i++) {
    const el = document.getElementById('hud');
  }
  console.timeEnd('getElementById (uncached)');

  // Cached access
  console.time('DOMCache (cached)');
  for (let i = 0; i < iterations; i++) {
    const el = DOMCache.hud;
  }
  console.timeEnd('DOMCache (cached)');

  // Test 2: Multiple element access
  const ids = ['hud', 'auth-screen', 'terminal-panel', 'radar-canvas', 'chat-overlay'];

  console.time('getElementById multiple');
  for (let i = 0; i < iterations; i++) {
    ids.forEach(id => document.getElementById(id));
  }
  console.timeEnd('getElementById multiple');

  console.time('DOMCache multiple');
  for (let i = 0; i < iterations; i++) {
    ids.forEach(id => DOMCache.get(id));
  }
  console.timeEnd('DOMCache multiple');

  // Test 3: Batch access
  console.time('DOMCache.getMany');
  for (let i = 0; i < iterations; i++) {
    DOMCache.getMany(ids);
  }
  console.timeEnd('DOMCache.getMany');
}

// Run benchmark in console:
// benchmarkDOMCache();

// =============================================================================
// NOTES FOR MIGRATION
// =============================================================================

/*
1. Priority Migration Targets:
   - Functions called in render loops (60 FPS)
   - Event handlers with frequent access
   - Initialization functions with multiple queries
   - UI update functions

2. Don't Migrate:
   - Single-use queries
   - querySelector/querySelectorAll (use for groups)
   - Dynamically created elements (invalidate cache)
   - Elements accessed only once in entire app lifecycle

3. Best Practices:
   - Use named getters when available
   - Invalidate after DOM modifications
   - Cache in local variables for multiple operations in one function
   - Use .exists() for optional elements
   - Debug with .debug() when troubleshooting

4. Common Issues:
   - Forgetting to invalidate after innerHTML changes
   - Trying to cache elements before DOM ready
   - Caching null values for non-existent elements
   - Using cache for dynamically created modal/overlay IDs
*/
