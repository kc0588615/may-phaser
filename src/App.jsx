import { useRef, useState, useEffect } from 'react';
// Phaser import might not be strictly needed in App.jsx if all Phaser logic is in PhaserGame and its scenes
// import Phaser from 'phaser';
import { PhaserGame } from './PhaserGame';       // Your existing PhaserGame component
import CesiumMap from './components/CesiumMap';  // Import the new CesiumMap component
import { EventBus } from './game/EventBus';      // If App.jsx itself needs to react to game events

function App() {
    const phaserRef = useRef(); // Ref to access Phaser game instance and current scene

    // Example state from template (you might not need these for the match-3 game directly in App.jsx)
    // const [spritePosition, setSpritePosition] = useState({ x: 0, y: 0 });
    // const [canMoveSprite, setCanMoveSprite] = useState(true);

    // This callback is for when PhaserGame signals that a scene is ready
    const handlePhaserSceneReady = (scene) => {
        console.log('App.jsx: Phaser scene ready -', scene.scene.key);
        // You can store the scene or game instance if App.jsx needs to directly interact
        // phaserRef.current.scene = scene; // PhaserGame.jsx already does this
        // setCanMoveSprite(scene.scene.key !== 'MainMenu'); // Example from template
    };

    // --- Layout Styling ---
    const appStyle = {
        display: 'flex',
        flexDirection: 'row', // Side-by-side: Cesium Map | Phaser Game + UI
        width: '100vw',
        height: '100vh',
        overflow: 'hidden'
    };
    const cesiumContainerStyle = {
        flex: 1, // Adjust ratio as needed, e.g., flex: 2 for larger map
        minWidth: '400px', // Ensure map is usable
        height: '100%',
        borderRight: '2px solid #555' // Visual separator
    };
    const phaserAndUiContainerStyle = {
        flex: 1, // Adjust ratio as needed, e.g., flex: 1
        minWidth: '400px', // Ensure game area is usable
        display: 'flex',
        flexDirection: 'column', // Stack Phaser game above other UI
        height: '100%'
    };
    const phaserGameWrapperStyle = {
        width: '100%',
        height: 'calc(100% - 150px)', // Example: Game takes most space, 150px for UI below
        // Or use flex: 1 to take available space if UI below has fixed height
        // flex: 1,
        display: 'flex', // Needed for PhaserGame's internal #game-container to size correctly
        alignItems: 'center',
        justifyContent: 'center'
    };
    const gameUiPanelStyle = {
        width: '100%',
        height: '150px', // Fixed height for UI panel
        padding: '10px',
        boxSizing: 'border-box',
        borderTop: '2px solid #555',
        overflowY: 'auto', // If UI content might exceed height
        backgroundColor: '#282c34', // Dark background for UI panel
        color: 'white'
    };


    // --- Example UI interaction functions (from template, adapt or remove) ---
    // const changeScene = () => {
    //     if (phaserRef.current?.scene) {
    //         phaserRef.current.scene.changeScene(); // Assuming your scene has 'changeScene'
    //     }
    // };
    // const moveSpriteInMenu = () => {
    //     if (phaserRef.current?.scene?.scene.key === 'MainMenu' && phaserRef.current.scene.moveLogo) {
    //         phaserRef.current.scene.moveLogo(({ x, y }) => setSpritePosition({ x, y }));
    //     }
    // };
    // const addSpriteToGame = () => {
    //     if (phaserRef.current?.scene) {
    //         const scene = phaserRef.current.scene;
    //         const x = Phaser.Math.Between(64, scene.scale.width - 64);
    //         const y = Phaser.Math.Between(64, scene.scale.height - 64);
    //         const star = scene.add.sprite(x, y, 'star'); // Assuming 'star' is loaded
    //         scene.add.tween({ targets: star, duration: 1000, alpha: 0, yoyo: true, repeat: -1 });
    //     }
    // };

    return (
        <div id="app-container" style={appStyle}>
            <div id="cesium-map-wrapper" style={cesiumContainerStyle}>
                <CesiumMap />
            </div>

            <div id="phaser-and-ui-wrapper" style={phaserAndUiContainerStyle}>
                <div id="phaser-game-wrapper" style={phaserGameWrapperStyle}>
                    {/* PhaserGame component expects its parent div to allow it to fill */}
                    {/* The actual <div id="game-container"></div> is created by PhaserGame.jsx */}
                    <PhaserGame ref={phaserRef} currentActiveScene={handlePhaserSceneReady} />
                </div>

                <div id="game-ui-panel" style={gameUiPanelStyle}>
                    <h2>Game Controls / Info</h2>
                    {/* Placeholder for Player Inventory UI or other game-related React UI */}
                    {/* For example: <PlayerInventory playerId="currentPlayer" /> */}
                    <p>Selected location data will appear in the Phaser game board.</p>
                    <p>Interact with the Cesium map to choose a location.</p>

                    {/* Example buttons from template (can be removed or adapted) */}
                    {/* <div>
                        <button className="button" onClick={changeScene}>Change Scene (Example)</button>
                    </div>
                    <div>
                        <button disabled={!canMoveSprite} className="button" onClick={moveSpriteInMenu}>Toggle Movement (Example)</button>
                    </div>
                    <div className="spritePosition">Sprite Position (Example):
                        <pre>{`{\n  x: ${spritePosition.x}\n  y: ${spritePosition.y}\n}`}</pre>
                    </div>
                    <div>
                        <button className="button" onClick={addSpriteToGame}>Add New Sprite (Example)</button>
                    </div> */}
                </div>
            </div>
        </div>
    );
}

export default App;