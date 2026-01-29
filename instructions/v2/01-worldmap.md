# V2 Implementation Spec: World Map & Unified Characters

## 1. Overview
This specification details the architecture for **Realm Keeper V2**, enabling a persistent world state, distinct player/NPC tracking, and a seamless transition between exploration and combat.

**Core Philosophy:**
- **Separation of Soul & Body:** Entity data lives in a global registry ("Soul"). Tokens are just ephemeral visual containers ("Body") that render this data.
- **Unified Map System:** A single map engine handles both "Explore Mode" (Town/World) and "Combat Mode" (Encounter), simply toggling UI elements and rules based on context.

---

## 2. Data Architecture

### 2.1 Character Registry (`world.json`)
We introduce a new `world.json` file to store persistent world state. The `characters` array acts as the single source of truth for all persistent entities (Players, Companions, Important NPCs).

```javascript
/* world.json */
{
  "viewport": { "x": 0, "y": 0, "zoom": 1 }, // Saved map view state
  
  // The Party's physical location in the world
  "party": {
    "locationId": "phandalin",      // ID of the POI they are currently at (or null if in wilderness)
    "position": { "x": 450, "y": 300 }, // Coordinates on the world map image
    "state": "idle"                 // "idle" | "traveling"
  },

  // Points of Interest (Towns, Dungeons, etc.)
  "locations": [
    {
      "id": "phandalin",
      "name": "Phandalin",
      "type": "town",
      "x": 450, "y": 300,
      "linkedMapId": "map_phandalin_town_center", // Optional: Links to a battlemap
      "description": "A small mining town..."
    }
  ],

  // THE SOUL: Global Character Registry
  "characters": [
    // Players (Migrated from state.json party)
    {
      "id": "pc_thorin",
      "type": "player", 
      "name": "Thorin",
      "stats": { "hp": 45, "maxHp": 45, "ac": 18 },
      "location": "party" // Players always move with the party
    },
    // Companions (NPCs travelling with party)
    {
      "id": "npc_gundren",
      "type": "companion",
      "name": "Gundren Rockseeker",
      "stats": { "hp": 15, "maxHp": 15, "ac": 10 },
      "location": "party", // Explicitly assigned to party
      "portrait": "gundren.png"
    },
    // World NPCs (Stay at specific locations)
    {
      "id": "npc_sildar",
      "type": "npc",
      "name": "Sildar Hallwinter",
      "stats": { "hp": 25, "maxHp": 25, "ac": 16 },
      "location": "phandalin", // Stays in Phandalin
      "statblockId": "veteran" // Links to SRD/Custom statblock
    }
  ]
}
```

### 2.2 Ad-Hoc Mobs (Encounter Data)
Random monsters (Goblins, Wolves) that do not need persistence remain in the Encounter object.

```javascript
/* state.json (Encounters) */
{
    "id": "enc_ambush",
    "combatants": [
        // Reference to a Global Character (Persistent)
        { "characterId": "pc_thorin", "initiative": 15 }, 
        
        // Ad-Hoc Mob (Ephemeral)
        { "name": "Goblin 1", "hp": 7, "ac": 15, "statblockId": "goblin", "initiative": 12 } 
    ]
}
```

---

## 3. UI & Systems

### 3.1 The World Tab
A new major tab alongside "Map" and "Encounters".
*   **Canvas:** Displays the World Map image.
*   **Navigation:** Pan/Zoom support (similar to battlemap).
*   **Party Token:** Represents the group's location. Draggable or click-to-move.
*   **POI Markers:** Clickable icons for Towns/Dungeons.
    *   *Click:* Opens "Location Details" sidebar/modal.
    *   *Action:* "Enter Location" (Loads linked Battlemap in Explore Mode).

### 3.2 Unified Map Engine (`battlemap.js`)
Refactor `battlemap.js` to support two modes.

| Feature | Explore Mode | Combat Mode |
| :--- | :--- | :--- |
| **Grid** | Hidden/Subtle | Visible/Snapping |
| **Initiative UI** | Hidden | Visible |
| **Token HP Bar** | Hidden (unless hovered) | Visible |
| **Turn Order** | Inactive | Active |
| **Fog of War** | Active | Active |
| **Movement** | Free | Measured (optional) |

**Mode Toggle:** A switch in the top toolbar: `[ 🔭 Explore ] <-> [ ⚔️ Combat ]`.

### 3.3 Token Hydration Logic
When loading a map (in either mode):
1.  **Get Context:**
    *   *Explore:* "Who is at this Location ID?" (Query `world.json`).
    *   *Combat:* "Who is in this Encounter?" (Query `state.json` + `world.json`).
2.  **Generate Tokens:**
    *   Iterate through list.
    *   If `characterId` exists -> Fetch data from Registry (Soul).
    *   If no `characterId` -> Use local encounter data (Body only).
3.  **Render:**
    *   Create standard token DOM elements.
    *   Attach event listeners (Click -> Profile/Statblock).

---

## 4. Implementation Steps

### Phase 1: Data Layer & Migration
1.  **Create `WorldManager` Class:** Handles loading/saving `world.json`.
2.  **Migration Script:** 
    *   Read `state.json`.
    *   Extract `party` array.
    *   Transform into `characters` entries with `type: "player"`.
    *   Save to `world.json`.
    *   Update `state.json` to remove legacy party array (or keep as cache until fully switched).

### Phase 2: World Tab Implementation
1.  **UI Shell:** Create `world.html` (or partial) and tab switching logic.
2.  **Map Renderer:** Implement basic image rendering with Pan/Zoom (reuse `BattleMap` logic if possible, or simplified version).
3.  **Entity Rendering:** Render Party Token and POIs based on `world.json` coordinates.

### Phase 3: Unified Battlemap
1.  **Refactor:** Modify `BattleMap` class to accept a `mode` parameter.
2.  **Token Factory:** Update token creation to handle Registry IDs vs Ad-hoc data.
3.  **Mode Toggle:** Add UI control to switch modes, firing events to show/hide Combat UI (Initiative tracker, etc.).

### Phase 4: Integration
1.  **Location Linking:** detailed flow for clicking "Enter Phandalin" -> Auto-load Phandalin Map -> Place Party Tokens.

---

## 5. Technical Requirements
- **No Frameworks:** Vanilla JS/CSS only.
- **Persistence:** All changes to Characters (HP, Location) must write back to `world.json` immediately.
- **Backwards Compatibility:** Old encounters must still work (may need a "Legacy" flag or auto-migration).
