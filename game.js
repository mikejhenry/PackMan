// ============================================
// CONSTANTS & CONFIGURATION
// ============================================

function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

const TILE_SIZE = 24;
const MAZE_WIDTH = 28;
const MAZE_HEIGHT = 31;
const CANVAS_WIDTH = TILE_SIZE * MAZE_WIDTH;
const CANVAS_HEIGHT = TILE_SIZE * MAZE_HEIGHT;

const TARGET_FPS = 60;
const FRAME_TIME = 1000 / TARGET_FPS;
const GHOST_UPDATE_INTERVAL = 500;

const GAME_STATE = {
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    DYING: 'dying',
    GAME_OVER: 'gameOver',
    LEVEL_COMPLETE: 'levelComplete'
};

const LEVEL_COLORS = {
    1: {
        background: '#0a0a1a',
        wall: '#00ffff',
        wallAccent: '#ff00ff',
        dot: '#ffff00',
        powerPellet: '#ffffff'
    },
    2: {
        background: '#1a2f1a',
        wall: '#4a7c4a',
        wallAccent: '#2a5a2a',
        dot: '#ff4444',
        powerPellet: '#ffd700'
    },
    3: {
        background: '#1a1a2e',
        wall: '#3a3a4e',
        wallAccent: '#5a5a6e',
        dot: '#ffdd44',
        powerPellet: '#ff8800'
    }
};

const GHOST_COLORS = {
    blinky: '#ff0000',
    pinky: '#ffb8ff',
    inky: '#00ffff',
    clyde: '#ffb852',
    frightened: '#0000ff'
};

const PLAYER_COLORS = {
    skin: '#C68642',
    hair: '#1a1a1a',
    glasses: '#333333',
    glassesFrame: '#ffffff',
    shirt: '#1a1a1a',
    jeans: '#1E3A5F',
    shoes: '#ffffff',
    shoeAccent: '#ff0000'
};

const SCORES = {
    dot: 10,
    powerPellet: 50,
    firstGhost: 200,
    secondGhost: 400,
    thirdGhost: 800,
    fourthGhost: 1600,
    levelComplete: 1000
};

const POWER_PELLET_DURATION = 8000;

// ============================================
// AUDIO ENGINE
// ============================================

class AudioEngine {
    constructor() {
        this.audioContext = null;
        this.musicEnabled = true;
        this.sfxEnabled = true;
        this.currentMusicOscillators = [];
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.initialized = true;
    }

    resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    playTone(startFreq, endFreq, duration, type = 'square', volume = 0.3) {
        if (!this.sfxEnabled || !this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(startFreq, this.audioContext.currentTime);

        if (endFreq !== startFreq) {
            oscillator.frequency.linearRampToValueAtTime(
                endFreq,
                this.audioContext.currentTime + duration / 1000
            );
        }

        gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(
            0.01,
            this.audioContext.currentTime + duration / 1000
        );

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration / 1000);
    }

    playDotEaten() {
        this.playTone(800, 600, 50, 'square', 0.2);
    }

    playPowerPellet() {
        const notes = [523, 659, 784];
        notes.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, freq, 100, 'sine', 0.3), i * 35);
        });
    }

    playGhostEaten() {
        this.playTone(400, 200, 200, 'sawtooth', 0.3);
    }

    playDeath() {
        const startFreq = 440;
        for (let i = 0; i < 12; i++) {
            setTimeout(() => {
                this.playTone(startFreq - (i * 30), startFreq - ((i + 1) * 30), 80, 'square', 0.25);
            }, i * 80);
        }
    }

    playLevelComplete() {
        const notes = [523, 659, 784, 1047];
        notes.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, freq, 150, 'sine', 0.3), i * 100);
        });
    }

    playGameOver() {
        this.playTone(200, 50, 1500, 'sawtooth', 0.3);
    }

    playGameStart() {
        const notes = [262, 330, 392, 523];
        notes.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, freq, 100, 'square', 0.25), i * 100);
        });
    }

    playBackgroundMusic(level) {
        if (!this.musicEnabled || !this.audioContext) return;

        this.stopMusic();

        const tempo = level === 1 ? 120 : level === 2 ? 90 : 110;
        const beatDuration = 60000 / tempo;

        const melodies = {
            1: [262, 330, 392, 330, 262, 330, 392, 523],
            2: [294, 392, 440, 392, 294, 349, 392, 440],
            3: [262, 294, 330, 349, 392, 349, 330, 294]
        };

        const melody = melodies[level] || melodies[1];
        let noteIndex = 0;

        const playNote = () => {
            if (!this.musicEnabled || this.currentMusicOscillators.length === 0) return;

            const freq = melody[noteIndex % melody.length];
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.type = level === 1 ? 'square' : level === 2 ? 'sine' : 'triangle';
            osc.frequency.value = freq;

            gain.gain.setValueAtTime(0.15, this.audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + beatDuration / 2000);

            osc.connect(gain);
            gain.connect(this.audioContext.destination);

            osc.start(this.audioContext.currentTime);
            osc.stop(this.audioContext.currentTime + beatDuration / 1000);

            this.currentMusicOscillators = [osc];

            noteIndex++;
            setTimeout(playNote, beatDuration);
        };

        this.currentMusicOscillators = [true];
        playNote();
    }

    stopMusic() {
        this.currentMusicOscillators.forEach(osc => {
            try { osc.stop(); } catch (e) {}
        });
        this.currentMusicOscillators = [];
    }

    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
        if (!this.musicEnabled) {
            this.stopMusic();
        }
        return this.musicEnabled;
    }

    toggleSFX() {
        this.sfxEnabled = !this.sfxEnabled;
        return this.sfxEnabled;
    }
}

const audio = new AudioEngine();

// ============================================
// INPUT HANDLER
// ============================================

