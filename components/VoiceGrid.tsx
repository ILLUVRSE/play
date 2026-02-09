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
  label,
  trackRef,
  isSpeaking,
  muted,
  isHost
}: {
  label: string;
  trackRef: any;
  isSpeaking: boolean;
  muted: boolean;
  isHost: boolean;
}) {
  return (
    <div className={`relative rounded-2xl overflow-hidden border ${isSpeaking ? 'border-brand-glow' : 'border-white/10'} bg-black/40`}>
      {trackRef ? (
        <VideoTrack trackRef={trackRef} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full grid place-items-center text-white/40 text-sm">No video</div>
      )}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-xs text-white/80">
        <div className="flex items-center gap-2">
          <span className="pill">{label}</span>
          {isHost ? <span className="pill bg-brand-primary/30 border-brand-primary/40">Host</span> : null}
        </div>
        {muted ? <span className="pill bg-red-500/20 border-red-400/40">Muted</span> : null}
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

  const gridStyle = useMemo(
    () => ({
      gridTemplateColumns: `repeat(${seatMap.cols}, minmax(0, 1fr))`,
      gridTemplateRows: `repeat(${seatMap.rows}, minmax(0, 1fr))`
    }),
    [seatMap]
  );

  return (
    <div className="space-y-4">
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

      <div className="grid gap-3" style={gridStyle}>
        {seatMap.seats.map((seatId) => {
          const participant = participantsBySeat.get(seatId);
          if (!participant) {
            return (
              <div key={seatId} className="rounded-2xl border border-white/10 bg-black/20 text-xs text-white/40 grid place-items-center">
                {seatId}
              </div>
            );
          }
          const trackRef = tracksByIdentity.get(participant.id);
          const lkParticipant = trackRef?.participant;
          const micMuted =
            participant.muted ||
            lkParticipant?.getTrackPublication?.(Track.Source.Microphone)?.isMuted ||
            false;
          return (
            <SeatTile
              key={seatId}
              label={`${participant.displayName} • ${seatId}`}
              trackRef={trackRef}
              isSpeaking={Boolean(lkParticipant?.isSpeaking)}
              muted={micMuted}
              isHost={participant.isHost}
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
        if (!response?.token) {
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
    <LiveKitRoom token={token} serverUrl={livekitUrl} audio={false} video={false}>
      <RoomAudioRenderer />
      <VoiceRoom seatMap={seatMap} participants={participants} participantId={participantId} micLocked={micLocked} />
    </LiveKitRoom>
  );
}
