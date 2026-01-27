# Fog of War

## Overview

Implement a masking layer that hides portions of the map from the player view. The DM can reveal areas as players explore.

---

## Requirements

1. **DM View**: Shows full map with fog overlay (semi-transparent)
2. **Player View**: Shows only revealed areas, fog is opaque black
3. **Reveal Tool**: Brush to paint revealed areas
4. **Hide Tool**: Brush to repaint fog
5. **Persistence**: Fog state saves with map

---

## State Changes

#### [MODIFY] [battlemap.js](file:///c:/Users/Jesse/Organize/Personal/jvdnd/js/battlemap.js)

```javascript
state: {
    // ... existing ...
    fogEnabled: false,
    fogData: null,        // ImageData for fog mask
    fogTool: null,        // 'reveal' | 'hide' | null
    fogBrushSize: 2,      // Grid squares
    isDrawingFog: false
}
```

---

## Implementation

### 1. Fog Canvas Layer

Create an offscreen canvas for fog:

```javascript
initFog() {
    // Create offscreen canvas matching main canvas size
    this.fogCanvas = document.createElement('canvas');
    this.fogCtx = this.fogCanvas.getContext('2d');
    this.resizeFogCanvas();
},

resizeFogCanvas() {
    this.fogCanvas.width = this.canvas.width;
    this.fogCanvas.height = this.canvas.height;
    
    // Initialize with full fog (black)
    this.fogCtx.fillStyle = '#000';
    this.fogCtx.fillRect(0, 0, this.fogCanvas.width, this.fogCanvas.height);
}
```

### 2. Reveal/Hide Brushes

```javascript
handleFogDraw(e, isRevealing) {
    if (!this.state.fogEnabled) return;
    
    const coords = this.getCanvasCoords(e);
    const gridSize = this.getScaledGridSize();
    const brushRadius = this.state.fogBrushSize * gridSize / 2;
    
    this.fogCtx.globalCompositeOperation = isRevealing 
        ? 'destination-out'  // Erase fog
        : 'source-over';     // Draw fog
    
    this.fogCtx.beginPath();
    this.fogCtx.arc(coords.x, coords.y, brushRadius, 0, Math.PI * 2);
    this.fogCtx.fill();
    
    this.render();
    this.syncPlayerView();
}
```

### 3. Render Fog Layer

```javascript
renderFog(forPlayer = false) {
    if (!this.state.fogEnabled) return;
    
    const ctx = this.ctx;
    
    if (forPlayer) {
        // Player view: fog is fully opaque
        ctx.drawImage(this.fogCanvas, 0, 0);
    } else {
        // DM view: fog is semi-transparent
        ctx.globalAlpha = 0.5;
        ctx.drawImage(this.fogCanvas, 0, 0);
        ctx.globalAlpha = 1.0;
    }
}
```

### 4. UI Controls

```html
<div class="fog-controls">
    <label>
        <input type="checkbox" id="fog-toggle"> Enable Fog of War
    </label>
    <button id="fog-reveal" class="btn btn-tool">👁️ Reveal</button>
    <button id="fog-hide" class="btn btn-tool">🌫️ Hide</button>
    <input type="range" id="fog-brush" min="1" max="10" value="2">
    <button id="fog-reveal-all" class="btn">Reveal All</button>
    <button id="fog-hide-all" class="btn">Hide All</button>
</div>
```

### 5. Player View Sync

Convert fog canvas to transferable data:

```javascript
syncPlayerView() {
    let fogDataUrl = null;
    if (this.state.fogEnabled) {
        fogDataUrl = this.fogCanvas.toDataURL('image/png');
    }
    
    this.playerWindow.postMessage({
        type: 'BATTLEMAP_SYNC',
        state: {
            // ... existing ...
            fogEnabled: this.state.fogEnabled,
            fogData: fogDataUrl
        }
    }, '*');
}
```

### 6. Player View Handler

#### [MODIFY] [battlemap.html](file:///c:/Users/Jesse/Organize/Personal/jvdnd/battlemap.html)

```javascript
function renderFog() {
    if (!state.fogEnabled || !state.fogData) return;
    
    const fogImg = new Image();
    fogImg.onload = () => {
        ctx.drawImage(fogImg, 0, 0);
    };
    fogImg.src = state.fogData;
}
```

---

## Persistence

Store fog as Base64 PNG with map state:

```javascript
// In map config
mapConfig: {
    // ... existing ...
    fogData: 'data:image/png;base64,...'
}
```

---

## Verification

1. Enable fog toggle → map covered in black
2. Select reveal tool, paint → areas become visible
3. Open player view → only revealed areas visible
4. Select hide tool, paint → fog returns
5. Click "Reveal All" → entire map visible
6. Save map to encounter → reload → fog state preserved
