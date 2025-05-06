import Phaser from 'phaser';
import { AssetKeys } from '../constants'; // Path is correct relative to scenes/

export class MainMenu extends Phaser.Scene {
    constructor() {
        super('MainMenu');
    }

    create() {
        console.log("MainMenu: create");
        const { width, height } = this.cameras.main;
        const centerX = width / 2;
        const centerY = height / 2;

        // Background
        if (this.textures.exists(AssetKeys.BACKGROUND)) {
            this.add.image(centerX, centerY, AssetKeys.BACKGROUND).setOrigin(0.5);
        } else {
            console.warn("Background texture not found in MainMenu scene.");
            this.cameras.main.setBackgroundColor('#3498db'); // Fallback color
        }

        // Logo
        if (this.textures.exists(AssetKeys.LOGO)) {
            this.add.image(centerX, centerY * 0.6, AssetKeys.LOGO).setOrigin(0.5).setScale(0.8); // Adjust position/scale
        } else {
             console.warn("Logo texture not found in MainMenu scene.");
        }

        // Title Text
        this.add.text(centerX, centerY, 'Phaser Match-3', {
            fontFamily: 'Arial Black', // Use a web-safe font or load custom
            fontSize: `${Math.min(width * 0.08, height * 0.1)}px`, // Responsive font size with 'px'
            color: '#ffffff',
            stroke: '#111111',
            strokeThickness: 6,
            align: 'center'
        }).setOrigin(0.5);

        // Start Instruction Text
        const startText = this.add.text(centerX, centerY * 1.5, 'Click or Tap to Start', {
            fontFamily: 'Arial',
            fontSize: `${Math.min(width * 0.05, height * 0.06)}px`, // Responsive font size with 'px'
            color: '#eeeeee',
            align: 'center'
        }).setOrigin(0.5);

        // Simple pulse effect for the start text
        this.tweens.add({
            targets: startText,
            alpha: 0.5,
            duration: 800,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });


        // Input listener to start the game
        this.input.once(Phaser.Input.Events.POINTER_DOWN, () => {
            console.log("MainMenu: Starting Game scene...");
            // Add a brief fade out effect (optional)
             this.cameras.main.fadeOut(250, 0, 0, 0, (camera, progress) => {
                 if (progress === 1) {
                      this.scene.start('Game');
                 }
             });
        });
    }
}
