import { useState } from 'react';
import Modal from '../Common/Modal';
import Button from '../Common/Button';
import { signInWithGoogle, signInWithEmail } from '../../services/supabase';
import './AuthModal.scss';

export default function AuthModal({ isOpen, onClose }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleEmailLogin(e) {
    e.preventDefault();
    setError('');
    const { error: err } = await signInWithEmail(email);
    if (err) {
      setError(err.message);
    } else {
      setSent(true);
    }
  }

  async function handleGoogleLogin() {
    const { error: err } = await signInWithGoogle();
    if (err) setError(err.message);
  }

  function handleClose() {
    setEmail('');
    setSent(false);
    setError('');
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Sign In">
      <div className="auth-modal">
        {sent ? (
          <div className="auth-modal__sent">
            <div className="auth-modal__sent-icon">📧</div>
            <h4>Check your email!</h4>
            <p>We sent a magic link to <strong>{email}</strong></p>
            <Button variant="ghost" onClick={() => setSent(false)}>Try another email</Button>
          </div>
        ) : (
          <>
            <Button className="auth-modal__google" variant="ghost" onClick={handleGoogleLogin}>
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
                <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
              </svg>
              Continue with Google
            </Button>

            <div className="auth-modal__divider">
              <span>or</span>
            </div>

            <form onSubmit={handleEmailLogin}>
              <label className="auth-modal__label">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="auth-modal__input"
              />
              <Button type="submit" className="auth-modal__submit">
                Send Magic Link
              </Button>
            </form>

            {error && <p className="auth-modal__error">{error}</p>}
          </>
        )}
      </div>
    </Modal>
  );
}
