// src/game/BackendPuzzle.js
import { ExplodeAndReplacePhase } from './ExplodeAndReplacePhase';
import { GEM_TYPES } from './constants';

// ***** HABITAT-TO-GEM MAPPING *****
// This defines how habitat pixel values from your raster correspond to gem types.
// Ensure this aligns with your habitat_colormap.json values and desired game balance.
// habitat_colormap.json has string keys, but these are numeric habitat class values.
const HABITAT_GEM_MAP = {
    // Example: IUCN Habitat Classification Scheme
    // Class 1: Forests (various types)
    100: 'green', 101: 'green', 102: 'green', 103: 'green', 104: 'green',
    105: 'green', 106: 'green', 107: 'green', 108: 'green', 109: 'green',
    // Class 2: Savannas
    200: 'orange', 201: 'orange', 202: 'orange',
    // Class 3: Shrublands
    300: 'black', 301: 'black', 302: 'black', 303: 'black', 304: 'black',
    305: 'black', 306: 'black', 307: 'black', 308: 'black',
    // Class 4: Grasslands
    // Consider a different gem, e.g., 'white' if you want to distinguish from Savannas
    400: 'white', 401: 'white', 402: 'white', 403: 'white', 404: 'white',
    405: 'white', 406: 'white', 407: 'white',
    // Class 5: Wetlands (Inland)
    500: 'blue', 501: 'blue', 502: 'blue', 503: 'blue', 504: 'blue',
    505: 'blue', 506: 'blue', 507: 'blue', 508: 'blue', 509: 'blue',
    510: 'blue', 511: 'blue', 512: 'blue', 513: 'blue', 514: 'blue',
    515: 'blue', 516: 'blue', 517: 'blue', 518: 'blue',
    // Class 6: Rocky Areas
    600: 'black', // Or 'red' if you want to represent barren/rocky
    // Class 8: Introduced Vegetation (could be mixed)
    800: 'orange', 801: 'orange', 802: 'orange', 803: 'orange',
    // Class 9: Other (Snow, Ice, Glaciers)
    900: 'white', 901: 'white', 908: 'red', 909: 'green', // 908, 909 are specific from your JSON
    // Class 10-12: Marine (Oceans, Coastal) - Predominantly Blue
    1000: 'blue', 1001: 'blue', 1002: 'blue', 1003: 'blue', 1004: 'blue',
    1100: 'blue', 1101: 'blue', 1102: 'blue', 1103: 'blue', 1104: 'blue',
    1105: 'blue', 1106: 'blue',
    1200: 'blue', 1206: 'blue', 1207: 'blue',
    // Class 14: Artificial/Terrestrial (Urban, Agricultural)
    1400: 'red', 1401: 'red', 1402: 'red', 1403: 'red', 1404: 'red',
    1405: 'red', 1406: 'red',
    // Special Values
    0: 'blue',    // Typically NoData or Water in many classifications
    1700: 'white' // Often NoData or a specific "out of bounds" value
    // Add all relevant values from your habitat_colormap.json
};


export class BackendPuzzle {
    /** @type {number} */
    width;
    /** @type {number} */
    height;
    /** @type {string[]} */
    nextGemsToSpawn = [];
    /** @type {Array<Array<{gemType: string} | null>>} */
    puzzleState;
    /** @type {number[] | null} */
    currentHabitatInfluence = null; // Renamed for clarity

    /**
     * @param {number} width
     * @param {number} height
     */
    constructor(width, height) {
        console.log(`BackendPuzzle: Constructor (width=${width}, height=${height})`);
        this.width = width;
        this.height = height;
        // Initial puzzle state will be random, can be influenced later
        this.puzzleState = this.getInitialPuzzleStateWithNoMatches(width, height);
        console.log("BackendPuzzle: Initial puzzleState created.");
    }

    /**
     * Sets the habitat influence for gem generation.
     * This also triggers a regeneration of the puzzle state if the board is
     * intended to reflect the new influence immediately.
     * @param {number[] | null} habitatValues - Array of numeric habitat codes.
     */
    setHabitatInfluence(habitatValues) {
        if (Array.isArray(habitatValues)) {
            const validHabitats = habitatValues.filter(h => typeof h === 'number' && !isNaN(h));
            this.currentHabitatInfluence = validHabitats.length > 0 ? validHabitats : null;
        } else {
            this.currentHabitatInfluence = null;
        }
        console.log("BackendPuzzle: Habitat influence set to:", this.currentHabitatInfluence);

        // **IMPORTANT**: Regenerate the puzzle state to reflect the new influence for the initial board.
        // This assumes that when habitat influence changes, the whole board should be fresh.
        // If only new falling gems should be influenced, you would skip this line.
        console.log("BackendPuzzle: Regenerating puzzle state with new habitat influence.");
        this.puzzleState = this.getInitialPuzzleStateWithNoMatches(this.width, this.height);
    }

    getGridState() {
        return this.puzzleState;
    }

