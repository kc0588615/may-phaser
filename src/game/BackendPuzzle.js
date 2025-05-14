// src/game/BackendPuzzle.js
import { ExplodeAndReplacePhase } from './ExplodeAndReplacePhase';
import { GEM_TYPES } from './constants';

// (HABITAT_GEM_MAP remains the same as your previous version)
const HABITAT_GEM_MAP = {
    100: 'green', 101: 'green', 102: 'green', 103: 'green', 104: 'green',
    105: 'green', 106: 'green', 107: 'green', 108: 'green', 109: 'green',
    200: 'orange', 201: 'orange', 202: 'orange',
    300: 'black', 301: 'black', 302: 'black', 303: 'black', 304: 'black',
    305: 'black', 306: 'black', 307: 'black', 308: 'black',
    400: 'white', 401: 'white', 402: 'white', 403: 'white', 404: 'white',
    405: 'white', 406: 'white', 407: 'white',
    500: 'blue', 501: 'blue', 502: 'blue', 503: 'blue', 504: 'blue',
    505: 'blue', 506: 'blue', 507: 'blue', 508: 'blue', 509: 'blue',
    510: 'blue', 511: 'blue', 512: 'blue', 513: 'blue', 514: 'blue',
    515: 'blue', 516: 'blue', 517: 'blue', 518: 'blue',
    600: 'black',
    800: 'orange', 801: 'orange', 802: 'orange', 803: 'orange',
    900: 'white', 901: 'white', 908: 'red', 909: 'green',
    1000: 'blue', 1001: 'blue', 1002: 'blue', 1003: 'blue', 1004: 'blue',
    1100: 'blue', 1101: 'blue', 1102: 'blue', 1103: 'blue', 1104: 'blue',
    1105: 'blue', 1106: 'blue',
    1200: 'blue', 1206: 'blue', 1207: 'blue',
    1400: 'red', 1401: 'red', 1402: 'red', 1403: 'red', 1404: 'red',
    1405: 'red', 1406: 'red',
    0: 'blue',
    1700: 'white'
};

