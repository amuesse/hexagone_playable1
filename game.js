// game.js

const Application = PIXI.Application;
const Container = PIXI.Container;
const Graphics = PIXI.Graphics;
const Text = PIXI.Text;
const TextStyle = PIXI.TextStyle;

const GRID_RADIUS = 6;
const START_HEALTH = 75;

// Create Pixi Application
const app = new Application({ 
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x333333,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
});
document.getElementById('game-container').appendChild(app.view);

// prevent default touch behavior
app.view.style.touchAction = 'none';

function calculateHexSize() {
    const smaller = Math.min(window.innerWidth, window.innerHeight);
    return Math.max(20, Math.min(25, smaller / (GRID_RADIUS * 4)));
}

let HEX_SIZE = calculateHexSize();
let playerPosition = { q: 0, r: 0 };
let playerHealth = START_HEALTH;
const hexData = {};

const directions = [
    {q: +1, r: 0}, {q: +1, r: -1}, {q: 0, r: -1},
    {q: -1, r: 0}, {q: -1, r: +1}, {q: 0, r: +1}
];

const gridContainer = new Container();
app.stage.addChild(gridContainer);

// Center the grid container
gridContainer.position.set(
    app.screen.width / 2,
    app.screen.height / 2
);

function hexToPixel(q, r) {
    const x = HEX_SIZE * (Math.sqrt(3) * q + Math.sqrt(3)/2 * r);
    const y = HEX_SIZE * (3/2 * r);
    return {x, y};
}

function positionHexSprite(sprite, q, r) {
    const {x, y} = hexToPixel(q, r);
    sprite.x = x;
    sprite.y = y;
}

function movePlayerTo(q, r) {
    const oldQ = playerPosition.q;
    const oldR = playerPosition.r;
    const cellKey = `${q},${r}`;
    
    if (!hexData[cellKey]) return;

    playerPosition = {q, r};
    positionHexSprite(playerHex, q, r);
    
    playerHealth += hexData[cellKey].value;
    updatePlayerHexHealth();

    if (playerHealth <= 0) {
        alert("You died!");
        playerHealth = START_HEALTH;
        updatePlayerHexHealth();
        playerPosition = { q: 0, r: 0 };
        positionHexSprite(playerHex, 0, 0);
        return;
    }

    const oldKey = `${oldQ},${oldR}`;
    if (oldKey in hexData && !(oldQ===q && oldR===r)) {
        const decay = Math.floor(Math.random() * 100) + 1;
        hexData[oldKey].value -= decay;
        updateHexAppearance(oldQ, oldR);
    }

    if (hexData[cellKey].originalColor === 0x99ccff) {
        explodeBoardToGreen();
    }
}

