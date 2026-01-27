/**
 * Battlemap module
 * Handles map rendering, token management, and player view sync
 */

const Battlemap = {
    canvas: null,
    ctx: null,
    playerWindow: null,

    state: {
        background: null,
        backgroundImage: null,
        gridSize: 50,
        showGrid: true,
        tokens: [],
        selectedTokenId: null,
        // Zoom and pan
        zoom: 1,
        panX: 0,
        panY: 0,
        isPanning: false,
        lastPanX: 0,
        lastPanY: 0,
        // Map library
        currentMapId: null,
        autoSaveTimer: null,
        // AOE tools
        aoeShapes: [],
        activeAoeTool: null,
        aoePreview: null,
        // Fog of War
        fogEnabled: false,
        fogTool: null,
        fogBrushSize: 2,
        isDrawingFog: false,
        // Drag and drop
        dropPreview: null,
        // Ruler tool
        activeTool: 'select', // 'select' or 'ruler'
        measurement: null,    // { start: {x,y}, end: {x,y}, distance: 0 }
        // Active turn (for player view highlight)
        activeTurnTokenId: null,
        // Roll popups and glow
        rollPopups: [],   // { tokenId, text, type, timestamp, x, y }
        tokenGlows: {}    // { tokenId: { color, timestamp } }
    },

    fogCanvas: null,
    fogCtx: null,

    async init() {
        this.canvas = document.getElementById('battlemap-canvas');
        this.ctx = this.canvas.getContext('2d');

        this.setupEventListeners();
        this.setupAoeTools();
        this.setupRulerTool();
        this.initFog();
        this.setupFogTools();
        this.setupDragDrop();

        this.resizeCanvas();
        this.render();

        window.addEventListener('resize', () => {
            console.log('[window resize] Event fired!');
            this.resizeCanvas();
            this.render();
        });

        // Restore saved state on init
        await this.restoreState();
    },

    setupEventListeners() {
        // Background upload
        const uploadBtn = document.getElementById('btn-upload-bg');
        const uploadInput = document.getElementById('map-bg-upload');

        uploadBtn.addEventListener('click', () => uploadInput.click());
        uploadInput.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                this.loadBackground(e.target.files[0]);
            }
        });

        document.getElementById('btn-clear-bg').addEventListener('click', () => {
            this.state.background = null;
            this.state.backgroundImage = null;
            this.state.currentMapId = null;
            // Reset pan/zoom
            this.state.zoom = 1;
            this.state.panX = 0;
            this.state.panY = 0;
            this.resizeCanvas();
            this.render();
            this.syncPlayerView();
            this.scheduleAutoSave();
        });

        // Grid controls
        document.getElementById('grid-toggle').addEventListener('change', (e) => {
            this.state.showGrid = e.target.checked;
            this.render();
            this.syncPlayerView();
            this.scheduleAutoSave();
        });

        document.getElementById('grid-size').addEventListener('input', (e) => {
            this.state.gridSize = parseInt(e.target.value);
            document.getElementById('grid-size-display').textContent = this.state.gridSize;
            this.render();
            this.syncPlayerView();
            this.scheduleAutoSave();
        });

        // Token creation
        document.getElementById('btn-add-token').addEventListener('click', () => {
            const name = document.getElementById('token-name').value.trim();
            if (!name) return;

            const color = document.getElementById('token-color').value;
            const size = parseInt(document.getElementById('token-size').value);

            this.addToken(name, color, size);
            document.getElementById('token-name').value = '';
        });

        document.getElementById('btn-clear-tokens').addEventListener('click', () => {
            if (confirm('Remove all tokens from the map?')) {
                this.clearAllTokens();
            }
        });

        // Canvas interactions
        this.canvas.addEventListener('click', (e) => {
            if (!this.state.wasPanning) {
                this.handleCanvasClick(e);
            }
            this.state.wasPanning = false;
        });

        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.handleCanvasRightClick(e);
        });

        // Zoom with scroll wheel
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = 0.1;
            const delta = e.deltaY > 0 ? -zoomFactor : zoomFactor;
            const newZoom = Math.max(0.2, Math.min(5, this.state.zoom + delta));

            // Zoom toward mouse cursor
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Adjust pan so the point under the cursor stays fixed
            const panPixelX = this.state.panX * this.canvas.width;
            const panPixelY = this.state.panY * this.canvas.height;
            const worldX = (mouseX - panPixelX) / this.state.zoom;
            const worldY = (mouseY - panPixelY) / this.state.zoom;

            this.state.zoom = newZoom;

            const newPanPixelX = mouseX - worldX * newZoom;
            const newPanPixelY = mouseY - worldY * newZoom;
            this.state.panX = newPanPixelX / this.canvas.width;
            this.state.panY = newPanPixelY / this.canvas.height;

            this.render();
            this.syncPlayerView();
        }, { passive: false });

        // Pan/Interact
        this.canvas.addEventListener('mousedown', (e) => {
            // Pan with middle/ctrl
            if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
                e.preventDefault();
                this.state.isPanning = true;
                this.state.lastPanX = e.clientX;
                this.state.lastPanY = e.clientY;
                this.canvas.style.cursor = 'grabbing';
            }
            // Ruler measurement start
            else if (e.button === 0 && this.state.activeTool === 'ruler') {
                const coords = this.getGridCoords(e);
                this.state.measurement = {
                    start: { x: coords.x, y: coords.y },
                    end: { x: coords.x, y: coords.y },
                    distance: 0
                };
                this.render();
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (this.state.isPanning) {
                // ... pan logic ...
                const dx = e.clientX - this.state.lastPanX;
                const dy = e.clientY - this.state.lastPanY;
                this.state.panX += dx / this.canvas.width;
                this.state.panY += dy / this.canvas.height;
                this.state.lastPanX = e.clientX;
                this.state.lastPanY = e.clientY;
                this.state.wasPanning = true;
                this.render();
                this.syncPlayerView();
                return;
            }

            // Ruler measurement update
            if (this.state.measurement) {
                const coords = this.getGridCoords(e);
                this.state.measurement.end = { x: coords.x, y: coords.y };
                this.state.measurement.distance = this.calculateDistance(
                    this.state.measurement.start, this.state.measurement.end
                );
                this.render();
                this.syncPlayerView();
                return;
            }

            // AOE Preview
            if (this.state.aoePreview) {
                this.handleAoeRotation(e);
            }
        });

        this.canvas.addEventListener('mouseup', (e) => {
            if (this.state.isPanning) {
                this.state.isPanning = false;
                this.canvas.style.cursor = this.state.activeTool === 'ruler' ? 'crosshair' : 'default';
            }
            if (this.state.measurement) {
                this.state.measurement = null;
                this.render();
                this.syncPlayerView();
            }
        });

        this.canvas.addEventListener('mouseleave', () => {
            if (this.state.isPanning) {
                this.state.isPanning = false;
                this.canvas.style.cursor = 'default';
            }
        });

        // Player view
        document.getElementById('btn-open-player-view').addEventListener('click', () => {
            this.openPlayerView();
        });
    },



    setupAoeTools() {
        const tools = ['circle', 'cone', 'cube', 'line'];
        tools.forEach(tool => {
            document.getElementById(`aoe-${tool}`).addEventListener('click', () => {
                this.setAoeTool(tool);
            });
        });

        document.getElementById('aoe-clear-all').addEventListener('click', () => {
            this.state.aoeShapes = [];
            this.render();
            this.syncPlayerView();
            this.scheduleAutoSave();
        });

        // Handle rotation preview for cones/lines
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.state.aoePreview) {
                this.handleAoeRotation(e);
            }
        });
    },

    setAoeTool(tool) {
        // Toggle off if already selected
        this.state.activeAoeTool = this.state.activeAoeTool === tool ? null : tool;
        this.state.aoePreview = null;

        // Clear fog tool and ruler when selecting AOE tool
        if (this.state.activeAoeTool) {
            this.state.fogTool = null;
            this.state.activeTool = 'select';
            this.state.measurement = null;
            document.getElementById('fog-reveal').classList.remove('active');
            document.getElementById('fog-hide').classList.remove('active');
            document.getElementById('btn-tool-select').classList.add('active');
            document.getElementById('btn-tool-ruler').classList.remove('active');
        }

        // Update UI to show active tool
        ['circle', 'cone', 'cube', 'line'].forEach(t => {
            document.getElementById(`aoe-${t}`).classList.toggle('active', t === this.state.activeAoeTool);
        });

        this.canvas.style.cursor = this.state.activeAoeTool ? 'crosshair' : 'default';
    },

    handleAoePlacement(e) {
        if (!this.state.activeAoeTool) return false;

        // If we have a preview (second click for cone/line), finalize it
        if (this.state.aoePreview) {
            this.finalizeAoePlacement();
            return true;
        }

        const coords = this.getGridCoords(e);
        const size = parseInt(document.getElementById('aoe-size').value);
        const color = document.getElementById('aoe-color').value + '66'; // Add alpha

        const shape = {
            id: Date.now().toString(36),
            type: this.state.activeAoeTool,
            x: coords.x,
            y: coords.y,
            size,
            rotation: 0,
            color,
            label: ''
        };

        // For cones/lines, need second click for rotation
        if (['cone', 'line'].includes(shape.type)) {
            this.state.aoePreview = shape;
            this.render();
        } else {
            this.state.aoeShapes.push(shape);
            this.render();
            this.syncPlayerView();
            this.scheduleAutoSave();
        }

        return true; // Consumed the click
    },

    handleAoeRotation(e) {
        if (!this.state.aoePreview) return;

        const coords = this.getGridCoords(e);
        const dx = coords.x - this.state.aoePreview.x;
        const dy = coords.y - this.state.aoePreview.y;
        this.state.aoePreview.rotation = Math.atan2(dy, dx) * 180 / Math.PI;

        this.render();
    },

    finalizeAoePlacement() {
        if (!this.state.aoePreview) return;

        this.state.aoeShapes.push(this.state.aoePreview);
        this.state.aoePreview = null;
        this.render();
        this.syncPlayerView();
        this.scheduleAutoSave();
    },

    renderAoeShapes(ctx) {
        const scale = this.state.backgroundImage
            ? this.canvas.width / this.state.backgroundImage.width
            : 1;
        const gridSize = this.state.gridSize * scale;
        const ftToPixels = gridSize / 5; // 1 grid = 5ft

        // Render all persistent shapes
        const shapesToRender = [...this.state.aoeShapes];

        // Add preview if exists
        if (this.state.aoePreview) {
            shapesToRender.push(this.state.aoePreview);
        }

        shapesToRender.forEach(shape => {
            const centerX = (shape.x + 0.5) * gridSize;
            const centerY = (shape.y + 0.5) * gridSize;
            const sizePixels = shape.size * ftToPixels;

            ctx.fillStyle = shape.color;
            ctx.strokeStyle = shape.color.replace(/[\da-f]{2}\)$/i, 'ff)').replace(/,\s*[\d.]+\)$/, ', 1)');
            ctx.lineWidth = 2 / this.state.zoom;

            switch (shape.type) {
                case 'circle':
                    ctx.beginPath();
                    ctx.arc(centerX, centerY, sizePixels / 2, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                    break;

                case 'cube':
                    ctx.fillRect(
                        centerX - sizePixels / 2,
                        centerY - sizePixels / 2,
                        sizePixels,
                        sizePixels
                    );
                    ctx.strokeRect(
                        centerX - sizePixels / 2,
                        centerY - sizePixels / 2,
                        sizePixels,
                        sizePixels
                    );
                    break;

                case 'cone':
                    this.drawCone(ctx, centerX, centerY, sizePixels, shape.rotation);
                    break;

                case 'line':
                    this.drawLine(ctx, centerX, centerY, sizePixels, shape.rotation, gridSize);
                    break;
            }
        });
    },

    drawCone(ctx, x, y, length, rotation) {
        const angle = rotation * Math.PI / 180;
        const spread = Math.PI / 3; // 60 degree cone

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.arc(x, y, length, angle - spread / 2, angle + spread / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    },

    drawLine(ctx, x, y, length, rotation, gridSize) {
        const angle = rotation * Math.PI / 180;
        const width = gridSize; // 5ft wide (1 grid)

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillRect(0, -width / 2, length, width);
        ctx.strokeRect(0, -width / 2, length, width);
        ctx.restore();
    },

    // ============ Ruler / Measurement Tool ============

    setupRulerTool() {
        document.getElementById('btn-tool-select').addEventListener('click', () => {
            this.setActiveTool('select');
        });
        document.getElementById('btn-tool-ruler').addEventListener('click', () => {
            this.setActiveTool('ruler');
        });
    },

    setActiveTool(tool) {
        this.state.activeTool = tool;
        this.state.measurement = null;

        // Clear other tools when switching
        if (tool === 'ruler') {
            this.setAoeTool(null);
            this.state.fogTool = null;
            document.getElementById('fog-reveal').classList.remove('active');
            document.getElementById('fog-hide').classList.remove('active');
        }

        // Update button states
        const selectBtn = document.getElementById('btn-tool-select');
        const rulerBtn = document.getElementById('btn-tool-ruler');
        selectBtn.classList.toggle('active', tool === 'select');
        rulerBtn.classList.toggle('active', tool === 'ruler');

        this.canvas.style.cursor = tool === 'ruler' ? 'crosshair' : 'default';
        this.render();
    },

    calculateDistance(start, end) {
        const dx = Math.abs(end.x - start.x);
        const dy = Math.abs(end.y - start.y);
        const diagonalSteps = Math.min(dx, dy);
        const straightSteps = Math.max(dx, dy) - diagonalSteps;

        // 5e Variant: Diagonals alternate 5ft/10ft
        // Formula: diagonals * 5 + floor(diagonals / 2) * 5
        const diagonalDistance = (diagonalSteps * 5) + (Math.floor(diagonalSteps / 2) * 5);
        const straightDistance = straightSteps * 5;

        return diagonalDistance + straightDistance;
    },

    renderMeasurement(ctx, gridSize) {
        if (!this.state.measurement) return;

        const m = this.state.measurement;
        const startX = (m.start.x + 0.5) * gridSize;
        const startY = (m.start.y + 0.5) * gridSize;
        const endX = (m.end.x + 0.5) * gridSize;
        const endY = (m.end.y + 0.5) * gridSize;

        // Draw dashed line
        ctx.save();
        ctx.strokeStyle = '#9B2C2C';
        ctx.lineWidth = 3 / this.state.zoom;
        ctx.setLineDash([10 / this.state.zoom, 5 / this.state.zoom]);
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw distance label centered on line
        if (m.distance > 0) {
            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;
            const text = `${m.distance} ft.`;

            ctx.font = `bold ${16 / this.state.zoom}px system-ui`;
            const metrics = ctx.measureText(text);
            const padding = 6 / this.state.zoom;
            const pillW = metrics.width + padding * 2;
            const pillH = 22 / this.state.zoom;

            // Background pill
            ctx.fillStyle = 'rgba(0,0,0,0.8)';
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(midX - pillW / 2, midY - pillH / 2, pillW, pillH, 4 / this.state.zoom);
            } else {
                ctx.rect(midX - pillW / 2, midY - pillH / 2, pillW, pillH);
            }
            ctx.fill();

            // Border
            ctx.strokeStyle = '#9B2C2C';
            ctx.lineWidth = 2 / this.state.zoom;
            ctx.stroke();

            // Text
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, midX, midY);
        }

        // Draw start/end dots
        ctx.fillStyle = '#9B2C2C';
        ctx.beginPath();
        ctx.arc(startX, startY, 4 / this.state.zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(endX, endY, 4 / this.state.zoom, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    },

    // ============ Fog of War ============

    initFog() {
        this.fogCanvas = document.createElement('canvas');
        this.fogCtx = this.fogCanvas.getContext('2d');
    },

    resizeFogCanvas() {
        const oldWidth = this.fogCanvas.width;
        const oldHeight = this.fogCanvas.height;

        // Save current fog state if exists
        let oldFogData = null;
        if (oldWidth > 0 && oldHeight > 0) {
            oldFogData = this.fogCtx.getImageData(0, 0, oldWidth, oldHeight);
        }

        this.fogCanvas.width = this.canvas.width;
        this.fogCanvas.height = this.canvas.height;

        // If we had old fog data, scale it to the new size
        if (oldFogData && oldWidth > 0 && oldHeight > 0) {
            // Create temp canvas with old data
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = oldWidth;
            tempCanvas.height = oldHeight;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.putImageData(oldFogData, 0, 0);

            // Draw scaled to new fog canvas
            this.fogCtx.drawImage(tempCanvas, 0, 0, this.fogCanvas.width, this.fogCanvas.height);
        } else {
            // Initialize with full fog (black)
            this.fogCtx.fillStyle = '#000';
            this.fogCtx.fillRect(0, 0, this.fogCanvas.width, this.fogCanvas.height);
        }
    },

    setupFogTools() {
        const fogToggle = document.getElementById('fog-toggle');
        const fogTools = document.querySelector('.fog-tools');
        const fogActions = document.querySelector('.fog-actions');

        fogToggle.addEventListener('change', (e) => {
            this.state.fogEnabled = e.target.checked;
            fogTools.classList.toggle('enabled', this.state.fogEnabled);
            fogActions.classList.toggle('enabled', this.state.fogEnabled);

            if (this.state.fogEnabled && this.fogCanvas.width !== this.canvas.width) {
                this.resizeFogCanvas();
            }

            this.render();
            this.syncPlayerView();
            this.scheduleAutoSave();
        });

        document.getElementById('fog-reveal').addEventListener('click', () => {
            this.setFogTool('reveal');
        });

        document.getElementById('fog-hide').addEventListener('click', () => {
            this.setFogTool('hide');
        });

        document.getElementById('fog-brush').addEventListener('input', (e) => {
            this.state.fogBrushSize = parseInt(e.target.value);
            document.getElementById('fog-brush-display').textContent = this.state.fogBrushSize;
        });

        document.getElementById('fog-reveal-all').addEventListener('click', () => {
            this.fogCtx.clearRect(0, 0, this.fogCanvas.width, this.fogCanvas.height);
            this.render();
            this.syncPlayerView();
            this.scheduleAutoSave();
        });

        document.getElementById('fog-hide-all').addEventListener('click', () => {
            this.fogCtx.fillStyle = '#000';
            this.fogCtx.fillRect(0, 0, this.fogCanvas.width, this.fogCanvas.height);
            this.render();
            this.syncPlayerView();
            this.scheduleAutoSave();
        });

        // Fog drawing with mouse
        this.canvas.addEventListener('mousedown', (e) => {
            if (this.state.fogEnabled && this.state.fogTool && this.state.activeTool !== 'ruler' && e.button === 0 && !e.ctrlKey) {
                this.state.isDrawingFog = true;
                this.handleFogDraw(e);
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (this.state.isDrawingFog) {
                this.handleFogDraw(e);
            }
        });

        this.canvas.addEventListener('mouseup', () => {
            if (this.state.isDrawingFog) {
                this.state.isDrawingFog = false;
                this.syncPlayerView();
                this.scheduleAutoSave();
            }
        });

        this.canvas.addEventListener('mouseleave', () => {
            if (this.state.isDrawingFog) {
                this.state.isDrawingFog = false;
                this.syncPlayerView();
                this.scheduleAutoSave();
            }
        });
    },

    setFogTool(tool) {
        // Toggle off if already selected
        this.state.fogTool = this.state.fogTool === tool ? null : tool;

        // Clear AOE and ruler tools when selecting fog tool
        if (this.state.fogTool) {
            this.setAoeTool(null);
            this.state.activeTool = 'select';
            this.state.measurement = null;
            document.getElementById('btn-tool-select').classList.add('active');
            document.getElementById('btn-tool-ruler').classList.remove('active');
        }

        // Update UI
        document.getElementById('fog-reveal').classList.toggle('active', this.state.fogTool === 'reveal');
        document.getElementById('fog-hide').classList.toggle('active', this.state.fogTool === 'hide');

        this.canvas.style.cursor = this.state.fogTool ? 'crosshair' : 'default';
    },

    getCanvasCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
        const panPixelX = this.state.panX * this.canvas.width;
        const panPixelY = this.state.panY * this.canvas.height;
        const x = (e.clientX - rect.left - panPixelX) / this.state.zoom;
        const y = (e.clientY - rect.top - panPixelY) / this.state.zoom;
        return { x, y };
    },

    handleFogDraw(e) {
        if (!this.state.fogEnabled || !this.state.fogTool) return;

        const coords = this.getCanvasCoords(e);
        const scale = this.state.backgroundImage
            ? this.canvas.width / this.state.backgroundImage.width
            : 1;
        const gridSize = this.state.gridSize * scale;
        const brushRadius = this.state.fogBrushSize * gridSize / 2;

        this.fogCtx.globalCompositeOperation = this.state.fogTool === 'reveal'
            ? 'destination-out'  // Erase fog
            : 'source-over';     // Draw fog

        this.fogCtx.fillStyle = '#000';
        this.fogCtx.beginPath();
        this.fogCtx.arc(coords.x, coords.y, brushRadius, 0, Math.PI * 2);
        this.fogCtx.fill();

        this.fogCtx.globalCompositeOperation = 'source-over';
        this.render();
    },

    renderFog(forPlayer = false) {
        if (!this.state.fogEnabled) return;

        const ctx = this.ctx;

        if (forPlayer) {
            // Player view: fog is fully opaque
            ctx.drawImage(this.fogCanvas, 0, 0);
        } else {
            // DM view: fog is semi-transparent
            ctx.globalAlpha = 0.5;
            ctx.drawImage(this.fogCanvas, 0, 0);
            ctx.globalAlpha = 1.0;
        }
    },

    getFogDataUrl() {
        if (!this.state.fogEnabled) return null;
        return this.fogCanvas.toDataURL('image/png');
    },

    loadFogFromDataUrl(dataUrl) {
        if (!dataUrl) return;

        const img = new Image();
        img.onload = () => {
            this.fogCtx.clearRect(0, 0, this.fogCanvas.width, this.fogCanvas.height);
            this.fogCtx.drawImage(img, 0, 0, this.fogCanvas.width, this.fogCanvas.height);
            this.render();
        };
        img.src = dataUrl;
    },

    // ============ Drag and Drop ============

    setupDragDrop() {
        this.canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';

            // Show drop preview
            const coords = this.getGridCoords(e);
            this.state.dropPreview = coords;
            this.render();
        });

        this.canvas.addEventListener('dragleave', () => {
            this.state.dropPreview = null;
            this.render();
        });

        this.canvas.addEventListener('drop', async (e) => {
            e.preventDefault();
            this.state.dropPreview = null;

            try {
                const data = JSON.parse(e.dataTransfer.getData('application/json'));
                const coords = this.getGridCoords(e);
                await this.spawnTokenFromDrop(data, coords);
            } catch (err) {
                console.error('Drop failed:', err);
            }
        });
    },

    async spawnTokenFromDrop(data, coords) {
        let monster = null;

        // Fetch monster stats if we have a slug
        if (data.slug) {
            try {
                monster = await API.getMonster(data.slug);
            } catch (err) {
                console.error('Failed to fetch monster:', err);
            }
        }

        // Determine token size from monster
        const sizeMap = { Tiny: 0.5, Small: 1, Medium: 1, Large: 2, Huge: 3, Gargantuan: 4 };
        const size = monster ? (sizeMap[monster.size] || 1) : 1;

        // Generate color based on name hash
        const color = this.getTokenColor(data.name);

        const instanceId = data.instanceId || State.generateId();
        const token = {
            id: instanceId,
            instanceId,
            name: data.name,
            color,
            size,
            x: coords.x,
            y: coords.y,
            slug: data.slug || null,
            hp: monster?.hit_points || null,
            maxHp: monster?.hit_points || null
        };

        this.state.tokens.push(token);
        this.render();
        this.renderTokenList();
        this.syncPlayerView();
        this.scheduleAutoSave();

    },

    getTokenColor(name) {
        // Generate consistent color from name
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash % 360);
        return `hsl(${hue}, 70%, 45%)`;
    },

    renderDropPreview(ctx, gridSize) {
        if (!this.state.dropPreview) return;

        const x = this.state.dropPreview.x * gridSize + gridSize / 2;
        const y = this.state.dropPreview.y * gridSize + gridSize / 2;

        ctx.fillStyle = 'rgba(0, 200, 100, 0.3)';
        ctx.strokeStyle = 'rgba(0, 200, 100, 0.8)';
        ctx.lineWidth = 2 / this.state.zoom;

        ctx.beginPath();
        ctx.arc(x, y, gridSize / 2 - 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    },

    renderTokenHp(ctx, token, x, y, radius) {
        if (token.hp === null || token.maxHp === null) return;

        const barWidth = radius * 2;
        const barHeight = 6 / this.state.zoom;
        const barY = y + radius + 4 / this.state.zoom;

        // Background
        ctx.fillStyle = '#333';
        ctx.fillRect(x - radius, barY, barWidth, barHeight);

        // HP fill
        const hpPercent = Math.max(0, token.hp / token.maxHp);
        const hpColor = hpPercent > 0.5 ? '#4a4' : hpPercent > 0.25 ? '#aa4' : '#a44';
        ctx.fillStyle = hpColor;
        ctx.fillRect(x - radius, barY, barWidth * hpPercent, barHeight);

        // Border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1 / this.state.zoom;
        ctx.strokeRect(x - radius, barY, barWidth, barHeight);
    },



    loadBackground(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            this.state.background = e.target.result;
            this.state.currentMapId = null; // Clear library reference when uploading directly
            const img = new Image();
            img.onload = () => {
                console.log('[loadBackground] Image loaded:', img.width, 'x', img.height);
                this.state.backgroundImage = img;
                // Reset pan/zoom to prevent corrupt state from old canvas dimensions
                this.state.zoom = 1;
                this.state.panX = 0;
                this.state.panY = 0;
                console.log('[loadBackground] Reset pan/zoom, calling resizeCanvas...');
                this.resizeCanvas();
                this.render();
                this.syncPlayerView();
                this.scheduleAutoSave();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    resizeCanvas() {
        const container = this.canvas.parentElement;
        const maxW = container.clientWidth - 20;
        const maxH = container.clientHeight - 40;

        const oldWidth = this.canvas.width;
        const oldHeight = this.canvas.height;

        console.log('[resizeCanvas] Called. Old:', oldWidth, 'x', oldHeight, 'Container max:', maxW, 'x', maxH);

        if (this.state.backgroundImage) {
            const imgW = this.state.backgroundImage.width;
            const imgH = this.state.backgroundImage.height;
            const scale = Math.min(maxW / imgW, maxH / imgH, 1);
            this.canvas.width = imgW * scale;
            this.canvas.height = imgH * scale;
            console.log('[resizeCanvas] Has image. Image:', imgW, 'x', imgH, 'Scale:', scale);
        } else {
            this.canvas.width = maxW;
            this.canvas.height = maxH;
            console.log('[resizeCanvas] No image, using container size');
        }

        console.log('[resizeCanvas] New:', this.canvas.width, 'x', this.canvas.height);

        // If dimensions changed significantly, reset pan/zoom to prevent corrupt state
        if (Math.abs(oldWidth - this.canvas.width) > 1 ||
            Math.abs(oldHeight - this.canvas.height) > 1) {
            console.log('[resizeCanvas] Dimensions changed! Resetting pan/zoom');
            this.state.zoom = 1;
            this.state.panX = 0;
            this.state.panY = 0;
        }

        // Resize fog canvas to match
        if (this.fogCanvas) {
            this.resizeFogCanvas();
        }
    },

    render() {
        const ctx = this.ctx;
        console.log('[render] Canvas:', this.canvas.width, 'x', this.canvas.height,
            'Pan:', this.state.panX.toFixed(3), this.state.panY.toFixed(3),
            'Zoom:', this.state.zoom.toFixed(3),
            'Tokens:', this.state.tokens.length);
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Apply zoom and pan transforms (convert normalized pan to pixels)
        ctx.save();
        ctx.translate(this.state.panX * this.canvas.width, this.state.panY * this.canvas.height);
        ctx.scale(this.state.zoom, this.state.zoom);

        // Draw background
        if (this.state.backgroundImage) {
            ctx.drawImage(this.state.backgroundImage, 0, 0, this.canvas.width, this.canvas.height);
        } else {
            ctx.fillStyle = '#3a3a3a';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // Calculate grid scale
        const scale = this.state.backgroundImage
            ? this.canvas.width / this.state.backgroundImage.width
            : 1;
        const gridSize = this.state.gridSize * scale;

        // Draw grid
        if (this.state.showGrid) {
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 1 / this.state.zoom; // Keep grid lines consistent

            for (let x = 0; x <= this.canvas.width; x += gridSize) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, this.canvas.height);
                ctx.stroke();
            }
            for (let y = 0; y <= this.canvas.height; y += gridSize) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(this.canvas.width, y);
                ctx.stroke();
            }
        }

        // Draw AOE shapes (before tokens so they appear underneath)
        this.renderAoeShapes(ctx);

        // Draw drop preview
        this.renderDropPreview(ctx, gridSize);

        // Draw tokens
        this.state.tokens.forEach(token => {
            // For size 2+ tokens (Large/Huge), center on the corner to occupy 4 squares
            // For size 1 tokens (Medium), center on the grid square
            const offset = token.size === 1 ? gridSize / 2 : gridSize;
            const x = token.x * gridSize + offset;
            const y = token.y * gridSize + offset;
            const radius = Math.max(8, (gridSize * token.size) / 2 - 4);

            // Token glow effect
            const glow = this.state.tokenGlows[token.id];
            if (glow) {
                const age = Date.now() - glow.timestamp;
                const progress = age / 500;
                if (progress < 1) {
                    const glowRadius = radius + (20 / this.state.zoom) * (1 - progress);
                    const glowAlpha = 0.6 * (1 - progress);
                    ctx.save();
                    ctx.globalAlpha = glowAlpha;
                    ctx.fillStyle = glow.color;
                    ctx.beginPath();
                    ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
            }

            // Selection ring
            if (token.id === this.state.selectedTokenId) {
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 3 / this.state.zoom;
                ctx.beginPath();
                ctx.arc(x, y, radius + Math.max(4, radius * 0.3), 0, Math.PI * 2);
                ctx.stroke();
            }

            // Token circle
            ctx.fillStyle = token.color;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();

            // Token border
            ctx.strokeStyle = 'rgba(255,255,255,0.8)';
            ctx.lineWidth = 2 / this.state.zoom;
            ctx.stroke();

            // Token name
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${Math.max(8, radius * 0.8)}px system-ui`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(token.name.substring(0, 3).toUpperCase(), x, y);

            // HP bar (if token has HP)
            this.renderTokenHp(ctx, token, x, y, radius);
        });

        // Draw roll popups above tokens
        this.renderRollPopups(ctx, gridSize);

        // Draw ruler measurement
        this.renderMeasurement(ctx, gridSize);

        // Draw fog of war (DM sees semi-transparent)
        this.renderFog(false);

        ctx.restore();
    },

    getGridCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
        // Convert screen coords to canvas coords, accounting for zoom/pan (with normalized pan)
        const panPixelX = this.state.panX * this.canvas.width;
        const panPixelY = this.state.panY * this.canvas.height;
        const canvasX = (e.clientX - rect.left - panPixelX) / this.state.zoom;
        const canvasY = (e.clientY - rect.top - panPixelY) / this.state.zoom;

        const scale = this.state.backgroundImage
            ? this.canvas.width / this.state.backgroundImage.width
            : 1;
        const gridSize = this.state.gridSize * scale;

        return {
            x: Math.floor(canvasX / gridSize),
            y: Math.floor(canvasY / gridSize)
        };
    },

    handleCanvasClick(e) {
        // Skip if ruler or fog tool is active
        if (this.state.activeTool === 'ruler' || this.state.fogTool) {
            return;
        }

        // Handle AOE placement first
        if (this.handleAoePlacement(e)) {
            return;
        }

        const coords = this.getGridCoords(e);

        // Check if clicking on a token
        const clickedToken = this.getTokenAt(coords.x, coords.y);
        let tokenMoved = false;

        if (this.state.selectedTokenId) {
            // Move selected token to clicked location
            if (!clickedToken || clickedToken.id === this.state.selectedTokenId) {
                const token = this.state.tokens.find(t => t.id === this.state.selectedTokenId);
                if (token) {
                    token.x = coords.x;
                    token.y = coords.y;
                    tokenMoved = true;
                }
                this.state.selectedTokenId = null;
            } else {
                // Select the new token instead
                this.state.selectedTokenId = clickedToken.id;
            }
        } else if (clickedToken) {
            // Select this token
            this.state.selectedTokenId = clickedToken.id;
        }

        // Notify external listeners of token selection
        if (clickedToken && !tokenMoved && this.onTokenSelect) {
            this.onTokenSelect(clickedToken.combatantId || clickedToken.id);
        }

        this.render();
        this.syncPlayerView();
        this.renderTokenList();
        if (tokenMoved) this.scheduleAutoSave();
    },

    handleCanvasRightClick(e) {
        const coords = this.getGridCoords(e);

        // Check for AOE shape at click location
        const aoeShape = this.getAoeShapeAt(coords.x, coords.y);
        if (aoeShape) {
            this.state.aoeShapes = this.state.aoeShapes.filter(s => s.id !== aoeShape.id);
            this.render();
            this.syncPlayerView();
            this.scheduleAutoSave();
            return;
        }

        // Check for token
        const token = this.getTokenAt(coords.x, coords.y);
        if (token) {
            this.removeToken(token.id);
        }
    },

    getAoeShapeAt(gridX, gridY) {
        const scale = this.state.backgroundImage
            ? this.canvas.width / this.state.backgroundImage.width
            : 1;
        const gridSize = this.state.gridSize * scale;
        const ftToGrids = 1 / 5; // 5ft per grid

        return this.state.aoeShapes.find(shape => {
            const sizeGrids = shape.size * ftToGrids;
            const centerX = shape.x + 0.5;
            const centerY = shape.y + 0.5;
            const dx = gridX + 0.5 - centerX;
            const dy = gridY + 0.5 - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Simple hit test based on shape type
            if (shape.type === 'circle') {
                return dist <= sizeGrids / 2;
            } else if (shape.type === 'cube') {
                return Math.abs(dx) <= sizeGrids / 2 && Math.abs(dy) <= sizeGrids / 2;
            } else {
                // For cones/lines, use a generous hit area around origin
                return dist <= sizeGrids / 2;
            }
        });
    },

    getTokenAt(gridX, gridY) {
        return this.state.tokens.find(t => {
            // Account for token size
            const minX = t.x;
            const maxX = t.x + t.size - 1;
            const minY = t.y;
            const maxY = t.y + t.size - 1;
            return gridX >= minX && gridX <= maxX && gridY >= minY && gridY <= maxY;
        });
    },

    addToken(name, color, size, slug = null, relatedId = null) {
        console.log('[addToken] Adding token:', name, 'Current state - Pan:', this.state.panX, this.state.panY, 'Zoom:', this.state.zoom);
        const instanceId = relatedId || State.generateId();
        const token = {
            id: instanceId,
            instanceId,
            name,
            color,
            size,
            x: 0,
            y: 0,
            slug,
            combatantId: relatedId
        };

        // Find empty spot
        let placed = false;
        for (let y = 0; y < 20 && !placed; y++) {
            for (let x = 0; x < 20 && !placed; x++) {
                if (!this.getTokenAt(x, y)) {
                    token.x = x;
                    token.y = y;
                    placed = true;
                }
            }
        }

        // If map is full, just place at 0,0
        if (!placed) {
            console.warn('[addToken] Map likely full, placing at 0,0');
        }

        console.log('[addToken] Token placed at grid:', token.x, token.y);
        this.state.tokens.push(token);
        console.log('[addToken] Calling render...');
        this.render();
        console.log('[addToken] Calling syncPlayerView...');
        this.syncPlayerView();
        console.log('[addToken] Calling renderTokenList...');
        this.renderTokenList();
        this.scheduleAutoSave();
        console.log('[addToken] Done. Final state - Pan:', this.state.panX, this.state.panY, 'Zoom:', this.state.zoom);
    },

    removeToken(id) {
        this.state.tokens = this.state.tokens.filter(t => t.id !== id);
        if (this.state.selectedTokenId === id) {
            this.state.selectedTokenId = null;
        }
        this.render();
        this.syncPlayerView();
        this.renderTokenList();
        this.scheduleAutoSave();
        this.updateSpawnCounts();
    },

    clearAllTokens() {
        this.state.tokens = [];
        this.state.selectedTokenId = null;
        this.render();
        this.syncPlayerView();
        this.renderTokenList();
        this.scheduleAutoSave();
        this.updateSpawnCounts();
    },

    renderTokenList() {
        console.log('[renderTokenList] Updating sidebar DOM...');
        const list = document.getElementById('token-list');
        list.innerHTML = this.state.tokens.map(t => `
            <li class="token-item ${t.id === this.state.selectedTokenId ? 'selected' : ''}" data-id="${t.id}">
                <span class="token-color" style="background:${t.color}"></span>
                <span class="token-name">${t.name}</span>
                <button class="remove-btn" onclick="Battlemap.removeToken('${t.id}')">&times;</button>
            </li>
        `).join('');
        console.log('[renderTokenList] Done');
    },

    openPlayerView() {
        if (this.playerWindow && !this.playerWindow.closed) {
            this.playerWindow.focus();
        } else {
            this.playerWindow = window.open('/battlemap.html', 'PlayerView',
                'width=1280,height=720,menubar=no,toolbar=no');
        }

        // Send initial state after window loads
        setTimeout(() => this.syncPlayerView(), 500);
    },

    syncPlayerView() {
        if (this.playerWindow && !this.playerWindow.closed) {
            this.playerWindow.postMessage({
                type: 'BATTLEMAP_SYNC',
                state: {
                    background: this.state.background,
                    gridSize: this.state.gridSize,
                    showGrid: this.state.showGrid,
                    tokens: this.state.tokens,
                    zoom: this.state.zoom,
                    panX: this.state.panX,
                    panY: this.state.panY,
                    aoeShapes: this.state.aoeShapes,
                    fogEnabled: this.state.fogEnabled,
                    fogData: this.getFogDataUrl(),
                    measurement: this.state.measurement,
                    activeTurnTokenId: this.state.activeTurnTokenId
                }
            }, '*');
        }
    },

    // ============ Map Library & State Persistence ============

    async restoreState() {
        const saved = await API.loadBattlemapState();
        if (!saved) return;

        // Restore map from library if referenced
        if (saved.mapId) {
            try {
                await this.loadFromLibrary(saved.mapId);
            } catch (error) {
                console.error('Failed to restore map from library:', error);
            }
        }

        // Restore other state
        this.state.gridSize = saved.gridSize ?? 50;
        this.state.showGrid = saved.showGrid ?? true;
        this.state.tokens = saved.tokens || [];
        this.state.zoom = saved.zoom ?? 1;
        this.state.panX = saved.panX ?? 0;
        this.state.panY = saved.panY ?? 0;
        this.state.aoeShapes = saved.aoeShapes || [];
        this.state.fogEnabled = saved.fogEnabled ?? false;

        // Update UI controls
        document.getElementById('grid-size').value = this.state.gridSize;
        document.getElementById('grid-size-display').textContent = this.state.gridSize;
        document.getElementById('grid-toggle').checked = this.state.showGrid;
        document.getElementById('fog-toggle').checked = this.state.fogEnabled;

        // Update fog UI state
        const fogTools = document.querySelector('.fog-tools');
        const fogActions = document.querySelector('.fog-actions');
        fogTools.classList.toggle('enabled', this.state.fogEnabled);
        fogActions.classList.toggle('enabled', this.state.fogEnabled);

        // Restore fog data after canvas is ready
        if (saved.fogData) {
            this.loadFogFromDataUrl(saved.fogData);
        }

        this.render();
        this.renderTokenList();
    },

    async loadFromLibrary(mapId) {
        const url = API.getMapImageUrl(mapId);
        const img = new Image();

        return new Promise((resolve, reject) => {
            img.onload = () => {
                this.state.currentMapId = mapId;
                this.state.backgroundImage = img;

                // Convert to Base64 for player view compatibility
                // Player view runs in separate window and can't access relative URLs
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                this.state.background = canvas.toDataURL('image/webp', 0.85);

                this.state.zoom = 1;
                this.state.panX = 0;
                this.state.panY = 0;

                this.resizeCanvas();
                this.render();
                this.syncPlayerView();
                this.scheduleAutoSave();

                // Update lastUsed on server
                API.updateMap(mapId, { lastUsed: new Date().toISOString() });

                resolve();
            };
            img.onerror = reject;
            img.src = url;
        });
    },

    scheduleAutoSave() {
        // Debounce auto-save to avoid excessive writes
        if (this.state.autoSaveTimer) {
            clearTimeout(this.state.autoSaveTimer);
        }

        this.state.autoSaveTimer = setTimeout(() => {
            this.saveState();
        }, 2000); // Save 2 seconds after last change
    },

    async saveState() {
        await API.saveBattlemapState({
            mapId: this.state.currentMapId,
            gridSize: this.state.gridSize,
            showGrid: this.state.showGrid,
            tokens: this.state.tokens,
            zoom: this.state.zoom,
            panX: this.state.panX,
            panY: this.state.panY,
            aoeShapes: this.state.aoeShapes,
            fogEnabled: this.state.fogEnabled,
            fogData: this.getFogDataUrl()
        });
    },

    /**
     * Save current battlemap scene to a specific encounter
     * @param {string} encounterId - ID of encounter to save scene to
     * @returns {boolean} Success status
     */
    saveCurrentSceneToEncounter(encounterId) {
        const sceneData = {
            mapId: this.state.currentMapId,
            gridSize: this.state.gridSize,
            showGrid: this.state.showGrid,
            tokens: [...this.state.tokens],
            zoom: this.state.zoom,
            panX: this.state.panX,
            panY: this.state.panY,
            aoeShapes: [...this.state.aoeShapes],
            fogEnabled: this.state.fogEnabled,
            fogData: this.getFogDataUrl()
        };

        return State.saveEncounterScene(encounterId, sceneData);
    },

    /**
     * Load a saved scene from an encounter
     * @param {string} encounterId - ID of encounter to load scene from
     * @returns {Promise<boolean>} True if scene was loaded, false if no scene saved
     */
    async loadEncounterScene(encounterId) {
        const scene = State.getEncounterScene(encounterId);
        if (!scene) return false;

        // Load map from library if referenced
        if (scene.mapId) {
            try {
                await this.loadFromLibrary(scene.mapId);
            } catch (error) {
                console.error('Failed to load map from library:', error);
                return false;
            }
        } else {
            // Clear current map if no mapId
            this.state.background = null;
            this.state.backgroundImage = null;
            this.state.currentMapId = null;
        }

        // Restore scene state
        this.state.gridSize = scene.gridSize ?? 50;
        this.state.showGrid = scene.showGrid ?? true;
        this.state.tokens = scene.tokens ? [...scene.tokens] : [];
        this.state.zoom = scene.zoom ?? 1;
        this.state.panX = scene.panX ?? 0;
        this.state.panY = scene.panY ?? 0;
        this.state.aoeShapes = scene.aoeShapes ? [...scene.aoeShapes] : [];
        this.state.fogEnabled = scene.fogEnabled ?? false;

        // Update UI controls
        document.getElementById('grid-size').value = this.state.gridSize;
        document.getElementById('grid-size-display').textContent = this.state.gridSize;
        document.getElementById('grid-toggle').checked = this.state.showGrid;
        document.getElementById('fog-toggle').checked = this.state.fogEnabled;

        // Update fog UI state
        const fogTools = document.querySelector('.fog-tools');
        const fogActions = document.querySelector('.fog-actions');
        if (fogTools) fogTools.classList.toggle('enabled', this.state.fogEnabled);
        if (fogActions) fogActions.classList.toggle('enabled', this.state.fogEnabled);

        // Restore fog data
        if (scene.fogData) {
            this.loadFogFromDataUrl(scene.fogData);
        }

        this.resizeCanvas();
        this.render();
        this.renderTokenList();
        this.syncPlayerView();

        return true;
    },

    async populateFromEncounter(skipConfirm = false) {
        const encounter = State.getCurrentEncounter();
        if (!encounter) {
            alert('Please select an encounter first.');
            return;
        }

        const party = State.getParty();
        if (!skipConfirm) {
            const confirmMsg = `This will add tokens for all monsters in "${encounter.name}" and ${party.length} party members. Continue?`;
            if (!confirm(confirmMsg)) return;
        }

        // Add Party Members
        const partyColor = '#3B5998'; // Blue
        party.forEach(p => {
            this.addToken(p.name, partyColor, 1, null, p.id);
        });

        // Map Open5e sizes to grid sizes
        const sizeMap = {
            'Tiny': 1,
            'Small': 1,
            'Medium': 1,
            'Large': 2,
            'Huge': 3,
            'Gargantuan': 4
        };

        for (const m of encounter.monsters) {
            try {
                // Try to get monster details for the size
                const details = await API.getMonster(m.slug);
                const size = details ? (sizeMap[details.size] || 1) : 1;
                const color = '#C84B31'; // Default red for monsters

                for (let i = 0; i < m.qty; i++) {
                    const name = m.qty > 1 ? `${m.name} ${i + 1}` : m.name;
                    const instanceId = State.generateId();
                    this.addToken(name, color, size, m.slug, instanceId);
                }
            } catch (error) {
                console.error(`Failed to create tokens for ${m.name}:`, error);
                // Fallback to size 1 if lookup fails
                for (let i = 0; i < m.qty; i++) {
                    const name = m.qty > 1 ? `${m.name} ${i + 1}` : m.name;
                    const instanceId = State.generateId();
                    this.addToken(name, '#C84B31', 1, m.slug, instanceId);
                }
            }
        }

        this.render();
        this.renderTokenList();
        this.syncPlayerView();
        this.updateSpawnCounts();
    },

    updateSpawnCounts() {
        // No-op — placeholder for future encounter panel spawn count display
    },

    renderEncounterPanel() {
        // No-op — placeholder for future encounter panel UI
    },

    // ============ Combat Integration API ============

    /**
     * Callback invoked when a token is clicked on the canvas.
     * Set by external code (e.g., App) to sync initiative selection.
     * @type {Function|null}
     */
    onTokenSelect: null,

    /**
     * Build combatant data from tokens that have a slug (linked to monster statblock).
     * Returns an array of objects suitable for building combatants in startEncounter.
     * @returns {Array<{instanceId: string, slug: string, name: string}>}
     */
    getDataForCombat() {
        return this.state.tokens
            .filter(t => t.slug)
            .map(t => ({
                instanceId: t.instanceId,
                slug: t.slug,
                name: t.name
            }));
    },

    /**
     * Visually select a token by instanceId (highlight ring on canvas).
     * @param {string|null} instanceId - The instanceId of the token to select, or null to deselect.
     */
    selectToken(instanceId) {
        if (!instanceId) {
            this.state.selectedTokenId = null;
        } else {
            const token = this.state.tokens.find(t => t.instanceId === instanceId);
            this.state.selectedTokenId = token ? token.id : null;
        }
        this.render();
        this.renderTokenList();
    },

    /**
     * Pan the map to center on a token identified by instanceId.
     * @param {string} instanceId - The instanceId of the token to pan to.
     */
    panToToken(instanceId) {
        const token = this.state.tokens.find(t => t.instanceId === instanceId);
        if (!token) return;

        const scale = this.state.backgroundImage
            ? this.canvas.width / this.state.backgroundImage.width
            : 1;
        const gridSize = this.state.gridSize * scale;

        // Calculate token center in canvas coordinates
        const offset = token.size === 1 ? gridSize / 2 : gridSize;
        const tokenX = token.x * gridSize + offset;
        const tokenY = token.y * gridSize + offset;

        // Set pan so token is centered on screen
        // panX/panY are normalized: the pixel offset is panX * canvasWidth
        // We want: panX * canvasWidth + zoom * tokenX = canvasWidth / 2
        // => panX = (canvasWidth/2 - zoom * tokenX) / canvasWidth
        this.state.panX = (this.canvas.width / 2 - this.state.zoom * tokenX) / this.canvas.width;
        this.state.panY = (this.canvas.height / 2 - this.state.zoom * tokenY) / this.canvas.height;

        this.render();
        this.syncPlayerView();
    },

    // ============ Roll Popups & Token Glow ============

    showRollPopup(tokenId, text, type = 'damage') {
        const token = this.state.tokens.find(t => t.id === tokenId);
        if (!token) return;

        this.state.rollPopups.push({
            tokenId,
            text,
            type,
            timestamp: Date.now(),
            x: token.x,
            y: token.y
        });

        this.render();

        // Remove after animation
        setTimeout(() => {
            this.state.rollPopups = this.state.rollPopups.filter(
                p => Date.now() - p.timestamp < 2000
            );
            this.render();
        }, 2000);
    },

    renderRollPopups(ctx, gridSize) {
        const now = Date.now();

        this.state.rollPopups.forEach(popup => {
            const age = now - popup.timestamp;
            const progress = age / 2000; // 0 to 1 over 2 seconds

            if (progress >= 1) return;

            // Fade out and float up
            const alpha = 1 - progress;
            const yOffset = -30 - (progress * 40); // Float upward

            const x = (popup.x + 0.5) * gridSize;
            const y = (popup.y + 0.5) * gridSize + yOffset;

            // Color based on type
            const colors = {
                attack: '#4a9eff',
                damage: '#ff4a4a',
                save: '#9b59b6',
                heal: '#2ecc71',
                default: '#f1c40f'
            };
            const color = colors[popup.type] || colors.default;

            ctx.save();
            ctx.globalAlpha = alpha;

            // Background pill
            ctx.font = `bold ${18 / this.state.zoom}px system-ui`;
            const metrics = ctx.measureText(popup.text);
            const padding = 8 / this.state.zoom;
            const width = metrics.width + padding * 2;
            const height = 24 / this.state.zoom;

            ctx.fillStyle = 'rgba(0,0,0,0.8)';
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(x - width / 2, y - height / 2, width, height, 4 / this.state.zoom);
            } else {
                ctx.rect(x - width / 2, y - height / 2, width, height);
            }
            ctx.fill();

            // Border
            ctx.strokeStyle = color;
            ctx.lineWidth = 2 / this.state.zoom;
            ctx.stroke();

            // Text
            ctx.fillStyle = color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(popup.text, x, y);

            ctx.restore();
        });
    },

    glowToken(tokenId, color = '#f1c40f') {
        this.state.tokenGlows[tokenId] = {
            color,
            timestamp: Date.now()
        };
        this.render();

        setTimeout(() => {
            delete this.state.tokenGlows[tokenId];
            this.render();
        }, 500);
    }
};
