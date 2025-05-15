// src/game/scenes/Game.js
import Phaser from 'phaser';
import { BackendPuzzle } from '../BackendPuzzle'; // Ensure this path is correct
import { MoveAction } from '../MoveAction';     // Ensure this path is correct
import { BoardView } from '../BoardView';       // Ensure this path is correct
import {
    GRID_COLS, GRID_ROWS, AssetKeys,
    DRAG_THRESHOLD, MOVE_THRESHOLD
} from '../constants'; // Ensure this path is correct
import { EventBus } from '../EventBus';

export class Game extends Phaser.Scene {

    // --- MVC Components ---
    /** @type {BackendPuzzle | null} */
    backendPuzzle = null;
    /** @type {BoardView | null} */
    boardView = null;

    // --- Controller State ---
    /** @type {boolean} */
    canMove = false; // Start false, true after board init
    /** @type {boolean} */
    isDragging = false;
    /** @type {number} */
    dragStartX = 0;
    /** @type {number} */
    dragStartY = 0;
    /** @type {'row' | 'col' | null} */
    dragDirection = null;
    /** @type {number} */
    dragStartPointerX = 0;
    /** @type {number} */
    dragStartPointerY = 0;
    /** @type {Array<Phaser.GameObjects.Sprite>} */
    draggingSprites = [];
    /** @type {Array<{x: number, y: number, gridX: number, gridY: number}>} */
    dragStartSpritePositions = [];

    // --- Layout ---
    /** @type {number} */
    gemSize = 64;
    /** @type {{x: number, y: number}} */
    boardOffset = { x: 0, y: 0 };

    // --- Backend Data ---
    /** @type {number[] | null} */
    currentHabitatValues = null;
    /** @type {string[] | null} */
    currentSpeciesNames = null;
    /** @type {boolean} */
    isBoardInitialized = false;
    /** @type {Phaser.GameObjects.Text | null} */
    statusText = null;

    constructor() {
        super('Game');
    }