    /**
     * Generates an initial grid state with no immediate matches,
     * potentially influenced by currentHabitatInfluence.
     * @param {number} width
     * @param {number} height
     * @returns {Array<Array<{gemType: string} | null>>}
     */
    getInitialPuzzleStateWithNoMatches(width, height) {
        console.log("BackendPuzzle: getInitialPuzzleStateWithNoMatches called.");
        let grid = [];

        for (let x = 0; x < width; x++) {
            grid[x] = new Array(height).fill(null);
            for (let y = 0; y < height; y++) {
                let gemType;
                // Try to get gem type based on habitat influence for initial fill
                // This makes the initial board reflect the selected area.
                if (this.currentHabitatInfluence && this.currentHabitatInfluence.length > 0) {
                    // Pick one habitat value randomly from the available ones for this specific gem
                    const habitatValue = this.currentHabitatInfluence[Math.floor(Math.random() * this.currentHabitatInfluence.length)];
                    const mappedGemType = HABITAT_GEM_MAP[habitatValue];
                    if (mappedGemType && GEM_TYPES.includes(mappedGemType)) {
                        gemType = mappedGemType;
                    } else {
                        // Fallback if habitat value not in map or maps to invalid type for this specific gem
                        gemType = GEM_TYPES[Math.floor(Math.random() * GEM_TYPES.length)];
                    }
                } else {
                    // Fallback to purely random if no influence for initial fill
                    gemType = GEM_TYPES[Math.floor(Math.random() * GEM_TYPES.length)];
                }

                // Check against previously placed gems to avoid initial 3-in-a-row
                // This loop tries a few times to find a non-matching gem.
                let attempts = 0;
                const maxAttempts = GEM_TYPES.length * 2; // Heuristic
                while (attempts < maxAttempts) {
                    const prevY1Type = grid[x]?.[y - 1]?.gemType;
                    const prevY2Type = grid[x]?.[y - 2]?.gemType;
                    const prevX1Type = grid[x - 1]?.[y]?.gemType;
                    const prevX2Type = grid[x - 2]?.[y]?.gemType;

                    let yMatch = (y >= 2 && prevY1Type && prevY1Type === prevY2Type && prevY1Type === gemType);
                    let xMatch = (x >= 2 && prevX1Type && prevX1Type === prevX2Type && prevX1Type === gemType);

                    if (!yMatch && !xMatch) {
                        break; // Found a suitable gemType
                    }

                    // Try a different gem type if it would create an initial match
                    // (and if habitat influence didn't already pick one)
                    let possibleTypes = [...GEM_TYPES];
                    if (yMatch) possibleTypes = possibleTypes.filter(type => type !== prevY1Type);
                    if (xMatch) possibleTypes = possibleTypes.filter(type => type !== prevX1Type);

                    if (possibleTypes.length > 0) {
                        gemType = possibleTypes[Math.floor(Math.random() * possibleTypes.length)];
                    } else {
                        // Very rare, stick with the current random/habitat gem
                        if (attempts === 0) console.warn(`Initial fill at [${x},${y}] might create match, limited options.`);
                        break;
                    }
                    attempts++;
                }
                if (attempts >= maxAttempts) {
                    console.warn(`Could not avoid initial match at [${x},${y}] after ${maxAttempts} attempts.`);
                }

                grid[x][y] = { gemType: gemType };
            }
        }
        console.log("BackendPuzzle: getInitialPuzzleStateWithNoMatches finished creating grid.");
        return grid;
    }


    getNextExplodeAndReplacePhase(actions) {
        for (let action of actions) {
            this.applyMoveToGrid(this.puzzleState, action);
        }
        const matches = this.getMatches(this.puzzleState);
        const replacements = [];
        if (matches.length > 0) {
            const explosionCounts = {};
            const explodedCoords = new Set();
            matches.forEach(match => match.forEach(([x, y]) => explodedCoords.add(`${x},${y}`)));
            explodedCoords.forEach(coordStr => {
                const [xStr] = coordStr.split(',');
                const x = parseInt(xStr, 10);
                explosionCounts[x] = (explosionCounts[x] || 0) + 1;
            });
            for (let x = 0; x < this.width; x++) {
                const count = explosionCounts[x] || 0;
                if (count > 0) {
                    const typesForCol = [];
                    for (let i = 0; i < count; i++) {
                        // getNextGemToSpawnType will use habitatInfluence for *new* gems
                        typesForCol.push(this.getNextGemToSpawnType());
                    }
                    replacements.push([x, typesForCol]);
                }
            }
        }
        const phaseResult = new ExplodeAndReplacePhase(matches, replacements);
        if (!phaseResult.isNothingToDo()) {
            this.applyExplodeAndReplacePhase(phaseResult);
        }
        return phaseResult;
    }

    getMatchesFromHypotheticalMove(moveAction) {
        let hypotheticalState;
        try {
            hypotheticalState = structuredClone(this.puzzleState);
        } catch (e) {
            console.warn("structuredClone not supported, using JSON workaround.");
            hypotheticalState = JSON.parse(JSON.stringify(this.puzzleState));
        }
        this.applyMoveToGrid(hypotheticalState, moveAction);
        return this.getMatches(hypotheticalState);
    }

