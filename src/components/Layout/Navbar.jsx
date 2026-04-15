import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../Common/Avatar';
import AuthModal from '../Auth/AuthModal';
import Button from '../Common/Button';
import './Navbar.scss';

export default function Navbar() {
  const { user, logout, loginAsGuest } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const location = useLocation();

  return (
    <>
      <nav className="navbar">
        <div className="navbar__inner">
          <Link to="/" className="navbar__logo">
            <span className="navbar__logo-icon">🎵</span>
            <span className="navbar__logo-text">VibeTogether</span>
          </Link>

          <div className="navbar__links">
            <Link to="/" className={location.pathname === '/' ? 'active' : ''}>Home</Link>
            {user && (
              <>
                <Link to="/match" className={location.pathname === '/match' ? 'active' : ''}>Match</Link>
                <Link to="/profile" className={location.pathname === '/profile' ? 'active' : ''}>Profile</Link>
              </>
            )}
          </div>

          <div className="navbar__actions">
            {user ? (
              <div className="navbar__user">
                <Avatar src={user.avatar_url} name={user.name} size="sm" online />
                <span className="navbar__username">{user.name}</span>
                {user.is_guest && (
                  <Button variant="ghost" size="sm" onClick={() => setShowAuth(true)}>
                    Sign In
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={logout}>
                  Logout
                </Button>
              </div>
            ) : (
              <div className="navbar__auth">
                <Button variant="ghost" size="sm" onClick={loginAsGuest}>
                  Guest Mode
                </Button>
                <Button size="sm" onClick={() => setShowAuth(true)}>
                  Sign In
                </Button>
              </div>
            )}
          </div>
        </div>
      </nav>
      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
    </>
  );
}
