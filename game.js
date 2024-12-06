// game.js

// Using the globally defined PIXI (no imports)
const Application = PIXI.Application;
const Container = PIXI.Container;
const Graphics = PIXI.Graphics;
const Text = PIXI.Text;
const TextStyle = PIXI.TextStyle;

// Configurable parameters
const GRID_RADIUS = 10; // How far the grid extends from the center
const HEX_SIZE = 40;    // The radius of a single hex cell
const START_HEALTH = 75;

let playerPosition = { q: 0, r: 0 };
let playerHealth = START_HEALTH;
let zoomLevel = 1; // We'll keep the scale at 1.5 internally, just not show the zoom text.

const hexData = {}; // key: "q,r" => { value: number, sprite: Graphics, valText: Text }

// Directions for hex adjacency
const directions = [
    {q: +1, r: 0}, {q: +1, r: -1}, {q: 0, r: -1},
    {q: -1, r: 0}, {q: -1, r: +1}, {q: 0, r: +1}
];

// Create Pixi Application
const app = new Application({ 
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x333333,
    antialias: true,
    resolution: window.devicePixelRatio
});
document.getElementById('game-container').appendChild(app.view);

// Adjust to a 9:16 ratio for a phone in portrait mode
{
    const desiredRatio = 9/16;
    let w = window.innerWidth;
    let h = window.innerHeight;
    const actualRatio = w/h;
    if (actualRatio > desiredRatio) {
        // too wide, match height
        w = h * desiredRatio;
    } else {
        // too tall, match width
        h = w / desiredRatio;
    }
    app.renderer.resize(w, h);
}

const gridContainer = new Container();
app.stage.addChild(gridContainer);

// Enable new Pixi v7 event system
app.stage.eventMode = 'static';

// Just scale the grid for a ~50% zoom in
gridContainer.scale.set(1.5);

// Generate hex grid
generateHexGrid();

// Create player hex
const playerHex = createHexSprite(0x0000ff, playerHealth.toString());
positionHexSprite(playerHex, playerPosition.q, playerPosition.r);
gridContainer.addChild(playerHex);

// Functions

function movePlayerTo(q, r) {
    // Before moving, remember the old position
    const oldQ = playerPosition.q;
    const oldR = playerPosition.r;

    const cellKey = `${q},${r}`;
    if (!hexData[cellKey]) return;

    // Move player
    playerPosition = {q, r};
    positionHexSprite(playerHex, q, r);

    // Adjust health based on new cell
    playerHealth += hexData[cellKey].value;
    updatePlayerHexHealth();

    // Check if this cell was light blue (value doesn't determine color alone, let's re-check color)
    // Light blue was assigned 0x99ccff originally. Let's check if it was that color:
    // Actually, we know light blue was chosen at random with (val and color).
    // Let's store original color by checking if val was set that way.
    // Or we can just check if color was 0x99ccff:
    // We'll store a special flag if needed. Let's assume color: if val was chosen at random <0.05.
    // We didn't store a flag. Let's deduce:
    // If color was light blue, value would be displayed as positive or negative?
    // Light blue came from: if (Math.random() < 0.05 && !(q===0 && r===0)) {color=0x99ccff}
    // Let's store color in hexData. We'll modify the code to store color for each hex.

    // Wait, we need to know if it was light blue after landing. Let's add a property to hexData to store color.
    // We'll handle that by re-checking after we define hexData to store color.

    // After finishing code adjustments: We can just check hexData[cellKey].originalColor if we store it.
    // Let's do that by updating generateHexGrid and createHexSprite to store a 'originalColor' in hexData.

    // Check death
    if (playerHealth <= 0) {
        alert("You died!");
        playerHealth = START_HEALTH;
        updatePlayerHexHealth();
        playerPosition = { q: 0, r: 0 };
        positionHexSprite(playerHex, 0, 0);
    }

    // After moving onto the new cell, modify the old cell
    const oldKey = `${oldQ},${oldR}`;
    if (oldKey in hexData && !(oldQ===q && oldR===r)) {
        // Reduce old cell value by 1-100
        const decay = Math.floor(Math.random() * 100) + 1;
        hexData[oldKey].value -= decay;
        updateHexAppearance(oldQ, oldR);
    }

    // Check if landed on a light blue cell
    if (hexData[cellKey].originalColor === 0x99ccff) {
        // Explode the board: turn all green
        explodeBoardToGreen();
    }
}

function explodeBoardToGreen() {
    for (let key in hexData) {
        const cell = hexData[key];
        // Set value to a positive number, let's say 10
        cell.value = 10;
        // Update appearance to green
        updateHexAppearanceFromVal(key);
    }
}

function updatePlayerHexHealth() {
    // Update the text on the player hex
    // playerHex was created from createHexSprite, which returns a sprite with a valText child
    // We must find valText and update it
    const valText = playerHex.valText;
    valText.text = playerHealth.toString();
}

