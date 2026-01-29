# Phase 3: Unified Battlemap & Modes

## Overview
This phase refactors the existing `BattleMap` class to support two distinct modes: **Explore** and **Combat**. It also implements the logic to "hydrate" tokens from the global Registry (Soul) or local Encounter data (Body).

## 1. Battlemap Modes

Update `js/battlemap.js` to handle modes.

```javascript
const MAP_MODES = {
    EXPLORE: 'explore',
    COMBAT: 'combat'
};

class BattleMap {
    constructor(containerId) {
        // ... existing setup ...
        this.mode = MAP_MODES.COMBAT; // Default for backward compatibility
    }

    setMode(newMode) {
        this.mode = newMode;
        this.render();
        this.emitModeChange();
    }

    render() {
        // 1. Draw Background
        // 2. Draw Grid (Conditional)
        if (this.mode === MAP_MODES.COMBAT) {
            this.drawGrid();
        }
        
        // 3. Draw Tokens
        this.tokens.forEach(token => this.drawToken(token));
        
        // 4. Draw Fog of War (Both modes usually have this)
        this.drawFog();
    }

    // ...
}
```

## 2. Token Hydration Integration

We need a factory that decides *how* to build a token based on available data.

```javascript
/* js/tokenFactory.js */

class TokenFactory {
    static async createTokensForMap(context) {
        // context = { locationId, encounterId }
        
        let tokenDataList = [];

        if (context.encounterId) {
            // Combat Mode: Load from Encounter
            const encounter = await window.encounterManager.load(context.encounterId);
            tokenDataList = encounter.combatants;
        } else if (context.locationId) {
            // Explore Mode: Load from World Registry
            const worldData = window.worldManager.data;
            // Find all characters currently in this location
            const characters = worldData.characters.filter(c => c.location === context.locationId);
            // Also add the party if they are here
            if (worldData.party.locationId === context.locationId) {
                 const partyMembers = worldData.characters.filter(c => c.location === 'party');
                 tokenDataList = [...tokenDataList, ...partyMembers];
            }
        }

        return tokenDataList.map(data => TokenFactory.hydrate(data));
    }

    static hydrate(data) {
        // Input `data` might be a raw mob OR a pointer to a registry character
        
        let stats = data;
        let isTenacious = false;

        // Check if this is a pointer to the Soul
        if (data.characterId) {
            const realChar = window.worldManager.getCharacter(data.characterId);
            if (realChar) {
                // Merge Persistent stats onto the token representation
                stats = { 
                    ...data, // Initiative, specific position
                    ...realChar, // Name, HP, AC from registry
                    isPersistent: true 
                };
            }
        }

        return new Token(stats);
    }
}
```

## 3. UI Changes (Mode Toggle)

Add a toggle in the top bar of the Battlemap view.

```html
<!-- In battlemap.html toolbar -->
<div id="mode-toggle" class="toggle-switch">
    <button id="btn-explore" onclick="game.setMode('explore')">🔭 Explore</button>
    <button id="btn-combat" onclick="game.setMode('combat')">⚔️ Combat</button>
</div>
```

**CSS for Toggle:**
```css
.toggle-switch button.active {
    background-color: #d4a017; /* Highlight active mode */
    color: #1a1a1a;
}
```

## 4. Interaction Differences

Refactor `battlemap.js` interaction handlers:

- **Movement:**
  - `Combat`: Check movement speed, snap to grid.
  - `Explore`: Free move, no distance limit.

- **Status Bars:**
  - `Combat`: Always show HP bars.
  - `Explore`: Hide HP bars unless hovering.

```javascript
/* In BattleMap.js render loop */
drawToken(token) {
    // ... draw image ...
    
    // Conditional UI
    if (this.mode === MAP_MODES.COMBAT || token.isHovered) {
        this.drawHealthBar(token);
    }
}
```
