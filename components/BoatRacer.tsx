'use client';

import React, { useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { ensureSocket } from '@/lib/socketClient';

// Dynamically import PhaserRacer with no SSR to avoid window is not defined errors
const PhaserRacer = dynamic(() => import('./PhaserRacer').then(mod => mod.PhaserRacer), {
  ssr: false,
  loading: () => <div className="w-[800px] h-[600px] bg-blue-900 flex items-center justify-center text-white font-bold italic animate-pulse">LOADING ENGINE...</div>
});

interface BoatRacerProps {
  partyId: string;
  isHost: boolean;
  participantId: string;
}

type GameState = 'LOBBY' | 'COUNTDOWN' | 'RACING' | 'FINISHED';

export const BoatRacer: React.FC<BoatRacerProps> = ({ partyId, isHost, participantId }) => {
  const [gameState, setGameState] = useState<GameState>('LOBBY');
  const [countdown, setCountdown] = useState<number | null>(null);
  const socketRef = useRef<any>(null);

  const handleStartRace = () => {
    if (!isHost) return;

    socketRef.current = ensureSocket(socketRef);

    let count = 3;
    socketRef.current?.emit('game:start', { partyId, countdown: count, state: 'COUNTDOWN' });

    const timer = setInterval(() => {
      count--;
      if (count === 0) {
        clearInterval(timer);
        socketRef.current?.emit('game:start', { partyId, countdown: 0, state: 'RACING' });
      } else {
        socketRef.current?.emit('game:start', { partyId, countdown: count, state: 'COUNTDOWN' });
      }
    }, 1000);
  };

  return (
    <div className="w-full h-full relative flex flex-col items-center justify-center bg-blue-900 rounded-xl overflow-hidden shadow-2xl border-4 border-blue-400/30">
      <PhaserRacer
        partyId={partyId}
        isHost={isHost}
        participantId={participantId}
        gameState={gameState}
        setGameState={setGameState}
        setCountdown={setCountdown}
      />

      {/* Overlay UI */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
        <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-white text-[10px] font-bold tracking-widest border border-white/20">
          {isHost ? 'HOST AUTHORITY' : 'PLAYER'}
        </div>
        <div className="bg-blue-600/80 px-3 py-1 rounded-full text-white text-[10px] font-bold border border-blue-300/40">
          STATE: {gameState}
        </div>
      </div>

      {gameState === 'LOBBY' && isHost && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[2px]">
          <button
            onClick={handleStartRace}
            className="group relative px-8 py-4 bg-gradient-to-br from-yellow-400 to-orange-600 rounded-2xl text-white font-black text-2xl italic tracking-tighter shadow-[0_0_30px_rgba(251,191,36,0.5)] hover:scale-105 active:scale-95 transition-all"
          >
            <span className="relative z-10">START RACE!</span>
            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 rounded-2xl transition-opacity" />
          </button>
        </div>
      )}

      {gameState === 'COUNTDOWN' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-9xl font-black text-white italic animate-ping drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]">
            {countdown}
          </div>
        </div>
      )}

      {gameState === 'FINISHED' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md">
          <div className="text-7xl font-black text-white italic drop-shadow-[0_0_20px_rgba(255,255,255,0.5)] animate-bounce">
            FINISH!
          </div>
          <div className="mt-4 text-blue-300 font-bold tracking-widest uppercase">
            Race Complete
          </div>
          {isHost && (
            <button
              onClick={() => {
                setGameState('LOBBY');
                socketRef.current = ensureSocket(socketRef);
                socketRef.current?.emit('game:start', { partyId, state: 'LOBBY' });
              }}
              className="mt-8 px-6 py-2 bg-blue-500 hover:bg-blue-600 rounded-full text-white font-bold transition-all"
            >
              BACK TO LOBBY
            </button>
          )}
        </div>
      )}

      {gameState === 'RACING' && countdown === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-fadeOut">
          <div className="text-9xl font-black text-yellow-400 italic drop-shadow-[0_0_30px_rgba(251,191,36,0.8)]">
            GO!
          </div>
        </div>
      )}

      <div className="absolute bottom-4 left-4 text-white/50 text-[10px] font-mono">
        {participantId}
      </div>
    </div>
  );
};
