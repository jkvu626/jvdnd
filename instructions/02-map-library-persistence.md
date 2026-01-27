# Map Library & Persistence

## Overview

Create a server-side storage system for map images with a UI to browse, select, and manage saved maps. Additionally, implement auto-save for the active map state to prevent data loss on page refresh.

---

## Current State

- Maps are stored as inline Base64 data URLs in `Battlemap.state.background`
- No persistence between page refreshes
- No way to reuse maps across encounters
- All state is lost when the browser tab closes

---

## Proposed Architecture

```
/data
  /maps
    /images           # Original uploaded images
      abc123.webp
      def456.webp
    maps.json         # Map metadata registry
  state.json          # Existing app state
```

### Map Metadata Schema (`maps.json`)

```javascript
[
    {
        id: "abc123",               // Unique identifier
        name: "Forest Clearing",    // User-provided name
        filename: "abc123.webp",    // Stored file reference
        width: 2048,                // Original dimensions
        height: 1536,
        createdAt: "2026-01-22T10:00:00Z",
        lastUsed: "2026-01-22T12:30:00Z",
        thumbnail: "data:image/webp;base64,..."  // Small preview (optional)
    }
]
```

---

## Server Implementation

### Phase 1: Map Upload & Storage

#### [MODIFY] [server.js](file:///c:/Users/Jesse/Organize/Personal/jvdnd/server.js)

Add required dependencies and setup:

```javascript
const multer = require('multer');
const sharp = require('sharp');
const crypto = require('crypto');

const MAPS_DIR = path.join(__dirname, 'data', 'maps', 'images');
const MAPS_FILE = path.join(__dirname, 'data', 'maps.json');

// Ensure maps directory exists
if (!fs.existsSync(MAPS_DIR)) {
    fs.mkdirSync(MAPS_DIR, { recursive: true });
}

// Initialize empty maps registry if doesn't exist
if (!fs.existsSync(MAPS_FILE)) {
    fs.writeFileSync(MAPS_FILE, JSON.stringify([], null, 2));
}

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        cb(null, allowed.includes(file.mimetype));
    }
});
```

Add map management endpoints:

```javascript
// ============ Map Library ============

function readMaps() {
    try {
        return JSON.parse(fs.readFileSync(MAPS_FILE, 'utf8'));
    } catch (e) {
        return [];
    }
}

function writeMaps(maps) {
    fs.writeFileSync(MAPS_FILE, JSON.stringify(maps, null, 2));
}

// GET all maps (metadata only)
app.get('/api/maps', (req, res) => {
    const maps = readMaps();
    res.json(maps);
});

// GET single map image
app.get('/api/maps/:id/image', (req, res) => {
    const maps = readMaps();
    const map = maps.find(m => m.id === req.params.id);
    
    if (!map) {
        return res.status(404).json({ error: 'Map not found' });
    }
    
    const imagePath = path.join(MAPS_DIR, map.filename);
    if (!fs.existsSync(imagePath)) {
        return res.status(404).json({ error: 'Image file not found' });
    }
    
    res.sendFile(imagePath);
});

// POST upload new map
app.post('/api/maps', upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
    }
    
    try {
        const id = crypto.randomBytes(8).toString('hex');
        const filename = `${id}.webp`;
        const imagePath = path.join(MAPS_DIR, filename);
        
        // Process and optimize image with Sharp
        const image = sharp(req.file.buffer);
        const metadata = await image.metadata();
        
        // Resize if too large (max 4096px on longest side)
        let processed = image;
        if (metadata.width > 4096 || metadata.height > 4096) {
            processed = image.resize(4096, 4096, {
                fit: 'inside',
                withoutEnlargement: true
            });
        }
        
        // Convert to WebP for optimal storage
        await processed
            .webp({ quality: 85 })
            .toFile(imagePath);
        
        // Get final dimensions
        const finalMeta = await sharp(imagePath).metadata();
        
        // Generate thumbnail
        const thumbnailBuffer = await sharp(imagePath)
            .resize(200, 200, { fit: 'cover' })
            .webp({ quality: 60 })
            .toBuffer();
        const thumbnail = `data:image/webp;base64,${thumbnailBuffer.toString('base64')}`;
        
        // Save metadata
        const maps = readMaps();
        const newMap = {
            id,
            name: req.body.name || 'Untitled Map',
            filename,
            width: finalMeta.width,
            height: finalMeta.height,
            createdAt: new Date().toISOString(),
            lastUsed: new Date().toISOString(),
            thumbnail
        };
        maps.push(newMap);
        writeMaps(maps);
        
        res.json({ success: true, map: newMap });
    } catch (error) {
        console.error('Map upload failed:', error);
        res.status(500).json({ error: 'Failed to process image' });
    }
});

// PUT update map metadata
app.put('/api/maps/:id', (req, res) => {
    const maps = readMaps();
    const idx = maps.findIndex(m => m.id === req.params.id);
    
    if (idx === -1) {
        return res.status(404).json({ error: 'Map not found' });
    }
    
    // Only allow updating name and lastUsed
    if (req.body.name) maps[idx].name = req.body.name;
    maps[idx].lastUsed = new Date().toISOString();
    
    writeMaps(maps);
    res.json({ success: true, map: maps[idx] });
});

// DELETE map
app.delete('/api/maps/:id', (req, res) => {
    let maps = readMaps();
    const map = maps.find(m => m.id === req.params.id);
    
    if (!map) {
        return res.status(404).json({ error: 'Map not found' });
    }
    
    // Delete image file
    const imagePath = path.join(MAPS_DIR, map.filename);
    if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
    }
    
    // Remove from registry
    maps = maps.filter(m => m.id !== req.params.id);
    writeMaps(maps);
    
    res.json({ success: true });
});
```