class InputHandler {
    constructor() {
        this.nextDirection = null;
        this.keysPressed = {};

        this.keyMap = {
            'ArrowUp': 'up',
            'ArrowDown': 'down',
            'ArrowLeft': 'left',
            'ArrowRight': 'right',
            'w': 'up',
            'W': 'up',
            's': 'down',
            'S': 'down',
            'a': 'left',
            'A': 'left',
            'd': 'right',
            'D': 'right'
        };

        this.actionKeys = {
            'Enter': 'start',
            ' ': 'pause',
            'Escape': 'escape'
        };

        this.setupListeners();
    }

    setupListeners() {
        window.addEventListener('keydown', (e) => {
            this.keysPressed[e.key] = true;

            if (this.keyMap[e.key]) {
                e.preventDefault();
                this.nextDirection = this.keyMap[e.key];
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keysPressed[e.key] = false;
        });
    }

    getAction() {
        for (const [key, action] of Object.entries(this.actionKeys)) {
            if (this.keysPressed[key]) {
                this.keysPressed[key] = false;
                return action;
            }
        }
        return null;
    }

    isActionPressed(action) {
        for (const [key, act] of Object.entries(this.actionKeys)) {
            if (act === action && this.keysPressed[key]) {
                this.keysPressed[key] = false;
                return true;
            }
        }
        return false;
    }

    reset() {
        this.nextDirection = null;
    }
}

const input = new InputHandler();

// ============================================
// MAZE LAYOUTS
// ============================================

const MAZE_TEMPLATE = `
############################
#............##............#
#.####.#####.##.#####.####.#
#o####.#####.##.#####.####o#
#.####.#####.##.#####.####.#
#..........................#
#.####.##.########.##.####.#
#.####.##.########.##.####.#
#......##....##....##......#
######.##### ## #####.######
     #.##### ## #####.#
     #.##          ##.#
     #.## ###--### ##.#
######.## #      # ##.######
      .   #      #   .
######.## #      # ##.######
     #.## ######## ##.#
     #.##          ##.#
     #.## ######## ##.#
######.## ######## ##.######
#............##............#
#.####.#####.##.#####.####.#
#.####.#####.##.#####.####.#
#o..##.......  .......##..o#
###.##.##.########.##.##.###
###.##.##.########.##.##.###
#......##....##....##......#
#.##########.##.##########.#
#.##########.##.##########.#
#..........................#
############################
`;

function parseMaze(template) {
    const lines = template.trim().split('\n');
    const maze = [];
    let playerStart = { x: 14, y: 23 };
    let ghostHouse = { x: 14, y: 11 };
    let ghostSpawns = [
        { x: 12, y: 14, type: 'blinky' },
        { x: 14, y: 14, type: 'pinky' },
        { x: 13, y: 13, type: 'inky' },
        { x: 15, y: 14, type: 'clyde' }
    ];

    for (let y = 0; y < lines.length; y++) {
        const row = [];
        // Always iterate MAZE_WIDTH columns so short rows (e.g. tunnel row 14)
        // get padded with spaces instead of leaving undefined gaps that block movement
        for (let x = 0; x < MAZE_WIDTH; x++) {
            const char = lines[y][x] !== undefined ? lines[y][x] : ' ';
            row.push(char);

            if (char === 'P') {
                playerStart = { x, y };
            }
        }
        maze.push(row);
    }

    return {
        grid: maze,
        width: maze[0] ? maze[0].length : 0,
        height: maze.length,
        playerStart,
        ghostHouse,
        ghostSpawns
    };
}

function isWalkable(maze, x, y) {
    if (x < 0 || x >= maze.width || y < 0 || y >= maze.height) {
        if (y === 14 && (x < 0 || x >= maze.width)) {
            return true;
        }
        return false;
    }
    const tile = maze.grid[y][x];
    return tile !== '#' && tile !== undefined;
}

function isWall(maze, x, y) {
    if (x < 0 || x >= maze.width || y < 0 || y >= maze.height) {
        return true;
    }
    return maze.grid[y][x] === '#';
}

const maze = parseMaze(MAZE_TEMPLATE);

// ============================================
// ENTITY CLASSES
// ============================================

const DIRECTIONS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
};

class Player {
    constructor(x, y) {
        this.startX = x;
        this.startY = y;
        this.x = x;
        this.y = y;
        this.pixelX = x * TILE_SIZE + TILE_SIZE / 2;
        this.pixelY = y * TILE_SIZE + TILE_SIZE / 2;
        this.direction = 'left';
        this.nextDirection = null;
        this.speed = 2;
        this.lives = 3;
        this.score = 0;
        this.powered = false;
        this.powerTimer = 0;
        this.animFrame = 0;
        this.animTimer = 0;
        this.mouthOpen = true;
    }

    reset() {
        this.x = this.startX;
        this.y = this.startY;
        this.pixelX = this.x * TILE_SIZE + TILE_SIZE / 2;
        this.pixelY = this.y * TILE_SIZE + TILE_SIZE / 2;
        this.direction = 'left';
        this.nextDirection = null;
        this.powered = false;
        this.powerTimer = 0;
    }

    setDirection(dir) {
        this.nextDirection = dir;
    }

