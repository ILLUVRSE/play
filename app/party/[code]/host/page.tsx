'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { PartyPlayer } from '@/components/PartyPlayer';
import { ChatPanel } from '@/components/ChatPanel';
import { ReactionBar } from '@/components/ReactionBar';
import { PresenceBar } from '@/components/PresenceBar';
import { ensureSocket } from '@/lib/socketClient';
import type { Socket } from 'socket.io-client';

type Participant = { seatId: string; displayName: string; isHost: boolean };
type Party = {
  code: string;
  title: string;
  contentType: 'youtube' | 'mp3' | 'mp4';
  contentUrl: string;
  maxSeats: number;
  participants: Participant[];
  status: string;
};

export default function HostPartyView() {
  const params = useParams();
  const code = String(params?.code || '').toUpperCase();
  const router = useRouter();
  const [party, setParty] = useState<Party | null>(null);
  const [copied, setCopied] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const seatId = 'A-1';
  const displayName = 'Host';
  const participantId = typeof window !== 'undefined' ? localStorage.getItem(`party-${code}-participant`) || '' : '';

  useEffect(() => {
    fetch(`/api/parties/${code}`)
      .then((res) => res.json())
      .then((data) => setParty(data))
      .catch(() => {});
  }, [code]);

  useEffect(() => {
    socketRef.current = ensureSocket(socketRef);
    const seatHandler = (payload: { seatId: string; displayName: string }) => {
      setParty((prev) =>
        prev
          ? {
              ...prev,
              participants: [...prev.participants, { seatId: payload.seatId, displayName: payload.displayName, isHost: false }]
            }
          : prev
      );
    };
    socketRef.current.on('seat:update', seatHandler);
    socketRef.current.emit('party:join', { code, participantId });
    return () => {
      if (!socketRef.current) return;
      socketRef.current.off('seat:update', seatHandler);
      socketRef.current.emit('party:leave', { code, participantId });
    };
  }, [code, participantId]);

  const endParty = async () => {
    await fetch(`/api/parties/${code}/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId })
    });
    router.refresh();
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  if (!party) {
    return (
      <div>
        <Header />
        <main className="max-w-5xl mx-auto px-6 py-12">Loading party...</main>
      </div>
    );
  }

  return (
    <div>
      <Header />
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="pill inline-block">Host View</p>
            <h1 className="text-3xl font-bold">{party.title}</h1>
            <p className="text-white/70 text-sm">You control playback. Guests sync to you.</p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <button
              className={`button-primary font-mono shadow-gold ${copied ? 'animate-pulse' : ''}`}
              onClick={copyCode}
            >
              {copied ? 'Copied!' : `Share code: ${party.code}`}
            </button>
            <button className="button-ghost" onClick={() => router.push(`/party/${code}`)}>View as guest</button>
            <button className="button-ghost border-red-400/50 text-red-200 ml-4" onClick={endParty}>
              End party
            </button>
          </div>
        </div>

        <div className="glass px-4 py-3 border-brand-primary/30 text-sm text-white/80 max-w-3xl">
          <div className="font-semibold text-white">How this works</div>
          <p className="text-white/60 text-sm">Press Play to start. Guests follow your playback, chat, and react.</p>
        </div>

        <PresenceBar maxSeats={party.maxSeats} participants={party.participants} seatId={seatId} />

        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-4 items-start">
          <div className="space-y-4">
            <PartyPlayer
              code={party.code}
              contentType={party.contentType}
              contentUrl={party.contentUrl}
              isHost
            />
            <div className="glass p-4 border-brand-primary/30 text-sm text-white/80 space-y-2">
              <div className="font-semibold text-white">Host powers</div>
              <div className="text-white/60 text-sm">Play/Pause, force sync, and end the party.</div>
              <div className="text-white/60 text-sm">Guests cannot control playback.</div>
            </div>
            <ReactionBar code={party.code} seatId={seatId} displayName={displayName} />
          </div>
          <div className="h-full min-h-[480px]">
            <ChatPanel
              code={party.code}
              seatId={seatId}
              displayName={displayName}
              participantId={participantId}
              isHost
            />
          </div>
        </div>
      </main>
    </div>
  );
}
