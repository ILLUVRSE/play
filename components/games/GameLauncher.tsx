'use client';

import { useState } from 'react';
import { ensureSocket } from '@/lib/socketClient';
import type { MutableRefObject } from 'react';
import type { Socket } from 'socket.io-client';

const games = [
  { slug: 'forehead-poker', name: 'Forehead Poker' },
  { slug: 'caption-battle', name: 'Caption Battle' },
  { slug: 'pictionary', name: 'Pictionary' }
];

export function GameLauncher({ code, isHost, socketRef }: { code: string; isHost: boolean; socketRef: MutableRefObject<Socket | null> }) {
  const [slug, setSlug] = useState(games[0].slug);
  const [status, setStatus] = useState('');

  const createGame = () => {
    const socket = ensureSocket(socketRef);
    socket.emit('game:create', { partyCode: code, gameSlug: slug });
    setStatus('Game create request sent.');
  };

  return (
    <div className="glass p-4 border-brand-primary/30 space-y-2">
      <div className="font-semibold">Party Games</div>
      <select className="bg-black/30 border border-white/20 rounded px-2 py-1" value={slug} onChange={(e) => setSlug(e.target.value)}>
        {games.map((g) => (
          <option key={g.slug} value={g.slug}>{g.name}</option>
        ))}
      </select>
      <button disabled={!isHost} onClick={createGame} className="button-primary disabled:opacity-50">Create game</button>
      {status ? <div className="text-xs text-white/60">{status}</div> : null}
    </div>
  );
}
