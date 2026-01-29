# Enhanced Dice Roller & Map Roll Display

## Overview

Upgrade the dice rolling experience with a visual dice builder interface, advantage/disadvantage support, and show roll results directly on the battlemap with floating popups on tokens.

---

## Goals

1. **Visual Dice Builder** - Interactive UI to build dice rolls instead of typing notation
2. **Advantage/Disadvantage Toggle** - One-click toggle for D&D 5e advantage mechanics
3. **Floating Token Roll Popups** - Show roll results above tokens on the battlemap
4. **Token Glow Effects** - Visual feedback when rolls are made for creatures
5. **Roll Presets** - Save common rolls tied to creatures/actions

---

## Feature 1: Visual Dice Builder

Replace the simple text input with an interactive dice tray.

### UI Layout

```
┌─────────────────────────────────────────────────────────┐
│  Dice Tray                                        [−]   │
├─────────────────────────────────────────────────────────┤
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐      │
│  │ d4 │ │ d6 │ │ d8 │ │d10 │ │d12 │ │d20 │ │d100│      │
│  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘      │
│                                                         │
│  Selected: 🎲🎲 d6  +  🎲 d8                            │
│                                                         │
│  Modifier: [−] [ +3 ] [+]                               │
│                                                         │
│  ○ Normal  ● Advantage  ○ Disadvantage   (d20 only)    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              🎲  ROLL  🎲                        │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Last: 2d6+1d8+3 = [4,5]+[6]+3 = 18                    │
└─────────────────────────────────────────────────────────┘
```

### [NEW] HTML Structure

#### [MODIFY] [index.html](file:///c:/Users/Jesse/Organize/Personal/jvdnd/index.html)

Replace the existing dice sidebar content (around line 340-360) with:

```html
<div class="dice-sidebar">
    <h3>🎲 Dice Roller</h3>
    
    <!-- Dice Selection Buttons -->
    <div class="dice-buttons">
        <button class="dice-btn" data-die="4">d4</button>
        <button class="dice-btn" data-die="6">d6</button>
        <button class="dice-btn" data-die="8">d8</button>
        <button class="dice-btn" data-die="10">d10</button>
        <button class="dice-btn" data-die="12">d12</button>
        <button class="dice-btn" data-die="20">d20</button>
        <button class="dice-btn" data-die="100">d100</button>
    </div>
    
    <!-- Selected Dice Display -->
    <div class="dice-tray">
        <div id="selected-dice" class="selected-dice">
            <span class="empty-tray">Click dice to add</span>
        </div>
        <button id="btn-clear-dice" class="btn-small" title="Clear all">✕</button>
    </div>
    
    <!-- Modifier Control -->
    <div class="modifier-control">
        <label>Modifier:</label>
        <button id="mod-minus" class="btn-small">−</button>
        <input type="number" id="dice-modifier" value="0" min="-20" max="20">
        <button id="mod-plus" class="btn-small">+</button>
    </div>
    
    <!-- Advantage Toggle (for d20 rolls) -->
    <div id="advantage-toggle" class="advantage-toggle hidden">
        <label class="radio-option">
            <input type="radio" name="roll-mode" value="normal" checked> Normal
        </label>
        <label class="radio-option">
            <input type="radio" name="roll-mode" value="advantage"> Advantage
        </label>
        <label class="radio-option">
            <input type="radio" name="roll-mode" value="disadvantage"> Disadvantage
        </label>
    </div>
    
    <!-- Roll Button -->
    <button id="btn-roll-dice" class="btn-primary btn-roll">🎲 ROLL 🎲</button>
    
    <!-- Quick Notation Input (for power users) -->
    <div class="quick-input">
        <input type="text" id="dice-input" placeholder="Or type: 2d6+3">
    </div>
    
    <!-- Results -->
    <div id="dice-results" class="dice-results"></div>
</div>
```

### [MODIFY] [css/styles.css](file:///c:/Users/Jesse/Organize/Personal/jvdnd/css/styles.css)

Add styles for the new dice builder:

