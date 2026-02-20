
class SpacelightGame {
  constructor(io, code, isCoop = false) {
    this.io = io;
    this.code = code;
    this.isCoop = isCoop;
    this.players = new Map(); // socketId -> data
    this.enemies = [];
    this.bullets = [];
    this.powerups = [];
    this.wave = 1;
    this.score = 0;
    this.status = 'playing'; // 'waiting', 'playing', 'gameover'
    this.width = 800;
    this.height = 600;
    this.lastUpdate = Date.now();
    this.startTime = Date.now();
    this.enemiesSpawned = 0;
    this.enemiesToSpawn = 10;
    this.spawnTimer = 0;
    this.bossActive = false;
    this.shakeAmount = 0;
  }

  addPlayer(socketId, displayName) {
    this.players.set(socketId, {
      id: socketId,
      displayName,
      x: this.width / 2,
      y: this.height - 50,
      width: 40,
      height: 40,
      health: 100,
      maxHealth: 100,
      score: 0,
      weapon: 'blaster',
      upgrades: [], // e.g., 'speed', 'damage', 'shield'
      lastShot: 0,
      hitFlash: 0,
      input: { x: this.width / 2, y: this.height - 50, shooting: false }
    });
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
    if (this.players.size === 0 && this.status === 'playing') {
      this.status = 'gameover';
    }
  }

  handleInput(socketId, input) {
    const player = this.players.get(socketId);
    if (player) {
      if (input.x !== undefined) player.input.x = input.x;
      if (input.y !== undefined) player.input.y = input.y;
      if (input.shooting !== undefined) player.input.shooting = input.shooting;
    }
  }

  update() {
    if (this.status !== 'playing') return;

    const now = Date.now();
    const dt = (now - this.lastUpdate) / 1000;
    this.lastUpdate = now;

    if (this.shakeAmount > 0) this.shakeAmount -= dt * 20;

    // Update players
    for (const player of this.players.values()) {
      if (player.hitFlash > 0) player.hitFlash -= dt * 10;

      const targetX = Math.max(20, Math.min(this.width - 20, player.input.x));
      const targetY = Math.max(20, Math.min(this.height - 20, player.input.y));

      const moveSpeed = player.upgrades.includes('speed') ? 0.3 : 0.2;
      player.x += (targetX - player.x) * moveSpeed;
      player.y += (targetY - player.y) * moveSpeed;

      // Shooting
      let fireRate = 250;
      if (player.weapon === 'laser') fireRate = 120;
      if (player.weapon === 'spread') fireRate = 400;
      if (player.upgrades.includes('rapid')) fireRate *= 0.7;

      if (player.input.shooting && now - player.lastShot > fireRate) {
        this.fireBullet(player);
        player.lastShot = now;
      }
    }

    // Spawn logic
    this.spawnTimer += dt;
    if (!this.bossActive) {
        const spawnRate = Math.max(0.4, 1.5 - (this.wave * 0.1));
        if (this.spawnTimer > spawnRate && this.enemiesSpawned < this.enemiesToSpawn) {
          this.spawnEnemy();
          this.spawnTimer = 0;
        }
    } else {
        // Boss specialized spawning or behavior
        const boss = this.enemies.find(e => e.isBoss);
        if (boss && this.spawnTimer > 2) {
            this.fireEnemyBullet(boss.x, boss.y + 40, 0, 300);
            this.fireEnemyBullet(boss.x - 40, boss.y + 20, -100, 250);
            this.fireEnemyBullet(boss.x + 40, boss.y + 20, 100, 250);
            this.spawnTimer = 0;
        }
    }

    // Update enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (enemy.hitFlash > 0) enemy.hitFlash -= dt * 10;

      if (enemy.isBoss) {
          enemy.x += Math.sin(now / 1000) * 150 * dt;
          if (enemy.y < 100) enemy.y += 50 * dt;
      } else {
          enemy.y += enemy.speed * dt;
          if (enemy.type === 'zigzag') {
              enemy.x += Math.sin(now / 200) * 3;
          } else if (enemy.type === 'diver') {
              if (enemy.y > 100 && enemy.y < 400) {
                  enemy.speed = 400;
              } else {
                  enemy.speed = 100;
              }
          }
      }

      if (enemy.y > this.height + 100) {
        this.enemies.splice(i, 1);
        continue;
      }

      // Check collision with players
      for (const player of this.players.values()) {
          if (this.checkCollision(player, enemy)) {
              const damage = enemy.isBoss ? 50 : 25;
              player.health -= damage;
              player.hitFlash = 1;
              this.shakeAmount = 10;
              if (!enemy.isBoss) enemy.health = 0;
              if (player.health <= 0) this.status = 'gameover';
          }
      }

      if (enemy.health <= 0) {
          this.score += enemy.points;
          if (enemy.isBoss) this.bossActive = false;
          this.enemies.splice(i, 1);
          this.shakeAmount = 15;
      }
    }

    // Update bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      bullet.y += bullet.vy * dt;
      bullet.x += bullet.vx * dt;

      if (bullet.y < -50 || bullet.y > this.height + 50 || bullet.x < -50 || bullet.x > this.width + 50) {
        this.bullets.splice(i, 1);
        continue;
      }

