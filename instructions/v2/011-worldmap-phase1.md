# Phase 1: Data Layer & Migration

## Overview
This phase establishes the persistent "Soul" of the game world. We will create the `world.json` data structure to store character state and location separately from ephemeral encounters. We will also implement the `WorldManager` class to interface with this data and a migration script to move existing party data from `state.json`.

## 1. Data Structure (`world.json`)

New file `data/world.json` will serve as the database for persistent entities.

```json
{
  "viewport": { "x": 0, "y": 0, "zoom": 1 },
  "party": {
    "locationId": "phandalin", 
    "position": { "x": 450, "y": 300 },
    "state": "idle" 
  },
  "locations": [
    {
      "id": "phandalin",
      "name": "Phandalin",
      "type": "town",
      "x": 450, "y": 300,
      "linkedMapId": "map_phandalin_town_center",
      "description": "A small mining town..."
    }
  ],
  "characters": [] 
}
```

### Character Schema
Entries in `characters` array:

```javascript
{
  "id": "string",          // Unique ID (e.g., "pc_thorin")
  "type": "player" | "companion" | "npc",
  "name": "string",
  "stats": { 
    "hp": "number", 
    "maxHp": "number", 
    "ac": "number" 
  },
  "location": "party" | "string", // "party" or Location ID
  "portrait": "string"     // Path to image
}
```

## 2. WorldManager Class

Create `js/worldState.js` (or `WorldManager.js`).

```javascript
class WorldManager {
    constructor() {
        this.data = null;
        this.serverUrl = 'http://localhost:3000'; // Adjust as needed
    }

    async load() {
        try {
            const response = await fetch(`${this.serverUrl}/data/world.json`);
            if (response.ok) {
                this.data = await response.json();
            } else {
                console.warn("world.json not found, initializing empty.");
                this.data = this._getInitialState();
            }
        } catch (e) {
            console.error("Failed to load world data", e);
        }
    }

    async save() {
        if (!this.data) return;
        await fetch(`${this.serverUrl}/save/world`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.data)
        });
    }

    getCharacter(id) {
        return this.data.characters.find(c => c.id === id);
    }

    updateCharacter(id, updates) {
        const char = this.getCharacter(id);
        if (char) {
            Object.assign(char, updates);
            this.save();
        }
    }

    _getInitialState() {
        return {
            viewport: { x: 0, y: 0, zoom: 1 },
            party: { locationId: null, position: { x: 0, y: 0 }, state: 'idle' },
            locations: [],
            characters: []
        };
    }
}

// Export singleton
const worldManager = new WorldManager();
// window.worldManager = worldManager; // If using global scope
```

## 3. Migration Script

Create a temporary script `js/migrate.js` (or run in console) to transform `state.json`.

```javascript
async function migrateData() {
    // 1. Fetch old state
    const stateRes = await fetch('/data/state.json');
    const state = await stateRes.json();

    // 2. Extract Party
    const oldParty = state.party || [];
    
    // 3. Transform to new Character format
    const newCharacters = oldParty.map(member => ({
        id: `pc_${member.name.toLowerCase().replace(/\s+/g, '_')}`,
        type: 'player',
        name: member.name,
        stats: {
            hp: member.hp || member.maxHp || 10,
            maxHp: member.maxHp || member.hp || 10,
            ac: member.ac || 10
        },
        location: 'party',
        portrait: member.token || ''
    }));

    // 4. Create World Data
    const worldData = {
        viewport: { x: 0, y: 0, zoom: 1 },
        party: { 
            locationId: null, 
            position: { x: 500, y: 500 }, // Default center
            state: 'idle' 
        },
        locations: [
           // Seed with initial locations if needed
           { id: "phandalin", name: "Phandalin", x: 450, y: 300, type: "town" }
        ],
        characters: newCharacters
    };

    // 5. Save world.json
    console.log("Saving world.json...", worldData);
    await fetch('/save/world', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(worldData)
    });

    // 6. Clean up state.json (Optional: comment out for safety first)
    // delete state.party;
    // await fetch('/save/state', ...);
}
```

## 4. Server Update
Ensure `server.js` handles routes for `world.json`:
- `GET /data/world.json`
- `POST /save/world`

```javascript
/* Add to server.js */
app.get('/data/world.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'data', 'world.json'));
});

app.post('/save/world', (req, res) => {
    fs.writeFile(
        path.join(__dirname, 'data', 'world.json'), 
        JSON.stringify(req.body, null, 2), 
        (err) => {
            if (err) res.status(500).send(err);
            else res.send({status: 'ok'});
        }
    );
});
```
