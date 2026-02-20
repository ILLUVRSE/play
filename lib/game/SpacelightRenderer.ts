
export class SpacelightRenderer {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private stars: { x: number; y: number; speed: number; size: number }[] = [];

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.initStars();
  }

  private initStars() {
    for (let i = 0; i < 100; i++) {
      this.stars.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        speed: 1 + Math.random() * 3,
        size: 1 + Math.random() * 2,
      });
    }
  }

  render(state: any, playerId: string | null) {
    this.ctx.save();

    // Screen Shake
    if (state.shakeAmount > 0) {
        const sx = (Math.random() - 0.5) * state.shakeAmount;
        const sy = (Math.random() - 0.5) * state.shakeAmount;
        this.ctx.translate(sx, sy);
    }

    this.ctx.fillStyle = '#000510';
    this.ctx.fillRect(0, 0, this.width, this.height);

    this.renderStars();
    this.renderPowerups(state.powerups || []);
    this.renderEnemies(state.enemies || []);
    this.renderBullets(state.bullets || []);
    this.renderPlayers(state.players || [], playerId);
    this.renderUI(state, playerId);

    this.ctx.restore();
  }

  private renderStars() {
    this.ctx.fillStyle = '#ffffff';
    for (const star of this.stars) {
      this.ctx.beginPath();
      this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      this.ctx.fill();
      star.y += star.speed;
      if (star.y > this.height) star.y = 0;
    }
  }

  private renderPlayers(players: any[], myId: string | null) {
    for (const player of players) {
      const isMe = player.id === myId;
      this.drawShip(player, isMe);
    }
  }

  private drawShip(player: any, isMe: boolean) {
    const { x, y, displayName, health, maxHealth, hitFlash, upgrades } = player;
    const color = isMe ? '#00ffff' : '#ff00ff';
    const healthPct = health / maxHealth;

    this.ctx.save();
    this.ctx.translate(x, y);

    // Hit Flash
    if (hitFlash > 0) {
        this.ctx.shadowBlur = 30;
        this.ctx.shadowColor = '#ffffff';
        this.ctx.fillStyle = '#ffffff';
    } else {
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = color;
        this.ctx.fillStyle = color;
    }

    // Body
    this.ctx.beginPath();
    this.ctx.moveTo(0, -20);
    this.ctx.lineTo(15, 15);
    this.ctx.lineTo(0, 5);
    this.ctx.lineTo(-15, 15);
    this.ctx.closePath();
    this.ctx.fill();

    // Upgrades visual
    if (upgrades?.includes('damage')) {
        this.ctx.strokeStyle = '#ff0000';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }

    // Cockpit
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.arc(0, -5, 4, 0, Math.PI * 2);
    this.ctx.fill();

    // Health bar
    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = '#333';
    this.ctx.fillRect(-20, 25, 40, 4);
    this.ctx.fillStyle = healthPct > 0.3 ? '#00ff00' : '#ff0000';
    this.ctx.fillRect(-20, 25, Math.max(0, 40 * healthPct), 4);

    // Name
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '10px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(displayName, 0, 40);

    this.ctx.restore();
  }

  private renderEnemies(enemies: any[]) {
    for (const enemy of enemies) {
      if (enemy.isBoss) {
          this.drawBoss(enemy);
      } else {
          this.drawEnemy(enemy);
      }
    }
  }

  private drawEnemy(enemy: any) {
    this.ctx.save();
    this.ctx.translate(enemy.x, enemy.y);

    let color = '#ff3366';
    if (enemy.type === 'zigzag') color = '#cc33ff';
    if (enemy.type === 'diver') color = '#ff9900';

    if (enemy.hitFlash > 0) {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.shadowColor = '#ffffff';
    } else {
        this.ctx.fillStyle = color;
        this.ctx.shadowColor = color;
    }

    this.ctx.shadowBlur = 10;
    this.ctx.beginPath();
    this.ctx.moveTo(0, 15);
    this.ctx.lineTo(-15, -10);
    this.ctx.lineTo(0, -5);
    this.ctx.lineTo(15, -10);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.restore();
  }

  private drawBoss(boss: any) {
      this.ctx.save();
      this.ctx.translate(boss.x, boss.y);

      const color = '#ff0000';
      if (boss.hitFlash > 0) {
          this.ctx.fillStyle = '#ffffff';
          this.ctx.shadowColor = '#ffffff';
      } else {
          this.ctx.fillStyle = color;
          this.ctx.shadowColor = color;
      }

      this.ctx.shadowBlur = 25;
      this.ctx.beginPath();
      this.ctx.moveTo(0, 40);
      this.ctx.lineTo(-60, -20);
      this.ctx.lineTo(-30, -40);
      this.ctx.lineTo(30, -40);
      this.ctx.lineTo(60, -20);
      this.ctx.closePath();
      this.ctx.fill();

      // Boss detail
      this.ctx.fillStyle = '#000';
      this.ctx.fillRect(-20, -10, 40, 10);
      this.ctx.fillStyle = '#ff00ff';
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 15, 0, Math.PI*2);
      this.ctx.fill();

      this.ctx.restore();
  }

  private renderBullets(bullets: any[]) {
    for (const bullet of bullets) {
      this.ctx.fillStyle = bullet.fromPlayer ? '#00ffff' : '#ff0000';
      this.ctx.shadowBlur = 5;
      this.ctx.shadowColor = this.ctx.fillStyle;
      this.ctx.fillRect(bullet.x - bullet.width / 2, bullet.y - bullet.height / 2, bullet.width, bullet.height);
    }
  }

  private renderPowerups(powerups: any[]) {
      for (const pup of powerups) {
          this.ctx.save();
          this.ctx.translate(pup.x, pup.y);
          this.ctx.fillStyle = '#ffff00';
          this.ctx.shadowBlur = 10;
          this.ctx.shadowColor = '#ffff00';
          this.ctx.beginPath();
          this.ctx.arc(0, 0, 12, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.fillStyle = '#000';
          this.ctx.font = 'bold 10px sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.fillText(pup.type.substring(0, 3).toUpperCase(), 0, 4);
          this.ctx.restore();
      }
  }

  private renderUI(state: any, myId: string | null) {
      this.ctx.shadowBlur = 0;
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 20px sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.fillText(`SCORE: ${state.score || 0}`, 20, 40);
      this.ctx.textAlign = 'right';
      this.ctx.fillText(`WAVE: ${state.wave || 1}`, this.width - 20, 40);

      // Upgrades display for me
      const me = state.players?.find((p: any) => p.id === myId);
      if (me && me.upgrades?.length > 0) {
          this.ctx.textAlign = 'left';
          this.ctx.font = '10px sans-serif';
          this.ctx.fillText('UPGRADES: ' + me.upgrades.join(' • '), 20, 60);
      }

      if (state.status === 'gameover') {
          this.ctx.fillStyle = 'rgba(0,0,0,0.8)';
          this.ctx.fillRect(0, 0, this.width, this.height);
          this.ctx.fillStyle = '#ff0000';
          this.ctx.font = '60px sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.fillText('MISSION FAILED', this.width / 2, this.height / 2);
          this.ctx.font = '24px sans-serif';
          this.ctx.fillStyle = '#ffffff';
          this.ctx.fillText(`Final Score: ${state.score || 0}`, this.width / 2, this.height / 2 + 60);
          this.ctx.fillText('Refresh browser to restart mission', this.width / 2, this.height / 2 + 100);
      }
  }
}
