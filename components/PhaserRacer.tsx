// @ts-nocheck
'use client';

import React, { useEffect, useRef } from 'react';
import * as Phaser from 'phaser';
import { ensureSocket } from '@/lib/socketClient';
import type { Socket } from 'socket.io-client';

interface PhaserRacerProps {
  partyId: string;
  isHost: boolean;
  participantId: string;
  gameState: 'LOBBY' | 'COUNTDOWN' | 'RACING' | 'FINISHED';
  setGameState: (state: 'LOBBY' | 'COUNTDOWN' | 'RACING' | 'FINISHED') => void;
  setCountdown: (count: number | null) => void;
}

interface PlayerState {
  id: string;
  x: number;
  y: number;
  rotation: number;
  velocity: { x: number; y: number };
  score: number;
  lap: number;
  checkpoint: number;
  isBoosting: boolean;
}

export const PhaserRacer: React.FC<PhaserRacerProps> = ({
  partyId,
  isHost,
  participantId,
  gameState,
  setGameState,
  setCountdown
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const gameStateRef = useRef(gameState);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    if (!containerRef.current) return;

    socketRef.current = ensureSocket(socketRef);

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: 800,
      height: 600,
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

    let players: Map<string, Phaser.GameObjects.Container & {
      boatBody: Phaser.Physics.Arcade.Body,
      isBoosting: boolean,
      lap: number,
      checkpoint: number,
      targetX?: number,
      targetY?: number,
      targetRotation?: number
    }> = new Map();
    let playersGroup: Phaser.Physics.Arcade.Group;
    let guestInputs: Map<string, { up: boolean, left: boolean, right: boolean }> = new Map();
    let cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    let trackGraphics: Phaser.GameObjects.Graphics;
    let trackPath: Phaser.Curves.Path;
    let walls: Phaser.Physics.Arcade.StaticGroup;
    let boostPads: Phaser.Physics.Arcade.StaticGroup;
    let wakeParticles: Phaser.GameObjects.Particles.ParticleEmitter;
    let boostParticles: Phaser.GameObjects.Particles.ParticleEmitter;
    let lapText: Phaser.GameObjects.Text;
    let speedText: Phaser.GameObjects.Text;
    let leaderboardText: Phaser.GameObjects.Text;

    // Constants for physics
    const ACCEL = 400;
    const BOOST_ACCEL = 1000;
    const DRAG = 0.97;
    const ANGULAR_VEL = 180;

    function preload(this: Phaser.Scene) {
      const graphics = this.make.graphics({ x: 0, y: 0, add: false });
      graphics.fillStyle(0xffffff);
      graphics.fillTriangle(0, 0, 0, 40, 35, 20);
      graphics.fillStyle(0x333333);
      graphics.fillRect(5, 12, 15, 16);
      graphics.generateTexture('boat', 35, 40);

      const bGraphics = this.make.graphics({ x: 0, y: 0, add: false });
      bGraphics.fillStyle(0x00ffff, 0.8);
      bGraphics.fillCircle(10, 10, 10);
      bGraphics.generateTexture('boost-pad', 20, 20);

      const pGraphics = this.make.graphics({ x: 0, y: 0, add: false });
      pGraphics.fillStyle(0xffffff, 0.5);
      pGraphics.fillCircle(4, 4, 4);
      pGraphics.generateTexture('particle', 8, 8);
    }

    function create(this: Phaser.Scene) {
      cursors = this.input.keyboard.createCursorKeys();
      playersGroup = this.physics.add.group();
      this.add.rectangle(400, 300, 800, 600, 0x001a33);

      wakeParticles = this.add.particles(0, 0, 'particle', {
        speed: { min: 20, max: 50 },
        scale: { start: 1, end: 0 },
        alpha: { start: 0.5, end: 0 },
        lifespan: 400,
        blendMode: 'ADD',
        emitting: false
      });

      boostParticles = this.add.particles(0, 0, 'particle', {
        speed: { min: 100, max: 200 },
        scale: { start: 1.5, end: 0 },
        alpha: { start: 0.8, end: 0 },
        lifespan: 600,
        blendMode: 'ADD',
        emitting: false,
        tint: 0x00ffff
      });

      trackGraphics = this.add.graphics();
      walls = this.physics.add.staticGroup();
      trackGraphics.lineStyle(100, 0x1a365d);

      trackPath = new Phaser.Curves.Path(400, 100);
      trackPath.lineTo(650, 100);
      trackPath.lineTo(650, 500);
      trackPath.lineTo(150, 500);
      trackPath.lineTo(150, 100);
      trackPath.lineTo(400, 100);
      trackPath.draw(trackGraphics);

      boostPads = this.physics.add.staticGroup();
      const padPositions = [
        { x: 550, y: 100 }, { x: 650, y: 250 }, { x: 650, y: 400 },
        { x: 250, y: 500 }, { x: 150, y: 350 }, { x: 150, y: 200 }
      ];

      padPositions.forEach(pos => {
        const pad = this.add.sprite(pos.x, pos.y, 'boost-pad');
        pad.setScale(2);
        this.physics.add.existing(pad, true);
        boostPads.add(pad);
      });

      this.physics.add.overlap(playersGroup, boostPads, (player: any, pad: any) => {
        if (!player.isBoosting) {
          player.isBoosting = true;
          if (player.id === participantId) {
            this.cameras.main.shake(300, 0.01);
          }
          const rotation = player.rotation;
          player.boatBody.velocity.x += Math.cos(rotation) * 400;
          player.boatBody.velocity.y += Math.sin(rotation) * 400;
          player.first.setTint(0x00ffff);
          this.time.delayedCall(1500, () => {
            player.isBoosting = false;
            player.first.clearTint();
            player.first.setTint(player.originalColor || 0xffffff);
          });
        }
      });

      walls.add(this.add.rectangle(400, 5, 800, 10, 0x444444));
      walls.add(this.add.rectangle(400, 595, 800, 10, 0x444444));
      walls.add(this.add.rectangle(5, 300, 10, 600, 0x444444));
      walls.add(this.add.rectangle(795, 300, 10, 600, 0x444444));

      const island = this.add.rectangle(400, 300, 350, 200, 0x2d3748);
      this.physics.add.existing(island, true);
      walls.add(island);

      const corners = [{ x: 100, y: 100 }, { x: 700, y: 100 }, { x: 700, y: 500 }, { x: 100, y: 500 }];
      corners.forEach(c => {
        const rock = this.add.circle(c.x, c.y, 30, 0x4a5568);
        this.physics.add.existing(rock, true);
        walls.add(rock);
      });

      this.physics.add.collider(playersGroup, walls, (boat: any, wall: any) => {
        if (boat.boatBody.velocity.length() > 150) {
           if (boat.id === participantId) this.cameras.main.shake(100, 0.005);
           wakeParticles.emitParticleAt(boat.x, boat.y, 10);
        }
      });

      trackGraphics.lineStyle(8, 0xffffff);
      trackGraphics.lineBetween(400, 5, 400, 200);

      lapText = this.add.text(20, 20, 'LAP 1/3', { fontSize: '24px', fontStyle: 'bold', color: '#ffffff', stroke: '#000000', strokeThickness: 4 });
      speedText = this.add.text(20, 50, '0 MPH', { fontSize: '20px', fontStyle: 'italic', color: '#fbbf24', stroke: '#000000', strokeThickness: 3 });
      leaderboardText = this.add.text(650, 20, '', { fontSize: '14px', color: '#ffffff', align: 'right', backgroundColor: 'rgba(0,0,0,0.3)', padding: { x: 10, y: 5 } });
      leaderboardText.setOrigin(1, 0);

      socketRef.current?.on('game:start', (payload: { countdown?: number, state?: any }) => {
        if (payload.state) {
           currentGameState = payload.state;
           setGameState(payload.state);
        }
        if (payload.countdown !== undefined) setCountdown(payload.countdown);
      });

      if (isHost) {
        socketRef.current?.on('game:input', (payload: { participantId: string, input: any }) => {
          guestInputs.set(payload.participantId, payload.input);
          if (!players.has(payload.participantId)) {
             players.set(payload.participantId, createPlayer(this, payload.participantId, 400, 80, 0x00ff00));
          }
        });
      } else {
        socketRef.current?.on('game:state', (state: { players: PlayerState[] }) => {
          state.players.forEach((p) => {
            let player = players.get(p.id);
            if (!player) {
              player = createPlayer(this, p.id, p.x, p.y, 0x00ff00);
              players.set(p.id, player);
            }
            if (p.id === participantId) {
               const dist = Phaser.Math.Distance.Between(player.x, player.y, p.x, p.y);
               if (dist > 50) { player.x = p.x; player.y = p.y; player.boatBody.setVelocity(p.velocity.x, p.velocity.y); }
               if (player.isBoosting !== p.isBoosting) {
                 player.isBoosting = p.isBoosting;
                 if (player.isBoosting) player.first.setTint(0x00ffff);
                 else { player.first.clearTint(); player.first.setTint(player.originalColor || 0xffffff); }
               }
            } else {
              player.targetX = p.x; player.targetY = p.y; player.targetRotation = p.rotation; player.isBoosting = p.isBoosting;
            }
          });
          const ids = state.players.map(p => p.id);
          players.forEach((_, id) => { if (!ids.includes(id)) { players.get(id)?.destroy(); players.delete(id); } });
        });
      }

      players.set(participantId, createPlayer(this, participantId, 400, 80, 0x4a6cff));
    }

    function createPlayer(scene: Phaser.Scene, id: string, x: number, y: number, color: number) {
      const container = scene.add.container(x, y) as any;
      const boat = scene.add.sprite(0, 0, 'boat');
      boat.setTint(color);
      container.add(boat);
      container.originalColor = color;
      container.id = id;
      const label = scene.add.text(0, -35, id.substring(0, 5), { fontSize: '10px', color: '#ffffff' });
      label.setOrigin(0.5);
      container.add(label);
      scene.physics.world.enable(container);
      const body = container.body as Phaser.Physics.Arcade.Body;
      body.setCollideWorldBounds(true);
      body.setBounce(0.5, 0.5);
      container.boatBody = body;
      playersGroup.add(container);
      container.isBoosting = false;
      container.lap = 1;
      container.checkpoint = 0;
      return container;
    }

    function applyPhysics(player: any, input: any) {
      if (currentGameState === 'RACING') {
        handleInput(player.boatBody, input, player.isBoosting);
      } else {
        player.boatBody.setAcceleration(0);
        player.boatBody.setAngularVelocity(0);
      }
      let currentDrag = DRAG;
      const p = new Phaser.Math.Vector2(player.x, player.y);
      const out = new Phaser.Math.Vector2();
      trackPath.getClosestPoint(p, out);
      if (Phaser.Math.Distance.Between(player.x, player.y, out.x, out.y) > 50) currentDrag = 0.85;
      player.boatBody.velocity.x *= currentDrag;
      player.boatBody.velocity.y *= currentDrag;
      player.boatBody.angularVelocity *= 0.9;
    }

    function update(this: Phaser.Scene) {
      const currentGameState = gameStateRef.current;

      if (currentGameState === 'FINISHED') {
        wakeParticles.stop(); boostParticles.stop(); return;
      }
      players.forEach((player) => {
        if (player.boatBody.velocity.length() > 20) {
          const angle = player.boatBody.rotation + 180;
          const rad = angle * (Math.PI / 180);
          const px = player.x + Math.cos(rad) * 20;
          const py = player.y + Math.sin(rad) * 20;
          if (player.isBoosting) boostParticles.emitParticleAt(px, py, 2);
          else wakeParticles.emitParticleAt(px, py, 1);
        }
      });

      if (isHost) {
        const checkpoints = [{ x: 400, y: 100 }, { x: 650, y: 300 }, { x: 400, y: 500 }, { x: 150, y: 300 }];
        players.forEach((player, id) => {
          const input = (id === participantId)
            ? { up: cursors.up.isDown, left: cursors.left.isDown, right: cursors.right.isDown }
            : (guestInputs.get(id) || { up: false, left: false, right: false });
          applyPhysics(player, input);
          const nextCpIdx = (player.checkpoint + 1) % checkpoints.length;
          if (Phaser.Math.Distance.Between(player.x, player.y, checkpoints[nextCpIdx].x, checkpoints[nextCpIdx].y) < 100) {
            player.checkpoint = nextCpIdx;
            if (nextCpIdx === 0) {
              player.lap++;
              if (player.lap > 3) {
                setGameState('FINISHED');
                socketRef.current?.emit('game:start', { partyId, state: 'FINISHED' });
              }
            }
          }
        });
        socketRef.current?.emit('game:state', { partyId, state: {
          players: Array.from(players.entries()).map(([id, p]) => ({
            id, x: p.x, y: p.y, rotation: p.rotation, velocity: { x: p.boatBody.velocity.x, y: p.boatBody.velocity.y },
            isBoosting: p.isBoosting, lap: p.lap, checkpoint: p.checkpoint
          }))
        }});
      } else {
        const input = { up: cursors.up.isDown, left: cursors.left.isDown, right: cursors.right.isDown };
        socketRef.current?.emit('game:input', { partyId, participantId, input });
        players.forEach((player, id) => {
          if (id === participantId) applyPhysics(player, input);
          else if (player.targetX !== undefined) {
            player.x = Phaser.Math.Linear(player.x, player.targetX, 0.2);
            player.y = Phaser.Math.Linear(player.y, player.targetY, 0.2);
            let diff = (player.targetRotation || 0) - player.rotation;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            player.rotation += diff * 0.2;
            if (player.isBoosting) player.first.setTint(0x00ffff);
            else { player.first.clearTint(); player.first.setTint(player.originalColor || 0xffffff); }
          }
        });
      }

      const self = players.get(participantId);
      if (self) {
        lapText.setText(`LAP ${Math.min(self.lap, 3)}/3`);
        const speed = Math.floor(self.boatBody.velocity.length() / 5);
        speedText.setText(`${speed} MPH`);
        speedText.setColor(self.isBoosting ? '#00ffff' : '#fbbf24');
        const sorted = Array.from(players.entries()).sort((a, b) => a[1].lap !== b[1].lap ? b[1].lap - a[1].lap : b[1].checkpoint - a[1].checkpoint);
        let lb = 'LEADERBOARD\n';
        sorted.forEach((p, i) => lb += `${i+1}. ${p[0].substring(0, 8)} - L${Math.min(p[1].lap, 3)} CP${p[1].checkpoint}\n`);
        leaderboardText.setText(lb);
      }
    }

    function handleInput(body: Phaser.Physics.Arcade.Body, input: any, isBoosting: boolean) {
      if (input.left) body.setAngularVelocity(-ANGULAR_VEL);
      else if (input.right) body.setAngularVelocity(ANGULAR_VEL);
      else body.setAngularVelocity(0);
      if (input.up) {
        const rotation = body.rotation * (Math.PI / 180);
        const accel = isBoosting ? BOOST_ACCEL : ACCEL;
        body.setAccelerationX(Math.cos(rotation) * accel);
        body.setAccelerationY(Math.sin(rotation) * accel);
      } else body.setAcceleration(0);
    }

    return () => {
      game.destroy(true);
      socketRef.current?.off('game:state');
      socketRef.current?.off('game:input');
      socketRef.current?.off('game:start');
    };
  }, [partyId, isHost, participantId, setGameState, setCountdown]);

  return <div ref={containerRef} />;
};