function generateHexGrid() {
    for (let q = -GRID_RADIUS; q <= GRID_RADIUS; q++) {
        for (let r = -GRID_RADIUS; r <= GRID_RADIUS; r++) {
            if (Math.abs(q + r) <= GRID_RADIUS) {
                const val = Math.floor(Math.random() * 200) - 100;
                let color;
                if (Math.random() < 0.05 && !(q === 0 && r === 0)) {
                    color = 0x99ccff;
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
                    originalColor: color,
                    q: q,
                    r: r
                };

                if (q === 0 && r === 0) {
                    hexData[cellKey].value = 0;
                    hexData[cellKey].originalColor = 0x0000ff;
                }

                hexSprite.eventMode = 'static';
                hexSprite.cursor = 'pointer';
                
                // Store coordinates directly on sprite
                hexSprite.q = q;
                hexSprite.r = r;

                // Use single click handler
                hexSprite.on('pointerdown', () => {
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

    const valStyle = new TextStyle({
        fill: '#ffffff',
        fontSize: Math.max(12, Math.min(14, HEX_SIZE * 0.4)),
        fontFamily: 'Arial',
        fontWeight: 'bold',
    });
    
    const valText = new Text(textValue, valStyle);
    valText.resolution = 2;
    valText.anchor.set(0.5);
    valText.x = texture.width / 2;
    valText.y = texture.height / 2;
    sprite.addChild(valText);
    sprite.valText = valText;

    return sprite;
}

function drawHex(g, size, color) {
    const corners = [];
    for (let i = 0; i < 6; i++) {
        const angle = (60 * i - 30) * (Math.PI / 180);
        corners.push({
            x: size * Math.cos(angle),
            y: size * Math.sin(angle)
        });
    }

    g.beginFill(color);
    g.lineStyle(2, 0x000000);
    g.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 6; i++) {
        g.lineTo(corners[i].x, corners[i].y);
    }
    g.closePath();
    g.endFill();
}

function isAdjacent(a, b) {
    const dq = b.q - a.q;
    const dr = b.r - a.r;
    for (const dir of directions) {
        if (dir.q === dq && dir.r === dr) return true;
    }
    return false;
}

function explodeBoardToGreen() {
    for (let key in hexData) {
        const cell = hexData[key];
        cell.value = 10;
        updateHexAppearanceFromVal(key);
    }
}

function updateHexAppearance(q, r) {
    const cellKey = `${q},${r}`;
    if (!hexData[cellKey]) return;
    updateHexAppearanceFromVal(cellKey);
}

function updateHexAppearanceFromVal(cellKey) {
    const cell = hexData[cellKey];
    const val = cell.value;
    let color = val > 0 ? 0x00aa00 : 0xaa0000;
    
    const sprite = cell.sprite;
    sprite.removeChildren();

    const g = new Graphics();
    drawHex(g, HEX_SIZE, color);
    const texture = app.renderer.generateTexture(g);

    sprite.clear();
    sprite.beginTextureFill({ texture });
    sprite.drawRect(0, 0, texture.width, texture.height);
    sprite.endFill();

    const valStyle = new TextStyle({
        fill: '#ffffff',
        fontSize: Math.max(12, Math.min(14, HEX_SIZE * 0.4)),
        fontFamily: 'Arial',
        fontWeight: 'bold'
    });
    const valText = new Text(Math.abs(val).toString(), valStyle);
    valText.resolution = 2;
    valText.anchor.set(0.5);
    valText.x = texture.width / 2;
    valText.y = texture.height / 2;
    sprite.addChild(valText);
    sprite.valText = valText;
}

function updatePlayerHexHealth() {
    playerHex.valText.text = playerHealth.toString();
}

function handleResize() {
    // Resize renderer
    app.renderer.resize(window.innerWidth, window.innerHeight);
    
    // Update hex size
    HEX_SIZE = calculateHexSize();
    
    // Center grid container
    gridContainer.position.set(
        app.screen.width / 2,
        app.screen.height / 2
    );

    // Calculate bounds
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    for (let key in hexData) {
        const [q, r] = key.split(',').map(Number);
        const {x, y} = hexToPixel(q, r);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
    }
    
    // Calculate scale
    const gridWidth = maxX - minX + HEX_SIZE * 2;
    const gridHeight = maxY - minY + HEX_SIZE * 2;
    
    const scaleX = (app.screen.width * 0.8) / gridWidth;
    const scaleY = (app.screen.height * 0.8) / gridHeight;
    const scale = Math.min(scaleX, scaleY);
    
    gridContainer.scale.set(scale);

    // Update all hex positions
    for (let key in hexData) {
        const [q, r] = key.split(',').map(Number);
        const hex = hexData[key];
        positionHexSprite(hex.sprite, q, r);
    }
    
    // Update player position
    positionHexSprite(playerHex, playerPosition.q, playerPosition.r);
}

// Initialize game
app.stage.eventMode = 'static';
generateHexGrid();
const playerHex = createHexSprite(0x0000ff, playerHealth.toString());
positionHexSprite(playerHex, playerPosition.q, playerPosition.r);
gridContainer.addChild(playerHex);
handleResize();

// Event listeners
window.addEventListener('resize', handleResize);