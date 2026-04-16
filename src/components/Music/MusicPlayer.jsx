import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import Button from '../Common/Button';
import './MusicPlayer.scss';

const REMOTE_PLAY_RETRY_MS = 800;

export default function MusicPlayer({ roomId }) {
  const { user } = useAuth();
  const [videoId, setVideoId] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playerReady, setPlayerReady] = useState(false);
  const [needsInteraction, setNeedsInteraction] = useState(false);
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const channelRef = useRef(null);
  const ignoreStateChange = useRef(false);
  const syncStateRef = useRef({ videoId: '', isPlaying: false, currentTime: 0 });
  const desiredPlayingRef = useRef(false);
  const desiredTimeRef = useRef(0);
  const playbackRetryRef = useRef(null);

  useEffect(() => {
    syncStateRef.current = { videoId, isPlaying, currentTime };
  }, [videoId, isPlaying, currentTime]);

  useEffect(() => {
    return () => {
      if (playbackRetryRef.current) {
        clearTimeout(playbackRetryRef.current);
      }
    };
  }, []);

  function clearPlaybackRetry() {
    if (playbackRetryRef.current) {
      clearTimeout(playbackRetryRef.current);
      playbackRetryRef.current = null;
    }
  }

  function queueRemotePlayback() {
    clearPlaybackRetry();
    playbackRetryRef.current = setTimeout(() => {
      playbackRetryRef.current = null;
      if (desiredPlayingRef.current) {
        applyDesiredPlayback(true);
      }
    }, REMOTE_PLAY_RETRY_MS);
  }

  function applyDesiredPlayback(isRemote = false) {
    const player = playerRef.current;
    if (!player) return;

    ignoreStateChange.current = true;

    if (typeof desiredTimeRef.current === 'number') {
      player.seekTo?.(desiredTimeRef.current, true);
      setCurrentTime(desiredTimeRef.current);
    }

    if (desiredPlayingRef.current) {
      if (isRemote) {
        player.mute?.();
      }
      player.playVideo?.();
      queueRemotePlayback();
    } else {
      player.pauseVideo?.();
      clearPlaybackRetry();
      setNeedsInteraction(false);
    }
  }

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase.channel(`music-sync-${roomId}`);
    channel
      .on('broadcast', { event: 'music' }, ({ payload }) => {
        if (payload.sender === user?.id) return;

        if (payload.action === 'load') {
          desiredPlayingRef.current = false;
          desiredTimeRef.current = payload.time || 0;
          clearPlaybackRetry();
          setNeedsInteraction(false);
          setVideoId(payload.videoId);
          setIsHost(false);
          setCurrentTime(payload.time || 0);
          setIsPlaying(false);
          return;
        }

        if (payload.action === 'play') {
          desiredPlayingRef.current = true;
          if (typeof payload.time === 'number') {
            desiredTimeRef.current = payload.time;
          }
          setIsPlaying(true);
          applyDesiredPlayback(true);
          return;
        }

        if (payload.action === 'pause') {
          desiredPlayingRef.current = false;
          if (typeof payload.time === 'number') {
            desiredTimeRef.current = payload.time;
          }
          setIsPlaying(false);
          applyDesiredPlayback(true);
          return;
        }

        if (payload.action === 'seek') {
          desiredTimeRef.current = payload.time;
          ignoreStateChange.current = true;
          playerRef.current?.seekTo?.(payload.time, true);
          setCurrentTime(payload.time);
          return;
        }

        if (payload.action === 'state-request') {
          if (!syncStateRef.current.videoId) return;
          channel.send({
            type: 'broadcast',
            event: 'music',
            payload: {
              sender: user?.id,
              action: 'sync-state',
              target: payload.sender,
              videoId: syncStateRef.current.videoId,
              isPlaying: syncStateRef.current.isPlaying,
              time: syncStateRef.current.currentTime,
            },
          });
          return;
        }

        if (payload.action === 'sync-state') {
          if (payload.target && payload.target !== user?.id) return;
          if (!payload.videoId) return;

          desiredPlayingRef.current = Boolean(payload.isPlaying);
          desiredTimeRef.current = payload.time || 0;
          setVideoId(payload.videoId);
          setIsHost(false);
          setCurrentTime(payload.time || 0);
          setIsPlaying(Boolean(payload.isPlaying));
          setNeedsInteraction(false);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'music',
            payload: { sender: user?.id, action: 'state-request' },
          });
        }
      });

    channelRef.current = channel;
    return () => {
      clearPlaybackRetry();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId, user?.id]);

  useEffect(() => {
    if (!videoId) return;

    function createPlayer() {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      setPlayerReady(false);

      playerRef.current = new window.YT.Player(containerRef.current, {
        width: '100%',
        height: '200',
        videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          fs: 0,
          disablekb: 1,
          iv_load_policy: 3,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            setPlayerReady(true);
            setDuration(playerRef.current?.getDuration?.() || 0);
            applyDesiredPlayback(!isHost);
          },
          onStateChange: (e) => {
            if (ignoreStateChange.current) {
              ignoreStateChange.current = false;
              return;
            }

            const state = e.data;
            const ytState = window.YT.PlayerState;
            const playing = state === ytState.PLAYING;
            const paused = state === ytState.PAUSED;

            if (playing) {
              clearPlaybackRetry();
              setNeedsInteraction(false);
              setIsPlaying(true);
              setDuration(playerRef.current?.getDuration?.() || 0);
              if (!isHost) {
                playerRef.current?.unMute?.();
              }
              return;
            }

            if (paused) {
              setIsPlaying(false);
              return;
            }

            if (desiredPlayingRef.current && !isHost) {
              setNeedsInteraction(true);
              queueRemotePlayback();
            }
          },
        },
      });
    }

    if (window.YT && window.YT.Player) {
      createPlayer();
    } else {
      if (!document.getElementById('yt-iframe-api')) {
        const tag = document.createElement('script');
        tag.id = 'yt-iframe-api';
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
      window.onYouTubeIframeAPIReady = () => createPlayer();
    }
  }, [videoId, isHost]);

  useEffect(() => {
    if (!isPlaying || !playerRef.current) return;
    const iv = setInterval(() => {
      const t = playerRef.current?.getCurrentTime?.();
      if (t !== undefined) {
        setCurrentTime(t);
      }
    }, 500);
    return () => clearInterval(iv);
  }, [isPlaying]);

  function sendMusic(action, extra = {}) {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'music',
      payload: { sender: user?.id, action, ...extra },
    });
  }

  function handleLoadVideo(e) {
    e.preventDefault();
    const id = extractVideoId(urlInput);
    if (!id) return;

    desiredPlayingRef.current = false;
    desiredTimeRef.current = 0;
    clearPlaybackRetry();
    setNeedsInteraction(false);
    setVideoId(id);
    setIsHost(true);
    setCurrentTime(0);
    setIsPlaying(false);
    sendMusic('load', { videoId: id, time: 0 });
    setUrlInput('');
  }

  function handlePlay() {
    desiredPlayingRef.current = true;
    desiredTimeRef.current = playerRef.current?.getCurrentTime?.() || currentTime;
    setNeedsInteraction(false);
    playerRef.current?.unMute?.();
    playerRef.current?.playVideo?.();
    setIsPlaying(true);
    sendMusic('play', { time: desiredTimeRef.current });
  }

  function handlePause() {
    desiredPlayingRef.current = false;
    desiredTimeRef.current = playerRef.current?.getCurrentTime?.() || currentTime;
    playerRef.current?.pauseVideo?.();
    setIsPlaying(false);
    setNeedsInteraction(false);
    sendMusic('pause', { time: desiredTimeRef.current });
  }

  function handleSeek(e) {
    const time = parseFloat(e.target.value);
    desiredTimeRef.current = time;
    playerRef.current?.seekTo?.(time, true);
    setCurrentTime(time);
    sendMusic('seek', { time });
  }

  function extractVideoId(input) {
    const m = input.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
    );
    if (m) return m[1];
    if (/^[a-zA-Z0-9_-]{11}$/.test(input.trim())) return input.trim();
    return null;
  }

  function fmtTime(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  return (
    <div className="music-player">
      <div className="music-player__header">
        <h3>Music Sync</h3>
        {isHost && <span className="music-player__host-badge">Host</span>}
      </div>

      <form className="music-player__search" onSubmit={handleLoadVideo}>
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="Paste YouTube URL or Video ID..."
          className="music-player__input"
        />
        <Button type="submit" size="sm">Load</Button>
      </form>

      <div className="music-player__video">
        {videoId ? (
          <div ref={containerRef} />
        ) : (
          <div className="music-player__placeholder">
            <span>Video</span>
            <p>Paste a YouTube link to start listening together</p>
          </div>
        )}
      </div>

      {videoId && playerReady && (
        <div className="music-player__controls">
          <div className="music-player__progress">
            <span>{fmtTime(currentTime)}</span>
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="music-player__slider"
            />
            <span>{fmtTime(duration)}</span>
          </div>
          <div className="music-player__buttons">
            <button
              type="button"
              className="music-player__ctrl-btn"
              onClick={isPlaying ? handlePause : handlePlay}
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>
          </div>
        </div>
      )}

      {needsInteraction && (
        <div className="music-player__notice">
          Your browser blocked autoplay. Press Play once to continue synced playback.
        </div>
      )}

      <div className="music-player__tip">
        <p>Paste a YouTube link and click Load. Both users will stay in sync.</p>
      </div>
    </div>
  );
}
