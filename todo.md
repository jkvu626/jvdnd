# Project Roadmap

## 🗺️ Battlemap Evolution
- [X] **Encounter Integration**: Allow Encounters to reference a specific map image/config.
    - *Goal*: Selecting an encounter automatically preloads the associated map.
- [X] **Map Library & Persistence**:
    - [X] Create a server-side store for map images and metadata.
    - [X] Implement UI to select from saved maps.
    - [X] Auto-save current active map state (background, tokens, grid settings) to prevent loss on refresh.
- [ ] **Generative Maps (AI)**:
    - [ ] Research "Nano Banana" (or similar generative tools) for map creation.
    - [ ] *Note*: Investigate API costs and integration feasibility.
- [X] **Tools & Effects**:
    - [X] **AOE Pencil**: Tool for drawing spell effect areas (cones, cubes, spheres) on the map layer.
    - [X] **Fog of War**: Implement a masking layer to hide unexplored map areas from players.

## 🔗 Token & Monster Integration
- [X] **Drag-and-Drop Spawning**:
    - [X] Enable dragging a monster from the Initiative/Encounter list directly onto the map.
    - [X] Link token to monster stats (HP tracking sync).

## 📜 Statblock Polish
- [X] **Parsing Improvements**:
    - [X] Fix missing Bonus Actions and Reactions in the AI parser.
    - [X] Review `server.js` prompt structure.
- [X] **General Polish**:
    - [X] Improve readability and rendering of complex statblocks.

## 🎨 Aesthetics (Low Priority)
- [X] **Visual Audit**:
    - [X] "Classic D&D" theme consistency check.
    - [X] Minor UI cleanups.
