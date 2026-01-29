# Sidekick Weapons & Combat Automation

> **Spec Version:** 1.0  
> **Status:** Planning  
> **Dependencies:** Character Overhaul (v2/03)

---

## Overview

Enable Sidekicks (and potentially PCs in the future) to equip standard D&D 5e weapons. This feature automates attack and damage rolls based on the equipped weapon's properties and the character's stats.

## 1. Data Model

### 1.1 Weapon Database (`WEAPONS_DATA`)
Add a constant containing standard 5e SRD weapons to `app.js` (or a new `data/weapons.js` if preferred, but `app.js` is fine for now).

Structure:
```javascript
{
  "Dagger": { 
    "damage": "1d4", 
    "type": "piercing", 
    "properties": ["Finesse", "Light", "Thrown (20/60)"] 
  },
  "Longsword": { 
    "damage": "1d8", 
    "type": "slashing", 
    "properties": ["Versatile (1d10)"] 
  },
  // ... full list of simple/martial melee/ranged weapons
}
```

### 1.2 Character Data Update
Update the `sidekick` object in the character data model to include a `weapons` array.

```javascript
character.sidekick.weapons = [
  {
    "name": "Dagger",
    "damage": "1d4",
    "type": "piercing",
    "properties": ["Finesse", "Light", "Thrown (20/60)"],
    "twoHanded": false  // Only relevant for Versatile weapons
  }
];
```

---

## 2. UI Implementation

### 2.1 Sidekick Detail Panel
Add a **Weapons** section to `_renderTypeSpecificFields` for Sidekicks.

- **Header**: "Weapons" with an `+ Add Weapon` button.
- **List**: Display equipped weapons (Name, Damage, Properties).
- **Actions**: `x` button to remove a weapon.

### 2.2 Add Weapon Modal
Reuse or extend the `_openLevelUpModal` (renaming to `_openSelectionModal` or similar might be cleaner, but expanding `_openLevelUpModal` works for now) to handle a `add-weapon` mode.

- **Content**: Scrollable list of all weapons from `WEAPONS_DATA`.
- **Interaction**: Clicking a weapon immediately adds it to the sidekick and closes the modal.
- **Display**: Show Name, Damage, and Properties in the selection list.

---

## 3. Combat Automation ("Quick Rolls")

Update `_renderQuickRolls` to dynamically generate buttons for equipped weapons.

### 3.1 Roll Logic
Calculate modifiers dynamically based on character stats and weapon properties.

1.  **Ability Modifier Selection**:
    *   **Ranged** (has `"Ammunition"` property): Use **Dexterity**.
    *   **Finesse**: Use the higher of **Strength** or **Dexterity**.
    *   **Thrown** (no Finesse): Use **Strength**.
    *   **Melee** (default): Use **Strength**.

2.  **Attack Roll**: `d20 + Ability Mod + Proficiency Bonus`
3.  **Damage Roll**: `Damage Die + Ability Mod` (no Proficiency on damage).

### 3.1.1 Versatile Weapons
Weapons with the `"Versatile (XdY)"` property can be wielded one- or two-handed.

- Store a `twoHanded` boolean per equipped weapon (default: `false`).
- Display a **toggle button** next to versatile weapons in the Quick Rolls section.
- When `twoHanded: true`, parse the versatile damage die from the property string and use it for damage rolls.

### 3.2 Button Rendering
For each equipped weapon, render:
*   **Attack Button**: Label "[Name] Atk", Roll `1d20+Mod`.
*   **Damage Button**: Label "[Name] Dmg", Roll `[Die]+Mod`.
*   **Versatile Toggle** (if applicable): Small button/icon to switch between 1H/2H grip. Updates the `twoHanded` flag and re-renders damage accordingly.

### 3.3 Default Fallback
If *no* weapons are equipped, show the generic "Melee (Str)" and "Ranged (Dex)" buttons (retain existing behavior). If weapons *are* equipped, hide these generics to reduce clutter.

---

## 4. Implementation Steps

1.  **Define Constants**: Add `WEAPONS_DATA` to `App`.
2.  **UI - Render**: Implement `_renderSidekickWeapons` and integrate into the detail view.
3.  **UI - Management**: Implement `_addWeapon`, `_removeWeapon`, and `_toggleWeaponGrip` methods.
4.  **UI - Selection**: Implement `add-weapon` mode in the modal.
5.  **Logic - Rolls**: Update `_renderQuickRolls` with the modifier logic described above.
6.  **Logic - Versatile**: Parse `Versatile (XdY)` property to extract two-handed damage die; apply based on `twoHanded` flag.
7.  **Verification**: Test with multiple weapon types (Dagger, Longsword 1H/2H, Shortbow) to verify correct stat and damage usage.
