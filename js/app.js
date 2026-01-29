/**
 * Main application - event binding and orchestration
 */

const App = {
    searchTimeout: null,
    monsterCache: new Map(),

    // Dice Builder State
    diceBuilder: {
        selectedDice: {},  // { 6: 2, 8: 1 } = 2d6 + 1d8
        modifier: 0,
        rollMode: 'normal' // 'normal', 'advantage', 'disadvantage'
    },

    async init() {
        await State.init();
        UI.init();
        this.bindEvents();
        this.render();
    },

    bindEvents() {
        // Mode switching (Run mode removed - redirects to Map + Initiative tab)
        UI.elements.btnWorldMode.addEventListener('click', () => this.switchMode('world'));
        UI.elements.btnPrepMode.addEventListener('click', () => this.switchMode('prep'));
        UI.elements.btnPartyMode.addEventListener('click', () => this.switchMode('party'));
        UI.elements.btnMapMode.addEventListener('click', () => this.switchMode('map'));
        UI.elements.btnBestiaryMode.addEventListener('click', () => this.switchMode('bestiary'));
        UI.elements.btnSpellbookMode.addEventListener('click', () => this.switchMode('spellbook'));

        // Prep mode
        UI.elements.btnNewEncounter.addEventListener('click', () => this.createEncounter());
        UI.elements.encountersList.addEventListener('click', (e) => this.onEncounterClick(e));
        UI.elements.encounterName.addEventListener('input', (e) => this.onEncounterNameChange(e));
        UI.elements.monsterSearch.addEventListener('input', (e) => this.onMonsterSearch(e));
        UI.elements.searchResults.addEventListener('click', (e) => this.onSearchResultClick(e));
        UI.elements.encounterMonsters.addEventListener('click', (e) => this.onMonsterCardClick(e));
        UI.elements.btnSaveEncounter.addEventListener('click', () => this.saveEncounter());

        UI.elements.btnRunEncounter.addEventListener('click', () => this.startEncounter());
        UI.elements.btnDeleteEncounter.addEventListener('click', () => this.deleteEncounter());
        UI.elements.btnLinkMap?.addEventListener('click', () => this.openMapLibraryForLinking());
        UI.elements.linkedMapDisplay?.addEventListener('click', (e) => this.onLinkedMapClick(e));

        // Party/Character mode
        UI.elements.btnAddPc?.addEventListener('click', () => this.addPartyMember());
        UI.elements.partyList?.addEventListener('click', (e) => this.onCharacterCardClick(e));
        UI.elements.charSearch?.addEventListener('input', (e) => this.onCharacterSearch(e));
        UI.elements.charType?.addEventListener('change', (e) => this.onCharacterTypeChange(e));
        UI.elements.charBaseCreature?.addEventListener('input', (e) => this.onSidekickSearch(e));
        UI.elements.sidekickCreatureResults?.addEventListener('click', (e) => this.onSidekickResultClick(e));

        // Combat controls (now inside Command Center Initiative tab)
        UI.elements.btnNextTurn.addEventListener('click', () => this.nextTurn());
        UI.elements.btnPrevTurn.addEventListener('click', () => this.prevTurn());
        UI.elements.btnNextTurnIndicator.addEventListener('click', () => this.nextTurn());
        UI.elements.btnPrevTurnIndicator.addEventListener('click', () => this.prevTurn());
        UI.elements.btnEndEncounter.addEventListener('click', () => this.endEncounter());
        UI.elements.initiativeList.addEventListener('click', (e) => this.onInitiativeItemClick(e));
        UI.elements.initiativeList.addEventListener('change', (e) => this.onHpChange(e));
        UI.elements.activeStatblock.addEventListener('click', (e) => this.onStatblockRollClick(e));

        // Dice builder
        this.initDiceBuilder();

        // Modal
        UI.elements.btnStartCombat.addEventListener('click', () => this.onStartCombat());

        // Command Center: Tab switching
        document.querySelectorAll('.cc-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });

        // Command Center: Right sidebar toggle
        const toggleBtn = document.getElementById('btn-toggle-right-sidebar');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleRightSidebar());
        }

        // Command Center: Left sidebar collapse
        const collapseLeftBtn = document.getElementById('btn-collapse-left');
        if (collapseLeftBtn) {
            collapseLeftBtn.addEventListener('click', () => this.toggleLeftSidebar());
        }

        // Command Center: Left sidebar expand (visible when collapsed)
        const expandLeftBtn = document.getElementById('btn-expand-left');
        if (expandLeftBtn) {
            expandLeftBtn.addEventListener('click', () => this.toggleLeftSidebar());
        }

        // Import modal
        UI.elements.btnImportMonster.addEventListener('click', () => UI.showImportModal());
        UI.elements.btnCancelImport.addEventListener('click', () => UI.hideImportModal());
        UI.elements.btnParseImport.addEventListener('click', () => this.parseImportedStatblock());
        UI.elements.btnSaveImport.addEventListener('click', () => this.saveImportedMonster());

        // Bestiary
        UI.elements.bestiarySearchInput.addEventListener('input', (e) => this.onBestiarySearch(e));
        UI.elements.bestiarySearchResults.addEventListener('click', (e) => this.onBestiaryResultClick(e));
        UI.elements.customMonstersList.addEventListener('click', (e) => this.onCustomMonsterCardClick(e));

        // Map Library modal
        const btnOpenLibrary = document.getElementById('btn-open-library');
        const mapLibraryModal = document.getElementById('map-library-modal');
        const mapLibraryGrid = document.getElementById('map-library-grid');
        const mapLibraryEmpty = document.getElementById('map-library-empty');
        const mapSearch = document.getElementById('map-search');
        const btnUploadToLibrary = document.getElementById('btn-upload-to-library');
        const mapLibraryUpload = document.getElementById('map-library-upload');
        const btnCloseLibrary = document.getElementById('btn-close-library');

        // Store references for methods
        this._mapLibraryElements = {
            modal: mapLibraryModal,
            grid: mapLibraryGrid,
            empty: mapLibraryEmpty,
            search: mapSearch,
            uploadBtn: btnUploadToLibrary,
            uploadInput: mapLibraryUpload
        };

        btnOpenLibrary.addEventListener('click', () => this.openMapLibrary());
        btnCloseLibrary.addEventListener('click', () => this.closeMapLibrary());
        btnUploadToLibrary.addEventListener('click', () => mapLibraryUpload.click());
        mapLibraryUpload.addEventListener('change', (e) => this.uploadToLibrary(e));
        mapSearch.addEventListener('input', (e) => this.filterMapLibrary(e.target.value));
        mapLibraryGrid.addEventListener('click', (e) => this.onMapCardClick(e));

        // Modal backdrop click to close
        mapLibraryModal.addEventListener('click', (e) => {
            if (e.target === mapLibraryModal) {
                this.closeMapLibrary();
            }
        });

        // Close search on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.monster-search')) UI.hideSearchResults();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Close modals on Escape
            if (e.key === 'Escape') {
                UI.hideImportModal();
                UI.hideInitiativeModal();
                this.closeMapLibrary();
            }
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === 'ArrowRight' || e.key === 'n') this.nextTurn();
            if (e.key === 'ArrowLeft' || e.key === 'p') this.prevTurn();
        });

        // World Map -> Battlemap Navigation
        document.addEventListener('enterLocation', async (e) => {
            await this.loadLocation(e.detail.location.id);
        });

        // Explore -> Combat transition
        document.addEventListener('startCombatFromExplore', async () => {
            await this.transitionToCombat();
        });
    },

    render() {
        UI.renderEncountersList(State.getAllEncounters(), State.state.currentEncounterId);
        UI.renderPartyList(State.getParty());
        const current = State.getCurrentEncounter();
        if (current) UI.showEncounterForm(current);
        else UI.hideEncounterForm();
        if (State.getActiveCombat()) {
            UI.showCombatView();
            this.renderCombat();
        } else {
            UI.hideCombatView();
        }
        this.updateCombatIndicator();
    },

    updateCombatIndicator() {
        const indicator = document.getElementById('combat-indicator');
        const indicatorText = document.getElementById('combat-indicator-text');
        const combat = State.getActiveCombat();

        if (combat) {
            indicator.classList.remove('hidden');
            // Get current combatant name
            const currentCombatant = combat.combatants[combat.currentTurn];
            const turnInfo = currentCombatant ? currentCombatant.name : '';
            indicatorText.textContent = turnInfo ? `Combat: ${turnInfo}'s turn` : 'Combat Active';
        } else {
            indicator.classList.add('hidden');
        }
    },

    async switchMode(mode) {
        // Redirect legacy 'run' mode to map + initiative tab
        if (mode === 'run') {
            mode = 'map';
            UI.showMode(mode);
            await this._ensureBattlemapReady();
            this.openInitiativeTab();
            if (State.getActiveCombat()) this.renderCombat();
            return;
        }

        UI.showMode(mode);
        if (mode === 'map') {
            await this._ensureBattlemapReady();
            if (State.getActiveCombat()) this.renderCombat();
        }
        if (mode === 'bestiary') {
            await this.loadCustomMonsters();
        }
        if (mode === 'spellbook') {
            Spellbook.initialize();
        }
        if (mode === 'world') {
            await this._ensureWorldMapReady();
        }
        if (mode === 'party') {
            // Ensure world data is loaded for character management
            if (!window.worldManager.data) {
                await window.worldManager.load();
            }
            this.renderPartyMode();
        }
    },

    // World Map initialization
    worldMapRenderer: null,

    async _ensureWorldMapReady() {
        // Load world data if needed
        if (!window.worldManager.data) {
            await window.worldManager.load();
        }

        // Initialize renderer if needed
        if (!this.worldMapRenderer) {
            this.worldMapRenderer = new WorldMapRenderer('world-map-container', window.worldManager);

            // Bind zoom controls
            document.getElementById('btn-world-zoom-in')?.addEventListener('click', () => {
                this.worldMapRenderer.zoomIn();
            });
            document.getElementById('btn-world-zoom-out')?.addEventListener('click', () => {
                this.worldMapRenderer.zoomOut();
            });
            document.getElementById('btn-world-reset')?.addEventListener('click', () => {
                this.worldMapRenderer.resetView();
            });

            // Initialize DM tools
            this.worldMapRenderer.initDMTools();
        }

        // Pre-load map library for linking
        try {
            const maps = await API.getMaps();
            this.worldMapRenderer.setMapLibrary(maps);
        } catch (e) {
            console.warn('Could not load map library for world mode');
        }

        // Render the world map
        this.worldMapRenderer.render();
    },

    async _ensureBattlemapReady() {
        if (!Battlemap.canvas) {
            await Battlemap.init();
            this.setupSelectionSync();
        }
        Battlemap.resizeCanvas();
        Battlemap.render();
        Battlemap.renderTokenList();

        // Setup mode toggle buttons
        this.setupModeToggle();
    },

    // Mode toggle (Explore / Combat)
    setupModeToggle() {
        const btnExplore = document.getElementById('btn-explore');
        const btnCombat = document.getElementById('btn-combat');
        const mapMode = document.getElementById('map-mode');

        if (!btnExplore || !btnCombat) return;

        btnExplore.addEventListener('click', () => {
            Battlemap.setMode('explore');
        });

        btnCombat.addEventListener('click', () => {
            Battlemap.setMode('combat');
        });

        // Listen for mode changes to update UI
        document.addEventListener('battlemapModeChange', (e) => {
            const { newMode } = e.detail;
            btnExplore.classList.toggle('active', newMode === 'explore');
            btnCombat.classList.toggle('active', newMode === 'combat');
            // Update sidebar context based on mode
            UI.setSidebarContext(newMode);

            // Toggle explore-mode class for hiding sidebars
            if (mapMode) {
                mapMode.classList.toggle('explore-mode', newMode === 'explore');
            }

            // Resize canvas after CSS layout settles (sidebar hidden/shown)
            requestAnimationFrame(() => {
                if (Battlemap.canvas) {
                    Battlemap.resizeCanvas();
                    Battlemap.render();
                }
            });
        });

        // Sync initial state
        btnExplore.classList.toggle('active', Battlemap.state.mode === 'explore');
        btnCombat.classList.toggle('active', Battlemap.state.mode === 'combat');
        if (mapMode) {
            mapMode.classList.toggle('explore-mode', Battlemap.state.mode === 'explore');
        }
    },

    // ============ World/Battlemap Navigation ============

    /**
     * Load a location from the world map into the battlemap
     * @param {string} locationId - The location to load
     */
    async loadLocation(locationId) {
        // 1. Get Location Data
        const location = window.worldManager.data?.locations.find(l => l.id === locationId);
        if (!location) {
            console.error('Location not found:', locationId);
            return;
        }

        // 2. Update Party Location in World State
        window.worldManager.updatePartyLocation(locationId);

        // 3. Switch to Map Tab
        this.switchMode('map');

        // 4. Wait for battlemap to be ready
        await this._ensureBattlemapReady();

        // 5. Load the linked map if available
        if (location.linkedMapId) {
            try {
                await Battlemap.loadFromLibrary(location.linkedMapId);
            } catch (err) {
                console.warn('Could not load linked map:', err);
            }
        }

        // 6. Hydrate tokens from world registry for explore mode
        const tokens = await TokenFactory.createTokensForMap({ locationId });
        if (tokens.length > 0) {
            // Place tokens on the map
            tokens.forEach((tokenData, i) => {
                // Spread tokens out if no position data
                const x = tokenData.x ?? (2 + (i % 5));
                const y = tokenData.y ?? (2 + Math.floor(i / 5));
                Battlemap.addToken(
                    tokenData.name,
                    tokenData.color || Battlemap.getTokenColor(tokenData.name),
                    tokenData.size || 1,
                    tokenData.slug,
                    tokenData.characterId
                );
                // Update position (addToken places at 5,5 by default)
                const addedToken = Battlemap.state.tokens[Battlemap.state.tokens.length - 1];
                if (addedToken) {
                    addedToken.x = x;
                    addedToken.y = y;
                    addedToken.hp = tokenData.hp;
                    addedToken.maxHp = tokenData.maxHp;
                    addedToken.isPersistent = tokenData.isPersistent;
                    addedToken.characterId = tokenData.characterId;
                }
            });
        }

        // 7. Set to Explore mode
        Battlemap.setMode('explore');
        Battlemap.render();
    },

    /**
     * Transition from Explore mode to Combat mode
     * Snapshots token positions and initiates combat
     */
    async transitionToCombat() {
        if (!Battlemap.canvas) return;

        // 1. Snapshot current token positions
        const combatants = Battlemap.state.tokens.map(token => ({
            id: token.id,
            name: token.name,
            hp: token.hp,
            maxHp: token.maxHp,
            ac: token.ac || 10,
            slug: token.slug,
            x: token.x,
            y: token.y,
            characterId: token.characterId,
            isPersistent: token.isPersistent,
            isPlayer: token.isPlayer || false,
            initiative: 0, // Will be set by initiative modal
            hasToken: true
        }));

        // 2. Create an ad-hoc encounter or use current
        let encounter = State.getCurrentEncounter();
        if (!encounter) {
            encounter = State.createEncounter('Quick Battle');
        }

        // 3. Switch to Combat mode
        Battlemap.setMode('combat');

        // 4. Start combat with the current tokens
        // This triggers the initiative modal flow
        State.state.activeCombat = {
            encounterId: encounter.id,
            combatants: combatants,
            round: 1,
            currentTurn: 0
        };

        // 5. Show initiative modal for player characters
        const players = combatants.filter(c => c.isPlayer);
        if (players.length > 0) {
            UI.showInitiativeModal(players);
        } else {
            // No players, just start combat
            this.renderCombat();
        }

        UI.showCombatView();
        this.render();
    },

    // Encounter management
    createEncounter() {
        const encounter = State.createEncounter('New Encounter');
        this.render();
    },

    onEncounterClick(e) {
        const item = e.target.closest('.encounter-item');
        if (!item) return;

        const encounterId = item.dataset.id;
        State.setCurrentEncounter(encounterId);

        this.render();
    },

    onEncounterNameChange(e) {
        const encounter = State.getCurrentEncounter();
        if (encounter) encounter.name = e.target.value;
    },

    saveEncounter() {
        State.save();
        this.render();
    },

    deleteEncounter() {
        const current = State.getCurrentEncounter();
        if (current) {
            State.deleteEncounter(current.id);
            this.render();
        }
    },


    // Monster search
    onMonsterSearch(e) {
        clearTimeout(this.searchTimeout);
        const query = e.target.value.trim();
        if (query.length < 2) { UI.hideSearchResults(); return; }
        this.searchTimeout = setTimeout(async () => {
            const results = await API.searchMonsters(query);
            UI.renderSearchResults(results);
        }, 300);
    },

    onSearchResultClick(e) {
        const item = e.target.closest('.search-result-item');
        if (!item) return;
        const encounter = State.getCurrentEncounter();
        if (!encounter) return;
        State.addMonsterToEncounter(encounter.id, {
            slug: item.dataset.slug,
            name: item.dataset.name,
            cr: item.dataset.cr
        });
        UI.renderEncounterMonsters(encounter.monsters);
        UI.elements.monsterSearch.value = '';
        UI.hideSearchResults();


    },

    onMonsterCardClick(e) {
        const card = e.target.closest('.combatant-card');
        if (!card) return;
        const slug = card.dataset.slug;
        const encounter = State.getCurrentEncounter();
        if (!encounter) return;
        if (e.target.classList.contains('qty-plus')) {
            const m = encounter.monsters.find(m => m.slug === slug);
            if (m) State.updateMonsterQty(encounter.id, slug, m.qty + 1);
        } else if (e.target.classList.contains('qty-minus')) {
            const m = encounter.monsters.find(m => m.slug === slug);
            if (m) State.updateMonsterQty(encounter.id, slug, m.qty - 1);
        } else if (e.target.classList.contains('remove-btn')) {
            State.removeMonsterFromEncounter(encounter.id, slug);
        }
        UI.renderEncounterMonsters(encounter.monsters);


    },

    // Party/Character management
    selectedCharacterId: null,

    async addPartyMember() {
        const name = document.getElementById('char-name')?.value.trim();
        const type = document.getElementById('char-type')?.value || 'player';
        let ac = parseInt(document.getElementById('char-ac')?.value) || null;
        let hp = parseInt(document.getElementById('char-hp')?.value) || null;
        const location = document.getElementById('char-location')?.value || 'party';

        if (!name) return;

        const charData = {
            name,
            type,
            location
        };

        // Add type-specific fields
        if (type === 'player') {
            charData.class = document.getElementById('char-class')?.value || null;
            charData.level = parseInt(document.getElementById('char-level')?.value) || null;
            charData.race = document.getElementById('char-race')?.value || null;
        } else if (type === 'sidekick') {
            const baseCreature = document.getElementById('char-base-creature')?.value || '';
            const sidekickClass = document.getElementById('char-sidekick-class')?.value || 'Expert';
            const sidekickLevel = parseInt(document.getElementById('char-sidekick-level')?.value) || 1;

            charData.sidekick = {
                baseCreature,
                class: sidekickClass,
                level: sidekickLevel
            };

            // Auto-populate stats if missing and we have a selected creature slug
            const inputSlug = document.getElementById('char-base-creature')?.dataset.slug;
            let baseAbilities = null;

            if (inputSlug) {
                try {
                    let monster = await API.getMonster(inputSlug);

                    // If not found in Open5e, check custom monsters
                    if (!monster) {
                        const customMonsters = await API.getCustomMonsters();
                        monster = customMonsters.find(m => m.slug === inputSlug);
                    }

                    if (monster) {
                        if (!ac) ac = monster.armor_class;

                        // Extract abilities
                        baseAbilities = {
                            str: monster.strength || 10,
                            dex: monster.dexterity || 10,
                            con: monster.constitution || 10,
                            int: monster.intelligence || 10,
                            wis: monster.wisdom || 10,
                            cha: monster.charisma || 10
                        };

                        if (!hp) {
                            // Calculate HP per Tasha's rules:
                            // Start with base creature's HP
                            // Each level beyond 1st: add (Hit Die Avg + Mod)
                            // Hit Die based on size/class? Tasha's is simplified but implies using the creature's hit die size usually.
                            // We'll estimate using base creature's hit die size if parseable, else d8.
                            const hitDieStr = monster.hit_dice || '1d8';
                            // Extract die size (e.g. from "2d8+2" get 8)
                            const match = hitDieStr.match(/d(\d+)/);
                            const dieSize = match ? parseInt(match[1]) : 8;
                            const avgHitDie = (dieSize / 2) + 1;
                            const conMod = Math.floor((monster.constitution - 10) / 2);

                            const baseHP = monster.hit_points;
                            // Add HP for levels > 1
                            if (sidekickLevel > 1) {
                                const levelUpHP = (sidekickLevel - 1) * (avgHitDie + conMod);
                                hp = Math.floor(baseHP + Math.max(0, levelUpHP));
                            } else {
                                hp = baseHP;
                            }
                        }
                    }
                } catch (e) {
                    console.error("Failed to fetch sidekick base stats", e);
                }
            }
            // Assign base abilities if found
            if (baseAbilities) {
                charData.abilities = baseAbilities;
            }
        } else if (type === 'npc') {
            charData.statblockSlug = document.getElementById('char-statblock-slug')?.value || null;
        }

        charData.stats = (ac && hp) ? { hp, maxHp: hp, ac } : null;

        // Initialize default abilities if not present (e.g., for players or if sidekick abilities weren't fetched)
        if (!charData.abilities) {
            charData.abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
        }

        window.worldManager.addCharacter(charData);
        this.renderPartyMode();
        UI.clearPartyInputs();

        // Clear sidekick specific state
        if (UI.elements.charBaseCreature) {
            UI.elements.charBaseCreature.value = '';
            delete UI.elements.charBaseCreature.dataset.slug;
        }
        if (UI.elements.sidekickCreatureResults) {
            UI.elements.sidekickCreatureResults.classList.add('hidden');
        }
    },

    onCharacterTypeChange(e) {
        const type = e.target.value;
        document.getElementById('char-fields-player')?.classList.toggle('hidden', type !== 'player');
        document.getElementById('char-fields-sidekick')?.classList.toggle('hidden', type !== 'sidekick');
        document.getElementById('char-fields-npc')?.classList.toggle('hidden', type !== 'npc');
    },

    onCharacterSearch(e) {
        const query = e.target.value.trim();
        this.renderCharacterList(query);
    },

    onSidekickSearch(e) {
        console.log('[Sidekick Search] Input event fired, value:', e.target.value);
        clearTimeout(this.sidekickSearchTimeout);
        this.sidekickSearchTimeout = setTimeout(async () => {
            const query = e.target.value.trim().toLowerCase();
            console.log('[Sidekick Search] Query:', query);
            if (query.length < 2) {
                UI.elements.sidekickCreatureResults.classList.add('hidden');
                return;
            }

            // Search both Open5e and custom monsters
            console.log('[Sidekick Search] Calling API.searchMonsters...');
            const [apiResults, customMonsters] = await Promise.all([
                API.searchMonsters(query),
                API.getCustomMonsters()
            ]);

            // Filter custom monsters by query
            const customResults = customMonsters
                .filter(m => m.name.toLowerCase().includes(query))
                .map(m => ({
                    slug: m.slug,
                    name: m.name,
                    cr: m.cr,
                    isCustom: true
                }));

            // Merge results: custom first, then API
            const results = [...customResults, ...apiResults];
            console.log('[Sidekick Search] Results:', results);
            this.renderSidekickSearchResults(results);
        }, 300);
    },

    renderSidekickSearchResults(results) {
        if (results.length === 0) {
            UI.elements.sidekickCreatureResults.classList.add('hidden');
            return;
        }
        UI.elements.sidekickCreatureResults.innerHTML = results.map(m => `
            <div class="search-result-item" data-slug="${m.slug}" data-name="${UI.escapeHtml(m.name)}" data-cr="${m.cr}" data-custom="${m.isCustom || false}">
                <span class="monster-name">${UI.escapeHtml(m.name)}${m.isCustom ? ' <span class="custom-badge">Custom</span>' : ''}</span>
                <span class="monster-cr">CR ${m.cr}</span>
            </div>
        `).join('');
        UI.elements.sidekickCreatureResults.classList.remove('hidden');
    },

    onSidekickResultClick(e) {
        const item = e.target.closest('.search-result-item');
        if (!item) return;

        const input = UI.elements.charBaseCreature;
        if (input) {
            input.value = item.dataset.name;
            input.dataset.slug = item.dataset.slug;
            // Optionally focus the next field
            document.getElementById('char-sidekick-class')?.focus();
        }
        UI.elements.sidekickCreatureResults.classList.add('hidden');
    },

    onCharacterCardClick(e) {
        const card = e.target.closest('.character-card');
        if (!card) return;

        const charId = card.dataset.id;
        this.selectCharacter(charId);
    },

    selectCharacter(charId) {
        this.selectedCharacterId = charId;

        // Update selection UI
        document.querySelectorAll('.character-card').forEach(c => {
            c.classList.toggle('selected', c.dataset.id === charId);
        });

        this.showCharacterDetail(charId);
    },

    renderPartyMode() {
        this.renderCharacterList();
        this.populateLocationDropdown();

        // Re-select if one was selected
        if (this.selectedCharacterId) {
            const char = window.worldManager.getCharacter(this.selectedCharacterId);
            if (char) {
                this.showCharacterDetail(this.selectedCharacterId);
            } else {
                this.selectedCharacterId = null;
                this.clearCharacterDetail();
            }
        }
    },

    populateLocationDropdown() {
        const locationSelect = document.getElementById('char-location');
        if (!locationSelect) return;

        const locations = window.worldManager.data?.locations || [];
        const currentVal = locationSelect.value;

        locationSelect.innerHTML = '<option value="party">Party</option><option value="">Unassigned</option>';
        locations.forEach(loc => {
            locationSelect.innerHTML += `<option value="${loc.id}">${loc.name}</option>`;
        });
        locationSelect.value = currentVal || 'party';
    },

    renderCharacterList(searchQuery = '') {
        const container = document.getElementById('characters-list');
        const countEl = document.getElementById('char-search-count');
        if (!container) return;

        let characters = window.worldManager.getAllCharacters();

        if (searchQuery) {
            characters = window.worldManager.searchCharacters(searchQuery);
        }

        if (countEl) {
            countEl.textContent = `${characters.length} character${characters.length !== 1 ? 's' : ''}`;
        }

        const groups = this._groupCharactersByLocation(characters);
        container.innerHTML = this._renderCharacterGroups(groups);
    },

    _groupCharactersByLocation(characters) {
        const groups = {};
        const locations = window.worldManager.data?.locations || [];

        characters.forEach(c => {
            const locId = c.location || '';
            if (!groups[locId]) groups[locId] = [];
            groups[locId].push(c);
        });

        return { groups, locations };
    },

    _renderCharacterGroups({ groups, locations }) {
        let html = '';

        // Party first
        if (groups['party']?.length) {
            html += this._renderCharacterGroup('party', 'Party', '⚔️', groups['party']);
        }

        // Known locations
        for (const loc of locations) {
            if (groups[loc.id]?.length) {
                const icon = { town: '🏘️', city: '🏰', dungeon: '⚠️', point: '📍' }[loc.type] || '📍';
                html += this._renderCharacterGroup(loc.id, loc.name, icon, groups[loc.id]);
            }
        }

        // Unassigned
        if (groups['']?.length) {
            html += this._renderCharacterGroup('', 'Unassigned', '❓', groups['']);
        }

        if (!html) {
            html = '<p class="empty-state">No characters yet. Add some using the form on the left.</p>';
        }

        return html;
    },

    _renderCharacterGroup(locId, locName, icon, characters) {
        const cards = characters.map(c => this._renderCharacterCard(c)).join('');
        return `
            <div class="location-group" data-location="${locId}">
                <div class="location-group-header">
                    <span class="location-icon">${icon}</span>
                    <span>${locName}</span>
                    <span class="char-count">${characters.length}</span>
                </div>
                ${cards}
            </div>
        `;
    },

    _renderCharacterCard(c) {
        const typeLabels = { player: 'PC', sidekick: 'SIDE', npc: 'NPC' };
        const hpPercent = c.stats ? Math.round((c.stats.hp / c.stats.maxHp) * 100) : 0;
        const hpClass = hpPercent <= 25 ? 'critical' : hpPercent <= 50 ? 'low' : '';

        let subtitle = '';
        if (c.type === 'player') {
            subtitle = [c.class, c.level ? `Lv${c.level}` : '', c.race].filter(Boolean).join(' · ');
        } else if (c.type === 'sidekick' && c.sidekick) {
            subtitle = `${c.sidekick.baseCreature || ''} ${c.sidekick.class || ''} ${c.sidekick.level || ''}`.trim();
        } else if (c.type === 'npc' && c.story?.description) {
            subtitle = c.story.description.substring(0, 50) + (c.story.description.length > 50 ? '...' : '');
        }

        const isSelected = c.id === this.selectedCharacterId;

        return `
            <div class="character-card ${isSelected ? 'selected' : ''}" data-id="${c.id}">
                <div class="char-portrait">
                    ${c.portrait ? `<img src="${c.portrait}" alt="">` : '<div class="char-portrait-placeholder">👤</div>'}
                </div>
                <div class="char-info">
                    <div class="char-header">
                        <span class="char-name">${c.name}</span>
                        <span class="char-type-badge ${c.type}">${typeLabels[c.type] || c.type.toUpperCase()}</span>
                    </div>
                    <div class="char-subtitle">${subtitle || '—'}</div>
                    ${c.stats ? `
                    <div class="char-stats">
                        <div class="hp-bar-mini">
                            <div class="hp-fill ${hpClass}" style="width: ${hpPercent}%"></div>
                        </div>
                        <span class="stat-text">HP: ${c.stats.hp}/${c.stats.maxHp}</span>
                        <span class="stat-text">AC: ${c.stats.ac}</span>
                    </div>` : ''}
                </div>
            </div>
        `;
    },

    clearCharacterDetail() {
        const panel = document.getElementById('character-detail');
        if (panel) {
            panel.innerHTML = '<p class="empty-state">Select a character to view details</p>';
        }
    },

    showCharacterDetail(characterId) {
        const panel = document.getElementById('character-detail');
        const char = window.worldManager.getCharacter(characterId);

        if (!panel || !char) {
            this.clearCharacterDetail();
            return;
        }

        panel.innerHTML = this._renderDetailPanel(char);
        this._bindDetailEvents(characterId);
    },

    _renderDetailPanel(c) {
        const locations = window.worldManager.data?.locations || [];

        return `
            <div class="detail-header">
                <div class="detail-portrait">
                    ${c.portrait ? `<img src="${c.portrait}">` : '<div class="portrait-placeholder">👤</div>'}
                    <button class="btn-upload-portrait" data-id="${c.id}">📷</button>
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
                    ${locations.map(loc => `<option value="${loc.id}" ${c.location === loc.id ? 'selected' : ''}>${loc.name}</option>`).join('')}
                </select>
            </div>

            <div class="detail-actions">
                <button class="btn-danger btn-delete-char" data-id="${c.id}">Delete Character</button>
            </div>
        `;
    },

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
                        <label>Class</label>
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
                ${this._renderAbilityScores(c)}
                ${this._renderSidekickProficiencies(c)}
                ${this._renderQuickRolls(c)}
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
                        <label>Statblock</label>
                        <input type="text" value="${c.statblockSlug || ''}" data-field="statblockSlug" placeholder="e.g., knight">
                    </div>
                </div>
                ${c.stats ? this._renderStatsSection(c) : ''}
            `;
        }

        return '';
    },

    _renderStatsSection(c) {
        if (!c.stats) return '';
        return `
            <div class="detail-section">
                <h4>Stats</h4>
                <div class="stats-grid">
                    <div class="stat-input-group">
                        <label>HP</label>
                        <input type="number" value="${c.stats.hp}" data-field="stats.hp" min="0">
                    </div>
                    <div class="stat-input-group">
                        <label>Max HP</label>
                        <input type="number" value="${c.stats.maxHp}" data-field="stats.maxHp" min="1">
                    </div>
                    <div class="stat-input-group">
                        <label>AC</label>
                        <input type="number" value="${c.stats.ac}" data-field="stats.ac" min="1">
                    </div>
                </div>
            </div>
        `;
    },

    _renderInventorySection(c) {
        const items = c.inventory || [];
        return `
            <div class="detail-section">
                <h4>Inventory</h4>
                <ul class="inventory-list">
                    ${items.map((item, i) => `
                        <li class="inventory-item">
                            <span class="inventory-qty">${item.qty}x</span>
                            <span class="inventory-name">${item.name}</span>
                            ${item.note ? `<span class="inventory-note">${item.note}</span>` : ''}
                            <button class="btn-remove-item" data-index="${i}">×</button>
                        </li>
                    `).join('')}
                </ul>
                <div class="add-inventory-row">
                    <input type="number" id="inv-qty" placeholder="Qty" value="1" min="1">
                    <input type="text" id="inv-name" placeholder="Item name">
                    <button class="btn-secondary btn-add-inventory">+</button>
                </div>
            </div>
        `;
    },

    // Enhanced sidekick class data
    SIDEKICK_CLASS_DATA: {
        Expert: {
            armor: ['Light armor'],
            weapons: ['Simple weapons'],
            tools: 2,  // DM chooses 2 tools
            saveOptions: ['Dexterity', 'Intelligence', 'Charisma'],
            skillCount: 5,
            skillOptions: 'any',
            hitDie: 'base creature'
        },
        Warrior: {
            armor: ['All armor', 'Shields'],
            weapons: ['Simple weapons', 'Martial weapons'],
            tools: 0,
            saveOptions: ['Strength', 'Dexterity', 'Constitution'],
            skillCount: 2,
            skillOptions: ['Acrobatics', 'Animal Handling', 'Athletics', 'Intimidation', 'Nature', 'Perception', 'Survival'],
            hitDie: 'base creature'
        },
        Spellcaster: {
            armor: ['Light armor'],
            weapons: ['Simple weapons'],
            tools: 0,
            saveOptions: ['Wisdom', 'Intelligence', 'Charisma'],
            skillCount: 2,
            skillOptions: ['Arcana', 'History', 'Insight', 'Investigation', 'Medicine', 'Performance', 'Persuasion', 'Religion'],
            hitDie: 'base creature'
        }
    },

    // Sidekick features from Tasha's Cauldron of Everything
    SIDEKICK_FEATURES: {
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
    },



    _renderSidekickFeatures(c) {
        if (!c.sidekick) return '';

        const className = c.sidekick.class;
        const level = c.sidekick.level || 1;
        const classFeatures = this.SIDEKICK_FEATURES[className] || {};

        // Collect all features up to current level
        const features = [];
        for (let lvl = 1; lvl <= level; lvl++) {
            if (classFeatures[lvl]) {
                features.push(...classFeatures[lvl]);
            }
        }

        if (features.length === 0) {
            return '';
        }

        return `
    < div class="detail-section" >
                <h4>${className} Features (Level ${level})</h4>
                <ul class="feature-list">
                    ${features.map(f => `<li>${f}</li>`).join('')}
                </ul>
            </div >
    `;
    },

    _renderAbilityScores(c) {
        const abilities = c.abilities || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
        const hasAsiAvailable = (c.sidekick?.level >= 4) && (!c.sidekick.abilityScoreIncreases || !c.sidekick.abilityScoreIncreases[c.sidekick.level]);
        // Ideally checking if ASI is recorded for this level, but for now we won't strictly enforce "spent" ASI 
        // because we don't have a rigid history tracking. We'll just provide the button to use anytime.
        // A better approach: The 'Level Up' modal prompts for it. 
        // But the user asked for a "button for ability score improvement".
        // Let's add a button that opens the ASI modal manually.

        return `
    < div class="detail-section ability-scores-section" >
                <h4>Ability Scores 
                    ${c.sidekick?.level >= 4 ? `<button class="btn-small btn-asi" style="float:right; margin-top:-5px;">Improve</button>` : ''}
                </h4>
                <div class="ability-scores-grid">
                    ${Object.entries(abilities).map(([key, val]) => {
            const mod = Math.floor((val - 10) / 2);
            const modStr = mod >= 0 ? `+${mod}` : mod;
            return `
                            <div class="ability-score-box">
                                <div class="ability-label">${key.toUpperCase()}</div>
                                <div class="ability-mod">${modStr}</div>
                                <div class="ability-val">${val}</div>
                            </div>
                        `;
        }).join('')}
                </div>
            </div >
    `;
    },

    _renderSidekickProficiencies(c) {
        if (!c.sidekick) return '';
        const data = this.SIDEKICK_CLASS_DATA[c.sidekick.class];
        if (!data) return '';

        const profBonus = Math.floor((c.sidekick.level - 1) / 4) + 2;

        return `
    < div class="detail-section sidekick-proficiencies" >
                <h4>Proficiencies <span class="prof-bonus">+${profBonus}</span></h4>
                <div class="prof-row">
                    <span class="prof-label">Saving Throw</span>
                    <span class="prof-value">
                        ${c.sidekick.chosenSave || `<button class="btn-small btn-choose-save">Choose Save</button>`}
                    </span>
                </div>
                <div class="prof-row">
                    <span class="prof-label">Skills</span>
                    <span class="prof-value">
                        ${(c.sidekick.chosenSkills && c.sidekick.chosenSkills.length > 0) ? c.sidekick.chosenSkills.join(', ') : `<button class="btn-small btn-choose-skills" data-count="${data.skillCount}">Choose ${data.skillCount} Skills</button>`}
                    </span>
                </div>
                <div class="prof-row">
                    <span class="prof-label">Armor</span>
                    <span class="prof-value">${data.armor.join(', ')}</span>
                </div>
                <div class="prof-row">
                    <span class="prof-label">Weapons</span>
                    <span class="prof-value">${data.weapons.join(', ')}</span>
                </div>
                ${c.sidekick.class === 'Expert' ? this._renderExpertiseSection(c) : ''}
            </div >
    `;
    },

    _renderExpertiseSection(c) {
        const profBonus = Math.floor((c.sidekick.level - 1) / 4) + 2;
        const expertiseBonus = profBonus * 2;
        const expertise = c.sidekick.expertiseSkills || [];
        const maxExpertise = c.sidekick.level >= 11 ? 4 : (c.sidekick.level >= 3 ? 2 : 0);

        if (maxExpertise === 0) return '';

        const remaining = maxExpertise - expertise.length;

        return `
    < div class="prof-row expertise-row" >
                <span class="prof-label">Expertise <span class="expertise-bonus">+${expertiseBonus}</span></span>
                <span class="prof-value">
                    ${expertise.length > 0 ? expertise.join(', ') : ''}
                    ${remaining > 0 ? `<button class="btn-small btn-choose-expertise" data-max="${remaining}">Choose ${remaining}</button>` : ''}
                </span>
            </div >
    `;
    },

    _renderQuickRolls(c) {
        if (!c.sidekick) return '';
        const profBonus = Math.floor((c.sidekick.level - 1) / 4) + 2;
        const abilities = c.abilities || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
        const getMod = (stat) => Math.floor((abilities[stat.toLowerCase().substring(0, 3)] - 10) / 2);

        // Helper to formatting roll string
        const formatRoll = (mod, proficient) => {
            const total = mod + (proficient ? profBonus : 0);
            return total >= 0 ? `+ ${total} ` : total;
        };

        const saveStat = c.sidekick.chosenSave ? c.sidekick.chosenSave.substring(0, 3).toLowerCase() : 'dex';
        // Fallback default? Or just hide? logic below hides button if not chosen.

        return `
    < div class="detail-section quick-rolls" >
                <h4>Quick Rolls</h4>
                <div class="dice-row">
                    ${c.sidekick.chosenSave ? `
                        <button class="quick-roll-btn" data-roll="1d20${formatRoll(getMod(c.sidekick.chosenSave), true)}" data-label="${c.sidekick.chosenSave} Save">
                            ${c.sidekick.chosenSave.substring(0, 3)} ${formatRoll(getMod(c.sidekick.chosenSave), true)}
                        </button>
                    ` : ''}
                    ${(c.sidekick.chosenSkills || []).filter(s => !(c.sidekick.expertiseSkills || []).includes(s)).slice(0, 5).map(skill => {
            // Mapping skill to stat is complex without a full lookup table.
            // For simplicity, we might ask user or infer? 
            // Tasha's sidekicks: usually standard 5e skills.
            // Let's use a mini lookup for common ones or default to +PB if unknown
            // Actually, common implementation is just PB+Stat. 
            // Improving this later with a Stat lookup would be good. For now, assume +PB unless we add stats map.
            // Let's stick to user request "quick dice rolls" and the current simplistic "d20 + PB" logic 
            // BUT try to add the stat mod if we can guess it easily? 
            // Re-reading user request: "UI for viewing stats... ability score improvement".
            // It implies they want stats to MATTER.
            // Let's try to map the most common skills.
            const skillMap = {
                'Athletics': 'str', 'Acrobatics': 'dex', 'Sleight of Hand': 'dex', 'Stealth': 'dex',
                'Arcana': 'int', 'History': 'int', 'Investigation': 'int', 'Nature': 'int', 'Religion': 'int',
                'Animal Handling': 'wis', 'Insight': 'wis', 'Medicine': 'wis', 'Perception': 'wis', 'Survival': 'wis',
                'Deception': 'cha', 'Intimidation': 'cha', 'Performance': 'cha', 'Persuasion': 'cha'
            };
            const stat = skillMap[skill] || 'dex'; // Default to dex if unknown?
            const mod = getMod(stat);
            return `
                            <button class="quick-roll-btn" data-roll="1d20${formatRoll(mod, true)}" data-label="${skill}">
                                ${skill.substring(0, 4)} ${formatRoll(mod, true)}
                            </button>
                         `;
        }).join('')}
                     ${(c.sidekick.expertiseSkills || []).map(skill => {
            const skillMap = {
                'Athletics': 'str', 'Acrobatics': 'dex', 'Sleight of Hand': 'dex', 'Stealth': 'dex',
                'Arcana': 'int', 'History': 'int', 'Investigation': 'int', 'Nature': 'int', 'Religion': 'int',
                'Animal Handling': 'wis', 'Insight': 'wis', 'Medicine': 'wis', 'Perception': 'wis', 'Survival': 'wis',
                'Deception': 'cha', 'Intimidation': 'cha', 'Performance': 'cha', 'Persuasion': 'cha'
            };
            const stat = skillMap[skill] || 'dex';
            const mod = getMod(stat);
            const bonus = mod + (profBonus * 2);
            const sign = bonus >= 0 ? '+' : '';
            return `
                            <button class="quick-roll-btn" data-roll="1d20${sign}${bonus}" data-label="${skill} (Expertise)">
                                ${skill.substring(0, 4)} ${sign}${bonus}
                            </button>
                        `;
        }).join('')}
                    
                    <button class="quick-roll-btn" data-roll="1d20${formatRoll(getMod('str'), true)}" data-label="Melee Atk">
                        Melee ${formatRoll(getMod('str'), true)}
                    </button>
                     <button class="quick-roll-btn" data-roll="1d20${formatRoll(getMod('dex'), true)}" data-label="Ranged Atk">
                        Ranged ${formatRoll(getMod('dex'), true)}
                    </button>
                </div>
            </div>
    `;
    },



    _bindDetailEvents(characterId) {
        const panel = document.getElementById('character-detail');
        if (!panel) return;

        // Auto-save on input change
        panel.querySelectorAll('input, select, textarea').forEach(el => {
            el.addEventListener('change', () => this._onDetailFieldChange(characterId, el));
        });

        // Portrait upload
        const uploadBtn = panel.querySelector('.btn-upload-portrait');
        const uploadInput = panel.querySelector(`#portrait-upload-${characterId}`);
        if (uploadBtn && uploadInput) {
            uploadBtn.addEventListener('click', () => uploadInput.click());
            uploadInput.addEventListener('change', (e) => this.uploadPortrait(characterId, e.target.files[0]));
        }

        // Delete button
        const deleteBtn = panel.querySelector('.btn-delete-char');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                if (confirm('Delete this character?')) {
                    window.worldManager.removeCharacter(characterId);
                    this.selectedCharacterId = null;
                    this.clearCharacterDetail();
                    this.renderCharacterList();
                }
            });
        }

        // Inventory add
        const addInvBtn = panel.querySelector('.btn-add-inventory');
        if (addInvBtn) {
            addInvBtn.addEventListener('click', () => this._addInventoryItem(characterId));
        }

        // Inventory remove
        panel.querySelectorAll('.btn-remove-item').forEach(btn => {
            btn.addEventListener('click', () => this._removeInventoryItem(characterId, parseInt(btn.dataset.index)));
        });

        // Sidekick specific buttons
        panel.querySelectorAll('.btn-choose-save').forEach(btn => {
            btn.addEventListener('click', () => this._openLevelUpModal(characterId, 'save'));
        });
        panel.querySelectorAll('.btn-choose-skills').forEach(btn => {
            btn.addEventListener('click', () => this._openLevelUpModal(characterId, 'skills'));
        });
        panel.querySelectorAll('.btn-choose-expertise').forEach(btn => {
            btn.addEventListener('click', () => this._openLevelUpModal(characterId, 'expertise'));
        });
        panel.querySelectorAll('.btn-asi').forEach(btn => {
            btn.addEventListener('click', () => this._openLevelUpModal(characterId, 'asi'));
        });

        panel.querySelectorAll('.quick-roll-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                Dice.roll(btn.dataset.roll);
                // Optionally log to dice tray
                const resultsDiv = document.getElementById('dice-results');
                if (resultsDiv) {
                    const result = document.createElement('div');
                    result.className = 'dice-result-entry';
                    result.innerHTML = `<strong>${btn.dataset.label}:</strong> Rolled ${btn.dataset.roll}`;
                    resultsDiv.prepend(result);
                }
            });
        });
    },



    _onDetailFieldChange(characterId, el) {
        const field = el.dataset.field;
        if (!field) return;

        let value = el.type === 'number' ? parseInt(el.value) || null : el.value;

        // Handle nested fields (e.g., stats.hp, sidekick.class)
        if (field.includes('.')) {
            const [parent, child] = field.split('.');
            const char = window.worldManager.getCharacter(characterId);
            if (!char) return;

            const parentObj = char[parent] || {};

            // Check for sidekick level up
            if (parent === 'sidekick' && child === 'level') {
                const oldLevel = parentObj.level || 0;
                const newLevel = value;
                if (newLevel > oldLevel) {
                    this._openLevelUpModal(characterId, 'levelup', oldLevel, newLevel);
                }
            }

            parentObj[child] = value;
            window.worldManager.updateCharacter(characterId, { [parent]: parentObj });
        } else {
            window.worldManager.updateCharacter(characterId, { [field]: value });
        }

        this.renderCharacterList();
    },

    _addInventoryItem(characterId) {
        const qty = parseInt(document.getElementById('inv-qty')?.value) || 1;
        const name = document.getElementById('inv-name')?.value.trim();
        if (!name) return;

        const char = window.worldManager.getCharacter(characterId);
        if (!char) return;

        const inventory = char.inventory || [];
        inventory.push({ name, qty, note: '' });
        window.worldManager.updateCharacter(characterId, { inventory });

        this.showCharacterDetail(characterId);
    },

    _removeInventoryItem(characterId, index) {
        const char = window.worldManager.getCharacter(characterId);
        if (!char || !char.inventory) return;

        char.inventory.splice(index, 1);
        window.worldManager.updateCharacter(characterId, { inventory: char.inventory });

        this.showCharacterDetail(characterId);
    },

    async uploadPortrait(characterId, file) {
        if (!file) return;

        const formData = new FormData();
        formData.append('portrait', file);

        try {
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
        } catch (e) {
            console.error('Portrait upload failed:', e);
        }
    },

    async _openLevelUpModal(characterId, mode, oldLevel, newLevel) {
        const char = window.worldManager.getCharacter(characterId);
        if (!char || !char.sidekick) return;

        const modal = document.getElementById('sidekick-levelup-modal');
        const content = document.getElementById('levelup-content');
        const confirmBtn = document.getElementById('btn-confirm-levelup');
        if (!modal || !content) {
            console.error('Level up modal not found');
            return;
        }

        // Show modal
        modal.classList.remove('hidden');
        content.innerHTML = '';

        const data = this.SIDEKICK_CLASS_DATA[char.sidekick.class];
        const currentSelections = char.sidekick.chosenSkills || [];
        const currentExpertise = char.sidekick.expertiseSkills || [];

        // Render content based on mode
        let html = '';
        let pendingChanges = {};

        if (mode === 'save') {
            html = `
                <h3>Select Saving Throw</h3>
                <p>Choose one saving throw proficiency:</p>
                <div class="asi-grid">
                    ${data.saveOptions.map(save => `
                        <div class="asi-option ${char.sidekick.chosenSave === save ? 'selected' : ''}" data-value="${save}">
                            ${save}
                        </div>
                    `).join('')}
                </div>
            `;

            content.innerHTML = html;
            content.querySelectorAll('.asi-option').forEach(el => {
                el.addEventListener('click', () => {
                    content.querySelectorAll('.asi-option').forEach(o => o.classList.remove('selected'));
                    el.classList.add('selected');
                    pendingChanges.chosenSave = el.dataset.value;
                });
            });

        } else if (mode === 'skills') {
            const count = data.skillCount;
            const options = data.skillOptions === 'any' ?
                ['Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception', 'History', 'Insight', 'Intimidation', 'Investigation', 'Medicine', 'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion', 'Sleight of Hand', 'Stealth', 'Survival'] :
                data.skillOptions;

            html = `
                <h3>Select Skills</h3>
                <p>Choose ${count} skills from the list below:</p>
                <div class="asi-grid skills-grid">
                    ${options.map(skill => `
                        <div class="asi-option ${currentSelections.includes(skill) ? 'selected' : ''}" data-value="${skill}">
                            ${skill}
                        </div>
                    `).join('')}
                </div>
            `;

            content.innerHTML = html;
            let selected = [...currentSelections];

            content.querySelectorAll('.asi-option').forEach(el => {
                el.addEventListener('click', () => {
                    const val = el.dataset.value;
                    if (selected.includes(val)) {
                        selected = selected.filter(s => s !== val);
                        el.classList.remove('selected');
                    } else {
                        if (selected.length < count) {
                            selected.push(val);
                            el.classList.add('selected');
                        }
                    }
                    pendingChanges.chosenSkills = selected;
                });
            });

        } else if (mode === 'expertise') {
            // Filter: can only choose expertise in skills they are already proficient in
            const proficientSkills = char.sidekick.chosenSkills || [];
            const max = char.sidekick.level >= 11 ? 4 : 2;

            html = `
                <h3>Select Expertise</h3>
                <p>Choose up to ${max} skills to double your proficiency bonus in:</p>
                <div class="asi-grid">
                    ${proficientSkills.map(skill => `
                        <div class="asi-option ${currentExpertise.includes(skill) ? 'selected' : ''}" data-value="${skill}">
                            ${skill}
                        </div>
                    `).join('')}
                </div>
            `;

            content.innerHTML = html;

            content.querySelectorAll('.asi-option').forEach(el => {
                el.addEventListener('click', () => {
                    const val = el.dataset.value;
                    if (selected.includes(val)) {
                        selected = selected.filter(s => s !== val);
                        el.classList.remove('selected');
                    } else {
                        if (selected.length < max) {
                            selected.push(val);
                            el.classList.add('selected');
                        }
                    }
                    pendingChanges.expertiseSkills = selected;
                });
            });

        } else if (mode === 'asi') {
            const abilities = char.abilities || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

            html = `
                <h3>Ability Score Improvement</h3>
                <p>Choose <strong>two</strong> abilities to increase by +1, OR <strong>one</strong> ability to increase by +2 (max 20).</p>
                <div class="asi-grid">
                    ${Object.entries(abilities).map(([key, val]) => `
                        <div class="asi-option stat-option" data-stat="${key}" data-val="${val}">
                            <div class="stat-label">${key.toUpperCase()}</div>
                            <div class="stat-val">${val}</div>
                            <div class="stat-inc">+0</div>
                        </div>
                    `).join('')}
                </div>
            `;

            content.innerHTML = html;
            let changes = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
            let pointsSpent = 0;

            content.querySelectorAll('.stat-option').forEach(el => {
                el.addEventListener('click', () => {
                    const stat = el.dataset.stat;
                    const currentVal = parseInt(el.dataset.val);

                    // Logic: Toggle between +0 -> +1 -> +2 -> +0
                    // But constrained by 2 points total logic

                    let plannedInc = changes[stat];
                    if (plannedInc === 0) {
                        if (pointsSpent < 2 && currentVal < 20) {
                            changes[stat] = 1;
                            pointsSpent++;
                        }
                    } else if (plannedInc === 1) {
                        if (pointsSpent < 2 && currentVal < 19) { // Can go to +2?
                            changes[stat] = 2;
                            pointsSpent++;
                        } else {
                            changes[stat] = 0;
                            pointsSpent--;
                        }
                    } else { // was +2
                        changes[stat] = 0;
                        pointsSpent -= 2;
                    }

                    // Update UI
                    content.querySelectorAll('.stat-option').forEach(opt => {
                        const s = opt.dataset.stat;
                        const inc = changes[s];
                        opt.querySelector('.stat-inc').textContent = `+${inc}`;
                        opt.classList.toggle('selected', inc > 0);
                        if (inc === 2) opt.style.background = 'var(--accent-hover)'; // visual diff?
                        else if (inc === 1) opt.style.background = '';
                    });

                    pendingChanges.abilities = { ...abilities };
                    Object.keys(changes).forEach(k => {
                        pendingChanges.abilities[k] += changes[k];
                    });
                });
            });

        } else if (mode === 'levelup') {
            html = `
                <h3>Level Up: ${oldLevel} ➔ ${newLevel}</h3>
                <div class="levelup-features">
                    <h4>New Features:</h4>
                    <ul>
                        ${this._getFeaturesForLevelRange(char.sidekick.class, oldLevel, newLevel).map(f => `<li>${f}</li>`).join('')}
                    </ul>
                </div>
            `;
            // If hitting level 4, 8, etc., could prompt for ASI here
            // For now, simplify to just showing features
            content.innerHTML = html;
        }

        // Handle Confirm
        const newConfirm = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);

        newConfirm.addEventListener('click', () => {
            const updates = {};

            // Handle Ability Score Improvements (stored at root)
            if (pendingChanges.abilities) {
                updates.abilities = pendingChanges.abilities;
                // Remove from pendingChanges so it doesn't get merged into sidekick data
                delete pendingChanges.abilities;
            }

            // Handle Sidekick Features (stored in sidekick object)
            if (Object.keys(pendingChanges).length > 0) {
                const sidekickData = char.sidekick;
                Object.assign(sidekickData, pendingChanges);
                updates.sidekick = sidekickData;
            }

            window.worldManager.updateCharacter(characterId, updates);
            modal.classList.add('hidden');
            this.showCharacterDetail(characterId); // Refresh UI
        });

        // Close on outside click
        modal.onclick = (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        };
    },

    _getFeaturesForLevelRange(className, oldLevel, newLevel) {
        const features = [];
        const classFeatures = this.SIDEKICK_FEATURES[className] || {};
        for (let l = oldLevel + 1; l <= newLevel; l++) {
            if (classFeatures[l]) {
                features.push(...classFeatures[l].map(f => `<strong>Level ${l}:</strong> ${f}`));
            }
        }
        return features.length ? features : ['No new features for this level.'];
    },

    // Combat
    async startEncounter() {
        const encounter = State.getCurrentEncounter();
        if (!encounter || encounter.monsters.length === 0) return alert('Add some monsters first!');

        // Get party from worldManager (characters with location='party')
        if (!window.worldManager.data) {
            await window.worldManager.load();
        }
        const party = window.worldManager.getPartyMembers().map(c => ({
            id: c.id,
            name: c.name,
            ac: c.stats.ac,
            hp: c.stats.hp,
            maxHp: c.stats.maxHp
        }));

        // Show loading state
        UI.elements.btnRunEncounter.disabled = true;
        UI.elements.btnRunEncounter.textContent = 'Loading...';

        try {
            // Auto-init Battlemap if not already initialized
            if (!Battlemap.canvas) {
                await Battlemap.init();
                this.setupSelectionSync();
            }

            // Load linked map if one is set
            if (encounter.linkedMapId) {
                await Battlemap.loadFromLibrary(encounter.linkedMapId);
            }

            // Clear all existing tokens and auto-populate from encounter
            Battlemap.clearAllTokens();
            await Battlemap.populateFromEncounter(true);

            // Read fresh token data — all monsters now have tokens
            const tokenData = Battlemap.getDataForCombat();
            const combatants = [];

            // Build monster combatants from tokens that have a slug
            for (const token of tokenData) {
                const data = await API.getMonster(token.slug);
                if (!data) continue;
                this.monsterCache.set(token.slug, data);
                const dexMod = Math.floor((data.dexterity - 10) / 2);
                const init = Dice.rollD20(dexMod);
                combatants.push({
                    id: token.instanceId,
                    name: token.name,
                    slug: token.slug,
                    initiative: init.total,
                    ac: data.armor_class,
                    hp: data.hit_points,
                    maxHp: data.hit_points,
                    isPlayer: false,
                    hasToken: true
                });
            }

            // Store pending combatants (monsters only) and encounter id
            this._pendingCombatants = combatants;
            this._pendingEncounterId = encounter.id;

            // Party handling: tokens are on the map (visual only),
            // but combatants always come from State.getParty() via the initiative modal.
            if (party.length > 0) {
                UI.showInitiativeModal(party);
            } else {
                // No party members — start combat immediately with monsters only
                State.initActiveCombat(encounter.id, combatants);
                this.switchMode('map');
                this.openInitiativeTab();
                this.renderCombat();
            }

        } catch (err) {
            alert(err.message);
        } finally {
            // Reset button state
            UI.elements.btnRunEncounter.disabled = false;
            UI.elements.btnRunEncounter.textContent = 'Run Encounter';
        }
    },

    onStartCombat() {
        const playerInits = UI.getPlayerInitiatives();
        // Get party from worldManager with type info
        const party = window.worldManager.getPartyMembers().map(c => ({
            id: c.id,
            name: c.name,
            type: c.type,
            ac: c.stats?.ac ?? 10,
            hp: c.stats?.hp,
            maxHp: c.stats?.maxHp
        }));
        const combatants = [...this._pendingCombatants];

        // Party members (players, sidekicks, NPCs) always added from roster
        party.forEach(p => {
            const init = playerInits.find(i => i.id === p.id);
            combatants.push({
                id: p.id,
                name: p.name,
                slug: null,
                initiative: init?.initiative || 10,
                ac: p.ac,
                hp: p.hp !== undefined ? p.hp : p.maxHp,
                maxHp: p.maxHp,
                isPlayer: p.type === 'player',
                isSidekick: p.type === 'sidekick',
                isNpc: p.type === 'npc',
                hasToken: false,
                characterType: p.type  // Preserve type for HP sync
            });
        });

        State.initActiveCombat(this._pendingEncounterId, combatants);
        UI.hideInitiativeModal();
        this.switchMode('map');
        this.openInitiativeTab();
        this.renderCombat();
    },

    renderCombat() {
        const combat = State.getActiveCombat();
        if (!combat) return;
        UI.showCombatView();
        UI.renderInitiativeList(combat.combatants, combat.currentTurn);
        this.updateCombatIndicator();

        // Sync active turn token to battlemap for player view highlight
        if (Battlemap.canvas) {
            const currentCombatant = combat.combatants[combat.currentTurn];
            if (currentCombatant) {
                const token = Battlemap.state.tokens.find(t =>
                    t.instanceId === currentCombatant.id || t.combatantId === currentCombatant.id || t.id === currentCombatant.id
                );
                Battlemap.state.activeTurnTokenId = token ? token.id : null;
            } else {
                Battlemap.state.activeTurnTokenId = null;
            }
            Battlemap.render();
            Battlemap.syncPlayerView();
        }
    },

    nextTurn() {
        State.nextTurn();
        this.renderCombat();
    },

    prevTurn() {
        State.prevTurn();
        this.renderCombat();
    },

    endEncounter() {
        State.endCombat();
        UI.hideCombatView();
        UI.clearStatblock();
        this.updateCombatIndicator();

        // Clear active turn highlight
        if (Battlemap.canvas) {
            Battlemap.state.activeTurnTokenId = null;
        }

        // Clear the battlemap
        if (Battlemap.canvas) {
            Battlemap.clearAllTokens();
            Battlemap.state.background = null;
            Battlemap.state.backgroundImage = null;
            Battlemap.state.currentMapId = null;
            Battlemap.state.aoeShapes = [];
            Battlemap.state.fogEnabled = false;
            Battlemap.resizeCanvas();
            Battlemap.render();
            Battlemap.syncPlayerView();
            Battlemap.scheduleAutoSave();
        }

        this.switchMode('prep');
    },

    async onInitiativeItemClick(e) {
        const item = e.target.closest('.initiative-item');
        if (!item || e.target.classList.contains('hp-input')) return;
        const slug = item.dataset.slug;
        const combatantId = item.dataset.id;

        // Show statblock if monster
        if (slug) {
            let monster = this.monsterCache.get(slug);
            if (!monster) monster = await API.getMonster(slug);
            if (monster) {
                this.monsterCache.set(slug, monster);
                UI.renderStatblock(monster);
            }
        } else {
            UI.clearStatblock();
        }

        // Select and pan to matching token on the map (if it has one)
        if (Battlemap.canvas && combatantId) {
            const combat = State.getActiveCombat();
            const combatant = combat?.combatants.find(c => c.id === combatantId);
            if (combatant && combatant.hasToken !== false) {
                Battlemap.selectToken(combatantId);
                Battlemap.panToToken(combatantId);
            }
        }
    },

    onHpChange(e) {
        if (!e.target.classList.contains('hp-input')) return;
        const item = e.target.closest('.initiative-item');
        if (!item) return;
        let value = e.target.value.trim();
        const maxHp = parseInt(e.target.dataset.max);
        const combat = State.getActiveCombat();
        const combatant = combat?.combatants.find(c => c.id === item.dataset.id);
        if (!combatant) return;
        // Support relative values like -5 or +3
        if (value.startsWith('-') || value.startsWith('+')) {
            const delta = parseInt(value);
            if (!isNaN(delta)) combatant.hp = Math.max(0, Math.min(maxHp, combatant.hp + delta));
        } else {
            const abs = parseInt(value);
            if (!isNaN(abs)) combatant.hp = Math.max(0, Math.min(maxHp, abs));
        }

        // Sync HP to battlemap token if linked via instanceId
        if (Battlemap.canvas) {
            const token = Battlemap.state.tokens.find(t => t.instanceId === combatant.id);
            if (token) {
                token.hp = combatant.hp;
                Battlemap.render();
                Battlemap.syncPlayerView();
            }
        }

        this.renderCombat();
    },

    onStatblockRollClick(e) {
        if (!e.target.classList.contains('roll-btn')) return;
        const notation = e.target.dataset.roll;
        const type = e.target.dataset.type || 'damage';
        const result = Dice.roll(notation);
        if (!result) return;

        UI.addDiceResult(notation, result);

        // Show popup on selected token (if any)
        const selectedCombatant = this.getSelectedCombatant();
        if (selectedCombatant && !selectedCombatant.isPlayer && Battlemap.canvas) {
            const token = Battlemap.state.tokens.find(t =>
                t.instanceId === selectedCombatant.id || t.id === selectedCombatant.id
            );
            if (token) {
                const text = type === 'attack'
                    ? `\u{1F3AF} ${result.total}`
                    : `\u{1F4A5} ${result.total}`;
                Battlemap.showRollPopup(token.id, text, type);
                Battlemap.glowToken(token.id);
            }
        }
    },

    rollDice() {
        const notation = UI.elements.diceInput.value.trim();
        if (!notation) return;
        const result = Dice.roll(notation);
        if (result) {
            UI.addDiceResult(notation, result);
            UI.elements.diceInput.value = '';
        }
    },

    // Import statblock methods
    async parseImportedStatblock() {
        const text = UI.elements.importText.value.trim();
        if (!text) return;

        UI.showImportLoading();
        try {
            const monster = await API.parseStatblock(text);
            UI.renderImportPreview(monster);
        } catch (error) {
            UI.showImportError(error.message || 'Failed to parse statblock');
        } finally {
            UI.hideImportLoading();
        }
    },

    async saveImportedMonster() {
        const monster = UI.getCurrentParsedMonster();
        if (!monster) return;

        const success = await API.saveCustomMonster(monster);
        if (success) {
            UI.hideImportModal();
            // Clear the API cache so the new monster shows up in searches
            API.cache.clear();
        } else {
            UI.showImportError('Failed to save monster');
        }
    },

    // ============ Map Library Methods ============

    async openMapLibrary() {
        this._mapLibraryElements.modal.classList.remove('hidden');
        this._mapLibraryElements.search.value = '';
        await this.loadMapLibrary();
    },

    async loadMapLibrary() {
        const { grid, empty } = this._mapLibraryElements;

        // Show loading state
        grid.innerHTML = '<p class="loading-state">Loading maps...</p>';
        empty.classList.add('hidden');

        try {
            const maps = await API.getMaps();
            this.renderMapLibrary(maps);
        } catch (error) {
            grid.innerHTML = '<p class="error-state">Failed to load maps</p>';
        }
    },

    renderMapLibrary(maps) {
        const { grid, empty } = this._mapLibraryElements;

        if (!maps || maps.length === 0) {
            grid.innerHTML = '';
            empty.classList.remove('hidden');
            return;
        }

        empty.classList.add('hidden');
        grid.innerHTML = maps.map(map => `
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
            if (this._mapLibraryLinkMode) {
                this.linkMapToCurrentEncounter(mapId);
            } else {
                await this.loadMapFromLibrary(mapId);
            }
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
            if (!Battlemap.canvas) await Battlemap.init();
            await Battlemap.loadFromLibrary(mapId);
            this.closeMapLibrary();
            // Switch to map mode to show the loaded map
            this.switchMode('map');
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

    // ============ Map Linking Methods ============

    async openMapLibraryForLinking() {
        const encounter = State.getCurrentEncounter();
        if (!encounter) return;

        this._mapLibraryLinkMode = true;
        await this.openMapLibrary();

        // Update modal title to indicate link mode
        const modalTitle = this._mapLibraryElements.modal.querySelector('h2');
        if (modalTitle) {
            modalTitle.textContent = 'Select Map to Link';
        }
    },

    closeMapLibrary() {
        if (this._mapLibraryElements) {
            this._mapLibraryElements.modal.classList.add('hidden');
        }
        // Reset link mode and restore title
        this._mapLibraryLinkMode = false;
        const modalTitle = this._mapLibraryElements?.modal.querySelector('h2');
        if (modalTitle) {
            modalTitle.textContent = 'Map Library';
        }
    },

    linkMapToCurrentEncounter(mapId) {
        const encounter = State.getCurrentEncounter();
        if (!encounter) return;

        State.linkMapToEncounter(encounter.id, mapId);
        this.closeMapLibrary();
        UI.renderLinkedMap(mapId);
    },

    onLinkedMapClick(e) {
        if (e.target.classList.contains('btn-unlink')) {
            const encounter = State.getCurrentEncounter();
            if (!encounter) return;

            State.unlinkMapFromEncounter(encounter.id);
            UI.renderLinkedMap(null);
        }
    },

    async uploadToLibrary(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Prompt for map name
        const name = prompt('Enter a name for this map:', file.name.replace(/\.[^/.]+$/, ''));
        if (name === null) return; // Cancelled

        // Show upload progress
        const { uploadBtn } = this._mapLibraryElements;
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
    },

    // ============ Bestiary Methods ============

    bestiarySearchTimeout: null,

    onBestiarySearch(e) {
        clearTimeout(this.bestiarySearchTimeout);
        const query = e.target.value.trim();
        if (query.length < 2) {
            UI.clearBestiarySearchResults();
            return;
        }
        this.bestiarySearchTimeout = setTimeout(async () => {
            const results = await API.searchMonsters(query);
            UI.renderBestiarySearchResults(results);
        }, 300);
    },

    async onBestiaryResultClick(e) {
        const item = e.target.closest('.bestiary-result-item');
        if (!item) return;
        const slug = item.dataset.slug;

        // Add visual feedback for selection
        UI.elements.bestiarySearchResults.querySelectorAll('.bestiary-result-item').forEach(el => {
            el.classList.remove('selected');
        });
        item.classList.add('selected');

        let monster = this.monsterCache.get(slug);
        if (!monster) {
            monster = await API.getMonster(slug);
        }
        if (monster) {
            this.monsterCache.set(slug, monster);
            UI.renderBestiaryStatblock(monster);
        }
    },

    // ============ Custom Monsters ============

    customMonstersCache: [],

    async loadCustomMonsters() {
        const monsters = await API.getCustomMonsters();
        this.customMonstersCache = monsters;
        UI.renderCustomMonstersList(monsters);
    },

    async onCustomMonsterCardClick(e) {
        const card = e.target.closest('.custom-monster-card');
        if (!card) return;
        const slug = card.dataset.slug;
        const monster = this.customMonstersCache.find(m => m.slug === slug);
        if (!monster) return;

        // Handle add to encounter
        if (e.target.classList.contains('btn-add-to-encounter')) {
            const encounter = State.getCurrentEncounter();
            if (!encounter) {
                alert('Select an encounter in Prep mode first!');
                return;
            }
            State.addMonsterToEncounter(encounter.id, {
                slug: monster.slug,
                name: monster.name,
                cr: monster.cr
            });
            // Cache the monster data for combat
            this.monsterCache.set(monster.slug, monster);
            alert(`Added ${monster.name} to ${encounter.name}!`);
            return;
        }

        // Handle delete
        if (e.target.classList.contains('btn-delete-monster')) {
            if (!confirm(`Delete ${monster.name}? This cannot be undone.`)) return;
            const success = await API.deleteCustomMonster(slug);
            if (success) {
                await this.loadCustomMonsters();
            } else {
                alert('Failed to delete monster');
            }
            return;
        }

        // Clicking on card shows statblock
        UI.renderBestiaryStatblock(monster);
    },

    // ============ Command Center: Tab & Sidebar ============

    /**
     * Switch the active tab in the left sidebar.
     * @param {string} tabId - 'map-tools' or 'initiative'
     */
    switchTab(tabId) {
        // Update tab buttons
        document.querySelectorAll('.cc-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tabId);
        });
        // Update tab content panels
        document.querySelectorAll('.cc-tab-content').forEach(panel => {
            panel.classList.toggle('active', panel.id === `tab-${tabId}`);
        });

        // Trigger resize in case layout changed (e.g. sidebar width)
        if (Battlemap.canvas) {
            // Small delay to allow CSS layout to settle if needed
            requestAnimationFrame(() => {
                Battlemap.resizeCanvas();
                Battlemap.render();
            });
        }
    },

    /**
     * Open the Initiative tab in the left sidebar (used when starting combat).
     */
    openInitiativeTab() {
        this.switchTab('initiative');
    },

    /**
     * Toggle the right sidebar (statblock + dice) open/closed.
     * Calls Battlemap.resizeCanvas() after the CSS transition ends.
     */
    toggleRightSidebar() {
        const sidebar = document.getElementById('cc-right-sidebar');
        if (!sidebar) return;

        sidebar.classList.toggle('collapsed');

        // Update toggle button arrow direction
        const toggleBtn = document.getElementById('btn-toggle-right-sidebar');
        if (toggleBtn) {
            toggleBtn.innerHTML = sidebar.classList.contains('collapsed') ? '&#x276F;' : '&#x276E;';
        }

        // Resize canvas after CSS transition completes
        const onTransitionEnd = () => {
            sidebar.removeEventListener('transitionend', onTransitionEnd);
            if (Battlemap.canvas) {
                Battlemap.resizeCanvas();
                Battlemap.render();
            }
        };
        sidebar.addEventListener('transitionend', onTransitionEnd);
    },

    /**
     * Toggle the left sidebar (map tools / initiative) open/closed.
     */
    toggleLeftSidebar() {
        const sidebar = document.getElementById('cc-left-sidebar');
        if (!sidebar) return;

        sidebar.classList.toggle('collapsed');

        // Update collapse button text
        const collapseBtn = document.getElementById('btn-collapse-left');
        if (collapseBtn) {
            collapseBtn.innerHTML = sidebar.classList.contains('collapsed') ? '›' : '‹';
        }

        // Resize canvas after CSS transition completes
        const onTransitionEnd = () => {
            sidebar.removeEventListener('transitionend', onTransitionEnd);
            if (Battlemap.canvas) {
                Battlemap.resizeCanvas();
                Battlemap.render();
            }
        };
        sidebar.addEventListener('transitionend', onTransitionEnd);
    },

    /**
     * Set up the token-to-initiative selection sync.
     * Called once after Battlemap is initialized.
     */
    // ============ Dice Builder ============

    initDiceBuilder() {
        // Dice button clicks
        document.querySelectorAll('.dice-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const die = parseInt(btn.dataset.die);
                this.addDie(die);
            });
        });

        // Clear button
        document.getElementById('btn-clear-dice').addEventListener('click', () => {
            this.clearDice();
        });

        // Modifier controls
        document.getElementById('mod-minus').addEventListener('click', () => {
            this.adjustModifier(-1);
        });
        document.getElementById('mod-plus').addEventListener('click', () => {
            this.adjustModifier(1);
        });
        document.getElementById('dice-modifier').addEventListener('change', (e) => {
            this.diceBuilder.modifier = parseInt(e.target.value) || 0;
        });

        // Advantage toggle
        document.querySelectorAll('input[name="roll-mode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.diceBuilder.rollMode = e.target.value;
            });
        });

        // Roll button
        document.getElementById('btn-roll-dice').addEventListener('click', () => {
            this.rollBuiltDice();
        });

        // Quick input (power user text notation)
        document.getElementById('dice-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const notation = e.target.value.trim();
                if (notation) {
                    const result = Dice.roll(notation);
                    if (result) UI.addDiceResult(notation, result);
                    e.target.value = '';
                }
            }
        });
    },

    addDie(sides) {
        if (!this.diceBuilder.selectedDice[sides]) {
            this.diceBuilder.selectedDice[sides] = 0;
        }
        this.diceBuilder.selectedDice[sides]++;
        this.renderSelectedDice();

        // Show advantage toggle if d20 is selected
        const hasD20 = this.diceBuilder.selectedDice[20] > 0;
        document.getElementById('advantage-toggle').classList.toggle('hidden', !hasD20);
    },

    removeDie(sides) {
        if (this.diceBuilder.selectedDice[sides]) {
            this.diceBuilder.selectedDice[sides]--;
            if (this.diceBuilder.selectedDice[sides] <= 0) {
                delete this.diceBuilder.selectedDice[sides];
            }
        }
        this.renderSelectedDice();

        // Hide advantage toggle if no d20
        const hasD20 = this.diceBuilder.selectedDice[20] > 0;
        document.getElementById('advantage-toggle').classList.toggle('hidden', !hasD20);
    },

    clearDice() {
        this.diceBuilder.selectedDice = {};
        this.diceBuilder.modifier = 0;
        this.diceBuilder.rollMode = 'normal';
        document.getElementById('dice-modifier').value = 0;
        document.getElementById('advantage-toggle').classList.add('hidden');
        // Reset radio to normal
        const normalRadio = document.querySelector('input[name="roll-mode"][value="normal"]');
        if (normalRadio) normalRadio.checked = true;
        this.renderSelectedDice();
    },

    adjustModifier(delta) {
        this.diceBuilder.modifier = Math.max(-20, Math.min(20, this.diceBuilder.modifier + delta));
        document.getElementById('dice-modifier').value = this.diceBuilder.modifier;
    },

    renderSelectedDice() {
        const container = document.getElementById('selected-dice');
        const dice = this.diceBuilder.selectedDice;

        if (Object.keys(dice).length === 0) {
            container.innerHTML = '<span class="empty-tray">Click dice to add</span>';
            return;
        }

        container.innerHTML = Object.entries(dice)
            .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
            .map(([sides, count]) => `
                <span class="die-chip" data-die="${sides}" title="Click to remove">
                    <span class="die-count">${count}</span>d${sides}
                </span>
            `).join(' + ');

        // Add click handlers to remove dice
        container.querySelectorAll('.die-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                this.removeDie(parseInt(chip.dataset.die));
            });
        });
    },

    rollBuiltDice() {
        const dice = this.diceBuilder.selectedDice;
        const modifier = this.diceBuilder.modifier;
        const rollMode = this.diceBuilder.rollMode;

        if (Object.keys(dice).length === 0) {
            return; // Nothing to roll
        }

        // Build notation string for display
        const parts = Object.entries(dice)
            .sort((a, b) => parseInt(b[0]) - parseInt(a[0])) // d20 first
            .map(([sides, count]) => `${count}d${sides}`);

        if (modifier !== 0) {
            parts.push(modifier > 0 ? `+${modifier}` : `${modifier}`);
        }
        const notation = parts.join('+').replace('+-', '-');

        // Handle advantage/disadvantage for single d20 rolls
        if (dice[20] && dice[20] === 1 && rollMode !== 'normal') {
            const roll1 = Dice.rollDie(20);
            const roll2 = Dice.rollDie(20);
            const useRoll = rollMode === 'advantage'
                ? Math.max(roll1, roll2)
                : Math.min(roll1, roll2);

            // Roll remaining dice
            let otherTotal = modifier;
            const otherRolls = [];
            Object.entries(dice).forEach(([sides, count]) => {
                if (sides !== '20') {
                    for (let i = 0; i < count; i++) {
                        const r = Dice.rollDie(parseInt(sides));
                        otherRolls.push(r);
                        otherTotal += r;
                    }
                }
            });

            const total = useRoll + otherTotal;
            const result = {
                rolls: [useRoll, ...otherRolls],
                modifier,
                total,
                isCrit: useRoll === 20,
                isFumble: useRoll === 1,
                advantage: {
                    mode: rollMode,
                    roll1,
                    roll2,
                    used: useRoll
                }
            };

            UI.addDiceResultAdvantage(notation, result);
        } else {
            // Normal roll - roll each die type individually to support multi-die notation
            const allRolls = [];
            let total = modifier;
            Object.entries(dice)
                .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
                .forEach(([sides, count]) => {
                    for (let i = 0; i < count; i++) {
                        const r = Dice.rollDie(parseInt(sides));
                        allRolls.push(r);
                        total += r;
                    }
                });

            const hasD20 = dice[20] === 1;
            const result = {
                rolls: allRolls,
                modifier,
                total,
                notation,
                isCrit: hasD20 && allRolls[0] === 20,
                isFumble: hasD20 && allRolls[0] === 1
            };

            UI.addDiceResult(notation, result);
        }
    },

    // ============ Combat Selection Helper ============

    getSelectedCombatant() {
        const combat = State.getActiveCombat();
        if (!combat || !Battlemap.canvas) return null;
        const selectedTokenId = Battlemap.state.selectedTokenId;
        if (!selectedTokenId) return null;
        const token = Battlemap.state.tokens.find(t => t.id === selectedTokenId);
        if (!token) return null;
        return combat.combatants.find(c =>
            c.id === token.instanceId || c.id === token.id
        ) || null;
    },

    // ============ Selection Sync ============

    setupSelectionSync() {
        // When a token is clicked on the canvas, highlight the matching initiative item
        Battlemap.onTokenSelect = async (combatantId) => {
            if (!combatantId) return;
            const combat = State.getActiveCombat();
            if (!combat) return;

            const combatant = combat.combatants.find(c => c.id === combatantId);
            if (!combatant) return;

            // Highlight the initiative row
            const initiativeList = document.getElementById('initiative-list');
            if (initiativeList) {
                initiativeList.querySelectorAll('.initiative-item.highlighted').forEach(el => {
                    el.classList.remove('highlighted');
                });
                const item = initiativeList.querySelector(`.initiative-item[data-id="${combatantId}"]`);
                if (item) {
                    item.classList.add('highlighted');
                }
            }

            // Show statblock for the clicked token's monster
            if (combatant.slug) {
                let monster = this.monsterCache.get(combatant.slug);
                if (!monster) monster = await API.getMonster(combatant.slug);
                if (monster) {
                    this.monsterCache.set(combatant.slug, monster);
                    UI.renderStatblock(monster);
                }
            }
        };
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());

