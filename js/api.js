/**
 * API module
 * Handles fetching monster data via local proxy and state persistence
 */

const API = {
    cache: new Map(),

    /**
     * Search for monsters by name (via local proxy)
     */
    async searchMonsters(query) {
        if (query.length < 2) return [];

        const cacheKey = `search:${query.toLowerCase()}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const response = await fetch(`/api/monsters?search=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('API request failed');

            const data = await response.json();
            const results = data.results.map(m => ({
                slug: m.slug,
                name: m.name,
                cr: m.cr,
                type: m.type,
                size: m.size
            }));

            this.cache.set(cacheKey, results);
            return results;
        } catch (error) {
            console.error('Monster search failed:', error);
            return [];
        }
    },

    /**
     * Get full monster details by slug (via local proxy)
     */
    async getMonster(slug) {
        const cacheKey = `monster:${slug}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const response = await fetch(`/api/monsters/${slug}`);
            if (!response.ok) throw new Error('API request failed');

            const monster = await response.json();
            this.cache.set(cacheKey, monster);
            return monster;
        } catch (error) {
            console.error('Failed to fetch monster:', error);
            return null;
        }
    },

    /**
     * Load state from server
     */
    async loadState() {
        try {
            const response = await fetch('/api/state');
            if (!response.ok) throw new Error('Failed to load state');
            return await response.json();
        } catch (error) {
            console.error('Failed to load state:', error);
            return null;
        }
    },

    /**
     * Save state to server
     */
    async saveState(state) {
        try {
            const response = await fetch('/api/state', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(state)
            });
            return response.ok;
        } catch (error) {
            console.error('Failed to save state:', error);
            return false;
        }
    },

    /**
     * Extract ability modifier from score
     * @param {number} score - Ability score
     * @returns {number} Modifier
     */
    getModifier(score) {
        return Math.floor((score - 10) / 2);
    },

    /**
     * Format modifier for display (+2, -1, etc)
     * @param {number} mod - Modifier value
     * @returns {string} Formatted modifier
     */
    formatModifier(mod) {
        return mod >= 0 ? `+${mod}` : `${mod}`;
    },

    /**
     * Parse attack string to extract attack bonus
     * Returns the modifier from strings like "+5 to hit"
     * @param {string} desc - Action description
     * @returns {number|null} Attack modifier or null
     */
    parseAttackBonus(desc) {
        const match = desc.match(/([+-]\d+)\s+to\s+hit/i);
        return match ? parseInt(match[1]) : null;
    },

    /**
     * Parse damage dice from action description
     * Returns array of {dice, type} objects
     * @param {string} desc - Action description
     * @returns {Array} Array of damage objects
     */
    parseDamage(desc) {
        const damages = [];
        // Match patterns like "2d6 + 3 slashing" or "1d8+2 piercing"
        const regex = /(\d+d\d+(?:\s*[+-]\s*\d+)?)\s*(\w+)\s+damage/gi;
        let match;

        while ((match = regex.exec(desc)) !== null) {
            damages.push({
                dice: match[1].replace(/\s+/g, ''),
                type: match[2]
            });
        }

        return damages;
    },

    // ============ Custom Monsters ============

    /**
     * Parse raw statblock text using AI
     */
    async parseStatblock(text) {
        try {
            const response = await fetch('/api/parse-statblock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Parse failed');
            return data.monster;
        } catch (error) {
            console.error('Statblock parse failed:', error);
            throw error;
        }
    },

    /**
     * Get all custom monsters
     */
    async getCustomMonsters() {
        try {
            const response = await fetch('/api/custom-monsters');
            if (!response.ok) throw new Error('Failed to fetch custom monsters');
            return await response.json();
        } catch (error) {
            console.error('Failed to fetch custom monsters:', error);
            return [];
        }
    },

    /**
     * Save a custom monster
     */
    async saveCustomMonster(monster) {
        try {
            const response = await fetch('/api/custom-monsters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(monster)
            });
            return response.ok;
        } catch (error) {
            console.error('Failed to save custom monster:', error);
            return false;
        }
    },

    /**
     * Delete a custom monster
     */
    async deleteCustomMonster(slug) {
        try {
            const response = await fetch(`/api/custom-monsters/${slug}`, {
                method: 'DELETE'
            });
            return response.ok;
        } catch (error) {
            console.error('Failed to delete custom monster:', error);
            return false;
        }
    },

    // ============ Spells API ============

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

    spellSchools: {
        abjuration: { icon: '\u{1F6E1}\uFE0F', color: '#4A90D9' },
        conjuration: { icon: '\u{1F300}', color: '#9B59B6' },
        divination: { icon: '\u{1F441}\uFE0F', color: '#F1C40F' },
        enchantment: { icon: '\u{1F4AB}', color: '#E91E8C' },
        evocation: { icon: '\u{1F525}', color: '#E74C3C' },
        illusion: { icon: '\u{1F3AD}', color: '#1ABC9C' },
        necromancy: { icon: '\u{1F480}', color: '#2C3E50' },
        transmutation: { icon: '\u2697\uFE0F', color: '#27AE60' }
    },

    getSchoolInfo(school) {
        return this.spellSchools[school?.toLowerCase()] || { icon: '\u2728', color: '#888' };
    },

    // ============ Map Library API ============

    /**
     * Get all maps (metadata only)
     */
    async getMaps() {
        const res = await fetch('/api/maps');
        return res.ok ? res.json() : [];
    },

    /**
     * Get map image URL by ID
     */
    getMapImageUrl(mapId) {
        return `/api/maps/${mapId}/image`;
    },

    /**
     * Upload a new map
     */
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

    /**
     * Update map metadata
     */
    async updateMap(mapId, updates) {
        const res = await fetch(`/api/maps/${mapId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        return res.ok;
    },

    /**
     * Delete a map
     */
    async deleteMap(mapId) {
        const res = await fetch(`/api/maps/${mapId}`, { method: 'DELETE' });
        return res.ok;
    },

    // ============ Battlemap State Persistence ============

    /**
     * Load battlemap state from server
     */
    async loadBattlemapState() {
        const res = await fetch('/api/battlemap-state');
        return res.ok ? res.json() : null;
    },

    /**
     * Save battlemap state to server
     */
    async saveBattlemapState(state) {
        const res = await fetch('/api/battlemap-state', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state)
        });
        return res.ok;
    }
};