### Phase 2: Active Map State Persistence

#### [MODIFY] [server.js](file:///c:/Users/Jesse/Organize/Personal/jvdnd/server.js)

Add endpoint for battlemap state:

```javascript
const BATTLEMAP_STATE_FILE = path.join(__dirname, 'data', 'battlemap-state.json');

// GET current battlemap state
app.get('/api/battlemap-state', (req, res) => {
    try {
        if (fs.existsSync(BATTLEMAP_STATE_FILE)) {
            const state = JSON.parse(fs.readFileSync(BATTLEMAP_STATE_FILE, 'utf8'));
            res.json(state);
        } else {
            res.json(null);
        }
    } catch (e) {
        res.json(null);
    }
});

// PUT save battlemap state (auto-save)
app.put('/api/battlemap-state', (req, res) => {
    try {
        // Don't save the full background image - just the mapId reference
        const stateToSave = {
            mapId: req.body.mapId || null,
            gridSize: req.body.gridSize,
            showGrid: req.body.showGrid,
            tokens: req.body.tokens,
            zoom: req.body.zoom,
            panX: req.body.panX,
            panY: req.body.panY,
            savedAt: new Date().toISOString()
        };
        fs.writeFileSync(BATTLEMAP_STATE_FILE, JSON.stringify(stateToSave, null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save state' });
    }
});
```

---

## Client Implementation

### Phase 1: API Client

#### [MODIFY] [api.js](file:///c:/Users/Jesse/Organize/Personal/jvdnd/js/api.js)

Add map API methods:

```javascript
// ============ Map Library API ============

async getMaps() {
    const res = await fetch('/api/maps');
    return res.ok ? res.json() : [];
},

async getMapImageUrl(mapId) {
    return `/api/maps/${mapId}/image`;
},

async uploadMap(file, name) {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('name', name || 'Untitled Map');
    
    const res = await fetch('/api/maps', {
        method: 'POST',
        body: formData
    });
    return res.ok ? res.json() : null;
},

async updateMap(mapId, updates) {
    const res = await fetch(`/api/maps/${mapId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
    });
    return res.ok;
},

async deleteMap(mapId) {
    const res = await fetch(`/api/maps/${mapId}`, { method: 'DELETE' });
    return res.ok;
},

// Battlemap state persistence
async loadBattlemapState() {
    const res = await fetch('/api/battlemap-state');
    return res.ok ? res.json() : null;
},

async saveBattlemapState(state) {
    const res = await fetch('/api/battlemap-state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state)
    });
    return res.ok;
}
```

### Phase 2: Map Library UI

#### [MODIFY] [index.html](file:///c:/Users/Jesse/Organize/Personal/jvdnd/index.html)

Add Map Library modal:

```html
<!-- Map Library Modal -->
<div id="map-library-modal" class="modal hidden">
    <div class="modal-content modal-large">
        <h2>Map Library</h2>
        <div class="library-header">
            <input type="text" id="map-search" placeholder="Search maps...">
            <button id="btn-upload-to-library" class="btn btn-primary">Upload New Map</button>
            <input type="file" id="map-library-upload" accept="image/*" class="hidden">
        </div>
        <div id="map-library-grid" class="map-grid">
            <p id="map-library-empty" class="empty-state">No maps yet. Upload your first map!</p>
            <!-- Map cards populated dynamically -->
        </div>
        <div class="modal-actions">
            <button id="btn-close-library" class="btn btn-secondary">Close</button>
        </div>
    </div>