function isAdjacent(a, b) {
    const dq = b.q - a.q;
    const dr = b.r - a.r;
    for (const dir of directions) {
        if (dir.q === dq && dir.r === dr) return true;
    }
    return false;
}

function generateHexGrid() {
    for (let q = -GRID_RADIUS; q <= GRID_RADIUS; q++) {
        for (let r = -GRID_RADIUS; r <= GRID_RADIUS; r++) {
            if (Math.abs(q + r) <= GRID_RADIUS) {
                const val = Math.floor(Math.random() * 200) - 100;
                let color;
                if (Math.random() < 0.05 && !(q === 0 && r === 0)) {
                    color = 0x99ccff; // Light blue special cell
                } else {
                    color = val > 0 ? 0x00aa00 : 0xaa0000;
                }

                const hexSprite = createHexSprite(color, Math.abs(val).toString());
                positionHexSprite(hexSprite, q, r);
                gridContainer.addChild(hexSprite);

                const cellKey = `${q},${r}`;
                hexData[cellKey] = { 
                    value: val, 
                    sprite: hexSprite, 
                    valText: hexSprite.valText, 
                    originalColor: color
                };

                // Player start cell no negative effect
                if (q === 0 && r === 0) {
                    hexData[cellKey].value = 0;
                    hexData[cellKey].originalColor = 0x0000ff; // It's player start, blue was player only
                }

                // Make hex interactive
                hexSprite.eventMode = 'static';
                hexSprite.cursor = 'pointer';
                hexSprite.on('pointerdown', () => {
                    // Attempt move if adjacent
                    if (isAdjacent(playerPosition, {q, r})) {
                        movePlayerTo(q, r);
                    }
                });
            }
        }
    }
}

function createHexSprite(color, textValue) {
    const g = new Graphics();
    drawHex(g, HEX_SIZE, color);
    const texture = app.renderer.generateTexture(g);
    const sprite = new Graphics();
    sprite.beginTextureFill({ texture });
    sprite.drawRect(0, 0, texture.width, texture.height);
    sprite.endFill();

    const valStyle = new TextStyle({fill: '#ffffff', fontSize: 16});
    const valText = new Text(textValue, valStyle);
    valText.anchor.set(0.5);
    valText.x = texture.width / 2;
    valText.y = texture.height / 2;
    sprite.addChild(valText);

    // Store valText on sprite so we can update it later
    sprite.valText = valText;

    return sprite;
}

function drawHex(g, size, color) {
    const corners = hexCorners(size);
    g.beginFill(color);
    g.lineStyle(2, 0x000000);
    g.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 6; i++) {
        g.lineTo(corners[i].x, corners[i].y);
    }
    g.closePath();
    g.endFill();
}

function hexCorners(size) {
    const corners = [];
    for (let i = 0; i < 6; i++) {
        const angle = (60 * i - 30) * (Math.PI / 180);
        corners.push({x: size * Math.cos(angle), y: size * Math.sin(angle)});
    }
    return corners;
}

function hexToPixel(q, r) {
    const x = HEX_SIZE * (Math.sqrt(3)*q + (Math.sqrt(3)/2)*r);
    const y = HEX_SIZE * ((3/2)*r);
    return {x, y};
}

function positionHexSprite(sprite, q, r) {
    const {x, y} = hexToPixel(q, r);
    sprite.x = x + app.renderer.width / 2;
    sprite.y = y + app.renderer.height / 2;
}

function updateHexAppearance(q, r) {
    const cellKey = `${q},${r}`;
    if (!hexData[cellKey]) return;
    updateHexAppearanceFromVal(cellKey);
}

function updateHexAppearanceFromVal(cellKey) {
    // Re-draw the hex according to its current value
    const cell = hexData[cellKey];
    const val = cell.value;
    let color;
    if (cell.originalColor === 0x99ccff) {
        // If it was originally light blue, only turn green after explosion
        // If not exploded, keep it light blue. But we decided to change them once exploded only.
        // If exploded, we changed values to positive and updated originalColor. Let's just rely on val >0 green
        color = val > 0 ? 0x00aa00 : 0xaa0000;
    } else {
        color = val > 0 ? 0x00aa00 : 0xaa0000;
    }

    // Clear old graphics
    const sprite = cell.sprite;
    sprite.removeChildren(); // remove valText, will add later again

    const g = new Graphics();
    drawHex(g, HEX_SIZE, color);
    const texture = app.renderer.generateTexture(g);

    sprite.clear();
    sprite.beginTextureFill({ texture });
    sprite.drawRect(0, 0, texture.width, texture.height);
    sprite.endFill();

    // Re-create valText
    const valStyle = new TextStyle({fill: '#ffffff', fontSize: 16});
    const valText = new Text(Math.abs(val).toString(), valStyle);
    valText.anchor.set(0.5);
    valText.x = texture.width / 2;
    valText.y = texture.height / 2;
    sprite.addChild(valText);
    sprite.valText = valText;

    // Update originalColor if needed (if we exploded board, everything is green now)
}

