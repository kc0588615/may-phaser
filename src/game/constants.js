// src/constants.js

// --- Grid Configuration ---
export const GRID_COLS = 7;
export const GRID_ROWS = 8;

// --- Gem Configuration ---
export const GEM_TYPES = ['black', 'blue', 'green', 'orange', 'red', 'white'];
export const GEM_FRAME_COUNT = 8; // Number of frames per gem type (for explosion animation, etc.)

// --- Paths ---
export const ASSETS_PATH = 'assets/';

// --- Animation Durations (in milliseconds) ---
export const TWEEN_DURATION_SNAP = 150;         // Snap back/to grid after valid move
export const TWEEN_DURATION_EXPLODE = 200;        // Gem explosion animation
export const TWEEN_DURATION_FALL_BASE = 200;      // Base time for falling
export const TWEEN_DURATION_FALL_PER_UNIT = 0.4;  // Additional ms per pixel distance fallen (adjust for speed)
export const TWEEN_DURATION_FALL_MAX = 450;       // Maximum fall duration
export const TWEEN_DURATION_LAYOUT_UPDATE = 150;  // Resize/orientation change tween

// --- Input Thresholds ---
export const DRAG_THRESHOLD = 10;       // Pixels pointer must move before drag direction is locked
export const MOVE_THRESHOLD = 0.3;      // Fraction of gem size dragged needed to register as a move

// --- Asset Keys (Centralized Naming) ---
export const AssetKeys = {
    LOGO: 'logo',
    BACKGROUND: 'background',
    // Helper to get gem texture key (assuming frame 0 is the default idle state)
    GEM_TEXTURE: (type, frame = 0) => `${type}_gem_${frame}`,
    // Add sound keys here when implemented
    // SOUND_MATCH: 'match_sound',
    // SOUND_FALL: 'fall_sound',
    // SOUND_SNAP: 'snap_sound',
    // SOUND_EXPLODE: 'explode_sound',
};

// --- Game States (Optional: For more complex state machines) ---
// export const GameState = {
//     LOADING: 'loading',
//     MENU: 'menu',
//     READY: 'ready',      // Ready for player input
//     PROCESSING: 'processing', // Handling move/matches/falls
//     GAME_OVER: 'gameOver'
// };