</div>
```

Add Map Library button to battlemap sidebar (in `#map-mode .map-sidebar`, after the Background controls section):

```html
<!-- Add after the Background .map-controls div, before the Grid controls -->
<div class="map-controls">
    <h3>Library</h3>
    <button id="btn-open-library" class="btn-secondary">Open Map Library</button>
</div>
```

#### [NEW] CSS for Map Library

```css
/* Map Library */
.modal-large {
    max-width: 900px;
    max-height: 80vh;
}

.library-header {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
}

.library-header input {
    flex: 1;
}

.map-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 1rem;
    max-height: 50vh;
    overflow-y: auto;
    padding: 0.5rem;
}

.map-card {
    background: var(--bg-tertiary);
    border: 2px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.2s;
}

.map-card:hover {
    border-color: var(--accent);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

.map-card img {
    width: 100%;
    height: 120px;
    object-fit: cover;
}

.map-card-info {
    padding: 0.5rem;
}

.map-card-name {
    font-weight: bold;
    font-size: 0.9rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.map-card-meta {
    font-size: 0.75rem;
    color: var(--text-secondary);
}

.map-card-actions {
    display: flex;
    gap: 0.5rem;
    padding: 0 0.5rem 0.5rem;
}

.map-card-actions button {
    flex: 1;
    padding: 0.25rem;
    font-size: 0.75rem;
}

/* Loading state for map grid - reuse existing .loading-state from styles.css */
.map-grid .loading-state,
.map-grid .error-state {
    grid-column: 1 / -1;
    text-align: center;
    padding: 2rem;
}

/* Ensure empty state in map grid spans full width */
.map-grid .empty-state {
    grid-column: 1 / -1;
}
```

### Phase 3: Battlemap Integration

#### [MODIFY] [battlemap.js](file:///c:/Users/Jesse/Organize/Personal/jvdnd/js/battlemap.js)

Add library integration and auto-save:

```javascript
const Battlemap = {
    // ... existing code ...
    
    state: {
        // ... existing properties ...
        currentMapId: null,     // NEW: Reference to library map
        autoSaveTimer: null     // NEW: Debounce timer
    },

    async init() {
        // ... existing init code ...
        
        // Restore saved state on init
        await this.restoreState();
    },

    async restoreState() {
        const saved = await API.loadBattlemapState();
        if (!saved) return;
        
        // Restore map from library if referenced
        if (saved.mapId) {
            await this.loadFromLibrary(saved.mapId);
        }
        
        // Restore other state
        this.state.gridSize = saved.gridSize ?? 50;
        this.state.showGrid = saved.showGrid ?? true;
        this.state.tokens = saved.tokens || [];
        this.state.zoom = saved.zoom ?? 1;
        this.state.panX = saved.panX ?? 0;
        this.state.panY = saved.panY ?? 0;
        
        // Update UI controls
        document.getElementById('grid-size').value = this.state.gridSize;
        document.getElementById('grid-size-display').textContent = this.state.gridSize;
        document.getElementById('grid-toggle').checked = this.state.showGrid;
        
        this.render();
        this.renderTokenList();
    },

    async loadFromLibrary(mapId) {
        const url = await API.getMapImageUrl(mapId);
        const img = new Image();

        return new Promise((resolve, reject) => {
            img.onload = async () => {
                this.state.currentMapId = mapId;
                this.state.backgroundImage = img;

                // Convert to Base64 for player view compatibility
                // Player view runs in separate window and can't access relative URLs
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                this.state.background = canvas.toDataURL('image/webp', 0.85);

                this.state.zoom = 1;
                this.state.panX = 0;
                this.state.panY = 0;

                this.resizeCanvas();
                this.render();
                this.syncPlayerView();
                this.scheduleAutoSave();

                // Update lastUsed on server
                API.updateMap(mapId, { lastUsed: new Date().toISOString() });

                resolve();
            };
            img.onerror = reject;
            img.src = url;
        });
    },

    scheduleAutoSave() {
        // Debounce auto-save to avoid excessive writes
        if (this.state.autoSaveTimer) {
            clearTimeout(this.state.autoSaveTimer);
        }
        
        this.state.autoSaveTimer = setTimeout(() => {
            this.saveState();
        }, 2000);  // Save 2 seconds after last change
    },

    async saveState() {
        await API.saveBattlemapState({
            mapId: this.state.currentMapId,
            gridSize: this.state.gridSize,
            showGrid: this.state.showGrid,
            tokens: this.state.tokens,
            zoom: this.state.zoom,
            panX: this.state.panX,
            panY: this.state.panY
        });
    },

    // Modify existing methods to trigger auto-save
    // Add this.scheduleAutoSave() to:
    // - loadBackground() after setting state
    // - addToken()
    // - removeToken()
    // - handleCanvasClick() after moving token
    // - grid size change handler
    // - grid toggle handler
};
```