    /**
     * Returns the type of the next gem to spawn, influenced by habitats or randomly.
     * This is used when gems are falling in to replace matched ones.
     */
    getNextGemToSpawnType() {
        if (this.nextGemsToSpawn.length > 0) {
            return this.nextGemsToSpawn.shift();
        }

        if (this.currentHabitatInfluence && this.currentHabitatInfluence.length > 0) {
            const habitatValue = this.currentHabitatInfluence[Math.floor(Math.random() * this.currentHabitatInfluence.length)];
            const mappedGemType = HABITAT_GEM_MAP[habitatValue];

            if (mappedGemType && GEM_TYPES.includes(mappedGemType)) {
                // console.log(`Spawning gem '${mappedGemType}' based on habitat ${habitatValue}`);
                return mappedGemType;
            } else {
                // console.warn(`Habitat value ${habitatValue} (from influence list) not in HABITAT_GEM_MAP or maps to invalid type. Using random.`);
                return GEM_TYPES[Math.floor(Math.random() * GEM_TYPES.length)];
            }
        } else {
            // Fallback to purely random if no influence available for new falling gems
            return GEM_TYPES[Math.floor(Math.random() * GEM_TYPES.length)];
        }
    }

    addNextGemToSpawn(gemType) {
        this.nextGemsToSpawn.push(gemType);
    }

    addNextGemsToSpawn(gemTypes) {
        this.nextGemsToSpawn.push(...gemTypes);
    }

    reset() {
        // When resetting, we clear habitat influence and generate a purely random board.
        // The habitat influence will be set again by Game.js when a new location is selected.
        this.currentHabitatInfluence = null;
        this.puzzleState = this.getInitialPuzzleStateWithNoMatches(this.width, this.height);
        this.nextGemsToSpawn = [];
        console.log("BackendPuzzle reset: habitat influence cleared, new random board generated.");
    }

    applyMoveToGrid(grid, moveAction) {
        // ... (this method remains the same as your original)
        const { rowOrCol, index, amount } = moveAction;
        if (amount === 0) return;

        if (rowOrCol === 'row') {
            const width = this.width;
            const effectiveAmount = ((amount % width) + width) % width;
            if (effectiveAmount === 0) return;
            const y = index;
            if (y < 0 || y >= this.height) return;

            const currentRow = [];
            for (let x = 0; x < width; x++) {
                currentRow.push(grid[x]?.[y]);
            }
             if (currentRow.some(gem => gem === undefined)) {
                  console.error(`Error reading row ${y} for move application.`);
                  return;
             }
            const newRow = [...currentRow.slice(-effectiveAmount), ...currentRow.slice(0, width - effectiveAmount)];
            for (let x = 0; x < width; x++) {
                if (grid[x]) {
                    grid[x][y] = newRow[x];
                }
            }
        } else { // 'col'
            const height = this.height;
            const effectiveAmount = ((amount % height) + height) % height;
            if (effectiveAmount === 0) return;
            const x = index;
            if (x < 0 || x >= this.width || !grid[x]) return;
            const currentCol = grid[x];
             if (currentCol.some(gem => gem === undefined)) {
                  console.error(`Error reading column ${x} for move application.`);
                  return;
             }
            const newCol = [...currentCol.slice(height - effectiveAmount), ...currentCol.slice(0, height - effectiveAmount)];
            grid[x] = newCol;
        }
    }

    getMatches(puzzleState) {
        // ... (this method remains the same as your original)
        const matches = [];
        if (!puzzleState || this.width === 0 || this.height === 0) return matches;
        const getGemType = (x, y) => puzzleState[x]?.[y]?.gemType;

        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height - 2; ) {
                const currentType = getGemType(x, y);
                if (!currentType) { y++; continue; }
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
                y += matchLength;
            }
        }
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width - 2; ) {
                const currentType = getGemType(x, y);
                 if (!currentType) { x++; continue; }
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
                x += matchLength;
            }
        }
        return matches;
    }

    applyExplodeAndReplacePhase(phase) {
        // ... (this method remains the same as your original)
        if (phase.isNothingToDo()) return;
        const explodeCoords = new Set();
        phase.matches.forEach(match => match.forEach(coord => explodeCoords.add(`${coord[0]},${coord[1]}`)));
        const replacementsMap = new Map(phase.replacements);
        const newGrid = [];
        for (let x = 0; x < this.width; x++) {
            newGrid[x] = [];
            const currentColumn = this.puzzleState[x] || [];
            const survivingGems = currentColumn.filter((gem, y) => !explodeCoords.has(`${x},${y}`));
            const newGemTypes = replacementsMap.get(x) || [];
            const newGems = newGemTypes.map(type => ({ gemType: type }));
            newGrid[x] = [...newGems, ...survivingGems];
            if (newGrid[x].length !== this.height) {
                console.error(`Backend Error: Column ${x} length mismatch after phase. Expected ${this.height}, got ${newGrid[x].length}. Fixing...`);
                 while (newGrid[x].length < this.height) newGrid[x].push(null); // Pad with null
                 if (newGrid[x].length > this.height) newGrid[x] = newGrid[x].slice(0, this.height); // Truncate
            }
        }
        this.puzzleState = newGrid;
    }
}