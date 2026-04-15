import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../services/supabase';
import { useAuth } from '../../../context/AuthContext';
import Button from '../../Common/Button';
import './LudoGame.scss';

const TOKEN_COUNT = 2;

const PATH = [];
for (let i = 0; i < 6; i++) PATH.push([0, i]);
for (let i = 0; i < 6; i++) PATH.push([i, 6]);
PATH.push([6, 7]);
PATH.push([6, 8]);
for (let i = 6; i < 12; i++) PATH.push([i, 8]);
for (let i = 8; i >= 0; i--) PATH.push([12, i]);
for (let i = 12; i > 6; i--) PATH.push([i, 0]);
PATH.push([6, 0]);

const TOTAL_STEPS = PATH.length;

function createInitialTokens() {
  return {
    p1: Array(TOKEN_COUNT).fill(-1),
    p2: Array(TOKEN_COUNT).fill(-1),
  };
}

export default function LudoGame({ roomId }) {
  const { user } = useAuth();
  const [tokens, setTokens] = useState(createInitialTokens());
  const [dice, setDice] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [turn, setTurn] = useState('p1');
  const [myColor, setMyColor] = useState('p1');
  const [gameStarted, setGameStarted] = useState(false);
  const [winner, setWinner] = useState(null);
  const [phase, setPhase] = useState('idle');
  const [requestFrom, setRequestFrom] = useState(null);
  const [status, setStatus] = useState('');
  const initiatorRef = useRef(null);
  const channelRef = useRef(null);

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase.channel(`ludo:${roomId}`);
    channel
      .on('broadcast', { event: 'ludo_update' }, ({ payload }) => {
        if (payload.from === user?.id) return;
        setTokens(payload.tokens);
        setTurn(payload.turn);
        setDice(payload.dice);
        if (payload.winner) setWinner(payload.winner);
      })
      .on('broadcast', { event: 'ludo_request' }, ({ payload }) => {
        if (payload.from === user?.id) return;

        if (payload.action === 'request') {
          initiatorRef.current = payload.from;
          setRequestFrom(payload.senderName || 'Your match');
          setPhase('requested');
          setStatus('');
          return;
        }

        if (payload.action === 'accept') {
          setPhase('playing');
          setStatus('Game started');
          return;
        }

        if (payload.action === 'decline') {
          initiatorRef.current = null;
          setRequestFrom(null);
          setPhase('idle');
          setGameStarted(false);
          setStatus('Game request declined');
          return;
        }

        if (payload.action === 'cancel') {
          initiatorRef.current = null;
          setRequestFrom(null);
          setPhase('idle');
          setGameStarted(false);
          setStatus('Game request cancelled');
          return;
        }

        if (payload.action === 'reset') {
          resetLocalState();
        }
      })
      .on('broadcast', { event: 'ludo_start' }, ({ payload }) => {
        initiatorRef.current = payload.initiator;
        setTokens(createInitialTokens());
        setMyColor(payload.initiator === user?.id ? 'p1' : 'p2');
        setGameStarted(true);
        setPhase('playing');
        setRequestFrom(null);
        setStatus('');
        setTurn('p1');
        setDice(null);
        setWinner(null);
      })
      .subscribe();

    channelRef.current = channel;
    return () => supabase.removeChannel(channel);
  }, [roomId, user?.id]);

  function resetLocalState() {
    initiatorRef.current = null;
    setTokens(createInitialTokens());
    setDice(null);
    setRolling(false);
    setTurn('p1');
    setMyColor('p1');
    setGameStarted(false);
    setWinner(null);
    setPhase('idle');
    setRequestFrom(null);
    setStatus('');
  }

  function sendRequest(action) {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'ludo_request',
      payload: { from: user?.id, senderName: user?.name, action },
    });
  }

  function broadcastState(newTokens, newTurn, diceValue, winnerVal = null) {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'ludo_update',
      payload: { from: user?.id, tokens: newTokens, turn: newTurn, dice: diceValue, winner: winnerVal },
    });
  }

  function handleRequestGame() {
    initiatorRef.current = user?.id;
    setPhase('waiting');
    setStatus('Waiting for opponent to accept...');
    sendRequest('request');
  }

  function handleAcceptGame() {
    setTokens(createInitialTokens());
    setMyColor('p2');
    setGameStarted(true);
    setPhase('playing');
    setRequestFrom(null);
    setStatus('Game started');
    setTurn('p1');
    setDice(null);
    setWinner(null);
    sendRequest('accept');
    channelRef.current?.send({
      type: 'broadcast',
      event: 'ludo_start',
      payload: { initiator: initiatorRef.current },
    });
  }

  function handleDeclineGame() {
    initiatorRef.current = null;
    setPhase('idle');
    setRequestFrom(null);
    setStatus('');
    sendRequest('decline');
  }

  function handleCancelRequest() {
    initiatorRef.current = null;
    setPhase('idle');
    setStatus('');
    sendRequest('cancel');
  }

  function handleResetGame() {
    resetLocalState();
    sendRequest('reset');
  }

  function rollDice() {
    if (turn !== myColor || rolling || winner || !gameStarted) return;
    setRolling(true);

    let count = 0;
    const interval = setInterval(() => {
      setDice(Math.floor(Math.random() * 6) + 1);
      count++;
      if (count >= 10) {
        clearInterval(interval);
        const finalDice = Math.floor(Math.random() * 6) + 1;
        setDice(finalDice);
        setRolling(false);

        const myTokens = tokens[myColor];
        const canMove = myTokens.some((pos) => {
          if (pos === -1 && finalDice === 6) return true;
          if (pos >= 0 && pos + finalDice < TOTAL_STEPS) return true;
          return false;
        });

        if (!canMove) {
          const nextTurn = myColor === 'p1' ? 'p2' : 'p1';
          setTurn(nextTurn);
          broadcastState(tokens, nextTurn, finalDice);
        }
      }
    }, 80);
  }

  function moveToken(tokenIndex) {
    if (turn !== myColor || rolling || !dice || winner || !gameStarted) return;

    const newTokens = JSON.parse(JSON.stringify(tokens));
    const pos = newTokens[myColor][tokenIndex];

    if (pos === -1) {
      if (dice !== 6) return;
      newTokens[myColor][tokenIndex] = 0;
    } else {
      const newPos = pos + dice;
      if (newPos >= TOTAL_STEPS) return;
      newTokens[myColor][tokenIndex] = newPos;

      const opponent = myColor === 'p1' ? 'p2' : 'p1';
      const oppStart = myColor === 'p1' ? 0 : Math.floor(TOTAL_STEPS / 2);
      newTokens[opponent] = newTokens[opponent].map((oPos) => {
        if (oPos >= 0) {
          const [oRow, oCol] = PATH[(oPos + oppStart) % TOTAL_STEPS] || [];
          const [mRow, mCol] = PATH[(newPos + (myColor === 'p1' ? 0 : Math.floor(TOTAL_STEPS / 2))) % TOTAL_STEPS] || [];
          if (oRow === mRow && oCol === mCol) return -1;
        }
        return oPos;
      });
    }

    const isWin = newTokens[myColor].every((p) => p >= TOTAL_STEPS - 1);
    const nextTurn = dice === 6 ? myColor : (myColor === 'p1' ? 'p2' : 'p1');

    setTokens(newTokens);
    setTurn(nextTurn);
    setDice(null);

    if (isWin) {
      setWinner(myColor);
      broadcastState(newTokens, nextTurn, dice, myColor);
    } else {
      broadcastState(newTokens, nextTurn, dice);
    }
  }

  function getTokenPosition(player, tokenIdx) {
    const pos = tokens[player][tokenIdx];
    if (pos < 0) return null;
    const offset = player === 'p1' ? 0 : Math.floor(TOTAL_STEPS / 2);
    return PATH[(pos + offset) % TOTAL_STEPS];
  }

  function renderBoard() {
    const cells = [];
    const size = 13;

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const isPath = PATH.some(([pr, pc]) => pr === r && pc === c);
        const tokensHere = [];

        ['p1', 'p2'].forEach((player) => {
          tokens[player].forEach((_, idx) => {
            const pos = getTokenPosition(player, idx);
            if (pos && pos[0] === r && pos[1] === c) {
              tokensHere.push({ player, idx });
            }
          });
        });

        cells.push(
          <div
            key={`${r}-${c}`}
            className={`ludo__cell ${isPath ? 'ludo__cell--path' : ''}`}
          >
            {tokensHere.map((t) => (
              <span
                key={`${t.player}-${t.idx}`}
                className={`ludo__token ludo__token--${t.player}`}
                onClick={() => t.player === myColor ? moveToken(t.idx) : null}
                style={{ cursor: t.player === myColor && turn === myColor ? 'pointer' : 'default' }}
              />
            ))}
          </div>
        );
      }
    }
    return cells;
  }

  return (
    <div className="ludo">
      <div className="ludo__header">
        <h3>🎲 Ludo</h3>
        {winner && <span className="ludo__winner">{winner === myColor ? 'You win!' : 'Opponent wins!'}</span>}
        {!winner && status && <span className="ludo__winner">{status}</span>}
      </div>

      {!gameStarted && phase === 'idle' && (
        <div className="ludo__start">
          <p>Play a simplified Ludo game with your match!</p>
          <Button onClick={handleRequestGame}>Request Game</Button>
        </div>
      )}

      {!gameStarted && phase === 'waiting' && (
        <div className="ludo__start">
          <p>Game request sent. Waiting for your match to accept.</p>
          <Button variant="ghost" size="sm" onClick={handleCancelRequest}>Cancel</Button>
        </div>
      )}

      {!gameStarted && phase === 'requested' && (
        <div className="ludo__start">
          <p><strong>{requestFrom || 'Your match'}</strong> wants to play Ludo.</p>
          <Button onClick={handleAcceptGame}>Accept</Button>
          <Button variant="danger" onClick={handleDeclineGame}>Decline</Button>
        </div>
      )}

      {gameStarted && (
        <>
          <div className="ludo__info">
            <div className="ludo__player-indicator">
              <span className={`ludo__dot ludo__dot--${myColor}`} />
              <span>You ({myColor === 'p1' ? 'Purple' : 'Red'})</span>
            </div>
            <span className="ludo__turn-text">
              {winner ? 'Game Over' : turn === myColor ? 'Your turn' : "Opponent's turn"}
            </span>
          </div>

          <div className="ludo__bases">
            {['p1', 'p2'].forEach(() => null) || null}
            <div className="ludo__base">
              <span className="ludo__base-label">Base</span>
              <div className="ludo__base-tokens">
                {tokens[myColor].map((pos, i) =>
                  pos === -1 ? (
                    <span
                      key={i}
                      className={`ludo__token ludo__token--${myColor}`}
                      onClick={() => dice === 6 && moveToken(i)}
                      style={{ cursor: dice === 6 && turn === myColor ? 'pointer' : 'default' }}
                    />
                  ) : null
                )}
              </div>
            </div>
          </div>

          <div className="ludo__board" style={{ gridTemplateColumns: 'repeat(13, 1fr)' }}>
            {renderBoard()}
          </div>

          <div className="ludo__dice-area">
            <button
              type="button"
              className={`ludo__dice ${rolling ? 'ludo__dice--rolling' : ''}`}
              onClick={rollDice}
              disabled={turn !== myColor || rolling || !!winner}
            >
              {dice || '?'}
            </button>
            <span className="ludo__dice-hint">
              {turn === myColor ? 'Click to roll' : 'Wait for opponent'}
            </span>
          </div>

          <Button variant="ghost" size="sm" onClick={handleResetGame}>End Game</Button>
        </>
      )}
    </div>
  );
}