```css
/* ============ Dice Builder ============ */

.dice-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1rem;
}

.dice-btn {
    flex: 1 0 calc(25% - 0.5rem);
    min-width: 45px;
    padding: 0.75rem 0.5rem;
    background: var(--surface);
    border: 2px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-weight: bold;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.15s ease;
}

.dice-btn:hover {
    background: var(--border);
    border-color: var(--accent);
    transform: scale(1.05);
}

.dice-btn:active {
    transform: scale(0.95);
}

.dice-btn.selected {
    background: var(--accent);
    color: var(--bg-dark);
    border-color: var(--accent);
}

/* Dice Tray */
.dice-tray {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.75rem;
    margin-bottom: 1rem;
    min-height: 60px;
}

.selected-dice {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
}

.selected-dice .empty-tray {
    color: var(--text-muted);
    font-style: italic;
}

.die-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: var(--accent);
    color: var(--bg-dark);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-weight: bold;
    font-size: 0.85rem;
    cursor: pointer;
}

.die-chip:hover {
    background: var(--danger);
    color: var(--text);
}

.die-chip .die-count {
    background: rgba(0,0,0,0.3);
    padding: 0 0.25rem;
    border-radius: 2px;
    margin-right: 0.25rem;
}

/* Modifier Control */
.modifier-control {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
}

.modifier-control label {
    color: var(--text-muted);
}

.modifier-control input {
    width: 50px;
    text-align: center;
    font-weight: bold;
}

/* Advantage Toggle */
.advantage-toggle {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
    padding: 0.5rem;
    background: var(--bg-dark);
    border-radius: 4px;
}

.advantage-toggle.hidden {
    display: none;
}

.radio-option {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--text);
    cursor: pointer;
    font-size: 0.85rem;
}

.radio-option input[type="radio"] {
    accent-color: var(--accent);
}

/* Roll Button */
.btn-roll {
    width: 100%;
    padding: 1rem;
    font-size: 1.2rem;
    font-weight: bold;
    margin-bottom: 1rem;
    transition: all 0.2s ease;
}

.btn-roll:hover {
    transform: scale(1.02);
    box-shadow: 0 4px 15px rgba(201, 162, 39, 0.3);
}

.btn-roll:active {
    transform: scale(0.98);
}

/* Quick Input */
.quick-input {
    margin-bottom: 1rem;
}

.quick-input input {
    width: 100%;
    padding: 0.5rem;
    text-align: center;
    font-family: monospace;
}

/* Results Display */
.dice-results {
    max-height: 200px;
    overflow-y: auto;
}

.dice-result {
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.5rem;
    margin-bottom: 0.5rem;
}

.dice-result .roll-expression {
    font-family: monospace;
    color: var(--text-muted);
    font-size: 0.85rem;
}

.dice-result .roll-breakdown {
    color: var(--text-muted);
    font-size: 0.8rem;
}

.dice-result .roll-total {
    font-size: 1.5rem;
    font-weight: bold;
    color: var(--accent);
}

.dice-result .roll-total.crit {
    color: var(--success);
    text-shadow: 0 0 10px var(--success);
}

.dice-result .roll-total.fumble {
    color: var(--danger);
}

.dice-result .advantage-info {
    font-size: 0.8rem;
    color: var(--text-muted);
}

.dice-result .advantage-info .used {
    color: var(--accent);
    font-weight: bold;
}

.dice-result .advantage-info .discarded {
    text-decoration: line-through;
    opacity: 0.5;
}
```

### [MODIFY] [js/app.js](file:///c:/Users/Jesse/Organize/Personal/jvdnd/js/app.js)

Add dice builder logic in the App object:

