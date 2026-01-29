# UI Overhaul & Token Linking Implementation Plan

## Goal
Unify the Map and Run modes into a single cohesive interface ("Command Center") where the Battlemap takes center stage, flanked by collapsible sidebars for Initiative/Tools and Statblocks. Implement robust "Token-First" logic so map tokens are the source of truth for combat.

## User Review Required
> [!NOTE]
> This is a significant UI refactor. `map-mode` and `run-mode` will effectively merge. The "Run Mode" button in the header might become redundant or simple toggle the "Initiative" view in the Left Sidebar.

## Proposed Changes

### 1. Logic: "Token-First" Registration

#### [MODIFY] `js/battlemap.js`
-   **`addToken`**:
    -   Generate a UUID `instanceId` for every token upon creation.
    -   Accept an optional `existingInstanceId` to persist IDs during save/load.
-   **`populateFromEncounter`**:
    -   When generating tokens, assign them new `instanceId`s.
-   **`getDataForCombat`** (New Method):
    -   Returns a list of combatants derived *directly* from the current tokens on the map (for those that have stats/slugs).

#### [MODIFY] `js/app.js`
-   **`startEncounter`**:
    -   Check if Battlemap has tokens.
    -   If yes, use `Battlemap.getDataForCombat()` to build the Combatant list. This ensures `id`s match exactly.
    -   If no tokens, fallback to abstract encounter generation (old behavior).

### 2. UI Layout: "Command Center"

#### [MODIFY] `index.html` & `css/styles.css`
-   Create a main grid container: `.command-center`.
-   **Left Column (`.sidebar-left`)**:
    -   Contains a Tab/Toggle system: `[Map Tools] | [Initiative]`.
    -   *Collapsible*: Add a `<` button to hide it.
-   **Center Column (`.main-viewport`)**:
    -   Contains the `#battlemap-canvas`.
    -   Contains the "Bottom Widgets" (Map controls, Background upload, Grid settings).
-   **Right Column (`.sidebar-right`)**:
    -   Contains `#active-statblock` and `#dice-roller`.
    -   *Collapsible*: Add a `>` button to hide it.

#### [MODIFY] `js/ui.js`
-   **`toggleSidebar(side)`**: Logic to collapse/expand sidebars and trigger `Battlemap.resizeCanvas()`.
-   **`switchMode`**:
    -   "Run Mode" now simply opens the Left Sidebar to the "Initiative" tab and ensures the Right Sidebar is open.

### 3. Interactivity: The Link

#### [MODIFY] `js/app.js` & `js/battlemap.js`
-   **Selection Sync**:
    -   `Battlemap.onTokenSelect` -> Triggers `UI.highlightInitiative(token.instanceId)` AND `UI.showStatblock(token.slug)`.
    -   `UI.onInitiativeClick` -> Triggers `Battlemap.panToToken(combatant.id)` AND `Battlemap.selectToken(combatant.id)`.

## Verification Plan

### Manual Verification
1.  **Layout Test**:
    -   Click "Map Mode". Verify 3-column layout.
    -   Click collapse buttons. Verify Map resizes to fill space.
    -   Verify Bottom Widgets are still accessible under the map.
2.  **Flow Test**:
    -   Go to Prep, add 2 Goblins.
    -   Go to Map, "Populate Tokens".
    -   Click **Run Encounter** (from sidebar or header).
    -   Verify Initiative List appears in Left Sidebar.
    -   Verify 2 Goblins are listed.
3.  **Link Test**:
    -   Click "Goblin 1" token on Map. -> Verify "Goblin 1" highlighted in Initiative. -> Verify Goblin Statblock in Right Sidebar.
    -   Click "Goblin 2" in Initiative. -> Verify Map pans to "Goblin 2" and selects it.
