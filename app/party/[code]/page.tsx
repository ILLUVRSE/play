'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
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
  contentType: 'youtube' | 'mp3';
  contentUrl: string;
  maxSeats: number;
  participants: Participant[];
  status: string;
};

export default function PartyRoomPage() {
  const params = useParams();
  const code = String(params?.code || '').toUpperCase();
  const router = useRouter();
  const [party, setParty] = useState<Party | null>(null);
  const [error, setError] = useState('');
  const [seatId, setSeatId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const participantId = typeof window !== 'undefined' ? localStorage.getItem(`party-${code}-participant`) || '' : '';
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const name = localStorage.getItem(`party-${code}-name`) || '';
    const seat = localStorage.getItem(`party-${code}-seat`) || '';
    setDisplayName(name);
    setSeatId(seat);
    if (!name || !seat) {
      router.replace(`/party/${code}/seat`);
      return;
    }
    fetch(`/api/parties/${code}`)
      .then(async (res) => {
        if (!res.ok) {
          setError('Party not found.');
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) setParty(data);
      })
      .catch(() => setError('Party not found.'));
  }, [code, router]);

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

  if (error) {
    return (
      <div>
        <Header />
        <main className="max-w-4xl mx-auto px-6 py-12 space-y-3">
          <h1 className="text-3xl font-bold">Party not found</h1>
          <p className="text-white/70">{error}</p>
          <Link href="/join" className="button-primary shadow-gold">Join another party</Link>
        </main>
      </div>
    );
  }

  if (!party) {
    return (
      <div>
        <Header />
        <main className="max-w-5xl mx-auto px-6 py-12">Loading party...</main>
      </div>
    );
  }

  if (party.status === 'ended') {
    return (
      <div>
        <Header />
        <main className="max-w-4xl mx-auto px-6 py-12 space-y-3">
          <h1 className="text-3xl font-bold">Party ended</h1>
          <p className="text-white/70">This room is read-only now.</p>
        </main>
      </div>
    );
  }

  return (
    <div>
      <Header />
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="pill inline-block">Party • {party.code}</p>
            <h1 className="text-3xl font-bold">{party.title}</h1>
            <p className="text-white/70 text-sm">You are {seatId} • {displayName}</p>
          </div>
          <div className="glass px-4 py-3 border-brand-primary/30 text-sm text-white/80 max-w-md">
            <div className="font-semibold text-white">How this works</div>
            <p className="text-white/60 text-sm">Host controls playback. Guests follow along, chat, and react.</p>
          </div>
        </div>

        <PresenceBar maxSeats={party.maxSeats} participants={party.participants} seatId={seatId} />

        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-4 items-start">
          <div className="space-y-4">
            <PartyPlayer
              code={party.code}
              contentType={party.contentType}
              contentUrl={party.contentUrl}
              isHost={false}
            />
            <div className="glass p-4 border-brand-primary/30 text-sm text-white/80 space-y-2">
              <div className="font-semibold text-white">Guest powers</div>
              <div className="text-white/60 text-sm">Chat and reactions. Playback is synced to the host.</div>
              <div className="text-white/60 text-sm">No play/pause controls.</div>
            </div>
            <ReactionBar code={party.code} seatId={seatId} displayName={displayName} />
          </div>
          <div className="h-full min-h-[480px]">
            <ChatPanel
              code={party.code}
              seatId={seatId}
              displayName={displayName}
              participantId={participantId}
              isHost={false}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
