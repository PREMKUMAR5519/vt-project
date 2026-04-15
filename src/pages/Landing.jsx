import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Common/Button';
import AuthModal from '../components/Auth/AuthModal';
import './Landing.scss';

const FEATURES = [
  { icon: '💬', title: 'Random Chat', desc: 'Meet new people instantly with random or interest-based matching' },
  { icon: '🎵', title: 'Music Sync', desc: 'Listen to YouTube music together in real-time' },
  { icon: '♟️', title: 'Play Games', desc: 'Challenge your match to Chess or Ludo' },
  { icon: '👥', title: 'Add Friends', desc: 'Build lasting connections and keep chatting' },
  { icon: '🔒', title: 'Safe & Private', desc: 'Block anyone, chat as guest — your choice' },
  { icon: '⚡', title: 'Real-time', desc: 'Instant messaging with typing indicators' },
];

export default function Landing() {
  const { user, loginAsGuest } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const navigate = useNavigate();

  function handleStart() {
    if (user) {
      navigate('/match');
    } else {
      loginAsGuest();
      navigate('/match');
    }
  }

  return (
    <div className="landing">
      {/* Hero */}
      <section className="landing__hero">
        <div className="landing__hero-bg">
          <div className="landing__orb landing__orb--1" />
          <div className="landing__orb landing__orb--2" />
          <div className="landing__orb landing__orb--3" />
        </div>
        <div className="landing__hero-content">
          <div className="landing__badge">Real-time Social Platform</div>
          <h1 className="landing__title">
            Connect. Chat.<br />
            <span className="landing__title-accent">Vibe Together.</span>
          </h1>
          <p className="landing__subtitle">
            Meet random strangers, share music, play games — all in one place.
            No signup required to start chatting.
          </p>
          <div className="landing__cta">
            <Button size="lg" onClick={handleStart}>
              Start Chatting Now
            </Button>
            {!user && (
              <Button variant="ghost" size="lg" onClick={() => setShowAuth(true)}>
                Sign In
              </Button>
            )}
          </div>
          <div className="landing__stats">
            <div className="landing__stat">
              <span className="landing__stat-value">10K+</span>
              <span className="landing__stat-label">Active Users</span>
            </div>
            <div className="landing__stat">
              <span className="landing__stat-value">50K+</span>
              <span className="landing__stat-label">Chats Daily</span>
            </div>
            <div className="landing__stat">
              <span className="landing__stat-value">100%</span>
              <span className="landing__stat-label">Free</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="landing__features">
        <h2 className="landing__section-title">Everything you need to vibe</h2>
        <div className="landing__features-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="landing__feature-card">
              <span className="landing__feature-icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="landing__how">
        <h2 className="landing__section-title">How it works</h2>
        <div className="landing__steps">
          {[
            { num: '01', title: 'Jump In', desc: 'Click Start — no signup needed' },
            { num: '02', title: 'Get Matched', desc: 'We find someone for you instantly' },
            { num: '03', title: 'Vibe Together', desc: 'Chat, play games, listen to music' },
          ].map((s) => (
            <div key={s.num} className="landing__step">
              <span className="landing__step-num">{s.num}</span>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="landing__footer">
        <p>VibeTogether — Built with vibes ✨</p>
      </footer>

      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
    </div>
  );
}
