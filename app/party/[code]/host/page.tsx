'use client';

import { useEffect, useRef, useState } from 'react';
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
  seatLocked: boolean;
};

export default function HostPartyView() {
  const params = useParams();
  const code = String(params?.code || '').toUpperCase();
  const router = useRouter();
  const [party, setParty] = useState<Party | null>(null);
  const [copied, setCopied] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const seatId = typeof window !== 'undefined' ? localStorage.getItem(`party-${code}-seat`) || 'A-1' : 'A-1';
  const displayName = 'Host';
  const participantId = typeof window !== 'undefined' ? localStorage.getItem(`party-${code}-participant`) || '' : '';
  const [micLocked, setMicLocked] = useState(false);
  const [seatLocked, setSeatLocked] = useState(false);
  const [playlist, setPlaylist] = useState<Party['playlist']>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    fetch(`/api/parties/${code}`)
      .then((res) => res.json())
      .then((data) => {
        setParty(data);
        setMicLocked(Boolean(data?.micLocked));
        setSeatLocked(Boolean(data?.seatLocked));
        const basePlaylist = Array.isArray(data?.playlist) ? data.playlist : [];
        setPlaylist(
          basePlaylist.length
            ? basePlaylist
            : [
                {
                  id: 'fallback',
                  orderIndex: 0,
                  contentType: data?.contentType,
                  contentUrl: data?.contentUrl,
                  title: data?.title
                }
              ]
        );
        setCurrentIndex(Number(data?.currentIndex || 0));
      })
      .catch(() => {});
  }, [code]);

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
    const seatLockHandler = (payload: { locked?: boolean }) => {
      setSeatLocked(Boolean(payload?.locked));
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
    socketRef.current.on('seat:lock', seatLockHandler);
    socketRef.current.on('playlist:update', playlistHandler);
    socketRef.current.on('playback:state', playbackHandler);
    socketRef.current.on('party:gameLaunch', gameLaunchHandler);
    socketRef.current.emit('party:join', { code, participantId });
    return () => {
      if (!socketRef.current) return;
      socketRef.current.off('seat:update', seatHandler);
      socketRef.current.off('presence:update', presenceHandler);
      socketRef.current.off('voice:mute', muteHandler);
      socketRef.current.off('voice:micLock', micLockHandler);
      socketRef.current.off('seat:lock', seatLockHandler);
      socketRef.current.off('playlist:update', playlistHandler);
      socketRef.current.off('playback:state', playbackHandler);
      socketRef.current.off('party:gameLaunch', gameLaunchHandler);
      socketRef.current.emit('party:leave', { code, participantId });
    };
  }, [code, participantId]);

  const endParty = async () => {
    try {
      // fallback to localStorage if participantId isn't in state
      const id =
        participantId ||
        (typeof window !== 'undefined' ? localStorage.getItem(`party-${code}-participant`) || '' : '');

      if (!id) {
        // useful feedback for host
        window.alert('Host authorization missing - please re-open the host page.');
        return;
      }

      const res = await fetch(`/api/parties/${code}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: id })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error('Failed to end party', data);
        window.alert(data?.error || 'Failed to end party');
        return;
      }

      // notify the socket server (if connected) so guests update immediately
      socketRef.current?.emit('party:ended', { code });

      // redirect host to the home/dashboard
      router.push('/');
    } catch (err) {
      console.error('endParty error', err);
      window.alert('Unexpected error ending party');
    }
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const toggleMicLock = () => {
    socketRef.current?.emit('host:micLock', { code, locked: !micLocked });
    setMicLocked((prev) => !prev);
  };

  const toggleSeatLock = () => {
    socketRef.current?.emit('host:seatLock', { code, locked: !seatLocked });
    setSeatLocked((prev) => !prev);
  };

  const updateOrder = (orderedIds: string[]) => {
    setPlaylist((prev) => orderedIds.map((id) => prev.find((item) => item.id === id)).filter(Boolean) as Party['playlist']);
    socketRef.current?.emit('playlist:update', { code, orderedIds });
  };

  const moveItem = (id: string, direction: -1 | 1) => {
    const index = playlist.findIndex((item) => item.id === id);
    if (index < 0) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= playlist.length) return;
    const next = [...playlist];
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item);
    updateOrder(next.map((p) => p.id));
  };

  const sendMute = (targetId: string, muted: boolean) => {
    socketRef.current?.emit(muted ? 'host:mute' : 'host:unmute', { code, targetParticipantId: targetId });
  };

  const sendKick = (targetId: string) => {
    socketRef.current?.emit('host:kick', { code, targetParticipantId: targetId });
  };

  const launchSpacelight = () => {
    socketRef.current?.emit('host:launchGame', { code });
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
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,223,128,0.08),transparent_55%),radial-gradient(circle_at_bottom,rgba(74,108,255,0.12),transparent_50%)]" />
      <Header />
      <main className="relative max-w-6xl mx-auto px-6 py-8 space-y-6">
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
          <p className="text-white/60 text-sm">Press Play to start. Guests follow your playback, talk, and react.</p>
        </div>

        <PresenceBar maxSeats={party.maxSeats} participants={party.participants} seatId={seatId} />

        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-4 items-start">
          <div className="space-y-4">
            <PartyPlayer
              partyId={party.id}
              code={party.code}
              playlist={playlist as any}
              currentIndex={currentIndex}
              isHost
              participantId={participantId}
            />
            <section className="glass p-4 border-brand-primary/30 text-sm text-white/80 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-white">Playlist</h2>
                <div className="text-xs text-white/60">
                  Now playing: {playlist[currentIndex]?.title || `Item ${currentIndex + 1}`}
                </div>
              </div>
              <div className="text-xs text-white/60">
                Up next: {playlist[currentIndex + 1]?.title || 'End of playlist'}
              </div>
              <div className="space-y-2">
                {playlist.map((item, index) => (
                  <div key={item.id} className={`flex items-center justify-between text-xs ${index === currentIndex ? 'text-brand-glow' : 'text-white/70'}`}>
                    <span>
                      {index + 1}. {item.title || item.contentUrl}
                    </span>
                    <div className="flex items-center gap-2">
                      <button className="button-ghost text-xs border-brand-primary/40" onClick={() => moveItem(item.id, -1)} disabled={index === 0}>
                        Up
                      </button>
                      <button className="button-ghost text-xs border-brand-primary/40" onClick={() => moveItem(item.id, 1)} disabled={index === playlist.length - 1}>
                        Down
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <div className="glass p-4 border-brand-primary/30 text-sm text-white/80 space-y-4">
              <div className="font-semibold text-white">Host powers</div>
              <div className="text-white/60 text-sm">Play/Pause, force sync, and end the party.</div>

              <div className="pt-2">
                  <button
                    onClick={launchSpacelight}
                    className="w-full bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 py-3 rounded-xl font-bold text-white shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all"
                  >
                    🚀 LAUNCH SPACELIGHT CHRONICLES
                  </button>
                  <p className="text-[10px] text-white/40 mt-2 text-center uppercase tracking-widest">Redirects all guests to co-op mission</p>
              </div>
            </div>
            <ReactionBar code={party.code} seatId={seatId} displayName={displayName} />
          </div>
          <div className="h-full min-h-[480px] space-y-4">
            <section className="glass p-4 border-brand-primary/30 text-sm text-white/80 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-white">Moderation</h2>
                <div className="flex items-center gap-2">
                  <button className="button-ghost text-xs border-brand-primary/40" onClick={toggleMicLock}>
                    {micLocked ? 'Unlock mics' : 'Lock mics'}
                  </button>
                  <button className="button-ghost text-xs border-brand-primary/40" onClick={toggleSeatLock}>
                    {seatLocked ? 'Unlock seats' : 'Lock seats'}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {party.participants
                  .filter((p) => !p.isHost)
                  .map((participant) => (
                    <div key={participant.id} className="flex items-center justify-between text-xs text-white/70">
                      <span>{participant.displayName} • {participant.seatId}</span>
                      <div className="flex items-center gap-2">
                        <button
                          className="button-ghost text-xs border-brand-primary/40"
                          onClick={() => sendMute(participant.id, !participant.muted)}
                        >
                          {participant.muted ? 'Unmute' : 'Mute'}
                        </button>
                        <button className="button-ghost text-xs border-red-400/40 text-red-200" onClick={() => sendKick(participant.id)}>
                          Kick
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </section>
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
