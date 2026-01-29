require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const multer = require('multer');
const sharp = require('sharp');
const crypto = require('crypto');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data', 'state.json');
const CUSTOM_MONSTERS_FILE = path.join(__dirname, 'data', 'custom-monsters.json');
const CUSTOM_SPELLS_FILE = path.join(__dirname, 'data', 'custom-spells.json');
const WORLD_FILE = path.join(__dirname, 'data', 'world.json');

// Initialize Anthropic client
const anthropic = new Anthropic();

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize empty state if file doesn't exist
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ party: [], encounters: [] }, null, 2));
}

// Initialize empty custom monsters if file doesn't exist
if (!fs.existsSync(CUSTOM_MONSTERS_FILE)) {
    fs.writeFileSync(CUSTOM_MONSTERS_FILE, JSON.stringify([], null, 2));
}

// Initialize empty custom spells if file doesn't exist
if (!fs.existsSync(CUSTOM_SPELLS_FILE)) {
    fs.writeFileSync(CUSTOM_SPELLS_FILE, JSON.stringify([], null, 2));
}

// Map library paths
const MAPS_DIR = path.join(__dirname, 'data', 'maps', 'images');
const MAPS_FILE = path.join(__dirname, 'data', 'maps.json');
const BATTLEMAP_STATE_FILE = path.join(__dirname, 'data', 'battlemap-state.json');

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

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// ============ Data Persistence ============

function readState() {
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
        return { party: [], encounters: [] };
    }
}

function writeState(state) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
}

// GET full state
app.get('/api/state', (req, res) => {
    res.json(readState());
});

// PUT full state
app.put('/api/state', (req, res) => {
    writeState(req.body);
    res.json({ success: true });
});

// ============ World Data Persistence ============

// GET world.json
app.get('/data/world.json', (req, res) => {
    if (fs.existsSync(WORLD_FILE)) {
        res.sendFile(WORLD_FILE);
    } else {
        res.status(404).json({ error: 'world.json not found' });
    }
});

// POST save world
app.post('/save/world', (req, res) => {
    try {
        fs.writeFileSync(WORLD_FILE, JSON.stringify(req.body, null, 2));
        res.json({ status: 'ok' });
    } catch (err) {
        console.error('Failed to save world.json:', err);
        res.status(500).json({ error: 'Failed to save world.json' });
    }
});

// ============ Open5e Proxy ============

app.get('/api/monsters', async (req, res) => {
    const search = req.query.search || '';
    try {
        const response = await fetch(
            `https://api.open5e.com/v1/monsters/?search=${encodeURIComponent(search)}&limit=20`
        );
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Open5e search failed:', error);
        res.status(500).json({ error: 'Failed to search monsters' });
    }
});

app.get('/api/monsters/:slug', async (req, res) => {
    // Check custom monsters first
    const customs = readCustomMonsters();
    const custom = customs.find(m => m.slug === req.params.slug);
    if (custom) {
        return res.json(custom);
    }

    // Fall back to Open5e
    try {
        const response = await fetch(
            `https://api.open5e.com/v1/monsters/${req.params.slug}/`
        );
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Open5e fetch failed:', error);
        res.status(500).json({ error: 'Failed to fetch monster' });
    }
});

// ============ Custom Monsters ============

function readCustomMonsters() {
    try {
        return JSON.parse(fs.readFileSync(CUSTOM_MONSTERS_FILE, 'utf8'));
    } catch (e) {
        return [];
    }
}

function writeCustomMonsters(monsters) {
    fs.writeFileSync(CUSTOM_MONSTERS_FILE, JSON.stringify(monsters, null, 2));
}

// GET all custom monsters
app.get('/api/custom-monsters', (req, res) => {
    res.json(readCustomMonsters());
});

// POST new custom monster
app.post('/api/custom-monsters', (req, res) => {
    const monsters = readCustomMonsters();
    const monster = req.body;

    // Generate slug if not provided
    if (!monster.slug) {
        monster.slug = 'custom-' + monster.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    }

    // Mark as custom
    monster.source = 'custom';

    // Check for duplicates
    const existing = monsters.findIndex(m => m.slug === monster.slug);
    if (existing >= 0) {
        monsters[existing] = monster; // Update existing
    } else {
        monsters.push(monster);
    }

    writeCustomMonsters(monsters);
    res.json({ success: true, monster });
});

// DELETE custom monster
app.delete('/api/custom-monsters/:slug', (req, res) => {
    let monsters = readCustomMonsters();
    monsters = monsters.filter(m => m.slug !== req.params.slug);
    writeCustomMonsters(monsters);
    res.json({ success: true });
});

// ============ Custom Spells ============

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
                if (search && !spell.name.toLowerCase().includes(search.toLowerCase())) return false;
                if (level !== undefined && level !== '' && level !== 'all' && spell.spell_level !== parseInt(level)) return false;
                if (school && school !== 'all' && spell.school?.toLowerCase() !== school.toLowerCase()) return false;
                if (concentration === 'true' && !spell.requires_concentration) return false;
                if (ritual === 'true' && !spell.can_be_cast_as_ritual) return false;
                return true;
            });

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
    const customs = readCustomSpells();
    const custom = customs.find(s => s.slug === req.params.slug);
    if (custom) {
        return res.json(custom);
    }

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

    if (!spell.slug) {
        spell.slug = 'custom-' + spell.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    }

    spell.source = 'custom';

    if (spell.spell_level !== undefined) {
        spell.level_int = spell.spell_level;
    }

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

