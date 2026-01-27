# Auto-Populate Tokens on Encounter Start

## Goal
Automatically populate the Battlemap with tokens from the current encounter when the "Run Encounter" button is clicked. This ensures a consistent "Token-First" state for every encounter by clearing any existing tokens and placing fresh ones from the roster.

## User Review Required
> [!IMPORTANT]
> **Data Loss Warning**: Clicking "Run Encounter" will now **automatically clear all existing tokens** (including any manually placed props or tokens from previous sessions) before populating the new ones.

## Proposed Changes

### Logic Layer

#### [MODIFY] `js/battlemap.js`
Update `populateFromEncounter` to accept an optional `skipConfirm` argument.

```javascript
async populateFromEncounter(skipConfirm = false) {
    const encounter = State.getCurrentEncounter();
    if (!encounter) {
        alert('Please select an encounter first.');
        return;
    }

    const party = State.getParty();
    
    // Only show confirmation if NOT skipping
    if (!skipConfirm) {
        const confirmMsg = `This will add tokens for all monsters in "${encounter.name}" and ${party.length} party members. Continue?`;
        if (!confirm(confirmMsg)) return;
    }

    // ... rest of the function ...
}
```

#### [MODIFY] `js/app.js`
Update `startEncounter` to trigger the auto-population logic if the Battlemap is active.

```javascript
async startEncounter() {
    // ... validation checks ...

    // Show loading state
    UI.elements.btnRunEncounter.disabled = true;
    UI.elements.btnRunEncounter.textContent = 'Loading...';

    try {
        // [NEW] Auto-populate tokens if we have a battlemap
        if (Battlemap.canvas) {
            console.log('[startEncounter] Clearing and populating tokens...');
            Battlemap.clearAllTokens();
            await Battlemap.populateFromEncounter(true); // pass true to skip confirm
        }

        // Check if Battlemap has tokens with slugs (hybrid combat)
        const tokenData = (Battlemap.canvas) ? Battlemap.getDataForCombat() : [];
        
        // ... rest of the function ...
```

## Verification Plan

### Manual Verification
1.  **Setup**:
    -   Go to "Prep Mode" and ensure there is an active encounter with monsters.
    -   Go to "Map Mode" (or ensure Battlemap is active).
    -   Clear user tokens if any exist (`Battlemap.clearAllTokens()`).
    -   Manually place a few "dummy" tokens to verify they get cleared.
2.  **Action**:
    -   Click "Run Encounter".
3.  **Expected Result**:
    -   The "dummy" tokens disappear.
    -   Tokens for validity the encounter's monsters and party members appear.
    -   The application switches to the configured "Run/Map" view.
    -   The Initiative Tracker appears with the correct combatants linked to the new tokens.
