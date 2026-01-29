# AOE Pencil Tool

## Overview

Add a drawing tool to create area-of-effect (AOE) spell templates on the battlemap. Supports common D&D shapes: circles, cones, cubes, and lines.

---

## D&D 5e AOE Shapes

| Shape | Size Unit | Example Spells |
|-------|-----------|----------------|
| **Circle/Sphere** | Radius in ft | Fireball (20ft), Spirit Guardians (15ft) |
| **Cone** | Length in ft | Burning Hands (15ft), Cone of Cold (60ft) |
| **Cube** | Side length | Thunderwave (15ft), Stinking Cloud (20ft) |
| **Line** | Length × Width | Lightning Bolt (100ft × 5ft) |
| **Cylinder** | Radius + Height | Moonbeam (5ft radius) |

---

## Battlemap State Extension

#### [MODIFY] [battlemap.js](file:///c:/Users/Jesse/Organize/Personal/jvdnd/js/battlemap.js)

```javascript
state: {
    // ... existing ...
    aoeShapes: [],        // Persistent AOE shapes
    activeAoeTool: null,  // 'circle' | 'cone' | 'cube' | 'line' | null
    aoeColor: 'rgba(255, 100, 0, 0.4)',
    aoeSize: 20,          // ft
    aoePreview: null      // Temporary preview while placing
}
```

---

## AOE Shape Data Structure

```javascript
{
    id: string,
    type: 'circle' | 'cone' | 'cube' | 'line',
    x: number,           // Grid X origin
    y: number,           // Grid Y origin
    size: number,        // Radius/length in feet
    rotation: number,    // Degrees (for cones/lines)
    color: string,       // RGBA color
    label: string        // Optional label like "Fireball"
}
```

---

## Implementation

### 1. UI Controls

#### [MODIFY] [index.html](file:///c:/Users/Jesse/Organize/Personal/jvdnd/index.html)

Add AOE toolbar in battlemap section:

```html
<div class="aoe-toolbar">
    <span class="toolbar-label">AOE Tools:</span>
    <button id="aoe-circle" class="btn btn-tool" title="Circle/Sphere">⭕</button>
    <button id="aoe-cone" class="btn btn-tool" title="Cone">📐</button>
    <button id="aoe-cube" class="btn btn-tool" title="Cube">⬜</button>
    <button id="aoe-line" class="btn btn-tool" title="Line">➖</button>
    <input type="color" id="aoe-color" value="#ff6600">
    <input type="number" id="aoe-size" value="20" min="5" max="120" step="5">
    <span>ft</span>
    <button id="aoe-clear-all" class="btn btn-danger btn-small">Clear All</button>
</div>
```

### 2. Drawing Logic

#### [MODIFY] [battlemap.js](file:///c:/Users/Jesse/Organize/Personal/jvdnd/js/battlemap.js)

