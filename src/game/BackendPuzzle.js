// src/game/BackendPuzzle.js
// Model: Handles the logical state and rules of the puzzle grid.

import { ExplodeAndReplacePhase } from './ExplodeAndReplacePhase';
import { GEM_TYPES } from './constants';

export class BackendPuzzle {
    /** @type {number} */
    width;
    /** @type {number} */
    height;
    /** @type {string[]} */
    nextGemsToSpawn = [];
    /** @type {Array<Array<{gemType: string} | null>>} */
    puzzleState; // grid[x][y] -> { gemType: '...' } or null

    /**
     * Initializes the backend puzzle logic.
     * @param {number} width - Grid width (columns).
     * @param {number} height - Grid height (rows).
     */
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.puzzleState = this.getInitialPuzzleStateWithNoMatches(width, height);
    }

    // --- Public Methods ---

    /**
     * Returns the current logical state of the puzzle grid.
     * @returns {Array<Array<{gemType: string} | null>>} A copy or reference to the puzzle state.
     */
    getGridState() {
        // Return a deep copy if external modification is a concern,
        // otherwise return reference for performance. For this structure,
        // the Controller reads but doesn't directly modify, so reference is okay.
        return this.puzzleState;
    }

    /**
     * Generates an initial grid state with no immediate matches.
     * @param {number} width
     * @param {number} height
     * @returns {Array<Array<{gemType: string} | null>>}
     */
    getInitialPuzzleStateWithNoMatches(width, height) {
        let grid = [];

        for (let x = 0; x < width; x++) {
            grid[x] = new Array(height).fill(null); // Initialize column
            for (let y = 0; y < height; y++) {
                let possibleTypes = [...GEM_TYPES];

                // Check vertically (prevent 3-in-a-row)
                const prevY1Type = grid[x]?.[y - 1]?.gemType;
                const prevY2Type = grid[x]?.[y - 2]?.gemType;
                if (y >= 2 && prevY1Type && prevY1Type === prevY2Type) {
                    possibleTypes = possibleTypes.filter(type => type !== prevY1Type);
                }

                // Check horizontally (prevent 3-in-a-row)
                const prevX1Type = grid[x - 1]?.[y]?.gemType;
                const prevX2Type = grid[x - 2]?.[y]?.gemType;
                if (x >= 2 && prevX1Type && prevX1Type === prevX2Type) {
                    possibleTypes = possibleTypes.filter(type => type !== prevX1Type);
                }

                // Fallback if filtering removed all options (rare)
                if (possibleTypes.length === 0) {
                    console.warn(`No valid gem types at [${x},${y}], using random fallback.`);
                    possibleTypes = [...GEM_TYPES];
                }

                const gemType = possibleTypes[Math.floor(Math.random() * possibleTypes.length)];
                grid[x][y] = { gemType: gemType };
            }
        }
        return grid;
    }

    /**
     * Applies move actions, finds matches, calculates replacements,
     * updates the internal state, and returns the phase details.
     * @param {MoveAction[]} actions - An array of moves to apply (usually just one).
     * @returns {ExplodeAndReplacePhase} Details of matches and needed replacements.
     */
    getNextExplodeAndReplacePhase(actions) {
        // 1. Apply actions to the current state
        for (let action of actions) {
            this.applyMoveToGrid(this.puzzleState, action);
        }

        // 2. Find all matches in the modified state
        const matches = this.getMatches(this.puzzleState);

        // 3. Calculate replacements needed based on matches
        const replacements = [];
        if (matches.length > 0) {
            const explosionCounts = {}; // { colIndex: count }
            const explodedCoords = new Set();

            // Find unique coordinates of all exploding gems
            matches.forEach(match => {
                match.forEach(([x, y]) => explodedCoords.add(`${x},${y}`));
            });

            // Count explosions per column
            explodedCoords.forEach(coordStr => {
                const [xStr] = coordStr.split(',');
                const x = parseInt(xStr, 10);
                explosionCounts[x] = (explosionCounts[x] || 0) + 1;
            });

            // Generate replacement types
            for (let x = 0; x < this.width; x++) {
                const count = explosionCounts[x] || 0;
                if (count > 0) {
                    const typesForCol = [];
                    for (let i = 0; i < count; i++) {
                        typesForCol.push(this.getNextGemToSpawnType());
                    }
                    replacements.push([x, typesForCol]);
                }
            }
        }

        // 4. Create the result object *before* modifying the state further
        const phaseResult = new ExplodeAndReplacePhase(matches, replacements);

        // 5. Apply the explosion and replacement to the internal state if matches occurred
        if (!phaseResult.isNothingToDo()) {
            this.applyExplodeAndReplacePhase(phaseResult);
        }

        // 6. Return the result
        return phaseResult;
    }

    /**
     * Calculates matches that *would* occur if a hypothetical move were made.
     * Does *not* change the internal state.
     * @param {MoveAction} moveAction - The hypothetical move.
     * @returns {Array<Array<[number, number]>>} The matches found.
     */
    getMatchesFromHypotheticalMove(moveAction) {
        // Use structuredClone for a deep copy (modern browsers) or fallback
        let hypotheticalState;
        try {
             hypotheticalState = structuredClone(this.puzzleState);
        } catch (e) {
             console.warn("structuredClone not supported, using JSON workaround for hypothetical move.");
             hypotheticalState = JSON.parse(JSON.stringify(this.puzzleState)); // Slower fallback
        }

        this.applyMoveToGrid(hypotheticalState, moveAction);
        return this.getMatches(hypotheticalState);
    }

    /** Returns the type of the next gem to spawn, from queue or randomly. */
    getNextGemToSpawnType() {
        if (this.nextGemsToSpawn.length > 0) {
            return this.nextGemsToSpawn.shift();
        }
        return GEM_TYPES[Math.floor(Math.random() * GEM_TYPES.length)];
    }

    /** Adds a specific gem type to the spawn queue. */
    addNextGemToSpawn(gemType) {
        this.nextGemsToSpawn.push(gemType);
    }

    /** Adds multiple gem types to the spawn queue. */
    addNextGemsToSpawn(gemTypes) {
        this.nextGemsToSpawn.push(...gemTypes);
    }

    /** Resets the puzzle to a new initial state. */
    reset() {
        this.puzzleState = this.getInitialPuzzleStateWithNoMatches(this.width, this.height);
        this.nextGemsToSpawn = [];
        console.log("BackendPuzzle reset.");
    }


    // --- Internal Helper Methods ---

    /**
     * Modifies a grid state in-place based on a move action (handles wrapping).
     * @param {Array<Array<object | null>>} grid - The grid state to modify.
     * @param {MoveAction} moveAction - The move to apply.
     */
    applyMoveToGrid(grid, moveAction) {
        const { rowOrCol, index, amount } = moveAction;
        if (amount === 0) return; // No movement

        if (rowOrCol === 'row') {
            const width = this.width;
            const effectiveAmount = ((amount % width) + width) % width; // Ensure positive 0 <= amount < width
            if (effectiveAmount === 0) return;
            const y = index;
            if (y < 0 || y >= this.height) return; // Invalid row index

            const currentRow = [];
            for (let x = 0; x < width; x++) {
                currentRow.push(grid[x]?.[y]); // Read current gems
            }

             // Check for errors before proceeding
             if (currentRow.some(gem => gem === undefined)) {
                  console.error(`Error reading row ${y} for move application.`);
                  return;
             }

            // Perform the wrap-around shift
            const newRow = [...currentRow.slice(-effectiveAmount), ...currentRow.slice(0, width - effectiveAmount)];

            // Write the shifted gems back
            for (let x = 0; x < width; x++) {
                if (grid[x]) {
                    grid[x][y] = newRow[x];
                }
            }

        } else { // 'col'
            const height = this.height;
            const effectiveAmount = ((amount % height) + height) % height; // Ensure positive 0 <= amount < height
            if (effectiveAmount === 0) return;
            const x = index;
            if (x < 0 || x >= this.width || !grid[x]) return; // Invalid col index

            const currentCol = grid[x];

             // Check for errors before proceeding
             if (currentCol.some(gem => gem === undefined)) {
                  console.error(`Error reading column ${x} for move application.`);
                  return;
             }

            // Perform the wrap-around shift (positive amount moves gems *down*)
            const newCol = [...currentCol.slice(height - effectiveAmount), ...currentCol.slice(0, height - effectiveAmount)];

            // Write the shifted gems back
            grid[x] = newCol;
        }
    }

    /**
     * Finds all 3+ matches horizontally and vertically in the given state.
     * @param {Array<Array<object | null>>} puzzleState - The grid state to check.
     * @returns {Array<Array<[number, number]>>} Array of matches found.
     */
    getMatches(puzzleState) {
        const matches = [];
        if (!puzzleState || this.width === 0 || this.height === 0) return matches;

        const getGemType = (x, y) => puzzleState[x]?.[y]?.gemType;

        // Check Vertical Matches
        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height - 2; ) { // Note the increment control inside loop
                const currentType = getGemType(x, y);
                if (!currentType) {
                    y++;
                    continue;
                }

                let matchLength = 1;
                while (y + matchLength < this.height && getGemType(x, y + matchLength) === currentType) {
                    matchLength++;
                }

                if (matchLength >= 3) {
                    const match = [];
                    for (let i = 0; i < matchLength; i++) {
                        match.push([x, y + i]);
                    }
                    matches.push(match);
                }
                y += matchLength; // Skip checked gems
            }
        }

        // Check Horizontal Matches
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width - 2; ) { // Note the increment control inside loop
                const currentType = getGemType(x, y);
                 if (!currentType) {
                    x++;
                    continue;
                }

                let matchLength = 1;
                while (x + matchLength < this.width && getGemType(x + matchLength, y) === currentType) {
                    matchLength++;
                }

                if (matchLength >= 3) {
                    const match = [];
                    for (let i = 0; i < matchLength; i++) {
                        match.push([x + i, y]);
                    }
                    matches.push(match);
                }
                x += matchLength; // Skip checked gems
            }
        }

        return matches;
    }

    /**
     * Modifies the internal puzzleState by removing matched gems and adding replacements.
     * @param {ExplodeAndReplacePhase} phase - The phase details.
     */
    applyExplodeAndReplacePhase(phase) {
        if (phase.isNothingToDo()) return;

        const explodeCoords = new Set();
        phase.matches.forEach(match => match.forEach(coord => explodeCoords.add(`${coord[0]},${coord[1]}`)));

        const replacementsMap = new Map(phase.replacements); // colIndex -> [types...]

        const newGrid = [];
        for (let x = 0; x < this.width; x++) {
            newGrid[x] = []; // Initialize new column

            // Get gems from current state that didn't explode
            const currentColumn = this.puzzleState[x] || [];
            const survivingGems = currentColumn.filter((gem, y) => !explodeCoords.has(`${x},${y}`));

            // Get new gems for this column
            const newGemTypes = replacementsMap.get(x) || [];
            const newGems = newGemTypes.map(type => ({ gemType: type }));

            // Combine: new gems at the top (index 0), survivors below
            newGrid[x] = [...newGems, ...survivingGems];

            // Ensure column has correct height (shouldn't be needed if logic is sound)
            if (newGrid[x].length !== this.height) {
                console.error(`Backend Error: Column ${x} length mismatch after phase. Expected ${this.height}, got ${newGrid[x].length}. Fixing...`);
                // Simple fix: pad with null or truncate
                 while (newGrid[x].length < this.height) newGrid[x].push(null);
                 if (newGrid[x].length > this.height) newGrid[x] = newGrid[x].slice(0, this.height);
            }
        }

        this.puzzleState = newGrid;
    }
}
