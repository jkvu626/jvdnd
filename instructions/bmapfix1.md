# Battlemap Image & Token Bug Investigation

## Problem Summary
When uploading an image with different dimensions than the default grid, tokens fail to add correctly and pan/zoom functionality breaks completely.

## Root Cause Analysis

### 1. **Canvas Resize Changes Grid Coordinate System**

When an image is loaded, `resizeCanvas()` changes `canvas.width` and `canvas.height` based on the uploaded image dimensions:

```javascript
// Lines 191-196 in battlemap.js
if (this.state.backgroundImage) {
    const imgW = this.state.backgroundImage.width;
    const imgH = this.state.backgroundImage.height;
    const scale = Math.min(maxW / imgW, maxH / imgH, 1);
    this.canvas.width = imgW * scale;
    this.canvas.height = imgH * scale;
}
```

**Problem:** The pan values (`panX`, `panY`) are stored as **normalized coordinates** (0-1 range). When canvas dimensions change drastically:
```javascript
// Lines 209-210
ctx.translate(this.state.panX * this.canvas.width, this.state.panY * this.canvas.height);
ctx.scale(this.state.zoom, this.state.zoom);
```

If there was any pan offset from before the image load, this now translates to a completely different pixel offset, potentially pushing the entire canvas content off-screen.

### 2. **Pan/Zoom State Not Reset on Background Load**

When `loadBackground()` is called (line 170), it calls `resizeCanvas()` and `render()`, but **never resets the zoom/pan state**:
- `zoom` remains at whatever value it was
- `panX` and `panY` remain at whatever values they were

If the user had zoomed or panned the default canvas before uploading, those values persist and become invalid for the new canvas dimensions.

### 3. **Token Position Calculation Issue**

The uploaded image (castle fortress) is **nearly square** (~950×950 pixels based on the aspect ratio shown). The `addToken` function places tokens at grid positions `(0,0)` to `(19,19)`:

```javascript
// Lines 364-373
for (let y = 0; y < 20 && !placed; y++) {
    for (let x = 0; x < 20 && !placed; x++) {
        if (!this.getTokenAt(x, y)) {
            token.x = x;
            token.y = y;
            placed = true;
        }
    }
}
```

The token IS being added to `this.state.tokens`, but when rendered, the grid scaling makes the token appear off-canvas or the transform pushes it out of view due to the corrupt pan/zoom state.

### 4. **Transform Order + Corrupt State = Visual Glitches**

The render uses this transform order:
1. Clear canvas
2. `ctx.save()`
3. `ctx.translate(panX * width, panY * height)`
4. `ctx.scale(zoom, zoom)`
5. Draw everything
6. `ctx.restore()`

If `panX`/`panY` are corrupted (non-zero from previous state), the entire drawing is shifted. Combined with zoom, this can result in:
- Blank canvas (content translated entirely off-screen)
- Glitchy appearance when panning (trying to pan already-broken state)
- Tokens drawn but not visible (off-canvas)

---

## Proposed Fix

Reset pan/zoom state when loading a new background image:

#### [MODIFY] [battlemap.js](file:///c:/Users/Jesse/Organize/Personal/jvdnd/js/battlemap.js)

In `loadBackground()`, reset the transform state after loading the image:

```diff
 img.onload = () => {
     this.state.backgroundImage = img;
+    // Reset pan/zoom to prevent corrupt state from old canvas dimensions
+    this.state.zoom = 1;
+    this.state.panX = 0;
+    this.state.panY = 0;
     this.resizeCanvas();
     this.render();
     this.syncPlayerView();
 };
```

Similarly, when clearing the background (`btn-clear-bg` handler), reset the state as well for consistency.

---

## Verification Plan

### Manual Testing

1. Start the dev server (`npm start`)
2. Open the battlemap page
3. **Test sequence:**
   - Pan and zoom the empty canvas first (Ctrl+drag, scroll wheel)
   - Upload the attached castle map image
   - Verify:
     - [ ] Image displays correctly (not shifted off-canvas)
     - [ ] Grid overlays the image properly
     - [ ] Pan/zoom work smoothly after image load
   - Add a token with a name
   - Verify:
     - [ ] Token appears on the canvas (at grid position 0,0)
     - [ ] Token renders on top of the image
     - [ ] Token can be selected and moved
   - Open player view and verify it syncs correctly
