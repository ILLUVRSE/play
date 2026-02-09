'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { SeatGrid } from '@/components/SeatGrid';
import { ensureSocket } from '@/lib/socketClient';
import type { Socket } from 'socket.io-client';

type Party = {
  code: string;
  title: string;
  maxSeats: number;
  seatMap: { seats: string[] };
  participants: { id: string; seatId: string; displayName: string }[];
  status: string;
  seatLocked: boolean;
};

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  if (parts.length === 0) return '??';
  return parts.map((p) => p[0]?.toUpperCase() || '').join('');
}

export default function SeatSelectionPage() {
  const params = useParams();
  const code = String(params?.code || '').toUpperCase();
  const router = useRouter();
  const [party, setParty] = useState<Party | null>(null);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [seatLocked, setSeatLocked] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const displayName =
    (typeof window !== 'undefined' && localStorage.getItem(`party-${code}-name`)) || '';

  useEffect(() => {
    fetch(`/api/parties/${code}`)
      .then(async (res) => {
        if (!res.ok) {
          setError('Party not found.');
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setParty(data);
          setSeatLocked(Boolean(data.seatLocked));
        }
      })
      .catch(() => setError('Party not found.'));
  }, [code]);

  useEffect(() => {
    socketRef.current = ensureSocket(socketRef);
    const seatHandler = (payload: { participantId: string; seatId: string; displayName: string }) => {
      setParty((prev) =>
        prev
          ? {
              ...prev,
              participants: [
                ...prev.participants.filter((p) => p.id !== payload.participantId),
                { id: payload.participantId, seatId: payload.seatId, displayName: payload.displayName }
              ]
            }
          : prev
      );
    };
    const seatLockHandler = (payload: { locked?: boolean }) => {
      setSeatLocked(Boolean(payload?.locked));
    };
    socketRef.current.on('seat:update', seatHandler);
    socketRef.current.on('seat:lock', seatLockHandler);
    socketRef.current.emit('party:join', { code });
    return () => {
      if (!socketRef.current) return;
      socketRef.current.off('seat:update', seatHandler);
      socketRef.current.off('seat:lock', seatLockHandler);
      socketRef.current.emit('party:leave', { code });
    };
  }, [code]);

  if (error) {
    return (
      <div>
        <header className="sticky top-0 z-20 bg-black/50 backdrop-blur-lg border-b border-white/10">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 font-bold tracking-[0.22em] uppercase text-sm text-white">
              <span className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-primary to-brand-primaryLight text-brand-bg grid place-items-center font-mono shadow-glow">
                IV
              </span>
              <span>Illuvrse</span>
            </Link>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-6 py-12 space-y-3">
          <h1 className="text-3xl font-bold">Party not found</h1>
          <p className="text-white/70">{error}</p>
          <Link href="/join" className="button-primary shadow-gold">Try another code</Link>
        </main>
      </div>
    );
  }

  const reserveSeat = async () => {
    if (!displayName) {
      setError('Missing display name. Go back to Join.');
      return;
    }
    if (seatLocked) {
      setError('Seats are locked. Ask the host to unlock.');
      return;
    }
    if (!selected) {
      setError('Pick a seat to continue.');
      return;
    }
    const res = await fetch(`/api/parties/${code}/seat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seatId: selected, displayName })
    });
    if (res.status === 409) {
      setError('Seat already taken. Pick another.');
      return;
    }
    if (!res.ok) {
      setError('Unable to reserve seat.');
      return;
    }
    const data = await res.json();
    localStorage.setItem(`party-${code}-participant`, data.participantId);
    localStorage.setItem(`party-${code}-seat`, data.seatId);
    socketRef.current?.emit('seat:reserve', { code, seatId: data.seatId, participantId: data.participantId });
    router.push(`/party/${code}`);
  };

  if (!party) {
    return (
      <div>
        <header className="sticky top-0 z-20 bg-black/50 backdrop-blur-lg border-b border-white/10">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 font-bold tracking-[0.22em] uppercase text-sm text-white">
              <span className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-primary to-brand-primaryLight text-brand-bg grid place-items-center font-mono shadow-glow">
                IV
              </span>
              <span>Illuvrse</span>
            </Link>
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-6 py-12">Loading party...</main>
      </div>
    );
  }

  const taken = new Set(party.participants.map((p) => p.seatId));
  const occupied = party.participants.reduce<Record<string, { displayName: string; initials: string }>>(
    (acc, p) => {
      acc[p.seatId] = { displayName: p.displayName, initials: initialsFor(p.displayName) };
      return acc;
    },
    {}
  );

  return (
    <div>
      <header className="sticky top-0 z-20 bg-black/50 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <Link href="/" className="flex items-center gap-3 font-bold tracking-[0.22em] uppercase text-sm text-white">
            <span className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-primary to-brand-primaryLight text-brand-bg grid place-items-center font-mono shadow-glow">
              IV
            </span>
            <span>Illuvrse</span>
          </Link>
          <div className="text-sm text-white/70">
            <span className="text-white font-semibold">{party.title}</span> • {party.participants.length}/{party.maxSeats} in room
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-6">
        <div className="grid lg:grid-cols-[1.6fr_1fr] gap-6 items-start">
          <section className="space-y-4">
            <div className="space-y-2">
              <p className="pill inline-block">Pick your seat</p>
              <h1 className="text-3xl font-bold">Choose a seat to join</h1>
              <p className="text-white/70">You’ll appear as A-3 in voice and reactions. Your seat is your identity.</p>
            </div>
            <div className="glass p-6 border-brand-primary/30 orbital">
              <div className="flex items-center justify-between text-sm text-white/70">
                <span>Seat map</span>
                <span className="text-white/60">Occupied seats show initials</span>
              </div>
              <SeatGrid
                seats={party.seatMap.seats}
                taken={taken}
                occupied={occupied}
                selected={selected}
                onSelect={setSelected}
              />
            </div>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="text-white/70 text-sm">
                {selected ? (
                  <span className="text-brand-glow font-semibold">You are {selected.replace('-', ' · ')}</span>
                ) : (
                  <span>Pick any open seat to continue.</span>
                )}
              </div>
              <button
                className={`button-primary shadow-gold text-base px-6 py-4 ${selected && !seatLocked ? 'animate-pulse' : 'opacity-60 cursor-not-allowed'}`}
                onClick={reserveSeat}
                disabled={!selected || seatLocked}
                aria-disabled={!selected || seatLocked}
              >
                Join the party
              </button>
            </div>
            {error && <p className="text-red-300 text-sm">{error}</p>}
          </section>

          <aside className="space-y-4">
            <div className="glass p-4 border-brand-primary/30 space-y-3">
              <div className="font-semibold text-white">Who’s here</div>
              {party.participants.length === 0 ? (
                <div className="text-white/60 text-sm">No one yet. Be the first to claim a seat.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {party.participants.map((p) => (
                    <div key={p.seatId} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs">
                      <span className="font-mono text-white/80">{p.seatId}</span> • {p.displayName}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="glass p-4 border-brand-primary/30 text-sm text-white/80 space-y-2">
              <div className="font-semibold text-white">Quick tips</div>
              <div className="text-white/60 text-sm">Seats are first-come, first-served.</div>
              <div className="text-white/60 text-sm">Your seat label appears on your video tile.</div>
              {seatLocked ? <div className="text-red-200 text-sm">Seats are locked by the host.</div> : null}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
