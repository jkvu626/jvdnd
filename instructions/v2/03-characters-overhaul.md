# Characters System Overhaul

> **Spec Version:** 1.0  
> **Status:** Planning  
> **Dependencies:** World Map Phase 1 (worldState.js, world.json)

---

## Overview

Expand the character management system to support multiple entity types with rich data models, a 3-column UI layout, search functionality, and file-based portrait uploads.

### Entity Types

| Type | Description | Data Focus |
|------|-------------|------------|
| **Player** | Party PCs (lite sheet) | Class, level, race, HP, inventory, notes |
| **Sidekick** | Tasha's sidekick rules (e.g., Ireena) | Base creature + sidekick class + level |
| **NPC** | Story characters | Notes, motivation, secrets, relationships |
| **Monster** | *(Existing system)* | Full statblock from bestiary |

### Design Decisions

| Topic | Decision |
|-------|----------|
| Inventory | Flat list (name, qty, optional note) |
| NPC statblocks | Pull from bestiary via slug or custom monster |
| Relationships | Simple text |
| Sidekick leveling | Manual level input |
| Portraits | File upload |

---

# Phase 1: Extended Character Schema

## Goal
Extend the character data model in `WorldManager` and `world.json` to support all entity types.

## 1.1 Updated Character Schema

```javascript
// Base fields (all types)
{
  "id": "string",
  "type": "player" | "sidekick" | "npc",
  "name": "string",
  "portrait": "string",           // Path to uploaded image
  "location": "party" | locationId | null,
  
  // Stats (optional for NPCs)
  "stats": {
    "hp": number,
    "maxHp": number,
    "ac": number
  } | null,
  
  // NEW: Player-specific
  "class": "string",              // e.g., "Fighter 5 / Rogue 2"
  "level": number,
  "race": "string",
  "inventory": [
    { "name": "string", "qty": number, "note": "string?" }
  ],
  "notes": "string",
  
  // NEW: NPC-specific
  "story": {
    "description": "string",
    "motivation": "string",
    "secrets": "string",
    "relationships": "string"
  } | null,
  "statblockSlug": "string" | null,  // Pull from bestiary
  
  // NEW: Sidekick-specific
  "sidekick": {
    "baseCreature": "string",     // e.g., "Noble"
    "class": "Expert" | "Spellcaster" | "Warrior",
    "level": number
  } | null
}
```

## 1.2 WorldManager Updates

Add to `js/worldState.js`:

```javascript
// Search characters by name, type, class, or race
searchCharacters(query) {
    if (!this.data || !query) return this.data?.characters || [];
    const q = query.toLowerCase();
    return this.data.characters.filter(c => 
        c.name.toLowerCase().includes(q) ||
        c.type.toLowerCase().includes(q) ||
        (c.class && c.class.toLowerCase().includes(q)) ||
        (c.race && c.race.toLowerCase().includes(q))
    );
}

// Get all characters (including those with invalid locations)
getAllCharacters() {
    return this.data?.characters || [];
}

// Update addCharacter to support new fields
addCharacter(character) {
    const newChar = {
        id: character.id || `char_${Date.now()}`,
        type: character.type || 'npc',
        name: character.name || 'Unknown',
        portrait: character.portrait || '',
        location: character.location ?? null,
        stats: character.stats || null,
        // Player fields
        class: character.class || null,
        level: character.level || null,
        race: character.race || null,
        inventory: character.inventory || [],
        notes: character.notes || '',
        // NPC fields
        story: character.story || null,
        statblockSlug: character.statblockSlug || null,
        // Sidekick fields
        sidekick: character.sidekick || null
    };
    this.data.characters.push(newChar);
    this.save();
    return newChar;
}
```

## 1.3 Migration

Characters with deleted locations should NOT be deleted. Add validation:

```javascript
// Get location name safely (handles deleted locations)
getLocationName(locationId) {
    if (locationId === 'party') return 'Party';
    if (!locationId) return 'Unassigned';
    const loc = this.getLocation(locationId);
    return loc ? loc.name : 'Unassigned';
}
```

---

# Phase 2: UI Layout Restructure

## Goal
Replace current Characters tab with 3-column layout: left sidebar (add form), center (searchable list), right sidebar (detail panel).

## 2.1 HTML Structure

Update `index.html` Characters tab content:

