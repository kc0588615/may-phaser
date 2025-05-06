import Phaser from 'phaser';

export class Boot extends Phaser.Scene {
    constructor() {
        super('Boot');
    }

    // No preload needed here

    create() {
        console.log("Boot: Starting Preloader");
        this.scene.start('Preloader');
    }
}
