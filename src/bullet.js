// BulletPool — object pool using Phaser Arcade Group

class Bullet extends Phaser.Physics.Arcade.Image {
  constructor(scene, x, y) {
    super(scene, x, y, 'bullet');
    this.firedAngle = 0;
    this.born = 0;
  }

  fire(x, y, angle) {
    this.setActive(true);
    this.setVisible(true);
    this.setPosition(x + Math.cos(angle) * 18, y + Math.sin(angle) * 18);
    this.setRotation(angle);
    this.firedAngle = angle;
    this.born = this.scene.time.now;
    this.scene.physics.velocityFromAngle(
      Phaser.Math.RadToDeg(angle),
      480,
      this.body.velocity
    );
  }

  preUpdate(time) {
    if (!this.active) return;
    // Lifespan: 1800ms
    if (time - this.born > 1800) {
      this.deactivate();
      return;
    }
    // Out of world bounds
    const bounds = this.scene.physics.world.bounds;
    if (
      this.x < bounds.x - 20 ||
      this.x > bounds.x + bounds.width + 20 ||
      this.y < bounds.y - 20 ||
      this.y > bounds.y + bounds.height + 20
    ) {
      this.deactivate();
    }
  }

  deactivate() {
    this.setActive(false);
    this.setVisible(false);
    if (this.body) {
      this.body.setVelocity(0, 0);
    }
  }
}

export class BulletPool {
  constructor(scene) {
    this.scene = scene;
    this.group = scene.physics.add.group({
      classType: Bullet,
      maxSize: 60,
      runChildUpdate: true,
      createCallback: (bullet) => {
        bullet.setDepth(3);
        bullet.body.setAllowGravity(false);
      }
    });
  }

  fire(x, y, angle) {
    const bullet = this.group.get(x, y, 'bullet');
    if (!bullet) return;
    bullet.fire(x, y, angle);
  }

  getGroup() {
    return this.group;
  }
}
