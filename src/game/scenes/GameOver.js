import Phaser from 'phaser';
import { AssetKeys } from '../constants'; // Path is correct relative to scenes/

export class GameOver extends Phaser.Scene {
    constructor() {
        super('GameOver');
    }

    create() {
        console.log("GameOver: create");
        const { width, height } = this.cameras.main;
        const centerX = width / 2;
        const centerY = height / 2;

        // Dim background
        this.add.rectangle(centerX, centerY, width, height, 0x000000, 0.6).setOrigin(0.5);

        // Background Image (optional, faded)
        if (this.textures.exists(AssetKeys.BACKGROUND)) {
            this.add.image(centerX, centerY, AssetKeys.BACKGROUND).setOrigin(0.5).setAlpha(0.3);
        }

        // Game Over Text
        this.add.text(centerX, centerY * 0.8, 'Game Over', {
            fontFamily: 'Arial Black',
            fontSize: `${Math.min(width * 0.1, height * 0.15)}px`, // Ensure 'px' unit
            color: '#ff4444', // Red color
            stroke: '#000000',
            strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5);

        // Restart instruction
         const restartText = this.add.text(centerX, centerY * 1.3, 'Click or Tap to Restart', {
            fontFamily: 'Arial',
            fontSize: `${Math.min(width * 0.05, height * 0.06)}px`, // Ensure 'px' unit
            color: '#eeeeee',
            align: 'center'
        }).setOrigin(0.5);

        // Pulse effect
        this.tweens.add({
            targets: restartText,
            alpha: 0.6,
            duration: 900,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        // Input to return to Main Menu (or restart Game directly)
        this.input.once(Phaser.Input.Events.POINTER_DOWN, () => {
            console.log("GameOver: Returning to MainMenu...");
             this.cameras.main.fadeOut(250, 0, 0, 0, (camera, progress) => {
                 if (progress === 1) {
                      this.scene.start('MainMenu');
                      // Or restart game: this.scene.start('Game');
                 }
             });
        });
    }
}
