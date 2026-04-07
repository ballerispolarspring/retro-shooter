// Enemy — state machine AI with directional hit detection

const ENEMY_STATS = {
  basic: { hp: 30,  speed: 70,  damage: 8,  score: 100, size: 14, key: 'enemy_basic' },
  fast:  { hp: 15,  speed: 140, damage: 5,  score: 150, size: 10, key: 'enemy_fast'  },
  heavy: { hp: 90,  speed: 38,  damage: 22, score: 300, size: 20, key: 'enemy_heavy' },
};

const FRAME_CONFIG = {
  frameWidth: { basic: 14, fast: 10, heavy: 20 },
  frameHeight: { basic: 14, fast: 10, heavy: 20 },
};

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, type) {
    const stats = ENEMY_STATS[type];
    super(scene, x, y, stats.key);
    this.type = type;
    this.stats = stats;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.hp = stats.hp;
    this.maxHp = stats.hp;
    this.state = 'patrol';
    this.lastAttackTime = 0;
    this.attackCooldown = 800;

    // Patrol points
    this.patrolA = new Phaser.Math.Vector2(x - 40, y);
    this.patrolB = new Phaser.Math.Vector2(x + 40, y);
    this.patrolTarget = this.patrolB.clone();

    this.body.setCollideWorldBounds(true);
    this.body.setSize(stats.size - 2, stats.size - 2);
    this.setDepth(2);

    this.facing = 'down';
    this._playAnim('walk');
  }

  update(player, time) {
    if (this.state === 'dead') return;

    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

    switch (this.state) {
      case 'patrol':
        this._doPatrol();
        if (dist < 200) this.state = 'chase';
        break;

      case 'chase':
        this.scene.physics.moveToObject(this, player, this.stats.speed);
        this._updateFacing();
        if (dist < 28) {
          this.state = 'attack';
          this.body.setVelocity(0, 0);
        } else if (dist > 360) {
          this.state = 'patrol';
        }
        break;

      case 'attack':
        this.body.setVelocity(0, 0);
        this._faceToward(player.x, player.y);
        if (time > this.lastAttackTime + this.attackCooldown) {
          player.takeDamage(this.stats.damage);
          this.lastAttackTime = time;
          this.scene.cameras.main.shake(100, 0.004);
        }
        if (dist > 40) this.state = 'chase';
        break;
    }

    this._playAnim(this.state === 'attack' ? 'walk' : 'walk');
  }

  _doPatrol() {
    const dist = Phaser.Math.Distance.Between(
      this.x, this.y, this.patrolTarget.x, this.patrolTarget.y
    );
    if (dist < 8) {
      // Swap patrol target
      this.patrolTarget = this.patrolTarget === this.patrolB
        ? this.patrolA.clone()
        : this.patrolB.clone();
    }
    this.scene.physics.moveToObject(this, this.patrolTarget, this.stats.speed * 0.5);
    this._updateFacing();
  }

  _updateFacing() {
    const vx = this.body.velocity.x;
    const vy = this.body.velocity.y;
    if (Math.abs(vx) > Math.abs(vy)) {
      this.facing = vx > 0 ? 'right' : 'left';
    } else if (Math.abs(vy) > 0.1) {
      this.facing = vy > 0 ? 'down' : 'up';
    }
  }

  _faceToward(tx, ty) {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, tx, ty);
    const deg = Phaser.Math.RadToDeg(angle);
    if (deg > -45 && deg <= 45) this.facing = 'right';
    else if (deg > 45 && deg <= 135) this.facing = 'down';
    else if (deg > 135 || deg <= -135) this.facing = 'left';
    else this.facing = 'up';
  }

  _playAnim(action) {
    const key = `${this.type}_${action}_${this.facing}`;
    if (this.anims.currentAnim?.key !== key) {
      this.anims.play(key, true);
    }
  }

  takeDamage(amount, bulletAngle) {
    if (this.state === 'dead') return;

    // Directional multiplier
    const facingAngle = this._getFacingAngle();
    const diff = Phaser.Math.Angle.Wrap(bulletAngle - facingAngle);
    let multiplier = 1.0;
    let hitType = 'front';

    if (Math.abs(diff) > 2.4) {
      multiplier = 2.0;
      hitType = 'backstab';
    } else if (Math.abs(diff) > 1.2) {
      multiplier = 1.3;
      hitType = 'side';
    }

    const finalDamage = Math.round(amount * multiplier);
    this.hp -= finalDamage;

    this._flashHit(hitType);
    this._showDamageNumber(finalDamage, hitType);

    if (this.hp <= 0) this.die();
  }

  _getFacingAngle() {
    const map = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
    return map[this.facing] ?? 0;
  }

  _flashHit(hitType) {
    const tintMap = { backstab: 0xffdd00, side: 0xffffff, front: 0xff4444 };
    this.setTint(tintMap[hitType]);
    this.scene.time.delayedCall(90, () => {
      if (this.active) this.clearTint();
    });
  }

  _showDamageNumber(amount, hitType) {
    const colorMap = { backstab: '#ffdd00', side: '#ffffff', front: '#ff8888' };
    const prefix = hitType === 'backstab' ? '×2! ' : hitType === 'side' ? '+ ' : '';
    const text = this.scene.add.text(this.x, this.y - 8, `${prefix}${amount}`, {
      fontSize: hitType === 'backstab' ? '8px' : '7px',
      fontFamily: 'monospace',
      color: colorMap[hitType],
      stroke: '#000000',
      strokeThickness: 2,
    }).setDepth(20).setOrigin(0.5, 1);

    this.scene.tweens.add({
      targets: text,
      y: text.y - 18,
      alpha: 0,
      duration: 700,
      ease: 'Power1',
      onComplete: () => text.destroy(),
    });
  }

  die() {
    if (this.state === 'dead') return;
    this.state = 'dead';
    this.setActive(false);  // mark inactive immediately for wave-clear detection
    this.body.setVelocity(0, 0);
    this.body.setEnable(false);

    // Play death animation then fade
    const deathKey = `${this.type}_death`;
    this.anims.play(deathKey, true);

    // Score
    const current = this.scene.registry.get('score') || 0;
    this.scene.registry.set('score', current + this.stats.score);
    this.scene.events.emit('score-updated');

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 500,
      delay: 300,
      onComplete: () => this.destroy(),
    });
  }
}