### Phase 4: Map Library UI Handlers

#### [MODIFY] [app.js](file:///c:/Users/Jesse/Organize/Personal/jvdnd/js/app.js)

Add Map Library UI bindings and handlers:

```javascript
// Add to bindEvents() method:

// Map Library Modal
UI.elements.btnOpenLibrary = document.getElementById('btn-open-library');
UI.elements.mapLibraryModal = document.getElementById('map-library-modal');
UI.elements.mapLibraryGrid = document.getElementById('map-library-grid');
UI.elements.mapLibraryEmpty = document.getElementById('map-library-empty');
UI.elements.mapSearch = document.getElementById('map-search');
UI.elements.btnUploadToLibrary = document.getElementById('btn-upload-to-library');
UI.elements.mapLibraryUpload = document.getElementById('map-library-upload');
UI.elements.btnCloseLibrary = document.getElementById('btn-close-library');

UI.elements.btnOpenLibrary.addEventListener('click', () => this.openMapLibrary());
UI.elements.btnCloseLibrary.addEventListener('click', () => this.closeMapLibrary());
UI.elements.btnUploadToLibrary.addEventListener('click', () => UI.elements.mapLibraryUpload.click());
UI.elements.mapLibraryUpload.addEventListener('change', (e) => this.uploadToLibrary(e));
UI.elements.mapSearch.addEventListener('input', (e) => this.filterMapLibrary(e.target.value));
UI.elements.mapLibraryGrid.addEventListener('click', (e) => this.onMapCardClick(e));

// Modal keyboard handlers (add to existing keydown listener)
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // ... existing modal closes ...
        this.closeMapLibrary();
    }
});

// Modal backdrop click to close
UI.elements.mapLibraryModal.addEventListener('click', (e) => {
    if (e.target === UI.elements.mapLibraryModal) {
        this.closeMapLibrary();
    }
});
```

Add Map Library methods to App object:

```javascript
// ============ Map Library Methods ============

async openMapLibrary() {
    UI.elements.mapLibraryModal.classList.remove('hidden');
    UI.elements.mapSearch.value = '';
    await this.loadMapLibrary();
},

closeMapLibrary() {
    UI.elements.mapLibraryModal.classList.add('hidden');
},

async loadMapLibrary() {
    // Show loading state
    UI.elements.mapLibraryGrid.innerHTML = '<p class="loading-state">Loading maps...</p>';
    UI.elements.mapLibraryEmpty.classList.add('hidden');

    try {
        const maps = await API.getMaps();
        this.renderMapLibrary(maps);
    } catch (error) {
        UI.elements.mapLibraryGrid.innerHTML = '<p class="error-state">Failed to load maps</p>';
    }
},

renderMapLibrary(maps) {
    if (!maps || maps.length === 0) {
        UI.elements.mapLibraryGrid.innerHTML = '';
        UI.elements.mapLibraryEmpty.classList.remove('hidden');
        return;
    }

    UI.elements.mapLibraryEmpty.classList.add('hidden');
    UI.elements.mapLibraryGrid.innerHTML = maps.map(map => `
        <div class="map-card" data-id="${map.id}">
            <img src="${map.thumbnail}" alt="${map.name}">
            <div class="map-card-info">
                <div class="map-card-name">${map.name}</div>
                <div class="map-card-meta">${map.width}x${map.height}</div>
            </div>
            <div class="map-card-actions">
                <button class="btn-small btn-load-map">Load</button>
                <button class="btn-small btn-danger btn-delete-map">Delete</button>
            </div>
        </div>
    `).join('');

    // Store maps for filtering
    this._libraryMaps = maps;
},

filterMapLibrary(query) {
    if (!this._libraryMaps) return;

    const filtered = query.trim()
        ? this._libraryMaps.filter(m =>
            m.name.toLowerCase().includes(query.toLowerCase()))
        : this._libraryMaps;

    this.renderMapLibrary(filtered);
},

async onMapCardClick(e) {
    const card = e.target.closest('.map-card');
    if (!card) return;

    const mapId = card.dataset.id;

    if (e.target.classList.contains('btn-load-map')) {
        await this.loadMapFromLibrary(mapId);
    } else if (e.target.classList.contains('btn-delete-map')) {
        await this.deleteMapFromLibrary(mapId);
    }
},

async loadMapFromLibrary(mapId) {
    // Show loading on the card
    const card = document.querySelector(`.map-card[data-id="${mapId}"]`);
    const loadBtn = card?.querySelector('.btn-load-map');
    if (loadBtn) {
        loadBtn.disabled = true;
        loadBtn.textContent = 'Loading...';
    }

    try {
        if (!Battlemap.canvas) Battlemap.init();
        await Battlemap.loadFromLibrary(mapId);
        this.closeMapLibrary();
    } catch (error) {
        alert('Failed to load map: ' + error.message);
    } finally {
        if (loadBtn) {
            loadBtn.disabled = false;
            loadBtn.textContent = 'Load';
        }
    }
},

async deleteMapFromLibrary(mapId) {
    // Confirmation dialog
    const map = this._libraryMaps?.find(m => m.id === mapId);
    const name = map?.name || 'this map';
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

    try {
        const success = await API.deleteMap(mapId);
        if (success) {
            await this.loadMapLibrary();
        } else {
            alert('Failed to delete map');
        }
    } catch (error) {
        alert('Failed to delete map: ' + error.message);
    }
},

async uploadToLibrary(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Prompt for map name
    const name = prompt('Enter a name for this map:', file.name.replace(/\.[^/.]+$/, ''));
    if (name === null) return; // Cancelled

    // Show upload progress
    const uploadBtn = UI.elements.btnUploadToLibrary;
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Uploading...';

    try {
        const result = await API.uploadMap(file, name || 'Untitled Map');
        if (result?.success) {
            await this.loadMapLibrary();
        } else {
            alert('Failed to upload map');
        }
    } catch (error) {
        alert('Failed to upload map: ' + error.message);
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload New Map';
        e.target.value = ''; // Reset file input
    }
}
```

