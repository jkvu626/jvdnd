# Token Drag-and-Drop Spawning

## Overview

Enable dragging monsters from the Initiative/Encounter list directly onto the battlemap to spawn tokens. Link spawned tokens to their monster stats for synchronized HP tracking.

---

## Current State

- Tokens created manually via form (name, color, size)
- No connection between tokens and monster statblocks
- HP tracked separately in initiative list vs tokens

---

## Implementation

### 1. Make Monster Cards Draggable

#### [MODIFY] [ui.js](file:///c:/Users/Jesse/Organize/Personal/jvdnd/js/ui.js)

```javascript
renderEncounterMonsters(monsters) {
    this.elements.encounterMonsters.innerHTML = monsters.map(m => `
        <div class="combatant-card" 
             data-slug="${m.slug}" 
             data-name="${m.name}"
             draggable="true">
            <!-- existing content -->
        </div>
    `).join('');
    
    // Add drag handlers
    this.elements.encounterMonsters.querySelectorAll('.combatant-card').forEach(card => {
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('application/json', JSON.stringify({
                type: 'monster',
                slug: card.dataset.slug,
                name: card.dataset.name
            }));
            e.dataTransfer.effectAllowed = 'copy';
        });
    });
}
```

### 2. Initiative List Drag Support (Run Mode)

```javascript
renderInitiativeList(combatants, currentTurn) {
    // ... existing ...
    
    list.querySelectorAll('.initiative-item:not(.is-player)').forEach(item => {
        item.draggable = true;
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('application/json', JSON.stringify({
                type: 'combatant',
                id: item.dataset.id,
                slug: item.dataset.slug,
                name: item.querySelector('.name').textContent
            }));
        });
    });
}
```

### 3. Battlemap Drop Target

#### [MODIFY] [battlemap.js](file:///c:/Users/Jesse/Organize/Personal/jvdnd/js/battlemap.js)

```javascript
setupDragDrop() {
    this.canvas.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        
        // Show drop preview
        const coords = this.getGridCoords(e);
        this.state.dropPreview = coords;
        this.render();
    });
    
    this.canvas.addEventListener('dragleave', () => {
        this.state.dropPreview = null;
        this.render();
    });
    
    this.canvas.addEventListener('drop', async (e) => {
        e.preventDefault();
        this.state.dropPreview = null;
        
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        const coords = this.getGridCoords(e);
        
        await this.spawnTokenFromDrop(data, coords);
    });
},

async spawnTokenFromDrop(data, coords) {
    let monster = null;
    
    // Fetch monster stats if we have a slug
    if (data.slug) {
        monster = await API.getMonster(data.slug);
    }
    
    // Determine token size from monster
    const sizeMap = { Tiny: 0.5, Small: 1, Medium: 1, Large: 2, Huge: 3, Gargantuan: 4 };
    const size = monster ? (sizeMap[monster.size] || 1) : 1;
    
    // Generate color based on name hash
    const color = this.getTokenColor(data.name);
    
    const token = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        name: data.name,
        color,
        size,
        x: coords.x,
        y: coords.y,
        // Link to combat system
        combatantId: data.id || null,
        slug: data.slug || null,
        hp: monster?.hit_points || null,
        maxHp: monster?.hit_points || null
    };
    
    this.state.tokens.push(token);
    this.render();
    this.renderTokenList();
    this.syncPlayerView();
},

getTokenColor(name) {
    // Generate consistent color from name
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 50%)`;
}
```

### 4. HP Sync Between Token and Combat

When HP changes in initiative list, update token:

#### [MODIFY] [app.js](file:///c:/Users/Jesse/Organize/Personal/jvdnd/js/app.js)

```javascript
onHpChange(e) {
    // ... existing HP logic ...
    
    // Sync to battlemap token if linked
    if (combatant && Battlemap.canvas) {
        const token = Battlemap.state.tokens.find(t => t.combatantId === combatant.id);
        if (token) {
            token.hp = combatant.hp;
            Battlemap.render();
            Battlemap.syncPlayerView();
        }
    }
}
```

### 5. Token HP Display

Show HP bar on tokens:

```javascript
renderTokenHp(token, x, y, radius) {
    if (token.hp === null || token.maxHp === null) return;
    
    const ctx = this.ctx;
    const barWidth = radius * 2;
    const barHeight = 6;
    const barY = y + radius + 4;
    
    // Background
    ctx.fillStyle = '#333';
    ctx.fillRect(x - radius, barY, barWidth, barHeight);
    
    // HP fill
    const hpPercent = token.hp / token.maxHp;
    const hpColor = hpPercent > 0.5 ? '#4a4' : hpPercent > 0.25 ? '#aa4' : '#a44';
    ctx.fillStyle = hpColor;
    ctx.fillRect(x - radius, barY, barWidth * hpPercent, barHeight);
    
    // Border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1 / this.state.zoom;
    ctx.strokeRect(x - radius, barY, barWidth, barHeight);
}
```

---

## Visual Feedback

### Drop Preview

```javascript
renderDropPreview() {
    if (!this.state.dropPreview) return;
    
    const ctx = this.ctx;
    const gridSize = this.getScaledGridSize();
    const x = this.state.dropPreview.x * gridSize + gridSize / 2;
    const y = this.state.dropPreview.y * gridSize + gridSize / 2;
    
    ctx.fillStyle = 'rgba(0, 200, 100, 0.3)';
    ctx.strokeStyle = 'rgba(0, 200, 100, 0.8)';
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    ctx.arc(x, y, gridSize / 2 - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
}
```

---

## CSS for Draggable

```css
.combatant-card[draggable="true"],
.initiative-item[draggable="true"] {
    cursor: grab;
}

.combatant-card[draggable="true"]:active,
.initiative-item[draggable="true"]:active {
    cursor: grabbing;
}
```

---

## Verification

1. **Prep Mode**: Drag monster from encounter list → token spawns at drop location
2. **Run Mode**: Drag combatant from initiative → token spawns linked
3. Change HP in initiative list → token HP bar updates
4. Token size matches monster size (Large = 2x2)
5. Player view shows tokens with HP bars
