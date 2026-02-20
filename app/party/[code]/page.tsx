'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { PartyPlayer } from '@/components/PartyPlayer';
import { ReactionBar } from '@/components/ReactionBar';
import { PresenceBar } from '@/components/PresenceBar';
import { VoiceGrid } from '@/components/VoiceGrid';
import { ensureSocket } from '@/lib/socketClient';
import type { Socket } from 'socket.io-client';

type Participant = { id: string; seatId: string; displayName: string; isHost: boolean; muted: boolean };
type Party = {
  id: string;
  code: string;
  title: string;
  contentType: 'youtube' | 'mp3' | 'mp4' | 'game';
  contentUrl: string;
  maxSeats: number;
  participants: Participant[];
  status: string;
  seatMap: { rows: number; cols: number; seats: string[] };
  playlist: { id: string; orderIndex: number; contentType: 'youtube' | 'mp3' | 'mp4' | 'game'; contentUrl: string; title?: string | null }[];
  currentIndex: number;
  micLocked: boolean;
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
  const [micLocked, setMicLocked] = useState(false);
  const [playlist, setPlaylist] = useState<Party['playlist']>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const me = party?.participants.find((p) => p.id === participantId);
  const isHost = me?.isHost || false;

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
        if (data) {
          setParty(data);
          setMicLocked(Boolean(data.micLocked));
          const basePlaylist = Array.isArray(data.playlist) ? data.playlist : [];
          setPlaylist(
            basePlaylist.length
              ? basePlaylist
              : [
                  {
                    id: 'fallback',
                    orderIndex: 0,
                    contentType: data.contentType,
                    contentUrl: data.contentUrl,
                    title: data.title
                  }
                ]
          );
          setCurrentIndex(Number(data.currentIndex || 0));
        }
      })
      .catch(() => setError('Party not found.'));
  }, [code, router]);

  useEffect(() => {
    socketRef.current = ensureSocket(socketRef);
    const seatHandler = (payload: { participantId: string; seatId: string; displayName: string; isHost: boolean; muted: boolean }) => {
      setParty((prev) =>
        prev
          ? {
              ...prev,
              participants: [
                ...prev.participants.filter((p) => p.id !== payload.participantId),
                {
                  id: payload.participantId,
                  seatId: payload.seatId,
                  displayName: payload.displayName,
                  isHost: payload.isHost,
                  muted: payload.muted
                }
              ]
            }
          : prev
      );
    };
    const presenceHandler = (payload: { participantId?: string; seatId?: string; displayName?: string; isHost?: boolean; muted?: boolean; left?: boolean }) => {
      if (!payload?.participantId) return;
      setParty((prev) => {
        if (!prev) return prev;
        if (payload.left) {
          return { ...prev, participants: prev.participants.filter((p) => p.id !== payload.participantId) };
        }
        if (!payload.seatId || !payload.displayName) return prev;
        const next = prev.participants.filter((p) => p.id !== payload.participantId);
        next.push({
          id: payload.participantId,
          seatId: payload.seatId,
          displayName: payload.displayName,
          isHost: Boolean(payload.isHost),
          muted: Boolean(payload.muted)
        });
        return { ...prev, participants: next };
      });
    };
    const muteHandler = (payload: { participantId?: string; muted?: boolean }) => {
      if (!payload?.participantId) return;
      setParty((prev) =>
        prev
          ? {
              ...prev,
              participants: prev.participants.map((p) =>
                p.id === payload.participantId ? { ...p, muted: Boolean(payload.muted) } : p
              )
            }
          : prev
      );
    };
    const micLockHandler = (payload: { locked?: boolean }) => {
      setMicLocked(Boolean(payload?.locked));
    };
    const kickHandler = () => {
      router.replace(`/party/${code}/seat`);
    };
    const playlistHandler = (payload: { playlist?: Party['playlist'] }) => {
      if (Array.isArray(payload?.playlist)) {
        setPlaylist(payload.playlist);
      }
    };
    const playbackHandler = (payload: { currentIndex?: number }) => {
      if (typeof payload?.currentIndex === 'number') {
        setCurrentIndex(payload.currentIndex);
      }
    };
    const gameLaunchHandler = (payload: { game: string }) => {
      if (payload.game === 'spacelight') {
        router.push(`/games/spacelight/play?code=${code}&name=${encodeURIComponent(displayName)}&mode=coop`);
      }
    };
    socketRef.current.on('seat:update', seatHandler);
    socketRef.current.on('presence:update', presenceHandler);
    socketRef.current.on('voice:mute', muteHandler);
    socketRef.current.on('voice:micLock', micLockHandler);
    socketRef.current.on('playlist:update', playlistHandler);
    socketRef.current.on('playback:state', playbackHandler);
    socketRef.current.on('party:kick', kickHandler);
    socketRef.current.on('party:gameLaunch', gameLaunchHandler);
    socketRef.current.emit('party:join', { code, participantId });
    return () => {
      if (!socketRef.current) return;
      socketRef.current.off('seat:update', seatHandler);
      socketRef.current.off('presence:update', presenceHandler);
      socketRef.current.off('voice:mute', muteHandler);
      socketRef.current.off('voice:micLock', micLockHandler);
      socketRef.current.off('playlist:update', playlistHandler);
      socketRef.current.off('playback:state', playbackHandler);
      socketRef.current.off('party:kick', kickHandler);
      socketRef.current.off('party:gameLaunch', gameLaunchHandler);
      socketRef.current.emit('party:leave', { code, participantId });
    };
  }, [code, participantId, router]);

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
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,223,128,0.08),transparent_55%),radial-gradient(circle_at_bottom,rgba(74,108,255,0.12),transparent_50%)]" />
      <Header />
      <main className="relative max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="pill inline-block">Party • {party.code}</p>
            <h1 className="text-3xl font-bold">{party.title}</h1>
            <p className="text-white/70 text-sm">You are {seatId} • {displayName}</p>
          </div>
          <div className="glass px-4 py-3 border-brand-primary/30 text-sm text-white/80 max-w-md">
            <div className="font-semibold text-white">How this works</div>
            <p className="text-white/60 text-sm">Host controls playback. Guests follow along, talk, and react.</p>
          </div>
        </div>

        <PresenceBar maxSeats={party.maxSeats} participants={party.participants} seatId={seatId} />

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <div className="flex-1 space-y-4">
            <PartyPlayer
              partyId={party.id}
              code={party.code}
              playlist={playlist as any}
              currentIndex={currentIndex}
              isHost={isHost}
              participantId={participantId}
            />
            <div className="glass p-4 border-brand-primary/30 text-sm text-white/80 space-y-2">
              <div className="font-semibold text-white">Guest powers</div>
              <div className="text-white/60 text-sm">Voice, reactions, and synced playback.</div>
              <div className="text-white/60 text-sm">No play/pause controls.</div>
            </div>
            <ReactionBar code={party.code} seatId={seatId} displayName={displayName} />
          </div>
          <div className="w-full lg:w-[320px] shrink-0">
            <VoiceGrid
              code={party.code}
              seatMap={party.seatMap}
              participants={party.participants}
              participantId={participantId}
              micLocked={micLocked}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
