# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the game

No build step. Serve the project root over HTTP (required for ES modules):

```bash
npx serve . --listen 8080
```

Then open the URL printed in the terminal (port may vary). Do not open `index.html` directly via `file://` — browsers block ES module imports from the filesystem.

## Git workflow

This project uses Git with a remote at `https://github.com/ballerispolarspring/retro-shooter`.

**Commit and push after every meaningful change — no exceptions.** Do not batch multiple features into one commit. A "meaningful change" is any edit that leaves the game in a working (or intentionally broken-for-a-reason) state: adding a feature, fixing a bug, updating a config, even a significant refactor of a single file.

Workflow for every change:

```bash
git add <only the files you changed>
git commit -m "verb: short description of what and why"
git push
```

Commit message style — imperative mood, present tense, ≤72 chars:
- `Add enemy knockback on bullet hit`
- `Fix wave-clear not triggering when last enemy dies mid-tween`
- `Increase player speed from 130 to 160 for better feel`

Never use `git add .` or `git add -A` — stage files explicitly to avoid committing unintended files.

## Architecture

**Entry point:** `index.html` loads Phaser 3.60 from CDN, then bootstraps `src/main.js` as an ES module. `main.js` configures the Phaser game (800×600 canvas, arcade physics, `pixelArt: true`) and registers `GameScene` as the only scene.

**Logical world vs display:** The game world is 400×300 logical pixels rendered at 2× zoom via `cameras.main.setZoom(2)`, giving a 800×600 pixel output. All world coordinates (spawns, physics bounds, HUD positions) use the 400×300 space. HUD elements use `setScrollFactor(0)` to stay fixed on screen and `setDepth(30+)` to render above gameplay.

**Texture generation (`src/sprites.js`):** All art is drawn procedurally at startup via `generateAllTextures(scene)`, called from `GameScene.create()`. Uses `scene.make.graphics()` + `graphics.generateTexture(key, w, h)`. After generating a spritesheet, frames must be manually registered on the texture:
```js
const tex = scene.textures.get(key);
tex.add(frameIndex, 0, x, y, frameWidth, frameHeight);
```
This is required for `anims.create()` to reference frames by index.

**Animations (`GameScene._registerAnims`):** Registered once in `GameScene.create()`. Keys follow the pattern `player_walk_down`, `player_idle_up`, `basic_walk_right`, `heavy_death`, etc. Always 4 directions × 5 frames per enemy/player sheet (4 walk + 1 death/idle at column index 4).

**Physics layout:**
- `wallGroup` — `physics.add.staticGroup()`, edge tiles created via `wallGroup.create(x, y, 'tile_wall')`
- `enemyGroup` — `physics.add.group()`, enemies added after construction
- `bulletPool.getGroup()` — arcade group with `maxSize: 50`, `runChildUpdate: true`
- Colliders: player↔walls, enemies↔walls, bullets↔walls (deactivate), bullets↔enemies (damage + deactivate)

**Directional hit detection (`src/enemy.js` — `takeDamage(amount, bulletAngle)`):** The bullet's travel angle is compared to the enemy's current facing angle using `Phaser.Math.Angle.Wrap`. `|diff| > 2.4 rad` = backstab (2× damage, gold flash); `|diff| > 1.2 rad` = side hit (1.3×, white flash); otherwise front (1×, red flash).

**Level/wave flow (`GameScene`):**
- `startLevel(n)` → shows level banner → `_spawnWave()`
- `update()` checks `enemyGroup.countActive(true) === 0` when `_waveSpawned && !transitioning` to trigger `_onWaveClear()`
- `_onWaveClear()` sets `transitioning = true`, increments wave or calls `startLevel(n+1)` / `_showVictory()`
- Enemy death calls `setActive(false)` immediately so `countActive` reflects the kill before the fade-out tween finishes

**Bullet pooling (`src/bullet.js`):** `BulletPool.fire(x, y, angle)` calls `group.get()` to reuse inactive bullets. Each `Bullet` stores `firedAngle` (passed to `enemy.takeDamage`). Bullets self-deactivate in `preUpdate` when out of world bounds or after 1800ms.

**Player gun (`src/player.js`):** The gun is a separate `Phaser.GameObjects.Image` (not a child of the player sprite) repositioned to `player.x, player.y` every frame in `update()`, with `setOrigin(0, 0.5)` so it pivots from the player center outward.
