import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMatch } from '../context/MatchContext';
import { createChannel, removeChannel } from '../services/realtimeService';
import ChatPanel from '../components/Chat/ChatPanel';
import MusicPlayer from '../components/Music/MusicPlayer';
import ChessGame from '../components/Games/Chess/ChessGame';
import LudoGame from '../components/Games/Ludo/LudoGame';
import Avatar from '../components/Common/Avatar';
import Button from '../components/Common/Button';
import { getAvatarUrl } from '../utils/helpers';
import './ChatPage.scss';

const TABS = [
  { id: 'music', label: 'Music' },
  { id: 'games', label: 'Games' },
];

export default function ChatPage() {
  const { user, loading } = useAuth();
  const { matchState, currentMatch, partner, endMatch, startSearch, restoringRoom } = useMatch();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('music');
  const [activeGame, setActiveGame] = useState('chess');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [gameInvite, setGameInvite] = useState(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmNext, setConfirmNext] = useState(false);

  useEffect(() => {
    if (!loading && !restoringRoom && (matchState !== 'matched' || !user)) {
      navigate('/match');
    }
  }, [loading, restoringRoom, matchState, user, navigate]);

  useEffect(() => {
    if (!currentMatch?.id || !user?.id) return;

    const chessChannel = createChannel(`chess-${currentMatch.id}`);
    chessChannel
      .on('broadcast', { event: 'chess' }, ({ payload }) => {
        if (!payload || payload.sender === user.id) return;

        if (payload.action === 'request') {
          setSidebarOpen(true);
          setGameInvite({
            game: 'chess',
            senderName: payload.senderName || 'Your match',
            message: `${payload.senderName || 'Your match'} challenged you to Chess.`,
          });
        }

        if (payload.action === 'accept' || payload.action === 'decline' || payload.action === 'reset') {
          setGameInvite((prev) => (prev?.game === 'chess' ? null : prev));
        }
      })
      .subscribe();

    const ludoChannel = createChannel(`ludo:${currentMatch.id}`);
    ludoChannel
      .on('broadcast', { event: 'ludo_request' }, ({ payload }) => {
        if (!payload || payload.from === user.id) return;

        if (payload.action === 'request') {
          setSidebarOpen(true);
          setGameInvite({
            game: 'ludo',
            senderName: payload.senderName || 'Your match',
            message: `${payload.senderName || 'Your match'} invited you to play Ludo.`,
          });
        }

        if (
          payload.action === 'accept' ||
          payload.action === 'decline' ||
          payload.action === 'cancel' ||
          payload.action === 'reset'
        ) {
          setGameInvite((prev) => (prev?.game === 'ludo' ? null : prev));
        }
      })
      .subscribe();

    return () => {
      removeChannel(chessChannel);
      removeChannel(ludoChannel);
    };
  }, [currentMatch?.id, user?.id]);

  if (loading || restoringRoom) return null;
  if (matchState !== 'matched' || !currentMatch) return null;

  const roomId = currentMatch.id;

  function handleEndChat() {
    setGameInvite(null);
    endMatch();
    navigate('/match');
  }

  function handleNextMatch() {
    setGameInvite(null);
    endMatch();
    startSearch();
    navigate('/match');
  }

  function respondToInvite(response) {
    if (!gameInvite) return;

    window.dispatchEvent(new CustomEvent('vibetogether-game-invite-response', {
      detail: {
        game: gameInvite.game,
        response,
      },
    }));

    if (response === 'accept') {
      setActiveTab('games');
      setActiveGame(gameInvite.game);
      setSidebarOpen(true);
    }

    setGameInvite(null);
  }

  return (
    <div className="chat-page">
      <div className="chat-page__header">
        <div className="chat-page__partner">
          <Avatar
            src={partner?.avatar_url || getAvatarUrl(partner?.name || 'Stranger')}
            name={partner?.name}
            size="sm"
            online
          />
          <div className="chat-page__partner-info">
            <span className="chat-page__partner-name">{partner?.name || 'Stranger'}</span>
            <span className="chat-page__partner-status">Online</span>
          </div>
        </div>
        <div className="chat-page__header-actions">
          <span className="chat-page__room-id">Room: {roomId.slice(0, 8)}</span>
          <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? 'Hide Panel' : 'Show Panel'}
          </Button>
          {confirmEnd ? (
            <Button variant="danger" size="sm" onClick={handleEndChat}>
              Confirm?
            </Button>
          ) : (
            <Button variant="danger" size="sm" onClick={() => { setConfirmEnd(true); setConfirmNext(false); }}>
              End Chat
            </Button>
          )}
          {confirmNext ? (
            <Button variant="primary" size="sm" onClick={handleNextMatch}>
              Confirm?
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={() => { setConfirmNext(true); setConfirmEnd(false); }}>
              Next Match
            </Button>
          )}
        </div>
      </div>

      <div className={`chat-page__body ${sidebarOpen ? '' : 'chat-page__body--full'}`}>
        <div className="chat-page__chat">
          <ChatPanel />
        </div>

        {sidebarOpen && (
          <div className="chat-page__sidebar">
            <div className="chat-page__tabs">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  className={`chat-page__tab ${activeTab === tab.id ? 'chat-page__tab--active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
            <div className="chat-page__tab-content">
              <div className={`chat-page__panel ${activeTab === 'music' ? '' : 'chat-page__panel--hidden'}`}>
                <MusicPlayer roomId={roomId} />
              </div>

              <div className={`chat-page__panel ${activeTab === 'games' ? '' : 'chat-page__panel--hidden'}`}>
                <div className="chat-page__games">
                  <div className="chat-page__games-list">
                    <button
                      className={`chat-page__game-card ${activeGame === 'chess' ? 'chat-page__game-card--active' : ''}`}
                      onClick={() => setActiveGame('chess')}
                    >
                      <span className="chat-page__game-name">Chess</span>
                      <span className="chat-page__game-desc">Classic strategy duel</span>
                    </button>
                    <button
                      className={`chat-page__game-card ${activeGame === 'ludo' ? 'chat-page__game-card--active' : ''}`}
                      onClick={() => setActiveGame('ludo')}
                    >
                      <span className="chat-page__game-name">Ludo</span>
                      <span className="chat-page__game-desc">Fast turn-based board game</span>
                    </button>
                  </div>

                  <div className="chat-page__game-panel">
                    <div className={activeGame === 'chess' ? '' : 'chat-page__panel--hidden'}>
                      <ChessGame roomId={roomId} />
                    </div>
                    <div className={activeGame === 'ludo' ? '' : 'chat-page__panel--hidden'}>
                      <LudoGame roomId={roomId} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {gameInvite && (
        <div className="chat-page__invite-popup">
          <div className="chat-page__invite-title">Game Invitation</div>
          <p className="chat-page__invite-text">{gameInvite.message}</p>
          <div className="chat-page__invite-actions">
            <Button variant="success" size="sm" onClick={() => respondToInvite('accept')}>
              Accept
            </Button>
            <Button variant="danger" size="sm" onClick={() => respondToInvite('decline')}>
              Decline
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
