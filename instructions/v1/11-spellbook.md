# Spellbook Tab Feature

## Overview

Add a new **Spellbook** tab for quick-reference spell lookup during gameplay. Features include:
- Browsable list of all 1,400+ spells via Open5e API
- Instant search with debounce (as-you-type)
- Filters: Level, School, Class, Concentration, Ritual
- Virtual scrolling for performance
- Custom spells via JSON paste (integrated with search results)
- School-based color coding with icons

---

## UI Layout

Sidebar + Detail panel (matching Bestiary pattern):

```
┌─────────────────────┬────────────────────────────────────┐
│ FILTERS             │                                    │
│ ┌─────────────────┐ │       SPELL DETAIL CARD            │
│ │ 🔍 Search...    │ │       ━━━━━━━━━━━━━━━━━━━━━        │
│ └─────────────────┘ │       🔥 Fireball                  │
│ Level:  [All ▾]     │       3rd-level Evocation          │
│ School: [All ▾]     │       ───────────────────          │
│ Class:  [All ▾]     │       ⏱ Casting Time: 1 action     │
│ ☐ Concentration     │       📏 Range: 150 feet           │
│ ☐ Ritual            │       🧩 Components: V, S, M       │
│ ──────────────────  │       ⏳ Duration: Instantaneous   │
│ + Import Custom     │       ───────────────────          │
│ ──────────────────  │       [Full description text...]   │
│ RESULTS (1,435)     │                                    │
│ ┌─────────────────┐ │       ┌──────────────────────────┐ │
│ │ 🔥 Fireball  3  │ │       │ At Higher Levels         │ │
│ │ ⚡ Haste     3  │ │       │ When cast with 4th+ slot │ │
│ │ 🛡 Shield    1  │ │       │ the damage increases...  │ │
│ │ ✨ Fly       3  │ │       └──────────────────────────┘ │
│ │ ...             │ │                                    │
│ └─────────────────┘ │                                    │
└─────────────────────┴────────────────────────────────────┘
```

---

## Spell School Icons and Colors

Use these for visual distinction:

| School       | Icon | CSS Color Variable     | Hex Value  |
|--------------|------|------------------------|------------|
| Abjuration   | 🛡️   | `--school-abjuration`  | `#4A90D9`  |
| Conjuration  | 🌀   | `--school-conjuration` | `#9B59B6`  |
| Divination   | 👁️   | `--school-divination`  | `#F1C40F`  |
| Enchantment  | 💫   | `--school-enchantment` | `#E91E8C`  |
| Evocation    | 🔥   | `--school-evocation`   | `#E74C3C`  |
| Illusion     | 🎭   | `--school-illusion`    | `#1ABC9C`  |
| Necromancy   | 💀   | `--school-necromancy`  | `#2C3E50`  |
| Transmutation| ⚗️   | `--school-transmutation`| `#27AE60` |

Additional Icons:
- Concentration: `⟳` 
- Ritual: `📖`

---

## Data Model

### Open5e Spell Response Fields

```json
{
  "slug": "fireball",
  "name": "Fireball",
  "desc": "A bright streak flashes from your pointing finger...",
  "higher_level": "When you cast this spell using a spell slot of 4th level or higher...",
  "range": "150 feet",
  "components": "V, S, M",
  "material": "a tiny ball of bat guano and sulfur",
  "ritual": "no",
  "duration": "Instantaneous",
  "concentration": "no",
  "casting_time": "1 action",
  "level": "3rd-level",
  "level_int": 3,
  "spell_level": 3,
  "school": "evocation",
  "dnd_class": "Sorcerer, Wizard",
  "spell_lists": ["sorcerer", "wizard"],
  "document__title": "5e Core Rules"
}
```

### Custom Spell Storage

Store in `data/custom-spells.json` with same structure + `"source": "custom"` flag.

---

## Proposed Changes

### 1. Server-Side: Spell API Proxy

#### [MODIFY] [server.js](file:///c:/Users/Jesse/Organize/Personal/jvdnd/server.js)

Add spell endpoints after monster endpoints (~line 123):

