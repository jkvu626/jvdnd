/**
 * UI rendering module
 */

const UI = {
    elements: {},

    init() {
        this.elements = {
            btnWorldMode: document.getElementById('btn-world-mode'),
            btnPrepMode: document.getElementById('btn-prep-mode'),
            btnPartyMode: document.getElementById('btn-party-mode'),
            btnMapMode: document.getElementById('btn-map-mode'),
            btnBestiaryMode: document.getElementById('btn-bestiary-mode'),
            btnSpellbookMode: document.getElementById('btn-spellbook-mode'),
            worldMode: document.getElementById('world-mode'),
            prepMode: document.getElementById('prep-mode'),
            partyMode: document.getElementById('party-mode'),
            mapMode: document.getElementById('map-mode'),
            bestiaryMode: document.getElementById('bestiary-mode'),
            spellbookMode: document.getElementById('spellbook-mode'),
            bestiarySearchInput: document.getElementById('bestiary-search-input'),
            bestiarySearchResults: document.getElementById('bestiary-search-results'),
            bestiaryStatblock: document.getElementById('bestiary-statblock'),
            encountersList: document.getElementById('encounters-list'),
            btnNewEncounter: document.getElementById('btn-new-encounter'),
            noEncounterSelected: document.getElementById('no-encounter-selected'),
            encounterForm: document.getElementById('encounter-form'),
            encounterName: document.getElementById('encounter-name'),
            monsterSearch: document.getElementById('monster-search'),
            searchResults: document.getElementById('search-results'),
            encounterMonsters: document.getElementById('encounter-monsters'),
            btnSaveEncounter: document.getElementById('btn-save-encounter'),

            btnRunEncounter: document.getElementById('btn-run-encounter'),
            btnDeleteEncounter: document.getElementById('btn-delete-encounter'),
            linkedMapDisplay: document.getElementById('linked-map-display'),
            btnLinkMap: document.getElementById('btn-link-map'),
            noActiveEncounter: document.getElementById('no-active-encounter'),
            combatView: document.getElementById('combat-view'),
            initiativeList: document.getElementById('initiative-list'),
            btnPrevTurn: document.getElementById('btn-prev-turn'),
            btnNextTurn: document.getElementById('btn-next-turn'),
            btnPrevTurnIndicator: document.getElementById('btn-prev-turn-indicator'),
            btnNextTurnIndicator: document.getElementById('btn-next-turn-indicator'),
            btnEndEncounter: document.getElementById('btn-end-encounter'),
            activeStatblock: document.getElementById('active-statblock'),
            diceInput: document.getElementById('dice-input'),
            btnRollDice: document.getElementById('btn-roll-dice'),
            diceResults: document.getElementById('dice-results'),
            pcName: document.getElementById('char-name'),
            pcAc: document.getElementById('char-ac'),
            pcHp: document.getElementById('char-hp'),
            btnAddPc: document.getElementById('btn-add-character'),
            partyList: document.getElementById('characters-list'),
            charSearch: document.getElementById('char-search'),
            charType: document.getElementById('char-type'),
            characterDetail: document.getElementById('character-detail'),
            initiativeModal: document.getElementById('initiative-modal'),
            initiativeInputs: document.getElementById('initiative-inputs'),
            btnStartCombat: document.getElementById('btn-start-combat'),
            charBaseCreature: document.getElementById('char-base-creature'),
            sidekickCreatureResults: document.getElementById('sidekick-creature-results'),
            // Import modal elements
            btnImportMonster: document.getElementById('btn-import-monster'),
            importModal: document.getElementById('import-modal'),
            importText: document.getElementById('import-text'),
            btnParseImport: document.getElementById('btn-parse-import'),
            importPreview: document.getElementById('import-preview'),
            btnSaveImport: document.getElementById('btn-save-import'),
            btnCancelImport: document.getElementById('btn-cancel-import'),
            // Custom monsters
            customMonstersList: document.getElementById('custom-monsters-list')
        };
    },



    showMode(mode) {
        ['world', 'prep', 'party', 'map', 'bestiary', 'spellbook'].forEach(m => {
            const view = this.elements[`${m}Mode`];
            const btn = this.elements[`btn${m.charAt(0).toUpperCase() + m.slice(1)}Mode`];
            if (m === mode) {
                view.classList.add('active');
                view.classList.remove('hidden');
                btn.classList.add('active');
            } else {
                view.classList.remove('active');
                view.classList.add('hidden');
                btn.classList.remove('active');
            }
        });
    },

    /**
     * Set the sidebar context visibility based on current mode
     * @param {string} context - 'world', 'explore', or 'combat'
     */
    setSidebarContext(context) {
        document.querySelectorAll('.sidebar-section[data-context]').forEach(el => {
            if (el.dataset.context === context) {
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        });
    },

    renderEncountersList(encounters, currentId) {
        this.elements.encountersList.innerHTML = encounters.map(e => `
            <li class="encounter-item ${e.id === currentId ? 'selected' : ''}" data-id="${e.id}">
                ${e.linkedMapId ? '<span class="map-icon" title="Has linked map">&#x1F5FA;</span>' : ''}
                ${e.scene ? '<span class="map-icon" title="Has saved scene">&#x1F3AD;</span>' : ''}
                <div class="name">${this.escapeHtml(e.name)}</div>
                <div class="monster-count">${e.monsters.length} monster type(s)</div>
            </li>
        `).join('');
    },

    showEncounterForm(encounter) {
        this.elements.noEncounterSelected.classList.add('hidden');
        this.elements.encounterForm.classList.remove('hidden');
        this.elements.encounterName.value = encounter.name;
        this.renderEncounterMonsters(encounter.monsters);
        this.renderLinkedMap(encounter.linkedMapId);
    },

    async renderLinkedMap(mapId) {
        const display = this.elements.linkedMapDisplay;
        if (!display) return;

        if (!mapId) {
            display.innerHTML = '<span class="no-map-linked">No map linked</span>';
            return;
        }

        try {
            const maps = await API.getMaps();
            const map = maps.find(m => m.id === mapId);
            if (map) {
                display.innerHTML = `
                    <div class="map-preview">
                        <img src="${map.thumbnail}" alt="${this.escapeHtml(map.name)}">
                        <span class="map-name">${this.escapeHtml(map.name)}</span>
                        <button class="btn-unlink" title="Unlink map">&times;</button>
                    </div>
                `;
            } else {
                display.innerHTML = '<span class="no-map-linked">Linked map not found</span>';
            }
        } catch {
            display.innerHTML = '<span class="no-map-linked">No map linked</span>';
        }
    },

    hideEncounterForm() {
        this.elements.noEncounterSelected.classList.remove('hidden');
        this.elements.encounterForm.classList.add('hidden');
    },

    renderEncounterMonsters(monsters) {
        this.elements.encounterMonsters.innerHTML = monsters.map(m => `
            <div class="combatant-card" data-slug="${m.slug}" data-name="${this.escapeHtml(m.name)}" draggable="true">
                <span class="name">${this.escapeHtml(m.name)}</span>
                <span class="cr">CR ${m.cr}</span>
                <div class="qty-control">
                    <button class="btn-small qty-minus">−</button>
                    <span class="qty">${m.qty}</span>
                    <button class="btn-small qty-plus">+</button>
                </div>
                <button class="remove-btn" title="Remove">×</button>
            </div>
        `).join('');

        // Add drag handlers for spawning tokens
        this.elements.encounterMonsters.querySelectorAll('.combatant-card').forEach(card => {
            card.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('application/json', JSON.stringify({
                    type: 'monster',
                    slug: card.dataset.slug,
                    name: card.dataset.name
                }));
                e.dataTransfer.effectAllowed = 'copy';
            });
        });
    },

    renderSearchResults(results) {
        if (results.length === 0) {
            this.elements.searchResults.classList.add('hidden');
            return;
        }
        this.elements.searchResults.innerHTML = results.map(m => `
            <div class="search-result-item" data-slug="${m.slug}" data-name="${this.escapeHtml(m.name)}" data-cr="${m.cr}">
                <span class="monster-name">${this.escapeHtml(m.name)}</span>
                <span class="monster-cr">CR ${m.cr}</span>
            </div>
        `).join('');
        this.elements.searchResults.classList.remove('hidden');
    },

    hideSearchResults() {
        this.elements.searchResults.classList.add('hidden');
    },

    renderPartyList(party) {
        if (party.length === 0) {
            this.elements.partyList.innerHTML = '<p class="empty-state">No party members yet</p>';
            return;
        }
        this.elements.partyList.innerHTML = party.map(m => `
            <div class="party-member" data-id="${m.id}">
                <div class="info">
                    <span class="name">${this.escapeHtml(m.name)}</span>
                    <span class="stat">AC ${m.ac}</span>
                    <span class="stat">HP ${m.hp ?? m.maxHp}/${m.maxHp}</span>
                </div>
                <button class="remove-btn" title="Remove">×</button>
            </div>
        `).join('');
    },

    clearPartyInputs() {
        this.elements.pcName.value = '';
        this.elements.pcAc.value = '';
        this.elements.pcHp.value = '';
        this.elements.pcName.focus();
    },

    showInitiativeModal(players) {
        this.elements.initiativeInputs.innerHTML = players.map(p => `
            <div class="init-input-row" data-id="${p.id}">
                <span class="name">${this.escapeHtml(p.name)}</span>
                <input type="number" class="player-init" placeholder="Init" min="1" max="30">
            </div>
        `).join('');
        this.elements.initiativeModal.classList.remove('hidden');
        const firstInput = this.elements.initiativeInputs.querySelector('input');
        if (firstInput) firstInput.focus();
    },

    hideInitiativeModal() {
        this.elements.initiativeModal.classList.add('hidden');
    },

    getPlayerInitiatives() {
        const inputs = this.elements.initiativeInputs.querySelectorAll('.init-input-row');
        const initiatives = [];
        inputs.forEach(row => {
            initiatives.push({ id: row.dataset.id, initiative: parseInt(row.querySelector('input').value) || 10 });
        });
        return initiatives;
    },

    showCombatView() {
        this.elements.noActiveEncounter.classList.add('hidden');
        this.elements.combatView.classList.remove('hidden');
    },

    hideCombatView() {
        this.elements.noActiveEncounter.classList.remove('hidden');
        this.elements.combatView.classList.add('hidden');
    },

    renderInitiativeList(combatants, currentTurn) {
        this.elements.initiativeList.innerHTML = combatants.map((c, i) => {
            const hpPercent = (c.hp / c.maxHp) * 100;
            let hpClass = c.hp <= 0 ? 'dead' : hpPercent <= 25 ? 'critical' : hpPercent <= 50 ? 'bloodied' : '';
            const isPlayer = c.isPlayer;
            const noToken = !c.isPlayer && c.hasToken === false;
            return `
                <li class="initiative-item ${i === currentTurn ? 'active' : ''} ${c.hp <= 0 ? 'dead' : ''} ${isPlayer ? 'is-player' : ''}"
                    data-id="${c.id}" data-slug="${c.slug || ''}" data-name="${this.escapeHtml(c.name)}" ${!isPlayer ? 'draggable="true"' : ''}>
                    <div class="top-row">
                        <span class="name">${this.escapeHtml(c.name)}${noToken ? '<span class="no-token-badge">No Token</span>' : ''}</span>
                        <span class="init-value">${c.initiative}</span>
                    </div>
                    <div class="stats-row">
                        <span class="hp ${hpClass}">HP: <input type="text" class="hp-input" value="${c.hp}" data-max="${c.maxHp}">/${c.maxHp}</span>
                        <span class="ac">AC ${c.ac}</span>
                    </div>
                </li>`;
        }).join('');

        // Add drag handlers for non-player combatants
        this.elements.initiativeList.querySelectorAll('.initiative-item:not(.is-player)').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('application/json', JSON.stringify({
                    type: 'combatant',
                    id: item.dataset.id,
                    slug: item.dataset.slug,
                    name: item.dataset.name
                }));
                e.dataTransfer.effectAllowed = 'copy';
            });
        });
    },

    // ============ Statblock Helper Functions ============

    formatMod(score) {
        const m = Math.floor((score - 10) / 2);
        return m >= 0 ? `+${m}` : `${m}`;
    },

    formatSpeed(speed) {
        if (!speed) return '30 ft.';
        if (typeof speed === 'string') return speed;
        const parts = [];
        if (speed.walk) parts.push(`${speed.walk} ft.`);
        if (speed.fly) parts.push(`fly ${speed.fly} ft.`);
        if (speed.swim) parts.push(`swim ${speed.swim} ft.`);
        if (speed.burrow) parts.push(`burrow ${speed.burrow} ft.`);
        if (speed.climb) parts.push(`climb ${speed.climb} ft.`);
        return parts.join(', ') || '30 ft.';
    },

    formatSaves(monster) {
        const saves = [];
        const abbr = {
            strength: 'Str', dexterity: 'Dex', constitution: 'Con',
            intelligence: 'Int', wisdom: 'Wis', charisma: 'Cha'
        };
        for (const [stat, ab] of Object.entries(abbr)) {
            const val = monster[`${stat}_save`];
            if (val !== null && val !== undefined) {
                saves.push(`${ab} +${val}`);
            }
        }
        return saves.join(', ');
    },

    formatSkills(skills) {
        if (!skills || typeof skills !== 'object') return '';
        return Object.entries(skills)
            .map(([name, mod]) => `${name} +${mod}`)
            .join(', ');
    },

    renderAbilitySection(title, abilities, addRollButtons = false, preamble = '') {
        if (!abilities?.length) return '';
        let html = `<div class="section-title">${title}</div>`;
        if (preamble) html += `<p class="legendary-preamble"><em>${preamble}</em></p>`;

        abilities.forEach(ability => {
            let desc = ability.desc;
            if (addRollButtons) {
                // Attack rolls - match "+X to hit"
                const attackMatch = desc.match(/([+-]\d+)\s+to\s+hit/i);
                if (attackMatch) {
                    desc = desc.replace(attackMatch[0],
                        `<button class="roll-btn" data-roll="1d20${attackMatch[1]}" data-type="attack">${attackMatch[0]}</button>`);
                }
                // Damage rolls - match "5 (1d6 + 2) slashing damage"
                desc = desc.replace(/\d+\s*\((\d+d\d+(?:\s*[+-]\s*\d+)?)\)\s+(\w+)\s+damage/gi,
                    (match, dice, type) => {
                        const cleanDice = dice.replace(/\s+/g, '');
                        return `<button class="roll-btn" data-roll="${cleanDice}" data-type="damage">${dice} ${type}</button>`;
                    });
            }
            html += `<div class="action"><span class="action-name">${ability.name}.</span> ${desc}</div>`;
        });
        return html;
    },

    renderStatblock(monster) {
        const saves = this.formatSaves(monster);
        const skills = this.formatSkills(monster.skills);

        this.elements.activeStatblock.innerHTML = `
            <div class="monster-header">
                <div class="monster-name">${this.escapeHtml(monster.name)}</div>
                <div class="monster-type">${monster.size} ${monster.type}, ${monster.alignment}</div>
            </div>
            <div class="property"><span class="property-name">AC</span> ${monster.armor_class}${monster.armor_desc ? ` (${monster.armor_desc})` : ''}</div>
            <div class="property"><span class="property-name">HP</span> ${monster.hit_points} (${monster.hit_dice})</div>
            <div class="property"><span class="property-name">Speed</span> ${this.formatSpeed(monster.speed)}</div>
            <div class="stats-block">
                ${['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].map(s =>
            `<div class="stat"><span class="stat-name">${s.slice(0, 3).toUpperCase()}</span><span class="stat-value">${monster[s]}</span><span class="stat-mod">(${this.formatMod(monster[s])})</span></div>`
        ).join('')}
            </div>
            ${saves ? `<div class="property"><span class="property-name">Saving Throws</span> ${saves}</div>` : ''}
            ${skills ? `<div class="property"><span class="property-name">Skills</span> ${skills}</div>` : ''}
            ${monster.damage_vulnerabilities ? `<div class="property"><span class="property-name">Vulnerabilities</span> ${monster.damage_vulnerabilities}</div>` : ''}
            ${monster.damage_resistances ? `<div class="property"><span class="property-name">Resistances</span> ${monster.damage_resistances}</div>` : ''}
            ${monster.damage_immunities ? `<div class="property"><span class="property-name">Damage Immunities</span> ${monster.damage_immunities}</div>` : ''}
            ${monster.condition_immunities ? `<div class="property"><span class="property-name">Condition Immunities</span> ${monster.condition_immunities}</div>` : ''}
            ${monster.senses ? `<div class="property"><span class="property-name">Senses</span> ${monster.senses}</div>` : ''}
            ${monster.languages ? `<div class="property"><span class="property-name">Languages</span> ${monster.languages}</div>` : ''}
            <div class="property"><span class="property-name">CR</span> ${monster.cr}</div>
            ${this.renderAbilitySection('Traits', monster.special_abilities, false)}
            ${this.renderAbilitySection('Actions', monster.actions, true)}
            ${this.renderAbilitySection('Bonus Actions', monster.bonus_actions, true)}
            ${this.renderAbilitySection('Reactions', monster.reactions, true)}
            ${this.renderAbilitySection('Legendary Actions', monster.legendary_actions, true, monster.legendary_desc)}`;
    },

    clearStatblock() {
        this.elements.activeStatblock.innerHTML = '<p class="empty-state">Click a combatant to view statblock</p>';
    },

    addDiceResult(notation, result) {
        const div = document.createElement('div');
        div.className = 'dice-result';

        let totalClass = '';
        if (result.isCrit) totalClass = 'crit';
        else if (result.isFumble) totalClass = 'fumble';

        div.innerHTML = `
            <div class="roll-expression">${notation}</div>
            <div class="roll-total ${totalClass}">
                ${result.total}
                ${result.isCrit ? ' \u{1F3AF} CRIT!' : ''}
                ${result.isFumble ? ' \u{1F480} FUMBLE' : ''}
            </div>`;
        this.elements.diceResults.insertBefore(div, this.elements.diceResults.firstChild);
        while (this.elements.diceResults.children.length > 10) this.elements.diceResults.removeChild(this.elements.diceResults.lastChild);
    },

    addDiceResultAdvantage(notation, result) {
        const div = document.createElement('div');
        div.className = 'dice-result';

        const advantageHtml = result.advantage ? `
            <div class="advantage-info">
                ${result.advantage.mode === 'advantage' ? '\u25B2 Advantage' : '\u25BC Disadvantage'}:
                <span class="${result.advantage.roll1 === result.advantage.used ? 'used' : 'discarded'}">${result.advantage.roll1}</span>
                /
                <span class="${result.advantage.roll2 === result.advantage.used ? 'used' : 'discarded'}">${result.advantage.roll2}</span>
            </div>
        ` : '';

        let totalClass = '';
        if (result.isCrit) totalClass = 'crit';
        else if (result.isFumble) totalClass = 'fumble';

        div.innerHTML = `
            <div class="roll-expression">${notation}</div>
            ${advantageHtml}
            <div class="roll-total ${totalClass}">
                ${result.total}
                ${result.isCrit ? ' \u{1F3AF} CRIT!' : ''}
                ${result.isFumble ? ' \u{1F480} FUMBLE' : ''}
            </div>
        `;

        this.elements.diceResults.insertBefore(div, this.elements.diceResults.firstChild);
        while (this.elements.diceResults.children.length > 10) {
            this.elements.diceResults.removeChild(this.elements.diceResults.lastChild);
        }
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // ============ Import Modal ============

    showImportModal() {
        this.elements.importModal.classList.remove('hidden');
        this.elements.importText.value = '';
        this.elements.importPreview.innerHTML = '<p class="empty-state">Paste a statblock above and click Parse</p>';
        this.elements.btnSaveImport.disabled = true;
        this.elements.importText.focus();
    },

    hideImportModal() {
        this.elements.importModal.classList.add('hidden');
        this.currentParsedMonster = null;
    },

    showImportLoading() {
        this.elements.btnParseImport.disabled = true;
        this.elements.btnParseImport.textContent = 'Parsing...';
        this.elements.importPreview.innerHTML = '<p class="loading-state">🎲 AI is parsing your statblock...</p>';
    },

    hideImportLoading() {
        this.elements.btnParseImport.disabled = false;
        this.elements.btnParseImport.textContent = 'Parse';
    },

    renderImportPreview(monster) {
        this.currentParsedMonster = monster;
        this.elements.btnSaveImport.disabled = false;

        const saves = this.formatSaves(monster);
        const skills = this.formatSkills(monster.skills);

        // Helper for rendering sections without roll buttons (preview mode)
        const renderSection = (title, abilities, preamble = '') => {
            if (!abilities?.length) return '';
            let html = `<div class="section-title">${title}</div>`;
            if (preamble) html += `<p class="legendary-preamble"><em>${preamble}</em></p>`;
            abilities.forEach(a => {
                html += `<div class="action"><span class="action-name">${a.name}.</span> ${a.desc}</div>`;
            });
            return html;
        };

        this.elements.importPreview.innerHTML = `
            <div class="statblock-preview">
                <div class="monster-header">
                    <div class="monster-name">${this.escapeHtml(monster.name)}</div>
                    <div class="monster-type">${monster.size} ${monster.type}, ${monster.alignment}</div>
                </div>
                <div class="property"><span class="property-name">AC</span> ${monster.armor_class}${monster.armor_desc ? ` (${monster.armor_desc})` : ''}</div>
                <div class="property"><span class="property-name">HP</span> ${monster.hit_points} (${monster.hit_dice})</div>
                <div class="property"><span class="property-name">Speed</span> ${this.formatSpeed(monster.speed)}</div>
                <div class="stats-block">
                    ${['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].map(s =>
            `<div class="stat"><span class="stat-name">${s.slice(0, 3).toUpperCase()}</span><span class="stat-value">${monster[s]}</span><span class="stat-mod">(${this.formatMod(monster[s])})</span></div>`
        ).join('')}
                </div>
                ${saves ? `<div class="property"><span class="property-name">Saving Throws</span> ${saves}</div>` : ''}
                ${skills ? `<div class="property"><span class="property-name">Skills</span> ${skills}</div>` : ''}
                ${monster.damage_vulnerabilities ? `<div class="property"><span class="property-name">Vulnerabilities</span> ${monster.damage_vulnerabilities}</div>` : ''}
                ${monster.damage_resistances ? `<div class="property"><span class="property-name">Resistances</span> ${monster.damage_resistances}</div>` : ''}
                ${monster.damage_immunities ? `<div class="property"><span class="property-name">Damage Immunities</span> ${monster.damage_immunities}</div>` : ''}
                ${monster.condition_immunities ? `<div class="property"><span class="property-name">Condition Immunities</span> ${monster.condition_immunities}</div>` : ''}
                ${monster.senses ? `<div class="property"><span class="property-name">Senses</span> ${monster.senses}</div>` : ''}
                ${monster.languages ? `<div class="property"><span class="property-name">Languages</span> ${monster.languages}</div>` : ''}
                <div class="property"><span class="property-name">CR</span> ${monster.cr}</div>
                ${renderSection('Traits', monster.special_abilities)}
                ${renderSection('Actions', monster.actions)}
                ${renderSection('Bonus Actions', monster.bonus_actions)}
                ${renderSection('Reactions', monster.reactions)}
                ${renderSection('Legendary Actions', monster.legendary_actions, monster.legendary_desc)}
            </div>
        `;
    },

    showImportError(message) {
        this.elements.importPreview.innerHTML = `<p class="error-state">❌ ${this.escapeHtml(message)}</p>`;
        this.elements.btnSaveImport.disabled = true;
    },

    getCurrentParsedMonster() {
        return this.currentParsedMonster;
    },

    // ============ Bestiary ============

    renderBestiarySearchResults(results) {
        if (results.length === 0) {
            this.elements.bestiarySearchResults.innerHTML = '<p class="empty-state">No monsters found</p>';
            return;
        }
        this.elements.bestiarySearchResults.innerHTML = results.map(m => `
            <div class="bestiary-result-item" data-slug="${m.slug}">
                <span class="monster-name">${this.escapeHtml(m.name)}</span>
                <span class="monster-cr">CR ${m.cr}</span>
            </div>
        `).join('');
    },

    clearBestiarySearchResults() {
        this.elements.bestiarySearchResults.innerHTML = '';
    },

    renderBestiaryStatblock(monster) {
        const saves = this.formatSaves(monster);
        const skills = this.formatSkills(monster.skills);

        this.elements.bestiaryStatblock.innerHTML = `
            <div class="monster-header">
                <div class="monster-name">${this.escapeHtml(monster.name)}</div>
                <div class="monster-type">${monster.size} ${monster.type}, ${monster.alignment}</div>
            </div>
            <div class="property"><span class="property-name">AC</span> ${monster.armor_class}${monster.armor_desc ? ` (${monster.armor_desc})` : ''}</div>
            <div class="property"><span class="property-name">HP</span> ${monster.hit_points} (${monster.hit_dice})</div>
            <div class="property"><span class="property-name">Speed</span> ${this.formatSpeed(monster.speed)}</div>
            <div class="stats-block">
                ${['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].map(s =>
            `<div class="stat"><span class="stat-name">${s.slice(0, 3).toUpperCase()}</span><span class="stat-value">${monster[s]}</span><span class="stat-mod">(${this.formatMod(monster[s])})</span></div>`
        ).join('')}
            </div>
            ${saves ? `<div class="property"><span class="property-name">Saving Throws</span> ${saves}</div>` : ''}
            ${skills ? `<div class="property"><span class="property-name">Skills</span> ${skills}</div>` : ''}
            ${monster.damage_vulnerabilities ? `<div class="property"><span class="property-name">Vulnerabilities</span> ${monster.damage_vulnerabilities}</div>` : ''}
            ${monster.damage_resistances ? `<div class="property"><span class="property-name">Resistances</span> ${monster.damage_resistances}</div>` : ''}
            ${monster.damage_immunities ? `<div class="property"><span class="property-name">Damage Immunities</span> ${monster.damage_immunities}</div>` : ''}
            ${monster.condition_immunities ? `<div class="property"><span class="property-name">Condition Immunities</span> ${monster.condition_immunities}</div>` : ''}
            ${monster.senses ? `<div class="property"><span class="property-name">Senses</span> ${monster.senses}</div>` : ''}
            ${monster.languages ? `<div class="property"><span class="property-name">Languages</span> ${monster.languages}</div>` : ''}
            <div class="property"><span class="property-name">CR</span> ${monster.cr}</div>
            ${this.renderAbilitySection('Traits', monster.special_abilities, false)}
            ${this.renderAbilitySection('Actions', monster.actions, false)}
            ${this.renderAbilitySection('Bonus Actions', monster.bonus_actions, false)}
            ${this.renderAbilitySection('Reactions', monster.reactions, false)}
            ${this.renderAbilitySection('Legendary Actions', monster.legendary_actions, false, monster.legendary_desc)}`;
    },

    clearBestiaryStatblock() {
        this.elements.bestiaryStatblock.innerHTML = '<p class="empty-state">Search for a monster to view its statblock</p>';
    },

    // ============ Custom Monsters ============

    renderCustomMonstersList(monsters) {
        if (!monsters || monsters.length === 0) {
            this.elements.customMonstersList.innerHTML = '<p class="empty-state">No custom monsters yet. Use "Import Monster" to add some!</p>';
            return;
        }
        this.elements.customMonstersList.innerHTML = monsters.map(m => `
            <div class="custom-monster-card" data-slug="${m.slug}">
                <div class="monster-info">
                    <span class="monster-name">${this.escapeHtml(m.name)}</span>
                    <span class="monster-meta">${m.size} ${m.type} • CR ${m.cr}</span>
                </div>
                <div class="monster-actions">
                    <button class="btn-small btn-add-to-encounter" title="Add to current encounter">+ Encounter</button>
                    <button class="btn-small btn-danger btn-delete-monster" title="Delete">×</button>
                </div>
            </div>
        `).join('');
    },

    clearCustomMonstersList() {
        this.elements.customMonstersList.innerHTML = '';
    }
};