      if (bullet.fromPlayer) {
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const enemy = this.enemies[j];
          if (this.checkCollision(bullet, enemy)) {
            enemy.health -= bullet.damage;
            enemy.hitFlash = 1;
            this.bullets.splice(i, 1);
            if (enemy.health <= 0) {
              this.score += enemy.points;
              if (enemy.isBoss) this.bossActive = false;
              this.enemies.splice(j, 1);
              if (Math.random() < 0.2) this.spawnPowerup(enemy.x, enemy.y);
            }
            break;
          }
        }
      } else {
        for (const player of this.players.values()) {
          if (this.checkCollision(bullet, player)) {
            player.health -= bullet.damage;
            player.hitFlash = 1;
            this.bullets.splice(i, 1);
            this.shakeAmount = 5;
            if (player.health <= 0) this.status = 'gameover';
            break;
          }
        }
      }
    }

    // Update Powerups
    for (let i = this.powerups.length - 1; i >= 0; i--) {
        const pup = this.powerups[i];
        pup.y += 100 * dt;
        if (this.players.size > 0) {
            for (const player of this.players.values()) {
                if (this.checkCollision(pup, player)) {
                    if (['spread', 'laser'].includes(pup.type)) {
                        player.weapon = pup.type;
                    } else {
                        if (player.upgrades.length < 5) player.upgrades.push(pup.type);
                        if (pup.type === 'health') player.health = Math.min(player.maxHealth, player.health + 30);
                    }
                    this.powerups.splice(i, 1);
                    break;
                }
            }
        }
        if (pup && pup.y > this.height) this.powerups.splice(i, 1);
    }

    // Check wave completion
    if (this.enemiesSpawned >= this.enemiesToSpawn && this.enemies.length === 0 && !this.bossActive) {
        if (this.wave % 5 === 0) {
            this.spawnBoss();
        } else {
            this.wave++;
            this.enemiesSpawned = 0;
            this.enemiesToSpawn = 10 + this.wave * 2;
            this.io.to(this.code).emit('game:wave_complete', { wave: this.wave });
        }
    }

    this.broadcastState();
  }

  fireBullet(player) {
    const damageMult = player.upgrades.includes('damage') ? 1.5 : 1;
    if (player.weapon === 'spread') {
        [-0.2, 0, 0.2].forEach(angle => {
            this.bullets.push({
                x: player.x, y: player.y - 20,
                vx: Math.sin(angle) * 500, vy: -Math.cos(angle) * 500,
                width: 6, height: 12, damage: 8 * damageMult, fromPlayer: true
            });
        });
    } else if (player.weapon === 'laser') {
        this.bullets.push({
            x: player.x, y: player.y - 20,
            vx: 0, vy: -900,
            width: 4, height: 35, damage: 6 * damageMult, fromPlayer: true
        });
    } else {
        this.bullets.push({
            x: player.x, y: player.y - 20,
            vx: 0, vy: -600,
            width: 8, height: 16, damage: 15 * damageMult, fromPlayer: true
        });
    }
  }

  fireEnemyBullet(x, y, vx, vy) {
      this.bullets.push({
          x, y, vx, vy, width: 10, height: 10, damage: 10, fromPlayer: false
      });
  }

  spawnEnemy() {
    const r = Math.random();
    let type = 'basic';
    if (r > 0.8) type = 'zigzag';
    else if (r > 0.6) type = 'diver';

    this.enemies.push({
      id: Math.random().toString(36).substr(2, 9),
      x: Math.random() * (this.width - 60) + 30,
      y: -50,
      width: 40, height: 40,
      speed: 100 + this.wave * 5,
      health: 20 + this.wave * 3,
      points: 100, hitFlash: 0,
      type
    });
    this.enemiesSpawned++;
  }

  spawnBoss() {
      this.bossActive = true;
      this.enemies.push({
          id: 'boss-' + this.wave,
          isBoss: true,
          x: this.width / 2,
          y: -100,
          width: 120, height: 80,
          health: 500 + this.wave * 200,
          points: 5000, hitFlash: 0,
          type: 'boss'
      });
  }

  spawnPowerup(x, y) {
      const types = ['spread', 'laser', 'speed', 'rapid', 'damage', 'health'];
      const type = types[Math.floor(Math.random() * types.length)];
      this.powerups.push({ x, y, width: 30, height: 30, type });
  }

  checkCollision(a, b) {
    return (
      a.x - (a.width||0)/2 < b.x + (b.width||0)/2 &&
      a.x + (a.width||0)/2 > b.x - (b.width||0)/2 &&
      a.y - (a.height||0)/2 < b.y + (b.height||0)/2 &&
      a.y + (a.height||0)/2 > b.y - (b.height||0)/2
    );
  }

  broadcastState() {
    this.io.to(this.code).emit('game:state', {
      players: Array.from(this.players.values()).map(p => ({
          id: p.id, displayName: p.displayName, x: p.x, y: p.y,
          health: p.health, maxHealth: p.maxHealth, score: p.score,
          weapon: p.weapon, upgrades: p.upgrades, hitFlash: p.hitFlash
      })),
      enemies: this.enemies.map(e => ({
          id: e.id, x: e.x, y: e.y, width: e.width, height: e.height,
          type: e.type, isBoss: e.isBoss, health: e.health, hitFlash: e.hitFlash
      })),
      bullets: this.bullets,
      powerups: this.powerups,
      wave: this.wave,
      score: this.score,
      status: this.status,
      shakeAmount: this.shakeAmount
    });
  }
}

module.exports = SpacelightGame;
