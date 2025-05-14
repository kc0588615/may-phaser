// src/game/scenes/Game.js
import Phaser from 'phaser';
import { BackendPuzzle } from '../BackendPuzzle'; // Corrected path
import { MoveAction } from '../MoveAction';     // Corrected path
import { BoardView } from '../BoardView';       // Corrected path
import {
    GRID_COLS, GRID_ROWS, AssetKeys, // <<< Import directly
    DRAG_THRESHOLD, MOVE_THRESHOLD, ASSETS_PATH
} from '../constants'; // Correct path relative to scenes/

// Define Backend API URL
const GAME_API_BASE_URL = "http://localhost:8000"; // Your FastAPI backend

export class Game extends Phaser.Scene {

    // --- MVC Components ---
    /** @type {BackendPuzzle | null} */
    backendPuzzle = null;
    /** @type {BoardView | null} */
    boardView = null;

    // --- Controller State ---
    /** @type {boolean} */
    canMove = false; // Start disabled
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
    gemSize = 64; // Default, will be calculated
    /** @type {{x: number, y: number}} */
    boardOffset = { x: 0, y: 0 };

    // --- Backend Data ---
    /** @type {number[] | null} */
    currentHabitatValues = null;
    /** @type {string[] | null} */
    currentSpeciesNames = null;
    /** @type {boolean} */
    isBackendDataLoading = false;
     /** @type {Phaser.GameObjects.Text | null} */
    loadingText = null;

    constructor() {
        super('Game');
        // It's generally better practice NOT to rely on `this.gridCols` here
        // if they are just constants. We'll use the imported constants directly.
    }

