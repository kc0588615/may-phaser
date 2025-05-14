// src/game/scenes/Game.js
import Phaser from 'phaser';
import { BackendPuzzle } from '../BackendPuzzle';
import { MoveAction } from '../MoveAction';
import { BoardView } from '../BoardView';
import {
    GRID_COLS, GRID_ROWS, AssetKeys,
    DRAG_THRESHOLD, MOVE_THRESHOLD // ASSETS_PATH might not be needed here
} from '../constants';
import { EventBus } from '../EventBus'; // Import EventBus

// GAME_API_BASE_URL is not directly used here anymore for initial fetch,
// as CesiumMap.jsx handles the API call.
// const GAME_API_BASE_URL = "http://localhost:8000";

export class Game extends Phaser.Scene {

    // --- MVC Components ---
    /** @type {BackendPuzzle | null} */
    backendPuzzle = null;
    /** @type {BoardView | null} */
    boardView = null;

    // --- Controller State ---
    /** @type {boolean} */
    canMove = false; // Start disabled until board is initialized from Cesium data
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

    // --- Backend Data (now received via EventBus) ---
    /** @type {number[] | null} */
    currentHabitatValues = null;
    /** @type {string[] | null} */
    currentSpeciesNames = null;
    /** @type {boolean} */
    isBoardInitialized = false; // Tracks if board has been set up with Cesium data

     /** @type {Phaser.GameObjects.Text | null} */
    statusText = null; // For displaying "Waiting for location..." or errors

    constructor() {
        super('Game');
    }

