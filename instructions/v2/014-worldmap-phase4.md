# Phase 4: Integration & Workflow

## Overview
This final phase stitches the World Map and Battle Map together. It handles the user flow of traveling (moving the party pin), entering a location (clicking a pin), and starting combat (initializing an encounter from exploration).

## 1. Navigation Flow

**User Story:**
1.  User clicks "World" tab.
2.  User drags "Party" pin to "Phandalin" pin.
3.  User clicks "Enter Phandalin" in the details sidebar.
4.  App switches to "Map" tab, loading the Phandalin map in `Explore` mode.

### Implementation `js/app.js` (Main Controller)

```javascript
class GameController {
    constructor() {
        this.worldMap = new WorldMapRenderer('world-map-container', window.worldManager);
        this.battleMap = new BattleMap('battlemap-canvas');
        
        this.init();
    }

    async init() {
        await window.worldManager.load();
        this.worldMap.render();
        
        // Listener for entering location
        document.addEventListener('enterLocation', (e) => {
            this.loadLocation(e.detail.locationId);
        });
    }

    async loadLocation(locationId) {
        // 1. Get Location Data
        const location = window.worldManager.data.locations.find(l => l.id === locationId);
        if (!location || !location.linkedMapId) {
            console.error("No map linked for this location");
            return;
        }

        // 2. Switch Tab
        document.querySelector('[data-tab="map"]').click();

        // 3. Update Party Location in Soul
        window.worldManager.updatePartyLocation(locationId);

        // 4. Hydrate Battlemap
        const tokens = await TokenFactory.createTokensForMap({ locationId });
        
        // 5. Load Map Image & Set Mode
        this.battleMap.loadMap(location.linkedMapId);
        this.battleMap.setTokens(tokens);
        this.battleMap.setMode('explore');
    }
}
```

## 2. Transition to Combat

**User Story:**
1.  Party is exploring a dungeon.
2.  DM clicks "Start Encounter" (or "Roll Initiative").
3.  App toggles to `Combat` mode.
4.  Initiative UI appears.

### Implementation

Update `js/battlemap.js` or `js/encounterManager.js`.

```javascript
/* In EncounterManager */
async startEncounter(currentMapState) {
    // 1. Snapshot current positions from Explore Mode
    const combatantPositions = currentMapState.tokens.map(t => ({
        characterId: t.id,
        x: t.x,
        y: t.y
    }));

    // 2. Create new Encounter Entry
    const encounter = {
        id: `enc_${Date.now()}`,
        combatants: combatantPositions,
        turn: 0
    };
    
    // 3. Switch Mode
    window.game.battleMap.setMode('combat');
    // 4. Show Initiative Tracker
    document.getElementById('initiative-tracker').classList.remove('hidden');
}
```

## 3. Sidebar Integration

The Sidebar in `battlemap.html` needs to be context-aware.

- **World Tab:** Shows Location Details (Description, Shops, "Enter" button).
- **Map Tab (Explore):** Shows Room descriptions or simple token list.
- **Map Tab (Combat):** Shows Initiative Tracker and Combat Stats.

We can achieve this by having sections with `data-context` attributes.

```html
<aside id="sidebar">
  <!-- World Context -->
  <div class="sidebar-section" data-context="world">
    <h2 id="loc-title">Select a Location</h2>
    <p id="loc-desc">...</p>
    <button id="btn-enter-loc" class="hidden">Enter Location</button>
  </div>

  <!-- Combat Context -->
  <div class="sidebar-section" data-context="combat">
    <h2>Initiative</h2>
    <ul id="initiative-list"></ul>
  </div>
</aside>
```

And a simple viewing manager:

```javascript
function setSidebarContext(context) {
    document.querySelectorAll('.sidebar-section').forEach(el => {
        if (el.dataset.context === context) el.classList.remove('hidden');
        else el.classList.add('hidden');
    });
}
```
