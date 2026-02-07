/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useEffect, useRef } from 'react';
import { ensureSocket } from '@/lib/socketClient';
import type { Socket } from 'socket.io-client';

type Props = {
  code: string;
  seatId: string;
  displayName: string;
};

const emojis = ['👏', '😂', '😭', '😱', '🤢', '🔥'];

export function ReactionBar({ code, seatId, displayName }: Props) {
  const socketRef = useRef<Socket | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    socketRef.current = ensureSocket(socketRef);
    const handler = (payload: { emoji: string }) => {
      const bubble = document.createElement('div');
      bubble.textContent = payload.emoji;
      bubble.className = 'absolute text-2xl animate-pulse';
      bubble.style.left = `${Math.random() * 80 + 10}%`;
      bubble.style.bottom = '0';
      containerRef.current?.appendChild(bubble);
      setTimeout(() => bubble.remove(), 1200);
    };
    socketRef.current.on('reaction:send', handler);
    return () => {
      if (!socketRef.current) return;
      socketRef.current.off('reaction:send', handler);
    };
  }, [code]);

  const send = (emoji: string) => {
    socketRef.current?.emit('reaction:send', { code, seatId, displayName, emoji });
  };

  return (
    <div className="relative">
      <div ref={containerRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
      <div className="flex flex-wrap gap-2">
        {emojis.map((emoji) => (
          <button
            key={emoji}
            onClick={() => send(emoji)}
            title={`Send ${emoji} reaction`}
            aria-label={`Send ${emoji} reaction`}
            className="rounded-full bg-white/10 px-3 py-2 text-lg hover:bg-white/20 border border-white/10"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
