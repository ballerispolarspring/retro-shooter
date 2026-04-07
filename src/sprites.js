// All procedural pixel art generation
// Called once from BootScene before GameScene starts

export function generateAllTextures(scene) {
  generatePlayerSheet(scene);
  generateGun(scene);
  generateEnemySheet(scene, 'enemy_basic', 14, 0xcc2222, 0x991111);
  generateEnemySheet(scene, 'enemy_fast',  10, 0xaa22aa, 0x771177);
  generateEnemySheet(scene, 'enemy_heavy', 20, 0x884400, 0x552200);
  generateBullet(scene);
  generateTile(scene, 'tile_floor',     0x2d2d44, 0x333355);
  generateTile(scene, 'tile_floor_alt', 0x2d3830, 0x334433);
  generateWallTile(scene);
  generateHudHeart(scene);
  generateHudBullet(scene);
}

// ---- Player ----
// 4 directions × 5 frames (4 walk + 1 idle) = 20 frames
// Each frame is 16×16. Strip is 80×80 (5 wide, 4 tall).
function generatePlayerSheet(scene) {
  const FW = 16, FH = 16;
  const COLS = 5, ROWS = 4; // rows: down, up, right, left
  const W = FW * COLS, H = FH * ROWS;
  const g = scene.make.graphics({ add: false });

  const dirs = ['down', 'up', 'right', 'left'];
  dirs.forEach((dir, row) => {
    for (let frame = 0; frame < 5; frame++) {
      const bx = frame * FW, by = row * FH;
      drawPlayerFrame(g, bx, by, FW, FH, dir, frame);
    }
  });

  g.generateTexture('player_sheet', W, H);
  g.destroy();

  // Register individual frames so animations can reference them by index
  const tex = scene.textures.get('player_sheet');
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      tex.add(row * COLS + col, 0, col * FW, row * FH, FW, FH);
    }
  }
}

function drawPlayerFrame(g, bx, by, fw, fh, dir, frame) {
  // Body (dark blue)
  g.fillStyle(0x3355bb);
  g.fillRect(bx + 3, by + 4, 10, 10);

  // Head (lighter blue)
  g.fillStyle(0x5577dd);
  g.fillRect(bx + 4, by + 1, 8, 7);

  // Eyes (direction-aware)
  g.fillStyle(0xffffff);
  if (dir === 'down') {
    g.fillRect(bx + 5, by + 3, 2, 2);
    g.fillRect(bx + 9, by + 3, 2, 2);
  } else if (dir === 'up') {
    // back of head
    g.fillStyle(0x445599);
    g.fillRect(bx + 4, by + 1, 8, 7);
  } else if (dir === 'right') {
    g.fillRect(bx + 9, by + 3, 2, 2);
  } else {
    g.fillRect(bx + 5, by + 3, 2, 2);
  }

  // Legs (animated walk cycle)
  g.fillStyle(0x223388);
  if (frame < 4) {
    // walk frames: legs alternate
    const legOffset = [0, 2, 0, -2][frame];
    g.fillRect(bx + 4,  by + 11 + (legOffset > 0 ? legOffset : 0), 3, 4);
    g.fillRect(bx + 9,  by + 11 + (legOffset < 0 ? -legOffset : 0), 3, 4);
  } else {
    // idle frame
    g.fillRect(bx + 4, by + 11, 3, 4);
    g.fillRect(bx + 9, by + 11, 3, 4);
  }

  // Arm hint
  g.fillStyle(0x4466cc);
  if (dir === 'right') {
    g.fillRect(bx + 12, by + 6, 3, 3);
  } else if (dir === 'left') {
    g.fillRect(bx + 1, by + 6, 3, 3);
  } else {
    g.fillRect(bx + 1, by + 6, 3, 3);
    g.fillRect(bx + 12, by + 6, 3, 3);
  }
}

// ---- Gun ----
function generateGun(scene) {
  const g = scene.make.graphics({ add: false });
  // Body
  g.fillStyle(0x888888);
  g.fillRect(0, 1, 10, 2);
  // Barrel tip
  g.fillStyle(0xaaaaaa);
  g.fillRect(10, 0, 3, 4);
  // Grip
  g.fillStyle(0x555555);
  g.fillRect(1, 3, 4, 3);
  g.generateTexture('gun', 13, 6);
  g.destroy();
}

// ---- Enemy sheets ----
// 5 frames per direction, 4 directions = 20 frames
// Each frame is size×size
function generateEnemySheet(scene, key, size, bodyColor, shadowColor) {
  const COLS = 5, ROWS = 4;
  const W = size * COLS, H = size * ROWS;
  const g = scene.make.graphics({ add: false });

  const dirs = ['down', 'up', 'right', 'left'];
  dirs.forEach((dir, row) => {
    for (let frame = 0; frame < 5; frame++) {
      const bx = frame * size, by = row * size;
      if (frame === 4) {
        drawEnemyDeath(g, bx, by, size, bodyColor);
      } else {
        drawEnemyFrame(g, bx, by, size, bodyColor, shadowColor, dir, frame);
      }
    }
  });

  g.generateTexture(key, W, H);
  g.destroy();

  // Register individual frames
  const tex = scene.textures.get(key);
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      tex.add(row * COLS + col, 0, col * size, row * size, size, size);
    }
  }
}

