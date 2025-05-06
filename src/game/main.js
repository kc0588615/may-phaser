import { Boot } from './scenes/Boot';
import { Game } from './scenes/Game';
import { GameOver } from './scenes/GameOver';
import { MainMenu } from './scenes/MainMenu';
import Phaser from 'phaser';
import { Preloader } from './scenes/Preloader';

// Find out more information about the Game Config at:
// https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config = {
    type: Phaser.AUTO, // AUTO selects WebGL if available, otherwise Canvas
    parent: 'game-container', // Matches the div id in index.html
    backgroundColor: '#1a1a2e', // Dark blue/purple background from webpack config
    scale: {
        mode: Phaser.Scale.RESIZE, // Adjust game size to fit window/container
        parent: 'game-container', // Ensure this matches the parent ID
        width: '100%',
        height: '100%',
        autoCenter: Phaser.Scale.CENTER_BOTH, // Center the canvas
        autoRound: true, // Round pixel values for potentially crisper rendering
    },
    input: {
        activePointers: 1, // Allow only one active touch/mouse pointer
        touch: {
            capture: true, // Prevent default touch actions (like scroll) on the canvas
        }
    },
    render: {
        antialias: true, // Smoother edges for non-pixel art
        pixelArt: false, // Set to true if using pixel art assets and want sharp scaling
        roundPixels: true // Helps prevent sub-pixel jitter
    },
    scene: [
        Boot,
        Preloader,
        MainMenu,
        Game,
        GameOver
    ]
};

const StartGame = (parent) => {

    // Pass the updated config and the parent element ID
    return new Phaser.Game({ ...config, parent });

}

export default StartGame;
