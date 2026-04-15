import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMatch } from '../context/MatchContext';
import ChatPanel from '../components/Chat/ChatPanel';
import MusicPlayer from '../components/Music/MusicPlayer';
import ChessGame from '../components/Games/Chess/ChessGame';
import LudoGame from '../components/Games/Ludo/LudoGame';
import Avatar from '../components/Common/Avatar';
import Button from '../components/Common/Button';
import { getAvatarUrl } from '../utils/helpers';
import './ChatPage.scss';

const TABS = [
  { id: 'music', label: 'Music', icon: '🎵' },
  { id: 'chess', label: 'Chess', icon: '♟️' },
  { id: 'ludo', label: 'Ludo', icon: '🎲' },
];

export default function ChatPage() {
  const { user, loading } = useAuth();
  const { matchState, currentMatch, partner, endMatch, restoringRoom } = useMatch();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('music');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (!loading && !restoringRoom && (matchState !== 'matched' || !user)) {
      navigate('/match');
    }
  }, [loading, restoringRoom, matchState, user, navigate]);

  if (loading || restoringRoom) return null;
  if (matchState !== 'matched' || !currentMatch) return null;

  // CRITICAL: Use the shared match ID as room ID for all channels.
  // Both users have the same currentMatch.id, so they join the same broadcast channels.
  const roomId = currentMatch.id;

  function handleEndChat() {
    endMatch();
    navigate('/match');
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
            {sidebarOpen ? '◀' : '▶'} Panel
          </Button>
          <Button variant="danger" size="sm" onClick={handleEndChat}>
            End Chat
          </Button>
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
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
            <div className="chat-page__tab-content">
              {activeTab === 'music' && <MusicPlayer roomId={roomId} />}
              {activeTab === 'chess' && <ChessGame roomId={roomId} />}
              {activeTab === 'ludo' && <LudoGame roomId={roomId} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
