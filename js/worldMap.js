/**
 * WorldMapRenderer - Handles world map display, pan/zoom, and pin interactions
 */
class WorldMapRenderer {
    constructor(containerId, worldManager) {
        this.container = document.getElementById(containerId);
        this.viewport = document.getElementById('world-map-viewport');
        this.layer = document.getElementById('world-pins-layer');
        this.sidebar = document.getElementById('world-sidebar');
        this.worldManager = worldManager;

        this.scale = 1;
        this.pan = { x: 0, y: 0 };
        this.isDragging = false;
        this.lastMouse = { x: 0, y: 0 };

        this.selectedLocation = null;

        // DM Tools state
        this.activeTool = null; // 'add', 'edit', 'delete'
        this.pendingPinCoords = null;

        // Party movement state
        this.partySelected = false;
        this.travelAnimation = null;

        if (this.viewport) {
            this.initEventListeners();
        }
    }

    initEventListeners() {
        // Pan Logic - mousedown on viewport (middle-click only)
        this.viewport.addEventListener('mousedown', (e) => {
            // Only start drag on middle mouse button
            if (e.button !== 1) return;
            e.preventDefault();
            this.isDragging = true;
            this.lastMouse = { x: e.clientX, y: e.clientY };
            this.viewport.style.cursor = 'grabbing';
        });

        // Pan Logic - mousemove on window
        window.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;

            const dx = e.clientX - this.lastMouse.x;
            const dy = e.clientY - this.lastMouse.y;

            this.pan.x += dx;
            this.pan.y += dy;
            this.lastMouse = { x: e.clientX, y: e.clientY };
            this.updateTransform();
        });

        // Pan Logic - mouseup on window
        window.addEventListener('mouseup', (e) => {
            if (this.isDragging) {
                this.isDragging = false;
                this.viewport.style.cursor = '';
            }
        });

        // Prevent context menu on middle-click
        this.viewport.addEventListener('auxclick', (e) => {
            if (e.button === 1) {
                e.preventDefault();
            }
        });

        // Zoom Logic - wheel on viewport
        this.viewport.addEventListener('wheel', (e) => {
            e.preventDefault();

            const rect = this.viewport.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Calculate zoom
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            const newScale = Math.max(0.25, Math.min(4, this.scale * delta));

            if (newScale !== this.scale) {
                // Adjust pan to zoom towards mouse position
                const scaleRatio = newScale / this.scale;
                this.pan.x = mouseX - (mouseX - this.pan.x) * scaleRatio;
                this.pan.y = mouseY - (mouseY - this.pan.y) * scaleRatio;
                this.scale = newScale;
                this.updateTransform();
            }
        }, { passive: false });

        // Keyboard shortcuts for zoom
        document.addEventListener('keydown', (e) => {
            // Only respond if world mode is active
            const worldMode = document.getElementById('world-mode');
            if (!worldMode || worldMode.classList.contains('hidden')) return;

            if (e.key === '+' || e.key === '=') {
                this.zoomIn();
            } else if (e.key === '-') {
                this.zoomOut();
            } else if (e.key === '0') {
                this.resetView();
            }
        });
    }

    updateTransform() {
        if (this.container) {
            this.container.style.transform = `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.scale})`;
        }
    }

    zoomIn() {
        this.scale = Math.min(4, this.scale * 1.2);
        this.updateTransform();
    }

    zoomOut() {
        this.scale = Math.max(0.25, this.scale * 0.8);
        this.updateTransform();
    }

    resetView() {
        this.scale = 1;
        this.pan = { x: 0, y: 0 };
        this.updateTransform();
    }

    render() {
        if (!this.worldManager.data || !this.layer) return;

        this.layer.innerHTML = '';
        const { party, locations } = this.worldManager.data;

        // Render Location Pins
        locations.forEach(loc => {
            const el = document.createElement('div');
            el.className = `world-pin pin-${loc.type || 'point'}`;
            el.style.left = `${loc.x}px`;
            el.style.top = `${loc.y}px`;
            el.setAttribute('data-name', loc.name);
            el.title = loc.name;

            el.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectLocation(loc);
            });

            this.layer.appendChild(el);
        });

        // Render Party Pin
        if (party && party.position) {
            const partyEl = document.createElement('div');
            partyEl.className = 'world-pin pin-party';
            partyEl.style.left = `${party.position.x}px`;
            partyEl.style.top = `${party.position.y}px`;
            partyEl.setAttribute('data-name', 'Party');
            partyEl.title = 'Current Party Location';

            partyEl.addEventListener('click', (e) => {
                e.stopPropagation();
                this.togglePartySelection();
            });

            // Double-click for instant travel
            partyEl.addEventListener('dblclick', (e) => {
                e.stopPropagation();
            });

            this.layer.appendChild(partyEl);
        }

        // Update party info overlay
        this.updatePartyOverlay();
    }

    selectLocation(location) {
        this.selectedLocation = location;
        document.dispatchEvent(new CustomEvent('locationSelected', { detail: location }));
        this.showLocationSidebar(location);
    }

    showLocationSidebar(location) {
        if (!this.sidebar) return;

        const typeIcons = {
            town: '🏘️',
            city: '🏰',
            dungeon: '⚠️',
            point: '📍'
        };

        // Get characters at this location
        const charactersHere = this.worldManager.getCharactersByLocation(location.id);
        const charactersSection = charactersHere.length > 0 ? `
            <div class="location-characters">
                <h3>Characters Here (${charactersHere.length})</h3>
                <ul style="list-style: none; padding: 0; margin: 8px 0;">
                    ${charactersHere.map(c => `
                        <li style="padding: 4px 0; color: #B8A88A;">
                            ${c.name} - HP: ${c.stats?.hp || '?'}/${c.stats?.maxHp || '?'}
                        </li>
                    `).join('')}
                </ul>
            </div>
        ` : '';

        this.sidebar.innerHTML = `
            <div class="world-sidebar-content">
                <div class="location-header">
                    <span class="location-icon">${typeIcons[location.type] || '📍'}</span>
                    <div class="location-title">
                        <h2>${location.name}</h2>
                        <span class="location-type">${location.type || 'Point of Interest'}</span>
                    </div>
                </div>
                
                <p class="location-description">${location.description || 'No description available.'}</p>
                
                ${charactersSection}
                
                <div class="location-actions">
                    <button class="btn-primary" id="btn-travel-here">Travel Here</button>
                    ${location.linkedMapId ? '<button class="btn-secondary" id="btn-enter-location">Enter Location</button>' : ''}
                    <button class="btn-secondary" id="btn-close-sidebar">Close</button>
                </div>
            </div>
        `;

        this.sidebar.classList.remove('hidden');

        // Bind button events
        document.getElementById('btn-travel-here')?.addEventListener('click', () => {
            this.travelToLocation(location);
        });

        document.getElementById('btn-enter-location')?.addEventListener('click', () => {
            this.enterLocation(location);
        });

        document.getElementById('btn-close-sidebar')?.addEventListener('click', () => {
            this.closeSidebar();
        });
    }

    showPartyInfo() {
        if (!this.sidebar || !this.worldManager.data) return;

        const party = this.worldManager.data.party;
        const partyMembers = this.worldManager.getPartyMembers();
        const currentLocation = this.worldManager.getLocation(party.locationId);

        this.sidebar.innerHTML = `
            <div class="world-sidebar-content">
                <div class="location-header">
                    <span class="location-icon">⚔️</span>
                    <div class="location-title">
                        <h2>The Party</h2>
                        <span class="location-type">${party.state || 'Idle'}</span>
                    </div>
                </div>
                
                <p class="location-description">
                    Currently at: ${currentLocation ? currentLocation.name : 'Unknown Location'}
                </p>
                
                <div class="party-members">
                    <h3>Party Members (${partyMembers.length})</h3>
                    <ul style="list-style: none; padding: 0; margin: 8px 0;">
                        ${partyMembers.map(m => `
                            <li style="padding: 4px 0; color: #B8A88A;">
                                ${m.name} - HP: ${m.stats.hp}/${m.stats.maxHp}
                            </li>
                        `).join('')}
                    </ul>
                </div>
                
                <div class="location-actions">
                    ${currentLocation ? '<button class="btn-primary" id="btn-view-location">View Location</button>' : ''}
                    <button class="btn-secondary" id="btn-close-sidebar">Close</button>
                </div>
            </div>
        `;

        this.sidebar.classList.remove('hidden');

        document.getElementById('btn-view-location')?.addEventListener('click', () => {
            this.showLocationSidebar(currentLocation);
        });

        document.getElementById('btn-close-sidebar')?.addEventListener('click', () => {
            this.closeSidebar();
        });
    }

    closeSidebar() {
        if (this.sidebar) {
            this.sidebar.classList.add('hidden');
        }
        this.selectedLocation = null;
    }

    travelToLocation(location) {
        if (!this.worldManager.data) return;

        // Update party position and location
        this.worldManager.moveParty(location.id, { x: location.x, y: location.y });

        // Re-render to show updated party position
        this.render();
        this.closeSidebar();
    }

    enterLocation(location) {
        if (!location.linkedMapId) return;

        // Switch to battle map mode with the linked map
        // This will be handled by the main app
        document.dispatchEvent(new CustomEvent('enterLocation', {
            detail: {
                location,
                mapId: location.linkedMapId
            }
        }));
    }

    updatePartyOverlay() {
        let overlay = document.querySelector('.party-info-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'party-info-overlay';
            this.viewport?.appendChild(overlay);
        }

        if (!this.worldManager.data) return;

        const party = this.worldManager.data.party;
        const currentLocation = this.worldManager.getLocation(party.locationId);

        overlay.innerHTML = `
            <h3>⚔️ Party</h3>
            <div class="party-location">${currentLocation ? currentLocation.name : 'Unknown'}</div>
            <span class="party-state ${party.state || 'idle'}">${party.state || 'Idle'}</span>
        `;
    }

    // Center the view on the party
    centerOnParty() {
        if (!this.worldManager.data || !this.viewport) return;

        const party = this.worldManager.data.party;
        if (!party || !party.position) return;

        const rect = this.viewport.getBoundingClientRect();
        this.pan.x = rect.width / 2 - party.position.x * this.scale;
        this.pan.y = rect.height / 2 - party.position.y * this.scale;
        this.updateTransform();
    }

    // ============ DM Tools ============

    initDMTools() {
        const btnAdd = document.getElementById('btn-add-pin');
        const btnEdit = document.getElementById('btn-edit-pin');
        const btnDelete = document.getElementById('btn-delete-pin');

        btnAdd?.addEventListener('click', () => this.setDMTool('add'));
        btnEdit?.addEventListener('click', () => this.setDMTool('edit'));
        btnDelete?.addEventListener('click', () => this.setDMTool('delete'));

        // Viewport click for placing pins
        this.viewport.addEventListener('click', (e) => this.handleViewportClick(e));

        // Double-click for instant travel when party is selected
        this.viewport.addEventListener('dblclick', (e) => this.handleViewportDblClick(e));
    }

    setDMTool(tool) {
        // Toggle off if same tool
        if (this.activeTool === tool) {
            this.activeTool = null;
        } else {
            this.activeTool = tool;
        }

        // Deselect party when switching tools
        if (this.activeTool) {
            this.partySelected = false;
            this._updatePartyPinSelection();
        }

        // Update button states
        document.getElementById('btn-add-pin')?.classList.toggle('active', this.activeTool === 'add');
        document.getElementById('btn-edit-pin')?.classList.toggle('active', this.activeTool === 'edit');
        document.getElementById('btn-delete-pin')?.classList.toggle('active', this.activeTool === 'delete');

        // Update cursor
        this.viewport.classList.toggle('placement-mode', this.activeTool === 'add');

        // Close sidebar if switching tools
        if (this.activeTool && this.activeTool !== 'edit') {
            this.closeSidebar();
        }
    }

    handleViewportClick(e) {
        // Ignore if clicking on a pin
        if (e.target.closest('.world-pin')) return;

        // Handle party destination click
        if (this.partySelected && !this.activeTool) {
            this.handlePartyDestinationClick(e);
            return;
        }

        // Handle add pin mode
        if (this.activeTool === 'add') {
            const coords = this._screenToWorld(e.clientX, e.clientY);
            this.pendingPinCoords = coords;
            this.showPinEditForm(null);
        }
    }

    handleViewportDblClick(e) {
        // Ignore if clicking on a pin
        if (e.target.closest('.world-pin')) return;

        // Instant travel when party is selected
        if (this.partySelected) {
            const coords = this._screenToWorld(e.clientX, e.clientY);
            this._instantTravel(coords.x, coords.y, null);
        }
    }

    _screenToWorld(clientX, clientY) {
        const rect = this.viewport.getBoundingClientRect();
        const x = (clientX - rect.left - this.pan.x) / this.scale;
        const y = (clientY - rect.top - this.pan.y) / this.scale;
        return { x, y };
    }

    showPinEditForm(location) {
        if (!this.sidebar) return;

        const isNew = !location;
        const typeIcons = {
            town: '🏘️',
            city: '🏰',
            dungeon: '⚠️',
            point: '📍'
        };

        // Get available maps for linking
        const mapsOptions = this._mapLibrary?.map(m =>
            `<option value="${m.id}" ${location?.linkedMapId === m.id ? 'selected' : ''}>${m.name}</option>`
        ).join('') || '';

        this.sidebar.innerHTML = `
            <div class="world-sidebar-content">
                <div class="location-header">
                    <span class="location-icon">${isNew ? '📍' : typeIcons[location?.type] || '📍'}</span>
                    <div class="location-title">
                        <h2>${isNew ? 'New Location' : 'Edit Location'}</h2>
                    </div>
                </div>

                <form class="pin-edit-form" id="pin-edit-form">
                    <label>
                        Name
                        <input type="text" id="pin-name" value="${location?.name || ''}" required>
                    </label>

                    <label>
                        Type
                        <select id="pin-type">
                            <option value="point" ${location?.type === 'point' ? 'selected' : ''}>Point of Interest</option>
                            <option value="town" ${location?.type === 'town' ? 'selected' : ''}>Town</option>
                            <option value="city" ${location?.type === 'city' ? 'selected' : ''}>City</option>
                            <option value="dungeon" ${location?.type === 'dungeon' ? 'selected' : ''}>Dungeon</option>
                        </select>
                    </label>

                    <label>
                        Description
                        <textarea id="pin-description">${location?.description || ''}</textarea>
                    </label>

                    <label>
                        Linked Map
                        <select id="pin-linked-map">
                            <option value="">None</option>
                            ${mapsOptions}
                        </select>
                    </label>

                    <div class="form-actions">
                        <button type="submit" class="btn-primary">${isNew ? 'Create' : 'Save'}</button>
                        <button type="button" class="btn-secondary" id="btn-cancel-pin">Cancel</button>
                    </div>
                </form>
            </div>
        `;

        this.sidebar.classList.remove('hidden');

        // Bind form events
        document.getElementById('pin-edit-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this._savePinForm(location);
        });

        document.getElementById('btn-cancel-pin')?.addEventListener('click', () => {
            this.closeSidebar();
            this.setDMTool(null);
            this.pendingPinCoords = null;
        });
    }

    _savePinForm(existingLocation) {
        const name = document.getElementById('pin-name')?.value.trim();
        const type = document.getElementById('pin-type')?.value;
        const description = document.getElementById('pin-description')?.value.trim();
        const linkedMapId = document.getElementById('pin-linked-map')?.value || null;

        if (!name) return;

        if (existingLocation) {
            // Update existing
            this.worldManager.updateLocation(existingLocation.id, {
                name,
                type,
                description,
                linkedMapId
            });
        } else {
            // Create new
            const coords = this.pendingPinCoords || { x: 100, y: 100 };
            this.worldManager.addLocation({
                name,
                type,
                description,
                linkedMapId,
                x: coords.x,
                y: coords.y
            });
        }

        this.pendingPinCoords = null;
        this.setDMTool(null);
        this.closeSidebar();
        this.render();
    }

    // Override selectLocation to handle edit/delete tools
    selectLocation(location) {
        // Handle delete tool
        if (this.activeTool === 'delete') {
            if (confirm(`Delete "${location.name}"?`)) {
                this.worldManager.removeLocation(location.id);
                this.render();
            }
            return;
        }

        // Handle edit tool
        if (this.activeTool === 'edit') {
            this.showPinEditForm(location);
            return;
        }

        // Handle party travel
        if (this.partySelected) {
            this.startPartyTravel(location.x, location.y, location.id);
            return;
        }

        // Default: show location sidebar
        this.selectedLocation = location;
        document.dispatchEvent(new CustomEvent('locationSelected', { detail: location }));
        this.showLocationSidebar(location);
    }

    // Store map library for linking
    setMapLibrary(maps) {
        this._mapLibrary = maps;
    }

    // ============ Party Movement ============

    togglePartySelection() {
        // If a tool is active, show party info instead
        if (this.activeTool) {
            this.showPartyInfo();
            return;
        }

        this.partySelected = !this.partySelected;
        this._updatePartyPinSelection();

        if (this.partySelected) {
            this.closeSidebar();
        } else {
            this.showPartyInfo();
        }
    }

    _updatePartyPinSelection() {
        const partyPin = this.layer?.querySelector('.pin-party');
        if (partyPin) {
            partyPin.classList.toggle('selected', this.partySelected);
        }
    }

    handlePartyDestinationClick(e) {
        const coords = this._screenToWorld(e.clientX, e.clientY);

        // Check if clicking near a location
        const nearbyLoc = this._findLocationAtCoords(coords.x, coords.y);
        if (nearbyLoc) {
            this.startPartyTravel(nearbyLoc.x, nearbyLoc.y, nearbyLoc.id);
        } else {
            this.startPartyTravel(coords.x, coords.y, null);
        }
    }

    _findLocationAtCoords(x, y, threshold = 40) {
        if (!this.worldManager.data) return null;

        for (const loc of this.worldManager.data.locations) {
            const dx = loc.x - x;
            const dy = loc.y - y;
            if (Math.sqrt(dx * dx + dy * dy) < threshold) {
                return loc;
            }
        }
        return null;
    }

    startPartyTravel(destX, destY, locationId) {
        if (!this.worldManager.data) return;

        const party = this.worldManager.data.party;
        const startX = party.position.x;
        const startY = party.position.y;

        // Cancel any existing animation
        if (this.travelAnimation) {
            cancelAnimationFrame(this.travelAnimation.frameId);
        }

        // Set state to traveling
        this.worldManager.setPartyState('traveling');
        this.updatePartyOverlay();

        // Create trail SVG
        this._createTrailLine(startX, startY, destX, destY);

        // Start animation
        const duration = 1500; // ms
        const startTime = performance.now();

        this.travelAnimation = {
            startX,
            startY,
            destX,
            destY,
            locationId,
            duration,
            startTime,
            frameId: null
        };

        this._animateTravel();
    }

    _animateTravel() {
        if (!this.travelAnimation) return;

        const { startX, startY, destX, destY, locationId, duration, startTime } = this.travelAnimation;
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease-out interpolation
        const eased = 1 - Math.pow(1 - progress, 3);

        const currentX = startX + (destX - startX) * eased;
        const currentY = startY + (destY - startY) * eased;

        // Update party position visually
        const partyPin = this.layer?.querySelector('.pin-party');
        if (partyPin) {
            partyPin.style.left = `${currentX}px`;
            partyPin.style.top = `${currentY}px`;
        }

        // Update trail line
        this._updateTrailLine(startX, startY, currentX, currentY);

        if (progress < 1) {
            this.travelAnimation.frameId = requestAnimationFrame(() => this._animateTravel());
        } else {
            // Animation complete
            this._completeTravel(destX, destY, locationId);
        }
    }

    _completeTravel(x, y, locationId) {
        // Update world state
        this.worldManager.moveParty(locationId, { x, y });
        this.worldManager.setPartyState('idle');

        // Cleanup
        this._removeTrailLine();
        this.travelAnimation = null;
        this.partySelected = false;
        this._updatePartyPinSelection();

        // Re-render
        this.render();
    }

    _instantTravel(x, y, locationId) {
        // Find location at coords if not provided
        if (!locationId) {
            const loc = this._findLocationAtCoords(x, y);
            locationId = loc?.id || null;
        }

        this.worldManager.moveParty(locationId, { x, y });
        this.partySelected = false;
        this._updatePartyPinSelection();
        this.render();
    }

    _createTrailLine(startX, startY, endX, endY) {
        this._removeTrailLine();

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('party-trail');
        svg.setAttribute('viewBox', `0 0 ${this.container.scrollWidth} ${this.container.scrollHeight}`);
        svg.style.width = '100%';
        svg.style.height = '100%';

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', startX);
        line.setAttribute('y1', startY);
        line.setAttribute('x2', endX);
        line.setAttribute('y2', endY);

        svg.appendChild(line);
        this.container.appendChild(svg);
    }

    _updateTrailLine(startX, startY, currentX, currentY) {
        const line = this.container.querySelector('.party-trail line');
        if (line) {
            line.setAttribute('x2', currentX);
            line.setAttribute('y2', currentY);
        }
    }

    _removeTrailLine() {
        const trail = this.container.querySelector('.party-trail');
        if (trail) {
            trail.remove();
        }
    }
}

// Export
window.WorldMapRenderer = WorldMapRenderer;
