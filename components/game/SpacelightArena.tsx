"use client";

import React, { useEffect, useRef, useState } from 'react';
import { ensureSocket } from '@/lib/socketClient';
import { Socket } from 'socket.io-client';
import { SpacelightRenderer } from '@/lib/game/SpacelightRenderer';

interface SpacelightArenaProps {
  code: string;
  displayName: string;
  isCoop?: boolean;
}

export const SpacelightArena: React.FC<SpacelightArenaProps> = ({ code, displayName, isCoop = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const rendererRef = useRef<SpacelightRenderer | null>(null);
  const [gameState, setGameState] = useState<any>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const inputRef = useRef({ x: 400, y: 550, shooting: false });

  useEffect(() => {
    const socket = ensureSocket(socketRef);

    socket.emit('game:join', { code, displayName, isCoop });

    socket.on('game:joined', (data: { playerId: string }) => {
      setPlayerId(data.playerId);
    });

    socket.on('game:state', (state: any) => {
      setGameState(state);
    });

    return () => {
      socket.off('game:joined');
      socket.off('game:state');
    };
  }, [code, displayName, isCoop]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    rendererRef.current = new SpacelightRenderer(ctx, 800, 600);

    let animationFrame: number;
    const render = () => {
      if (gameState && rendererRef.current) {
        rendererRef.current.render(gameState, playerId);
      }
      animationFrame = requestAnimationFrame(render);
    };
    render();

    return () => cancelAnimationFrame(animationFrame);
  }, [gameState, playerId]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        inputRef.current.x = ((e.clientX - rect.left) / rect.width) * 800;
        inputRef.current.y = ((e.clientY - rect.top) / rect.height) * 600;
    };

    const handleTouchMove = (e: TouchEvent) => {
        if (!canvasRef.current || e.touches.length === 0) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const touch = e.touches[0];
        inputRef.current.x = ((touch.clientX - rect.left) / rect.width) * 800;
        inputRef.current.y = ((touch.clientY - rect.top) / rect.height) * 600;
        inputRef.current.shooting = true; // Auto-fire on touch
    };

    const handleMouseDown = () => { inputRef.current.shooting = true; };
    const handleMouseUp = () => { inputRef.current.shooting = false; };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchstart', handleMouseDown);
    window.addEventListener('touchend', handleMouseUp);

    const inputInterval = setInterval(() => {
        if (socketRef.current) {
            socketRef.current.emit('game:input', { code, input: inputRef.current });
        }
    }, 1000 / 30); // 30Hz input sending

    return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mousedown', handleMouseDown);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchstart', handleMouseDown);
        window.removeEventListener('touchend', handleMouseUp);
        clearInterval(inputInterval);
    };
  }, [code]);

  return (
    <div className="flex flex-col items-center justify-center bg-black p-4 rounded-xl border-2 border-cyan-500 shadow-[0_0_20px_rgba(0,255,255,0.3)]">
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="max-w-full h-auto cursor-none touch-none"
      />
      <div className="mt-4 text-cyan-400 font-mono text-sm uppercase tracking-widest animate-pulse">
        Move to steer • Hold click to fire • Collect Powerups
      </div>
    </div>
  );
};