```javascript
// ============ Custom Spells ============

const CUSTOM_SPELLS_FILE = path.join(__dirname, 'data', 'custom-spells.json');

// Initialize empty custom spells if file doesn't exist
if (!fs.existsSync(CUSTOM_SPELLS_FILE)) {
    fs.writeFileSync(CUSTOM_SPELLS_FILE, JSON.stringify([], null, 2));
}

function readCustomSpells() {
    try {
        return JSON.parse(fs.readFileSync(CUSTOM_SPELLS_FILE, 'utf8'));
    } catch (e) {
        return [];
    }
}

function writeCustomSpells(spells) {
    fs.writeFileSync(CUSTOM_SPELLS_FILE, JSON.stringify(spells, null, 2));
}

// ============ Open5e Spell Proxy ============

// GET /api/spells - search/browse spells with filters
app.get('/api/spells', async (req, res) => {
    const { search, level, school, dnd_class, concentration, ritual, page, limit } = req.query;
    
    try {
        // Build query params
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (level !== undefined && level !== '' && level !== 'all') {
            params.append('spell_level', level);
        }
        if (school && school !== 'all') params.append('school', school);
        if (dnd_class && dnd_class !== 'all') params.append('dnd_class__icontains', dnd_class);
        if (concentration === 'true') params.append('requires_concentration', 'true');
        if (ritual === 'true') params.append('can_be_cast_as_ritual', 'true');
        params.append('limit', limit || 50);
        params.append('page', page || 1);
        params.append('ordering', 'level_int,name');
        
        const response = await fetch(
            `https://api.open5e.com/v1/spells/?${params.toString()}`
        );
        const data = await response.json();
        
        // Merge custom spells into results if searching
        if (search || !page || page === '1') {
            const customs = readCustomSpells();
            const matchingCustoms = customs.filter(spell => {
                // Apply same filters to custom spells
                if (search && !spell.name.toLowerCase().includes(search.toLowerCase())) return false;
                if (level !== undefined && level !== '' && level !== 'all' && spell.spell_level !== parseInt(level)) return false;
                if (school && school !== 'all' && spell.school?.toLowerCase() !== school.toLowerCase()) return false;
                if (concentration === 'true' && !spell.requires_concentration) return false;
                if (ritual === 'true' && !spell.can_be_cast_as_ritual) return false;
                return true;
            });
            
            // Prepend custom spells to results
            data.results = [...matchingCustoms, ...data.results];
            data.count += matchingCustoms.length;
        }
        
        res.json(data);
    } catch (error) {
        console.error('Open5e spell search failed:', error);
        res.status(500).json({ error: 'Failed to search spells' });
    }
});

// GET /api/spells/:slug - get single spell
app.get('/api/spells/:slug', async (req, res) => {
    // Check custom spells first
    const customs = readCustomSpells();
    const custom = customs.find(s => s.slug === req.params.slug);
    if (custom) {
        return res.json(custom);
    }
    
    // Fall back to Open5e
    try {
        const response = await fetch(
            `https://api.open5e.com/v1/spells/${req.params.slug}/`
        );
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Open5e spell fetch failed:', error);
        res.status(500).json({ error: 'Failed to fetch spell' });
    }
});

// GET /api/custom-spells - get all custom spells
app.get('/api/custom-spells', (req, res) => {
    res.json(readCustomSpells());
});

// POST /api/custom-spells - save custom spell
app.post('/api/custom-spells', (req, res) => {
    const spells = readCustomSpells();
    const spell = req.body;
    
    // Generate slug if not provided
    if (!spell.slug) {
        spell.slug = 'custom-' + spell.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    }
    
    // Mark as custom
    spell.source = 'custom';
    
    // Ensure level_int exists
    if (spell.spell_level !== undefined) {
        spell.level_int = spell.spell_level;
    }
    
    // Check for duplicates
    const existing = spells.findIndex(s => s.slug === spell.slug);
    if (existing >= 0) {
        spells[existing] = spell;
    } else {
        spells.push(spell);
    }
    
    writeCustomSpells(spells);
    res.json({ success: true, spell });
});

// DELETE /api/custom-spells/:slug
app.delete('/api/custom-spells/:slug', (req, res) => {
    let spells = readCustomSpells();
    spells = spells.filter(s => s.slug !== req.params.slug);
    writeCustomSpells(spells);
    res.json({ success: true });
});
```

---

### 2. Client-Side: API Methods

#### [MODIFY] [api.js](file:///c:/Users/Jesse/Organize/Personal/jvdnd/js/api.js)

Add spell methods to the API object:

```javascript
    // ============ Spells API ============
    
    /**
     * Search/browse spells with filters
     * @param {Object} filters - { search, level, school, dnd_class, concentration, ritual, page }
     */
    async searchSpells(filters = {}) {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== '' && value !== 'all') {
                params.append(key, value);
            }
        });
        
        const cacheKey = `spells:${params.toString()}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        try {
            const response = await fetch(`/api/spells?${params.toString()}`);
            if (!response.ok) throw new Error('API request failed');
            
            const data = await response.json();
            this.cache.set(cacheKey, data);
            return data;
        } catch (error) {
            console.error('Spell search failed:', error);
            return { results: [], count: 0 };
        }
    },
    
    /**
     * Get full spell details by slug
     */
    async getSpell(slug) {
        const cacheKey = `spell:${slug}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        try {
            const response = await fetch(`/api/spells/${slug}`);
            if (!response.ok) throw new Error('API request failed');
            
            const spell = await response.json();
            this.cache.set(cacheKey, spell);
            return spell;
        } catch (error) {
            console.error('Failed to fetch spell:', error);
            return null;
        }
    },
    
    /**
     * Get all custom spells
     */
    async getCustomSpells() {
        try {
            const response = await fetch('/api/custom-spells');
            if (!response.ok) throw new Error('Failed to fetch custom spells');
            return await response.json();
        } catch (error) {
            console.error('Failed to fetch custom spells:', error);
            return [];
        }
    },
    
    /**
     * Save a custom spell
     */
    async saveCustomSpell(spell) {
        try {
            const response = await fetch('/api/custom-spells', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(spell)
            });
            return response.ok;
        } catch (error) {
            console.error('Failed to save custom spell:', error);
            return false;
        }
    },
    
    /**
     * Delete a custom spell
     */
    async deleteCustomSpell(slug) {
        try {
            const response = await fetch(`/api/custom-spells/${slug}`, {
                method: 'DELETE'
            });
            return response.ok;
        } catch (error) {
            console.error('Failed to delete custom spell:', error);
            return false;
        }
    },
    
    // Spell school metadata
    spellSchools: {
        abjuration: { icon: '🛡️', color: '#4A90D9' },
        conjuration: { icon: '🌀', color: '#9B59B6' },
        divination: { icon: '👁️', color: '#F1C40F' },
        enchantment: { icon: '💫', color: '#E91E8C' },
        evocation: { icon: '🔥', color: '#E74C3C' },
        illusion: { icon: '🎭', color: '#1ABC9C' },
        necromancy: { icon: '💀', color: '#2C3E50' },
        transmutation: { icon: '⚗️', color: '#27AE60' }
    },
    
    getSchoolInfo(school) {
        return this.spellSchools[school?.toLowerCase()] || { icon: '✨', color: '#888' };
    }