    update(maze, deltaTime) {
        if (this.powered) {
            this.powerTimer -= deltaTime;
            if (this.powerTimer <= 0) {
                this.powered = false;
            }
        }

        this.animTimer += deltaTime;
        if (this.animTimer > 100) {
            this.animTimer = 0;
            this.mouthOpen = !this.mouthOpen;
        }

        // Try to change direction if one is buffered
        if (this.nextDirection) {
            const nextDir = DIRECTIONS[this.nextDirection];
            // Use the tile the player is currently occupying, then step one tile
            // in the requested direction to find the actual target tile.
            // The old formula (pixelX + nextDir*TS/2) resolves to the current tile
            // for negative directions (UP/LEFT), letting the player walk into walls.
            const currentTileX = Math.floor(this.pixelX / TILE_SIZE);
            const currentTileY = Math.floor(this.pixelY / TILE_SIZE);
            const tileCenterX = currentTileX * TILE_SIZE + TILE_SIZE / 2;
            const tileCenterY = currentTileY * TILE_SIZE + TILE_SIZE / 2;
            const targetTileX = currentTileX + nextDir.x;
            const targetTileY = currentTileY + nextDir.y;

            // Allow turning within ±¼ tile of the tile centre (6px window each side)
            const alignedX = Math.abs(this.pixelX - tileCenterX) <= TILE_SIZE / 4;
            const alignedY = Math.abs(this.pixelY - tileCenterY) <= TILE_SIZE / 4;

            if (isWalkable(maze, targetTileX, targetTileY)) {
                if ((this.nextDirection === 'up' || this.nextDirection === 'down') && alignedX) {
                    this.direction = this.nextDirection;
                    this.nextDirection = null;
                    this.pixelX = tileCenterX;
                } else if ((this.nextDirection === 'left' || this.nextDirection === 'right') && alignedY) {
                    this.direction = this.nextDirection;
                    this.nextDirection = null;
                    this.pixelY = tileCenterY;
                }
            }
        }

        // Move in current direction
        const dir = DIRECTIONS[this.direction];
        const newPixelX = this.pixelX + dir.x * this.speed;
        const newPixelY = this.pixelY + dir.y * this.speed;

        // Use TS/2-1 as the leading-edge offset so the check tile is the tile
        // *just* ahead, not the current tile.  The old -2 margin let the player
        // slip 2px into a wall before detecting the collision, leaving them
        // off-centre and unable to queue a turn.
        const checkX = newPixelX + dir.x * (TILE_SIZE / 2 - 1);
        const checkY = newPixelY + dir.y * (TILE_SIZE / 2 - 1);
        const nextTileX = Math.floor(checkX / TILE_SIZE);
        const nextTileY = Math.floor(checkY / TILE_SIZE);

        if (isWalkable(maze, nextTileX, nextTileY)) {
            this.pixelX = newPixelX;
            this.pixelY = newPixelY;
        } else {
            // Snap to the centre of the tile being occupied so the alignment
            // check in the direction-change block always has a clean reference.
            if (dir.x !== 0) {
                this.pixelX = Math.floor(this.pixelX / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
            }
            if (dir.y !== 0) {
                this.pixelY = Math.floor(this.pixelY / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
            }
        }

        // Tunnel wrapping — use += / -= to preserve the sub-tile offset so
        // entry on the far side mirrors exit position exactly.
        if (this.pixelX < 0) {
            this.pixelX += CANVAS_WIDTH;
        } else if (this.pixelX >= CANVAS_WIDTH) {
            this.pixelX -= CANVAS_WIDTH;
        }

        this.x = Math.floor(this.pixelX / TILE_SIZE);
        this.y = Math.floor(this.pixelY / TILE_SIZE);
    }

    activatePowerMode() {
        this.powered = true;
        this.powerTimer = POWER_PELLET_DURATION;
    }

    render(ctx, level) {
        const x = this.pixelX;
        const y = this.pixelY;
        const size = TILE_SIZE - 4;

        ctx.save();
        ctx.translate(x, y);

        const rotations = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
        ctx.rotate(rotations[this.direction] || 0);

        this.drawCharacter(ctx, size);

        ctx.restore();
    }

    drawCharacter(ctx, size) {
        const s = size;
        const halfS = s / 2;

        ctx.fillStyle = PLAYER_COLORS.skin;
        ctx.beginPath();
        ctx.arc(0, -2, halfS * 0.7, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = PLAYER_COLORS.hair;
        for (let i = -3; i <= 3; i++) {
            ctx.beginPath();
            ctx.arc(i * 3, -halfS * 0.5, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        for (let i = -2; i <= 2; i++) {
            ctx.beginPath();
            ctx.arc(i * 3.5, -halfS * 0.65, 3.5, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.strokeStyle = PLAYER_COLORS.glassesFrame;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(-5, 0, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(5, 0, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 0);
        ctx.stroke();
        ctx.fillStyle = 'rgba(200, 200, 200, 0.3)';
        ctx.beginPath();
        ctx.arc(-5, 0, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(5, 0, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = PLAYER_COLORS.shirt;
        ctx.beginPath();
        ctx.roundRect(-halfS * 0.5, halfS * 0.2, halfS, halfS * 0.6, 2);
        ctx.fill();

        ctx.fillStyle = PLAYER_COLORS.jeans;
        ctx.fillRect(-halfS * 0.4, halfS * 0.7, halfS * 0.3, halfS * 0.3);
        ctx.fillRect(halfS * 0.1, halfS * 0.7, halfS * 0.3, halfS * 0.3);

        ctx.fillStyle = PLAYER_COLORS.shoes;
        ctx.fillRect(-halfS * 0.45, halfS * 0.95, halfS * 0.35, 4);
        ctx.fillRect(halfS * 0.1, halfS * 0.95, halfS * 0.35, 4);
        ctx.fillStyle = PLAYER_COLORS.shoeAccent;
        ctx.fillRect(-halfS * 0.4, halfS * 0.97, halfS * 0.08, 2);
        ctx.fillRect(halfS * 0.15, halfS * 0.97, halfS * 0.08, 2);

        if (this.powered) {
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 + Math.sin(Date.now() / 100) * 0.3})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, halfS * 1.2, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}

class Ghost {
    constructor(x, y, type, color) {
        this.startX = x;
        this.startY = y;
        this.x = x;
        this.y = y;
        this.pixelX = x * TILE_SIZE + TILE_SIZE / 2;
        this.pixelY = y * TILE_SIZE + TILE_SIZE / 2;
        this.type = type;
        this.color = color;
        this.direction = 'up';
        this.speed = 1.8;
        this.state = 'chase';
        this.frightenedTimer = 0;
        this.eaten = false;
        this.homeTimer = 0;
        this.lastDecisionTime = 0;
        this.animFrame = 0;
        this.animTimer = 0;
        this.targetX = 0;
        this.targetY = 0;
    }

    reset() {
        this.x = this.startX;
        this.y = this.startY;
        this.pixelX = this.x * TILE_SIZE + TILE_SIZE / 2;
        this.pixelY = this.y * TILE_SIZE + TILE_SIZE / 2;
        this.direction = 'up';
        this.state = 'chase';
        this.frightenedTimer = 0;
        this.eaten = false;
        this.homeTimer = 0;
    }

    setFrightened(duration) {
        if (this.state !== 'eaten') {
            this.state = 'frightened';
            this.frightenedTimer = duration;
            const opposites = { up: 'down', down: 'up', left: 'right', right: 'left' };
            this.direction = opposites[this.direction];
        }
    }

    setEaten() {
        this.eaten = true;
        this.state = 'eaten';
        this.homeTimer = 2000;
    }

    calculateTarget(player, ghosts) {
        switch (this.type) {
            case 'blinky':
                this.targetX = player.x;
                this.targetY = player.y;
                break;

            case 'pinky':
                const pDir = DIRECTIONS[player.direction];
                this.targetX = player.x + pDir.x * 4;
                this.targetY = player.y + pDir.y * 4;
                break;

            case 'inky':
                if (Math.random() < 0.6) {
                    this.targetX = Math.floor(Math.random() * maze.width);
                    this.targetY = Math.floor(Math.random() * maze.height);
                } else {
                    this.targetX = maze.width - 1;
                    this.targetY = maze.height - 1;
                }
                break;

            case 'clyde':
                const dist = Math.abs(this.x - player.x) + Math.abs(this.y - player.y);
                if (dist > 8) {
                    this.targetX = player.x;
                    this.targetY = player.y;
                } else {
                    this.targetX = 0;
                    this.targetY = maze.height - 1;
                }
                break;
        }
    }

    findPath(maze, targetX, targetY) {
        const startTile = { x: this.x, y: this.y };
        const queue = [{ ...startTile, path: [] }];
        const visited = new Set();
        visited.add(`${startTile.x},${startTile.y}`);

        const maxDepth = 10;

        while (queue.length > 0) {
            const current = queue.shift();

            if (current.path.length > maxDepth) {
                return current.path[0] || this.direction;
            }

            const dirs = ['up', 'down', 'left', 'right'];
            for (const dir of dirs) {
                const d = DIRECTIONS[dir];
                const newX = current.x + d.x;
                const newY = current.y + d.y;

                if (!isWalkable(maze, newX, newY)) continue;
                if (visited.has(`${newX},${newY}`)) continue;

                const newPath = [...current.path, dir];

                if (newX === targetX && newY === targetY) {
                    return newPath[0];
                }

                visited.add(`${newX},${newY}`);
                queue.push({ x: newX, y: newY, path: newPath });
            }
        }

        const validDirs = ['up', 'down', 'left', 'right'].filter(dir => {
            const d = DIRECTIONS[dir];
            return isWalkable(maze, this.x + d.x, this.y + d.y);
        });
        return validDirs[Math.floor(Math.random() * validDirs.length)] || this.direction;
    }

    getOppositeDirection(dir) {
        const opposites = { up: 'down', down: 'up', left: 'right', right: 'left' };
        return opposites[dir];
    }

    update(maze, player, ghosts, deltaTime, currentTime) {
        if (this.state === 'frightened') {
            this.frightenedTimer -= deltaTime;
            if (this.frightenedTimer <= 0) {
                this.state = 'chase';
            }
        }

        if (this.state === 'eaten') {
            this.homeTimer -= deltaTime;
            if (this.homeTimer <= 0) {
                this.eaten = false;
                this.state = 'chase';
                this.pixelX = this.startX * TILE_SIZE + TILE_SIZE / 2;
                this.pixelY = this.startY * TILE_SIZE + TILE_SIZE / 2;
                this.x = this.startX;
                this.y = this.startY;
            }
            return;
        }

        this.animTimer += deltaTime;
        if (this.animTimer > 150) {
            this.animTimer = 0;
            this.animFrame = (this.animFrame + 1) % 2;
        }

        if (currentTime - this.lastDecisionTime > GHOST_UPDATE_INTERVAL) {
            this.lastDecisionTime = currentTime;

            if (this.state === 'frightened') {
                const validDirs = ['up', 'down', 'left', 'right'].filter(dir => {
                    const d = DIRECTIONS[dir];
                    const newX = this.x + d.x;
                    const newY = this.y + d.y;
                    return isWalkable(maze, newX, newY) && dir !== this.getOppositeDirection(this.direction);
                });
                if (validDirs.length > 0) {
                    this.direction = validDirs[Math.floor(Math.random() * validDirs.length)];
                }
            } else {
                this.calculateTarget(player, ghosts);
                const newDir = this.findPath(maze, this.targetX, this.targetY);
                if (newDir !== this.getOppositeDirection(this.direction)) {
                    this.direction = newDir;
                }
            }
        }

        const dir = DIRECTIONS[this.direction];
        const speed = this.state === 'frightened' ? this.speed * 0.5 : this.speed;
        const newPixelX = this.pixelX + dir.x * speed;
        const newPixelY = this.pixelY + dir.y * speed;

        const checkX = newPixelX + dir.x * (TILE_SIZE / 2 - 2);
        const checkY = newPixelY + dir.y * (TILE_SIZE / 2 - 2);
        const nextTileX = Math.floor(checkX / TILE_SIZE);
        const nextTileY = Math.floor(checkY / TILE_SIZE);

        if (isWalkable(maze, nextTileX, nextTileY)) {
            this.pixelX = newPixelX;
            this.pixelY = newPixelY;
        }

        if (this.pixelX < 0) {
            this.pixelX = CANVAS_WIDTH;
        } else if (this.pixelX > CANVAS_WIDTH) {
            this.pixelX = 0;
        }

        this.x = Math.floor(this.pixelX / TILE_SIZE);
        this.y = Math.floor(this.pixelY / TILE_SIZE);
    }

    render(ctx, level) {
        if (this.eaten) return;

        const x = this.pixelX;
        const y = this.pixelY;
        const size = TILE_SIZE - 4;

        ctx.save();
        ctx.translate(x, y);

        let color = this.color;
        if (this.state === 'frightened') {
            if (this.frightenedTimer < 2000 && Math.floor(Date.now() / 200) % 2 === 0) {
                color = '#ffffff';
            } else {
                color = GHOST_COLORS.frightened;
            }
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, -2, size / 2 - 2, Math.PI, 0, false);
        ctx.lineTo(size / 2 - 2, size / 2 - 4);

        const waveHeight = 3;
        const waveCount = 4;
        const waveWidth = (size - 4) / waveCount;
        for (let i = 0; i < waveCount; i++) {
            const wx = size / 2 - 2 - (i + 1) * waveWidth;
            const wy = size / 2 - 4 + (i % 2 === 0 ? waveHeight : 0);
            ctx.lineTo(wx, wy);
        }
        ctx.closePath();
        ctx.fill();

        if (this.state === 'frightened') {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(-4, -2, 2, 0, Math.PI * 2);
            ctx.arc(4, -2, 2, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.ellipse(-4, -2, 4, 5, 0, 0, Math.PI * 2);
            ctx.ellipse(4, -2, 4, 5, 0, 0, Math.PI * 2);
            ctx.fill();

            const pupilOffset = DIRECTIONS[this.direction];
            ctx.fillStyle = '#0000aa';
            ctx.beginPath();
            ctx.arc(-4 + pupilOffset.x * 2, -2 + pupilOffset.y * 2, 2, 0, Math.PI * 2);
            ctx.arc(4 + pupilOffset.x * 2, -2 + pupilOffset.y * 2, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

// ============================================
// GAME STATE MANAGER
// ============================================

class GameState {
    constructor() {
        this.state = GAME_STATE.MENU;
        this.level = 1;
        this.score = 0;
        this.highScore = this.loadHighScore();
        this.lives = 3;
        this.dots = [];
        this.powerPellets = [];
        this.ghostCombo = 0;
        this.player = null;
        this.ghosts = [];
        this.paused = false;
        this.lastTime = 0;
        this.deltaTime = 0;
        // Death sequence
        this.dyingTimer = 0;
        this.deathX = 0;
        this.deathY = 0;
        // Drives the HUD life-icon animation (covers dying + 1s post-respawn)
        this.lifeAnimTimer = 0;
    }

    loadHighScore() {
        const scores = this.getHighScores();
        return scores.length > 0 ? scores[0].score : 0;
    }

    getHighScores() {
        try {
            const data = localStorage.getItem('pacmanHighScores');
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    }

    saveHighScore(initials, score) {
        const scores = this.getHighScores();
        scores.push({
            initials: initials.toUpperCase(),
            score: score,
            date: new Date().toISOString().split('T')[0]
        });
        scores.sort((a, b) => b.score - a.score);
        const top10 = scores.slice(0, 10);
        localStorage.setItem('pacmanHighScores', JSON.stringify(top10));
        return top10;
    }

    isHighScore(score) {
        const scores = this.getHighScores();
        return scores.length < 10 || score > scores[scores.length - 1]?.score;
    }

    init() {
        this.state = GAME_STATE.MENU;
        this.level = 1;
        this.score = 0;
        this.lives = 3;
        this.ghostCombo = 0;
        this.createEntities();
    }

    createEntities() {
        this.player = new Player(maze.playerStart.x, maze.playerStart.y);
        this.player.lives = this.lives;

        this.ghosts = [
            new Ghost(maze.ghostSpawns[0].x, maze.ghostSpawns[0].y, 'blinky', GHOST_COLORS.blinky),
            new Ghost(maze.ghostSpawns[1].x, maze.ghostSpawns[1].y, 'pinky', GHOST_COLORS.pinky),
            new Ghost(maze.ghostSpawns[2].x, maze.ghostSpawns[2].y, 'inky', GHOST_COLORS.inky),
            new Ghost(maze.ghostSpawns[3].x, maze.ghostSpawns[3].y, 'clyde', GHOST_COLORS.clyde)
        ];

        this.dots = [];
        this.powerPellets = [];
        this.parseDots();
    }

    parseDots() {
        for (let y = 0; y < maze.grid.length; y++) {
            for (let x = 0; x < maze.grid[y].length; x++) {
                const tile = maze.grid[y][x];
                if (tile === '.') {
                    this.dots.push({ x, y, eaten: false });
                } else if (tile === 'o') {
                    this.powerPellets.push({ x, y, eaten: false });
                }
            }
        }
    }

    startGame() {
        this.state = GAME_STATE.PLAYING;
        this.player.reset();
        this.ghosts.forEach(g => g.reset());
        audio.init();
        audio.resume();
        audio.playGameStart();
        setTimeout(() => audio.playBackgroundMusic(this.level), 1500);
    }

    pauseGame() {
        if (this.state === GAME_STATE.DYING) return;
        if (this.state === GAME_STATE.PLAYING) {
            this.state = GAME_STATE.PAUSED;
            audio.stopMusic();
        } else if (this.state === GAME_STATE.PAUSED) {
            this.state = GAME_STATE.PLAYING;
            audio.playBackgroundMusic(this.level);
        }
    }

    nextLevel() {
        this.level = (this.level % 3) + 1;
        this.player.reset();
        this.ghosts.forEach(g => g.reset());
        this.dots = [];
        this.powerPellets = [];
        this.parseDots();
        this.ghostCombo = 0;
        audio.playLevelComplete();
        audio.stopMusic();
        setTimeout(() => audio.playBackgroundMusic(this.level), 2000);
    }

    playerDeath() {
        this.lives--;
        this.player.lives = this.lives;
        // Capture death position for the burst-ring animation
        this.deathX = this.player.pixelX;
        this.deathY = this.player.pixelY;
        audio.playDeath();

        if (this.lives <= 0) {
            this.gameOver();
        } else {
            this.state = GAME_STATE.DYING;
            this.dyingTimer = 2000;
            // 3 s total: 2 s death screen + 1 s post-respawn HUD pulse
            this.lifeAnimTimer = 3000;
            this.ghostCombo = 0;
        }
    }

    gameOver() {
        this.state = GAME_STATE.GAME_OVER;
        audio.playGameOver();
    }

    update(deltaTime, currentTime) {
        this.deltaTime = deltaTime;
        this.lastTime = currentTime;

        // Tick life-icon animation during both DYING and PLAYING
        if (this.lifeAnimTimer > 0) {
            this.lifeAnimTimer = Math.max(0, this.lifeAnimTimer - deltaTime);
        }

        if (this.state === GAME_STATE.DYING) {
            this.dyingTimer -= deltaTime;
            if (this.dyingTimer <= 0) {
                this.state = GAME_STATE.PLAYING;
                this.player.reset();
                this.ghosts.forEach(g => g.reset());
            }
            return;
        }

        if (this.state !== GAME_STATE.PLAYING) return;

        // Pass buffered input direction to player before updating movement
        if (input.nextDirection !== null) {
            this.player.setDirection(input.nextDirection);
            input.nextDirection = null;
        }

        this.player.update(maze, deltaTime);

        this.ghosts.forEach(ghost => {
            ghost.update(maze, this.player, this.ghosts, deltaTime, currentTime);
        });

        this.checkDotCollisions();
        this.checkPowerPelletCollisions();
        this.checkGhostCollisions();
        this.checkLevelComplete();
    }

    checkDotCollisions() {
        for (const dot of this.dots) {
            if (dot.eaten) continue;

            if (this.player.x === dot.x && this.player.y === dot.y) {
                dot.eaten = true;
                this.score += SCORES.dot;
                this.player.score = this.score;
                audio.playDotEaten();
            }
        }
    }

    checkPowerPelletCollisions() {
        for (const pellet of this.powerPellets) {
            if (pellet.eaten) continue;

            if (this.player.x === pellet.x && this.player.y === pellet.y) {
                pellet.eaten = true;
                this.score += SCORES.powerPellet;
                this.player.score = this.score;
                this.ghostCombo = 0;
                this.player.activatePowerMode();
                audio.playPowerPellet();

                this.ghosts.forEach(g => {
                    g.setFrightened(POWER_PELLET_DURATION);
                });
            }
        }
    }

    checkGhostCollisions() {
        for (const ghost of this.ghosts) {
            if (ghost.eaten) continue;

            const dist = Math.abs(this.player.pixelX - ghost.pixelX) +
                         Math.abs(this.player.pixelY - ghost.pixelY);

            if (dist < TILE_SIZE * 0.8) {
                if (ghost.state === 'frightened') {
                    ghost.setEaten();
                    this.ghostCombo++;
                    const points = SCORES.firstGhost * Math.pow(2, this.ghostCombo - 1);
                    this.score += points;
                    this.player.score = this.score;
                    audio.playGhostEaten();
                } else if (ghost.state === 'chase') {
                    this.playerDeath();
                    return;
                }
            }
        }
    }

    checkLevelComplete() {
        const allDotsEaten = this.dots.every(d => d.eaten);
        const allPelletsEaten = this.powerPellets.every(p => p.eaten);

        if (allDotsEaten && allPelletsEaten) {
            this.score += SCORES.levelComplete;
            this.player.score = this.score;
            this.nextLevel();
        }
    }

    render(ctx) {
        const colors = LEVEL_COLORS[this.level];
        ctx.fillStyle = colors.background;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        this.renderMaze(ctx, colors);
        this.renderDots(ctx, colors);
        this.renderPowerPellets(ctx, colors);

        this.ghosts.forEach(g => g.render(ctx, this.level));

        if (this.player) {
            this.player.render(ctx, this.level);
        }
    }

    renderMaze(ctx, colors) {
        ctx.fillStyle = colors.wall;
        ctx.strokeStyle = colors.wallAccent;

        for (let y = 0; y < maze.grid.length; y++) {
            for (let x = 0; x < maze.grid[y].length; x++) {
                if (maze.grid[y][x] === '#') {
                    const px = x * TILE_SIZE;
                    const py = y * TILE_SIZE;

                    if (this.level === 1) {
                        ctx.shadowColor = colors.wallAccent;
                        ctx.shadowBlur = 5;
                    }

                    ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);

                    ctx.shadowBlur = 0;
                }
            }
        }
    }

    renderDots(ctx, colors) {
        ctx.fillStyle = colors.dot;

        for (const dot of this.dots) {
            if (dot.eaten) continue;

            const px = dot.x * TILE_SIZE + TILE_SIZE / 2;
            const py = dot.y * TILE_SIZE + TILE_SIZE / 2;

            ctx.beginPath();
            ctx.arc(px, py, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    renderPowerPellets(ctx, colors) {
        const pulse = 0.7 + Math.sin(Date.now() / 200) * 0.3;

        ctx.fillStyle = colors.powerPellet;

        for (const pellet of this.powerPellets) {
            if (pellet.eaten) continue;

            const px = pellet.x * TILE_SIZE + TILE_SIZE / 2;
            const py = pellet.y * TILE_SIZE + TILE_SIZE / 2;

            ctx.beginPath();
            ctx.arc(px, py, 6 * pulse, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

const game = new GameState();

// ============================================
// UI RENDERER
// ============================================

class UIRenderer {
    constructor(ctx) {
        this.ctx = ctx;
        this.initialsInput = '';
        this.inputActive = false;
    }

    render(game) {
        switch (game.state) {
            case GAME_STATE.MENU:
                this.renderMenu(game);
                break;
            case GAME_STATE.PLAYING:
                this.renderHUD(game);
                break;
            case GAME_STATE.DYING:
                this.renderHUD(game);
                this.renderDeathScreen(game);
                break;
            case GAME_STATE.PAUSED:
                this.renderHUD(game);
                this.renderPauseOverlay(game);
                break;
            case GAME_STATE.GAME_OVER:
                this.renderHUD(game);
                this.renderGameOver(game);
                break;
        }
    }

    renderMenu(game) {
        const ctx = this.ctx;

        ctx.fillStyle = '#ffff00';
        ctx.font = 'bold 36px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText("MIKE'S PAC-MAN", CANVAS_WIDTH / 2, 150);

        ctx.fillStyle = '#00ffff';
        ctx.font = '16px "Courier New", monospace';
        ctx.fillText('Press ENTER to Start', CANVAS_WIDTH / 2, 200);

        ctx.fillStyle = '#ffffff';
        ctx.font = '14px "Courier New", monospace';
        ctx.fillText('Controls: Arrow Keys or WASD', CANVAS_WIDTH / 2, 250);
        ctx.fillText('SPACE: Pause | M: Toggle Music', CANVAS_WIDTH / 2, 275);

        this.renderHighScores(game, CANVAS_WIDTH / 2, 350);
    }

    renderHighScores(game, x, y) {
        const ctx = this.ctx;
        const scores = game.getHighScores();

        ctx.fillStyle = '#ff00ff';
        ctx.font = 'bold 20px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('HIGH SCORES', x, y);

        ctx.fillStyle = '#ffffff';
        ctx.font = '14px "Courier New", monospace';

        if (scores.length === 0) {
            ctx.fillText('No scores yet!', x, y + 30);
        } else {
            scores.forEach((score, i) => {
                const text = `${i + 1}. ${score.initials} - ${score.score}`;
                ctx.fillText(text, x, y + 30 + i * 22);
            });
        }
    }

    renderHUD(game) {
        const ctx = this.ctx;
        const now = Date.now();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px "Courier New", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`SCORE: ${game.score}`, 10, 25);

        ctx.textAlign = 'center';
        ctx.fillText(`HIGH: ${game.highScore}`, CANVAS_WIDTH / 2, 25);

        ctx.textAlign = 'right';
        ctx.fillText(`LEVEL ${game.level}`, CANVAS_WIDTH - 10, 25);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('LIVES:', 10, CANVAS_HEIGHT - 10);

        const anim = game.lifeAnimTimer;          // 3000 → 0
        const animNorm = anim / 3000;             // 1 → 0 (intensity)

        // Remaining life icons — shimmer red ↔ white while anim is active
        for (let i = 0; i < game.lives; i++) {
            const ix = 80 + i * 25;
            const iy = CANVAS_HEIGHT - 15;
            ctx.save();
            if (anim > 0) {
                const rate = 180 - animNorm * 80;          // speeds up at start
                const shimmer = Math.sin(now / rate + i * 1.2);
                ctx.shadowColor = shimmer > 0 ? '#ff0000' : '#ffffff';
                ctx.shadowBlur = Math.abs(shimmer) * animNorm * 14;
            }
            this.drawMiniPlayer(ix, iy);
            ctx.restore();
        }

        // Ghost of the just-lost life — fades out over first second of anim
        if (anim > 2000) {
            const fade = (anim - 2000) / 1000;    // 1 → 0 over the first anim second
            const lx = 80 + game.lives * 25;
            const ly = CANVAS_HEIGHT - 15;
            ctx.save();
            ctx.globalAlpha = fade;
            ctx.shadowColor = '#ff0000';
            ctx.shadowBlur = 18 * fade;
            ctx.fillStyle = '#ff3333';
            ctx.beginPath();
            ctx.arc(lx, ly, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.restore();
        }
    }

    drawMiniPlayer(x, y) {
        const ctx = this.ctx;
        ctx.fillStyle = PLAYER_COLORS.skin;
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = PLAYER_COLORS.glassesFrame;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x - 3, y - 1, 3, 0, Math.PI * 2);
        ctx.arc(x + 3, y - 1, 3, 0, Math.PI * 2);
        ctx.stroke();
    }

    renderDeathScreen(game) {
        const ctx = this.ctx;
        const now = Date.now();
        // t: 0 → 1 over the 2-second death window
        const t = 1 - game.dyingTimer / 2000;

        // ── Dark vignette ──────────────────────────────────────────────────
        const vigAlpha = Math.min(t * 4, 1) * 0.78;
        ctx.fillStyle = `rgba(0,0,0,${vigAlpha})`;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // ── Burst rings from death point ───────────────────────────────────
        // Three rings, staggered, alternating red / white
        const ringPhase = Math.min(t / 0.55, 1);
        for (let ring = 0; ring < 3; ring++) {
            const delay = ring * 0.28;
            const rt = Math.max(0, Math.min(1, (ringPhase - delay) * 2.2));
            if (rt <= 0) continue;
            const radius = rt * 130;
            const alpha = (1 - rt) * 0.85;
            ctx.beginPath();
            ctx.arc(game.deathX, game.deathY, radius, 0, Math.PI * 2);
            ctx.strokeStyle = ring % 2 === 0
                ? `rgba(255,255,255,${alpha})`
                : `rgba(255,30,30,${alpha})`;
            ctx.lineWidth = Math.max(0.5, 3.5 - rt * 3);
            ctx.stroke();
        }

        // ── "LIFE LOST" text + pip row ─────────────────────────────────────
        // Fade in at t=0.18, hold, start fading at t=0.84
        const textIn  = Math.min(1, Math.max(0, (t - 0.18) / 0.14));
        const textOut = Math.min(1, Math.max(0, (0.90 - t) / 0.10));
        const textAlpha = Math.min(textIn, textOut);

        if (textAlpha > 0) {
            ctx.save();
            ctx.globalAlpha = textAlpha;

            // Pulsing red glow on the title
            const pulse = 0.55 + Math.sin(now / 110) * 0.45;
            ctx.shadowColor = '#ff0000';
            ctx.shadowBlur = 18 + pulse * 24;
            ctx.fillStyle = '#ff2020';
            ctx.font = 'bold 52px "Courier New", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('LIFE LOST', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 28);

            // Subtitle
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 8;
            ctx.fillStyle = '#ffffff';
            ctx.font = '16px "Courier New", monospace';
            const livesLeft = game.lives;
            ctx.fillText(
                `${livesLeft} ${livesLeft === 1 ? 'LIFE' : 'LIVES'} REMAINING`,
                CANVAS_WIDTH / 2,
                CANVAS_HEIGHT / 2 + 18
            );

            // Pip row — remaining lives as glowing white dots, lost as a red ×
            const pipR = 7;
            const pip  = 22;
            const maxLives = 3;
            const rowX = CANVAS_WIDTH / 2 - ((maxLives - 1) * pip) / 2;
            const rowY = CANVAS_HEIGHT / 2 + 52;

            for (let i = 0; i < maxLives; i++) {
                const px = rowX + i * pip;
                if (i < livesLeft) {
                    // Active — white with pulsing red halo
                    ctx.shadowColor = '#ff0000';
                    ctx.shadowBlur = 6 + pulse * 8;
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath();
                    ctx.arc(px, rowY, pipR, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    // Lost — dim red ×
                    ctx.shadowBlur = 0;
                    ctx.strokeStyle = 'rgba(200,30,30,0.55)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(px - pipR, rowY - pipR);
                    ctx.lineTo(px + pipR, rowY + pipR);
                    ctx.moveTo(px + pipR, rowY - pipR);
                    ctx.lineTo(px - pipR, rowY + pipR);
                    ctx.stroke();
                }
            }

            // Subtle red border pulse around the whole canvas
            const borderAlpha = pulse * 0.18;
            const grad = ctx.createRadialGradient(
                CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT * 0.25,
                CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT * 0.85
            );
            grad.addColorStop(0, 'rgba(0,0,0,0)');
            grad.addColorStop(1, `rgba(180,0,0,${borderAlpha})`);
            ctx.shadowBlur = 0;
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

            ctx.restore();
        }
    }

    renderPauseOverlay(game) {
        const ctx = this.ctx;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.fillStyle = '#ffff00';
        ctx.font = 'bold 36px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);

        ctx.fillStyle = '#ffffff';
        ctx.font = '16px "Courier New", monospace';
        ctx.fillText('Press SPACE to Resume', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);
    }

    renderGameOver(game) {
        const ctx = this.ctx;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.fillStyle = '#ff0000';
        ctx.font = 'bold 42px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 80);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px "Courier New", monospace';
        ctx.fillText(`Final Score: ${game.score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30);

        if (game.isHighScore(game.score)) {
            ctx.fillStyle = '#ffff00';
            ctx.font = 'bold 20px "Courier New", monospace';
            ctx.fillText('NEW HIGH SCORE!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 10);

            ctx.fillStyle = '#ffffff';
            ctx.font = '16px "Courier New", monospace';
            ctx.fillText('Enter Initials: ' + this.initialsInput + '_', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50);

            this.inputActive = true;
        } else {
            ctx.fillStyle = '#ffffff';
            ctx.font = '16px "Courier New", monospace';
            ctx.fillText('Press ENTER to Play Again', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 30);
        }
    }

    handleKeyPress(key) {
        if (!this.inputActive) return false;

        if (key.length === 1 && key.match(/[a-zA-Z]/) && this.initialsInput.length < 3) {
            this.initialsInput += key.toUpperCase();
            return true;
        } else if (key === 'Backspace' && this.initialsInput.length > 0) {
            this.initialsInput = this.initialsInput.slice(0, -1);
            return true;
        } else if (key === 'Enter' && this.initialsInput.length === 3) {
            return 'submit';
        }
        return false;
    }

    getInitials() {
        return this.initialsInput;
    }

    resetInput() {
        this.initialsInput = '';
        this.inputActive = false;
    }
}

// ============================================
// CANVAS SETUP
// ============================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

function scaleCanvas() {
    const maxWidth = window.innerWidth - 40;
    const maxHeight = window.innerHeight - 40;
    const scaleX = maxWidth / CANVAS_WIDTH;
    const scaleY = maxHeight / CANVAS_HEIGHT;
    const scale = Math.min(scaleX, scaleY, 1.5);

    canvas.style.width = `${CANVAS_WIDTH * scale}px`;
    canvas.style.height = `${CANVAS_HEIGHT * scale}px`;
}

scaleCanvas();
window.addEventListener('resize', scaleCanvas);

const ui = new UIRenderer(ctx);

window.addEventListener('keydown', (e) => {
    if (game.state === GAME_STATE.GAME_OVER && ui.inputActive) {
        const result = ui.handleKeyPress(e.key);
        if (result === 'submit') {
            game.saveHighScore(ui.getInitials(), game.score);
            game.highScore = game.loadHighScore();
            ui.resetInput();
        }
        if (result) {
            e.preventDefault();
        }
    }
});

// ============================================
// MAIN GAME LOOP
// ============================================

let lastFrameTime = 0;

function gameLoop(currentTime) {
    const deltaTime = currentTime - lastFrameTime;
    lastFrameTime = currentTime;

    handleInput();

    game.update(deltaTime, currentTime);

    game.render(ctx);
    ui.render(game);

    requestAnimationFrame(gameLoop);
}

function handleInput() {
    if (game.state === GAME_STATE.MENU && input.isActionPressed('start')) {
        audio.init();
        audio.resume();
        game.startGame();
    }

    if (game.state === GAME_STATE.PLAYING && input.isActionPressed('pause')) {
        game.pauseGame();
    }

    if (game.state === GAME_STATE.PAUSED && input.isActionPressed('pause')) {
        game.pauseGame();
    }

    if (game.state === GAME_STATE.GAME_OVER && !ui.inputActive && input.isActionPressed('start')) {
        game.init();
        game.startGame();
    }

    if (input.keysPressed['m'] || input.keysPressed['M']) {
        input.keysPressed['m'] = false;
        input.keysPressed['M'] = false;
        audio.toggleMusic();
    }
}

function init() {
    game.init();
    requestAnimationFrame(gameLoop);
}

init();
