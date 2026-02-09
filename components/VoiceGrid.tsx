'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { LiveKitRoom, RoomAudioRenderer, VideoTrack, useLocalParticipant, useTracks } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { ensureSocket } from '@/lib/socketClient';
import type { Socket } from 'socket.io-client';
import type { SeatMap } from '@/lib/seatMap';

type ParticipantInfo = {
  id: string;
  seatId: string;
  displayName: string;
  isHost: boolean;
  muted: boolean;
};

type Props = {
  code: string;
  seatMap: SeatMap;
  participants: ParticipantInfo[];
  participantId: string;
  micLocked: boolean;
};

function SeatTile({
  seatId,
  displayName,
  trackRef,
  muted,
  isHost,
  hasParticipant,
  hasVideo
}: {
  seatId: string;
  displayName?: string;
  trackRef?: any;
  muted?: boolean;
  isHost?: boolean;
  hasParticipant?: boolean;
  hasVideo?: boolean;
}) {
  return (
    <div className={`rounded-lg overflow-hidden border ${isHost ? 'border-yellow-400/60' : 'border-white/10'} bg-black/40`}>
      <div className="relative aspect-video">
        {hasVideo && trackRef ? (
          <VideoTrack trackRef={trackRef} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-white/40 text-sm">
            {hasParticipant ? 'Camera off' : 'Empty seat'}
          </div>
        )}
        <div className="absolute top-2 left-2 text-xs bg-black/70 px-2 py-0.5 rounded">{seatId}</div>
        {displayName ? (
          <div className="absolute bottom-2 left-2 right-2 text-xs text-white/80 flex items-center justify-between">
            <span className="truncate">{displayName}</span>
            {muted ? <span className="pill bg-red-500/20 border-red-400/40">Muted</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function VoiceRoom({
  seatMap,
  participants,
  participantId,
  micLocked
}: {
  seatMap: SeatMap;
  participants: ParticipantInfo[];
  participantId: string;
  micLocked: boolean;
}) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const trackRefs = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }]);

  const localInfo = participants.find((p) => p.id === participantId);

  useEffect(() => {
    if (!localParticipant) return;
    if (micLocked || localInfo?.muted) {
      localParticipant.setMicrophoneEnabled(false);
    }
  }, [localParticipant, micLocked, localInfo?.muted]);

  const participantsBySeat = useMemo(() => {
    const map = new Map<string, ParticipantInfo>();
    participants.forEach((p) => map.set(p.seatId, p));
    return map;
  }, [participants]);

  const tracksByIdentity = useMemo(() => {
    const map = new Map<string, any>();
    trackRefs.forEach((ref) => map.set(ref.participant.identity, ref));
    return map;
  }, [trackRefs]);

  const orderedSeats = useMemo(() => {
    const seats = [...seatMap.seats].sort((a, b) => a.localeCompare(b));
    const hostSeatId = participants.find((p) => p.isHost)?.seatId;
    if (hostSeatId && seats.includes(hostSeatId)) {
      return [hostSeatId, ...seats.filter((seatId) => seatId !== hostSeatId)];
    }
    return seats;
  }, [seatMap.seats, participants]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">People ({participants.length} / {seatMap.seats.length})</div>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <button
          className="button-ghost border-brand-primary/40 text-sm"
          type="button"
          onClick={() => localParticipant?.setMicrophoneEnabled(!isMicrophoneEnabled)}
          disabled={micLocked || localInfo?.muted}
        >
          {isMicrophoneEnabled ? 'Mute mic' : 'Unmute mic'}
        </button>
        <button
          className="button-ghost border-brand-primary/40 text-sm"
          type="button"
          onClick={() => localParticipant?.setCameraEnabled(!isCameraEnabled)}
        >
          {isCameraEnabled ? 'Stop camera' : 'Start camera'}
        </button>
        {micLocked ? <span className="pill text-xs bg-red-500/20 border-red-400/40">Mic lock enabled</span> : null}
      </div>

      <div className="flex flex-col gap-3">
        {orderedSeats.map((seatId) => {
          const participant = participantsBySeat.get(seatId);
          const trackRef = participant ? tracksByIdentity.get(participant.id) : null;
          const lkParticipant = trackRef?.participant;
          const cameraPublication = lkParticipant?.getTrackPublication?.(Track.Source.Camera);
          const hasVideo = Boolean(cameraPublication && !cameraPublication.isMuted && cameraPublication.track);
          const micMuted =
            participant?.muted ||
            lkParticipant?.getTrackPublication?.(Track.Source.Microphone)?.isMuted ||
            false;
          return (
            <SeatTile
              key={seatId}
              seatId={seatId}
              displayName={participant?.displayName}
              trackRef={trackRef}
              muted={micMuted}
              isHost={participant?.isHost}
              hasParticipant={Boolean(participant)}
              hasVideo={hasVideo}
            />
          );
        })}
      </div>
    </div>
  );
}

export function VoiceGrid({ code, seatMap, participants, participantId, micLocked }: Props) {
  const socketRef = useRef<Socket | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState('');
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || '';

  useEffect(() => {
    if (!participantId) return;
    socketRef.current = ensureSocket(socketRef);
    socketRef.current.emit(
      'voice:join',
      { code, participantId },
      (response: { token?: string; error?: string }) => {
        if (!response?.token || typeof response.token !== 'string') {
          setError(response?.error || 'Voice unavailable');
          return;
        }
        setToken(response.token);
      }
    );
  }, [code, participantId]);

  if (!livekitUrl) {
    return <div className="text-sm text-white/60">LiveKit is not configured for this environment.</div>;
  }

  if (error) {
    return <div className="text-sm text-red-300">{error}</div>;
  }

  if (!token) {
    return <div className="text-sm text-white/60">Connecting voice room...</div>;
  }

  return (
    <LiveKitRoom token={token} serverUrl={livekitUrl} audio={!micLocked} video={true}>
      <RoomAudioRenderer />
      <VoiceRoom seatMap={seatMap} participants={participants} participantId={participantId} micLocked={micLocked} />
    </LiveKitRoom>
  );
}