```

---

### 3. HTML: Spellbook Tab Structure

#### [MODIFY] [index.html](file:///c:/Users/Jesse/Organize/Personal/jvdnd/index.html)

Add Spellbook button to nav (after Bestiary button, ~line 30):

```html
                <button id="btn-spellbook-mode" class="mode-btn">Spellbook</button>
```

Add Spellbook mode section (after Bestiary mode, ~line 105):

```html
        <!-- Spellbook Mode -->
        <main id="spellbook-mode" class="mode-view hidden">
            <aside class="spellbook-sidebar">
                <h2>Spell Search</h2>
                
                <!-- Search Box -->
                <div class="spellbook-search">
                    <input type="text" id="spell-search-input" placeholder="Search spells...">
                </div>
                
                <!-- Filters -->
                <div class="spell-filters">
                    <div class="filter-row">
                        <label for="spell-level-filter">Level:</label>
                        <select id="spell-level-filter">
                            <option value="all">All Levels</option>
                            <option value="0">Cantrip</option>
                            <option value="1">1st</option>
                            <option value="2">2nd</option>
                            <option value="3">3rd</option>
                            <option value="4">4th</option>
                            <option value="5">5th</option>
                            <option value="6">6th</option>
                            <option value="7">7th</option>
                            <option value="8">8th</option>
                            <option value="9">9th</option>
                        </select>
                    </div>
                    
                    <div class="filter-row">
                        <label for="spell-school-filter">School:</label>
                        <select id="spell-school-filter">
                            <option value="all">All Schools</option>
                            <option value="abjuration">🛡️ Abjuration</option>
                            <option value="conjuration">🌀 Conjuration</option>
                            <option value="divination">👁️ Divination</option>
                            <option value="enchantment">💫 Enchantment</option>
                            <option value="evocation">🔥 Evocation</option>
                            <option value="illusion">🎭 Illusion</option>
                            <option value="necromancy">💀 Necromancy</option>
                            <option value="transmutation">⚗️ Transmutation</option>
                        </select>
                    </div>
                    
                    <div class="filter-row">
                        <label for="spell-class-filter">Class:</label>
                        <select id="spell-class-filter">
                            <option value="all">All Classes</option>
                            <option value="bard">Bard</option>
                            <option value="cleric">Cleric</option>
                            <option value="druid">Druid</option>
                            <option value="paladin">Paladin</option>
                            <option value="ranger">Ranger</option>
                            <option value="sorcerer">Sorcerer</option>
                            <option value="warlock">Warlock</option>
                            <option value="wizard">Wizard</option>
                        </select>
                    </div>
                    
                    <div class="filter-checkboxes">
                        <label class="checkbox-filter">
                            <input type="checkbox" id="spell-concentration-filter">
                            <span>⟳</span> Concentration
                        </label>
                        <label class="checkbox-filter">
                            <input type="checkbox" id="spell-ritual-filter">
                            <span>📖</span> Ritual
                        </label>
                    </div>
                </div>
                
                <!-- Import Custom Spell -->
                <button id="btn-import-spell" class="btn-secondary">+ Import Custom Spell</button>
                
                <!-- Results List -->
                <div class="spell-results-header">
                    <span id="spell-results-count">Loading...</span>
                </div>
                <div id="spell-results" class="spell-results virtual-scroll-container">
                    <!-- Virtual scroll content rendered here -->
                </div>
            </aside>
            
            <section class="spellbook-detail-section">
                <div id="spell-detail" class="spell-detail-panel">
                    <p class="empty-state">Search for a spell to view its details</p>
                </div>
            </section>
        </main>
