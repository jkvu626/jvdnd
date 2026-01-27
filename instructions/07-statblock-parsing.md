# Statblock Parsing Improvements

## Overview

Fix missing Bonus Actions and Reactions in the AI statblock parser, and improve overall parsing reliability.

---

## Current State

The AI parser uses Claude 3.5 Haiku with a prompt in `server.js` (lines 151-194). Current issues:

1. Bonus Actions array often empty even when source has them
2. Reactions array often empty
3. Some special abilities miscategorized

---

## Root Cause

The current prompt lacks explicit examples for Bonus Actions/Reactions structure.

---

## Proposed Changes

### 1. Improved Parser Prompt

#### [MODIFY] [server.js](file:///c:/Users/Jesse/Organize/Personal/jvdnd/server.js)

Replace `PARSE_PROMPT` constant:

```javascript
const PARSE_PROMPT = `You are a D&D 5e statblock parser. Convert the statblock into Open5e JSON.

CRITICAL: Pay attention to section headers in the source:
- "Actions" → actions array
- "Bonus Actions" → bonus_actions array  
- "Reactions" → reactions array
- "Legendary Actions" → legendary_actions array

Return ONLY valid JSON:
{
  "slug": "monster-name-hyphenated",
  "name": "Monster Name",
  "size": "Medium",
  "type": "humanoid",
  "subtype": "",
  "alignment": "neutral",
  "armor_class": 15,
  "armor_desc": "natural armor",
  "hit_points": 45,
  "hit_dice": "6d8+18",
  "speed": {"walk": 30, "fly": null, "swim": null},
  "strength": 16,
  "dexterity": 12,
  "constitution": 16,
  "intelligence": 10,
  "wisdom": 12,
  "charisma": 8,
  "strength_save": 5,
  "dexterity_save": null,
  "constitution_save": 5,
  "intelligence_save": null,
  "wisdom_save": null,
  "charisma_save": null,
  "perception": 3,
  "skills": {"Athletics": 5, "Perception": 3},
  "damage_vulnerabilities": "",
  "damage_resistances": "",
  "damage_immunities": "",
  "condition_immunities": "",
  "senses": "darkvision 60 ft., passive Perception 13",
  "languages": "Common, Orc",
  "cr": "2",
  "special_abilities": [
    {"name": "Aggressive", "desc": "As a bonus action, can move up to its speed toward a hostile creature."}
  ],
  "actions": [
    {"name": "Greataxe", "desc": "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 9 (1d12 + 3) slashing damage."}
  ],
  "bonus_actions": [
    {"name": "Aggressive", "desc": "Move up to speed toward hostile creature."}
  ],
  "reactions": [
    {"name": "Parry", "desc": "Add 2 to AC against one melee attack that would hit."}
  ],
  "legendary_actions": [],
  "legendary_desc": ""
}

IMPORTANT:
- "Bonus Actions" section → bonus_actions array, NOT special_abilities
- "Reactions" section → reactions array, NOT special_abilities
- If ability text says "as a bonus action" but is listed under regular abilities, keep in special_abilities
- Use null for missing saves, not 0
- Calculate skill modifiers correctly

Parse this statblock:`;
```

### 2. Post-Processing Validation

Add validation layer after AI parsing:

```javascript
function validateMonsterData(monster) {
    // Ensure all required arrays exist
    monster.special_abilities = monster.special_abilities || [];
    monster.actions = monster.actions || [];
    monster.bonus_actions = monster.bonus_actions || [];
    monster.reactions = monster.reactions || [];
    monster.legendary_actions = monster.legendary_actions || [];
    
    // Ensure strings for damage/condition fields
    monster.damage_vulnerabilities = monster.damage_vulnerabilities || '';
    monster.damage_resistances = monster.damage_resistances || '';
    monster.damage_immunities = monster.damage_immunities || '';
    monster.condition_immunities = monster.condition_immunities || '';
    
    // Ensure slug exists
    if (!monster.slug) {
        monster.slug = 'custom-' + monster.name.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }
    
    return monster;
}

// In /api/parse-statblock handler:
const monster = validateMonsterData(JSON.parse(jsonStr.trim()));
```

### 3. UI Preview Improvements

#### [MODIFY] [ui.js](file:///c:/Users/Jesse/Organize/Personal/jvdnd/js/ui.js)

Ensure all sections render in preview:

```javascript
renderImportPreview(monster) {
    // ... existing code ...
    
    // Add Bonus Actions section
    if (monster.bonus_actions?.length) {
        html += '<h4>Bonus Actions</h4>';
        monster.bonus_actions.forEach(a => {
            html += `<p><strong>${a.name}.</strong> ${a.desc}</p>`;
        });
    }
    
    // Add Reactions section
    if (monster.reactions?.length) {
        html += '<h4>Reactions</h4>';
        monster.reactions.forEach(a => {
            html += `<p><strong>${a.name}.</strong> ${a.desc}</p>`;
        });
    }
}
```

---

## Statblock Rendering Polish

### Run Mode Statblock Display

#### [MODIFY] [ui.js](file:///c:/Users/Jesse/Organize/Personal/jvdnd/js/ui.js)

