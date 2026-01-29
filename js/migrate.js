/**
 * Migration Script - Transforms party data from state.json to world.json
 * Run this once to migrate existing party members to the new world system
 * 
 * Usage: Load the app and run `migrateData()` in the browser console
 */

async function migrateData() {
    console.log("Starting migration from state.json to world.json...");

    try {
        // 1. Fetch old state
        const stateRes = await fetch('/data/state.json');
        if (!stateRes.ok) {
            throw new Error("Could not fetch state.json");
        }
        const state = await stateRes.json();

        // 2. Extract Party
        const oldParty = state.party || [];
        console.log(`Found ${oldParty.length} party members to migrate`);

        if (oldParty.length === 0) {
            console.warn("No party members found in state.json");
            return;
        }

        // 3. Transform to new Character format
        const newCharacters = oldParty.map(member => ({
            id: `pc_${member.name.toLowerCase().replace(/\s+/g, '_')}`,
            type: 'player',
            name: member.name,
            stats: {
                hp: member.hp || member.maxHp || 10,
                maxHp: member.maxHp || member.hp || 10,
                ac: member.ac || 10
            },
            location: 'party',
            portrait: member.token || ''
        }));

        console.log("Transformed characters:", newCharacters);

        // 4. Create World Data
        const worldData = {
            viewport: { x: 0, y: 0, zoom: 1 },
            party: {
                locationId: "phandalin",
                position: { x: 450, y: 300 },
                state: 'idle'
            },
            locations: [
                {
                    id: "phandalin",
                    name: "Phandalin",
                    x: 450,
                    y: 300,
                    type: "town",
                    linkedMapId: null,
                    description: "A small mining town nestled in the foothills of the Sword Mountains."
                }
            ],
            characters: newCharacters
        };

        // 5. Save world.json
        console.log("Saving world.json...", worldData);
        const saveRes = await fetch('/save/world', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(worldData)
        });

        if (saveRes.ok) {
            console.log("✅ Migration complete! world.json has been created with party data.");
            console.log("You can now load worldManager.load() to access the data.");
        } else {
            throw new Error("Failed to save world.json");
        }

        // 6. Return the data for inspection
        return worldData;

    } catch (error) {
        console.error("❌ Migration failed:", error);
        throw error;
    }
}

// Make available globally for console usage
window.migrateData = migrateData;

console.log("Migration script loaded. Run migrateData() in console to migrate party data.");
