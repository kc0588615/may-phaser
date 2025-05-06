// src/game/BoardView.js
// View: Manages the visual representation (Phaser Sprites) and animations.

import Phaser from 'phaser';
import {
    AssetKeys,
    TWEEN_DURATION_EXPLODE, TWEEN_DURATION_FALL_BASE, TWEEN_DURATION_FALL_PER_UNIT,
    TWEEN_DURATION_FALL_MAX, TWEEN_DURATION_SNAP, TWEEN_DURATION_LAYOUT_UPDATE
} from './constants'; // Corrected path

export class BoardView {
    /** @type {Phaser.Scene} */
    scene;
    /** @type {number} */
    gridCols;
    /** @type {number} */
    gridRows;
    /** @type {number} */
    gemSize;
    /** @type {{x: number, y: number}} */
    boardOffset;
    /** @type {Array<Array<Phaser.GameObjects.Sprite | null>>} */
    gemsSprites = []; // The 2D array [x][y] mirroring the logical grid
    /** @type {Phaser.GameObjects.Group} */
    gemGroup; // Group for efficient management

    /**
     * @param {Phaser.Scene} scene The parent scene (Game.js).
     * @param {object} config Contains cols, rows, gemSize, boardOffset.
     */
    constructor(scene, config) {
        if (!scene || !(scene instanceof Phaser.Scene)) {
            throw new Error("BoardView requires a valid Phaser.Scene instance.");
        }
        this.scene = scene;
        this.gridCols = config.cols;
        this.gridRows = config.rows;
        this.gemSize = config.gemSize;
        this.boardOffset = config.boardOffset;
        this.gemGroup = this.scene.add.group();
        console.log("BoardView initialized");
    }

    // --- Public Methods (Called by Controller: Game.js) ---

    /** Creates the initial sprites based on the model state. */
    createBoard(initialPuzzleState) {
        console.log("BoardView: Creating board visuals...");
        this.destroyBoard(); // Clear any previous board
        this.gemsSprites = [];

        if (!initialPuzzleState) {
             console.error("BoardView: Cannot create board without initial puzzle state.");
             return;
        }

        for (let x = 0; x < this.gridCols; x++) {
            this.gemsSprites[x] = new Array(this.gridRows).fill(null);
             if (!initialPuzzleState[x]) {
                 console.error(`BoardView: Initial puzzle state missing column ${x}.`);
                 continue;
             }
            for (let y = 0; y < this.gridRows; y++) {
                const gemData = initialPuzzleState[x][y];
                if (gemData && gemData.gemType) {
                    this.createSprite(x, y, gemData.gemType);
                }
            }
        }
        console.log("BoardView: Board visuals created.");
    }

    /** Updates sprite positions and scales after resize/orientation change. */
    updateVisualLayout(newGemSize, newBoardOffset) {
        console.log("BoardView: Updating visual layout.");
        this.gemSize = newGemSize;
        this.boardOffset = newBoardOffset;

        this.iterateSprites((sprite, x, y) => {
            const targetPos = this.getSpritePosition(x, y);
            const newScale = this.calculateSpriteScale(sprite);

            this.scene.tweens.killTweensOf(sprite); // Stop existing movement
            this.scene.tweens.add({
                targets: sprite,
                x: targetPos.x,
                y: targetPos.y,
                scale: newScale,
                duration: TWEEN_DURATION_LAYOUT_UPDATE,
                ease: 'Linear' // 'Sine.easeInOut' is smoother
            });
        });
    }

    /** Visually moves sprites during drag, handling wrapping. */
    moveDraggingSprites(spritesToMove, startVisualPositions, deltaX, deltaY, direction) {
        if (!spritesToMove || spritesToMove.length === 0 || !startVisualPositions) return;

        spritesToMove.forEach((sprite, i) => {
            if (!sprite || !sprite.active || !startVisualPositions[i]) return;

            const startPos = startVisualPositions[i]; // The initial *visual* position
            let targetX = startPos.x;
            let targetY = startPos.y;

            if (direction === 'row') {
                const totalBoardWidth = this.gridCols * this.gemSize;
                const minX = this.boardOffset.x - this.gemSize / 2; // Left edge of the wrap zone
                const maxX = minX + totalBoardWidth;                 // Right edge (exclusive) of the wrap zone
                targetX = startPos.x + deltaX;
                sprite.x = Phaser.Math.Wrap(targetX, minX, maxX); // Wrap visual position
            } else { // 'col'
                const totalBoardHeight = this.gridRows * this.gemSize;
                const minY = this.boardOffset.y - this.gemSize / 2; // Top edge
                const maxY = minY + totalBoardHeight;                // Bottom edge (exclusive)
                targetY = startPos.y + deltaY;
                sprite.y = Phaser.Math.Wrap(targetY, minY, maxY); // Wrap visual position
            }
        });
    }