```html
<div id="party-mode" class="mode-content">
  <div class="characters-layout">
    <!-- Left Sidebar: Add Character -->
    <aside class="characters-sidebar-left">
      <div class="add-character-widget">
        <h3>Add Character</h3>
        <div class="form-group">
          <label>Name</label>
          <input type="text" id="char-name" placeholder="Character name">
        </div>
        <div class="form-group">
          <label>Type</label>
          <select id="char-type">
            <option value="player">Player</option>
            <option value="sidekick">Sidekick</option>
            <option value="npc">NPC</option>
          </select>
        </div>
        <!-- Dynamic fields based on type -->
        <div id="char-fields-player" class="char-type-fields">
          <input type="text" id="char-class" placeholder="Class">
          <input type="number" id="char-level" placeholder="Level" min="1">
          <input type="text" id="char-race" placeholder="Race">
        </div>
        <div id="char-fields-sidekick" class="char-type-fields hidden">
          <input type="text" id="char-base-creature" placeholder="Base Creature (e.g., Noble)">
          <select id="char-sidekick-class">
            <option value="Expert">Expert</option>
            <option value="Warrior">Warrior</option>
            <option value="Spellcaster">Spellcaster</option>
          </select>
          <input type="number" id="char-sidekick-level" placeholder="Level" min="1">
        </div>
        <div id="char-fields-npc" class="char-type-fields hidden">
          <input type="text" id="char-statblock-slug" placeholder="Statblock slug (optional)">
        </div>
        <div class="form-row">
          <input type="number" id="char-ac" placeholder="AC" min="1">
          <input type="number" id="char-hp" placeholder="HP" min="1">
        </div>
        <div class="form-group">
          <label>Location</label>
          <select id="char-location">
            <option value="party">Party</option>
            <!-- Populated dynamically -->
          </select>
        </div>
        <button id="btn-add-character" class="btn-primary">+ Add Character</button>
      </div>
    </aside>

    <!-- Center: Character List -->
    <main class="characters-list-container">
      <div class="characters-search">
        <input type="text" id="char-search" placeholder="🔍 Search characters...">
        <span id="char-search-count" class="search-count"></span>
      </div>
      <div id="characters-list" class="characters-list">
        <!-- Rendered dynamically -->
      </div>
    </main>

    <!-- Right Sidebar: Detail Panel -->
    <aside class="characters-sidebar-right">
      <div id="character-detail" class="character-detail-panel">
        <p class="empty-state">Select a character to view details</p>
      </div>
    </aside>
  </div>
</div>
```

## 2.2 CSS Layout

Add to `css/app.css`:

```css
.characters-layout {
  display: grid;
  grid-template-columns: 280px 1fr 320px;
  gap: 1rem;
  height: calc(100vh - 60px);
  padding: 1rem;
}

.characters-sidebar-left,
.characters-sidebar-right {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 1rem;
  overflow-y: auto;
}

.characters-list-container {
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  border-radius: 8px;
  overflow: hidden;
}

.characters-search {
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 1rem;
}

.characters-search input {
  flex: 1;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.search-count {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.characters-list {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.char-type-fields.hidden {
  display: none;
}
```

---

# Phase 3: Character List & Search

## Goal
Implement searchable character list with group headers and improved cards.

## 3.1 Search Implementation

```javascript
// In app.js
onCharacterSearch(e) {
    const query = e.target.value.trim();
    this.renderCharacterList(query);
},

renderCharacterList(searchQuery = '') {
    const container = document.getElementById('characters-list');
    const countEl = document.getElementById('char-search-count');
    
    let characters = window.worldManager.getAllCharacters();
    
    // Filter by search
    if (searchQuery) {
        characters = window.worldManager.searchCharacters(searchQuery);
    }
    
    // Update count
    countEl.textContent = `${characters.length} character${characters.length !== 1 ? 's' : ''}`;
    
    // Group by location
    const groups = this._groupCharactersByLocation(characters);
    
    // Render
    container.innerHTML = this._renderCharacterGroups(groups);
}
```

## 3.2 Improved Character Card

```javascript
_renderCharacterCard(c) {
    const typeLabels = { player: 'PC', sidekick: 'SIDE', npc: 'NPC' };
    const hpPercent = c.stats ? Math.round((c.stats.hp / c.stats.maxHp) * 100) : 0;
    const subtitle = c.type === 'player' 
        ? `${c.class || ''} ${c.level || ''} • ${c.race || ''}`
        : c.type === 'sidekick'
        ? `${c.sidekick?.baseCreature} ${c.sidekick?.class} ${c.sidekick?.level}`
        : c.story?.description?.substring(0, 50) || '';
    
    return `
        <div class="character-card" data-id="${c.id}">
            <div class="char-portrait">
                ${c.portrait ? `<img src="${c.portrait}" alt="">` : '<div class="char-portrait-placeholder">👤</div>'}
            </div>
            <div class="char-info">
                <div class="char-header">
                    <span class="char-name">${c.name}</span>
                    <span class="char-type-badge ${c.type}">${typeLabels[c.type]}</span>
                </div>
                <div class="char-subtitle">${subtitle}</div>
                ${c.stats ? `
                <div class="char-stats">
                    <div class="hp-bar-mini">
                        <div class="hp-fill" style="width: ${hpPercent}%"></div>
                    </div>
                    <span class="stat-text">HP: ${c.stats.hp}/${c.stats.maxHp}</span>
                    <span class="stat-text">AC: ${c.stats.ac}</span>
                </div>` : ''}
            </div>
        </div>
    `;
}
```

