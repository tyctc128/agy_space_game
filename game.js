/**
 * ============================================================================
 * Space Defender - RWD 8-Bit Pixel Art Space Invaders Game
 * Developed with HTML5 Canvas, Web Audio API, & Touch Controls
 * ============================================================================
 */

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. GAME CONSTANTS & CONFIGURATION
  // --------------------------------------------------------------------------
  const CANVAS_WIDTH = 960;
  const CANVAS_HEIGHT = 600;
  
  // Game States
  const GameState = {
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    LEVEL_CLEAR: 'level_clear',
    GAME_OVER: 'game_over'
  };

  // Pixel Art Scaling (each matrix cell = 3x3 canvas pixels)
  const PIXEL_SIZE = 3;

  // Pixel Art Matrices (1 = color, 0 = transparent)
  const SPRITES = {
    // Player Ship (13x8)
    player: [
      "0000010100000",
      "0000111110000",
      "0000111110000",
      "0111111111110",
      "1111111111111",
      "1111111111111",
      "1110000000111",
      "0100000000010"
    ],
    // Enemy Row 1 - Octopus / UFO (40 Points, 8x8)
    enemy1: [
      [
        "00111100",
        "01111110",
        "11111111",
        "11011011",
        "11111111",
        "00100100",
        "01011010",
        "10100101"
      ],
      [
        "00111100",
        "01111110",
        "11111111",
        "11011011",
        "11111111",
        "01011010",
        "10000001",
        "01000010"
      ]
    ],
    // Enemy Row 2 - Crab (30 Points, 11x8)
    enemy2: [
      [
        "00100000100",
        "00010001000",
        "00111111100",
        "01101110110",
        "11111111111",
        "10111111101",
        "10100000101",
        "00011011000"
      ],
      [
        "00100000100",
        "10010001001",
        "10111111101",
        "11101110111",
        "11111111111",
        "01111111110",
        "00100000100",
        "01000000010"
      ]
    ],
    // Enemy Row 3 - Jellyfish (20 Points, 11x8)
    enemy3: [
      [
        "00011111000",
        "01111111110",
        "11111111111",
        "11100100111",
        "11111111111",
        "00110001100",
        "01101110110",
        "11000000011"
      ],
      [
        "00011111000",
        "01111111110",
        "11111111111",
        "11100100111",
        "11111111111",
        "00011011000",
        "00110001100",
        "01100000110"
      ]
    ],
    // Enemy Row 4 - Invader Bug (10 Points, 11x8)
    enemy4: [
      [
        "00001110000",
        "00011111000",
        "00111111100",
        "01101110110",
        "01111111110",
        "00010001000",
        "00101010100",
        "01010001010"
      ],
      [
        "00001110000",
        "00011111000",
        "00111111100",
        "01101110110",
        "01111111110",
        "00101010100",
        "01000000010",
        "00100000100"
      ]
    ]
  };

  // Color Palette per Row
  const ENEMY_COLORS = [
    '#ff55ff', // Row 1: Pink / Magenta
    '#00e5ff', // Row 2: Cyan
    '#55ff55', // Row 3: Neon Green
    '#ffdd00'  // Row 4: Bright Gold
  ];

  // --------------------------------------------------------------------------
  // 2. AUDIO SYNTHESIZER (WEB AUDIO API)
  // --------------------------------------------------------------------------
  class SoundManager {
    constructor() {
      this.ctx = null;
      this.isMuted = localStorage.getItem('spaceDefenderMuted') === 'true';
    }

    init() {
      if (!this.ctx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          this.ctx = new AudioContextClass();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    toggleMute() {
      this.isMuted = !this.isMuted;
      localStorage.setItem('spaceDefenderMuted', this.isMuted);
      return this.isMuted;
    }

    // Player Shooting Sound (short laser sweep down)
    playPew() {
      if (this.isMuted || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.1);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.1);
      } catch (e) { console.error(e); }
    }

    // Enemy Explosion Sound (filtered white noise)
    playExplosion() {
      if (this.isMuted || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const bufferSize = this.ctx.sampleRate * 0.2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, now);
        filter.frequency.linearRampToValueAtTime(100, now + 0.2);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        noise.start(now);
      } catch (e) { console.error(e); }
    }

    // Player Hit Sound (heavy rumble & pitch drop)
    playPlayerHit() {
      if (this.isMuted || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.linearRampToValueAtTime(50, now + 0.3);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.3);
      } catch (e) { console.error(e); }
    }

    // Level Clear Fanfare (arpeggio)
    playLevelClear() {
      if (this.isMuted || !this.ctx) return;
      try {
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
          const now = this.ctx.currentTime + idx * 0.08;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now);

          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

          osc.connect(gain);
          gain.connect(this.ctx.destination);

          osc.start(now);
          osc.stop(now + 0.12);
        });
      } catch (e) { console.error(e); }
    }

    // Game Over Sound (descending chord)
    playGameOver() {
      if (this.isMuted || !this.ctx) return;
      try {
        const notes = [261.63, 220.00, 174.61, 130.81]; // C4, A3, F3, C3
        notes.forEach((freq, idx) => {
          const now = this.ctx.currentTime + idx * 0.15;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now);

          gain.gain.setValueAtTime(0.25, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

          osc.connect(gain);
          gain.connect(this.ctx.destination);

          osc.start(now);
          osc.stop(now + 0.25);
        });
      } catch (e) { console.error(e); }
    }
  }

  // --------------------------------------------------------------------------
  // 3. INPUT MANAGER (KEYBOARD & TOUCH)
  // --------------------------------------------------------------------------
  class InputManager {
    constructor(soundManager) {
      this.soundManager = soundManager;
      this.keys = {};
      this.touchState = {
        up: false,
        down: false,
        left: false,
        right: false,
        fire: false
      };

      this.isTouchDevice = false;
      this.forceTouchUI = false;

      this.setupKeyboard();
      this.setupTouchControls();
      this.detectTouchCapability();
    }

    detectTouchCapability() {
      this.isTouchDevice = (
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia('(pointer: coarse)').matches
      );
      this.updateTouchUI();
    }

    updateTouchUI() {
      const touchContainer = document.getElementById('touch-controls');
      if (this.isTouchDevice || this.forceTouchUI) {
        touchContainer.classList.remove('hidden');
      } else {
        touchContainer.classList.add('hidden');
      }
    }

    toggleTouchUIForce() {
      this.forceTouchUI = !this.forceTouchUI;
      this.updateTouchUI();
    }

    setupKeyboard() {
      const preventKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];

      window.addEventListener('keydown', (e) => {
        this.soundManager.init();
        
        if (preventKeys.includes(e.code) || preventKeys.includes(e.key)) {
          e.preventDefault();
        }
        this.keys[e.code] = true;
        this.keys[e.key] = true;
      });

      window.addEventListener('keyup', (e) => {
        if (preventKeys.includes(e.code) || preventKeys.includes(e.key)) {
          e.preventDefault();
        }
        this.keys[e.code] = false;
        this.keys[e.key] = false;
      });
    }

    setupTouchControls() {
      const buttonMap = [
        { id: 'btn-up', key: 'up' },
        { id: 'btn-down', key: 'down' },
        { id: 'btn-left', key: 'left' },
        { id: 'btn-right', key: 'right' },
        { id: 'btn-fire', key: 'fire' }
      ];

      buttonMap.forEach(item => {
        const btn = document.getElementById(item.id);
        if (!btn) return;

        const setPress = (active) => {
          this.soundManager.init();
          this.touchState[item.key] = active;
          if (active) {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        };

        // Pointer Events (supports multi-touch)
        btn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          btn.setPointerCapture(e.pointerId);
          setPress(true);
        });

        btn.addEventListener('pointerup', (e) => {
          e.preventDefault();
          setPress(false);
        });

        btn.addEventListener('pointercancel', (e) => {
          e.preventDefault();
          setPress(false);
        });

        // Touch event fallback
        btn.addEventListener('touchstart', (e) => {
          e.preventDefault();
          setPress(true);
        });

        btn.addEventListener('touchend', (e) => {
          e.preventDefault();
          setPress(false);
        });
      });
    }

    isUp() { return this.keys['ArrowUp'] || this.keys['KeyW'] || this.touchState.up; }
    isDown() { return this.keys['ArrowDown'] || this.keys['KeyS'] || this.touchState.down; }
    isLeft() { return this.keys['ArrowLeft'] || this.keys['KeyA'] || this.touchState.left; }
    isRight() { return this.keys['ArrowRight'] || this.keys['KeyD'] || this.touchState.right; }
    isFire() { return this.keys['Space'] || this.touchState.fire; }
    
    isPausePressed() {
      const pressed = this.keys['KeyP'];
      if (pressed) this.keys['KeyP'] = false; // consume press
      return pressed;
    }

    isRestartPressed() {
      const pressed = this.keys['KeyR'];
      if (pressed) this.keys['KeyR'] = false;
      return pressed;
    }
  }

  // --------------------------------------------------------------------------
  // 4. GAME ENGINE & LOGIC
  // --------------------------------------------------------------------------
  class SpaceDefenderGame {
    constructor() {
      this.canvas = document.getElementById('game-canvas');
      this.ctx = this.canvas.getContext('2d');

      this.sound = new SoundManager();
      this.input = new InputManager(this.sound);

      // State Management
      this.state = GameState.MENU;
      this.score = 0;
      this.highScore = parseInt(localStorage.getItem('spaceDefenderHighScore') || '0', 10);
      this.lives = 3;
      this.level = 1;

      // Entities
      this.player = null;
      this.enemies = [];
      this.playerBullets = [];
      this.enemyBullets = [];
      this.particles = [];
      this.stars = [];

      // Fleet Parameters
      this.fleetDirection = 1; // 1 = Right, -1 = Left
      this.fleetSpeed = 45;
      this.fleetDropDistance = 18;
      this.enemyShootTimer = 0;
      this.enemyShootInterval = 1.6;

      // Player Firing Cooldown
      this.lastPlayerShot = 0;
      this.playerShotCooldown = 0.18; // 180ms cooldown

      // Animation & Timing
      this.lastTimestamp = 0;
      this.levelClearTimer = 0;
      this.enemyAnimFrame = 0;
      this.enemyAnimTimer = 0;

      this.initBackgroundStars();
      this.setupUI();
      this.resetPlayer();

      // Start Game Loop
      requestAnimationFrame((t) => this.gameLoop(t));
    }

    setupUI() {
      const soundBtn = document.getElementById('sound-btn');
      const pauseBtn = document.getElementById('pause-btn');
      const toggleTouchBtn = document.getElementById('toggle-touch-btn');

      soundBtn.addEventListener('click', () => {
        this.sound.init();
        const muted = this.sound.toggleMute();
        soundBtn.textContent = muted ? '🔇 Mute' : '🔊 Sound';
      });

      pauseBtn.addEventListener('click', () => {
        if (this.state === GameState.PLAYING) {
          this.state = GameState.PAUSED;
        } else if (this.state === GameState.PAUSED) {
          this.state = GameState.PLAYING;
        }
      });

      toggleTouchBtn.addEventListener('click', () => {
        this.input.toggleTouchUIForce();
      });

      // Canvas Touch/Click to start when in MENU or GAME_OVER
      this.canvas.addEventListener('click', () => {
        this.sound.init();
        if (this.state === GameState.MENU) {
          this.startNewGame();
        } else if (this.state === GameState.GAME_OVER) {
          this.startNewGame();
        }
      });

      // Orientation Warning Check
      const checkOrientation = () => {
        const modal = document.getElementById('orientation-warning');
        if (window.innerWidth < window.innerHeight && this.input.isTouchDevice) {
          modal.classList.remove('hidden');
        } else {
          modal.classList.add('hidden');
        }
      };
      window.addEventListener('resize', checkOrientation);
      checkOrientation();
    }

    initBackgroundStars() {
      this.stars = [];
      for (let i = 0; i < 75; i++) {
        this.stars.push({
          x: Math.random() * CANVAS_WIDTH,
          y: Math.random() * CANVAS_HEIGHT,
          size: Math.random() < 0.7 ? 1 : 2,
          speed: 15 + Math.random() * 35,
          alpha: 0.3 + Math.random() * 0.7
        });
      }
    }

    resetPlayer() {
      const spriteW = SPRITES.player[0].length * PIXEL_SIZE;
      const spriteH = SPRITES.player.length * PIXEL_SIZE;

      this.player = {
        x: (CANVAS_WIDTH - spriteW) / 2,
        y: CANVAS_HEIGHT - spriteH - 30,
        width: spriteW,
        height: spriteH,
        speed: 360,
        isInvulnerable: false,
        invulnerableTimer: 0,
        flashTimer: 0,
        visible: true
      };
    }

    spawnEnemyFleet() {
      this.enemies = [];
      const rows = 4;
      const cols = 9;
      const enemyPaddingX = 24;
      const enemyPaddingY = 16;
      const startX = 140;
      const startY = 80;

      // Fleet parameters based on level
      const speedMultiplier = 1 + (this.level - 1) * 0.12;
      this.fleetSpeed = 45 * speedMultiplier;
      this.fleetDirection = 1;
      this.enemyShootInterval = Math.max(0.6, 1.6 - (this.level - 1) * 0.15);

      const rowSpriteMap = [SPRITES.enemy1, SPRITES.enemy2, SPRITES.enemy3, SPRITES.enemy4];
      const rowScores = [40, 30, 20, 10];

      for (let r = 0; r < rows; r++) {
        const spriteFrames = rowSpriteMap[r];
        const scoreVal = rowScores[r];
        const color = ENEMY_COLORS[r];

        const spriteW = spriteFrames[0][0].length * PIXEL_SIZE;
        const spriteH = spriteFrames[0].length * PIXEL_SIZE;

        for (let c = 0; c < cols; c++) {
          this.enemies.push({
            x: startX + c * (spriteW + enemyPaddingX),
            y: startY + r * (spriteH + enemyPaddingY),
            width: spriteW,
            height: spriteH,
            row: r,
            col: c,
            scoreValue: scoreVal,
            color: color,
            spriteFrames: spriteFrames,
            alive: true
          });
        }
      }
    }

    startNewGame() {
      this.score = 0;
      this.lives = 3;
      this.level = 1;
      this.playerBullets = [];
      this.enemyBullets = [];
      this.particles = [];
      this.resetPlayer();
      this.spawnEnemyFleet();
      this.state = GameState.PLAYING;
    }

    nextLevel() {
      this.level++;
      this.playerBullets = [];
      this.enemyBullets = [];
      this.particles = [];
      this.resetPlayer();
      this.spawnEnemyFleet();
      this.state = GameState.PLAYING;
    }

    // ------------------------------------------------------------------------
    // 5. MAIN GAME LOOP & UPDATES
    // ------------------------------------------------------------------------
    gameLoop(timestamp) {
      if (!this.lastTimestamp) this.lastTimestamp = timestamp;
      let dt = (timestamp - this.lastTimestamp) / 1000;
      this.lastTimestamp = timestamp;

      // Cap max delta time to prevent large physics jumps
      if (dt > 0.1) dt = 0.1;

      this.update(dt);
      this.render();

      requestAnimationFrame((t) => this.gameLoop(t));
    }

    update(dt) {
      this.updateStars(dt);

      // Check Pause Key Toggle
      if (this.input.isPausePressed()) {
        if (this.state === GameState.PLAYING) this.state = GameState.PAUSED;
        else if (this.state === GameState.PAUSED) this.state = GameState.PLAYING;
      }

      // State Handler
      switch (this.state) {
        case GameState.MENU:
          if (this.input.isFire() || this.input.keys['Space']) {
            this.startNewGame();
          }
          break;

        case GameState.PLAYING:
          this.updatePlayer(dt);
          this.updateEnemies(dt);
          this.updateBullets(dt);
          this.updateParticles(dt);
          this.checkCollisions();
          break;

        case GameState.PAUSED:
          // Game updates frozen
          break;

        case GameState.LEVEL_CLEAR:
          this.updateParticles(dt);
          this.levelClearTimer -= dt;
          if (this.levelClearTimer <= 0) {
            this.nextLevel();
          }
          break;

        case GameState.GAME_OVER:
          this.updateParticles(dt);
          if (this.input.isRestartPressed() || this.input.isFire()) {
            this.startNewGame();
          }
          break;
      }
    }

    updateStars(dt) {
      this.stars.forEach(star => {
        star.y += star.speed * dt;
        if (star.y > CANVAS_HEIGHT) {
          star.y = 0;
          star.x = Math.random() * CANVAS_WIDTH;
        }
      });
    }

    updatePlayer(dt) {
      // Movement Control (Restricted to bottom area)
      if (this.input.isLeft()) this.player.x -= this.player.speed * dt;
      if (this.input.isRight()) this.player.x += this.player.speed * dt;
      if (this.input.isUp()) this.player.y -= this.player.speed * dt;
      if (this.input.isDown()) this.player.y += this.player.speed * dt;

      // Bound Restrictions
      const minX = 10;
      const maxX = CANVAS_WIDTH - this.player.width - 10;
      const minY = CANVAS_HEIGHT - 170; // Restrict upper bound in lower region
      const maxY = CANVAS_HEIGHT - this.player.height - 10;

      if (this.player.x < minX) this.player.x = minX;
      if (this.player.x > maxX) this.player.x = maxX;
      if (this.player.y < minY) this.player.y = minY;
      if (this.player.y > maxY) this.player.y = maxY;

      // Firing Logic
      this.lastPlayerShot += dt;
      if (this.input.isFire() && this.lastPlayerShot >= this.playerShotCooldown) {
        this.firePlayerBullet();
        this.lastPlayerShot = 0;
      }

      // Invulnerability & Flickering
      if (this.player.isInvulnerable) {
        this.player.invulnerableTimer -= dt;
        this.player.flashTimer += dt;
        if (this.player.flashTimer >= 0.08) {
          this.player.visible = !this.player.visible;
          this.player.flashTimer = 0;
        }
        if (this.player.invulnerableTimer <= 0) {
          this.player.isInvulnerable = false;
          this.player.visible = true;
        }
      }
    }

    firePlayerBullet() {
      this.playerBullets.push({
        x: this.player.x + this.player.width / 2 - 2,
        y: this.player.y - 8,
        width: 4,
        height: 12,
        speed: 620
      });
      this.sound.playPew();
    }

    updateEnemies(dt) {
      const aliveEnemies = this.enemies.filter(e => e.alive);
      if (aliveEnemies.length === 0) {
        this.state = GameState.LEVEL_CLEAR;
        this.levelClearTimer = 1.2;
        this.sound.playLevelClear();
        return;
      }

      // Speed increases as total alive enemies decrease
      const totalEnemies = 36;
      const ratio = 1 - (aliveEnemies.length / totalEnemies);
      const currentSpeed = (this.fleetSpeed + ratio * 120) * dt * this.fleetDirection;

      let hitBoundary = false;

      // Check boundary hit
      aliveEnemies.forEach(e => {
        e.x += currentSpeed;
        if ((this.fleetDirection > 0 && e.x + e.width >= CANVAS_WIDTH - 20) ||
            (this.fleetDirection < 0 && e.x <= 20)) {
          hitBoundary = true;
        }

        // Win/Loss Condition 2: Enemy reaches player defense zone
        if (e.y + e.height >= CANVAS_HEIGHT - 80) {
          this.triggerGameOver();
        }
      });

      if (hitBoundary) {
        this.fleetDirection *= -1;
        aliveEnemies.forEach(e => {
          e.y += this.fleetDropDistance;
        });
      }

      // Enemy Animation Timer
      this.enemyAnimTimer += dt;
      if (this.enemyAnimTimer >= 0.4) {
        this.enemyAnimFrame = (this.enemyAnimFrame + 1) % 2;
        this.enemyAnimTimer = 0;
      }

      // Enemy Shooting AI (Bottom-most alive enemies fire)
      this.enemyShootTimer += dt;
      if (this.enemyShootTimer >= this.enemyShootInterval) {
        this.enemyShootTimer = 0;
        this.enemyFire();
      }
    }

    enemyFire() {
      // Find bottom-most enemy for each column
      const columnsMap = {};
      this.enemies.forEach(e => {
        if (!e.alive) return;
        if (!columnsMap[e.col] || e.row > columnsMap[e.col].row) {
          columnsMap[e.col] = e;
        }
      });

      const shooterCandidates = Object.values(columnsMap);
      if (shooterCandidates.length > 0) {
        const shooter = shooterCandidates[Math.floor(Math.random() * shooterCandidates.length)];
        this.enemyBullets.push({
          x: shooter.x + shooter.width / 2 - 2,
          y: shooter.y + shooter.height,
          width: 4,
          height: 10,
          speed: 240 + (this.level - 1) * 20
        });
      }
    }

    updateBullets(dt) {
      // Update Player Bullets
      for (let i = this.playerBullets.length - 1; i >= 0; i--) {
        const b = this.playerBullets[i];
        b.y -= b.speed * dt;
        if (b.y < -20) {
          this.playerBullets.splice(i, 1);
        }
      }

      // Update Enemy Bullets
      for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
        const b = this.enemyBullets[i];
        b.y += b.speed * dt;
        if (b.y > CANVAS_HEIGHT + 20) {
          this.enemyBullets.splice(i, 1);
        }
      }
    }

    updateParticles(dt) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) {
          this.particles.splice(i, 1);
        }
      }
    }

    spawnExplosion(x, y, color) {
      for (let i = 0; i < 18; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 40 + Math.random() * 120;
        this.particles.push({
          x: x,
          y: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() < 0.5 ? 2 : 4,
          color: color,
          life: 0.2 + Math.random() * 0.15
        });
      }
    }

    // ------------------------------------------------------------------------
    // 6. COLLISION DETECTION (AABB)
    // ------------------------------------------------------------------------
    checkCollisions() {
      // 1. Player Bullets vs Enemies
      for (let bi = this.playerBullets.length - 1; bi >= 0; bi--) {
        const b = this.playerBullets[bi];

        for (let ei = 0; ei < this.enemies.length; ei++) {
          const e = this.enemies[ei];
          if (!e.alive) continue;

          if (this.rectIntersect(b, e)) {
            // Destroy enemy & bullet
            e.alive = false;
            this.playerBullets.splice(bi, 1);

            this.score += e.scoreValue;
            if (this.score > this.highScore) {
              this.highScore = this.score;
              localStorage.setItem('spaceDefenderHighScore', this.highScore.toString());
            }

            this.spawnExplosion(e.x + e.width / 2, e.y + e.height / 2, e.color);
            this.sound.playExplosion();
            break;
          }
        }
      }

      // 2. Enemy Bullets vs Player
      if (!this.player.isInvulnerable) {
        for (let bi = this.enemyBullets.length - 1; bi >= 0; bi--) {
          const b = this.enemyBullets[bi];

          if (this.rectIntersect(b, this.player)) {
            this.enemyBullets.splice(bi, 1);
            this.playerHit();
            break;
          }
        }
      }
    }

    rectIntersect(r1, r2) {
      return !(r2.x > r1.x + r1.width ||
               r2.x + r2.width < r1.x ||
               r2.y > r1.y + r1.height ||
               r2.y + r2.height < r1.y);
    }

    playerHit() {
      this.lives--;
      this.sound.playPlayerHit();
      this.spawnExplosion(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2, '#ff0055');

      if (this.lives <= 0) {
        this.triggerGameOver();
      } else {
        // Activate Invulnerability
        this.player.isInvulnerable = true;
        this.player.invulnerableTimer = 1.2;
        this.player.flashTimer = 0;
      }
    }

    triggerGameOver() {
      this.lives = 0;
      this.state = GameState.GAME_OVER;
      this.sound.playGameOver();
    }

    // ------------------------------------------------------------------------
    // 7. RENDERING SYSTEM
    // ------------------------------------------------------------------------
    render() {
      // Clear Canvas
      this.ctx.fillStyle = '#060317';
      this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Render Background Stars
      this.renderStars();

      // State Render Dispatcher
      switch (this.state) {
        case GameState.MENU:
          this.renderMenuScreen();
          break;

        case GameState.PLAYING:
          this.renderGameplay();
          break;

        case GameState.PAUSED:
          this.renderGameplay();
          this.renderPauseOverlay();
          break;

        case GameState.LEVEL_CLEAR:
          this.renderGameplay();
          this.renderLevelClearOverlay();
          break;

        case GameState.GAME_OVER:
          this.renderGameplay();
          this.renderGameOverScreen();
          break;
      }
    }

    renderStars() {
      this.stars.forEach(star => {
        this.ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
        this.ctx.fillRect(star.x, star.y, star.size, star.size);
      });
    }

    renderPixelSprite(matrix, posX, posY, color) {
      this.ctx.fillStyle = color;
      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
          if (matrix[r][c] === '1') {
            this.ctx.fillRect(
              posX + c * PIXEL_SIZE,
              posY + r * PIXEL_SIZE,
              PIXEL_SIZE,
              PIXEL_SIZE
            );
          }
        }
      }
    }

    renderGameplay() {
      // Render HUD Top Bar
      this.renderHUD();

      // Render Defense Line Indicator
      this.ctx.strokeStyle = 'rgba(255, 0, 85, 0.35)';
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([8, 8]);
      this.ctx.beginPath();
      this.ctx.moveTo(0, CANVAS_HEIGHT - 80);
      this.ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT - 80);
      this.ctx.stroke();
      this.ctx.setLineDash([]);

      // Render Enemies
      this.enemies.forEach(e => {
        if (e.alive) {
          const currentFrameMatrix = e.spriteFrames[this.enemyAnimFrame];
          this.renderPixelSprite(currentFrameMatrix, e.x, e.y, e.color);
        }
      });

      // Render Player Bullets
      this.ctx.fillStyle = '#00ffcc';
      this.playerBullets.forEach(b => {
        this.ctx.fillRect(b.x, b.y, b.width, b.height);
      });

      // Render Enemy Bullets
      this.ctx.fillStyle = '#ff0055';
      this.enemyBullets.forEach(b => {
        this.ctx.fillRect(b.x, b.y, b.width, b.height);
      });

      // Render Particles
      this.particles.forEach(p => {
        this.ctx.fillStyle = p.color;
        this.ctx.fillRect(p.x, p.y, p.size, p.size);
      });

      // Render Player Ship
      if (this.player && this.player.visible) {
        this.renderPixelSprite(SPRITES.player, this.player.x, this.player.y, '#ffffff');
      }
    }

    renderHUD() {
      this.ctx.font = '14px "Press Start 2P", monospace';

      // SCORE
      this.ctx.fillStyle = '#00ffcc';
      const scoreStr = 'SCORE ' + this.score.toString().padStart(6, '0');
      this.ctx.fillText(scoreStr, 20, 32);

      // HIGH SCORE
      this.ctx.fillStyle = '#ffe600';
      const hiStr = 'HI ' + this.highScore.toString().padStart(6, '0');
      this.ctx.fillText(hiStr, 340, 32);

      // LEVEL
      this.ctx.fillStyle = '#ffffff';
      const lvlStr = 'LEVEL ' + this.level.toString().padStart(2, '0');
      this.ctx.fillText(lvlStr, 640, 32);

      // LIVES (Hearts)
      this.ctx.fillStyle = '#ff0055';
      let hearts = '';
      for (let i = 0; i < this.lives; i++) hearts += '♥ ';
      this.ctx.fillText(hearts, 830, 32);
    }

    renderMenuScreen() {
      this.ctx.textAlign = 'center';

      // Title
      this.ctx.fillStyle = '#00ffcc';
      this.ctx.font = '28px "Press Start 2P", monospace';
      this.ctx.fillText('SPACE DEFENDER', CANVAS_WIDTH / 2, 150);

      // Subtitle / Highscore
      this.ctx.fillStyle = '#ffe600';
      this.ctx.font = '14px "Press Start 2P", monospace';
      this.ctx.fillText(`HIGH SCORE ${this.highScore.toString().padStart(6, '0')}`, CANVAS_WIDTH / 2, 210);

      // Controls Display
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '12px "Press Start 2P", monospace';
      this.ctx.fillText('← ↑ ↓ → / WASD : MOVE', CANVAS_WIDTH / 2, 280);
      this.ctx.fillText('SPACE / FIRE   : SHOOT', CANVAS_WIDTH / 2, 315);
      this.ctx.fillText('P              : PAUSE', CANVAS_WIDTH / 2, 350);

      // Prompt Start
      this.ctx.fillStyle = '#ff0055';
      this.ctx.font = '14px "Press Start 2P", monospace';
      const isMobile = this.input.isTouchDevice;
      this.ctx.fillText(isMobile ? 'TAP FIRE / SCREEN TO START' : 'PRESS SPACE TO START', CANVAS_WIDTH / 2, 430);

      this.ctx.textAlign = 'left';
    }

    renderPauseOverlay() {
      this.ctx.fillStyle = 'rgba(8, 4, 26, 0.75)';
      this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      this.ctx.textAlign = 'center';
      this.ctx.fillStyle = '#ffe600';
      this.ctx.font = '28px "Press Start 2P", monospace';
      this.ctx.fillText('PAUSED', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      this.ctx.textAlign = 'left';
    }

    renderLevelClearOverlay() {
      this.ctx.textAlign = 'center';
      this.ctx.fillStyle = '#00ffcc';
      this.ctx.font = '24px "Press Start 2P", monospace';
      this.ctx.fillText('LEVEL CLEAR!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      this.ctx.textAlign = 'left';
    }

    renderGameOverScreen() {
      this.ctx.fillStyle = 'rgba(8, 4, 26, 0.85)';
      this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      this.ctx.textAlign = 'center';

      this.ctx.fillStyle = '#ff0055';
      this.ctx.font = '32px "Press Start 2P", monospace';
      this.ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, 200);

      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '16px "Press Start 2P", monospace';
      this.ctx.fillText(`FINAL SCORE: ${this.score}`, CANVAS_WIDTH / 2, 270);

      this.ctx.fillStyle = '#ffe600';
      this.ctx.fillText(`HIGH SCORE: ${this.highScore}`, CANVAS_WIDTH / 2, 320);

      this.ctx.fillStyle = '#00ffcc';
      this.ctx.font = '14px "Press Start 2P", monospace';
      const isMobile = this.input.isTouchDevice;
      this.ctx.fillText(isMobile ? 'TAP FIRE TO RESTART' : 'PRESS R / SPACE TO RESTART', CANVAS_WIDTH / 2, 400);

      this.ctx.textAlign = 'left';
    }
  }

  // --------------------------------------------------------------------------
  // 8. BOOTSTRAP GAME INSTANCE
  // --------------------------------------------------------------------------
  window.addEventListener('DOMContentLoaded', () => {
    window.gameInstance = new SpaceDefenderGame();
  });

})();