```

Add Spell Import Modal (before closing `</div>` of #app, ~line 317):

```html
        <!-- Import Spell Modal -->
        <div id="import-spell-modal" class="modal hidden">
            <div class="modal-content modal-large">
                <h2>📜 Import Custom Spell</h2>
                <p>Paste spell data in JSON format:</p>
                <textarea id="import-spell-text" placeholder='{
  "name": "Eldritch Blast",
  "spell_level": 0,
  "school": "evocation",
  "casting_time": "1 action",
  "range": "120 feet",
  "components": "V, S",
  "duration": "Instantaneous",
  "desc": "A beam of crackling energy streaks toward a creature...",
  "dnd_class": "Warlock"
}'></textarea>
                <div class="import-actions">
                    <button id="btn-save-spell-import" class="btn-primary">Save Spell</button>
                    <button id="btn-cancel-spell-import" class="btn-secondary">Cancel</button>
                </div>
                <div id="spell-import-error" class="import-error hidden"></div>
            </div>
        </div>
```

---

### 4. CSS: Spellbook Styles

#### [MODIFY] [styles.css](file:///c:/Users/Jesse/Organize/Personal/jvdnd/css/styles.css)

Add spell school colors and spellbook styles:

```css
/* ============ Spell School Colors ============ */

:root {
    --school-abjuration: #4A90D9;
    --school-conjuration: #9B59B6;
    --school-divination: #F1C40F;
    --school-enchantment: #E91E8C;
    --school-evocation: #E74C3C;
    --school-illusion: #1ABC9C;
    --school-necromancy: #2C3E50;
    --school-transmutation: #27AE60;
}

/* ============ Spellbook Mode ============ */

#spellbook-mode {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    height: calc(100vh - 80px);
}

.spellbook-sidebar {
    width: 320px;
    min-width: 280px;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    background: var(--bg-secondary);
    padding: 1rem;
    border-radius: 8px;
    overflow: hidden;
}

.spellbook-sidebar h2 {
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
}

.spellbook-search input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 1rem;
}

.spellbook-search input::placeholder {
    color: var(--text-muted);
}

/* Filter Styles */
.spell-filters {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--bg-tertiary);
    border-radius: 6px;
}

.filter-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.filter-row label {
    min-width: 50px;
    color: var(--text-secondary);
    font-size: 0.875rem;
}

.filter-row select {
    flex: 1;
    padding: 0.4rem;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.875rem;
}

.filter-checkboxes {
    display: flex;
    gap: 1rem;
    margin-top: 0.25rem;
}

.checkbox-filter {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--text-secondary);
    font-size: 0.875rem;
    cursor: pointer;
}

.checkbox-filter input {
    accent-color: var(--accent);
}

/* Results List with Virtual Scrolling */
.spell-results-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border-color);
    color: var(--text-muted);
    font-size: 0.875rem;
}

.spell-results {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
}

.virtual-scroll-container {
    position: relative;
}

.spell-result-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 0.75rem;
    cursor: pointer;
    border-radius: 4px;
    transition: background 0.15s;
}

.spell-result-item:hover {
    background: var(--bg-hover);
}

.spell-result-item.selected {
    background: var(--accent-dim);
}

.spell-result-item.custom {
    border-left: 3px solid var(--accent);
}

.spell-school-icon {
    font-size: 1.1rem;
    min-width: 1.5rem;
    text-align: center;
}

.spell-result-info {
    flex: 1;
    min-width: 0;
}

.spell-result-name {
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.spell-result-meta {
    font-size: 0.75rem;
    color: var(--text-muted);
}

.spell-result-level {
    min-width: 1.5rem;
    text-align: center;
    padding: 0.2rem 0.4rem;
    background: var(--bg-tertiary);
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-secondary);
}

.spell-result-tags {
    display: flex;
    gap: 0.25rem;
    font-size: 0.75rem;
}

/* Spell Detail Panel */
.spellbook-detail-section {
    flex: 1;
    overflow: hidden;
}

.spell-detail-panel {
    height: 100%;
    overflow-y: auto;
    background: var(--bg-secondary);
    border-radius: 8px;
    padding: 1.5rem;
}

.spell-detail-panel .empty-state {
    text-align: center;
    color: var(--text-muted);
    padding: 3rem;
}

/* Spell Card Styling */
.spell-card {
    max-width: 700px;
}

.spell-card-header {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1rem;
}

.spell-card-icon {
    font-size: 2.5rem;
}

.spell-card-title h2 {
    margin: 0;
    color: var(--text-primary);
    font-size: 1.5rem;
}

.spell-card-subtitle {
    color: var(--text-secondary);
    font-style: italic;
}

.spell-card-tags {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
}

