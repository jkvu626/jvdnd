# V1 Release: HP Persistence and "Realm Keeper" Rebrand

## Overview

This specification covers the final touches for the V1 release:
1.  **HP Persistence**: Player Characters (PCs) must retain their current HP between encounters. Currently, HP resets to max when an encounter starts, and combat damage is lost when the encounter ends.
2.  **Rebranding**: Rename the application from "Encounter Manager" to "**Realm Keeper**" to provide a more cohesive and thematic identity.

---

## 1. Player HP Persistence

### Problem
Currently, `js/state.js` stores party members as:
```javascript
{ id: "...", name: "Gimli", ac: 18, maxHp: 50 }
```
When an encounter starts, `app.js` initializes combatants using `maxHp`. There is no "current HP" stored in the persistent party state.

### Solution
1.  Add `hp` (current HP) to the party member object in `State`.
2.  Update UI to allow editing this `hp` value in Party Mode.
3.  Initialize combat using this `hp` value.
4.  When combat ends, sync the final combatant `hp` back to the party member's stored state.

### Implementation Details

#### [MODIFY] [js/state.js](file:///c:/Users/Jesse/Organize/Personal/jvdnd/js/state.js)

Update `addPartyMember` to include `hp` (initialized to `maxHp`):

```javascript
    addPartyMember(name, ac, maxHp) {
        const member = {
            id: this.generateId(),
            name,
            ac: parseInt(ac),
            maxHp: parseInt(maxHp),
            hp: parseInt(maxHp) // [NEW] Current HP
        };
        this.state.party.push(member);
        this.save();
        return member;
    },
```

Update `initActiveCombat` or similar logic to use `hp`. Actually, `initActiveCombat` takes an array of `combatants` which are prepared in `app.js`. So `state.js` needs a method to Sync back.

Add method `updatePartyMemberHp`:

```javascript
    updatePartyMemberHp(id, hp) {
        const member = this.state.party.find(m => m.id === id);
        if (member) {
            member.hp = Math.max(0, Math.min(hp, member.maxHp));
            this.save();
        }
    },
```

Update `endCombat` to sync player HP back to party state:

```javascript
    endCombat() {
        // [NEW] Sync player HP back to party state
        if (this.state.activeEncounter) {
            this.state.activeEncounter.combatants.forEach(c => {
                if (c.isPlayer) {
                    const member = this.state.party.find(p => p.id === c.id);
                    if (member) {
                        member.hp = c.hp;
                    }
                }
            });
        }

        this.state.activeEncounter = null;
        this.save();
    }
```

#### [MODIFY] [js/app.js](file:///c:/Users/Jesse/Organize/Personal/jvdnd/js/app.js)

Update `onStartCombat` to use the party member's current `hp`:

```javascript
    // In onStartCombat()
    party.forEach(p => {
        const init = playerInits.find(i => i.id === p.id);
        combatants.push({
            id: p.id,
            name: p.name,
            slug: null,
            initiative: init?.initiative || 10,
            ac: p.ac,
            hp: p.hp !== undefined ? p.hp : p.maxHp, // [NEW] Use current HP if available
            maxHp: p.maxHp,
            isPlayer: true,
            hasToken: false
        });
    });
```

#### [MODIFY] [js/ui.js](file:///c:/Users/Jesse/Organize/Personal/jvdnd/js/ui.js)

Update `renderPartyList` to show current HP:

```javascript
    renderPartyList(party) {
        if (party.length === 0) {
            this.elements.partyList.innerHTML = '<p class="empty-state">No party members yet</p>';
            return;
        }
        this.elements.partyList.innerHTML = party.map(m => `
            <div class="party-member" data-id="${m.id}">
                <div class="info">
                    <span class="name">${this.escapeHtml(m.name)}</span>
                    <span class="stat">AC ${m.ac}</span>
                    <span class="stat">HP ${m.hp ?? m.maxHp}/${m.maxHp}</span> <!-- [NEW] Show current/max -->
                </div>
                <!-- Optional: Add small +/- buttons here if desired, but for V1 just viewing is ample -->
                <button class="remove-btn" title="Remove">×</button>
            </div>
        `).join('');
    },
```

---

## 2. Rebrand to "Realm Keeper"

### Changes

#### [MODIFY] [index.html](file:///c:/Users/Jesse/Organize/Personal/jvdnd/index.html)

-   Update `<title>` tag.
-   Update `<h1>` in `<header>`.

```html
<head>
    ...
    <title>Realm Keeper</title>
    ...
</head>
<body>
    ...
    <header class="app-header">
        <h1>Realm Keeper</h1>
        ...
```

#### [MODIFY] [server.js](file:///c:/Users/Jesse/Organize/Personal/jvdnd/server.js)

Update console startup message:

```javascript
app.listen(PORT, () => {
    console.log(`\n  Realm Keeper running at:`);
    console.log(`  → http://localhost:${PORT}\n`);
});
```

---

## 3. Migration

On startup (`state.js init`), iterate through all party members. If `hp` is undefined, set it to `maxHp`. This ensures backward compatibility.

```javascript
    async init() {
        const saved = await API.loadState();
        if (saved) {
            this.state = { ...this.defaultState, ...saved };
            
            // [NEW] Migration: Ensure persistence of HP
            if (this.state.party) {
                this.state.party.forEach(p => {
                    if (p.hp === undefined) p.hp = p.maxHp;
                });
            }
        } else {
            this.state = { ...this.defaultState };
        }
        return this.state;
    },
```
