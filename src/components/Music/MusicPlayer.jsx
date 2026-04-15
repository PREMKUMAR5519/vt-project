import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import Button from '../Common/Button';
import './MusicPlayer.scss';

export default function MusicPlayer({ roomId }) {
  const { user } = useAuth();
  const [videoId, setVideoId] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playerReady, setPlayerReady] = useState(false);
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const channelRef = useRef(null);
  const ignoreStateChange = useRef(false);
  const syncStateRef = useRef({ videoId: '', isPlaying: false, currentTime: 0 });

  useEffect(() => {
    syncStateRef.current = { videoId, isPlaying, currentTime };
  }, [videoId, isPlaying, currentTime]);

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase.channel(`music-sync-${roomId}`);
    channel
      .on('broadcast', { event: 'music' }, ({ payload }) => {
        if (payload.sender === user?.id) return;

        if (payload.action === 'load') {
          setVideoId(payload.videoId);
          setIsHost(false);
          setCurrentTime(payload.time || 0);
          setIsPlaying(false);
          return;
        }

        if (payload.action === 'play') {
          ignoreStateChange.current = true;
          if (typeof payload.time === 'number') {
            playerRef.current?.seekTo?.(payload.time, true);
            setCurrentTime(payload.time);
          }
          playerRef.current?.playVideo?.();
          setIsPlaying(true);
          return;
        }

        if (payload.action === 'pause') {
          ignoreStateChange.current = true;
          if (typeof payload.time === 'number') {
            playerRef.current?.seekTo?.(payload.time, true);
            setCurrentTime(payload.time);
          }
          playerRef.current?.pauseVideo?.();
          setIsPlaying(false);
          return;
        }

        if (payload.action === 'seek') {
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

          ignoreStateChange.current = true;
          setVideoId(payload.videoId);
          setIsHost(false);
          setCurrentTime(payload.time || 0);
          setIsPlaying(Boolean(payload.isPlaying));
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
          controls: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            const seekTime = syncStateRef.current.videoId === videoId ? syncStateRef.current.currentTime : 0;
            setPlayerReady(true);
            setDuration(playerRef.current?.getDuration?.() || 0);
            if (seekTime > 0) {
              playerRef.current?.seekTo?.(seekTime, true);
              setCurrentTime(seekTime);
            }
            if (syncStateRef.current.videoId === videoId && syncStateRef.current.isPlaying) {
              ignoreStateChange.current = true;
              playerRef.current?.playVideo?.();
            }
          },
          onStateChange: (e) => {
            if (ignoreStateChange.current) {
              ignoreStateChange.current = false;
              return;
            }
            const playing = e.data === window.YT.PlayerState.PLAYING;
            setIsPlaying(playing);
            if (playing) {
              setDuration(playerRef.current?.getDuration?.() || 0);
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
  }, [videoId]);

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

    setVideoId(id);
    setIsHost(true);
    setCurrentTime(0);
    setIsPlaying(false);
    sendMusic('load', { videoId: id, time: 0 });
    setUrlInput('');
  }

  function handlePlay() {
    playerRef.current?.playVideo?.();
    setIsPlaying(true);
    sendMusic('play', { time: playerRef.current?.getCurrentTime?.() || currentTime });
  }

  function handlePause() {
    playerRef.current?.pauseVideo?.();
    setIsPlaying(false);
    sendMusic('pause', { time: playerRef.current?.getCurrentTime?.() || currentTime });
  }

  function handleSeek(e) {
    const time = parseFloat(e.target.value);
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
        <h3>🎵 Music Sync</h3>
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
            <span>🎧</span>
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
              {isPlaying ? '⏸' : '▶️'}
            </button>
          </div>
        </div>
      )}

      <div className="music-player__tip">
        <p>Paste a YouTube link and click Load. Both users will hear the same music in sync.</p>
      </div>
    </div>
  );
}