.spell-tag {
    padding: 0.2rem 0.5rem;
    background: var(--bg-tertiary);
    border-radius: 4px;
    font-size: 0.75rem;
    color: var(--text-secondary);
}

.spell-tag.concentration {
    background: #E74C3C33;
    color: #E74C3C;
}

.spell-tag.ritual {
    background: #9B59B633;
    color: #9B59B6;
}

.spell-card hr {
    border: none;
    border-top: 2px solid var(--border-color);
    margin: 1rem 0;
}

.spell-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 0.75rem;
    margin-bottom: 1rem;
}

.spell-stat {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.spell-stat-icon {
    font-size: 1rem;
    min-width: 1.5rem;
}

.spell-stat-label {
    color: var(--text-muted);
    font-size: 0.75rem;
}

.spell-stat-value {
    font-weight: 500;
    color: var(--text-primary);
}

.spell-description {
    line-height: 1.6;
    color: var(--text-primary);
}

.spell-description p {
    margin: 0 0 1rem 0;
}

.spell-higher-levels {
    background: var(--bg-tertiary);
    border-left: 3px solid var(--accent);
    padding: 1rem;
    border-radius: 0 6px 6px 0;
    margin-top: 1rem;
}

.spell-higher-levels h4 {
    margin: 0 0 0.5rem 0;
    color: var(--text-secondary);
}

.spell-classes {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
    color: var(--text-muted);
    font-size: 0.875rem;
}

.spell-source {
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: var(--text-muted);
    font-style: italic;
}

.spell-custom-badge {
    display: inline-block;
    background: var(--accent);
    color: white;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.7rem;
    margin-left: 0.5rem;
    font-style: normal;
}

.spell-actions {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
}

/* Import Spell Modal */
#import-spell-modal textarea {
    width: 100%;
    min-height: 300px;
    padding: 1rem;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 0.875rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    resize: vertical;
}

.import-error {
    margin-top: 0.5rem;
    padding: 0.75rem;
    background: #E74C3C22;
    border: 1px solid #E74C3C;
    border-radius: 4px;
    color: #E74C3C;
    font-size: 0.875rem;
}

/* Loading State */
.spell-results-loading {
    text-align: center;
    padding: 2rem;
    color: var(--text-muted);
}

.spell-results-loading::after {
    content: '';
    display: inline-block;
    width: 1rem;
    height: 1rem;
    border: 2px solid var(--accent);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-left: 0.5rem;
    vertical-align: middle;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}
```

---

### 5. JavaScript: Spellbook UI Logic

#### [MODIFY] [app.js](file:///c:/Users/Jesse/Organize/Personal/jvdnd/js/app.js)

Add mode button handler (in modes section):

```javascript
// Spellbook mode toggle
document.getElementById('btn-spellbook-mode')?.addEventListener('click', () => {
    App.setMode('spellbook');
});
```

Extend `setMode()` to handle spellbook:

```javascript
setMode(mode) {
    // ... existing mode handling ...
    
    // Handle spellbook mode activation
    if (mode === 'spellbook') {
        Spellbook.initialize();
    }
}
```

#### [NEW] [spellbook.js](file:///c:/Users/Jesse/Organize/Personal/jvdnd/js/spellbook.js)

Create new file for Spellbook module:

```javascript
/**
 * Spellbook Module
 * Handles spell searching, filtering, and display
 */

