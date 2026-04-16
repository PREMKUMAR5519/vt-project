import { useState, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import { supabase } from '../../../services/supabase';
import { useAuth } from '../../../context/AuthContext';
import Button from '../../Common/Button';
import './ChessGame.scss';

const PIECE_SYMBOLS = {
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
};

function getPieceDisplay(piece) {
  if (!piece) return null;
  const key = piece.color === 'w' ? piece.type.toUpperCase() : piece.type;
  return PIECE_SYMBOLS[key];
}

export default function ChessGame({ roomId }) {
  const { user } = useAuth();
  const [game, setGame] = useState(new Chess());
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [validMoves, setValidMoves] = useState([]);
  const [playerColor, setPlayerColor] = useState('w');
  const [phase, setPhase] = useState('idle'); // idle | requested | waiting | playing
  const [status, setStatus] = useState('');
  const channelRef = useRef(null);

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase.channel(`chess-${roomId}`);
    channel
      .on('broadcast', { event: 'chess' }, ({ payload }) => {
        if (payload.sender === user?.id) return;

        switch (payload.action) {
          case 'request':
            setPhase('requested');
            setStatus(`${payload.senderName || 'Your match'} invited you to Chess.`);
            break;

          case 'accept':
            // Other player accepted our request — start game
            setGame(new Chess());
            setPlayerColor('w'); // requester is white
            setPhase('playing');
            setStatus('Your turn');
            setSelectedSquare(null);
            setValidMoves([]);
            break;

          case 'decline':
            setPhase('idle');
            setStatus('Request declined');
            setTimeout(() => setStatus(''), 3000);
            break;

          case 'move':
            setGame((prev) => {
              const g = new Chess(prev.fen());
              g.move(payload.move);
              return g;
            });
            break;

          case 'reset':
            setGame(new Chess());
            setPhase('idle');
            setStatus('');
            setSelectedSquare(null);
            setValidMoves([]);
            break;
        }
      })
      .subscribe();

    channelRef.current = channel;
    return () => supabase.removeChannel(channel);
  }, [roomId, user?.id]);

  useEffect(() => {
    function handleInviteResponse(event) {
      const detail = event.detail;
      if (!detail || detail.game !== 'chess' || phase !== 'requested') return;

      if (detail.response === 'accept') {
        handleAccept();
      } else if (detail.response === 'decline') {
        handleDecline();
      }
    }

    window.addEventListener('vibetogether-game-invite-response', handleInviteResponse);
    return () => window.removeEventListener('vibetogether-game-invite-response', handleInviteResponse);
  }, [phase]);

  // Update status text
  useEffect(() => {
    if (phase !== 'playing') return;
    if (game.isCheckmate()) {
      setStatus(`Checkmate! ${game.turn() === 'w' ? 'Black' : 'White'} wins!`);
    } else if (game.isDraw()) {
      setStatus('Draw!');
    } else if (game.isCheck()) {
      setStatus('Check! ' + (game.turn() === playerColor ? 'Your turn' : "Opponent's turn"));
    } else {
      setStatus(game.turn() === playerColor ? 'Your turn' : "Opponent's turn");
    }
  }, [game, phase, playerColor]);

  function send(action, extra = {}) {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'chess',
      payload: { sender: user?.id, senderName: user?.name, action, ...extra },
    });
  }

  function handleRequestGame() {
    setPhase('waiting');
    setStatus('Waiting for opponent to accept...');
    send('request');
  }

  function handleAccept() {
    // Acceptor is black
    setGame(new Chess());
    setPlayerColor('b');
    setPhase('playing');
    setStatus("Opponent's turn");
    setSelectedSquare(null);
    setValidMoves([]);
    send('accept');
  }

  function handleDecline() {
    setPhase('idle');
    setStatus('');
    send('decline');
  }

  function handleReset() {
    setGame(new Chess());
    setPhase('idle');
    setStatus('');
    setSelectedSquare(null);
    setValidMoves([]);
    send('reset');
  }

  function handleSquareClick(square) {
    if (phase !== 'playing' || game.isGameOver()) return;
    if (game.turn() !== playerColor) return;

    const piece = game.get(square);

    if (selectedSquare) {
      const move = game.move({ from: selectedSquare, to: square, promotion: 'q' });
      if (move) {
        setGame(new Chess(game.fen()));
        setSelectedSquare(null);
        setValidMoves([]);
        send('move', { move: { from: move.from, to: move.to, promotion: 'q' } });
      } else if (piece && piece.color === playerColor) {
        setSelectedSquare(square);
        setValidMoves(game.moves({ square, verbose: true }).map((m) => m.to));
      } else {
        setSelectedSquare(null);
        setValidMoves([]);
      }
    } else if (piece && piece.color === playerColor) {
      setSelectedSquare(square);
      setValidMoves(game.moves({ square, verbose: true }).map((m) => m.to));
    }
  }

  function renderBoard() {
    const board = game.board();
    const rows = playerColor === 'b' ? [...board].reverse() : board;
    const squares = [];

    rows.forEach((row, ri) => {
      const actualRow = playerColor === 'b' ? ri : 7 - ri;
      const cols = playerColor === 'b' ? [...row].reverse() : row;

      cols.forEach((piece, ci) => {
        const actualCol = playerColor === 'b' ? 7 - ci : ci;
        const file = String.fromCharCode(97 + actualCol);
        const rank = actualRow + 1;
        const sq = `${file}${rank}`;
        const isLight = (actualRow + actualCol) % 2 === 1;
        const isSelected = selectedSquare === sq;
        const isValid = validMoves.includes(sq);
        const lastMove = game.history({ verbose: true }).slice(-1)[0];
        const isLastMove = lastMove?.to === sq || lastMove?.from === sq;

        squares.push(
          <div
            key={sq}
            className={`chess__square ${isLight ? 'chess__square--light' : 'chess__square--dark'} ${
              isSelected ? 'chess__square--selected' : ''
            } ${isLastMove ? 'chess__square--last-move' : ''}`}
            onClick={() => handleSquareClick(sq)}
          >
            {piece && <span className={`chess__piece chess__piece--${piece.color}`}>{getPieceDisplay(piece)}</span>}
            {isValid && <span className="chess__valid-dot" />}
          </div>
        );
      });
    });

    return squares;
  }

  return (
    <div className="chess">
      <div className="chess__header">
        <h3>♟️ Chess</h3>
        {status && <span className="chess__status">{status}</span>}
      </div>

      {/* Idle — show challenge button */}
      {phase === 'idle' && (
        <div className="chess__start">
          <p>Challenge your match to a game of chess!</p>
          <Button onClick={handleRequestGame}>Send Challenge</Button>
        </div>
      )}

      {/* Waiting for opponent to accept */}
      {phase === 'waiting' && (
        <div className="chess__start">
          <div className="chess__waiting-anim">♟️</div>
          <p>Challenge sent! Waiting for opponent...</p>
          <Button variant="ghost" size="sm" onClick={handleReset}>Cancel</Button>
        </div>
      )}

      {phase === 'requested' && (
        <div className="chess__start">
          <p>Challenge received. Use the popup to accept or decline.</p>
        </div>
      )}

      {/* Playing */}
      {phase === 'playing' && (
        <>
          <div className="chess__board">{renderBoard()}</div>
          <div className="chess__actions">
            <span className="chess__color-badge">
              You: {playerColor === 'w' ? '⬜ White' : '⬛ Black'}
            </span>
            <Button variant="ghost" size="sm" onClick={handleReset}>Resign</Button>
          </div>
        </>
      )}
    </div>
  );
}
