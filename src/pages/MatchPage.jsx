import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMatch } from '../context/MatchContext';
import Button from '../components/Common/Button';
import './MatchPage.scss';

export default function MatchPage() {
  const { user } = useAuth();
  const { matchState, startSearch, cancelSearch, startDemoMatch } = useMatch();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) navigate('/');
  }, [user, navigate]);

  useEffect(() => {
    if (matchState === 'matched') {
      navigate('/chat');
    }
  }, [matchState, navigate]);

  function handleSearch() {
    startSearch([]);
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
            <span className="match-page__pulse-emoji">?</span>
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
        <p className="match-page__desc">Start matching instantly and jump straight into chat.</p>
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