const Spellbook = {
    state: {
        filters: {
            search: '',
            level: 'all',
            school: 'all',
            dnd_class: 'all',
            concentration: false,
            ritual: false
        },
        results: [],
        totalCount: 0,
        currentPage: 1,
        selectedSpell: null,
        isLoading: false,
        initialized: false
    },
    
    searchDebounceTimer: null,
    
    elements: {},
    
    /**
     * Initialize the spellbook module
     */
    async initialize() {
        if (this.state.initialized) {
            return;
        }
        
        // Cache DOM elements
        this.elements = {
            searchInput: document.getElementById('spell-search-input'),
            levelFilter: document.getElementById('spell-level-filter'),
            schoolFilter: document.getElementById('spell-school-filter'),
            classFilter: document.getElementById('spell-class-filter'),
            concentrationFilter: document.getElementById('spell-concentration-filter'),
            ritualFilter: document.getElementById('spell-ritual-filter'),
            resultsContainer: document.getElementById('spell-results'),
            resultsCount: document.getElementById('spell-results-count'),
            detailPanel: document.getElementById('spell-detail'),
            importBtn: document.getElementById('btn-import-spell'),
            importModal: document.getElementById('import-spell-modal'),
            importText: document.getElementById('import-spell-text'),
            saveImportBtn: document.getElementById('btn-save-spell-import'),
            cancelImportBtn: document.getElementById('btn-cancel-spell-import'),
            importError: document.getElementById('spell-import-error')
        };
        
        this.bindEvents();
        this.state.initialized = true;
        
        // Initial search to load all spells
        await this.search();
    },
    
    /**
     * Bind event listeners
     */
    bindEvents() {
        // Search input with debounce
        this.elements.searchInput.addEventListener('input', (e) => {
            this.state.filters.search = e.target.value;
            this.debouncedSearch();
        });
        
        // Filter dropdowns
        this.elements.levelFilter.addEventListener('change', (e) => {
            this.state.filters.level = e.target.value;
            this.search();
        });
        
        this.elements.schoolFilter.addEventListener('change', (e) => {
            this.state.filters.school = e.target.value;
            this.search();
        });
        
        this.elements.classFilter.addEventListener('change', (e) => {
            this.state.filters.dnd_class = e.target.value;
            this.search();
        });
        
        // Checkbox filters
        this.elements.concentrationFilter.addEventListener('change', (e) => {
            this.state.filters.concentration = e.target.checked;
            this.search();
        });
        
        this.elements.ritualFilter.addEventListener('change', (e) => {
            this.state.filters.ritual = e.target.checked;
            this.search();
        });
        
        // Import modal handlers
        this.elements.importBtn.addEventListener('click', () => {
            this.showImportModal();
        });
        
        this.elements.saveImportBtn.addEventListener('click', () => {
            this.saveImportedSpell();
        });
        
        this.elements.cancelImportBtn.addEventListener('click', () => {
            this.hideImportModal();
        });
        
        // Virtual scroll handler
        this.elements.resultsContainer.addEventListener('scroll', () => {
            this.handleScroll();
        });
    },
    
    /**
     * Debounced search (300ms delay)
     */
    debouncedSearch() {
        clearTimeout(this.searchDebounceTimer);
        this.searchDebounceTimer = setTimeout(() => {
            this.search();
        }, 300);
    },
    
    /**
     * Perform spell search with current filters
     */
    async search() {
        this.state.isLoading = true;
        this.state.currentPage = 1;
        this.renderLoading();
        
        try {
            const filters = {
                search: this.state.filters.search,
                level: this.state.filters.level,
                school: this.state.filters.school,
                dnd_class: this.state.filters.dnd_class,
                concentration: this.state.filters.concentration ? 'true' : undefined,
                ritual: this.state.filters.ritual ? 'true' : undefined,
                page: 1,
                limit: 50
            };
            
            const data = await API.searchSpells(filters);
            
            this.state.results = data.results || [];
            this.state.totalCount = data.count || 0;
            this.state.hasMore = !!data.next;
            
            this.renderResults();
        } catch (error) {
            console.error('Spell search failed:', error);
            this.state.results = [];
            this.renderResults();
        }
        
        this.state.isLoading = false;
    },
    
    /**
     * Load more results (infinite scroll)
     */
    async loadMore() {
        if (this.state.isLoading || !this.state.hasMore) return;
        
        this.state.isLoading = true;
        this.state.currentPage++;
        
        try {
            const filters = {
                search: this.state.filters.search,
                level: this.state.filters.level,
                school: this.state.filters.school,
                dnd_class: this.state.filters.dnd_class,
                concentration: this.state.filters.concentration ? 'true' : undefined,
                ritual: this.state.filters.ritual ? 'true' : undefined,
                page: this.state.currentPage,
                limit: 50
            };
            
            const data = await API.searchSpells(filters);
            
            this.state.results = [...this.state.results, ...(data.results || [])];
            this.state.hasMore = !!data.next;
            
            this.renderResults(true); // append mode
        } catch (error) {
            console.error('Load more failed:', error);
        }
        
        this.state.isLoading = false;
    },
    
    /**
     * Handle scroll for infinite loading
     */
    handleScroll() {
        const container = this.elements.resultsContainer;
        const threshold = 100; // pixels from bottom
        
        if (container.scrollTop + container.clientHeight >= container.scrollHeight - threshold) {
            this.loadMore();
        }
    },
    
    /**
     * Render loading state
     */
    renderLoading() {
        this.elements.resultsContainer.innerHTML = '<div class="spell-results-loading">Loading spells</div>';
    },
    
    /**
     * Render spell results list
     */
    renderResults(append = false) {
        // Update count
        this.elements.resultsCount.textContent = `${this.state.totalCount} spells found`;
        
        const html = this.state.results.map(spell => this.renderSpellItem(spell)).join('');
        
        if (append) {
            this.elements.resultsContainer.insertAdjacentHTML('beforeend', html);
        } else {
            this.elements.resultsContainer.innerHTML = html || '<p class="empty-state">No spells found</p>';
        }
        
        // Attach click handlers
        this.elements.resultsContainer.querySelectorAll('.spell-result-item').forEach(item => {
            item.addEventListener('click', () => {
                this.selectSpell(item.dataset.slug);
            });
        });
    },
    
    /**
     * Render a single spell result item
     */
    renderSpellItem(spell) {
        const schoolInfo = API.getSchoolInfo(spell.school);
        const levelDisplay = spell.spell_level === 0 ? 'C' : spell.spell_level;
        const isCustom = spell.source === 'custom';
        
        const tags = [];
        if (spell.requires_concentration || spell.concentration === 'yes') {
            tags.push('<span title="Concentration">⟳</span>');
        }
        if (spell.can_be_cast_as_ritual || spell.ritual === 'yes') {
            tags.push('<span title="Ritual">📖</span>');
        }
        
        return `
            <div class="spell-result-item ${isCustom ? 'custom' : ''} ${this.state.selectedSpell === spell.slug ? 'selected' : ''}"
                 data-slug="${spell.slug}">
                <span class="spell-school-icon" style="color: ${schoolInfo.color}">${schoolInfo.icon}</span>
                <div class="spell-result-info">
                    <div class="spell-result-name">${spell.name}</div>
                    <div class="spell-result-meta">${spell.school || 'Unknown'}</div>
                </div>
                <div class="spell-result-tags">${tags.join('')}</div>
                <span class="spell-result-level">${levelDisplay}</span>
            </div>
        `;
    },
    
    /**
     * Select and display a spell
     */
    async selectSpell(slug) {
        this.state.selectedSpell = slug;
        
        // Update selection in list
        this.elements.resultsContainer.querySelectorAll('.spell-result-item').forEach(item => {
            item.classList.toggle('selected', item.dataset.slug === slug);
        });
        
        // Show loading in detail panel
        this.elements.detailPanel.innerHTML = '<div class="spell-results-loading">Loading spell</div>';
        
        // Fetch full spell details
        const spell = await API.getSpell(slug);
        
        if (spell) {
            this.renderSpellDetail(spell);
        } else {
            this.elements.detailPanel.innerHTML = '<p class="empty-state">Failed to load spell</p>';
        }
    },
    
    /**
     * Render full spell detail card
     */
    renderSpellDetail(spell) {
        const schoolInfo = API.getSchoolInfo(spell.school);
        const isConcentration = spell.requires_concentration || spell.concentration === 'yes';
        const isRitual = spell.can_be_cast_as_ritual || spell.ritual === 'yes';
        const isCustom = spell.source === 'custom';
        
        const levelText = spell.spell_level === 0 
            ? 'Cantrip' 
            : `${this.ordinal(spell.spell_level)}-level`;
        
        const tags = [];
        if (isConcentration) {
            tags.push('<span class="spell-tag concentration">⟳ Concentration</span>');
        }
        if (isRitual) {
            tags.push('<span class="spell-tag ritual">📖 Ritual</span>');
        }
        
        let html = `
            <div class="spell-card" style="--spell-color: ${schoolInfo.color}">
                <div class="spell-card-header">
                    <span class="spell-card-icon" style="color: ${schoolInfo.color}">${schoolInfo.icon}</span>
                    <div class="spell-card-title">
                        <h2>${spell.name}${isCustom ? '<span class="spell-custom-badge">Custom</span>' : ''}</h2>
                        <p class="spell-card-subtitle">${levelText} ${spell.school || ''}</p>
                        ${tags.length ? `<div class="spell-card-tags">${tags.join('')}</div>` : ''}
                    </div>
                </div>
                
                <hr>
                
                <div class="spell-stats">
                    <div class="spell-stat">
                        <span class="spell-stat-icon">⏱</span>
                        <div>
                            <div class="spell-stat-label">Casting Time</div>
                            <div class="spell-stat-value">${spell.casting_time || 'N/A'}</div>
                        </div>
                    </div>
                    <div class="spell-stat">
                        <span class="spell-stat-icon">📏</span>
                        <div>
                            <div class="spell-stat-label">Range</div>
                            <div class="spell-stat-value">${spell.range || 'N/A'}</div>
                        </div>
                    </div>
                    <div class="spell-stat">
                        <span class="spell-stat-icon">🧩</span>
                        <div>
                            <div class="spell-stat-label">Components</div>
                            <div class="spell-stat-value">${spell.components || 'N/A'}</div>
                        </div>
                    </div>
                    <div class="spell-stat">
                        <span class="spell-stat-icon">⏳</span>
                        <div>
                            <div class="spell-stat-label">Duration</div>
                            <div class="spell-stat-value">${spell.duration || 'N/A'}</div>
                        </div>
                    </div>
                </div>
                
                ${spell.material ? `<p><em>Material: ${spell.material}</em></p>` : ''}
                
                <hr>
                
                <div class="spell-description">
                    ${this.formatDescription(spell.desc)}
                </div>
                
                ${spell.higher_level ? `
                    <div class="spell-higher-levels">
                        <h4>At Higher Levels</h4>
                        <p>${spell.higher_level}</p>
                    </div>
                ` : ''}
                
                <div class="spell-classes">
                    <strong>Classes:</strong> ${spell.dnd_class || 'Unknown'}
                </div>
                
                ${spell.document__title ? `
                    <div class="spell-source">
                        Source: ${spell.document__title}
                    </div>
                ` : ''}
                
                ${isCustom ? `
                    <div class="spell-actions">
                        <button class="btn-danger btn-small" onclick="Spellbook.deleteCustomSpell('${spell.slug}')">
                            Delete Custom Spell
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
        
        this.elements.detailPanel.innerHTML = html;
    },
    
    /**
     * Format spell description text
     */
    formatDescription(desc) {
        if (!desc) return '<p>No description available.</p>';
        
        // Handle markdown-style formatting
        return desc
            .split('\n\n')
            .map(p => `<p>${p.trim()}</p>`)
            .join('');
    },
    
    /**
     * Get ordinal suffix for number
     */
    ordinal(n) {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    },
    
    /**
     * Show import modal
     */
    showImportModal() {
        this.elements.importModal.classList.remove('hidden');
        this.elements.importText.value = '';
        this.elements.importError.classList.add('hidden');
    },
    
    /**
     * Hide import modal
     */
    hideImportModal() {
        this.elements.importModal.classList.add('hidden');
    },
    
    /**
     * Save imported custom spell
     */
    async saveImportedSpell() {
        const text = this.elements.importText.value.trim();
        
        if (!text) {
            this.showImportError('Please paste spell JSON data');
            return;
        }
        
        try {
            const spell = JSON.parse(text);
            
            // Validate required fields
            if (!spell.name) {
                throw new Error('Spell must have a name');
            }
            
            // Ensure level fields
            if (spell.spell_level === undefined && spell.level_int !== undefined) {
                spell.spell_level = spell.level_int;
            }
            if (spell.spell_level === undefined) {
                spell.spell_level = 0; // Default to cantrip
            }
            
            const success = await API.saveCustomSpell(spell);
            
            if (success) {
                this.hideImportModal();
                // Clear cache and refresh
                API.cache.clear();
                this.search();
            } else {
                this.showImportError('Failed to save spell');
            }
        } catch (error) {
            this.showImportError(`Invalid JSON: ${error.message}`);
        }
    },
    
    /**
     * Show import error message
     */
    showImportError(message) {
        this.elements.importError.textContent = message;
        this.elements.importError.classList.remove('hidden');
    },
    
    /**
     * Delete a custom spell
     */
    async deleteCustomSpell(slug) {
        if (!confirm('Delete this custom spell?')) return;
        
        const success = await API.deleteCustomSpell(slug);
        
        if (success) {
            // Clear cache and refresh
            API.cache.clear();
            this.state.selectedSpell = null;
            this.elements.detailPanel.innerHTML = '<p class="empty-state">Spell deleted</p>';
            this.search();
        }
    }
};

