import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useMatch } from '../../context/MatchContext';
import { formatTime, EMOJI_LIST } from '../../utils/helpers';
import './ChatPanel.scss';

export default function ChatPanel() {
  const { user } = useAuth();
  const { messages, send, sendDemo, currentMatch } = useMatch();
  const [input, setInput] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const isDemo = currentMatch?.id === 'demo-match-1';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Simulate typing indicator for demo
  useEffect(() => {
    if (isDemo && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.sender_id === user?.id) {
        setIsTyping(true);
        const timer = setTimeout(() => setIsTyping(false), 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [messages, isDemo, user]);

  function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    if (isDemo) {
      sendDemo(text);
    } else {
      send(text);
    }
    setInput('');
    setShowEmoji(false);
  }

  function addEmoji(emoji) {
    setInput((prev) => prev + emoji);
    inputRef.current?.focus();
  }

  return (
    <div className="chat-panel">
      <div className="chat-panel__messages">
        {messages.map((msg) => {
          const isMine = msg.sender_id === user?.id;
          return (
            <div
              key={msg.id}
              className={`chat-panel__msg ${isMine ? 'chat-panel__msg--mine' : 'chat-panel__msg--theirs'}`}
            >
              <div className="chat-panel__msg-bubble">
                <p>{msg.content}</p>
                <span className="chat-panel__msg-time">{formatTime(msg.created_at)}</span>
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="chat-panel__msg chat-panel__msg--theirs">
            <div className="chat-panel__msg-bubble chat-panel__typing">
              <span className="chat-panel__typing-dot" />
              <span className="chat-panel__typing-dot" />
              <span className="chat-panel__typing-dot" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Emoji picker */}
      {showEmoji && (
        <div className="chat-panel__emoji-picker">
          {EMOJI_LIST.map((emoji) => (
            <button key={emoji} onClick={() => addEmoji(emoji)} className="chat-panel__emoji-btn">
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form className="chat-panel__input-bar" onSubmit={handleSend}>
        <button
          type="button"
          className="chat-panel__emoji-toggle"
          onClick={() => setShowEmoji(!showEmoji)}
        >
          😊
        </button>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="chat-panel__input"
        />
        <button type="submit" className="chat-panel__send-btn" disabled={!input.trim()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </button>
      </form>
    </div>
  );
}
