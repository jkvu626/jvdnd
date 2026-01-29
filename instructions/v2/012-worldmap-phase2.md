# Phase 2: World Tab Implementation

## Overview
This phase involves creating the UI "Shell" for the World Map. We will add a new tab to the interface, render the static world map image, and implement the "pins" that represent the Party and Points of Interest (POIs).

## 1. UI Structure (`index.html`)

Add the "World" tab to the main navigation and a container for the map content.

```html
<!-- Navigation -->
<nav id="main-nav">
  <button data-tab="world" class="nav-btn active">World</button>
  <button data-tab="map" class="nav-btn">Battle Map</button>
  <button data-tab="encounters" class="nav-btn">Encounters</button>
</nav>

<!-- World Tab Container -->
<div id="tab-world" class="tab-content active">
  <div id="world-map-viewport">
    <div id="world-map-container">
      <img id="world-map-image" src="assets/world_map_sword_coast.jpg" alt="World Map">
      <!-- Pins will be injected here -->
      <div id="world-pins-layer"></div>
    </div>
  </div>
  
  <!-- Sidebar for Location Details -->
  <div id="world-sidebar" class="sidebar hidden">
    <!-- Populated dynamically -->
  </div>
</div>
```

## 2. CSS Styling (`css/world.css`)

```css
#world-map-viewport {
  width: 100%;
  height: calc(100vh - 50px); /* Adjust for nav height */
  overflow: hidden;
  position: relative;
  background: #1a1a1a;
  cursor: grab;
}

#world-map-viewport:active {
  cursor: grabbing;
}

#world-map-container {
  position: absolute;
  transform-origin: 0 0;
  /* Transform for pan/zoom will be applied here via JS */
}

/* Pins */
.world-pin {
  position: absolute;
  width: 32px;
  height: 32px;
  transform: translate(-50%, -100%); /* Anchor bottom-center */
  cursor: pointer;
  transition: transform 0.2s;
}

.world-pin:hover {
  transform: translate(-50%, -100%) scale(1.2);
  z-index: 100;
}

.pin-party {
  background-image: url('../assets/icons/party_token.png');
  background-size: cover;
  width: 48px;
  height: 48px;
}

.pin-town {
  background-image: url('../assets/icons/town_icon.png');
  background-size: cover;
}
```

## 3. WorldMapRenderer Class (`js/worldMap.js`)

Handles the rendering and interaction of the world map.

```javascript
class WorldMapRenderer {
    constructor(containerId, worldManager) {
        this.container = document.getElementById(containerId);
        this.layer = this.container.querySelector('#world-pins-layer');
        this.worldManager = worldManager;
        this.scale = 1;
        this.pan = { x: 0, y: 0 };
        this.isDragging = false;
        this.lastMouse = { x: 0, y: 0 };
        
        this.initEventListeners();
    }

    initEventListeners() {
        // Pan Logic
        this.container.parentElement.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.lastMouse = { x: e.clientX, y: e.clientY };
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            const dx = e.clientX - this.lastMouse.x;
            const dy = e.clientY - this.lastMouse.y;
            this.pan.x += dx;
            this.pan.y += dy;
            this.lastMouse = { x: e.clientX, y: e.clientY };
            this.updateTransform();
        });

        window.addEventListener('mouseup', () => this.isDragging = false);
        
        // Zoom Logic
        this.container.parentElement.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            this.scale *= delta;
            this.updateTransform();
        });
    }

    updateTransform() {
        this.container.style.transform = `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.scale})`;
    }

    render() {
        if (!this.worldManager.data) return;
        
        this.layer.innerHTML = '';
        const { party, locations } = this.worldManager.data;

        // Render Locations
        locations.forEach(loc => {
            const el = document.createElement('div');
            el.className = `world-pin pin-${loc.type}`;
            el.style.left = `${loc.x}px`;
            el.style.top = `${loc.y}px`;
            el.title = loc.name;
            el.onclick = () => this.selectLocation(loc);
            this.layer.appendChild(el);
        });

        // Render Party
        const partyEl = document.createElement('div');
        partyEl.className = 'world-pin pin-party';
        partyEl.style.left = `${party.position.x}px`;
        partyEl.style.top = `${party.position.y}px`;
        partyEl.title = "Current Party Location";
        this.layer.appendChild(partyEl);
    }

    selectLocation(location) {
        // Show Sidebar details
        document.dispatchEvent(new CustomEvent('locationSelected', { detail: location }));
    }
}
```
