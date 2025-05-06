import Phaser from 'phaser';
import { BackendPuzzle } from '../BackendPuzzle'; // Adjusted path
import { MoveAction } from '../MoveAction'; // Adjusted path
import { BoardView } from '../BoardView'; // Adjusted path
import {
    GRID_COLS, GRID_ROWS, AssetKeys,
    DRAG_THRESHOLD, MOVE_THRESHOLD
} from '../constants'; // Path is correct relative to scenes/

export class Game extends Phaser.Scene {

    // --- MVC Components ---
    /** @type {BackendPuzzle | null} */
    backendPuzzle = null;
    /** @type {BoardView | null} */
    boardView = null;

    // --- Controller State ---
    /** @type {boolean} */
    canMove = true;
    /** @type {boolean} */
    isDragging = false;
    /** @type {number} */
    dragStartX = 0; // Grid X where drag started
    /** @type {number} */
    dragStartY = 0; // Grid Y where drag started
    /** @type {'row' | 'col' | null} */
    dragDirection = null;
    /** @type {number} */
    dragStartPointerX = 0; // Screen X where pointer started
    /** @type {number} */
    dragStartPointerY = 0; // Screen Y where pointer started
    /** @type {Array<Phaser.GameObjects.Sprite>} */
    draggingSprites = []; // Sprites being visually moved
    /** @type {Array<{x: number, y: number, gridX: number, gridY: number}>} */
    dragStartSpritePositions = []; // Initial visual & logical pos of dragged sprites

    // --- Layout ---
    /** @type {number} */
    gemSize = 64;
    /** @type {{x: number, y: number}} */
    boardOffset = { x: 0, y: 0 };

    constructor() {
        super('Game');
    }