// Make globally available
window.Spellbook = Spellbook;
```

---

### 6. Script Loading

#### [MODIFY] [index.html](file:///c:/Users/Jesse/Organize/Personal/jvdnd/index.html)

Add script reference before `app.js` (~line 324):

```html
    <script src="js/spellbook.js"></script>
```

---

## Verification Plan

### Automated Tests

None required for this feature (follows existing patterns).

### Manual Browser Verification

1. **Start Server**
   ```bash
   npm start
   ```
   Navigate to `http://localhost:3000`

2. **Verify Tab Appears**
   - [ ] "Spellbook" button visible in header nav
   - [ ] Clicking navigates to Spellbook mode

3. **Test Search & Filters**
   - [ ] Initial load shows spell count (~1,435)
   - [ ] Type "fireball" → results filter instantly
   - [ ] Change Level to "3" → shows 3rd-level spells
   - [ ] Change School to "Evocation" → filters correctly
   - [ ] Check "Concentration" → only concentration spells
   - [ ] Combine multiple filters

4. **Test Spell Detail**
   - [ ] Click any spell → detail card appears
   - [ ] Verify: name, level, school, components, duration, description
   - [ ] Verify school icon and color coding
   - [ ] "At Higher Levels" section appears when applicable

5. **Test Virtual Scrolling**
   - [ ] Clear filters, scroll to bottom
   - [ ] More results load automatically

6. **Test Custom Spell Import**
   - [ ] Click "+ Import Custom Spell"
   - [ ] Paste valid JSON, click Save
   - [ ] Custom spell appears in results (with accent border)
   - [ ] Can delete custom spell via detail panel

7. **Test Error Handling**
   - [ ] Paste invalid JSON → shows error message
   - [ ] Network error → graceful failure

---

## Files Changed Summary

| File | Change |
|------|--------|
| `server.js` | Add spell API endpoints (`/api/spells`, `/api/custom-spells`) |
| `js/api.js` | Add `searchSpells()`, `getSpell()`, spell school metadata |
| `index.html` | Add Spellbook nav button, mode section, import modal |
| `css/styles.css` | Add spell school colors, spellbook layout, spell card styles |
| `js/spellbook.js` | **[NEW]** Complete Spellbook module |
| `data/custom-spells.json` | **[NEW]** Auto-created for custom spell storage |