```javascript
// Dice Builder State
diceBuilder: {
    selectedDice: {},  // { 6: 2, 8: 1 } = 2d6 + 1d8
    modifier: 0,
    rollMode: 'normal' // 'normal', 'advantage', 'disadvantage'
},

initDiceBuilder() {
    // Dice button clicks
    document.querySelectorAll('.dice-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const die = parseInt(btn.dataset.die);
            this.addDie(die);
        });
    });

    // Clear button
    document.getElementById('btn-clear-dice').addEventListener('click', () => {
        this.clearDice();
    });

    // Modifier controls
    document.getElementById('mod-minus').addEventListener('click', () => {
        this.adjustModifier(-1);
    });
    document.getElementById('mod-plus').addEventListener('click', () => {
        this.adjustModifier(1);
    });
    document.getElementById('dice-modifier').addEventListener('change', (e) => {
        this.diceBuilder.modifier = parseInt(e.target.value) || 0;
    });

    // Advantage toggle
    document.querySelectorAll('input[name="roll-mode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            this.diceBuilder.rollMode = e.target.value;
        });
    });

    // Roll button
    document.getElementById('btn-roll-dice').addEventListener('click', () => {
        this.rollBuiltDice();
    });

    // Quick input (existing functionality)
    document.getElementById('dice-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const notation = e.target.value.trim();
            if (notation) {
                const result = Dice.roll(notation);
                UI.addDiceResult(notation, result);
                e.target.value = '';
            }
        }
    });
},

addDie(sides) {
    if (!this.diceBuilder.selectedDice[sides]) {
        this.diceBuilder.selectedDice[sides] = 0;
    }
    this.diceBuilder.selectedDice[sides]++;
    this.renderSelectedDice();
    
    // Show advantage toggle if d20 is selected
    const hasD20 = this.diceBuilder.selectedDice[20] > 0;
    document.getElementById('advantage-toggle').classList.toggle('hidden', !hasD20);
},

removeDie(sides) {
    if (this.diceBuilder.selectedDice[sides]) {
        this.diceBuilder.selectedDice[sides]--;
        if (this.diceBuilder.selectedDice[sides] <= 0) {
            delete this.diceBuilder.selectedDice[sides];
        }
    }
    this.renderSelectedDice();
    
    // Hide advantage toggle if no d20
    const hasD20 = this.diceBuilder.selectedDice[20] > 0;
    document.getElementById('advantage-toggle').classList.toggle('hidden', !hasD20);
},

clearDice() {
    this.diceBuilder.selectedDice = {};
    this.diceBuilder.modifier = 0;
    document.getElementById('dice-modifier').value = 0;
    this.renderSelectedDice();
    document.getElementById('advantage-toggle').classList.add('hidden');
},

adjustModifier(delta) {
    this.diceBuilder.modifier = Math.max(-20, Math.min(20, this.diceBuilder.modifier + delta));
    document.getElementById('dice-modifier').value = this.diceBuilder.modifier;
},

renderSelectedDice() {
    const container = document.getElementById('selected-dice');
    const dice = this.diceBuilder.selectedDice;
    
    if (Object.keys(dice).length === 0) {
        container.innerHTML = '<span class="empty-tray">Click dice to add</span>';
        return;
    }
    
    container.innerHTML = Object.entries(dice)
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
        .map(([sides, count]) => `
            <span class="die-chip" data-die="${sides}" title="Click to remove">
                <span class="die-count">${count}</span>d${sides}
            </span>
        `).join(' + ');
    
    // Add click handlers to remove dice
    container.querySelectorAll('.die-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            this.removeDie(parseInt(chip.dataset.die));
        });
    });
},

rollBuiltDice() {
    const dice = this.diceBuilder.selectedDice;
    const modifier = this.diceBuilder.modifier;
    const rollMode = this.diceBuilder.rollMode;
    
    if (Object.keys(dice).length === 0) {
        return; // Nothing to roll
    }
    
    // Build notation string
    const parts = Object.entries(dice)
        .sort((a, b) => parseInt(b[0]) - parseInt(a[0])) // d20 first
        .map(([sides, count]) => `${count}d${sides}`);
    
    if (modifier !== 0) {
        parts.push(modifier > 0 ? `+${modifier}` : `${modifier}`);
    }
    const notation = parts.join('+').replace('+-', '-');
    
    // Handle advantage/disadvantage for d20 rolls
    if (dice[20] && dice[20] === 1 && rollMode !== 'normal') {
        const roll1 = Dice.rollDie(20);
        const roll2 = Dice.rollDie(20);
        const useRoll = rollMode === 'advantage' 
            ? Math.max(roll1, roll2) 
            : Math.min(roll1, roll2);
        
        // Calculate rest of the roll
        let otherTotal = modifier;
        const otherRolls = [];
        Object.entries(dice).forEach(([sides, count]) => {
            if (sides !== '20') {
                for (let i = 0; i < count; i++) {
                    const r = Dice.rollDie(parseInt(sides));
                    otherRolls.push(r);
                    otherTotal += r;
                }
            }
        });
        
        const total = useRoll + otherTotal;
        const result = {
            rolls: [useRoll, ...otherRolls],
            modifier,
            total,
            isCrit: useRoll === 20,
            isFumble: useRoll === 1,
            advantage: {
                mode: rollMode,
                roll1,
                roll2,
                used: useRoll
            }
        };
        
        UI.addDiceResultAdvantage(notation, result);
    } else {
        // Normal roll
        const result = Dice.roll(notation);
        UI.addDiceResult(notation, result);
    }
}
```

### [MODIFY] [js/ui.js](file:///c:/Users/Jesse/Organize/Personal/jvdnd/js/ui.js)

Add enhanced result display for advantage rolls:

```javascript
addDiceResultAdvantage(notation, result) {
    const div = document.createElement('div');
    div.className = 'dice-result';
    
    const advantageHtml = result.advantage ? `
        <div class="advantage-info">
            ${result.advantage.mode === 'advantage' ? '▲ Advantage' : '▼ Disadvantage'}: 
            <span class="${result.advantage.roll1 === result.advantage.used ? 'used' : 'discarded'}">${result.advantage.roll1}</span>
            / 
            <span class="${result.advantage.roll2 === result.advantage.used ? 'used' : 'discarded'}">${result.advantage.roll2}</span>
        </div>
    ` : '';
    
    let totalClass = '';
    if (result.isCrit) totalClass = 'crit';
    else if (result.isFumble) totalClass = 'fumble';
    
    div.innerHTML = `
        <div class="roll-expression">${notation}</div>
        ${advantageHtml}
        <div class="roll-total ${totalClass}">
            ${result.total}
            ${result.isCrit ? ' 🎯 CRIT!' : ''}
            ${result.isFumble ? ' 💀 FUMBLE' : ''}
        </div>
    `;
    
    this.elements.diceResults.insertBefore(div, this.elements.diceResults.firstChild);
    while (this.elements.diceResults.children.length > 10) {
        this.elements.diceResults.removeChild(this.elements.diceResults.lastChild);
    }
}
```

---

## Feature 2: Floating Token Roll Popups

Show roll results as floating popups above tokens on the battlemap.

### [MODIFY] [js/battlemap.js](file:///c:/Users/Jesse/Organize/Personal/jvdnd/js/battlemap.js)

Add roll popup rendering:

```javascript
// Add to state object
rollPopups: [],  // { tokenId, text, type, timestamp }

// Add method to show roll popup
showRollPopup(tokenId, text, type = 'damage') {
    const token = this.state.tokens.find(t => t.id === tokenId);
    if (!token) return;
    
    this.state.rollPopups.push({
        tokenId,
        text,
        type, // 'attack', 'damage', 'save', 'heal'
        timestamp: Date.now(),
        x: token.x,
        y: token.y
    });
    
    this.render();
    
    // Remove after animation
    setTimeout(() => {
        this.state.rollPopups = this.state.rollPopups.filter(
            p => Date.now() - p.timestamp < 2000
        );
        this.render();
    }, 2000);
},

// Add to render() function, after drawing tokens
renderRollPopups(ctx, gridSize) {
    const now = Date.now();
    
    this.state.rollPopups.forEach(popup => {
        const age = now - popup.timestamp;
        const progress = age / 2000; // 0 to 1 over 2 seconds
        
        if (progress >= 1) return;
        
        // Fade out and float up
        const alpha = 1 - progress;
        const yOffset = -30 - (progress * 40); // Float upward
        
        const x = (popup.x + 0.5) * gridSize;
        const y = (popup.y + 0.5) * gridSize + yOffset;
        
        // Color based on type
        const colors = {
            attack: '#4a9eff',
            damage: '#ff4a4a',
            save: '#9b59b6',
            heal: '#2ecc71',
            default: '#f1c40f'
        };
        const color = colors[popup.type] || colors.default;
        
        ctx.save();
        ctx.globalAlpha = alpha;
        
        // Background pill
        ctx.font = `bold ${18 / this.state.zoom}px system-ui`;
        const metrics = ctx.measureText(popup.text);
        const padding = 8 / this.state.zoom;
        const width = metrics.width + padding * 2;
        const height = 24 / this.state.zoom;
        
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.beginPath();
        ctx.roundRect(x - width/2, y - height/2, width, height, 4 / this.state.zoom);
        ctx.fill();
        
        // Border
        ctx.strokeStyle = color;
        ctx.lineWidth = 2 / this.state.zoom;
        ctx.stroke();
        
        // Text
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(popup.text, x, y);
        
        ctx.restore();
    });
}
```

### Integration with Statblock Roll Buttons

When a roll is made from the statblock, trigger the popup on the selected token:

#### [MODIFY] [js/app.js](file:///c:/Users/Jesse/Organize/Personal/jvdnd/js/app.js)

Update the roll button click handler:

```javascript
handleStatblockRoll(e) {
    if (!e.target.classList.contains('roll-btn')) return;
    
    const notation = e.target.dataset.roll;
    const type = e.target.dataset.type || 'damage';
    const result = Dice.roll(notation);
    
    // Show in dice results
    UI.addDiceResult(notation, result);
    
    // Show popup on selected token (if any)
    const selectedCombatant = this.getSelectedCombatant();
    if (selectedCombatant && !selectedCombatant.isPlayer) {
        const token = Battlemap.state.tokens.find(t => 
            t.instanceId === selectedCombatant.instanceId || 
            t.id === selectedCombatant.id
        );
        if (token) {
            const text = type === 'attack' 
                ? `🎯 ${result.total}` 
                : `💥 ${result.total}`;
            Battlemap.showRollPopup(token.id, text, type);
        }
    }
}
```

