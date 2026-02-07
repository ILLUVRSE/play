/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useEffect, useRef, useState } from 'react';
import { ensureSocket } from '@/lib/socketClient';
import type { Socket } from 'socket.io-client';

type Props = {
  code: string;
  contentType: 'youtube' | 'mp3';
  contentUrl: string;
  isHost: boolean;
};

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(/[?&]v=([^&#]+)/) || url.match(/youtu\.be\/([^?#]+)/);
  return match ? match[1] : null;
}

export function PartyPlayer({ code, contentType, contentUrl, isHost }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytRef = useRef<any>(null);
  const socketRef = useRef<Socket | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    socketRef.current = ensureSocket(socketRef);

    const syncHandler = (payload: { playing: boolean; currentTime: number }) => {
      if (isHost) return;
      setPlaying(payload.playing);
      if (contentType === 'mp3' && audioRef.current) {
        audioRef.current.currentTime = payload.currentTime;
        payload.playing ? audioRef.current.play().catch(() => {}) : audioRef.current.pause();
      }
      if (contentType === 'youtube' && ytRef.current) {
        ytRef.current.seekTo(payload.currentTime, true);
        payload.playing ? ytRef.current.playVideo() : ytRef.current.pauseVideo();
      }
    };

    socketRef.current.on('playback:state', syncHandler);
    socketRef.current.emit('playback:requestSync', { code });
    return () => {
      if (!socketRef.current) return;
      socketRef.current.off('playback:state', syncHandler);
    };
  }, [code, contentType, isHost]);

  useEffect(() => {
    if (contentType !== 'youtube') return;
    if (window.YT && window.YT.Player) {
      createYouTubePlayer();
      return;
    }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.body.appendChild(tag);
    window.onYouTubeIframeAPIReady = createYouTubePlayer;
  }, [contentUrl]);

  const createYouTubePlayer = () => {
    const videoId = extractYouTubeId(contentUrl);
    if (!videoId) return;
    ytRef.current = new window.YT.Player('yt-player', {
      videoId,
      playerVars: {
        controls: isHost ? 1 : 0,
        modestbranding: 1,
        rel: 0
      },
      events: {
        onStateChange: () => {
          if (!isHost) return;
          const time = ytRef.current?.getCurrentTime?.() || 0;
          const isPlaying = ytRef.current?.getPlayerState?.() === 1;
          broadcastState(isPlaying, time);
        }
      }
    });
  };

  const broadcastState = (nextPlaying: boolean, currentTime: number) => {
    setPlaying(nextPlaying);
    socketRef.current?.emit('playback:state', { code, playing: nextPlaying, currentTime });
  };

  const hostPlayPause = () => {
    if (!isHost) return;
    if (contentType === 'mp3' && audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play();
        broadcastState(true, audioRef.current.currentTime);
      } else {
        audioRef.current.pause();
        broadcastState(false, audioRef.current.currentTime);
      }
      return;
    }
    if (contentType === 'youtube' && ytRef.current) {
      const state = ytRef.current.getPlayerState();
      if (state === 1) {
        ytRef.current.pauseVideo();
        broadcastState(false, ytRef.current.getCurrentTime());
      } else {
        ytRef.current.playVideo();
        broadcastState(true, ytRef.current.getCurrentTime());
      }
    }
  };

  const hostSyncNow = () => {
    if (!isHost) return;
    if (contentType === 'mp3' && audioRef.current) {
      broadcastState(!audioRef.current.paused, audioRef.current.currentTime);
    }
    if (contentType === 'youtube' && ytRef.current) {
      broadcastState(ytRef.current.getPlayerState() === 1, ytRef.current.getCurrentTime());
    }
  };

  return (
    <div className="glass border-brand-primary/30 p-4 space-y-3 orbital">
      <div className="flex items-center justify-between">
        <div className="text-sm text-white/70">Screen</div>
        {isHost ? (
          <div className="flex gap-2 items-center">
            <button
              className={`button-primary text-base shadow-gold px-5 py-3 ${playing ? '' : 'animate-pulse'}`}
              onClick={hostPlayPause}
              aria-label={playing ? 'Pause playback' : 'Play playback'}
            >
              {playing ? 'Pause' : 'Play'}
            </button>
            <button
              className="button-ghost text-sm border-brand-primary/40"
              onClick={hostSyncNow}
              title="Send your current time and play state to all viewers"
            >
              Send sync to viewers
            </button>
          </div>
        ) : (
          <div className="pill text-xs bg-brand-primary/20 border-brand-primary/40">Synced to host</div>
        )}
      </div>
      <div className="relative aspect-video w-full max-h-[420px] overflow-hidden rounded-2xl bg-black border border-brand-primary/30 shadow-glow">
        {contentType === 'youtube' ? (
          <div id="yt-player" className="w-full h-full" />
        ) : (
          <div className="w-full h-full grid place-items-center p-6">
            <audio
              ref={audioRef}
              controls={isHost}
              className="w-full"
              src={contentUrl}
              onPlay={() => isHost && broadcastState(true, audioRef.current?.currentTime || 0)}
              onPause={() => isHost && broadcastState(false, audioRef.current?.currentTime || 0)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
