// src/game/MoveAction.js

/**
 * Represents a player's action of moving a row or column.
 */
export class MoveAction {
    /** @type {'row' | 'col'} */
    rowOrCol;
    /** @type {number} */
    index;
    /** @type {number} */
    amount;

    /**
     * Creates a MoveAction.
     * @param {'row' | 'col'} rowOrCol - Whether a row or column was moved.
     * @param {number} index - The index of the row or column moved.
     * @param {number} amount - The number of cells shifted (positive for right/down, negative for left/up).
     */
    constructor(rowOrCol, index, amount) {
        this.rowOrCol = rowOrCol;
        this.index = index;
        this.amount = amount;
    }
}
