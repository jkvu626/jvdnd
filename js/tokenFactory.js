/**
 * TokenFactory - Creates and hydrates tokens from various data sources
 * Supports loading from encounters (combat mode) or world registry (explore mode)
 */

const MAP_MODES = {
    EXPLORE: 'explore',
    COMBAT: 'combat'
};

class TokenFactory {
    /**
     * Centralized size mapping for creature sizes to grid squares
     */
    static SIZE_MAP = {
        Tiny: 0.5, Small: 1, Medium: 1, Large: 2, Huge: 3, Gargantuan: 4
    };

    /**
     * Centralized color palette for token types
     */
    static TYPE_COLORS = {
        player: '#3B5998',     // Blue for players
        sidekick: '#2E5D4B',   // Green for sidekicks
        companion: '#2E5D4B',  // Alias for sidekick
        npc: '#6B4C9A',        // Purple for NPCs
        monster: '#C84B31'     // Red for monsters
    };

    /**
     * Create tokens for a map based on context
     * @param {Object} context - { locationId, encounterId }
     * @returns {Promise<Array>} Array of token data objects
     */
    static async createTokensForMap(context) {
        let tokenDataList = [];

        if (context.encounterId) {
            // Combat Mode: Load from Encounter via State
            const encounter = State.getEncounter(context.encounterId);
            if (encounter && encounter.combatants) {
                tokenDataList = encounter.combatants;
            } else if (encounter && encounter.monsters) {
                // Fall back to monsters if no combatants yet
                tokenDataList = encounter.monsters.flatMap(m =>
                    Array(m.qty || 1).fill().map((_, i) => ({
                        slug: m.slug,
                        name: `${m.name}${m.qty > 1 ? ` ${i + 1}` : ''}`,
                        cr: m.cr
                    }))
                );
            }
        } else if (context.locationId && window.worldManager?.data) {
            // Explore Mode: Load from World Registry
            const worldData = window.worldManager.data;

            // Find all characters currently in this location
            const characters = worldData.characters.filter(c => c.location === context.locationId);
            tokenDataList = [...tokenDataList, ...characters];

            // Also add the party if they are here
            if (worldData.party.locationId === context.locationId) {
                const partyMembers = worldData.characters.filter(c => c.location === 'party');
                tokenDataList = [...tokenDataList, ...partyMembers];
            }
        }

        return tokenDataList.map(data => TokenFactory.hydrate(data));
    }

    /**
     * Hydrate a token from raw data, merging with persistent registry if applicable
     * @param {Object} data - Raw token/character data
     * @returns {Object} Hydrated token data
     */
    static hydrate(data) {
        let stats = { ...data };

        // Check if this is a pointer to a persistent character (Soul)
        if (data.characterId && window.worldManager) {
            const realChar = window.worldManager.getCharacter(data.characterId);
            if (realChar) {
                // Merge Persistent stats onto the token representation
                stats = {
                    ...data,              // Initiative, specific position
                    ...realChar,          // Name, HP, AC from registry
                    isPersistent: true    // Mark as linked to registry
                };
            }
        }

        // Normalize token properties
        return {
            id: stats.id || `token_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: stats.name || 'Unknown',
            slug: stats.slug || null,
            color: stats.color || TokenFactory.getColorForType(stats.type),
            size: stats.size || 1,
            hp: stats.hp ?? stats.stats?.hp ?? null,
            maxHp: stats.maxHp ?? stats.stats?.maxHp ?? null,
            ac: stats.ac ?? stats.stats?.ac ?? null,
            isPersistent: stats.isPersistent || false,
            characterId: stats.characterId || null,
            isPlayer: stats.type === 'player' || stats.isPlayer || false,
            x: stats.x ?? 0,
            y: stats.y ?? 0
        };
    }

    /**
     * Get default color based on character type
     */
    static getColorForType(type) {
        return TokenFactory.TYPE_COLORS[type] || TokenFactory.TYPE_COLORS.monster;
    }


    /**
     * Sync token HP back to the world registry (for persistent characters)
     * @param {Object} token - Token with updated HP
     */
    static syncToRegistry(token) {
        if (!token.isPersistent || !token.characterId || !window.worldManager) return;

        window.worldManager.updateCharacter(token.characterId, {
            stats: {
                hp: token.hp,
                maxHp: token.maxHp,
                ac: token.ac
            }
        });
    }
}

// Export to global scope
window.MAP_MODES = MAP_MODES;
window.TokenFactory = TokenFactory;