---

# Phase 4: Detail Panel & Editing

## Goal
Build right sidebar that shows selected character details with inline editing.

## 4.1 Detail Panel Rendering

```javascript
showCharacterDetail(characterId) {
    const panel = document.getElementById('character-detail');
    const char = window.worldManager.getCharacter(characterId);
    
    if (!char) {
        panel.innerHTML = '<p class="empty-state">Character not found</p>';
        return;
    }
    
    panel.innerHTML = this._renderDetailPanel(char);
    this._bindDetailEvents(characterId);
}

_renderDetailPanel(c) {
    return `
        <div class="detail-header">
            <div class="detail-portrait">
                ${c.portrait ? `<img src="${c.portrait}">` : '<div class="portrait-placeholder">👤</div>'}
                <button class="btn-upload-portrait" data-id="${c.id}">📷 Change</button>
                <input type="file" id="portrait-upload-${c.id}" class="hidden" accept="image/*">
            </div>
            <div class="detail-title">
                <input type="text" class="detail-name-input" value="${c.name}" data-field="name">
                <span class="char-type-badge ${c.type}">${c.type.toUpperCase()}</span>
            </div>
        </div>
        
        ${this._renderTypeSpecificFields(c)}
        
        <div class="detail-section">
            <h4>Location</h4>
            <select class="detail-location" data-field="location">
                <option value="party" ${c.location === 'party' ? 'selected' : ''}>Party</option>
                <option value="" ${!c.location ? 'selected' : ''}>Unassigned</option>
                ${this._renderLocationOptions(c.location)}
            </select>
        </div>
        
        <div class="detail-actions">
            <button class="btn-danger btn-delete-char" data-id="${c.id}">Delete Character</button>
        </div>
    `;
}
```

## 4.2 Type-Specific Fields

```javascript
_renderTypeSpecificFields(c) {
    if (c.type === 'player') {
        return `
            <div class="detail-section">
                <div class="detail-row">
                    <label>Class</label>
                    <input type="text" value="${c.class || ''}" data-field="class">
                </div>
                <div class="detail-row">
                    <label>Level</label>
                    <input type="number" value="${c.level || ''}" data-field="level" min="1">
                </div>
                <div class="detail-row">
                    <label>Race</label>
                    <input type="text" value="${c.race || ''}" data-field="race">
                </div>
            </div>
            ${this._renderStatsSection(c)}
            ${this._renderInventorySection(c)}
            <div class="detail-section">
                <h4>Notes</h4>
                <textarea data-field="notes">${c.notes || ''}</textarea>
            </div>
        `;
    }
    
    if (c.type === 'sidekick') {
        return `
            <div class="detail-section">
                <div class="detail-row">
                    <label>Base Creature</label>
                    <input type="text" value="${c.sidekick?.baseCreature || ''}" data-field="sidekick.baseCreature">
                </div>
                <div class="detail-row">
                    <label>Sidekick Class</label>
                    <select data-field="sidekick.class">
                        <option value="Expert" ${c.sidekick?.class === 'Expert' ? 'selected' : ''}>Expert</option>
                        <option value="Warrior" ${c.sidekick?.class === 'Warrior' ? 'selected' : ''}>Warrior</option>
                        <option value="Spellcaster" ${c.sidekick?.class === 'Spellcaster' ? 'selected' : ''}>Spellcaster</option>
                    </select>
                </div>
                <div class="detail-row">
                    <label>Level</label>
                    <input type="number" value="${c.sidekick?.level || ''}" data-field="sidekick.level" min="1">
                </div>
            </div>
            ${this._renderStatsSection(c)}
            ${this._renderSidekickFeatures(c)}
        `;
    }
    
    if (c.type === 'npc') {
        return `
            <div class="detail-section">
                <h4>Description</h4>
                <textarea data-field="story.description">${c.story?.description || ''}</textarea>
            </div>
            <div class="detail-section">
                <h4>Motivation</h4>
                <textarea data-field="story.motivation">${c.story?.motivation || ''}</textarea>
            </div>
            <div class="detail-section">
                <h4>Secrets</h4>
                <textarea data-field="story.secrets">${c.story?.secrets || ''}</textarea>
            </div>
            <div class="detail-section">
                <h4>Relationships</h4>
                <textarea data-field="story.relationships">${c.story?.relationships || ''}</textarea>
            </div>
            <div class="detail-section">
                <div class="detail-row">
                    <label>Statblock (slug)</label>
                    <input type="text" value="${c.statblockSlug || ''}" data-field="statblockSlug" placeholder="e.g., knight">
                </div>
            </div>
            ${c.stats ? this._renderStatsSection(c) : ''}
        `;
    }
    
    return '';
}
```