    create() {
        console.log("Game Scene: create");

        // Optional: Background Image
        const { width, height } = this.scale;
        // Check if background texture exists before adding
        if (this.textures.exists(AssetKeys.BACKGROUND)) {
            this.add.image(width / 2, height / 2, AssetKeys.BACKGROUND).setOrigin(0.5).setAlpha(0.5);
        } else {
            console.warn("Background texture not found in Game scene.");
            this.cameras.main.setBackgroundColor('#1a1a2e'); // Fallback color
        }


        // --- Initialize ---
        // Ensure BackendPuzzle, MoveAction, BoardView are available
        if (typeof BackendPuzzle === 'undefined' || typeof MoveAction === 'undefined' || typeof BoardView === 'undefined') {
            console.error("Error: Required game logic classes (BackendPuzzle, MoveAction, BoardView) not found. Make sure they are imported correctly and exist in src/game/");
            this.add.text(width / 2, height / 2, `Error: Game logic missing.
Check console.`, { color: '#ff0000', fontSize: '20px' }).setOrigin(0.5);
            return; // Stop creation if core components missing
        }

        this.backendPuzzle = new BackendPuzzle(GRID_COLS, GRID_ROWS);
        this.calculateBoardDimensions();
        this.boardView = new BoardView(this, {
            cols: GRID_COLS, rows: GRID_ROWS,
            gemSize: this.gemSize, boardOffset: this.boardOffset
        });
        this.boardView.createBoard(this.backendPuzzle.getGridState());

        // --- Setup Input ---
        this.input.addPointer(1); // Only need 1 pointer generally
        this.disableTouchScrolling(); // Prevent browser scrolling on canvas
        this.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this);
        this.input.on(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove, this);
        this.input.on(Phaser.Input.Events.POINTER_UP, this.handlePointerUp, this);
        this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerUp, this);

        // --- Setup Resize Listener ---
        this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);

        // --- Initial State ---
        this.resetDragState();
        this.canMove = true;

        console.log("Game Scene: Ready");
    }

    // --- Layout ---
    calculateBoardDimensions() {
        const { width, height } = this.scale;
        if (width <= 0 || height <= 0) { console.warn("Invalid scale dimensions."); return; }

        const usableWidth = width * 0.95; // Use more screen space
        const usableHeight = height * 0.90; // Leave space top/bottom for UI?

        const sizeFromWidth = Math.floor(usableWidth / GRID_COLS);
        const sizeFromHeight = Math.floor(usableHeight / GRID_ROWS);
        this.gemSize = Math.max(24, Math.min(sizeFromWidth, sizeFromHeight)); // Min size 24

        const boardWidth = GRID_COLS * this.gemSize;
        const boardHeight = GRID_ROWS * this.gemSize;
        this.boardOffset = {
            x: Math.round((width - boardWidth) / 2),
            y: Math.round((height - boardHeight) / 2)
        };
        console.log(`Layout: GemSize=${this.gemSize}, Offset=(${this.boardOffset.x}, ${this.boardOffset.y})`);
    }

    handleResize() {
        console.log("Game Scene: Resize detected.");
        this.calculateBoardDimensions();
        if (this.boardView) {
            this.boardView.updateVisualLayout(this.gemSize, this.boardOffset);
        }
         // Optional: Reposition other UI elements if needed
    }

    // --- Input Handling ---
    handlePointerDown(pointer) {
        if (!this.canMove || !this.boardView || !this.backendPuzzle) return;

        const worldX = pointer.x;
        const worldY = pointer.y;

        const boardRect = new Phaser.Geom.Rectangle(
            this.boardOffset.x, this.boardOffset.y,
            GRID_COLS * this.gemSize, GRID_ROWS * this.gemSize
        );

        if (!boardRect.contains(worldX, worldY)) return; // Click outside board

        const gridX = Math.floor((worldX - this.boardOffset.x) / this.gemSize);
        const gridY = Math.floor((worldY - this.boardOffset.y) / this.gemSize);

        // Clamp grid coordinates to be within bounds
        this.dragStartX = Phaser.Math.Clamp(gridX, 0, GRID_COLS - 1);
        this.dragStartY = Phaser.Math.Clamp(gridY, 0, GRID_ROWS - 1);
        this.dragStartPointerX = worldX;
        this.dragStartPointerY = worldY;
        this.isDragging = true;
        this.dragDirection = null;
        this.draggingSprites = [];
        this.dragStartSpritePositions = [];

        // console.log(`Pointer down at grid [${this.dragStartX}, ${this.dragStartY}]`);
    }

    handlePointerMove(pointer) {
        if (!this.isDragging || !this.canMove || !this.boardView) return;
        if (!pointer.isDown) { this.handlePointerUp(pointer); return; } // Handle mouse up outside

        const worldX = pointer.x;
        const worldY = pointer.y;
        const deltaX = worldX - this.dragStartPointerX;
        const deltaY = worldY - this.dragStartPointerY;

        // Determine drag direction (once threshold is met)
        if (!this.dragDirection && (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD)) {
            this.dragDirection = Math.abs(deltaX) > Math.abs(deltaY) ? 'row' : 'col';
            console.log(`Drag direction: ${this.dragDirection}`);

            // Collect sprites for dragging
            const allSprites = this.boardView.getGemsSprites();
            if (!allSprites) { this.cancelDrag("BoardView sprites unavailable"); return; }

            const index = (this.dragDirection === 'row') ? this.dragStartY : this.dragStartX;
            const limit = (this.dragDirection === 'row') ? GRID_COLS : GRID_ROWS;

            for (let i = 0; i < limit; i++) {
                const x = (this.dragDirection === 'row') ? i : index;
                const y = (this.dragDirection === 'row') ? index : i;
                const sprite = allSprites[x]?.[y];

                if (sprite && sprite.active) {
                    this.draggingSprites.push(sprite);
                    this.dragStartSpritePositions.push({ x: sprite.x, y: sprite.y, gridX: x, gridY: y });
                    this.tweens.killTweensOf(sprite); // Stop other animations
                } else {
                    // Log if a sprite is unexpectedly missing in the drag line
                    // console.warn(`Sprite missing at [${x}, ${y}] during drag setup for ${this.dragDirection} ${index}`);
                }
            }
            if (this.draggingSprites.length === 0) { this.cancelDrag("No sprites in dragged line"); return; }
        }

        // Update visuals if dragging
        if (this.dragDirection) {
            this.boardView.moveDraggingSprites(
                this.draggingSprites, this.dragStartSpritePositions, deltaX, deltaY, this.dragDirection
            );
            // Optional: Add visual feedback for potential matches here
        }
    }

    async handlePointerUp(pointer) {
        if (!this.isDragging || !this.boardView || !this.backendPuzzle) {
            this.resetDragState(); // Ensure state is clean even if not dragging
            return;
        }

        // --- Capture state before resetting ---
        const wasDragging = this.isDragging;
        const dragDirection = this.dragDirection;
        const draggingSprites = [...this.draggingSprites];
        const dragStartPositions = [...this.dragStartSpritePositions];
        const startPointerX = this.dragStartPointerX;
        const startPointerY = this.dragStartPointerY;
        const startGridX = this.dragStartX;
        const startGridY = this.dragStartY;

        // --- Reset state and disable input ---
        this.resetDragState();
        this.canMove = false; // <<< IMPORTANT: Disable input

        if (!wasDragging || !dragDirection || draggingSprites.length === 0) {
            console.log("Pointer up: No valid drag occurred.");
            this.canMove = true; // Re-enable if nothing happened
            return;
        }

        // --- Calculate final move ---
        const worldX = pointer.x;
        const worldY = pointer.y;
        const deltaX = worldX - startPointerX;
        const deltaY = worldY - startPointerY;

        const moveAction = this.calculateMoveAction(deltaX, deltaY, dragDirection, startGridX, startGridY);

        // --- Process move or snap back ---
        try {
            if (moveAction.amount !== 0) {
                console.log(`Pointer up: Committing move - ${moveAction.rowOrCol}[${moveAction.index}] by ${moveAction.amount}`);
                // 1. Update View's internal array structure
                this.boardView.updateGemsSpritesArrayAfterMove(moveAction);
                // 2. Snap visuals instantly to new grid positions
                this.boardView.snapDraggedGemsToFinalGridPositions();
                // 3. Process backend and subsequent animations
                await this.applyMoveAndHandleResults(moveAction);
            } else {
                console.log("Pointer up: No move threshold met, snapping back.");
                await this.boardView.snapBack(draggingSprites, dragStartPositions);
            }
        } catch (error) {
            console.error("Error processing pointer up:", error);
            // Attempt recovery? Maybe force sync view to backend state?
            this.boardView?.syncSpritesToGridPositions(); // Basic visual sync attempt
        } finally {
            console.log("Pointer up: Processing complete, enabling input.");
            this.canMove = true; // <<< IMPORTANT: Re-enable input
        }
    }

    // --- Game Flow Orchestration ---
    async applyMoveAndHandleResults(moveAction) {
        if (!this.backendPuzzle || !this.boardView) return;

        console.log("Applying move and handling results...");
        const phaseResult = this.backendPuzzle.getNextExplodeAndReplacePhase([moveAction]);

        // The boardView's sprite array *should* match the backend state now due to
        // updateGemsSpritesArrayAfterMove and instant snap in handlePointerUp.

        if (!phaseResult.isNothingToDo()) {
            await this.animatePhase(phaseResult); // Handle first round
            await this.handleCascades();          // Handle subsequent rounds
        } else {
            console.log("No matches found from the move.");
            // View is already visually snapped, state should be consistent.
        }
         // Optional: Verify consistency after all phases
        // this.verifyBoardState();
    }

    async handleCascades() {
        if (!this.backendPuzzle || !this.boardView) return;
        console.log("Checking for cascades...");

        const cascadePhase = this.backendPuzzle.getNextExplodeAndReplacePhase([]); // No new player actions

        if (!cascadePhase.isNothingToDo()) {
            console.log("Cascade detected!");
            await this.animatePhase(cascadePhase);
            await this.handleCascades(); // Recursively check again
        } else {
            console.log("No further cascades.");
        }
    }

    /** Animates explosions and falls for a given phase */
    async animatePhase(phaseResult) {
         if (!this.boardView) return;
         try {
             await this.boardView.animateExplosions(phaseResult.matches.flat());
             await this.boardView.animateFalls(phaseResult.replacements, this.backendPuzzle.getGridState());
         } catch (error) {
              console.error("Error during phase animation:", error);
              // Attempt recovery / visual sync
              this.boardView?.syncSpritesToGridPositions();
         }
    }


    // --- Helpers ---
    resetDragState() {
        this.isDragging = false;
        this.dragDirection = null;
        this.draggingSprites = [];
        this.dragStartSpritePositions = [];
        // Don't reset dragStartPointerX/Y or dragStartX/Y here, needed by handlePointerUp
    }

    cancelDrag(reason = "Cancelled") {
        console.warn(`Drag cancelled: ${reason}`);
        if (this.isDragging && this.boardView && this.draggingSprites.length > 0) {
            // Snap back quickly if sprites were visually moved
            this.boardView.snapBack(this.draggingSprites, this.dragStartSpritePositions)
                .catch(err => console.error("Error snapping back on cancel:", err)); // Fire and forget
        }
        this.resetDragState();
        this.canMove = true; // Ensure input enabled
    }

    calculateMoveAction(deltaX, deltaY, direction, startGridX, startGridY) {
        let cellsMoved = 0;
        let index = 0;

        if (direction === 'row') {
            cellsMoved = deltaX / this.gemSize;
            index = startGridY; // Row index doesn't change for row drag
        } else { // 'col'
            cellsMoved = deltaY / this.gemSize;
            index = startGridX; // Col index doesn't change for col drag
        }

        let amount = 0;
        if (Math.abs(cellsMoved) >= MOVE_THRESHOLD) {
            amount = Math.round(cellsMoved);
            // Backend positive amount = right/down shift.
            // Our delta calculation naturally aligns with this.
        }

        // Ensure amount is within valid range (e.g., cannot shift by more than grid size - 1)
        const limit = (direction === 'row') ? GRID_COLS : GRID_ROWS;
        amount = Phaser.Math.Clamp(amount, -(limit - 1), limit - 1);


        return new MoveAction(direction, index, amount);
    }

    disableTouchScrolling() {
        // Prevents page scroll/zoom when interacting with the game canvas on touch devices
        if (this.game.canvas) {
             this.game.canvas.style.touchAction = 'none';
             // Also add passive:false listeners to prevent default browser actions
             const opts = { passive: false };
             const preventDefault = e => e.preventDefault();
             this.game.canvas.addEventListener('touchstart', preventDefault, opts);
             this.game.canvas.addEventListener('touchmove', preventDefault, opts);
             // Store reference to remove in shutdown
             this._touchPreventDefaults = preventDefault;
        }
    }

    enableTouchScrolling() {
        if (this.game.canvas) {
            this.game.canvas.style.touchAction = 'auto';
             if (this._touchPreventDefaults) {
                 this.game.canvas.removeEventListener('touchstart', this._touchPreventDefaults);
                 this.game.canvas.removeEventListener('touchmove', this._touchPreventDefaults);
                 this._touchPreventDefaults = null;
             }
        }
    }

    // --- Scene Lifecycle ---
    shutdown() {
        console.log("Game Scene: Shutting down...");
        // Remove listeners
        this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
        this.input.off(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this);
        this.input.off(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove, this);
        this.input.off(Phaser.Input.Events.POINTER_UP, this.handlePointerUp, this);
        this.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerUp, this);
        this.enableTouchScrolling(); // Re-enable default touch actions

        // Clean up MVC components
        if (this.boardView) {
            this.boardView.destroyBoard();
            this.boardView = null;
        }
        this.backendPuzzle = null;

        // Reset controller state fully
        this.resetDragState();
        this.canMove = false; // Ensure input is off
    }

    // --- Debugging (Optional) ---
    verifyBoardState() {
         if (!this.backendPuzzle || !this.boardView) return;
         console.log("--- Verifying Board State ---");
         const modelState = this.backendPuzzle.getGridState();
         const viewSprites = this.boardView.getGemsSprites();
         let mismatches = 0;

         for (let x = 0; x < GRID_COLS; x++) {
             for (let y = 0; y < GRID_ROWS; y++) {
                 const modelGem = modelState[x]?.[y];
                 const viewSprite = viewSprites[x]?.[y];

                 if (!modelGem && viewSprite && viewSprite.active) {
                     console.warn(`Verify Mismatch: View has sprite at [${x},${y}], Model is empty.`);
                     mismatches++;
                 } else if (modelGem && (!viewSprite || !viewSprite.active)) {
                     console.warn(`Verify Mismatch: Model has gem '${modelGem.gemType}' at [${x},${y}], View has no active sprite.`);
                     mismatches++;
                 } else if (modelGem && viewSprite && viewSprite.active) {
                      if (viewSprite.getData('gemType') !== modelGem.gemType) {
                          console.warn(`Verify Mismatch: Type diff at [${x},${y}]. Model: ${modelGem.gemType}, View: ${viewSprite.getData('gemType')}`);
                          mismatches++;
                      }
                      if (viewSprite.getData('gridX') !== x || viewSprite.getData('gridY') !== y) {
                           console.warn(`Verify Mismatch: Sprite at [${x},${y}] thinks its logical pos is [${viewSprite.getData('gridX')}, ${viewSprite.getData('gridY')}]`);
                           mismatches++;
                      }
                      // Add visual position check if needed
                      // const expectedPos = this.boardView.getSpritePosition(x, y);
                      // if (Math.round(viewSprite.x) !== expectedPos.x || Math.round(viewSprite.y) !== expectedPos.y) { ... }
                 }
             }
         }
          if (mismatches === 0) console.log("Verify OK.");
          else console.error(`Verify Found ${mismatches} Mismatches!`);
         console.log("---------------------------");
     }
}