export class BackendPuzzle {
    width;
    height;
    nextGemsToSpawn = [];
    puzzleState;
    currentHabitatInfluence = null;

    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.puzzleState = this.getInitialPuzzleStateWithNoMatches(width, height);
    }

    setHabitatInfluence(habitatValues) {
        if (Array.isArray(habitatValues)) {
            const validHabitats = habitatValues.filter(h => typeof h === 'number' && !isNaN(h));
            this.currentHabitatInfluence = validHabitats.length > 0 ? validHabitats : null;
        } else {
            this.currentHabitatInfluence = null;
        }
        console.log("BackendPuzzle: Habitat influence set to:", this.currentHabitatInfluence);
        console.log("BackendPuzzle: Regenerating puzzle state with new habitat influence.");
        this.puzzleState = this.getInitialPuzzleStateWithNoMatches(this.width, this.height);
    }

    getGridState() {
        return this.puzzleState;
    }

    /**
     * Helper to pick a gem type, considering habitat influence first, then random.
     * This does NOT check for matches; that's done by the calling function.
     */
    _pickGemTypeBasedOnInfluenceOrRandom() {
        if (this.currentHabitatInfluence && this.currentHabitatInfluence.length > 0) {
            const habitatValue = this.currentHabitatInfluence[Math.floor(Math.random() * this.currentHabitatInfluence.length)];
            const mappedGemType = HABITAT_GEM_MAP[habitatValue];
            if (mappedGemType && GEM_TYPES.includes(mappedGemType)) {
                return mappedGemType;
            }
        }
        // Fallback to purely random if no influence or mapping fails
        return GEM_TYPES[Math.floor(Math.random() * GEM_TYPES.length)];
    }

    getInitialPuzzleStateWithNoMatches(width, height) {
        console.log("BackendPuzzle: getInitialPuzzleStateWithNoMatches called.");
        let grid = [];
        for (let x = 0; x < width; x++) {
            grid[x] = new Array(height).fill(null);
            for (let y = 0; y < height; y++) {
                // Get a list of all possible gem types we can try
                let availableGemTypes = [...GEM_TYPES];
                let chosenGemType = null;

                // Try to pick based on habitat first, then cycle through others if it creates a match
                const habitatPreferredGem = this._pickGemTypeBasedOnInfluenceOrRandom();
                // Put preferred at the start of the try-list, then others shuffled
                availableGemTypes = availableGemTypes.filter(t => t !== habitatPreferredGem);
                availableGemTypes.sort(() => 0.5 - Math.random()); // Shuffle
                availableGemTypes.unshift(habitatPreferredGem);

                for (const tryGemType of availableGemTypes) {
                    // Check if placing tryGemType at (x,y) would create a match
                    // Check horizontally:
                    const hMatch = (x >= 2 &&
                                    grid[x-1]?.[y]?.gemType === tryGemType &&
                                    grid[x-2]?.[y]?.gemType === tryGemType);
                    // Check vertically:
                    const vMatch = (y >= 2 &&
                                    grid[x]?.[y-1]?.gemType === tryGemType &&
                                    grid[x]?.[y-2]?.gemType === tryGemType);

                    if (!hMatch && !vMatch) {
                        chosenGemType = tryGemType;
                        break; // Found a gem that doesn't create a match
                    }
                }

                if (!chosenGemType) {
                    // This should be very rare if GEM_TYPES has enough variety (>=3)
                    // If all types create a match, pick one from habitat/random anyway and log warning
                    chosenGemType = habitatPreferredGem; // or just completely random GEM_TYPES[0]
                    console.warn(`Could not avoid initial match at [${x},${y}]. Placing ${chosenGemType}. Consider more GEM_TYPES or different board size.`);
                }
                grid[x][y] = { gemType: chosenGemType };
            }
        }
        console.log("BackendPuzzle: getInitialPuzzleStateWithNoMatches finished creating grid.");
        return grid;
    }

    _pickNextRawGemToSpawn() {
        if (this.nextGemsToSpawn.length > 0) {
            return this.nextGemsToSpawn.shift();
        }
        return this._pickGemTypeBasedOnInfluenceOrRandom();
    }

    getSafeNextGemToSpawnType(colX, rowY, targetGrid) {
        let potentialTypes = [...GEM_TYPES];
        potentialTypes.sort(() => 0.5 - Math.random());

        const habitatPreferred = this._pickNextRawGemToSpawn();

        if (potentialTypes.includes(habitatPreferred)) {
            potentialTypes = [habitatPreferred, ...potentialTypes.filter(t => t !== habitatPreferred)];
        } else {
            potentialTypes.unshift(habitatPreferred);
        }

        for (const tryType of potentialTypes) {
            const gemBelow1 = targetGrid[colX]?.[rowY + 1]?.gemType;
            const gemBelow2 = targetGrid[colX]?.[rowY + 2]?.gemType;

            if (!(gemBelow1 === tryType && gemBelow2 === tryType)) {
                return tryType;
            }
        }

        console.warn(`getSafeNextGemToSpawnType: Could not avoid vertical match for new gem at [${colX},${rowY}]. Returning ${potentialTypes[0]}.`);
        return potentialTypes[0];
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
                        typesForCol.push(this._pickNextRawGemToSpawn());
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

    applyExplodeAndReplacePhase(phase) {
        if (phase.isNothingToDo()) return;

        const explodeCoords = new Set();
        phase.matches.forEach(match => match.forEach(coord => explodeCoords.add(`${coord[0]},${coord[1]}`)));

        const replacementCounts = new Map(phase.replacements.map(([col, types]) => [col, types.length]));

        const newGrid = [];
        for (let x = 0; x < this.width; x++) {
            newGrid[x] = new Array(this.height).fill(null);

            const survivingGemsInCol = [];
            if (this.puzzleState[x]) {
                for (let y = this.height - 1; y >= 0; y--) {
                    if (!explodeCoords.has(`${x},${y}`) && this.puzzleState[x][y]) {
                        survivingGemsInCol.push(this.puzzleState[x][y]);
                    }
                }
            }

            for (let i = 0; i < survivingGemsInCol.length; i++) {
                const targetY = this.height - 1 - i;
                if (targetY >= 0) {
                    newGrid[x][targetY] = survivingGemsInCol[i];
                }
            }

            const numNewGemsNeeded = replacementCounts.get(x) || 0;
            for (let i = 0; i < numNewGemsNeeded; i++) {
                let currentYFillingFromTop = -1;
                for (let k = 0; k < this.height; k++) {
                    if (newGrid[x][k] === null) {
                        currentYFillingFromTop = k;
                        break;
                    }
                }

                if (currentYFillingFromTop !== -1 && currentYFillingFromTop < this.height) {
                    const safeGemType = this.getSafeNextGemToSpawnType(x, currentYFillingFromTop, newGrid);
                    newGrid[x][currentYFillingFromTop] = { gemType: safeGemType };
                } else if (currentYFillingFromTop !== -1) {
                    console.error(`Backend Error: Column ${x} overflow during safe gem replacement. Attempted to fill at ${currentYFillingFromTop}.`);
                    break;
                } else {
                    console.error(`Backend Error: Column ${x} is unexpectedly full but ${numNewGemsNeeded - i} gems still need to be placed.`);
                    break;
                }
            }

            for (let y = 0; y < this.height; y++) {
                if (!newGrid[x][y]) {
                    console.warn(`BackendPuzzle Warning: Cell [${x},${y}] is null after replacement and new gem filling. Attempting to fill safely.`);
                    const safeGemType = this.getSafeNextGemToSpawnType(x, y, newGrid);
                    newGrid[x][y] = { gemType: safeGemType };
                }
            }
        }
        this.puzzleState = newGrid;
    }

    addNextGemToSpawn(gemType) {
        this.nextGemsToSpawn.push(gemType);
    }

    addNextGemsToSpawn(gemTypes) {
        this.nextGemsToSpawn.push(...gemTypes);
    }

    reset() {
        this.currentHabitatInfluence = null;
        this.puzzleState = this.getInitialPuzzleStateWithNoMatches(this.width, this.height);
        this.nextGemsToSpawn = [];
        console.log("BackendPuzzle reset: habitat influence cleared, new random board generated.");
    }

    applyMoveToGrid(grid, moveAction) {
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
        } else {
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
        const matches = [];
        if (!puzzleState || this.width === 0 || this.height === 0) return matches;
        const getGemType = (x, y) => puzzleState[x]?.[y]?.gemType;

        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height - 2;) {
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
            for (let x = 0; x < this.width - 2;) {
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
}