    create() {
        console.log("Game Scene: create");
        const { width, height } = this.scale;

        if (this.textures.exists(AssetKeys.BACKGROUND)) {
            this.add.image(width / 2, height / 2, AssetKeys.BACKGROUND).setOrigin(0.5).setAlpha(0.5);
        } else {
            this.cameras.main.setBackgroundColor('#1a1a2e');
        }

        if (typeof BackendPuzzle === 'undefined' || typeof MoveAction === 'undefined' || typeof BoardView === 'undefined') {
             this.add.text(width / 2, height / 2, `Error: Game logic missing.\nCheck console.`, { color: '#ff0000', fontSize: '20px' }).setOrigin(0.5);
             return;
        }

        this.statusText = this.add.text(width / 2, height / 2, "Waiting for location selection from map...",
            { fontSize: '20px', color: '#ffffff', backgroundColor: '#000000aa', padding: { x: 10, y: 5 }, align: 'center' }
        ).setOrigin(0.5).setDepth(100);

        // Initialize BackendPuzzle and BoardView, but board visuals are created later
        this.backendPuzzle = new BackendPuzzle(GRID_COLS, GRID_ROWS);
        this.calculateBoardDimensions();
        this.boardView = new BoardView(this, {
            cols: GRID_COLS, rows: GRID_ROWS,
            gemSize: this.gemSize, boardOffset: this.boardOffset
        });

        this.input.addPointer(1);
        this.disableTouchScrolling();
        this.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this);
        this.input.on(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove, this);
        this.input.on(Phaser.Input.Events.POINTER_UP, this.handlePointerUp, this);
        this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerUp, this);
        this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
        EventBus.on('cesium-location-selected', this.initializeBoardFromCesium, this);

        this.resetDragState(); // Resets isDragging etc.
        this.canMove = false; // Input disabled until board initialized by Cesium
        this.isBoardInitialized = false;

        EventBus.emit('current-scene-ready', this);
        console.log("Game Scene: Create method finished. Waiting for Cesium data.");
    }

    initializeBoardFromCesium(data) {
        console.log("Game Scene: Received 'cesium-location-selected' data:", data);
        this.canMove = false; // Disable moves during reinitialization
        this.isBoardInitialized = false; // Mark as not ready
        const { width, height } = this.scale;

        if (this.statusText && this.statusText.active) {
            this.statusText.setText("Initializing game board with map data...");
        }

        try {
            if (!data || !data.habitats) {
                throw new Error("Received incomplete data from CesiumMap for board initialization.");
            }
            this.currentHabitatValues = data.habitats || [];
            this.currentSpeciesNames = data.species || [];

            if (!this.backendPuzzle) { // Should exist from create()
                this.backendPuzzle = new BackendPuzzle(GRID_COLS, GRID_ROWS);
            }
            // The setHabitatInfluence in BackendPuzzle already regenerates the puzzleState
            if (this.backendPuzzle.setHabitatInfluence) {
                this.backendPuzzle.setHabitatInfluence(this.currentHabitatValues);
            } else {
                console.warn("BackendPuzzle does not have setHabitatInfluence. Board might not reflect habitat.");
                 // If no setHabitatInfluence, we still need a board.
                 // Ensure puzzleState is generated (constructor does this, or call reset if needed)
                 if (!this.backendPuzzle.getGridState()) {
                    this.backendPuzzle.reset(); // Fallback to ensure puzzleState exists
                 }
            }

            this.calculateBoardDimensions(); // Recalculate for current scale
            if (!this.boardView) { // Should exist from create()
                 this.boardView = new BoardView(this, {
                    cols: GRID_COLS, rows: GRID_ROWS,
                    gemSize: this.gemSize, boardOffset: this.boardOffset
                });
            } else {
                // Ensure boardView is updated with current dimensions
                this.boardView.updateVisualLayout(this.gemSize, this.boardOffset);
            }

            // Destroy old board sprites and create new ones based on the (potentially new) backendPuzzle state
            if (this.boardView.destroyBoard) this.boardView.destroyBoard();
            this.boardView.createBoard(this.backendPuzzle.getGridState());

            if (this.statusText && this.statusText.active) {
                this.statusText.destroy(); this.statusText = null;
            }
            this.isBoardInitialized = true;
            this.canMove = true; // Board is ready, enable input
            console.log("Game Scene: Board initialized/updated from Cesium data. Input enabled.");

        } catch (error) {
            console.error("Game Scene: Error initializing board from Cesium data:", error);
            if (this.statusText && this.statusText.active) this.statusText.destroy();
            this.statusText = this.add.text(width / 2, height / 2, `Error initializing board:\n${error.message}`, {
                fontSize: '18px', color: '#ff4444', backgroundColor: '#000000cc',
                align: 'center', padding: {x: 10, y: 5}, wordWrap: { width: width * 0.8 }
            }).setOrigin(0.5).setDepth(100);
            this.canMove = false;
            this.isBoardInitialized = false;
        }
    }

    calculateBoardDimensions() {
        const { width, height } = this.scale;
        if (width <= 0 || height <= 0) { console.warn("Invalid scale dimensions."); return; }
        const usableWidth = width * 0.95;
        const usableHeight = height * 0.90;
        const sizeFromWidth = Math.floor(usableWidth / GRID_COLS);
        const sizeFromHeight = Math.floor(usableHeight / GRID_ROWS);
        this.gemSize = Math.max(24, Math.min(sizeFromWidth, sizeFromHeight));
        const boardWidth = GRID_COLS * this.gemSize;
        const boardHeight = GRID_ROWS * this.gemSize;
        this.boardOffset = {
            x: Math.round((width - boardWidth) / 2),
            y: Math.round((height - boardHeight) / 2)
        };
    }

    handleResize() {
        console.log("Game Scene: Resize detected.");
        this.calculateBoardDimensions();
        if (this.statusText && this.statusText.active) {
             this.statusText.setPosition(this.scale.width / 2, this.scale.height / 2);
             const textStyle = this.statusText.style;
             if (textStyle.wordWrapWidth) { // Check if property exists before setting
                this.statusText.style.setWordWrapWidth(this.scale.width * 0.8);
             }
        }
        if (this.boardView) {
            this.boardView.updateVisualLayout(this.gemSize, this.boardOffset);
        }
    }

    handlePointerDown(pointer) {
        if (!this.canMove || !this.isBoardInitialized || !this.boardView || !this.backendPuzzle) return;
        if (this.isDragging) { // Should not happen if logic is correct, but as a safeguard
            console.warn("PointerDown while already dragging. Resetting drag state.");
            this.resetDragState(); // Reset internal flags
             // Visually snap back any lingering sprites from a broken drag state
            if (this.boardView && this.draggingSprites.length > 0) {
                 this.boardView.snapBack(this.draggingSprites, this.dragStartSpritePositions)
                    .catch(e => console.error("Error snapping back during PointerDown reset:", e));
            }
            this.draggingSprites = []; // Ensure these are clear
            this.dragStartSpritePositions = [];
        }

        const worldX = pointer.x;
        const worldY = pointer.y;
        const boardRect = new Phaser.Geom.Rectangle(
            this.boardOffset.x, this.boardOffset.y,
            GRID_COLS * this.gemSize, GRID_ROWS * this.gemSize
        );

        if (!boardRect.contains(worldX, worldY)) return;

        const gridX = Math.floor((worldX - this.boardOffset.x) / this.gemSize);
        const gridY = Math.floor((worldY - this.boardOffset.y) / this.gemSize);

        this.dragStartX = Phaser.Math.Clamp(gridX, 0, GRID_COLS - 1);
        this.dragStartY = Phaser.Math.Clamp(gridY, 0, GRID_ROWS - 1);
        this.dragStartPointerX = worldX;
        this.dragStartPointerY = worldY;
        this.isDragging = true; // Set drag flag
        this.dragDirection = null;
        // IMPORTANT: Initialize these here for the new drag operation
        this.draggingSprites = [];
        this.dragStartSpritePositions = [];
    }

    handlePointerMove(pointer) {
        if (!this.isDragging || !this.canMove || !this.isBoardInitialized || !this.boardView) return;
        if (!pointer.isDown) {
            this.handlePointerUp(pointer); // Treat as pointer up if button released
            return;
        }

        const worldX = pointer.x;
        const worldY = pointer.y;
        const deltaX = worldX - this.dragStartPointerX;
        const deltaY = worldY - this.dragStartPointerY;

        if (!this.dragDirection && (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD)) {
            this.dragDirection = Math.abs(deltaX) > Math.abs(deltaY) ? 'row' : 'col';
            const allSprites = this.boardView.getGemsSprites();
            if (!allSprites) { this.cancelDrag("BoardView sprites unavailable"); return; }

            const index = (this.dragDirection === 'row') ? this.dragStartY : this.dragStartX;
            const limit = (this.dragDirection === 'row') ? GRID_COLS : GRID_ROWS;

            // Clear and repopulate for this drag action
            this.draggingSprites = [];
            this.dragStartSpritePositions = [];

            for (let i = 0; i < limit; i++) {
                const x = (this.dragDirection === 'row') ? i : index;
                const y = (this.dragDirection === 'row') ? index : i;
                const sprite = allSprites[x]?.[y];
                if (sprite && sprite.active) {
                    this.draggingSprites.push(sprite);
                    this.dragStartSpritePositions.push({ x: sprite.x, y: sprite.y, gridX: x, gridY: y });
                    this.tweens.killTweensOf(sprite);
                }
            }
            if (this.draggingSprites.length === 0) { this.cancelDrag("No sprites in dragged line"); return; }
        }

        if (this.dragDirection) {
            this.boardView.moveDraggingSprites(
                this.draggingSprites, this.dragStartSpritePositions, deltaX, deltaY, this.dragDirection
            );
        }
    }

    async handlePointerUp(pointer) {
        // Store these values *before* calling resetDragState or any async operation
        const wasDragging = this.isDragging;
        const currentDragDirection = this.dragDirection;
        const dSprites = [...this.draggingSprites]; // Critical: Copy before resetDragState clears them
        const dStartPositions = [...this.dragStartSpritePositions]; // Critical: Copy
        const sPointerX = this.dragStartPointerX;
        const sPointerY = this.dragStartPointerY;
        const sGridX = this.dragStartX;
        const sGridY = this.dragStartY;

        if (!wasDragging) { // If not dragging (e.g. just a click, or already processed)
            this.resetDragState(); // Still reset to be safe
            return;
        }

        // Reset drag state flags immediately. Visuals handled based on match outcome.
        this.resetDragState();

        if (!this.canMove || !this.isBoardInitialized || !this.boardView || !this.backendPuzzle) {
            console.warn("PointerUp: Conditions not met (canMove, board not ready, etc.).");
            // If sprites were collected, attempt to snap them back
            if (dSprites.length > 0 && this.boardView) {
                await this.boardView.snapBack(dSprites, dStartPositions);
            }
            return; // Do not proceed further
        }

        if (!currentDragDirection || dSprites.length === 0) {
            console.log("Pointer up: No valid drag determined or no sprites collected.");
             // If sprites were visually moved slightly but no dragDirection locked, snap them back.
            if (dSprites.length > 0 && this.boardView) {
                 await this.boardView.snapBack(dSprites, dStartPositions);
            }
            return;
        }

        this.canMove = false; // Disable input for processing the move

        const worldX = pointer.x;
        const worldY = pointer.y;
        const deltaX = worldX - sPointerX;
        const deltaY = worldY - sPointerY;

        const moveAction = this.calculateMoveAction(deltaX, deltaY, currentDragDirection, sGridX, sGridY);

        try {
            if (moveAction.amount === 0) {
                console.log("Pointer up: No logical move threshold met, snapping back.");
                await this.boardView.snapBack(dSprites, dStartPositions);
            } else {
                const hypotheticalMatches = this.backendPuzzle.getMatchesFromHypotheticalMove(moveAction);

                if (hypotheticalMatches && hypotheticalMatches.length > 0) {
                    console.log(`Pointer up: Committing move (Matches found)`);
                    this.boardView.updateGemsSpritesArrayAfterMove(moveAction);
                    this.boardView.snapDraggedGemsToFinalGridPositions();
                    await this.applyMoveAndHandleResults(moveAction);
                } else {
                    console.log(`Pointer up: Move resulted in NO matches. Snapping back.`);
                    await this.boardView.snapBack(dSprites, dStartPositions);
                }
            }
        } catch (error) {
            console.error("Error processing pointer up:", error);
            if (dSprites.length > 0 && this.boardView) {
                 await this.boardView.snapBack(dSprites, dStartPositions); // Snap back on error
            }
            if (this.boardView && this.backendPuzzle) {
                this.boardView.syncSpritesToGridPositions(this.backendPuzzle.getGridState());
            }
        } finally {
            this.canMove = true;
        }
    }

    async applyMoveAndHandleResults(moveAction) {
        if (!this.backendPuzzle || !this.boardView) return;
        const phaseResult = this.backendPuzzle.getNextExplodeAndReplacePhase([moveAction]); // This applies the move
        if (!phaseResult.isNothingToDo()) {
            await this.animatePhase(phaseResult);
            await this.handleCascades();
        } else {
            // This case should be rare now due to the pre-check, but if the backend's
            // own match finding after applying the move differs, we log it.
            // The board is already visually in the new (non-matching) state from snapDraggedGemsToFinalGridPositions.
            // But backendPuzzle's state *has* been changed by getNextExplodeAndReplacePhase.
            // If this happens, it means the hypothetical check was wrong, or there's a subtle bug.
            // For "snap back on no match", this path implies the hypothetical check was positive,
            // but the actual application yielded no matches.
            console.warn("applyMoveAndHandleResults: Move was applied, but backend reports no matches. This might be a logic discrepancy.");
            // At this point, the view's sprite array and visual positions match the
            // *new* state of the backendPuzzle. If the backendPuzzle is truly in a non-matching state,
            // then visually everything is consistent, even if no explosion happened.
            // No snap back is needed here because we *committed* the move.
        }
    }

    async handleCascades() {
        if (!this.backendPuzzle || !this.boardView) return;
        const cascadePhase = this.backendPuzzle.getNextExplodeAndReplacePhase([]);
        if (!cascadePhase.isNothingToDo()) {
            await this.animatePhase(cascadePhase);
            await this.handleCascades();
        }
    }

    async animatePhase(phaseResult) {
         if (!this.boardView) return;
         try {
             await this.boardView.animateExplosions(phaseResult.matches.flat());
             await this.boardView.animateFalls(phaseResult.replacements, this.backendPuzzle.getGridState());
         } catch (error) {
              console.error("Error during phase animation:", error);
              if (this.boardView && this.backendPuzzle) {
                this.boardView.syncSpritesToGridPositions(this.backendPuzzle.getGridState());
              }
         }
    }

    resetDragState() {
        this.isDragging = false;
        this.dragDirection = null;
        this.draggingSprites = []; // Ensure these are cleared
        this.dragStartSpritePositions = []; // Ensure these are cleared
        // dragStartX, Y, etc., are fine to be overwritten on next POINTER_DOWN
    }

    cancelDrag(reason = "Cancelled") {
        console.warn(`Drag cancelled: ${reason}`);
        if (this.boardView && this.draggingSprites.length > 0 && this.dragStartSpritePositions.length > 0) {
            this.boardView.snapBack(this.draggingSprites, this.dragStartSpritePositions)
                .catch(err => console.error("Error snapping back on cancel:", err));
        }
        this.resetDragState();
        if(this.isBoardInitialized) this.canMove = true;
    }

    calculateMoveAction(deltaX, deltaY, direction, startGridX, startGridY) {
        let cellsMoved = 0;
        let index = 0;
        if (direction === 'row') {
            cellsMoved = deltaX / this.gemSize;
            index = startGridY;
        } else { // 'col'
            cellsMoved = deltaY / this.gemSize;
            index = startGridX;
        }
        let amount = 0;
        if (Math.abs(cellsMoved) >= MOVE_THRESHOLD) {
            amount = Math.round(cellsMoved);
        }
        // Clamping amount might be useful if backend doesn't handle excessive shifts well,
        // but BackendPuzzle.applyMoveToGrid should handle wrapping.
        // const limit = (direction === 'row') ? GRID_COLS : GRID_ROWS;
        // amount = Phaser.Math.Clamp(amount, -(limit - 1), limit - 1);
        return new MoveAction(direction, index, amount);
    }

    disableTouchScrolling() { /* ... same ... */
        if (this.game.canvas) {
             this.game.canvas.style.touchAction = 'none';
             const opts = { passive: false };
             const preventDefault = e => e.preventDefault();
             this.game.canvas.addEventListener('touchstart', preventDefault, opts);
             this.game.canvas.addEventListener('touchmove', preventDefault, opts);
             this._touchPreventDefaults = preventDefault;
        }
    }
    enableTouchScrolling() { /* ... same ... */
        if (this.game.canvas) {
            this.game.canvas.style.touchAction = 'auto';
             if (this._touchPreventDefaults) {
                 this.game.canvas.removeEventListener('touchstart', this._touchPreventDefaults);
                 this.game.canvas.removeEventListener('touchmove', this._touchPreventDefaults);
                 this._touchPreventDefaults = null;
             }
        }
    }

    shutdown() {
        console.log("Game Scene: Shutting down...");
        EventBus.off('cesium-location-selected', this.initializeBoardFromCesium, this);
        this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
        this.input.removeAllListeners(Phaser.Input.Events.POINTER_DOWN); // More robust
        this.input.removeAllListeners(Phaser.Input.Events.POINTER_MOVE);
        this.input.removeAllListeners(Phaser.Input.Events.POINTER_UP);
        this.input.removeAllListeners(Phaser.Input.Events.POINTER_UP_OUTSIDE);
        this.enableTouchScrolling();

        if (this.boardView) { this.boardView.destroyBoard(); this.boardView = null; }
        this.backendPuzzle = null;
        if (this.statusText) { this.statusText.destroy(); this.statusText = null; }

        this.resetDragState(); // Clear drag state variables
        this.canMove = false;
        this.isBoardInitialized = false;
        this.currentHabitatValues = null;
        this.currentSpeciesNames = null;
        console.log("Game Scene: Shutdown complete.");
    }

    verifyBoardState() { /* ... same ... */
         if (!this.backendPuzzle || !this.boardView) return;
         const modelState = this.backendPuzzle.getGridState();
         const viewSprites = this.boardView.getGemsSprites();
         let mismatches = 0;
         for (let x = 0; x < GRID_COLS; x++) {
             for (let y = 0; y < GRID_ROWS; y++) {
                 const modelGem = modelState[x]?.[y];
                 const viewSprite = viewSprites[x]?.[y];
                 if (!modelGem && viewSprite && viewSprite.active) {
                     console.warn(`Verify Mismatch: View sprite at [${x},${y}], Model empty.`); mismatches++;
                 } else if (modelGem && (!viewSprite || !viewSprite.active)) {
                     console.warn(`Verify Mismatch: Model gem '${modelGem.gemType}' at [${x},${y}], View no active sprite.`); mismatches++;
                 } else if (modelGem && viewSprite && viewSprite.active) {
                      if (viewSprite.getData('gemType') !== modelGem.gemType) {
                          console.warn(`Verify Mismatch: Type diff at [${x},${y}]. M: ${modelGem.gemType}, V: ${viewSprite.getData('gemType')}`); mismatches++;
                      }
                      if (viewSprite.getData('gridX') !== x || viewSprite.getData('gridY') !== y) {
                           console.warn(`Verify Mismatch: Sprite at [${x},${y}] thinks its pos is [${viewSprite.getData('gridX')},${viewSprite.getData('gridY')}]`); mismatches++;
                      }
                 }
             }
         }
          if (mismatches === 0) console.log("Verify Board State: OK.");
          else console.error(`Verify Board State: Found ${mismatches} Mismatches!`);
     }
}