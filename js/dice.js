/**
 * Dice rolling module
 * Handles parsing dice notation and rolling
 */

const Dice = {
    /**
     * Parse dice notation like "2d6+3" or "1d20-1"
     * @param {string} notation - Dice notation string
     * @returns {object|null} Parsed dice object or null if invalid
     */
    parse(notation) {
        const regex = /^(\d+)?d(\d+)([+-]\d+)?$/i;
        const match = notation.trim().match(regex);
        
        if (!match) return null;
        
        return {
            count: parseInt(match[1]) || 1,
            sides: parseInt(match[2]),
            modifier: parseInt(match[3]) || 0
        };
    },

    /**
     * Roll a single die
     * @param {number} sides - Number of sides
     * @returns {number} Roll result
     */
    rollDie(sides) {
        return Math.floor(Math.random() * sides) + 1;
    },

    /**
     * Roll dice from parsed notation
     * @param {object} parsed - Parsed dice object from parse()
     * @returns {object} Roll result with individual rolls and total
     */
    rollParsed(parsed) {
        const rolls = [];
        for (let i = 0; i < parsed.count; i++) {
            rolls.push(this.rollDie(parsed.sides));
        }
        
        const subtotal = rolls.reduce((a, b) => a + b, 0);
        const total = subtotal + parsed.modifier;
        
        return {
            rolls,
            modifier: parsed.modifier,
            total
        };
    },

    /**
     * Roll from notation string
     * @param {string} notation - Dice notation string
     * @returns {object|null} Roll result or null if invalid notation
     */
    roll(notation) {
        const parsed = this.parse(notation);
        if (!parsed) return null;
        
        const result = this.rollParsed(parsed);
        result.notation = notation;
        return result;
    },

    /**
     * Roll a d20 with modifier
     * @param {number} modifier - Modifier to add
     * @returns {object} Roll result
     */
    rollD20(modifier = 0) {
        const roll = this.rollDie(20);
        return {
            rolls: [roll],
            modifier,
            total: roll + modifier,
            notation: modifier >= 0 ? `1d20+${modifier}` : `1d20${modifier}`,
            isCrit: roll === 20,
            isFumble: roll === 1
        };
    },

    /**
     * Format roll result for display
     * @param {object} result - Roll result object
     * @returns {string} Formatted string
     */
    formatResult(result) {
        let str = `[${result.rolls.join(', ')}]`;
        if (result.modifier !== 0) {
            str += result.modifier > 0 ? ` + ${result.modifier}` : ` - ${Math.abs(result.modifier)}`;
        }
        str += ` = ${result.total}`;
        return str;
    }
};
