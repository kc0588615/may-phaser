// src/game/ExplodeAndReplacePhase.js

/**
 * Represents the result of applying moves: matches found and replacements needed.
 */
export class ExplodeAndReplacePhase {
    /** @type {Array<Array<[number, number]>>} */
    matches; // Array of matches, each match is an array of [x, y] coordinates
    /** @type {Array<[number, string[]]>} */
    replacements; // Array of [columnIndex, [gemType1, gemType2, ...]] for gems to spawn

    /**
     * Creates an ExplodeAndReplacePhase result.
     * @param {Array<Array<[number, number]>>} matches - The coordinates of matched gems.
     * @param {Array<[number, string[]]>} replacements - The new gems needed per column.
     */
    constructor(matches, replacements) {
        this.matches = matches || [];
        this.replacements = replacements || [];
    }

    /**
     * Checks if any matches occurred in this phase.
     * @returns {boolean} True if there were no matches.
     */
    isNothingToDo() {
        return this.matches.length === 0;
    }
}