---

# Phase 5: Portrait Upload

## Goal
Allow users to upload portrait images via file input.

## 5.1 Server Endpoint

Add to `server.js`:

```javascript
const multer = require('multer');
const upload = multer({ dest: 'data/portraits/' });

app.post('/upload/portrait', upload.single('portrait'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    // Rename to include original extension
    const ext = path.extname(req.file.originalname);
    const newPath = req.file.path + ext;
    fs.renameSync(req.file.path, newPath);
    res.json({ path: `/data/portraits/${path.basename(newPath)}` });
});
```

## 5.2 Client Upload Handler

```javascript
async uploadPortrait(characterId, file) {
    const formData = new FormData();
    formData.append('portrait', file);
    
    const response = await fetch('/upload/portrait', {
        method: 'POST',
        body: formData
    });
    
    if (response.ok) {
        const { path } = await response.json();
        window.worldManager.updateCharacter(characterId, { portrait: path });
        this.showCharacterDetail(characterId);
        this.renderCharacterList();
    }
}
```

---

# Phase 6: Sidekick Features Reference

## Goal
Display sidekick class features based on level (read-only reference table).

## 6.1 Sidekick Data

```javascript
const SIDEKICK_FEATURES = {
    Expert: {
        1: ['Bonus Proficiencies', 'Helpful'],
        2: ['Cunning Action'],
        3: ['Expertise (2 skills)'],
        4: ['Ability Score Improvement'],
        6: ['Coordinated Strike'],
        7: ['Evasion'],
        8: ['Ability Score Improvement'],
        10: ['Ability Score Improvement', 'Inspiring Help (1d6)'],
        11: ['Expertise (2 more skills)'],
        12: ['Ability Score Improvement'],
        14: ['Ability Score Improvement', 'Inspiring Help (2d6)'],
        15: ['Reliable Talent'],
        16: ['Ability Score Improvement'],
        18: ['Sharp Mind'],
        19: ['Ability Score Improvement'],
        20: ['Inspiring Help (3d6)']
    },
    Warrior: {
        1: ['Bonus Proficiencies', 'Martial Role'],
        2: ['Second Wind'],
        3: ['Improved Critical'],
        4: ['Ability Score Improvement'],
        6: ['Extra Attack'],
        7: ['Battle Readiness'],
        8: ['Ability Score Improvement'],
        10: ['Ability Score Improvement', 'Improved Defense'],
        11: ['Indomitable (1/day)'],
        12: ['Ability Score Improvement'],
        14: ['Ability Score Improvement'],
        15: ['Extra Attack (2)'],
        16: ['Ability Score Improvement'],
        18: ['Indomitable (2/day)'],
        19: ['Ability Score Improvement'],
        20: ['Second Wind (2/rest)']
    },
    Spellcaster: {
        1: ['Bonus Proficiencies', 'Spellcasting'],
        4: ['Ability Score Improvement'],
        6: ['Potent Cantrips'],
        8: ['Ability Score Improvement'],
        12: ['Ability Score Improvement'],
        14: ['Empowered Spells'],
        16: ['Ability Score Improvement'],
        18: ['Ability Score Improvement', 'Focused Casting'],
        19: ['Ability Score Improvement']
    }
};
```

## 6.2 Feature Display

```javascript
_renderSidekickFeatures(c) {
    if (!c.sidekick) return '';
    
    const className = c.sidekick.class;
    const level = c.sidekick.level || 1;
    const classFeatures = SIDEKICK_FEATURES[className] || {};
    
    // Collect all features up to current level
    const features = [];
    for (let lvl = 1; lvl <= level; lvl++) {
        if (classFeatures[lvl]) {
            features.push(...classFeatures[lvl]);
        }
    }
    
    return `
        <div class="detail-section">
            <h4>${className} Features (Level ${level})</h4>
            <ul class="feature-list">
                ${features.map(f => `<li>${f}</li>`).join('')}
            </ul>
        </div>
    `;
}
```

---

# Verification Plan

## Automated Tests
- Create/edit/delete characters of each type
- Search filters correctly
- Portrait upload saves and displays

## Manual Testing
1. Add Ireena as Noble + Expert Level 5 sidekick
2. Verify features list shows: Bonus Proficiencies, Helpful, Cunning Action, Expertise, ASI
3. Edit character fields and confirm save
4. Upload portrait and verify display
5. Delete a location and confirm characters become "Unassigned"
6. Search by name, class, type
