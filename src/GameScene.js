import { generateAllTextures } from './sprites.js';
import { Player } from './player.js';
import { Enemy } from './enemy.js';
import { BulletPool } from './bullet.js';

// World dimensions (logical — displayed at 2× zoom)
const WORLD_W = 400;
const WORLD_H = 300;
const TILE = 32;

const LEVEL_DATA = [
  {
    level: 1,
    bgTile: 'tile_floor',
    waves: [
      [{ type: 'basic', count: 3 }],
    ],
  },
  {
    level: 2,
    bgTile: 'tile_floor',
    waves: [
      [{ type: 'basic', count: 4 }, { type: 'fast', count: 2 }],
    ],
  },
  {
    level: 3,
    bgTile: 'tile_floor_alt',
    waves: [
      [{ type: 'fast', count: 4 }],
      [{ type: 'basic', count: 3 }, { type: 'fast', count: 2 }],
    ],
  },
  {
    level: 4,
    bgTile: 'tile_floor_alt',
    waves: [
      [{ type: 'heavy', count: 2 }, { type: 'fast', count: 3 }],
    ],
  },
  {
    level: 5,
    bgTile: 'tile_floor_alt',
    waves: [
      [{ type: 'basic', count: 5 }, { type: 'fast', count: 3 }],
      [{ type: 'heavy', count: 3 }],
    ],
  },
];

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    generateAllTextures(this);

    this.registry.set('score', 0);
    this.currentLevel = 1;
    this.currentWave = 0;
    this.levelComplete = false;
    this.gameOver = false;
    this.transitioning = false;

    this._buildWorld();
    this._registerAnims();

    // Player
    this.player = new Player(this, WORLD_W / 2, WORLD_H / 2);

    // Bullet pool
    this.bulletPool = new BulletPool(this);

    // Enemy group
    this.enemyGroup = this.physics.add.group();

    // Colliders
    this.physics.add.collider(this.player, this.wallGroup);
    this.physics.add.collider(this.enemyGroup, this.wallGroup);
    this.physics.add.overlap(
      this.bulletPool.getGroup(),
      this.wallGroup,
      (bullet) => bullet.deactivate()
    );
    this.physics.add.overlap(
      this.bulletPool.getGroup(),
      this.enemyGroup,
      (bullet, enemy) => {
        bullet.deactivate();
        if (enemy.state !== 'dead') {
          enemy.takeDamage(18, bullet.firedAngle);
        }
      }
    );

    // Input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.input.mouse.disableContextMenu();

    // Camera
    this.cameras.main.setZoom(2);
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // HUD
    this._buildHUD();

    // Events
    this.events.on('player-died', this._onPlayerDied, this);
    this.events.on('score-updated', this._updateScoreHUD, this);
    this.events.on('health-updated', this._updateHealthHUD, this);
    this.events.on('ammo-updated', this._updateAmmoHUD, this);
    this.events.on('reload-start', () => {
      if (this.reloadText) this.reloadText.setVisible(true);
    });
    this.events.on('reload-done', () => {
      if (this.reloadText) this.reloadText.setVisible(false);
    });

    // Restart key
    this.rKey = this.input.keyboard.addKey('R');

    this.startLevel(1);
    this._showControlsHint();
  }

  _showControlsHint() {
    const x = WORLD_W / 2, y = WORLD_H - 38;
    const lines = [
      'ARROW KEYS — move',
      'MOUSE — aim',
      'LEFT CLICK — shoot',
      'R — backstab enemies from behind for 2x damage',
    ];
    const bg = this.add.rectangle(x, y, 200, lines.length * 10 + 8, 0x000000, 0.75)
      .setScrollFactor(0).setDepth(55).setOrigin(0.5, 0);
    const texts = lines.map((line, i) =>
      this.add.text(x, y + 4 + i * 10, line, {
        fontSize: '6px',
        fontFamily: 'monospace',
        color: '#cccccc',
        stroke: '#000000',
        strokeThickness: 1,
      }).setScrollFactor(0).setDepth(56).setOrigin(0.5, 0)
    );

    this.time.delayedCall(5000, () => {
      this.tweens.add({
        targets: [bg, ...texts],
        alpha: 0,
        duration: 800,
        onComplete: () => { bg.destroy(); texts.forEach(t => t.destroy()); },
      });
    });
  }

  update(time) {
    if (this.gameOver) {
      if (Phaser.Input.Keyboard.JustDown(this.rKey)) {
        this.scene.restart();
      }
      return;
    }

    this.player.update(this.cursors, this.input.activePointer, time);

    this.enemyGroup.getChildren().forEach(e => {
      if (e.active) e.update(this.player, time);
    });

    // Check wave clear
    if (!this.transitioning && !this.levelComplete && !this.gameOver && this._waveSpawned) {
      if (this.enemyGroup.countActive(true) === 0) {
        this._onWaveClear();
      }
    }
  }

  // ---- Level / Wave flow ----

  startLevel(num) {
    this.currentLevel = num;
    this.currentWave = 0;
    this.levelComplete = false;
    this.transitioning = false;
    this._waveSpawned = false;

    this._updateLevelHUD();
    this._showBanner(`LEVEL ${num}`, 0x88aaff, () => this._spawnWave());
  }

  _spawnWave() {
    const levelCfg = LEVEL_DATA[this.currentLevel - 1];
    const waveCfg = levelCfg.waves[this.currentWave];

    // Clear any leftover enemies
    this.enemyGroup.clear(true, true);

    waveCfg.forEach(spec => {
      for (let i = 0; i < spec.count; i++) {
        const pos = this._randomSpawnPos();
        const enemy = new Enemy(this, pos.x, pos.y, spec.type);
        this.enemyGroup.add(enemy);  // Enemy already adds itself to scene in constructor
      }
    });

    this._waveSpawned = true;
    this.transitioning = false;

    const totalWaves = LEVEL_DATA[this.currentLevel - 1].waves.length;
    if (totalWaves > 1) {
      this._showBanner(`WAVE ${this.currentWave + 1} / ${totalWaves}`, 0xffaa44, null, 1200);
    }
  }

  _randomSpawnPos() {
    // Spawn on one of the four edges (inset by wall thickness)
    const margin = TILE + 20;
    const side = Phaser.Math.Between(0, 3);
    let x, y;
    if (side === 0) { x = Phaser.Math.Between(margin, WORLD_W - margin); y = margin; }
    else if (side === 1) { x = Phaser.Math.Between(margin, WORLD_W - margin); y = WORLD_H - margin; }
    else if (side === 2) { x = margin; y = Phaser.Math.Between(margin, WORLD_H - margin); }
    else { x = WORLD_W - margin; y = Phaser.Math.Between(margin, WORLD_H - margin); }
    return { x, y };
  }

  _onWaveClear() {
    this.transitioning = true;
    this._waveSpawned = false;
    const levelCfg = LEVEL_DATA[this.currentLevel - 1];

    if (this.currentWave + 1 < levelCfg.waves.length) {
      // More waves
      this.currentWave++;
      this._showBanner('WAVE CLEAR!', 0x88ff88, () => this._spawnWave(), 1500);
    } else {
      // Level complete
      this.levelComplete = true;
      // Bonus score
      const bonus = this.currentLevel * 500;
      const cur = this.registry.get('score') || 0;
      this.registry.set('score', cur + bonus);
      this._updateScoreHUD();

      this._showBanner(`LEVEL ${this.currentLevel} COMPLETE!`, 0xffdd44, () => {
        if (this.currentLevel < LEVEL_DATA.length) {
          this.startLevel(this.currentLevel + 1);
        } else {
          this._showVictory();
        }
      }, 2000);
    }
  }

  _onPlayerDied() {
    this.gameOver = true;
    this.time.delayedCall(600, () => this._showGameOver());
  }

  // ---- World building ----

  _buildWorld() {
    // Floor
    this.floorLayer = this.add.tileSprite(0, 0, WORLD_W, WORLD_H, 'tile_floor')
      .setOrigin(0, 0).setDepth(0);

    // Walls (static physics group)
    this.wallGroup = this.physics.add.staticGroup();
    this._placeWalls();

    // Physics world bounds
    this.physics.world.setBounds(TILE, TILE, WORLD_W - TILE * 2, WORLD_H - TILE * 2);
  }

  _placeWalls() {
    const cols = Math.ceil(WORLD_W / TILE);
    const rows = Math.ceil(WORLD_H / TILE);

    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const isEdge = col === 0 || row === 0 || col === cols - 1 || row === rows - 1;
        if (isEdge) {
          const wx = col * TILE + TILE / 2;
          const wy = row * TILE + TILE / 2;
          // create() properly adds a physics-enabled sprite to the static group
          this.wallGroup.create(wx, wy, 'tile_wall').setDepth(1).refreshBody();
        }
      }
    }
  }

  _registerAnims() {
    const dirs = ['down', 'up', 'right', 'left'];

    // Player animations (5 frames per direction: 4 walk + 1 idle)
    dirs.forEach((dir, row) => {
      this.anims.create({
        key: `player_walk_${dir}`,
        frames: Array.from({ length: 4 }, (_, i) => ({ key: 'player_sheet', frame: row * 5 + i })),
        frameRate: 8,
        repeat: -1,
      });
      this.anims.create({
        key: `player_idle_${dir}`,
        frames: [{ key: 'player_sheet', frame: row * 5 + 4 }],
        frameRate: 1,
        repeat: -1,
      });
    });

    // Enemy animations
    ['basic', 'fast', 'heavy'].forEach(type => {
      const sheetKey = `enemy_${type}`;
      dirs.forEach((dir, row) => {
        this.anims.create({
          key: `${type}_walk_${dir}`,
          frames: Array.from({ length: 4 }, (_, i) => ({ key: sheetKey, frame: row * 5 + i })),
          frameRate: 6,
          repeat: -1,
        });
      });
      this.anims.create({
        key: `${type}_death`,
        frames: [{ key: sheetKey, frame: 4 }],
        frameRate: 1,
        repeat: 0,
      });
    });
  }

  // ---- HUD ----

  _buildHUD() {
    // HUD lives at screen coords — use setScrollFactor(0)
    const hudDepth = 30;
    const ox = 4, oy = 4;

    // Hearts
    this.hudHearts = [];
    for (let i = 0; i < 5; i++) {
      const h = this.add.image(ox + i * 12, oy + 4, 'hud_heart')
        .setScrollFactor(0).setDepth(hudDepth).setOrigin(0, 0).setScale(1.5);
      this.hudHearts.push(h);
    }

    // HP bar background
    this.add.rectangle(ox, oy + 16, 70, 6, 0x330000)
      .setScrollFactor(0).setDepth(hudDepth).setOrigin(0, 0);
    // HP bar fill
    this.hudHpBar = this.add.rectangle(ox, oy + 16, 70, 6, 0x22dd44)
      .setScrollFactor(0).setDepth(hudDepth + 1).setOrigin(0, 0);
    // HP label
    this.hudHpLabel = this.add.text(ox + 72, oy + 16, '100 HP', {
      fontSize: '6px',
      fontFamily: 'monospace',
      color: '#aaffaa',
      stroke: '#000000',
      strokeThickness: 1,
    }).setScrollFactor(0).setDepth(hudDepth + 1).setOrigin(0, 0);

    // Score
    this.hudScoreText = this.add.text(ox, oy + 26, 'SCORE: 0', {
      fontSize: '7px',
      fontFamily: 'monospace',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setScrollFactor(0).setDepth(hudDepth).setOrigin(0, 0);

    // Level indicator (top right)
    this.hudLevelText = this.add.text(WORLD_W - ox, oy, 'LVL 1', {
      fontSize: '8px',
      fontFamily: 'monospace',
      color: '#88aaff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setScrollFactor(0).setDepth(hudDepth).setOrigin(1, 0);

    // Ammo icons (bottom left)
    this.hudAmmoIcons = [];
    for (let i = 0; i < 10; i++) {
      const icon = this.add.image(ox + i * 8, WORLD_H - 12, 'hud_bullet_icon')
        .setScrollFactor(0).setDepth(hudDepth).setOrigin(0, 0);
      this.hudAmmoIcons.push(icon);
    }

    // Reload text
    this.reloadText = this.add.text(WORLD_W / 2, WORLD_H - 16, 'RELOADING...', {
      fontSize: '8px',
      fontFamily: 'monospace',
      color: '#ffaa00',
      stroke: '#000000',
      strokeThickness: 2,
    }).setScrollFactor(0).setDepth(hudDepth).setOrigin(0.5, 0).setVisible(false);

    this._updateHealthHUD();
    this._updateScoreHUD();
    this._updateAmmoHUD();
    this._updateLevelHUD();
  }

  _updateHealthHUD() {
    const hp = this.player.health;
    const maxHp = this.player.maxHealth;
    const pct = hp / maxHp;

    // Hearts
    const heartsLit = Math.ceil(pct * this.hudHearts.length);
    this.hudHearts.forEach((h, i) => {
      h.setTint(i < heartsLit ? 0xffffff : 0x444444);
    });

    // HP bar: 70px wide max, color shifts green→yellow→red
    this.hudHpBar.width = Math.max(1, Math.round(pct * 70));
    const barColor = pct > 0.5 ? 0x22dd44 : pct > 0.25 ? 0xffcc00 : 0xff2222;
    this.hudHpBar.setFillStyle(barColor);
    this.hudHpLabel.setText(`${hp} HP`);
  }

  _updateScoreHUD() {
    const score = this.registry.get('score') || 0;
    this.hudScoreText.setText(`SCORE: ${score}`);
  }

  _updateAmmoHUD() {
    const ammo = this.player.ammo;
    const maxAmmo = this.player.maxAmmo;
    const iconsPerAmmo = Math.ceil(maxAmmo / this.hudAmmoIcons.length);
    this.hudAmmoIcons.forEach((icon, i) => {
      const threshold = (i + 1) * iconsPerAmmo;
      icon.setTint(ammo >= threshold ? 0xffdd00 : 0x444444);
    });
  }

  _updateLevelHUD() {
    if (this.hudLevelText) {
      this.hudLevelText.setText(`LVL ${this.currentLevel}`);
    }
  }

  // ---- Banners & Overlays ----

  _showBanner(message, color, onComplete, duration = 1600) {
    const x = WORLD_W / 2;
    const y = WORLD_H / 2;

    const bg = this.add.rectangle(x, y, WORLD_W, 24, 0x000000, 0.7)
      .setScrollFactor(0).setDepth(50);
    const text = this.add.text(x, y, message, {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: `#${color.toString(16).padStart(6, '0')}`,
      stroke: '#000000',
      strokeThickness: 3,
    }).setScrollFactor(0).setDepth(51).setOrigin(0.5, 0.5).setScale(0.1);

    this.tweens.add({
      targets: text,
      scaleX: 1,
      scaleY: 1,
      duration: 200,
      ease: 'Back.easeOut',
    });

    this.time.delayedCall(duration, () => {
      this.tweens.add({
        targets: [text, bg],
        alpha: 0,
        duration: 300,
        onComplete: () => {
          text.destroy();
          bg.destroy();
          if (onComplete) onComplete();
        },
      });
    });
  }

  _showGameOver() {
    const x = WORLD_W / 2, y = WORLD_H / 2;
    this.add.rectangle(x, y, WORLD_W, WORLD_H, 0x000000, 0.8)
      .setScrollFactor(0).setDepth(60);

    this.add.text(x, y - 20, 'GAME OVER', {
      fontSize: '18px',
      fontFamily: 'monospace',
      color: '#ff4444',
      stroke: '#000000',
      strokeThickness: 4,
    }).setScrollFactor(0).setDepth(61).setOrigin(0.5);

    this.add.text(x, y + 2, `SCORE: ${this.registry.get('score') || 0}`, {
      fontSize: '9px',
      fontFamily: 'monospace',
      color: '#ffffff',
    }).setScrollFactor(0).setDepth(61).setOrigin(0.5);

    this.add.text(x, y + 18, 'PRESS  R  TO  RESTART', {
      fontSize: '7px',
      fontFamily: 'monospace',
      color: '#aaaaaa',
    }).setScrollFactor(0).setDepth(61).setOrigin(0.5);
  }

  _showVictory() {
    this.gameOver = true;
    const x = WORLD_W / 2, y = WORLD_H / 2;
    this.add.rectangle(x, y, WORLD_W, WORLD_H, 0x000000, 0.8)
      .setScrollFactor(0).setDepth(60);

    this.add.text(x, y - 25, 'VICTORY!', {
      fontSize: '20px',
      fontFamily: 'monospace',
      color: '#ffdd44',
      stroke: '#000000',
      strokeThickness: 4,
    }).setScrollFactor(0).setDepth(61).setOrigin(0.5);

    this.add.text(x, y, `FINAL SCORE: ${this.registry.get('score') || 0}`, {
      fontSize: '9px',
      fontFamily: 'monospace',
      color: '#ffffff',
    }).setScrollFactor(0).setDepth(61).setOrigin(0.5);

    this.add.text(x, y + 18, 'PRESS  R  TO  PLAY  AGAIN', {
      fontSize: '7px',
      fontFamily: 'monospace',
      color: '#aaaaaa',
    }).setScrollFactor(0).setDepth(61).setOrigin(0.5);
  }
}
