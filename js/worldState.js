/**
 * WorldManager - Manages persistent world state (characters, locations, party position)
 * Separate from encounter/combat state in state.json
 */
class WorldManager {
    constructor() {
        this.data = null;
        this.serverUrl = ''; // Uses relative URLs
    }

    async load() {
        try {
            const response = await fetch('/data/world.json');
            if (response.ok) {
                this.data = await response.json();
            } else {
                console.warn("world.json not found, initializing empty.");
                this.data = this._getInitialState();
            }
        } catch (e) {
            console.error("Failed to load world data", e);
            this.data = this._getInitialState();
        }
        return this.data;
    }

    async save() {
        if (!this.data) return;
        try {
            await fetch('/save/world', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.data)
            });
        } catch (e) {
            console.error("Failed to save world data", e);
        }
    }

    // Character CRUD operations
    getCharacter(id) {
        if (!this.data) return null;
        return this.data.characters.find(c => c.id === id);
    }

    getCharactersByLocation(locationId) {
        if (!this.data) return [];
        return this.data.characters.filter(c => c.location === locationId);
    }

    getPartyMembers() {
        if (!this.data) return [];
        return this.data.characters.filter(c => c.location === 'party');
    }

    getAllCharacters() {
        return this.data?.characters || [];
    }

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

    getLocationName(locationId) {
        if (locationId === 'party') return 'Party';
        if (!locationId) return 'Unassigned';
        const loc = this.getLocation(locationId);
        return loc ? loc.name : 'Unassigned';
    }

    updateCharacter(id, updates) {
        const char = this.getCharacter(id);
        if (char) {
            Object.assign(char, updates);
            this.save();
        }
        return char;
    }

    addCharacter(character) {
        if (!this.data) return null;
        const newChar = {
            id: character.id || `char_${Date.now()}`,
            type: character.type || 'npc',
            name: character.name || 'Unknown',
            portrait: character.portrait || '',
            location: character.location ?? null,
            stats: character.stats || null,
            abilities: character.abilities || null,
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

    removeCharacter(id) {
        if (!this.data) return false;
        const index = this.data.characters.findIndex(c => c.id === id);
        if (index >= 0) {
            this.data.characters.splice(index, 1);
            this.save();
            return true;
        }
        return false;
    }

    // Location operations
    getLocation(id) {
        if (!this.data) return null;
        return this.data.locations.find(l => l.id === id);
    }

    addLocation(location) {
        if (!this.data) return null;
        const newLoc = {
            id: location.id || `loc_${Date.now()}`,
            name: location.name || 'Unknown Location',
            type: location.type || 'point',
            x: location.x || 0,
            y: location.y || 0,
            linkedMapId: location.linkedMapId || null,
            description: location.description || ''
        };
        this.data.locations.push(newLoc);
        this.save();
        return newLoc;
    }

    updateLocation(id, updates) {
        const loc = this.getLocation(id);
        if (loc) {
            Object.assign(loc, updates);
            this.save();
        }
        return loc;
    }

    removeLocation(id) {
        if (!this.data) return false;
        const index = this.data.locations.findIndex(l => l.id === id);
        if (index >= 0) {
            this.data.locations.splice(index, 1);
            this.save();
            return true;
        }
        return false;
    }

    // Party operations
    moveParty(locationId, position = null) {
        if (!this.data) return;
        this.data.party.locationId = locationId;
        if (position) {
            this.data.party.position = position;
        }
        this.save();
    }

    setPartyState(state) {
        if (!this.data) return;
        this.data.party.state = state; // 'idle', 'traveling', 'combat'
        this.save();
    }

    updatePartyLocation(locationId) {
        // Alias for moveParty - updates location without changing position
        if (!this.data) return;
        this.data.party.locationId = locationId;
        this.save();
    }

    // Viewport operations
    setViewport(x, y, zoom = null) {
        if (!this.data) return;
        this.data.viewport.x = x;
        this.data.viewport.y = y;
        if (zoom !== null) {
            this.data.viewport.zoom = zoom;
        }
        this.save();
    }

    _getInitialState() {
        return {
            viewport: { x: 0, y: 0, zoom: 1 },
            party: { locationId: null, position: { x: 0, y: 0 }, state: 'idle' },
            locations: [],
            characters: []
        };
    }
}

// Export singleton
const worldManager = new WorldManager();

// Make globally available
window.worldManager = worldManager;