Improve `renderStatblock()` readability:

```javascript
renderStatblock(monster) {
    const formatMod = (score) => {
        const mod = Math.floor((score - 10) / 2);
        return mod >= 0 ? `+${mod}` : mod;
    };
    
    const statRow = (label, value) => value ? 
        `<p><strong>${label}:</strong> ${value}</p>` : '';
    
    const abilities = ['strength', 'dexterity', 'constitution', 
                       'intelligence', 'wisdom', 'charisma'];
    
    let html = `
        <div class="statblock">
            <h2>${monster.name}</h2>
            <p class="type">${monster.size} ${monster.type}${monster.subtype ? ` (${monster.subtype})` : ''}, ${monster.alignment}</p>
            <hr>
            <p><strong>AC:</strong> ${monster.armor_class} ${monster.armor_desc ? `(${monster.armor_desc})` : ''}</p>
            <p><strong>HP:</strong> ${monster.hit_points} (${monster.hit_dice})</p>
            <p><strong>Speed:</strong> ${this.formatSpeed(monster.speed)}</p>
            <hr>
            <table class="ability-scores">
                <tr>${abilities.map(a => `<th>${a.substring(0,3).toUpperCase()}</th>`).join('')}</tr>
                <tr>${abilities.map(a => `<td>${monster[a]} (${formatMod(monster[a])})</td>`).join('')}</tr>
            </table>
            <hr>
            ${statRow('Saves', this.formatSaves(monster))}
            ${statRow('Skills', this.formatSkills(monster.skills))}
            ${statRow('Damage Vulnerabilities', monster.damage_vulnerabilities)}
            ${statRow('Damage Resistances', monster.damage_resistances)}
            ${statRow('Damage Immunities', monster.damage_immunities)}
            ${statRow('Condition Immunities', monster.condition_immunities)}
            ${statRow('Senses', monster.senses)}
            ${statRow('Languages', monster.languages)}
            <p><strong>CR:</strong> ${monster.cr}</p>
            <hr>
            ${this.renderAbilitySection('Special Abilities', monster.special_abilities)}
            ${this.renderAbilitySection('Actions', monster.actions, true)}
            ${this.renderAbilitySection('Bonus Actions', monster.bonus_actions)}
            ${this.renderAbilitySection('Reactions', monster.reactions)}
            ${this.renderAbilitySection('Legendary Actions', monster.legendary_actions, false, monster.legendary_desc)}
        </div>
    `;
    
    this.elements.activeStatblock.innerHTML = html;
},

renderAbilitySection(title, abilities, addRollButtons = false, preamble = '') {
    if (!abilities?.length) return '';
    
    let html = `<h4>${title}</h4>`;
    if (preamble) html += `<p><em>${preamble}</em></p>`;
    
    abilities.forEach(ability => {
        let desc = ability.desc;
        
        if (addRollButtons) {
            // Add roll buttons for attack/damage
            desc = desc.replace(/(\d+d\d+(?:\s*[+-]\s*\d+)?)/g, 
                '<button class="roll-btn" data-roll="$1">🎲 $1</button>');
        }
        
        html += `<p><strong>${ability.name}.</strong> ${desc}</p>`;
    });
    
    return html;
}
```

---

## Verification

### Test Statblocks

Use these test cases with varied structure:

**Test 1: Has Bonus Actions**
```
Goblin Boss
Small humanoid (goblinoid), neutral evil
AC 17 (chain shirt, shield)
HP 21 (6d6)
Speed 30 ft.
STR 10 DEX 14 CON 10 INT 10 WIS 8 CHA 10
Skills Stealth +6
Senses darkvision 60 ft., passive Perception 9
Languages Common, Goblin
CR 1

Nimble Escape. The goblin can take the Disengage or Hide action as a bonus action.

Actions
Multiattack. The goblin makes two attacks with its scimitar.
Scimitar. Melee Weapon Attack: +4 to hit, reach 5 ft. Hit: 5 (1d6 + 2) slashing.

Bonus Actions
Redirect Attack. When a creature the goblin can see targets it with an attack, the goblin chooses an ally within 5 feet. The two swap places, and the ally becomes the target.
```

**Test 2: Has Reactions**
```
Knight
Medium humanoid, any alignment
AC 18 (plate)
HP 52 (8d8 + 16)
Speed 30 ft.
STR 16 DEX 11 CON 14 INT 11 WIS 11 CHA 15
Saves Con +4, Wis +2
Senses passive Perception 10
Languages Common
CR 3

Brave. The knight has advantage on saving throws against being frightened.

Actions
Multiattack. The knight makes two melee attacks.
Greatsword. Melee Weapon Attack: +5 to hit, reach 5 ft. Hit: 10 (2d6 + 3) slashing.

Reactions
Parry. The knight adds 2 to its AC against one melee attack that would hit it.
```

### Verification Steps

1. Paste Test 1 into import modal
2. Click "Parse with AI"
3. Verify: `bonus_actions` array has "Redirect Attack"
4. Paste Test 2, parse
5. Verify: `reactions` array has "Parry"
6. Save both, reload page
7. Verify they display correctly in Run mode
