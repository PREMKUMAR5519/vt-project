import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMatch } from '../context/MatchContext';
import Button from '../components/Common/Button';
import { INTERESTS_LIST } from '../utils/helpers';
import './MatchPage.scss';

export default function MatchPage() {
  const { user } = useAuth();
  const { matchState, startSearch, cancelSearch, startDemoMatch } = useMatch();
  const navigate = useNavigate();
  const [mode, setMode] = useState('random'); // random | interests
  const [selectedInterests, setSelectedInterests] = useState([]);

  useEffect(() => {
    if (!user) navigate('/');
  }, [user, navigate]);

  useEffect(() => {
    if (matchState === 'matched') {
      navigate('/chat');
    }
  }, [matchState, navigate]);

  function toggleInterest(interest) {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  }

  function handleSearch() {
    const interests = mode === 'interests' ? selectedInterests : [];
    startSearch(interests);
  }

  function handleDemoMatch() {
    startDemoMatch();
  }

  if (matchState === 'searching') {
    return (
      <div className="match-page">
        <div className="match-page__searching">
          <div className="match-page__pulse-ring">
            <div className="match-page__pulse-ring-inner" />
            <div className="match-page__pulse-ring-outer" />
            <span className="match-page__pulse-emoji">🔍</span>
          </div>
          <h2>Finding your vibe match...</h2>
          <p>Hang tight, we're looking for someone awesome</p>
          <Button variant="ghost" onClick={cancelSearch}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="match-page">
      <div className="match-page__content">
        <h1>Find Your Match</h1>
        <p className="match-page__desc">Choose how you want to connect</p>

        <div className="match-page__modes">
          <button
            className={`match-page__mode ${mode === 'random' ? 'match-page__mode--active' : ''}`}
            onClick={() => setMode('random')}
          >
            <span className="match-page__mode-icon">🎲</span>
            <span className="match-page__mode-title">Random</span>
            <span className="match-page__mode-desc">Match with anyone</span>
          </button>
          <button
            className={`match-page__mode ${mode === 'interests' ? 'match-page__mode--active' : ''}`}
            onClick={() => setMode('interests')}
          >
            <span className="match-page__mode-icon">🎯</span>
            <span className="match-page__mode-title">Interests</span>
            <span className="match-page__mode-desc">Match by interests</span>
          </button>
        </div>

        {mode === 'interests' && (
          <div className="match-page__interests fade-in">
            <h3>Select your interests</h3>
            <div className="match-page__interests-grid">
              {INTERESTS_LIST.map((interest) => (
                <button
                  key={interest}
                  className={`match-page__interest-tag ${
                    selectedInterests.includes(interest) ? 'match-page__interest-tag--active' : ''
                  }`}
                  onClick={() => toggleInterest(interest)}
                >
                  {interest}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="match-page__actions">
          <Button size="lg" onClick={handleSearch}>
            Start Matching
          </Button>
          <Button variant="ghost" size="lg" onClick={handleDemoMatch}>
            Try Demo Match
          </Button>
        </div>
      </div>
    </div>
  );
}