```javascript
// Tool selection
setupAoeTools() {
    const tools = ['circle', 'cone', 'cube', 'line'];
    tools.forEach(tool => {
        document.getElementById(`aoe-${tool}`).addEventListener('click', () => {
            this.setAoeTool(tool);
        });
    });
    
    document.getElementById('aoe-clear-all').addEventListener('click', () => {
        this.state.aoeShapes = [];
        this.render();
        this.syncPlayerView();
    });
},

setAoeTool(tool) {
    // Toggle off if already selected
    this.state.activeAoeTool = this.state.activeAoeTool === tool ? null : tool;
    
    // Update UI to show active tool
    ['circle', 'cone', 'cube', 'line'].forEach(t => {
        document.getElementById(`aoe-${t}`).classList.toggle('active', t === this.state.activeAoeTool);
    });
    
    this.canvas.style.cursor = this.state.activeAoeTool ? 'crosshair' : 'default';
},

// Handle AOE placement
handleAoePlacement(e) {
    if (!this.state.activeAoeTool) return false;
    
    const coords = this.getGridCoords(e);
    const size = parseInt(document.getElementById('aoe-size').value);
    const color = document.getElementById('aoe-color').value + '66'; // Add alpha
    
    const shape = {
        id: Date.now().toString(36),
        type: this.state.activeAoeTool,
        x: coords.x,
        y: coords.y,
        size,
        rotation: 0,
        color,
        label: ''
    };
    
    // For cones/lines, need second click for rotation
    if (['cone', 'line'].includes(shape.type)) {
        this.state.aoePreview = shape;
        // Second click will finalize
    } else {
        this.state.aoeShapes.push(shape);
        this.render();
        this.syncPlayerView();
    }
    
    return true; // Consumed the click
},

// Render AOE shapes
renderAoeShapes() {
    const ctx = this.ctx;
    const scale = this.state.backgroundImage 
        ? this.canvas.width / this.state.backgroundImage.width 
        : 1;
    const gridSize = this.state.gridSize * scale;
    const ftToPixels = gridSize / 5; // 1 grid = 5ft
    
    this.state.aoeShapes.forEach(shape => {
        const centerX = (shape.x + 0.5) * gridSize;
        const centerY = (shape.y + 0.5) * gridSize;
        const sizePixels = shape.size * ftToPixels;
        
        ctx.fillStyle = shape.color;
        ctx.strokeStyle = shape.color.replace(/[\d.]+\)$/, '1)'); // Full opacity stroke
        ctx.lineWidth = 2 / this.state.zoom;
        
        switch (shape.type) {
            case 'circle':
                ctx.beginPath();
                ctx.arc(centerX, centerY, sizePixels / 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                break;
                
            case 'cube':
                ctx.fillRect(
                    centerX - sizePixels / 2,
                    centerY - sizePixels / 2,
                    sizePixels,
                    sizePixels
                );
                ctx.strokeRect(
                    centerX - sizePixels / 2,
                    centerY - sizePixels / 2,
                    sizePixels,
                    sizePixels
                );
                break;
                
            case 'cone':
                this.drawCone(ctx, centerX, centerY, sizePixels, shape.rotation);
                break;
                
            case 'line':
                this.drawLine(ctx, centerX, centerY, sizePixels, shape.rotation);
                break;
        }
    });
},

drawCone(ctx, x, y, length, rotation) {
    const angle = rotation * Math.PI / 180;
    const spread = Math.PI / 3; // 60 degree cone
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, length, angle - spread/2, angle + spread/2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
},

drawLine(ctx, x, y, length, rotation) {
    const angle = rotation * Math.PI / 180;
    const width = this.state.gridSize * 0.5; // 5ft wide
    
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillRect(0, -width/2, length, width);
    ctx.strokeRect(0, -width/2, length, width);
    ctx.restore();
}
```

### 3. Rotation Control for Cones/Lines

```javascript
// Mouse move handler for rotation preview
handleAoeRotation(e) {
    if (!this.state.aoePreview) return;
    
    const coords = this.getGridCoords(e);
    const dx = coords.x - this.state.aoePreview.x;
    const dy = coords.y - this.state.aoePreview.y;
    this.state.aoePreview.rotation = Math.atan2(dy, dx) * 180 / Math.PI;
    
    this.render();
},

// Finalize placement on second click
finalizeAoePlacement(e) {
    if (!this.state.aoePreview) return;
    
    this.state.aoeShapes.push(this.state.aoePreview);
    this.state.aoePreview = null;
    this.render();
    this.syncPlayerView();
}
```

---

## Player View Sync

#### [MODIFY] [battlemap.js](file:///c:/Users/Jesse/Organize/Personal/jvdnd/js/battlemap.js)

Update `syncPlayerView()` to include AOE shapes:

```javascript
syncPlayerView() {
    if (this.playerWindow && !this.playerWindow.closed) {
        this.playerWindow.postMessage({
            type: 'BATTLEMAP_SYNC',
            state: {
                // ... existing ...
                aoeShapes: this.state.aoeShapes  // NEW
            }
        }, '*');
    }
}
```

#### [MODIFY] [battlemap.html](file:///c:/Users/Jesse/Organize/Personal/jvdnd/battlemap.html)

Add AOE rendering in player view (same draw functions).

---

## CSS Styling

```css
.aoe-toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    background: var(--surface);
    border-radius: 4px;
    margin-bottom: 0.5rem;
}

.btn-tool {
    width: 36px;
    height: 36px;
    padding: 0;
    font-size: 1.2rem;
}

.btn-tool.active {
    background: var(--accent);
    box-shadow: 0 0 8px var(--accent);
}

#aoe-size {
    width: 60px;
}
```

---

## Verification Plan

1. Open battlemap, upload a map
2. Select circle tool, click on map → circle appears
3. Adjust size slider, place another → correct size
4. Select cone tool, click origin, move mouse → preview rotates
5. Click again → cone placed at angle
6. Right-click on shape → shape removed
7. Open player view → shapes visible there too
8. Click "Clear All" → all shapes removed
