# Visual Polish & Theme Audit

## Overview

Perform a visual consistency check and minor UI cleanups to ensure the "Classic D&D" theme is applied consistently throughout the application.

---

## Current Theme (from styles.css)

```css
:root {
    --bg-dark: #1a1410;        /* Dark parchment */
    --surface: #2a2118;        /* Card backgrounds */
    --border: #4a3c2e;         /* Borders */
    --accent: #c9a227;         /* Gold accent */
    --accent-hover: #9e7c1f;
    --text: #e8dcc8;           /* Light parchment text */
    --text-muted: #a89880;
    --danger: #8b3a3a;         /* Blood red */
    --success: #3a6b3a;        /* Forest green */
}
```

---

## Audit Checklist

### General

- [ ] All backgrounds use `var(--bg-dark)` or `var(--surface)`
- [ ] All text uses `var(--text)` or `var(--text-muted)`
- [ ] All borders use `var(--border)`
- [ ] Accent color used consistently for interactive elements
- [ ] No hardcoded colors outside CSS variables

### Components to Check

| Component | File | Issues to Look For |
|-----------|------|-------------------|
| Header/Title | index.html | Font consistency |
| Mode buttons | index.html/styles.css | Active state styling |
| Encounter list | ui.js | Selected item highlight |
| Monster cards | ui.js | Hover states |
| Initiative list | ui.js | Current turn highlight |
| Statblock | ui.js | Header styling |
| Battlemap controls | index.html | Button consistency |
| Modals | styles.css | Overlay opacity |
| Form inputs | styles.css | Focus states |
| Dice roller | ui.js | Result display |

---

## Known Issues & Fixes

### 1. Inconsistent Button Styles

Some buttons use inline styles or different classes.

#### [MODIFY] [css/styles.css](file:///c:/Users/Jesse/Organize/Personal/jvdnd/css/styles.css)

Standardize button classes:

```css
.btn {
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--border);
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.2s;
}

.btn:hover {
    background: var(--border);
    border-color: var(--accent);
}

.btn-primary {
    background: var(--accent);
    color: var(--bg-dark);
    border-color: var(--accent);
}

.btn-primary:hover {
    background: var(--accent-hover);
}

.btn-danger {
    background: var(--danger);
    border-color: var(--danger);
}

.btn-success {
    background: var(--success);
    border-color: var(--success);
}

.btn-small {
    padding: 0.25rem 0.5rem;
    font-size: 0.85rem;
}
```

### 2. Form Input Focus States

Add visible focus indicators:

```css
input, select, textarea {
    background: var(--bg-dark);
    color: var(--text);
    border: 1px solid var(--border);
    padding: 0.5rem;
    border-radius: 4px;
    font-family: inherit;
}

input:focus, select:focus, textarea:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 2px rgba(201, 162, 39, 0.2);
}
```

### 3. Modal Styling

Ensure consistent modal appearance:

```css
.modal {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.modal-content {
    background: var(--surface);
    border: 2px solid var(--border);
    border-radius: 8px;
    padding: 1.5rem;
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

.modal h2 {
    color: var(--accent);
    margin-bottom: 1rem;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.5rem;
}
```

### 4. Statblock Styling

D&D-style statblock presentation:

```css
.statblock {
    font-family: 'Crimson Text', Georgia, serif;
    background: linear-gradient(to bottom, 
        var(--surface) 0%, 
        #1e1915 100%);
    border: 2px solid var(--border);
    border-radius: 0;
    padding: 1rem;
}

.statblock h2 {
    color: var(--accent);
    font-size: 1.5rem;
    margin-bottom: 0.25rem;
}

.statblock .type {
    font-style: italic;
    color: var(--text-muted);
    font-size: 0.9rem;
}

.statblock hr {
    border: none;
    border-top: 2px solid var(--danger);
    margin: 0.75rem 0;
}

.statblock h4 {
    color: var(--accent);
    font-size: 1.1rem;
    margin: 1rem 0 0.5rem;
    border-bottom: 1px solid var(--border);
}

.statblock .ability-scores {
    width: 100%;
    text-align: center;
    border-collapse: collapse;
}

.statblock .ability-scores th {
    color: var(--accent);
    font-weight: bold;
}

.statblock .ability-scores td {
    padding: 0.25rem;
}
```

### 5. Scrollbar Styling

Custom scrollbars for theme consistency:

```css
::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}

::-webkit-scrollbar-track {
    background: var(--bg-dark);
}

::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
    background: var(--accent);
}
```

### 6. Add Google Font

#### [MODIFY] [index.html](file:///c:/Users/Jesse/Organize/Personal/jvdnd/index.html)

Add font in `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
```

---

## Typography

```css
body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 14px;
    line-height: 1.5;
}

h1, h2, h3, .statblock {
    font-family: 'Crimson Text', Georgia, serif;
}
```

---

## Verification

Visual inspection checklist:

1. **Prep Mode**
   - [ ] Encounter list items have consistent styling
   - [ ] Monster search dropdown matches theme
   - [ ] Buttons have proper hover states

2. **Run Mode**
   - [ ] Initiative list has clear current-turn indicator
   - [ ] HP inputs styled consistently
   - [ ] Statblock is readable and well-formatted

3. **Party Mode**
   - [ ] Form inputs have focus states
   - [ ] Party member cards styled consistently

4. **Map Mode**
   - [ ] Controls blend with overall theme
   - [ ] Canvas has appropriate border/shadow

5. **Modals**
   - [ ] Initiative modal styled correctly
   - [ ] Import modal has proper container styling

6. **Cross-browser**
   - [ ] Check in Chrome, Firefox, Edge
   - [ ] Custom scrollbars work (or fallback gracefully)
