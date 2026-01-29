/**
 * State management module
 * Handles application state with server persistence
 */

const State = {
    // Default state structure
    defaultState: {
        party: [],           // Array of {id, name, ac, maxHp}
        encounters: [],      // Array of {id, name, monsters: [{slug, name, qty}]}
        currentEncounterId: null,
        activeEncounter: null,  // Runtime combat state (not persisted)
        settings: {}
    },

    state: null,

    /**
     * Initialize state from server
     */
    async init() {
        const saved = await API.loadState();
        if (saved) {
            this.state = { ...this.defaultState, ...saved };

            // Migration: Ensure all party members have hp field
            if (this.state.party) {
                this.state.party.forEach(p => {
                    if (p.hp === undefined) p.hp = p.maxHp;
                });
            }
        } else {
            this.state = { ...this.defaultState };
        }
        return this.state;
    },

    /**
     * Save current state to server
     */
    save() {
        const toSave = {
            party: this.state.party,
            encounters: this.state.encounters,
            activeEncounter: this.state.activeEncounter  // Persist combat state
        };
        API.saveState(toSave);
    },

    /**
     * Generate unique ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    // ============ Party Management ============

    addPartyMember(name, ac, maxHp) {
        const member = {
            id: this.generateId(),
            name,
            ac: parseInt(ac),
            maxHp: parseInt(maxHp),
            hp: parseInt(maxHp)
        };
        this.state.party.push(member);
        this.save();
        return member;
    },

    updatePartyMemberHp(id, hp) {
        const member = this.state.party.find(m => m.id === id);
        if (member) {
            member.hp = Math.max(0, Math.min(hp, member.maxHp));
            this.save();
        }
    },

    removePartyMember(id) {
        this.state.party = this.state.party.filter(m => m.id !== id);
        this.save();
    },

    getParty() {
        return this.state.party;
    },

    // ============ Encounter Management ============

    createEncounter(name) {
        const encounter = {
            id: this.generateId(),
            name: name || 'Untitled Encounter',
            monsters: []
        };
        this.state.encounters.push(encounter);
        this.state.currentEncounterId = encounter.id;
        this.save();
        return encounter;
    },

    getEncounter(id) {
        return this.state.encounters.find(e => e.id === id);
    },

    getCurrentEncounter() {
        return this.getEncounter(this.state.currentEncounterId);
    },

    setCurrentEncounter(id) {
        this.state.currentEncounterId = id;
        this.save();
    },

    updateEncounter(id, updates) {
        const encounter = this.getEncounter(id);
        if (encounter) {
            Object.assign(encounter, updates);
            this.save();
        }
        return encounter;
    },

    deleteEncounter(id) {
        this.state.encounters = this.state.encounters.filter(e => e.id !== id);
        if (this.state.currentEncounterId === id) {
            this.state.currentEncounterId = null;
        }
        this.save();
    },

    linkMapToEncounter(encounterId, mapId) {
        const encounter = this.getEncounter(encounterId);
        if (!encounter) return false;
        encounter.linkedMapId = mapId;
        this.save();
        return true;
    },

    unlinkMapFromEncounter(encounterId) {
        const encounter = this.getEncounter(encounterId);
        if (!encounter) return false;
        delete encounter.linkedMapId;
        this.save();
        return true;
    },

    addMonsterToEncounter(encounterId, monster) {
        const encounter = this.getEncounter(encounterId);
        if (!encounter) return;

        const existing = encounter.monsters.find(m => m.slug === monster.slug);
        if (existing) {
            existing.qty++;
        } else {
            encounter.monsters.push({
                slug: monster.slug,
                name: monster.name,
                cr: monster.cr,
                qty: 1
            });
        }
        this.save();
    },

    updateMonsterQty(encounterId, slug, qty) {
        const encounter = this.getEncounter(encounterId);
        if (!encounter) return;

        const monster = encounter.monsters.find(m => m.slug === slug);
        if (monster) {
            monster.qty = Math.max(0, qty);
            if (monster.qty === 0) {
                encounter.monsters = encounter.monsters.filter(m => m.slug !== slug);
            }
        }
        this.save();
    },

    removeMonsterFromEncounter(encounterId, slug) {
        const encounter = this.getEncounter(encounterId);
        if (!encounter) return;

        encounter.monsters = encounter.monsters.filter(m => m.slug !== slug);
        this.save();
    },

    getAllEncounters() {
        return this.state.encounters;
    },

    /**
     * Save a scene (map + tokens) to an encounter
     * @param {string} encounterId - ID of encounter to save scene to
     * @param {Object} sceneData - Scene data containing mapId, tokens, grid settings, etc.
     */
    saveEncounterScene(encounterId, sceneData) {
        const encounter = this.getEncounter(encounterId);
        if (!encounter) return false;

        encounter.scene = {
            mapId: sceneData.mapId || null,
            gridSize: sceneData.gridSize,
            showGrid: sceneData.showGrid,
            tokens: sceneData.tokens || [],
            zoom: sceneData.zoom ?? 1,
            panX: sceneData.panX ?? 0,
            panY: sceneData.panY ?? 0,
            aoeShapes: sceneData.aoeShapes || [],
            fogEnabled: sceneData.fogEnabled ?? false,
            fogData: sceneData.fogData || null,
            savedAt: new Date().toISOString()
        };
        this.save();
        return true;
    },

    /**
     * Get saved scene for an encounter
     * @param {string} encounterId - ID of encounter
     * @returns {Object|null} Scene configuration or null if not saved
     */
    getEncounterScene(encounterId) {
        const encounter = this.getEncounter(encounterId);
        return encounter?.scene || null;
    },

    /**
     * Clear saved scene from an encounter
     * @param {string} encounterId - ID of encounter
     */
    clearEncounterScene(encounterId) {
        const encounter = this.getEncounter(encounterId);
        if (!encounter) return;

        delete encounter.scene;
        this.save();
    },

    // ============ Active Combat State ============

    /**
     * Initialize active encounter for combat
     * @param {string} encounterId - ID of encounter to run
     * @param {Array} combatants - Array of {id, name, initiative, ac, hp, maxHp, isPlayer, slug?}
     */
    initActiveCombat(encounterId, combatants) {
        // Sort by initiative (descending)
        combatants.sort((a, b) => b.initiative - a.initiative);

        this.state.activeEncounter = {
            encounterId,
            combatants,
            currentTurn: 0,
            round: 1
        };
        this.save();
    },

    getActiveCombat() {
        return this.state.activeEncounter;
    },

    getCurrentCombatant() {
        const active = this.state.activeEncounter;
        if (!active) return null;
        return active.combatants[active.currentTurn];
    },

    nextTurn() {
        const active = this.state.activeEncounter;
        if (!active) return;

        active.currentTurn++;
        if (active.currentTurn >= active.combatants.length) {
            active.currentTurn = 0;
            active.round++;
        }
        this.save();
    },

    prevTurn() {
        const active = this.state.activeEncounter;
        if (!active) return;

        active.currentTurn--;
        if (active.currentTurn < 0) {
            active.currentTurn = active.combatants.length - 1;
            active.round = Math.max(1, active.round - 1);
        }
        this.save();
    },

    updateCombatantHp(combatantId, newHp) {
        const active = this.state.activeEncounter;
        if (!active) return;

        const combatant = active.combatants.find(c => c.id === combatantId);
        if (combatant) {
            combatant.hp = Math.max(0, Math.min(newHp, combatant.maxHp));
            this.save();
        }
    },

    endCombat() {
        // Sync HP back to worldManager for all persistent characters (players, sidekicks, NPCs)
        if (this.state.activeEncounter && window.worldManager) {
            this.state.activeEncounter.combatants.forEach(c => {
                // Sync any character that has a type (party members from worldManager)
                if (c.characterType || c.isPlayer || c.isSidekick || c.isNpc) {
                    const character = window.worldManager.getCharacter(c.id);
                    if (character && character.stats) {
                        window.worldManager.updateCharacter(c.id, {
                            stats: {
                                ...character.stats,
                                hp: c.hp
                            }
                        });
                    }
                }
            });
        }

        this.state.activeEncounter = null;
        this.save();
    }
};