function drawEnemyFrame(g, bx, by, sz, bodyColor, shadowColor, dir, frame) {
  const m = Math.max(1, Math.floor(sz / 7)); // margin
  // Shadow/base
  g.fillStyle(shadowColor);
  g.fillRect(bx + m, by + sz - m * 2, sz - m * 2, m * 2);
  // Body
  g.fillStyle(bodyColor);
  g.fillRect(bx + m, by + m, sz - m * 2, sz - m * 3);
  // Eyes
  g.fillStyle(0xff6600);
  if (dir === 'down') {
    g.fillRect(bx + m + 1, by + m * 2, m, m);
    g.fillRect(bx + sz - m * 2 - 1, by + m * 2, m, m);
  } else if (dir === 'right') {
    g.fillRect(bx + sz - m * 2, by + m * 2, m, m);
  } else if (dir === 'left') {
    g.fillRect(bx + m + 1, by + m * 2, m, m);
  }
  // Walk bob
  if (frame % 2 === 1) {
    // slight vertical offset for walk feel — we handle via animation timing
    g.fillStyle(shadowColor);
    g.fillRect(bx + m + 1, by + sz - m, m, m);
    g.fillRect(bx + sz - m * 2, by + sz - m, m, m);
  }
}

function drawEnemyDeath(g, bx, by, sz, bodyColor) {
  // X splat
  g.fillStyle(bodyColor);
  for (let i = 0; i < sz; i++) {
    if (i < sz) {
      g.fillRect(bx + i, by + i, 2, 2);
      g.fillRect(bx + sz - i - 2, by + i, 2, 2);
    }
  }
  // Blood pool
  g.fillStyle(0x880000);
  g.fillRect(bx + Math.floor(sz * 0.3), by + Math.floor(sz * 0.4), Math.floor(sz * 0.4), Math.floor(sz * 0.3));
}

// ---- Bullet ----
function generateBullet(scene) {
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0xffee00);
  g.fillRect(0, 1, 5, 2);
  g.fillStyle(0xffffff);
  g.fillRect(5, 0, 2, 4);
  g.generateTexture('bullet', 7, 4);
  g.destroy();
}

// ---- Floor tile ----
function generateTile(scene, key, baseColor, noiseColor) {
  const SIZE = 32;
  const g = scene.make.graphics({ add: false });
  g.fillStyle(baseColor);
  g.fillRect(0, 0, SIZE, SIZE);
  // Subtle pixel noise
  g.fillStyle(noiseColor);
  const rng = mulberry32(key.charCodeAt(0) * 1337);
  for (let i = 0; i < 18; i++) {
    const x = Math.floor(rng() * SIZE);
    const y = Math.floor(rng() * SIZE);
    g.fillRect(x, y, 1, 1);
  }
  g.generateTexture(key, SIZE, SIZE);
  g.destroy();
}

// ---- Wall tile ----
function generateWallTile(scene) {
  const SIZE = 32;
  const g = scene.make.graphics({ add: false });
  // Base
  g.fillStyle(0x1a1a2a);
  g.fillRect(0, 0, SIZE, SIZE);
  // Brick lines
  g.fillStyle(0x252535);
  for (let y = 8; y < SIZE; y += 8) {
    g.fillRect(0, y, SIZE, 1);
  }
  // Vertical offsets (brick pattern)
  for (let row = 0; row < 4; row++) {
    const offset = (row % 2 === 0) ? 0 : 16;
    g.fillRect(offset, row * 8, 1, 8);
    g.fillRect(offset + 16, row * 8, 1, 8);
  }
  // Top highlight
  g.fillStyle(0x303050);
  g.fillRect(0, 0, SIZE, 1);
  g.generateTexture('tile_wall', SIZE, SIZE);
  g.destroy();
}

// ---- HUD heart ----
function generateHudHeart(scene) {
  const g = scene.make.graphics({ add: false });
  // Pixel heart shape (8×8)
  const heart = [
    '01100110',
    '11111111',
    '11111111',
    '11111111',
    '01111110',
    '00111100',
    '00011000',
    '00000000',
  ];
  heart.forEach((row, y) => {
    row.split('').forEach((px, x) => {
      if (px === '1') {
        g.fillStyle(0xff2244);
        g.fillRect(x, y, 1, 1);
      }
    });
  });
  g.generateTexture('hud_heart', 8, 8);
  g.destroy();
}

// ---- HUD bullet icon ----
function generateHudBullet(scene) {
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0xffdd00);
  g.fillRect(1, 0, 3, 6);
  g.fillStyle(0xaaaaaa);
  g.fillRect(0, 6, 5, 2);
  g.generateTexture('hud_bullet_icon', 5, 8);
  g.destroy();
}

// Simple deterministic RNG (mulberry32)
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
