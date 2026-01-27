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
        hasMore: false,
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

        // Infinite scroll handler
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

            this.renderResults(true);
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
        const threshold = 100;

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
        this.elements.resultsCount.textContent = `${this.state.totalCount} spells found`;

        const html = this.state.results.map(spell => this.renderSpellItem(spell)).join('');

        if (append) {
            this.elements.resultsContainer.insertAdjacentHTML('beforeend', html);
        } else {
            this.elements.resultsContainer.innerHTML = html || '<p class="empty-state">No spells found</p>';
        }

        // Attach click handlers via delegation
        this.elements.resultsContainer.onclick = (e) => {
            const item = e.target.closest('.spell-result-item');
            if (item) {
                this.selectSpell(item.dataset.slug);
            }
        };
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
            tags.push('<span title="Concentration">\u27F3</span>');
        }
        if (spell.can_be_cast_as_ritual || spell.ritual === 'yes') {
            tags.push('<span title="Ritual">\u{1F4D6}</span>');
        }

        return `
            <div class="spell-result-item ${isCustom ? 'custom' : ''} ${this.state.selectedSpell === spell.slug ? 'selected' : ''}"
                 data-slug="${spell.slug}">
                <span class="spell-school-icon" style="color: ${schoolInfo.color}">${schoolInfo.icon}</span>
                <div class="spell-result-info">
                    <div class="spell-result-name">${this.escapeHtml(spell.name)}</div>
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
            tags.push('<span class="spell-tag concentration">\u27F3 Concentration</span>');
        }
        if (isRitual) {
            tags.push('<span class="spell-tag ritual">\u{1F4D6} Ritual</span>');
        }

        let html = `
            <div class="spell-card" style="--spell-color: ${schoolInfo.color}">
                <div class="spell-card-header">
                    <span class="spell-card-icon" style="color: ${schoolInfo.color}">${schoolInfo.icon}</span>
                    <div class="spell-card-title">
                        <h2>${this.escapeHtml(spell.name)}${isCustom ? '<span class="spell-custom-badge">Custom</span>' : ''}</h2>
                        <p class="spell-card-subtitle">${levelText} ${spell.school || ''}</p>
                        ${tags.length ? `<div class="spell-card-tags">${tags.join('')}</div>` : ''}
                    </div>
                </div>

                <hr>

                <div class="spell-stats">
                    <div class="spell-stat">
                        <span class="spell-stat-icon">\u23F1</span>
                        <div>
                            <div class="spell-stat-label">Casting Time</div>
                            <div class="spell-stat-value">${this.escapeHtml(spell.casting_time || 'N/A')}</div>
                        </div>
                    </div>
                    <div class="spell-stat">
                        <span class="spell-stat-icon">\u{1F4CF}</span>
                        <div>
                            <div class="spell-stat-label">Range</div>
                            <div class="spell-stat-value">${this.escapeHtml(spell.range || 'N/A')}</div>
                        </div>
                    </div>
                    <div class="spell-stat">
                        <span class="spell-stat-icon">\u{1F9E9}</span>
                        <div>
                            <div class="spell-stat-label">Components</div>
                            <div class="spell-stat-value">${this.escapeHtml(spell.components || 'N/A')}</div>
                        </div>
                    </div>
                    <div class="spell-stat">
                        <span class="spell-stat-icon">\u23F3</span>
                        <div>
                            <div class="spell-stat-label">Duration</div>
                            <div class="spell-stat-value">${this.escapeHtml(spell.duration || 'N/A')}</div>
                        </div>
                    </div>
                </div>

                ${spell.material ? `<p><em>Material: ${this.escapeHtml(spell.material)}</em></p>` : ''}

                <hr>

                <div class="spell-description">
                    ${this.formatDescription(spell.desc)}
                </div>

                ${spell.higher_level ? `
                    <div class="spell-higher-levels">
                        <h4>At Higher Levels</h4>
                        <p>${this.escapeHtml(spell.higher_level)}</p>
                    </div>
                ` : ''}

                <div class="spell-classes">
                    <strong>Classes:</strong> ${this.escapeHtml(spell.dnd_class || 'Unknown')}
                </div>

                ${spell.document__title ? `
                    <div class="spell-source">
                        Source: ${this.escapeHtml(spell.document__title)}
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

        return desc
            .split('\n\n')
            .map(p => `<p>${this.escapeHtml(p.trim())}</p>`)
            .join('');
    },

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
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

            if (!spell.name) {
                throw new Error('Spell must have a name');
            }

            if (spell.spell_level === undefined && spell.level_int !== undefined) {
                spell.spell_level = spell.level_int;
            }
            if (spell.spell_level === undefined) {
                spell.spell_level = 0;
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
            API.cache.clear();
            this.state.selectedSpell = null;
            this.elements.detailPanel.innerHTML = '<p class="empty-state">Spell deleted</p>';
            this.search();
        }
    }
};

window.Spellbook = Spellbook;