    /** Instantly sets dragged sprites to their final grid positions. Assumes gemsSprites array is already updated. */
    snapDraggedGemsToFinalGridPositions() {
        console.log("BoardView: Snapping dragged gems visually.");
        this.iterateSprites((sprite, x, y) => {
            const targetPos = this.getSpritePosition(x, y);
            this.scene.tweens.killTweensOf(sprite);
            sprite.setPosition(targetPos.x, targetPos.y);
            sprite.setScale(this.calculateSpriteScale(sprite)); // Ensure correct scale
            // Ensure logical data matches visual array position
            sprite.setData('gridX', x);
            sprite.setData('gridY', y);
        });
    }

    /** Animates sprites back to their original start positions. */
    snapBack(spritesToSnap, startPositions) {
        console.log("BoardView: Starting snap back animation...");
        return new Promise((resolve) => {
            if (!spritesToSnap || spritesToSnap.length === 0 || !startPositions) {
                resolve(); return;
            }

            const snapPromises = spritesToSnap.map((sprite, i) => {
                const startPosData = startPositions[i]; // Contains visual x/y and logical gridX/gridY
                if (sprite && sprite.active && startPosData) {
                    return new Promise((resolveSnap) => {
                        // Reset logical grid coords just in case
                        sprite.setData('gridX', startPosData.gridX);
                        sprite.setData('gridY', startPosData.gridY);

                        this.scene.tweens.killTweensOf(sprite);
                        this.scene.tweens.add({
                            targets: sprite,
                            x: startPosData.x, // Target original visual X
                            y: startPosData.y, // Target original visual Y
                            duration: TWEEN_DURATION_SNAP,
                            ease: 'Quad.easeOut',
                            onComplete: () => {
                                sprite.setPosition(startPosData.x, startPosData.y);
                                resolveSnap();
                            }
                        });
                    });
                }
                return Promise.resolve(); // Skip invalid sprites
            });

            Promise.all(snapPromises)
                .then(() => { console.log("BoardView: Snap back complete."); resolve(); })
                .catch(error => { console.error("BoardView: Error during snap back:", error); resolve(); });
        });
    }

    /** Animates gem explosions. Removes sprites from grid and destroys them. */
    animateExplosions(matchCoords) {
        console.log(`BoardView: Animating ${matchCoords.length} explosions.`);
        return new Promise((resolve) => {
            if (!matchCoords || matchCoords.length === 0) { resolve(); return; }

            const explosionPromises = [];
            const explodedCoordsSet = new Set(); // Prevent double animation

            matchCoords.forEach(([x, y]) => {
                const coordKey = `${x},${y}`;
                if (explodedCoordsSet.has(coordKey)) return;

                const sprite = this.getSpriteAt(x, y);
                if (sprite) {
                    explodedCoordsSet.add(coordKey);
                    this.gemsSprites[x][y] = null; // Remove reference immediately

                    explosionPromises.push(new Promise((resolveExplosion) => {
                        this.scene.tweens.killTweensOf(sprite);
                        this.scene.tweens.add({
                            targets: sprite,
                            alpha: 0,
                            scale: sprite.scale * 0.5,
                            angle: Phaser.Math.RND.angle(), // Random spin
                            duration: TWEEN_DURATION_EXPLODE,
                            ease: 'Quad.easeOut', // 'Expo.easeOut' is faster
                            onComplete: () => {
                                this.safelyDestroySprite(sprite); // Remove from group & destroy
                                resolveExplosion();
                            }
                        });
                    }));
                }
            });

            Promise.all(explosionPromises)
                .then(() => { console.log("BoardView: Explosions complete."); resolve(); })
                .catch(error => { console.error("BoardView: Error during explosions:", error); resolve(); });
        });
    }

