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

        // Party mode
        UI.elements.btnAddPc.addEventListener('click', () => this.addPartyMember());
        UI.elements.partyList.addEventListener('click', (e) => this.onPartyMemberClick(e));

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
    },

    async _ensureBattlemapReady() {
        if (!Battlemap.canvas) {
            await Battlemap.init();
            this.setupSelectionSync();
        }
        Battlemap.resizeCanvas();
        Battlemap.render();
        Battlemap.renderTokenList();
        Battlemap.renderEncounterPanel();
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

        // Update encounter panel in map mode if battlemap is initialized
        if (Battlemap.canvas) {
            Battlemap.renderEncounterPanel();
        }
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

            // Update encounter panel if battlemap is initialized
            if (Battlemap.canvas) {
                Battlemap.renderEncounterPanel();
            }
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

    // Party management
    addPartyMember() {
        const name = UI.elements.pcName.value.trim();
        const ac = UI.elements.pcAc.value;
        const hp = UI.elements.pcHp.value;
        if (!name || !ac || !hp) return;
        State.addPartyMember(name, ac, hp);
        UI.renderPartyList(State.getParty());
        UI.clearPartyInputs();


    },

    onPartyMemberClick(e) {
        if (!e.target.classList.contains('remove-btn')) return;
        const member = e.target.closest('.party-member');
        if (member) {
            State.removePartyMember(member.dataset.id);
            UI.renderPartyList(State.getParty());


        }
    },

    // Combat
    async startEncounter() {
        const encounter = State.getCurrentEncounter();
        if (!encounter || encounter.monsters.length === 0) return alert('Add some monsters first!');
        const party = State.getParty();

        // Show loading state
        UI.elements.btnRunEncounter.disabled = true;
        UI.elements.btnRunEncounter.textContent = 'Loading...';

        try {
            // Auto-init Battlemap if not already initialized
            if (!Battlemap.canvas) {
                await Battlemap.init();
                this.setupSelectionSync();
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
        const party = State.getParty();
        const combatants = [...this._pendingCombatants];

        // Players are always added from party roster, never from tokens
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
                isPlayer: true,
                hasToken: false
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

    closeMapLibrary() {
        if (this._mapLibraryElements) {
            this._mapLibraryElements.modal.classList.add('hidden');
        }
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

