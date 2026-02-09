/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useEffect, useRef, useState } from 'react';
import { ensureSocket } from '@/lib/socketClient';
import type { Socket } from 'socket.io-client';

type Props = {
  code: string;
  playlist: { contentType: 'youtube' | 'mp3' | 'mp4'; contentUrl: string; title?: string | null }[];
  currentIndex: number;
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

export function PartyPlayer({ code, playlist, currentIndex, isHost }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ytRef = useRef<any>(null);
  const socketRef = useRef<Socket | null>(null);
  const [playing, setPlaying] = useState(false);
  const [activeIndex, setActiveIndex] = useState(currentIndex);

  const activeItem = playlist[activeIndex];
  const contentType = activeItem?.contentType;
  const contentUrl = activeItem?.contentUrl;

  useEffect(() => {
    setActiveIndex(currentIndex);
  }, [currentIndex]);

  useEffect(() => {
    if (playlist.length === 0) return;
    if (activeIndex >= playlist.length) {
      setActiveIndex(0);
    }
  }, [playlist, activeIndex]);

  useEffect(() => {
    socketRef.current = ensureSocket(socketRef);

    const syncHandler = (payload: { playing: boolean; currentTime: number; currentIndex?: number; updatedAt?: string }) => {
      if (isHost) return;

      setPlaying(payload.playing);

      if (typeof payload.currentIndex === 'number') {
        setActiveIndex(payload.currentIndex);
      }

      // compute latency-compensated target time
      let targetTime = Number(payload.currentTime || 0);
      if (payload.updatedAt) {
        const serverTs = Date.parse(payload.updatedAt);
        if (!Number.isNaN(serverTs)) {
          const latencyMs = Math.max(0, Date.now() - serverTs);
          targetTime = targetTime + latencyMs / 1000;
        }
      }

      const seekIfNeeded = (current: number, desired: number, setter?: (v: number) => void) => {
        if (Math.abs(current - desired) > 0.2) {
          if (typeof setter === 'function') setter(desired);
        }
      };

      if (contentType === 'mp3' && audioRef.current) {
        const audio = audioRef.current;
        seekIfNeeded(audio.currentTime, targetTime, (t) => {
          audio.currentTime = Math.max(0, t);
        });
        payload.playing ? audio.play().catch(() => {}) : audio.pause();
        return;
      }

      if (contentType === 'mp4' && videoRef.current) {
        const video = videoRef.current;
        // if metadata not loaded yet, wait for it
        if (isNaN(video.duration) || video.readyState < 2) {
          const onLoaded = () => {
            video.removeEventListener('loadedmetadata', onLoaded);
            seekIfNeeded(video.currentTime, targetTime, (t) => {
              video.currentTime = Math.max(0, t);
            });
            payload.playing ? video.play().catch(() => {}) : video.pause();
          };
          video.addEventListener('loadedmetadata', onLoaded);
        } else {
          seekIfNeeded(video.currentTime, targetTime, (t) => {
            video.currentTime = Math.max(0, t);
          });
          payload.playing ? video.play().catch(() => {}) : video.pause();
        }
        return;
      }

      if (contentType === 'youtube' && ytRef.current) {
        // use server-latency compensated time for youtube seek
        const seekTime = Math.max(0, targetTime);
        try {
          ytRef.current.seekTo(seekTime, true);
          payload.playing ? ytRef.current.playVideo() : ytRef.current.pauseVideo();
        } catch (e) {
          // ignore temporary YT errors
        }
        return;
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
    if (ytRef.current?.destroy) {
      ytRef.current.destroy();
      ytRef.current = null;
    }
    if (window.YT && window.YT.Player) {
      createYouTubePlayer();
      return;
    }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.body.appendChild(tag);
    window.onYouTubeIframeAPIReady = createYouTubePlayer;
  }, [contentUrl, contentType]);

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
          const ended = ytRef.current?.getPlayerState?.() === 0;
          if (ended) {
            hostNextTrack();
            return;
          }
          broadcastState(isPlaying, time);
        }
      }
    });
  };

  const broadcastState = (nextPlaying: boolean, currentTime: number, nextIndex = activeIndex) => {
    setPlaying(nextPlaying);
    socketRef.current?.emit('playback:state', { code, playing: nextPlaying, currentTime, currentIndex: nextIndex });
  };

  const hostPlayPause = () => {
    if (!isHost) return;
    if (!contentType) return;

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

    if (contentType === 'mp4' && videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        broadcastState(true, videoRef.current.currentTime);
      } else {
        videoRef.current.pause();
        broadcastState(false, videoRef.current.currentTime);
      }
      return;
    }

    if (contentType === 'youtube' && ytRef.current) {
      if (typeof ytRef.current.getPlayerState !== 'function') return;
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

  const hostNextTrack = () => {
    if (!isHost) return;
    if (activeIndex >= playlist.length - 1) {
      broadcastState(false, 0, activeIndex);
      return;
    }
    const nextIndex = activeIndex + 1;
    setActiveIndex(nextIndex);
    broadcastState(false, 0, nextIndex);
  };

  const hostPrevTrack = () => {
    if (!isHost) return;
    if (activeIndex <= 0) {
      broadcastState(false, 0, 0);
      return;
    }
    const nextIndex = activeIndex - 1;
    setActiveIndex(nextIndex);
    broadcastState(false, 0, nextIndex);
  };

  const hostSyncNow = () => {
    if (!isHost) return;
    if (!contentType) return;
    if (contentType === 'mp3' && audioRef.current) {
      broadcastState(!audioRef.current.paused, audioRef.current.currentTime);
    }
    if (contentType === 'mp4' && videoRef.current) {
      broadcastState(!videoRef.current.paused, videoRef.current.currentTime);
    }
    if (contentType === 'youtube' && ytRef.current) {
      if (typeof ytRef.current.getPlayerState !== 'function') return;
      broadcastState(ytRef.current.getPlayerState() === 1, ytRef.current.getCurrentTime());
    }
  };

  return (
    <div className="glass border-brand-primary/30 p-4 space-y-3 orbital">
      <div className="flex items-center justify-between">
        <div className="text-sm text-white/70">Screen</div>
        {isHost ? (
          <div className="flex gap-2 items-center flex-wrap">
            <button
              className={`button-primary text-base shadow-gold px-5 py-3 ${playing ? '' : 'animate-pulse'}`}
              onClick={hostPlayPause}
              aria-label={playing ? 'Pause playback' : 'Play playback'}
            >
              {playing ? 'Pause' : 'Play'}
            </button>
            <button className="button-ghost text-sm border-brand-primary/40" onClick={hostPrevTrack}>
              Prev
            </button>
            <button className="button-ghost text-sm border-brand-primary/40" onClick={hostNextTrack}>
              Next
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
        {!contentType || !contentUrl ? (
          <div className="w-full h-full grid place-items-center text-sm text-white/60">No media queued.</div>
        ) : contentType === 'youtube' ? (
          <div id="yt-player" className="w-full h-full" />
        ) : contentType === 'mp3' ? (
          <div className="w-full h-full grid place-items-center p-6">
            <audio
              ref={audioRef}
              controls={isHost}
              className="w-full"
              src={contentUrl}
              onPlay={() => isHost && broadcastState(true, audioRef.current?.currentTime || 0)}
              onPause={() => isHost && broadcastState(false, audioRef.current?.currentTime || 0)}
              onEnded={() => isHost && hostNextTrack()}
            />
          </div>
        ) : (
          <div className="w-full h-full grid place-items-center p-6">
            <video
              ref={videoRef}
              controls={isHost}
              className="w-full h-full object-cover"
              src={contentUrl}
              onPlay={() => isHost && broadcastState(true, videoRef.current?.currentTime || 0)}
              onPause={() => isHost && broadcastState(false, videoRef.current?.currentTime || 0)}
              onEnded={() => isHost && hostNextTrack()}
            />
          </div>
        )}
      </div>
    </div>
  );
}