// ============ AI Statblock Parser ============

const PARSE_PROMPT = `You are a D&D 5e statblock parser. Convert the provided statblock text into Open5e JSON format.

Return ONLY valid JSON matching this structure (include all fields, use null/empty arrays for missing data):
{
  "slug": "monster-name-lowercase-hyphenated",
  "name": "Monster Name",
  "size": "Medium",
  "type": "humanoid",
  "subtype": "",
  "alignment": "neutral evil",
  "armor_class": 15,
  "armor_desc": "leather armor, shield",
  "hit_points": 7,
  "hit_dice": "2d6",
  "speed": {"walk": 30, "fly": null, "swim": null, "burrow": null, "climb": null},
  "strength": 8,
  "dexterity": 14,
  "constitution": 10,
  "intelligence": 10,
  "wisdom": 8,
  "charisma": 8,
  "strength_save": null,
  "dexterity_save": null,
  "constitution_save": null,
  "intelligence_save": null,
  "wisdom_save": null,
  "charisma_save": null,
  "perception": null,
  "damage_vulnerabilities": "",
  "damage_resistances": "",
  "damage_immunities": "",
  "condition_immunities": "",
  "senses": "darkvision 60 ft., passive Perception 9",
  "languages": "Common, Goblin",
  "cr": "1/4",
  "special_abilities": [{"name": "Ability Name", "desc": "Description"}],
  "actions": [{"name": "Action Name", "desc": "Description with attack and damage"}],
  "bonus_actions": [],
  "reactions": [],
  "legendary_actions": [],
  "legendary_desc": ""
}

CRITICAL: Pay attention to section headers in the source text:
- "Actions" section → actions array
- "Bonus Actions" section → bonus_actions array
- "Reactions" section → reactions array
- "Legendary Actions" section → legendary_actions array

IMPORTANT:
- If ability text says "as a bonus action" but is listed under regular abilities, keep in special_abilities
- Use null for missing saves, not 0
- Include skills as an object if present, e.g. {"Perception": 5, "Stealth": 6}

Parse the following statblock:`;

function validateMonsterData(monster) {
    // Ensure all array fields exist
    monster.special_abilities = monster.special_abilities || [];
    monster.actions = monster.actions || [];
    monster.bonus_actions = monster.bonus_actions || [];
    monster.reactions = monster.reactions || [];
    monster.legendary_actions = monster.legendary_actions || [];

    // Ensure string fields exist
    monster.damage_vulnerabilities = monster.damage_vulnerabilities || '';
    monster.damage_resistances = monster.damage_resistances || '';
    monster.damage_immunities = monster.damage_immunities || '';
    monster.condition_immunities = monster.condition_immunities || '';

    // Generate slug if missing
    if (!monster.slug) {
        monster.slug = 'custom-' + monster.name.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }

    return monster;
}

app.post('/api/parse-statblock', async (req, res) => {
    const { text } = req.body;

    if (!text || text.trim().length < 10) {
        return res.status(400).json({ error: 'Statblock text is required' });
    }

    try {
        const message = await anthropic.messages.create({
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 2048,
            messages: [
                {
                    role: 'user',
                    content: `${PARSE_PROMPT}\n\n${text}`
                }
            ]
        });

        // Extract JSON from response
        const responseText = message.content[0].text;

        // Try to parse JSON (handle if wrapped in markdown code block)
        let jsonStr = responseText;
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1];
        }

        const monster = validateMonsterData(JSON.parse(jsonStr.trim()));

        res.json({ success: true, monster });
    } catch (error) {
        console.error('Parse failed:', error);
        res.status(500).json({
            error: 'Failed to parse statblock',
            details: error.message
        });
    }
});

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

// ============ Portrait Uploads ============

const PORTRAITS_DIR = path.join(__dirname, 'data', 'portraits');

// Ensure portraits directory exists
if (!fs.existsSync(PORTRAITS_DIR)) {
    fs.mkdirSync(PORTRAITS_DIR, { recursive: true });
}

// POST upload portrait
app.post('/upload/portrait', upload.single('portrait'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const id = crypto.randomBytes(8).toString('hex');
        const filename = `${id}.webp`;
        const imagePath = path.join(PORTRAITS_DIR, filename);

        // Process and optimize portrait with Sharp
        await sharp(req.file.buffer)
            .resize(256, 256, { fit: 'cover' })
            .webp({ quality: 80 })
            .toFile(imagePath);

        res.json({ path: `/data/portraits/${filename}` });
    } catch (error) {
        console.error('Portrait upload failed:', error);
        res.status(500).json({ error: 'Failed to process portrait' });
    }
});

// ============ Battlemap State Persistence ============

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

// Start server
app.listen(PORT, () => {
    console.log(`\n  Realm Keeper running at:`);
    console.log(`  → http://localhost:${PORT}\n`);
});