    /** Animates existing gems falling and new gems entering. Updates gemsSprites array. */
    animateFalls(replacements, finalBackendState) {
        console.log("BoardView: Animating falls...");
        return new Promise((resolve) => {
            const fallPromises = [];
            const newGrid = []; // Stores the final configuration of sprites
            const spritesToAnimate = []; // { sprite, targetY }

            // 1. Initialize newGrid structure
            for (let x = 0; x < this.gridCols; x++) {
                newGrid[x] = new Array(this.gridRows).fill(null);
            }

            // 2. Place surviving sprites into their final slots in newGrid (bottom-up)
            for (let x = 0; x < this.gridCols; x++) {
                let targetY = this.gridRows - 1; // Start checking from the bottom row
                // Iterate current visual grid from bottom up
                for (let y = this.gridRows - 1; y >= 0; y--) {
                    const sprite = this.getSpriteAt(x, y);
                    if (sprite) {
                         // This sprite survived, find its target slot
                         if (targetY >= 0) {
                             newGrid[x][targetY] = sprite; // Place in new grid config
                             sprite.setData('gridX', x);   // Update logical coords stored on sprite
                             sprite.setData('gridY', targetY);
                             spritesToAnimate.push({ sprite, targetGridY: targetY });
                             targetY--; // Move to the next slot up
                         } else {
                              console.error(`BoardView Error: No slot for surviving sprite from [${x},${y}]`);
                              this.safelyDestroySprite(sprite);
                         }
                    }
                }
            }

            // 3. Create new sprites for replacements and place them in empty slots (top-down)
            const replacementMap = new Map(replacements); // colIndex -> [types]
            for (let x = 0; x < this.gridCols; x++) {
                const typesToSpawn = replacementMap.get(x) || [];
                // New gems fill the highest available slots (lowest Y index)
                for (let i = 0; i < typesToSpawn.length; i++) {
                    let targetY = -1;
                     // Find the first null slot from the top in the newGrid config
                    for(let searchY = 0; searchY < this.gridRows; searchY++){
                        if(!newGrid[x][searchY]){
                            targetY = searchY;
                            break;
                        }
                    }

                    if (targetY !== -1) {
                        const gemType = typesToSpawn[i];
                        // Calculate start position above the board
                        const startVisualY = this.boardOffset.y - (i + 1) * this.gemSize - this.gemSize / 2;
                        const sprite = this.createSprite(x, targetY, gemType, startVisualY);

                        if (sprite) {
                            newGrid[x][targetY] = sprite; // Place in new grid config
                            spritesToAnimate.push({ sprite, targetGridY: targetY });
                        } else {
                             console.error(`BoardView Error: Failed to create replacement sprite at [${x},${targetY}]`);
                        }
                    } else {
                        console.error(`BoardView Error: No empty slot found for replacement gem in column ${x}`);
                    }
                }
            }

            // 4. Update the main gemsSprites reference
            this.gemsSprites = newGrid;

            // 5. Animate all sprites (survivors and new) to their final visual positions
            spritesToAnimate.forEach(({ sprite, targetGridY }) => {
                if (!sprite || !sprite.active) return;

                const targetPos = this.getSpritePosition(sprite.getData('gridX'), targetGridY);
                const currentY = sprite.y;

                // Skip animation if already visually in the correct place
                if (Math.round(currentY) === Math.round(targetPos.y) && Math.round(sprite.x) === Math.round(targetPos.x) && sprite.alpha === 1) {
                    sprite.setScale(this.calculateSpriteScale(sprite)); // Ensure scale
                    return;
                }

                const fallDistance = Math.abs(currentY - targetPos.y);
                const duration = Phaser.Math.Clamp(
                    TWEEN_DURATION_FALL_BASE + fallDistance * TWEEN_DURATION_FALL_PER_UNIT,
                    TWEEN_DURATION_FALL_BASE, // Min duration
                    TWEEN_DURATION_FALL_MAX   // Max duration
                );

                fallPromises.push(new Promise((resolveFall) => {
                    this.scene.tweens.killTweensOf(sprite);
                    this.scene.tweens.add({
                        targets: sprite,
                        x: targetPos.x,
                        y: targetPos.y,
                        alpha: 1, // Ensure visible
                        scale: this.calculateSpriteScale(sprite), // Ensure correct scale
                        duration: duration,
                        ease: 'Quad.easeOut', // 'Bounce.easeOut' or 'Cubic.easeOut' also good
                        onComplete: () => {
                            sprite.setPosition(targetPos.x, targetPos.y); // Final exact position
                            resolveFall();
                        }
                    });
                }));
            });

            if (fallPromises.length === 0) {
                console.log("BoardView: No fall animations needed.");
                resolve();
                return;
            }

            Promise.all(fallPromises)
                .then(() => { console.log("BoardView: Falls complete."); resolve(); })
                .catch(error => { console.error("BoardView: Error during falls:", error); resolve(); });
        });
    }

