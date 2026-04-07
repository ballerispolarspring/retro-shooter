// Player — movement, gun aiming, shooting

export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'player_sheet');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.health = 100;
    this.maxHealth = 100;
    this.speed = 130;
    this.fireRate = 220;      // ms between shots
    this.lastFired = 0;
    this.ammo = 30;
    this.maxAmmo = 30;
    this.reloading = false;
    this.facing = 'down';
    this.isDead = false;
    this.invincibleUntil = 0;

    this.body.setSize(10, 10);
    this.body.setCollideWorldBounds(true);
    this.setDepth(4);

    // Gun image — follows player each frame
    this.gun = scene.add.image(x, y, 'gun').setDepth(5).setOrigin(0, 0.5);

    // Muzzle flash
    this.muzzleFlash = scene.add.circle(0, 0, 4, 0xffee44, 1).setDepth(6).setVisible(false);
  }

  update(cursors, pointer, time) {
    if (this.isDead) return;

    // Movement
    let vx = 0, vy = 0;
    if (cursors.left.isDown)  vx = -this.speed;
    if (cursors.right.isDown) vx =  this.speed;
    if (cursors.up.isDown)    vy = -this.speed;
    if (cursors.down.isDown)  vy =  this.speed;

    // Normalize diagonal
    if (vx !== 0 && vy !== 0) {
      vx *= 0.707;
      vy *= 0.707;
    }
    this.body.setVelocity(vx, vy);

    // Facing direction for animation
    if (vx !== 0 || vy !== 0) {
      if (Math.abs(vx) > Math.abs(vy)) {
        this.facing = vx > 0 ? 'right' : 'left';
      } else {
        this.facing = vy > 0 ? 'down' : 'up';
      }
    }

    // Animation
    const moving = vx !== 0 || vy !== 0;
    const animKey = moving ? `player_walk_${this.facing}` : `player_idle_${this.facing}`;
    if (this.anims.currentAnim?.key !== animKey) {
      this.anims.play(animKey, true);
    }

    // Gun aiming
    const angle = Phaser.Math.Angle.Between(this.x, this.y, pointer.worldX, pointer.worldY);
    this.gun.setPosition(this.x, this.y);
    this.gun.setRotation(angle);

    // Muzzle flash position
    const gunTip = 14;
    this.muzzleFlash.setPosition(
      this.x + Math.cos(angle) * gunTip,
      this.y + Math.sin(angle) * gunTip
    );

    // Shooting
    if (pointer.isDown && time > this.lastFired + this.fireRate && this.ammo > 0 && !this.reloading) {
      this.shoot(angle, time);
    }

    // Auto-reload when empty
    if (this.ammo <= 0 && !this.reloading) {
      this.startReload();
    }
  }

  shoot(angle, time) {
    this.lastFired = time;
    this.ammo--;
    this.scene.bulletPool.fire(this.x, this.y, angle);
    this.scene.events.emit('ammo-updated');

    // Muzzle flash
    this.muzzleFlash.setVisible(true);
    this.scene.time.delayedCall(55, () => {
      if (this.muzzleFlash) this.muzzleFlash.setVisible(false);
    });

    // Tiny camera shake on fire
    this.scene.cameras.main.shake(40, 0.0015);
  }

  startReload() {
    this.reloading = true;
    this.scene.events.emit('reload-start');

    this.scene.time.delayedCall(1500, () => {
      this.ammo = this.maxAmmo;
      this.reloading = false;
      this.scene.events.emit('ammo-updated');
      this.scene.events.emit('reload-done');
    });
  }

  takeDamage(amount) {
    if (this.isDead) return;
    const now = this.scene.time.now;
    if (now < this.invincibleUntil) return; // brief invincibility frames

    this.health -= amount;
    this.invincibleUntil = now + 500; // 500ms of invincibility after hit

    this.scene.events.emit('health-updated');
    this.scene.cameras.main.shake(180, 0.006);

    // Hit flash
    this.setTint(0xff0000);
    this.scene.time.delayedCall(120, () => {
      if (this.active) this.clearTint();
    });

    if (this.health <= 0) {
      this.health = 0;
      this.die();
    }
  }

  die() {
    if (this.isDead) return;
    this.isDead = true;
    this.body.setVelocity(0, 0);
    this.body.setEnable(false);
    this.gun.setVisible(false);
    this.muzzleFlash.setVisible(false);

    // Death spin
    this.scene.tweens.add({
      targets: this,
      angle: 360,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => {
        this.scene.events.emit('player-died');
      },
    });
  }

  destroy() {
    if (this.gun) this.gun.destroy();
    if (this.muzzleFlash) this.muzzleFlash.destroy();
    super.destroy();
  }
}