---

## Feature 3: Token Glow on Roll

Add a brief glow effect to tokens when rolls are made for them.

### [MODIFY] [js/battlemap.js](file:///c:/Users/Jesse/Organize/Personal/jvdnd/js/battlemap.js)

Add glow effect to token rendering:

```javascript
// Add to state
tokenGlows: {},  // { tokenId: { color, timestamp } }

// Add method
glowToken(tokenId, color = '#f1c40f') {
    this.state.tokenGlows[tokenId] = {
        color,
        timestamp: Date.now()
    };
    this.render();
    
    setTimeout(() => {
        delete this.state.tokenGlows[tokenId];
        this.render();
    }, 500);
},

// Modify renderToken to include glow
renderToken(ctx, token, gridSize) {
    const offset = token.size === 1 ? gridSize / 2 : gridSize;
    const x = token.x * gridSize + offset;
    const y = token.y * gridSize + offset;
    const radius = Math.max(8, (gridSize * token.size) / 2 - 4);
    
    // Check for glow effect
    const glow = this.state.tokenGlows[token.id];
    if (glow) {
        const age = Date.now() - glow.timestamp;
        const progress = age / 500;
        const glowRadius = radius + (20 / this.state.zoom) * (1 - progress);
        const alpha = 0.6 * (1 - progress);
        
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = glow.color;
        ctx.beginPath();
        ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    
    // ... rest of existing token rendering
}
```

---

## Feature 4: Roll Presets (Stretch Goal)

Save commonly used rolls for quick access.

### Data Structure

```javascript
// In State object
rollPresets: [
    { id: 'uuid', name: 'Longsword Attack', notation: '1d20+5', type: 'attack' },
    { id: 'uuid', name: 'Longsword Damage', notation: '1d8+3', type: 'damage' },
    { id: 'uuid', name: 'Sneak Attack', notation: '4d6', type: 'damage' }
]
```

### UI Addition

```html
<div class="roll-presets">
    <h4>Presets</h4>
    <div id="preset-list" class="preset-list">
        <!-- Presets rendered here -->
    </div>
    <button id="btn-add-preset" class="btn-small">+ Save Current</button>
</div>
```

---

## Verification

### Manual Testing

1. **Dice Builder**
   - [ ] Click dice buttons to add dice to tray
   - [ ] Click die chips to remove individual dice
   - [ ] Modifier +/- buttons work correctly
   - [ ] Roll button produces correct results
   - [ ] Quick input still works for power users

2. **Advantage/Disadvantage**
   - [ ] Toggle only appears when d20 is selected
   - [ ] Advantage takes higher of 2 rolls
   - [ ] Disadvantage takes lower of 2 rolls
   - [ ] Result shows both rolls with used/discarded styling

3. **Token Roll Popups**
   - [ ] Clicking roll buttons in statblock shows popup on token
   - [ ] Popup floats up and fades out
   - [ ] Color matches roll type (attack blue, damage red)
   - [ ] Works with zoom and pan

4. **Token Glow**
   - [ ] Token glows briefly when roll is made
   - [ ] Glow fades smoothly

5. **Cross-Mode Testing**
   - [ ] Dice roller works in Prep mode
   - [ ] Dice roller works in Run mode
   - [ ] Token popups work in Map mode during Run

---

## Implementation Order

1. **Phase 1: Dice Builder UI** (Core functionality)
   - HTML structure
   - CSS styling
   - JavaScript dice selection logic
   - Basic roll execution

2. **Phase 2: Advantage/Disadvantage**
   - Toggle UI
   - Modified roll logic
   - Enhanced result display

3. **Phase 3: Token Roll Popups**
   - Popup rendering on canvas
   - Integration with statblock rolls
   - Animation timing

4. **Phase 4: Token Glow** (Enhancement)
   - Glow effect rendering
   - Integration with rolls

5. **Phase 5: Roll Presets** (Stretch)
   - Save/load presets
   - Preset UI

---

## Dependencies

- Existing `Dice` module in `js/dice.js`
- Existing `Battlemap` module in `js/battlemap.js`
- Existing `UI` module in `js/ui.js`
- No external libraries required

---

## Notes

- All popups and effects should sync to player view
- Consider adding sound effects toggle in future
- Roll history could be persisted for session logging
