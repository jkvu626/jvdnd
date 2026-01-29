# World Map & Battle Map Fixes (Spec 02)

## Overview
This document outlines critical fixes and missing UI features identified for the World Map and Battle Map modules.

## World Mode (Top Priority)

### 1. Location Management UI
- **Requirement**: No UI currently exists for adding, customizing, or removing locations.
- **Solution**: Implement a "DM Tools" panel in World Mode (visible only to GM) to:
    - Add new Location Pin (click to place).
    - Edit Location Details (Name, Type, Description, Linked Map).
    - Delete Location.

### 2. Party Movement UI
- **Requirement**: No UI for moving parties.
- **Solution**:
    - Allow dragging the Party Pin to a new location.
    - Implement a "Travel" command in the Location Sidebar (ensure it updates persistent state).

### 3. Character Management UI
- **Requirement**: No UI for creating, customizing, or deleting world characters (persistent NPCs/PCs).
- **Solution**:
    - Add a "Registry" or "Cast" management interface.
    - CRUD operations for `worldManager.data.characters`.

### 4. Navigation Controls
- **Requirement**: Middle-click and hold panning is missing.
- **Solution**: Update `WorldMapRenderer` to handle `mousedown` (button 1) for panning.

## Map Mode Fixes

### 1. HP Bar Display
- **Issue**: HP bars are reported as broken.
- **Fix**: formatting/rendering of HP bars in `BattleMap` needs debugging.

### 2. Explore Mode UI Adjustments
- **Requirement**: Minimize UI clutter in Explore Mode.
- **Changes**:
    - **Sidebar**: Toggle off (hide) the Left Sidebar (`.cc-left-sidebar`) entirely when switching to Explore Mode.
    - **Statblock**: Hide `<div id="active-statblock">` but ensure the Dice Roller remains visible in the Right Sidebar.