    // create() is the entry point, make it async
    async create() {
        console.log("Game Scene: create");

        const { width, height } = this.scale;

        // Optional: Background Image
        if (this.textures.exists(AssetKeys.BACKGROUND)) {
            this.add.image(width / 2, height / 2, AssetKeys.BACKGROUND).setOrigin(0.5).setAlpha(0.5);
        } else {
            console.warn("Background texture not found in Game scene.");
            this.cameras.main.setBackgroundColor('#1a1a2e');
        }

        // --- Initialize ---
        if (typeof BackendPuzzle === 'undefined' || typeof MoveAction === 'undefined' || typeof BoardView === 'undefined') {
             console.error("Error: Required game logic classes missing.");
             this.add.text(width / 2, height / 2, `Error: Game logic missing.\nCheck console.`, { color: '#ff0000', fontSize: '20px' }).setOrigin(0.5);
             return; // Stop creation
        }

        // --- Start Loading ---
        this.isBackendDataLoading = true;
        this.canMove = false; // Ensure input is disabled
        console.log("Game Scene: Fetching initial location data...");
        this.loadingText = this.add.text(width / 2, height / 2, "Loading Habitat Data...", { fontSize: '24px', color: '#ffffff', backgroundColor: '#000000cc', padding: {x: 10, y: 5} }).setOrigin(0.5).setDepth(100);

        try {
            // --- Fetch Data ---
            const testLon = -97.121;
            const testLat = 31.55;
            await this.fetchLocationData(testLon, testLat);
            console.log("Game Scene: Location data fetched.", this.currentHabitatValues, this.currentSpeciesNames);

            // --- Create Core Game Objects ---
            // Use imported constants
            this.backendPuzzle = new BackendPuzzle(GRID_COLS, GRID_ROWS);
            if (this.backendPuzzle.setHabitatInfluence) {
                this.backendPuzzle.setHabitatInfluence(this.currentHabitatValues);
            } else {
                 console.warn("BackendPuzzle does not have 'setHabitatInfluence'.");
            }

            this.calculateBoardDimensions(); // Calculates this.gemSize, this.boardOffset
            this.boardView = new BoardView(this, {
                // Pass imported constants
                cols: GRID_COLS, rows: GRID_ROWS,
                gemSize: this.gemSize, boardOffset: this.boardOffset
            });
            this.boardView.createBoard(this.backendPuzzle.getGridState());

            // --- Setup Input Handlers *AFTER* successful creation ---
            console.log(">>> Attaching input handlers.");
            this.input.addPointer(1);
            this.disableTouchScrolling();
            this.input.off(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this);
            this.input.off(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove, this);
            this.input.off(Phaser.Input.Events.POINTER_UP, this.handlePointerUp, this);
            this.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerUp, this);
            this.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this);
            this.input.on(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove, this);
            this.input.on(Phaser.Input.Events.POINTER_UP, this.handlePointerUp, this);
            this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerUp, this);

            // --- Setup Resize Listener ---
            this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
            this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);

            // --- Enable Input ---
            this.resetDragState();
            this.canMove = true;
            console.log(">>> Initialization SUCCESSFUL. Setting canMove = true");

        } catch (error) {
            // --- Handle Initialization Error ---
            console.error("Game Scene: Failed during initialization:", error);
            if (this.loadingText) this.loadingText.destroy();
            this.add.text(width / 2, height / 2, `Error initializing game:\n${error.message}\n\nCheck console & backend.`, {
                fontSize: '18px', color: '#ff4444', backgroundColor: '#000000cc',
                align: 'center', padding: {x: 10, y: 5}, wordWrap: { width: width * 0.8 }
            }).setOrigin(0.5).setDepth(100);
            this.canMove = false;
            console.log(">>> Initialization FAILED. Setting canMove = false");
        } finally {
            // --- Cleanup Loading State ---
            this.isBackendDataLoading = false;
            if (this.loadingText && this.loadingText.active) {
                 this.loadingText.destroy();
                 this.loadingText = null;
            }
            console.log(">>> Initialization FINALLY block. canMove =", this.canMove);
        }

        console.log("Game Scene: Create method finished.");
    }


    // ***** Function to fetch data from the backend API *****
    async fetchLocationData(lon, lat) {
        const queryUrl = `${GAME_API_BASE_URL}/api/location_info/?lon=${lon}&lat=${lat}`;
        console.log("Phaser fetching API:", queryUrl);

        try {
            const response = await fetch(queryUrl);

            if (!response.ok) {
                let errorBody = 'Could not read error body.';
                try { errorBody = await response.text(); } catch (e) { /* ignore */ }
                console.error(`API Error ${response.status}: ${response.statusText}. Body: ${errorBody}`);
                throw new Error(`Failed to fetch location data (${response.status})`);
            }

            const data = await response.json();
            this.currentHabitatValues = data.habitats || [];
            this.currentSpeciesNames = data.species || [];
            console.log("Phaser received data - Habitats:", this.currentHabitatValues, "Species:", this.currentSpeciesNames);

        } catch (error) {
            console.error("Error fetching location data:", error);
            this.currentHabitatValues = null;
            this.currentSpeciesNames = null;
            throw error; // Re-throw
        }
    }


    // --- Layout ---
    calculateBoardDimensions() {
        const { width, height } = this.scale;
        if (width <= 0 || height <= 0) { console.warn("Invalid scale dimensions."); return; }
        const usableWidth = width * 0.95;
        const usableHeight = height * 0.90;
        // Use imported constants
        const sizeFromWidth = Math.floor(usableWidth / GRID_COLS);
        const sizeFromHeight = Math.floor(usableHeight / GRID_ROWS);
        this.gemSize = Math.max(24, Math.min(sizeFromWidth, sizeFromHeight));
        // Use imported constants
        const boardWidth = GRID_COLS * this.gemSize;
        const boardHeight = GRID_ROWS * this.gemSize;
        this.boardOffset = {
            x: Math.round((width - boardWidth) / 2),
            y: Math.round((height - boardHeight) / 2)
        };
        console.log(`calculateBoardDimensions: scale=(${width.toFixed(0)}x${height.toFixed(0)}), usable=(${usableWidth.toFixed(0)}x${usableHeight.toFixed(0)}), sizeFromW=${sizeFromWidth}, sizeFromH=${sizeFromHeight}, RESULT gemSize=${this.gemSize}`);
    }

    handleResize() {
        console.log("Game Scene: Resize detected.");
        this.calculateBoardDimensions();
        if (this.loadingText && this.loadingText.active) {
             this.loadingText.setPosition(this.scale.width / 2, this.scale.height / 2);
        }
        if (this.boardView) {
            this.boardView.updateVisualLayout(this.gemSize, this.boardOffset);
        }
    }

    // --- Input Handling ---
     handlePointerDown(pointer) {
        console.log(`>>> PointerDown: x=${pointer.x.toFixed(0)}, y=${pointer.y.toFixed(0)}. State: canMove=${this.canMove}, isLoading=${this.isBackendDataLoading}, isDragging=${this.isDragging}`);

        if (!this.canMove || this.isBackendDataLoading || !this.boardView || !this.backendPuzzle) {
            console.log("   PointerDown blocked.");
            return;
        }
        if(this.isDragging) {
            console.warn("PointerDown occurred while already dragging? Resetting drag state.");
            this.resetDragState();
        }

        const worldX = pointer.x;
        const worldY = pointer.y;
        // console.log(`Game Scene: Pointer down at world coords (${worldX.toFixed(1)}, ${worldY.toFixed(1)})`);

        // Check if click is within board bounds
        // <<< CHANGED: Use imported constants >>>
        const boardWidth = GRID_COLS * this.gemSize;
        const boardHeight = GRID_ROWS * this.gemSize;
        const boardRect = new Phaser.Geom.Rectangle(
             this.boardOffset.x, this.boardOffset.y,
             boardWidth, boardHeight
        );
        // console.log(`Game Scene: Board Rect: x=${boardRect.x.toFixed(1)}, y=${boardRect.y.toFixed(1)}, w=${boardWidth.toFixed(1)}, h=${boardHeight.toFixed(1)}`);


        if (!boardRect.contains(worldX, worldY)) {
             console.log("   PointerDown outside board bounds.");
             return;
        }

        // Proceed with drag initiation
        const gridX = Math.floor((worldX - this.boardOffset.x) / this.gemSize);
        const gridY = Math.floor((worldY - this.boardOffset.y) / this.gemSize);
        // console.log(`Game Scene: Calculated grid coords (${gridX}, ${gridY})`);

        // <<< CHANGED: Use imported constants >>>
        this.dragStartX = Phaser.Math.Clamp(gridX, 0, GRID_COLS - 1);
        this.dragStartY = Phaser.Math.Clamp(gridY, 0, GRID_ROWS - 1);
        // console.log(`Game Scene: Clamped start grid coords (${this.dragStartX}, ${this.dragStartY})`);

        this.dragStartPointerX = worldX;
        this.dragStartPointerY = worldY;
        this.isDragging = true;
        this.dragDirection = null;
        this.draggingSprites = [];
        this.dragStartSpritePositions = [];
        console.log(`   PointerDown started drag check at grid [${this.dragStartX}, ${this.dragStartY}]. isDragging=${this.isDragging}`);
     }

     handlePointerMove(pointer) {
         if (!this.isDragging) { return; };

         if (!this.canMove || this.isBackendDataLoading || !this.boardView) {
             console.log(`PointerMove blocked: canMove=${this.canMove}, isLoading=${this.isBackendDataLoading}`);
             if (this.isDragging) this.cancelDrag("Blocked during move");
             return;
         }

         if (!pointer.isDown) {
              console.log("PointerMove detected pointer is up - cancelling drag.");
              this.cancelDrag("Pointer up during move");
              return;
         }

         const worldX = pointer.x;
         const worldY = pointer.y;
         const deltaX = worldX - this.dragStartPointerX;
         const deltaY = worldY - this.dragStartPointerY;

         // Determine drag direction
         if (!this.dragDirection && (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD)) {
             this.dragDirection = Math.abs(deltaX) > Math.abs(deltaY) ? 'row' : 'col';
             console.log(`   PointerMove determined drag direction: ${this.dragDirection}`);

             const allSprites = this.boardView.getGemsSprites();
             if (!allSprites) { this.cancelDrag("BoardView sprites unavailable"); return; }

             const index = (this.dragDirection === 'row') ? this.dragStartY : this.dragStartX;
             // <<< CHANGED: Use imported constants >>>
             const limit = (this.dragDirection === 'row') ? GRID_COLS : GRID_ROWS;
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
             console.log(`   PointerMove collected ${this.draggingSprites.length} sprites for dragging.`);
         }

         // Update visuals
         if (this.dragDirection && this.boardView) {
             this.boardView.moveDraggingSprites(
                 this.draggingSprites, this.dragStartSpritePositions, deltaX, deltaY, this.dragDirection
             );
         }
     }

     handlePointerUp(pointer) {
         console.log(`>>> PointerUp triggered. State: isDragging=${this.isDragging}, canMove=${this.canMove}, isLoading=${this.isBackendDataLoading}`);

         if (!this.isDragging) {
             console.log("   PointerUp ignored: wasn't dragging.");
             this.resetDragState();
             return;
         }

         if (this.isBackendDataLoading || !this.boardView || !this.backendPuzzle) {
            console.warn("   PointerUp blocked unexpectedly. Cancelling drag.");
            this.cancelDrag("Blocked during PointerUp");
            this.resetDragState();
            return;
         }

         // Capture state
        const wasDragging = this.isDragging;
        const dragDirection = this.dragDirection;
        const draggingSprites = [...this.draggingSprites];
        const dragStartPositions = [...this.dragStartSpritePositions];
        const startPointerX = this.dragStartPointerX;
        const startPointerY = this.dragStartPointerY;
        const startGridX = this.dragStartX;
        const startGridY = this.dragStartY;

         // Reset Drag State Immediately
         this.resetDragState();
         console.log("   PointerUp reset internal drag state.");

         // Check if valid drag
         if (!dragDirection || draggingSprites.length === 0) {
            console.log("   PointerUp: No valid drag occurred (no direction/sprites).");
            return;
        }

         // Calculate final move
        const worldX = pointer.x;
        const worldY = pointer.y;
        const deltaX = worldX - startPointerX;
        const deltaY = worldY - startPointerY;
        const moveAction = this.calculateMoveAction(deltaX, deltaY, dragDirection, startGridX, startGridY);

         // Process move or snap back (ASYNC)
         console.log("   PointerUp calling processPointerUp...");
         this.processPointerUp(moveAction, draggingSprites, dragStartPositions);
     }

     // Helper async function for pointer up logic
     async processPointerUp(moveAction, draggingSprites, dragStartPositions) {
        if (!this.canMove) {
             console.warn("processPointerUp called while canMove is false. Aborting.");
             return;
        }
        this.canMove = false;
        console.log(">>> processPointerUp START. Setting canMove = false.");

         try {
            if (moveAction.amount !== 0) {
                console.log(`   Processing move: ${moveAction.rowOrCol}[${moveAction.index}] by ${moveAction.amount}`);
                if (!this.boardView || !this.backendPuzzle) throw new Error("BoardView or BackendPuzzle missing during processing");

                this.boardView.updateGemsSpritesArrayAfterMove(moveAction);
                this.boardView.snapDraggedGemsToFinalGridPositions();
                await this.applyMoveAndHandleResults(moveAction);
            } else {
                console.log("   Processing snap back (no move threshold).");
                if (this.boardView) {
                     await this.boardView.snapBack(draggingSprites, dragStartPositions);
                }
            }
        } catch (error) {
            console.error("Error processing pointer up action:", error);
             if (this.boardView) {
                 console.warn("Attempting board sync after error.");
                 this.boardView.syncSpritesToGridPositions();
             }
        } finally {
            this.canMove = true;
            console.log(">>> processPointerUp COMPLETE. Setting canMove = true.");
        }
     }


    // --- Game Flow Orchestration ---
    async applyMoveAndHandleResults(moveAction) {
        if (!this.backendPuzzle || !this.boardView) return;
        console.log("   Applying move to backend and handling results...");
        const phaseResult = this.backendPuzzle.getNextExplodeAndReplacePhase([moveAction]);

        if (!phaseResult.isNothingToDo()) {
            console.log("   Matches found, animating phase...");
            await this.animatePhase(phaseResult);
            await this.handleCascades();
        } else {
            console.log("   No matches found from the move.");
        }
        console.log("   applyMoveAndHandleResults finished.");
    }

    async handleCascades() {
        if (!this.backendPuzzle || !this.boardView) return;
        console.log("   Checking for cascades...");
        const cascadePhase = this.backendPuzzle.getNextExplodeAndReplacePhase([]);

        if (!cascadePhase.isNothingToDo()) {
            console.log("   Cascade detected! Animating phase...");
            await this.animatePhase(cascadePhase);
            await this.handleCascades();
        } else {
            console.log("   No further cascades.");
        }
    }

    /** Animates explosions and falls for a given phase */
    async animatePhase(phaseResult) {
         if (!this.boardView) return;
         console.log("      Animating explosions...");
         await this.boardView.animateExplosions(phaseResult.matches.flat());
         console.log("      Animating falls...");
         await this.boardView.animateFalls(phaseResult.replacements, this.backendPuzzle.getGridState());
         console.log("      Phase animation complete.");
    }


    // --- Helpers ---
    resetDragState() {
        this.isDragging = false;
        this.dragDirection = null;
        this.draggingSprites = [];
        this.dragStartSpritePositions = [];
    }

    cancelDrag(reason = "Cancelled") {
        console.warn(`Drag cancelled: ${reason}. Snapping back.`);
        if (this.isDragging && this.boardView && this.draggingSprites.length > 0 && this.dragStartSpritePositions.length > 0) {
             this.boardView.snapBack(this.draggingSprites, this.dragStartSpritePositions)
                 .catch(err => console.error("Error during snap back on cancel:", err));
        } else {
            console.log("   CancelDrag: No sprites/positions to snap back.");
        }
        this.resetDragState();
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

        // <<< CHANGED: Use imported constants >>>
        const limit = (direction === 'row') ? GRID_COLS : GRID_ROWS;
        amount = Phaser.Math.Clamp(amount, -(limit - 1), limit - 1);

        return new MoveAction(direction, index, amount);
    }

    disableTouchScrolling() {
        if (this.game.canvas) {
             this.game.canvas.style.touchAction = 'none';
             const opts = { passive: false };
             const preventDefault = e => e.preventDefault();
             this.game.canvas.addEventListener('touchstart', preventDefault, opts);
             this.game.canvas.addEventListener('touchmove', preventDefault, opts);
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
        this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
        this.input.off(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this);
        this.input.off(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove, this);
        this.input.off(Phaser.Input.Events.POINTER_UP, this.handlePointerUp, this);
        this.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerUp, this);
        this.enableTouchScrolling();

        if (this.boardView) {
            this.boardView.destroyBoard();
            this.boardView = null;
        }
        this.backendPuzzle = null;
        if (this.loadingText) {
             this.loadingText.destroy();
             this.loadingText = null;
        }

        this.resetDragState();
        this.canMove = false;
        this.isBackendDataLoading = false;
        this.currentHabitatValues = null;
        this.currentSpeciesNames = null;

        console.log("Game Scene: Shutdown complete.");
    }

    // --- Debugging (Optional) ---
    verifyBoardState() {
         if (!this.backendPuzzle || !this.boardView) return;
         console.log("--- Verifying Board State ---");
         const modelState = this.backendPuzzle.getGridState();
         const viewSprites = this.boardView.getGemsSprites();
         let mismatches = 0;

         // <<< CHANGED: Use imported constants >>>
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
                 }
             }
         }
          if (mismatches === 0) console.log("Verify OK.");
          else console.error(`Verify Found ${mismatches} Mismatches!`);
         console.log("---------------------------");
     }
}