    /** Updates the internal gemsSprites array structure after a move. */
    updateGemsSpritesArrayAfterMove(moveAction) {
        // console.log("BoardView: Updating gemsSprites array structure."); // Less verbose
        const tempSprites = [];
        const { rowOrCol, index, amount } = moveAction;

        if (rowOrCol === 'row') {
            const y = index;
            if (y < 0 || y >= this.gridRows) return;
            const width = this.gridCols;
            const effectiveAmount = ((amount % width) + width) % width;
            if (effectiveAmount === 0) return;

            for (let x = 0; x < width; x++) tempSprites.push(this.gemsSprites[x]?.[y]);
            const shifted = [...tempSprites.slice(-effectiveAmount), ...tempSprites.slice(0, width - effectiveAmount)];
            for (let x = 0; x < width; x++) {
                if (this.gemsSprites[x]) {
                    const sprite = shifted[x];
                    this.gemsSprites[x][y] = sprite;
                    if (sprite) { // Update logical position stored on sprite
                        sprite.setData('gridX', x);
                        sprite.setData('gridY', y);
                    }
                }
            }
        } else { // col
            const x = index;
            if (x < 0 || x >= this.gridCols || !this.gemsSprites[x]) return;
            const height = this.gridRows;
            const effectiveAmount = ((amount % height) + height) % height;
            if (effectiveAmount === 0) return;

            const originalCol = this.gemsSprites[x];
            for (let y = 0; y < height; y++) tempSprites.push(originalCol[y]);
            const shifted = [...tempSprites.slice(height - effectiveAmount), ...tempSprites.slice(0, height - effectiveAmount)];
            for (let y = 0; y < height; y++) {
                 const sprite = shifted[y];
                 this.gemsSprites[x][y] = sprite;
                 if (sprite) { // Update logical position stored on sprite
                     sprite.setData('gridX', x);
                     sprite.setData('gridY', y);
                 }
            }
        }
    }

    /** Destroys all sprites and clears the board representation. */
    destroyBoard() {
        console.log("BoardView: Destroying board visuals...");
        this.gemGroup.clear(true, true); // Destroy children and remove them from group
        this.gemsSprites = [];
    }

    // --- Internal Helper Methods ---

    /** Safely destroys a sprite (if active) and removes from group. */
    safelyDestroySprite(sprite) {
        if (sprite && sprite.active) {
            // console.log(`Safely destroying sprite type ${sprite.getData('gemType')} at [${sprite.getData('gridX')}, ${sprite.getData('gridY')}]`);
            this.scene.tweens.killTweensOf(sprite);
            this.gemGroup.remove(sprite, true, true);
        }
    }

    /** Creates a single sprite, adds to group, stores data, places in gemsSprites array. */
    createSprite(gridX, gridY, gemType, startVisualY = undefined) {
        const textureKey = AssetKeys.GEM_TEXTURE(gemType, 0); // Default frame
        if (!this.scene.textures.exists(textureKey)) {
            console.error(`Texture missing: ${textureKey}`); return null;
        }

        const targetPos = this.getSpritePosition(gridX, gridY);
        const xPos = targetPos.x;
        const yPos = (startVisualY !== undefined) ? startVisualY : targetPos.y;

        // Add sprite via the group for automatic scene addition
        const sprite = this.gemGroup.create(xPos, yPos, textureKey);
        if (!sprite) { console.error(`Failed to create sprite ${textureKey}`); return null; }

        sprite.setOrigin(0.5);
        sprite.setData('gridX', gridX);
        sprite.setData('gridY', gridY);
        sprite.setData('gemType', gemType);
        sprite.setScale(this.calculateSpriteScale(sprite));
        sprite.setInteractive(); // Enable input detection ON the sprite (used by Scene)

        if (startVisualY !== undefined) {
            sprite.setAlpha(0); // Start invisible if spawning from above
        }

        // Store reference in the grid array (ensure column exists)
        if (this.gemsSprites[gridX]) {
            this.gemsSprites[gridX][gridY] = sprite;
        } else {
             console.error(`Column ${gridX} not initialized before creating sprite.`);
             this.safelyDestroySprite(sprite);
             return null;
        }
        return sprite;
    }

    /** Gets the sprite at [x, y] if active, otherwise null. */
    getSpriteAt(x, y) {
        const sprite = this.gemsSprites[x]?.[y];
        return (sprite && sprite.active) ? sprite : null;
    }

    /** Returns the 2D array of sprite references. */
    getGemsSprites() {
        return this.gemsSprites;
    }

    /** Calculates the center visual coordinate for a grid cell. */
    getSpritePosition(gridX, gridY) {
        return {
            x: Math.round(this.boardOffset.x + gridX * this.gemSize + this.gemSize / 2),
            y: Math.round(this.boardOffset.y + gridY * this.gemSize + this.gemSize / 2)
        };
    }

    /** Calculates the appropriate scale based on gemSize and texture width. */
    calculateSpriteScale(sprite) {
        if (!sprite || !sprite.width || sprite.width === 0) return 1;
        return (this.gemSize / sprite.width) * 0.9; // 90% of cell size
    }

    /** Helper to iterate over all active sprites in the grid. */
    iterateSprites(callback) {
        for (let x = 0; x < this.gemsSprites.length; x++) {
            if (!this.gemsSprites[x]) continue;
            for (let y = 0; y < this.gemsSprites[x].length; y++) {
                const sprite = this.gemsSprites[x][y];
                if (sprite && sprite.active) {
                    callback(sprite, x, y);
                }
            }
        }
    }
}