#### [MODIFY] [app.js](file:///c:/Users/Jesse/Organize/Personal/jvdnd/js/app.js) - Make init async-safe

Update the switchMode function to await Battlemap initialization:

```javascript
async switchMode(mode) {
    UI.showMode(mode);
    if (mode === 'run' && State.getActiveCombat()) this.renderCombat();
    if (mode === 'map') {
        if (!Battlemap.canvas) await Battlemap.init();
        // Always resize and render when switching to map mode
        Battlemap.resizeCanvas();
        Battlemap.render();
        Battlemap.renderTokenList();
    }
}
```

#### [MODIFY] [index.html](file:///c:/Users/Jesse/Organize/Personal/jvdnd/index.html)

Add hidden file input for library uploads and library button to battlemap sidebar:

```html
<!-- Add inside Map Library Modal, after btn-upload-to-library -->
<input type="file" id="map-library-upload" accept="image/*" class="hidden">

<!-- Add to map-sidebar, after the Background controls section -->
<div class="map-controls">
    <h3>Library</h3>
    <button id="btn-open-library" class="btn-secondary">Open Map Library</button>
</div>
```

---

## Verification Plan

### Automated Testing

No existing unit tests found. Manual verification required.

### Manual Testing

1. **Map Upload**
   - [ ] Start server: `npm start`
   - [ ] Open Map mode, click "Map Library"
   - [ ] Click "Upload New Map", select an image
   - [ ] Verify: Image appears in library grid with thumbnail
   - [ ] Verify: `data/maps/images/` contains the WebP file

2. **Map Selection**
   - [ ] Click a map in the library
   - [ ] Verify: Modal closes, map loads on canvas
   - [ ] Verify: Grid overlays correctly

3. **Auto-Save Persistence**
   - [ ] Load a map, add tokens, adjust grid size
   - [ ] Refresh the page
   - [ ] Verify: Map reloads automatically
   - [ ] Verify: Tokens and grid settings preserved

4. **Map Deletion**
   - [ ] Open library, click delete on a map
   - [ ] Verify: Confirm dialog appears
   - [ ] Verify: Map removed from grid
   - [ ] Verify: Image file deleted from disk

---

## Dependencies

Add to `package.json`:

```json
{
    "dependencies": {
        "multer": "^1.4.5-lts.1",
        "sharp": "^0.33.0"
    }
}
```

Install with: `npm install multer sharp`

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Server restarts mid-upload | Multer uses memory storage, file not saved |
| Corrupt image file | Sharp throws error, return 400 |
| Referenced map deleted | Show error toast, clear battlemap |
| Disk full | Catch ENOSPC, return 500 with clear message |