    create() {
        console.log("Game Scene: create");
        const { width, height } = this.scale;

        if (this.textures.exists(AssetKeys.BACKGROUND)) {
            this.add.image(width / 2, height / 2, AssetKeys.BACKGROUND).setOrigin(0.5).setAlpha(0.5);
        } else {
            console.warn("Background texture not found in Game scene.");
            this.cameras.main.setBackgroundColor('#1a1a2e');
        }

        if (typeof BackendPuzzle === 'undefined' || typeof MoveAction === 'undefined' || typeof BoardView === 'undefined') {
             console.error("Error: Required game logic classes missing.");
             this.add.text(width / 2, height / 2, `Error: Game logic missing.\nCheck console.`, { color: '#ff0000', fontSize: '20px' }).setOrigin(0.5);
             return;
        }

        // Display initial status
        this.statusText = this.add.text(
            width / 2, height / 2,
            "Waiting for location selection from map...",
            { fontSize: '20px', color: '#ffffff', backgroundColor: '#000000aa', padding: { x: 10, y: 5 }, align: 'center' }
        ).setOrigin(0.5).setDepth(100);

        // Prepare BackendPuzzle and BoardView instances, but don't create board visuals yet.
        this.backendPuzzle = new BackendPuzzle(GRID_COLS, GRID_ROWS);
        this.calculateBoardDimensions(); // Initial calculation for gemSize, boardOffset
        this.boardView = new BoardView(this, {
            cols: GRID_COLS, rows: GRID_ROWS,
            gemSize: this.gemSize, boardOffset: this.boardOffset
        });
        // boardView.createBoard will be called in initializeBoardFromCesium

        // --- Setup Input Handlers (will only work if canMove is true) ---
        this.input.addPointer(1);
        this.disableTouchScrolling();
        this.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this);
        this.input.on(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove, this);
        this.input.on(Phaser.Input.Events.POINTER_UP, this.handlePointerUp, this);
        this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerUp, this);

        // --- Setup Resize Listener ---
        this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);

        // --- Listen for Cesium location selection ---
        EventBus.on('cesium-location-selected', this.initializeBoardFromCesium, this);
        console.log("Game Scene: Listening for 'cesium-location-selected' event.");

        this.resetDragState();
        this.canMove = false; // Input disabled until board is initialized
        this.isBoardInitialized = false;

        EventBus.emit('current-scene-ready', this);
        console.log("Game Scene: Create method finished. Waiting for Cesium data.");
    }

    // Method to handle data from CesiumMap via EventBus
    initializeBoardFromCesium(data) {
        console.log("Game Scene: Received 'cesium-location-selected' data:", data);
        this.canMove = false; // Disable input while processing
        this.isBoardInitialized = false;

        const { width, height } = this.scale;

        if (this.statusText && this.statusText.active) {
            this.statusText.setText("Initializing game board with map data...");
        }

        try {
            if (!data || !data.habitats) {
                throw new Error("Received incomplete data from CesiumMap.");
            }

            this.currentHabitatValues = data.habitats || [];
            this.currentSpeciesNames = data.species || []; // Store if needed for other mechanics

            if (!this.backendPuzzle) { // Should have been created in create()
                this.backendPuzzle = new BackendPuzzle(GRID_COLS, GRID_ROWS);
            }
            if (this.backendPuzzle.setHabitatInfluence) {
                this.backendPuzzle.setHabitatInfluence(this.currentHabitatValues);
            } else {
                console.warn("BackendPuzzle does not have 'setHabitatInfluence'. Gem spawning might not be influenced.");
            }

            // Recalculate dimensions in case of resize before first init
            this.calculateBoardDimensions();
            if (!this.boardView) { // Should have been created in create()
                 this.boardView = new BoardView(this, {
                    cols: GRID_COLS, rows: GRID_ROWS,
                    gemSize: this.gemSize, boardOffset: this.boardOffset
                });
            } else {
                // Update layout if already exists (e.g. resize happened)
                this.boardView.updateVisualLayout(this.gemSize, this.boardOffset);
            }

            // Now (re)create the board visuals
            if (this.boardView.destroyBoard) this.boardView.destroyBoard(); // Clear old sprites if any
            this.boardView.createBoard(this.backendPuzzle.getGridState());

            if (this.statusText && this.statusText.active) {
                this.statusText.destroy();
                this.statusText = null;
            }
            this.isBoardInitialized = true;
            this.canMove = true; // Enable input
            console.log("Game Scene: Board initialized from Cesium data. Input enabled.");

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

    // fetchLocationData is NO LONGER CALLED by Game.js directly for initialization.
    // It's now handled by CesiumMap.jsx. Kept for reference or other potential uses.
    // async fetchLocationData(lon, lat) { ... }

    // --- Layout ---
    calculateBoardDimensions() {
        // ... (same as your provided version, uses imported GRID_COLS, GRID_ROWS)
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
        // console.log(`calculateBoardDimensions: scale=(${width.toFixed(0)}x${height.toFixed(0)}), usable=(${usableWidth.toFixed(0)}x${usableHeight.toFixed(0)}), sizeFromW=${sizeFromWidth}, sizeFromH=${sizeFromHeight}, RESULT gemSize=${this.gemSize}`);
    }

    handleResize() {
        console.log("Game Scene: Resize detected.");
        this.calculateBoardDimensions(); // Recalculates gemSize, boardOffset

        if (this.statusText && this.statusText.active) {
             this.statusText.setPosition(this.scale.width / 2, this.scale.height / 2);
             // Potentially adjust text wrap width
             const textStyle = this.statusText.style;
             if (textStyle.wordWrapWidth) {
                this.statusText.style.setWordWrapWidth(this.scale.width * 0.8);
             }
        }

        if (this.boardView) {
            // This will use the newly calculated this.gemSize and this.boardOffset
            this.boardView.updateVisualLayout(this.gemSize, this.boardOffset);
        }
    }

    // --- Input Handling ---
     handlePointerDown(pointer) {
        // console.log(`>>> PointerDown: x=${pointer.x.toFixed(0)}, y=${pointer.y.toFixed(0)}. State: canMove=${this.canMove}, isBoardInitialized=${this.isBoardInitialized}, isDragging=${this.isDragging}`);

        if (!this.canMove || !this.isBoardInitialized || !this.boardView || !this.backendPuzzle) {
            // console.log("   PointerDown blocked.");
            return;
        }
        // ... (rest of handlePointerDown is the same as your provided version)
        if(this.isDragging) {
            console.warn("PointerDown occurred while already dragging? Resetting drag state.");
            this.resetDragState();
        }

        const worldX = pointer.x;
        const worldY = pointer.y;
        const boardWidth = GRID_COLS * this.gemSize;
        const boardHeight = GRID_ROWS * this.gemSize;
        const boardRect = new Phaser.Geom.Rectangle(
             this.boardOffset.x, this.boardOffset.y,
             boardWidth, boardHeight
        );

        if (!boardRect.contains(worldX, worldY)) {
             return;
        }

        const gridX = Math.floor((worldX - this.boardOffset.x) / this.gemSize);
        const gridY = Math.floor((worldY - this.boardOffset.y) / this.gemSize);
        this.dragStartX = Phaser.Math.Clamp(gridX, 0, GRID_COLS - 1);
        this.dragStartY = Phaser.Math.Clamp(gridY, 0, GRID_ROWS - 1);
        this.dragStartPointerX = worldX;
        this.dragStartPointerY = worldY;
        this.isDragging = true;
        this.dragDirection = null;
        this.draggingSprites = [];
        this.dragStartSpritePositions = [];
        // console.log(`   PointerDown started drag check at grid [${this.dragStartX}, ${this.dragStartY}]. isDragging=${this.isDragging}`);
     }

     handlePointerMove(pointer) {
         // ... (same as your provided version, uses imported GRID_COLS, GRID_ROWS)
         if (!this.isDragging) { return; };

         if (!this.canMove || !this.isBoardInitialized || !this.boardView) {
             if (this.isDragging) this.cancelDrag("Blocked during move");
             return;
         }

         if (!pointer.isDown) {
              this.cancelDrag("Pointer up during move");
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
             this.draggingSprites = [];
             this.dragStartSpritePositions = [];

             for (let i = 0; i < limit; i++) {
                 const xPos = (this.dragDirection === 'row') ? i : index;
                 const yPos = (this.dragDirection === 'row') ? index : i;
                 const sprite = allSprites[xPos]?.[yPos];

                 if (sprite && sprite.active) {
                     this.draggingSprites.push(sprite);
                     this.dragStartSpritePositions.push({ x: sprite.x, y: sprite.y, gridX: xPos, gridY: yPos });
                     this.tweens.killTweensOf(sprite);
                 }
             }
             if (this.draggingSprites.length === 0) { this.cancelDrag("No sprites in dragged line"); return; }
         }

         if (this.dragDirection && this.boardView) {
             this.boardView.moveDraggingSprites(
                 this.draggingSprites, this.dragStartSpritePositions, deltaX, deltaY, this.dragDirection
             );
         }
     }

     handlePointerUp(pointer) {
         // ... (same as your provided version)
        // console.log(`>>> PointerUp triggered. State: isDragging=${this.isDragging}, canMove=${this.canMove}, isBoardInitialized=${this.isBoardInitialized}`);

        if (!this.isDragging) {
            this.resetDragState();
            return;
        }

        if (!this.isBoardInitialized || !this.boardView || !this.backendPuzzle) {
           this.cancelDrag("Blocked during PointerUp");
           this.resetDragState();
           return;
        }

        const wasDragging = this.isDragging; // Store before reset
        const dragDirection = this.dragDirection;
        const dSprites = [...this.draggingSprites]; // Shallow copy
        const dStartPositions = [...this.dragStartSpritePositions]; // Shallow copy
        const sPointerX = this.dragStartPointerX;
        const sPointerY = this.dragStartPointerY;
        const sGridX = this.dragStartX;
        const sGridY = this.dragStartY;

        this.resetDragState();

        if (!dragDirection || dSprites.length === 0) {
           return;
       }

        const worldX = pointer.x;
        const worldY = pointer.y;
        const deltaX = worldX - sPointerX;
        const deltaY = worldY - sPointerY;
        const moveAction = this.calculateMoveAction(deltaX, deltaY, dragDirection, sGridX, sGridY);

        this.processPointerUp(moveAction, dSprites, dStartPositions);
     }

     // processPointerUp, applyMoveAndHandleResults, handleCascades, animatePhase, resetDragState,
     // cancelDrag, calculateMoveAction, disableTouchScrolling, enableTouchScrolling are
     // the same as your provided (and my previous) versions. Ensure they use imported constants.

    async processPointerUp(moveAction, dSprites, dStartPositions) {
        if (!this.canMove) { // Already checked if board is initialized in handlePointerUp
             console.warn("processPointerUp called while canMove is false. Aborting.");
             // Snap back if called in weird state
             if (this.boardView && dSprites.length > 0) {
                await this.boardView.snapBack(dSprites, dStartPositions);
             }
             return;
        }
        this.canMove = false;
        // console.log(">>> processPointerUp START. Setting canMove = false.");

         try {
            if (moveAction.amount !== 0) {
                // console.log(`   Processing move: ${moveAction.rowOrCol}[${moveAction.index}] by ${moveAction.amount}`);
                if (!this.boardView || !this.backendPuzzle) throw new Error("BoardView or BackendPuzzle missing during processing");

                this.boardView.updateGemsSpritesArrayAfterMove(moveAction);
                this.boardView.snapDraggedGemsToFinalGridPositions();
                await this.applyMoveAndHandleResults(moveAction);
            } else {
                // console.log("   Processing snap back (no move threshold).");
                if (this.boardView) {
                     await this.boardView.snapBack(dSprites, dStartPositions);
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
            // console.log(">>> processPointerUp COMPLETE. Setting canMove = true.");
        }
     }

    async applyMoveAndHandleResults(moveAction) {
        if (!this.backendPuzzle || !this.boardView) return;
        const phaseResult = this.backendPuzzle.getNextExplodeAndReplacePhase([moveAction]);
        if (!phaseResult.isNothingToDo()) {
            await this.animatePhase(phaseResult);
            await this.handleCascades();
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
         await this.boardView.animateExplosions(phaseResult.matches.flat());
         await this.boardView.animateFalls(phaseResult.replacements, this.backendPuzzle.getGridState());
    }

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
        }
        this.resetDragState(); // Ensure reset even if snapBack isn't called
    }

    calculateMoveAction(deltaX, deltaY, direction, startGridX, startGridY) {
        let cellsMoved = 0;
        let index = 0;
        if (direction === 'row') {
            cellsMoved = deltaX / this.gemSize;
            index = startGridY;
        } else {
            cellsMoved = deltaY / this.gemSize;
            index = startGridX;
        }
        let amount = 0;
        if (Math.abs(cellsMoved) >= MOVE_THRESHOLD) {
            amount = Math.round(cellsMoved);
        }
        const limit = (direction === 'row') ? GRID_COLS : GRID_ROWS;
        amount = Phaser.Math.Clamp(amount, -(limit - 1), limit - 1);
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


    // --- Scene Lifecycle ---
    shutdown() {
        console.log("Game Scene: Shutting down...");
        EventBus.off('cesium-location-selected', this.initializeBoardFromCesium, this);

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
        if (this.statusText) {
             this.statusText.destroy();
             this.statusText = null;
        }

        this.resetDragState();
        this.canMove = false;
        this.isBoardInitialized = false;
        this.currentHabitatValues = null;
        this.currentSpeciesNames = null;

        console.log("Game Scene: Shutdown complete.");
    }

    // verifyBoardState can remain the same as your provided version
    verifyBoardState() { /* ... same ... */
         if (!this.backendPuzzle || !this.boardView) return;
         // console.log("--- Verifying Board State ---");
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
                 }
             }
         }
          if (mismatches === 0) console.log("Verify OK.");
          else console.error(`Verify Found ${mismatches} Mismatches!`);
         // console.log("---------------------------");
     }
}