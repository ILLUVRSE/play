/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useEffect, useRef, useState } from 'react';
import { ensureSocket } from '@/lib/socketClient';
import type { Socket } from 'socket.io-client';

type Message = {
  id?: string;
  text: string;
  seatId: string;
  displayName: string;
  createdAt: string;
  system?: boolean;
};

type Props = {
  code: string;
  seatId: string;
  displayName: string;
  participantId?: string;
  isHost?: boolean;
};

export function ChatPanel({ code, seatId, displayName, participantId, isHost }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const lastSent = useRef<number>(0);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    socketRef.current = ensureSocket(socketRef);
    fetch(`/api/parties/${code}/messages`)
      .then((res) => res.json())
      .then((data) => {
        const next = data || [];
        if (next.length === 0) {
          setMessages([
            {
              id: 'system-start',
              text: isHost ? 'Waiting for viewers…' : 'Party started. Say hello!',
              seatId: '—',
              displayName: 'System',
              createdAt: new Date().toISOString(),
              system: true
            }
          ]);
          return;
        }
        setMessages(next);
      })
      .catch(() => {});

    const handler = (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
    };

    socketRef.current.on('chat:message', handler);
    return () => {
      if (socketRef.current) {
        socketRef.current.off('chat:message', handler);
      }
    };
  }, [code]);

  const sendMessage = () => {
    const now = Date.now();
    if (now - lastSent.current < 1000) return;
    const text = input.trim().slice(0, 200);
    if (!text) return;
    lastSent.current = now;
    setInput('');
    socketRef.current?.emit('chat:message', {
      code,
      text,
      seatId,
      displayName,
      participantId
    });
  };

  return (
    <div className="glass w-full h-full flex flex-col border-white/10">
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="text-sm font-semibold">Chat</div>
        <div className="pill text-xs">{displayName} • {seatId}</div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, idx) => (
          <div key={msg.id ?? idx} className={`text-sm leading-5 ${msg.system ? 'text-white/70' : ''}`}>
            <div className="text-xs text-white/60 font-mono">{msg.seatId} • {msg.displayName}</div>
            <div className="text-white">{msg.text}</div>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 p-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Say something to the room..."
          className="flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2 outline-none"
        />
        <button onClick={sendMessage} className="button-primary">Send</button>
      </div>
    </div>
  );
}
