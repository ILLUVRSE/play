// @ts-nocheck
'use client';

import React, { useEffect, useRef } from 'react';
import * as Phaser from 'phaser';

interface NeonRiftProps {
  code: string;
  displayName: string;
}

interface RacerState {
  speed: number;
  heading: number;
  targetHeading: number;
  isDrifting: boolean;
  isBoosting: boolean;
  boostCooldown: number;
  boostTimer: number;
  hp: number;
  slipAngle: number;
  lastWakePos: Phaser.Math.Vector2;
  chargeLevel: number;
  isCharging: boolean;
  sectorComplete: boolean;
}

interface WakeSegment extends Phaser.GameObjects.Rectangle {
  ownerId: string;
  spawnTime: number;
  isArmed: boolean;
  isBoosted: boolean;
}

interface RivalRacer extends Phaser.Types.Physics.Arcade.SpriteWithDynamicBody {
  waypointIdx: number;
  weaveOffset: number;
  avoidOffset: number;
  state: { speed: number; boostCooldown: number };
  lastWakePos: Phaser.Math.Vector2;
  hp: number;
  rivalId: string;
}

export const NeonRift: React.FC<NeonRiftProps> = ({ code, displayName }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: 720,
      height: 1280,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      input: {
        activePointers: 3,
      },
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
      scene: {
        preload: preload,
        create: create,
        update: update,
      },
    };

    const game = new Phaser.Game(config);
    gameRef.current = game;

    const T = {
      MAX_SPEED: 520, MIN_SPEED: 140, ACCEL: 980, BRAKE: 1300, DRAG: 420,
      TURN_LOW: 3.2, TURN_HIGH: 2.2, STEER_LERP: 0.12, DRIFT_TURN_MULT: 1.55,
      DRIFT_GRIP_MULT: 0.72, DRIFT_SPEED_PENALTY: 0.08, DRIFT_SLIP_MAX: 0.45,
      BOOST_BONUS: 260, BOOST_DURATION: 900, BOOST_COOLDOWN: 2200, BOOST_TURN_PENALTY: 0.88,
      LOOK_AHEAD_MAX: 140, LOOK_AHEAD_MIN: 30, WAKE_SPACING: 18,
      WAKE_LIFETIME: 2600, WAKE_LIFETIME_BOOST: 3200, WAKE_WIDTH: 26, WAKE_ARM_TIME: 120,
      WAKE_DAMAGE: 12, WAKE_SLOW: 0.18, BUSTER_DAMAGE: 8, CHARGE_DAMAGE: 26,
      CHARGE_TIME: 850, BULLET_SPEED: 1200,
    };

    let player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
    let cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    let keys: { [key: string]: Phaser.Input.Keyboard.Key };
    let trackPoints: Phaser.Math.Vector2[] = [];
    let trackWalls: Phaser.Physics.Arcade.StaticGroup;
    let rivals: RivalRacer[] = [];
    let wakeSegments: WakeSegment[] = [];
    let wakeGroup: Phaser.Physics.Arcade.Group;
    let bullets: Phaser.Physics.Arcade.Group;
    let boss: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody & { hp: number, maxHp: number, active: boolean };

    let hpBar: Phaser.GameObjects.Graphics;
    let boostBar: Phaser.GameObjects.Graphics;
    let speedText: Phaser.GameObjects.Text;
    let chargeBar: Phaser.GameObjects.Graphics;

    let state: RacerState = {
      speed: 0, heading: -Math.PI / 2, targetHeading: -Math.PI / 2,
      isDrifting: false, isBoosting: false, boostCooldown: 0, boostTimer: 0,
      hp: 100, slipAngle: 0, lastWakePos: new Phaser.Math.Vector2(0, 0),
      chargeLevel: 0, isCharging: false, sectorComplete: false,
    };

    let touchInput = {
      swipeStart: { x: 0, y: 0 },
    };

    function preload(this: Phaser.Scene) {
      const graphics = this.make.graphics({ x: 0, y: 0, add: false });
      graphics.lineStyle(2, 0x00ffff, 1); graphics.fillStyle(0x00ffff, 0.3);
      let pts = [new Phaser.Geom.Point(0, 40), new Phaser.Geom.Point(20, 0), new Phaser.Geom.Point(40, 40), new Phaser.Geom.Point(20, 30)];
      graphics.fillPoints(pts, true); graphics.strokePoints(pts, true);
      graphics.fillStyle(0xffffff, 0.8); graphics.fillCircle(20, 25, 4);
      graphics.generateTexture('racer', 40, 40); graphics.clear();
      graphics.lineStyle(2, 0xff0055, 1); graphics.fillStyle(0xff0055, 0.3);
      graphics.fillPoints(pts, true); graphics.strokePoints(pts, true);
      graphics.fillStyle(0xffffff, 0.8); graphics.fillCircle(20, 25, 4);
      graphics.generateTexture('rival', 40, 40); graphics.clear();
      graphics.lineStyle(4, 0xa855f7, 1); graphics.fillStyle(0xa855f7, 0.4);
      let bpts = [new Phaser.Geom.Point(0, 80), new Phaser.Geom.Point(60, 0), new Phaser.Geom.Point(120, 80), new Phaser.Geom.Point(60, 60)];
      graphics.fillPoints(bpts, true); graphics.strokePoints(bpts, true);
      graphics.fillStyle(0xffffff, 0.8); graphics.fillCircle(60, 40, 10);
      graphics.generateTexture('boss', 120, 80); graphics.clear();
      graphics.fillStyle(0xffff00, 1); graphics.fillCircle(4, 4, 4);
      graphics.generateTexture('bullet', 8, 8); graphics.clear();
      graphics.fillStyle(0x00ffff, 1); graphics.fillCircle(8, 8, 8);
      graphics.lineStyle(2, 0xffffff, 1); graphics.strokeCircle(8, 8, 8);
      graphics.generateTexture('charge-bullet', 16, 16);
    }

    function create(this: Phaser.Scene) {
      for (let i = 0; i < 40; i++) {
        trackPoints.push(new Phaser.Math.Vector2(360 + Math.sin(i * 0.3) * 150, 1100 - i * 800));
      }
      trackWalls = this.physics.add.staticGroup(); wakeGroup = this.physics.add.group(); bullets = this.physics.add.group();
      const graphics = this.add.graphics();
      for (let i = 0; i < trackPoints.length - 1; i++) {
        const p1 = trackPoints[i]; const p2 = trackPoints[i+1]; const angle = Phaser.Math.Angle.BetweenPoints(p1, p2);
        const normal = angle + Math.PI / 2;
        const w1_x1 = p1.x + Math.cos(normal) * 200; const w1_y1 = p1.y + Math.sin(normal) * 200;
        const w1_x2 = p2.x + Math.cos(normal) * 200; const w1_y2 = p2.y + Math.sin(normal) * 200;
        const w2_x1 = p1.x - Math.cos(normal) * 200; const w2_y1 = p1.y - Math.sin(normal) * 200;
        const w2_x2 = p2.x - Math.cos(normal) * 200; const w2_y2 = p2.y - Math.sin(normal) * 200;
        graphics.lineStyle(8, 0xa855f7, 0.8); graphics.lineBetween(w1_x1, w1_y1, w1_x2, w1_y2); graphics.lineBetween(w2_x1, w2_y1, w2_x2, w2_y2);
        const wall1 = this.add.rectangle((w1_x1+w1_x2)/2, (w1_y1+w1_y2)/2, 20, Phaser.Math.Distance.BetweenPoints(p1,p2), 0x000000, 0);
        wall1.setRotation(angle+Math.PI/2); trackWalls.add(wall1);
        const wall2 = this.add.rectangle((w2_x1+w2_x2)/2, (w2_y1+w2_y2)/2, 20, Phaser.Math.Distance.BetweenPoints(p1,p2), 0x000000, 0);
        wall2.setRotation(angle+Math.PI/2); trackWalls.add(wall2);
      }
      this.add.grid(360, -15000, 4000, 40000, 128, 128, 0x000000, 0, 0x3b0764, 0.1).setDepth(-2);
      player = this.physics.add.sprite(360, 1100, 'racer'); state.lastWakePos.set(player.x, player.y);
      this.cameras.main.startFollow(player, true, 0.1, 0.1, 0, 230);
      this.physics.add.collider(player, trackWalls, onWallHit, undefined, this);
      this.physics.add.overlap(player, wakeGroup, onWakeOverlap as any, undefined, this);
      for (let i = 0; i < 2; i++) {
        const rival = this.physics.add.sprite(360 + (i === 0 ? -100 : 100), 1000, 'rival') as RivalRacer;
        rival.waypointIdx = 0; rival.hp = 100; rival.state = { speed: 480, boostCooldown: 3000 + i * 1000 };
        rival.lastWakePos = new Phaser.Math.Vector2(rival.x, rival.y);
        rival.rivalId = 'rival-' + i;
        rival.avoidOffset = 0;
        rivals.push(rival);
        this.physics.add.collider(rival, trackWalls);
        this.physics.add.overlap(rival, wakeGroup, (r: any, w: any) => {
          const rr = r as RivalRacer;
          if (w.ownerId !== rr.rivalId && w.isArmed) {
            const slow = w.isBoosted ? 0.22 : 0.18;
            r.setVelocity(r.body.velocity.x * (1 - slow * 0.1), r.body.velocity.y * (1 - slow * 0.1));
            rr.hp -= (w.isBoosted ? 16 : 12) * delta / 1000;
          }
        });
      }
      const lastPoint = trackPoints[trackPoints.length - 1];
      boss = this.physics.add.sprite(lastPoint.x, lastPoint.y - 1000, 'boss') as any;
      boss.hp = 500; boss.maxHp = 500; boss.active = false;
      this.physics.add.overlap(bullets, boss, (b: any, bullet: any) => {
        if (!boss.active) return;
        boss.hp -= bullet.isCharged ? T.CHARGE_DAMAGE : T.BUSTER_DAMAGE;
        if (!bullet.isCharged) bullet.destroy();
        this.cameras.main.shake(100, 0.005);
      });
      this.physics.add.overlap(bullets, rivals, onBulletHit as any, undefined, this);
      cursors = this.input.keyboard.createCursorKeys();
      keys = this.input.keyboard.addKeys('W,A,S,D,SPACE,SHIFT') as any;

      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        touchInput.swipeStart.x = pointer.x;
        touchInput.swipeStart.y = pointer.y;
        state.isCharging = true;
      });

      this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
        const dx = pointer.x - touchInput.swipeStart.x;
        const dy = pointer.y - touchInput.swipeStart.y;
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 50) {
          if (dy < 0) triggerBoost();
        } else if (Math.abs(dx) < 20 && Math.abs(dy) < 20) {
          if (state.chargeLevel >= T.CHARGE_TIME) fireBullet(this, true);
          else fireBullet(this, false);
        }
        state.isCharging = false;
        state.chargeLevel = 0;
      });

      hpBar = this.add.graphics().setScrollFactor(0).setDepth(10);
      boostBar = this.add.graphics().setScrollFactor(0).setDepth(10);
      chargeBar = this.add.graphics().setScrollFactor(0).setDepth(10);
      speedText = this.add.text(360, 1150, '0 MPH', { fontSize: '48px', color: '#ffffff', fontStyle: 'bold italic' }).setOrigin(0.5).setScrollFactor(0).setDepth(10);
    }

    function fireBullet(scene: Phaser.Scene, isCharged: boolean) {
      const bullet = scene.physics.add.sprite(player.x, player.y, isCharged ? 'charge-bullet' : 'bullet') as any;
      bullet.isCharged = isCharged; const angle = player.rotation - Math.PI / 2;
      bullet.setVelocity(Math.cos(angle) * T.BULLET_SPEED, Math.sin(angle) * T.BULLET_SPEED);
      bullet.setRotation(angle); bullets.add(bullet);
      scene.time.delayedCall(2000, () => bullet.destroy());
    }

    function onBulletHit(rival: RivalRacer, bullet: any) {
      rival.hp -= bullet.isCharged ? T.CHARGE_DAMAGE : T.BUSTER_DAMAGE;
      if (!bullet.isCharged) bullet.destroy();
      if (rival.hp <= 0) { rival.setAlpha(0.2); rival.state.speed = 0; }
    }

    function triggerBoost() {
      if (state.isBoosting || state.boostCooldown > 0) return;
      state.isBoosting = true; state.boostTimer = T.BOOST_DURATION; state.boostCooldown = T.BOOST_COOLDOWN;
    }

    function onWallHit(p: any, wall: any) {
      if (state.speed > 420) { state.hp -= 10; this.cameras.main.shake(100, 0.01); }
      state.speed *= 0.65;
    }

    function onWakeOverlap(p: any, wake: WakeSegment) {
      if (!wake.isArmed || wake.ownerId === 'player') return;
      state.hp -= ((wake.isBoosted ? 16 : 12) * game.loop.delta / 1000);
      state.speed *= (1 - (wake.isBoosted ? 0.22 : 0.18) * game.loop.delta / 1000);
    }

    function spawnWake(scene: Phaser.Scene, x: number, y: number, angle: number, ownerId: string, isBoosted: boolean) {
      const wake = scene.add.rectangle(x, y, T.WAKE_SPACING + 2, T.WAKE_WIDTH, isBoosted ? 0xffffff : (ownerId === 'player' ? 0x00ffff : 0xff0055), 0.6) as WakeSegment;
      wake.setRotation(angle); wake.ownerId = ownerId; wake.spawnTime = scene.time.now; wake.isArmed = false; wake.isBoosted = isBoosted;
      scene.physics.add.existing(wake); wakeGroup.add(wake); wakeSegments.push(wake);
    }

    function update(this: Phaser.Scene, time: number, delta: number) {
      const dt = delta / 1000;
      if (state.boostCooldown > 0) state.boostCooldown -= delta;
      if (state.isBoosting) { state.boostTimer -= delta; if (state.boostTimer <= 0) state.isBoosting = false; }
      if (state.isCharging) state.chargeLevel += delta;

      let isLeft = cursors.left.isDown || keys.A.isDown;
      let isRight = cursors.right.isDown || keys.D.isDown;
      let isBrake = cursors.down.isDown || keys.S.isDown || keys.SHIFT.isDown;

      const pointers = [this.input.pointer1, this.input.pointer2, this.input.activePointer];
      pointers.forEach(p => {
        if (p.isDown) {
          if (p.x < 240) isLeft = true;
          else if (p.x > 480) isRight = true;
          if (p.y - touchInput.swipeStart.y > 60) isBrake = true;
        }
      });
      state.isDrifting = isBrake;

      const currentMaxSpeed = state.isBoosting ? (T.MAX_SPEED + T.BOOST_BONUS) : T.MAX_SPEED;
      state.speed = Math.min(state.speed + T.ACCEL * dt, currentMaxSpeed);
      if (state.isDrifting) state.speed *= (1 - T.DRIFT_SPEED_PENALTY * dt);

      const speedNorm = Math.min(state.speed / T.MAX_SPEED, 1);
      let turnRate = Phaser.Math.Linear(T.TURN_LOW, T.TURN_HIGH, speedNorm);
      if (state.isDrifting) turnRate *= T.DRIFT_TURN_MULT;
      if (state.isBoosting) turnRate *= T.BOOST_TURN_PENALTY;
      if (isLeft) state.targetHeading -= turnRate * dt; if (isRight) state.targetHeading += turnRate * dt;

      const lerpFactor = 1 - Math.pow(1 - T.STEER_LERP, delta / 16.66);
      let diff = state.targetHeading - state.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      state.heading += diff * lerpFactor;

      const targetSlip = state.isDrifting ? (isLeft ? -T.DRIFT_SLIP_MAX : (isRight ? T.DRIFT_SLIP_MAX : 0)) : 0;
      state.slipAngle = Phaser.Math.Linear(state.slipAngle, targetSlip, lerpFactor);
      const moveAngle = state.heading + state.slipAngle;
      player.setVelocity(Math.cos(moveAngle) * state.speed, Math.sin(moveAngle) * state.speed);
      player.setRotation(state.heading + Math.PI / 2);

      if (Phaser.Math.Distance.Between(player.x, player.y, state.lastWakePos.x, state.lastWakePos.y) >= T.WAKE_SPACING) {
        spawnWake(this, (player.x + state.lastWakePos.x)/2, (player.y + state.lastWakePos.y)/2, moveAngle, 'player', state.isBoosting);
        state.lastWakePos.set(player.x, player.y);
      }
      this.cameras.main.setFollowOffset(-Math.cos(moveAngle) * Phaser.Math.Clamp(speedNorm * T.LOOK_AHEAD_MAX, T.LOOK_AHEAD_MIN, T.LOOK_AHEAD_MAX), 230 - Math.sin(moveAngle) * Phaser.Math.Clamp(speedNorm * T.LOOK_AHEAD_MAX, T.LOOK_AHEAD_MIN, T.LOOK_AHEAD_MAX));
      this.cameras.main.zoom = Phaser.Math.Linear(this.cameras.main.zoom, state.isBoosting ? 1.08 : 1.0, lerpFactor);

      rivals.forEach((rival, idx) => {
        if (rival.hp <= 0) return;
        const target = trackPoints[rival.waypointIdx];
        if (Phaser.Math.Distance.BetweenPoints(rival, target) < 100) rival.waypointIdx = (rival.waypointIdx + 1) % trackPoints.length;

        // Wake Avoidance
        let avoidOffset = 0;
        const projectedPos = { x: rival.x + rival.body.velocity.x * 0.35, y: rival.y + rival.body.velocity.y * 0.35 };
        wakeSegments.forEach(seg => {
          if (seg.ownerId !== rival.rivalId && seg.isArmed) {
            if (Phaser.Math.Distance.BetweenPoints(projectedPos, seg) < 40) {
              avoidOffset = (rival.x > seg.x) ? 40 : -40;
            }
          }
        });
        rival.avoidOffset = Phaser.Math.Linear(rival.avoidOffset, avoidOffset, 0.1);

        const angleToTarget = Phaser.Math.Angle.BetweenPoints(rival, target);
        rival.setVelocity(Math.cos(angleToTarget) * rival.state.speed, Math.sin(angleToTarget) * rival.state.speed);
        // Apply weave and avoidance
        const lateralAngle = angleToTarget + Math.PI / 2;
        const weave = Math.sin(time / 1000 * (0.6 + idx * 0.15) * Math.PI * 2) * 18;
        rival.body.velocity.x += Math.cos(lateralAngle) * (weave + rival.avoidOffset) * 10;
        rival.body.velocity.y += Math.sin(lateralAngle) * (weave + rival.avoidOffset) * 10;

        rival.setRotation(angleToTarget + Math.PI / 2);
        if (Phaser.Math.Distance.Between(rival.x, rival.y, rival.lastWakePos.x, rival.lastWakePos.y) >= T.WAKE_SPACING) {
          spawnWake(this, (rival.x + rival.lastWakePos.x)/2, (rival.y + rival.lastWakePos.y)/2, angleToTarget, rival.rivalId, false);
          rival.lastWakePos.set(rival.x, rival.y);
        }
      });
      if (Phaser.Math.Distance.BetweenPoints(player, boss) < 1000) boss.active = true;
      if (boss.active && boss.hp > 0) { boss.x = boss.x + Math.sin(time / 1000) * 5; }
      else if (boss.hp <= 0 && !state.sectorComplete) {
        state.sectorComplete = true; this.add.text(360, 640, 'SECTOR CLEAR\nMODULE ACQUIRED', { fontSize: '48px', color: '#00ffff', align: 'center' }).setOrigin(0.5).setScrollFactor(0);
      }
      for (let i = wakeSegments.length - 1; i >= 0; i--) {
        const seg = wakeSegments[i]; const age = time - seg.spawnTime; const maxLife = seg.isBoosted ? T.WAKE_LIFETIME_BOOST : T.WAKE_LIFETIME;
        if (age > T.WAKE_ARM_TIME) seg.isArmed = true;
        if (age > maxLife) { seg.destroy(); wakeSegments.splice(i, 1); }
        else seg.setAlpha(Math.max(0, 0.6 * (1 - age / maxLife)));
      }

      hpBar.clear(); hpBar.fillStyle(0x333333, 0.8); hpBar.fillRect(40, 40, 200, 20);
      hpBar.fillStyle(0xff0055, 1); hpBar.fillRect(40, 40, 2 * Math.max(0, state.hp), 20);
      boostBar.clear(); boostBar.fillStyle(0x333333, 0.8); boostBar.fillRect(40, 70, 200, 10);
      boostBar.fillStyle(0x00ffff, 1); boostBar.fillRect(40, 70, 200 * (1 - Math.max(0, state.boostCooldown) / T.BOOST_COOLDOWN), 10);
      chargeBar.clear(); if (state.isCharging) {
        chargeBar.fillStyle(0xffffff, 0.5); chargeBar.fillRect(260, 1100, 200, 10);
        chargeBar.fillStyle(0xffff00, 1); chargeBar.fillRect(260, 1100, 200 * Math.min(1, state.chargeLevel / T.CHARGE_TIME), 10);
      }
      speedText.setText(Math.floor(state.speed / 5) + ' MPH');
      speedText.setColor(state.isBoosting ? '#00ffff' : '#ffffff');
    }

    return () => { game.destroy(true); };
  }, [code, displayName]);

  return <div ref={containerRef} className="w-full h-full" />;
};
