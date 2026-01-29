# Ruler Tool Implementation

## Overview

Implement a click-and-drag ruler tool to measure distances on the battlemap using D&D 5e variant rules (5-10-5 diagonals).

## Requirements

1.  **Interaction**: Click and drag to measure.
2.  **Visuals**: Red line (`#9B2C2C`, `var(--danger)`), dashed or solid, with distance text centered.
3.  **Calculation**: 5e Variant (Diagonals alternate 5ft/10ft).
4.  **Behavior**: Snaps to grid center-to-center. Disappears on release.
5.  **UI**: Add a measurement tool button to the map controls.

---

## UI Changes

### [MODIFY] [index.html](file:///c:/Users/Jesse/Organize/Personal/jvdnd/index.html)

Add a new button to the `map-controls` section (near AOE tools).

```html
<div class="map-controls">
    <h3>Tools</h3>
    <div class="tool-row">
        <button id="btn-tool-select" class="btn-tool active" title="Select/Move">👆</button>
        <button id="btn-tool-ruler" class="btn-tool" title="Ruler">📏</button>
    </div>
</div>
```

---

## Logic Changes

### [MODIFY] [js/battlemap.js](file:///c:/Users/Jesse/Organize/Personal/jvdnd/js/battlemap.js)

1.  **State**:
    ```javascript
    activeTool: 'select', // 'select', 'ruler', 'aoe-circle', etc.
    measurement: null, // { start: {x, y}, end: {x, y}, distance: 0 }
    ```

2.  **Event Listeners**:
    Update `setupEventListeners` or `setupMapTools`.
    - `btn-tool-ruler`: Sets `activeTool = 'ruler'`.
    - `btn-tool-select`: Sets `activeTool = 'select'`.

3.  **Mouse Events** (`mousedown`, `mousemove`, `mouseup`):
    - **MouseDown**:
        - If `activeTool === 'ruler'`: Start measurement. `start = getGridCenter(mousePos)`.
    - **MouseMove**:
        - If `measuring`: Update `end = getGridCenter(mousePos)`. Calculate distance. Render.
    - **MouseUp**:
        - If `measuring`: Clear `measurement`. Render.

4.  **Calculation (5e Variant)**:
    ```javascript
    calculateDistance(start, end) {
        const dx = Math.abs(end.x - start.x);
        const dy = Math.abs(end.y - start.y);
        const diagonalSteps = Math.min(dx, dy);
        const straightSteps = Math.max(dx, dy) - diagonalSteps;

        // 5e Rule: Diagonals count as 5, then 10, then 5...
        // Formula: diagonals * 5 + floor(diagonals / 2) * 5
        const diagonalDistance = (diagonalSteps * 5) + (Math.floor(diagonalSteps / 2) * 5);
        const straightDistance = straightSteps * 5;

        return diagonalDistance + straightDistance;
    }
    ```

5.  **Rendering**:
    - Draw line from `start` center to `end` center.
    - Style: `strokeStyle = '#9B2C2C'`, `lineWidth = 3`, `setLineDash([10, 5])`.
    - Draw text: Background pill (like roll popups) centered on line. Text: `XX ft.`.

---

## Verification Plan

### Manual Verification
1.  **Activate Tool**: Click ruler button. Cursor should change.
2.  **Measure Straight**: Drag horizontally 2 squares. Should say "10 ft.".
3.  **Measure Diagonal**:
    - 1 square: "5 ft."
    - 2 squares: "15 ft." (5+10)
    - 3 squares: "20 ft." (5+10+5)
4.  **Snap**: Ensure line starts/ends exactly in center of grid squares.
5.  **Release**: Line disappears.
