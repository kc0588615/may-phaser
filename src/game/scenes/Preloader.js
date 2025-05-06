import Phaser from 'phaser';
import { GEM_TYPES, ASSETS_PATH, AssetKeys, GEM_FRAME_COUNT } from '../constants'; // Path is correct relative to scenes/

export class Preloader extends Phaser.Scene {
    constructor() {
        super('Preloader');
    }

    preload() {
        this.showLoadingProgress();

        // Set base path for assets relative to the 'public' folder
        this.load.setBaseURL(window.location.origin); // Ensures paths are relative to the server root
        const assetsFullPath = `${ASSETS_PATH}`; // ASSETS_PATH should be relative to public, e.g., 'assets/'

        // Load common assets
        this.load.image(AssetKeys.LOGO, `${assetsFullPath}logo.png`);
        this.load.image(AssetKeys.BACKGROUND, `${assetsFullPath}bg.png`); // Corrected key and filename

        // Load Gem Assets
        GEM_TYPES.forEach(type => {
            for (let i = 0; i < GEM_FRAME_COUNT; i++) {
                const key = AssetKeys.GEM_TEXTURE(type, i);
                // Assuming gem files are named like 'black_gem_0.png', 'blue_gem_1.png' etc.
                // and located directly in the ASSETS_PATH folder.
                const path = `${assetsFullPath}${type}_gem_${i}.png`;
                this.load.image(key, path);
            }
        });

        // Load sounds if/when added
        // this.load.audio(AssetKeys.SOUND_MATCH, [`${assetsFullPath}sounds/match.ogg`, `${assetsFullPath}sounds/match.mp3`]);

        // Example: Load a missing asset to test error handling
        // this.load.image('nonexistent', `${assetsFullPath}nonexistent.png`);
    }

    showLoadingProgress() {
        const { width, height } = this.cameras.main;
        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x333333, 0.8); // Darker gray
        // Ensure box is centered and sized reasonably
        const boxWidth = width * 0.6;
        const boxHeight = 50;
        const boxX = (width - boxWidth) / 2;
        const boxY = (height - boxHeight) / 2;
        progressBox.fillRect(boxX, boxY, boxWidth, boxHeight);

        const loadingText = this.make.text({
            x: width / 2, y: boxY - 25, text: 'Loading...',
            style: { font: '24px Arial', color: '#ffffff' }
        }).setOrigin(0.5);

        const percentText = this.make.text({
            x: width / 2, y: boxY + boxHeight / 2, text: '0%',
            style: { font: '20px Arial', color: '#ffffff' }
        }).setOrigin(0.5);

        const assetText = this.make.text({
            x: width / 2, y: boxY + boxHeight + 25, text: '',
            style: { font: '16px Arial', color: '#dddddd', align: 'center', wordWrap: { width: width * 0.8 } }
        }).setOrigin(0.5);

        this.load.on('progress', (value) => {
            percentText.setText(`${parseInt(value * 100)}%`);
            progressBar.clear();
            progressBar.fillStyle(0xeeeeee, 1); // Lighter gray bar
            // Adjust progress bar position and size relative to the box
            const barMargin = 10;
            const barHeight = boxHeight - barMargin * 2;
            const barWidth = (boxWidth - barMargin * 2) * value;
            progressBar.fillRect(boxX + barMargin, boxY + barMargin, barWidth, barHeight);
        });

        this.load.on('fileprogress', (file) => {
            // Limit asset text length and show type
            const keyName = file.key.length > 40 ? file.key.substring(0, 37) + '...' : file.key;
             assetText.setText(`Loading ${file.type}: ${keyName}`);
             // console.log(`Loading ${file.type}: ${file.key} from ${file.url}`); // Debug loading path
        });

         this.load.on('loaderror', (file) => {
             console.error(`Error loading asset: ${file.key} from ${file.url}`);
             assetText.setText(`Error loading: ${file.key}`).setColor('#ff0000');
             // Optionally stop the game or show an error message
         });

        this.load.on('complete', () => {
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();
            percentText.destroy();
            assetText.destroy();
            console.log("Preloader complete.");
            // Proceed only if no errors occurred (basic check)
            // Safer check: ensure this.load.failed exists before checking its size
            if (!this.load.inflight.size && (!this.load.failed || !this.load.failed.size)) {
                 this.create(); // Call create manually after ensuring completion
            } else {
                 console.error(`Asset loading failed. ${this.load.failed.size} files failed.`);
                 // Display a persistent error message?
                 this.add.text(width / 2, height / 2, `Error loading assets.
Check console.`, { color: '#ff0000', fontSize: '20px', align: 'center' }).setOrigin(0.5);
            }
        });
    }

    // create() is now called manually from the 'complete' handler
    create() {
        console.log("Preloader: Starting MainMenu");
        // Add a small delay or fade before starting next scene (optional)
        this.time.delayedCall(100, () => {
             this.scene.start('MainMenu');
        });
    }
}
