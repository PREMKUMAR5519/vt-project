import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import {
  joinQueue, leaveQueue, checkMyQueueStatus, findWaitingUser,
  claimMatch, getUser, getMatch,
  getMessages, sendMessage,
  isBlocked, supabase,
} from '../services/supabase';

const MatchContext = createContext(null);

const ROOM_KEY = 'vibe_room';

function saveRoom(data) {
  sessionStorage.setItem(ROOM_KEY, JSON.stringify(data));
}

function loadRoom() {
  try {
    const raw = sessionStorage.getItem(ROOM_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearRoom() {
  sessionStorage.removeItem(ROOM_KEY);
}

export function MatchProvider({ children }) {
  const { user, loading } = useAuth();
  const [matchState, setMatchState] = useState('idle');
  const [currentMatch, setCurrentMatch] = useState(null);
  const [partner, setPartner] = useState(null);
  const [messages, setMessages] = useState([]);
  const [partnerLeft, setPartnerLeft] = useState(false);
  const [restoringRoom, setRestoringRoom] = useState(true);
  const channelRef = useRef(null);
  const pollRef = useRef(null);
  const isPollingRef = useRef(false);
  const restoredRef = useRef(false);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      restoredRef.current = false;
      setRestoringRoom(false);
      return;
    }

    if (restoredRef.current) return;
    restoredRef.current = true;

    const saved = loadRoom();
    if (saved?.matchId && saved?.partnerId) {
      restoreRoom(saved.matchId, saved.partnerId);
      return;
    }

    setRestoringRoom(false);
  }, [loading, user]);

  async function restoreRoom(matchId, partnerId) {
    const match = await getMatch(matchId);
    if (!match) {
      clearRoom();
      setRestoringRoom(false);
      return;
    }

    let partnerName = 'Stranger';
    let partnerAvatar = null;
    const { data: partnerData } = await getUser(partnerId);
    if (partnerData) {
      partnerName = partnerData.name || partnerName;
      partnerAvatar = partnerData.avatar_url;
    }

    setCurrentMatch({ id: matchId });
    setPartner({ id: partnerId, name: partnerName, avatar_url: partnerAvatar });
    setMatchState('matched');

    const msgs = await getMessages(matchId);
    setMessages(msgs);
    subMessages(matchId);
    setRestoringRoom(false);
  }

  function subMessages(matchId) {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }
    // Single channel with both postgres_changes (backup) and broadcast (instant)
    const channel = supabase
      .channel(`messages:${matchId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
        (payload) => {
          const newMsg = payload.new;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            // Replace any optimistic version of this message
            const hasOptimistic = prev.some(
              (m) => typeof m.id === 'string' && m.id.startsWith('optimistic-') && m.sender_id === newMsg.sender_id && m.content === newMsg.content
            );
            if (hasOptimistic) {
              return prev.map((m) =>
                typeof m.id === 'string' && m.id.startsWith('optimistic-') && m.sender_id === newMsg.sender_id && m.content === newMsg.content
                  ? newMsg
                  : m
              );
            }
            return [...prev, newMsg];
          });
        }
      )
      .on('broadcast', { event: 'new_message' }, ({ payload }) => {
        // Instant delivery via broadcast - add if not already present
        if (!payload) return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.id)) return prev;
          return [...prev, payload];
        });
      })
      .on('broadcast', { event: 'partner_left' }, () => {
        setPartnerLeft(true);
      })
      .subscribe();
    channelRef.current = channel;
  }

  const startSearch = useCallback(async (interests = []) => {
    if (!user) return;
    setRestoringRoom(false);
    setMatchState('searching');

    const { error } = await joinQueue(user.id, user.name, interests);
    if (error) {
      console.error('Failed to join queue:', error);
      setMatchState('idle');
      return;
    }

    pollRef.current = setInterval(async () => {
      if (isPollingRef.current) return;
      isPollingRef.current = true;

      try {
        const myRow = await checkMyQueueStatus(user.id);
        if (!myRow) {
          clearInterval(pollRef.current);
          setMatchState('idle');
          return;
        }

        if (myRow.status === 'matched' && myRow.match_id) {
          clearInterval(pollRef.current);
          await onMatchFound(myRow.match_id, myRow.matched_with);
          await leaveQueue(user.id);
          return;
        }

        const candidate = await findWaitingUser(user.id);
        if (!candidate) return;

        const blocked = await isBlocked(user.id, candidate.user_id);
        if (blocked) return;

        const { match } = await claimMatch(user.id, candidate.user_id);
        if (match) {
          clearInterval(pollRef.current);
          await onMatchFound(match.id, candidate.user_id);
          await leaveQueue(user.id);
        }
      } catch (err) {
        console.error('Poll error:', err);
      } finally {
        isPollingRef.current = false;
      }
    }, 2000);
  }, [user]);

  async function onMatchFound(matchId, partnerId) {
    let partnerName = 'Stranger';
    let partnerAvatar = null;

    const { data: partnerData } = await getUser(partnerId);
    if (partnerData) {
      partnerName = partnerData.name || partnerName;
      partnerAvatar = partnerData.avatar_url;
    }

    setCurrentMatch({ id: matchId });
    setPartner({ id: partnerId, name: partnerName, avatar_url: partnerAvatar });
    setMatchState('matched');
    setRestoringRoom(false);

    saveRoom({ matchId, partnerId });

    const msgs = await getMessages(matchId);
    setMessages(msgs);
    subMessages(matchId);
  }

  const cancelSearch = useCallback(async () => {
    if (pollRef.current) clearInterval(pollRef.current);
    isPollingRef.current = false;
    if (user) await leaveQueue(user.id);
    setRestoringRoom(false);
    setMatchState('idle');
  }, [user]);

  const send = useCallback(async (content) => {
    if (!currentMatch || !user) return;

    // Optimistically add the message to local state so sender sees it instantly
    const optimisticMsg = {
      id: `optimistic-${Date.now()}`,
      match_id: currentMatch.id,
      sender_id: user.id,
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    const { data, error } = await sendMessage(currentMatch.id, user.id, content);
    if (data) {
      // Replace optimistic message with the real one from DB
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticMsg.id ? data : m))
      );
      // Broadcast to the other user for instant delivery
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'new_message',
          payload: data,
        });
      }
    } else if (error) {
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      console.error('Failed to send message:', error);
    }
  }, [currentMatch, user]);

  const endMatch = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    isPollingRef.current = false;
    // Notify the partner before leaving
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'partner_left',
        payload: {},
      });
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    clearRoom();
    setRestoringRoom(false);
    setPartnerLeft(false);
    setMatchState('idle');
    setCurrentMatch(null);
    setPartner(null);
    setMessages([]);
  }, []);

  const startDemoMatch = useCallback(() => {
    setMatchState('matched');
    setCurrentMatch({ id: 'demo-match-1' });
    setPartner({ id: 'demo-partner', name: 'Demo_User' });
    setRestoringRoom(false);
    setMessages([
      { id: '1', sender_id: 'demo-partner', content: 'Hey! Welcome to VibeTogether! 👋', created_at: new Date().toISOString() },
      { id: '2', sender_id: 'demo-partner', content: 'Try out the music player or games on the right panel!', created_at: new Date().toISOString() },
    ]);
    saveRoom({ matchId: 'demo-match-1', partnerId: 'demo-partner' });
  }, []);

  const sendDemo = useCallback((content) => {
    const msg = {
      id: Date.now().toString(),
      sender_id: user?.id,
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, msg]);

    setTimeout(() => {
      const replies = [
        "That's awesome! 😄", 'Haha nice!', 'Tell me more!',
        'I love that!', 'Cool! 🔥', 'Interesting...', 'No way! 😱',
        'Same here!', "Let's play a game!", 'Check out the music player!',
      ];
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        sender_id: 'demo-partner',
        content: replies[Math.floor(Math.random() * replies.length)],
        created_at: new Date().toISOString(),
      }]);
    }, 1000 + Math.random() * 2000);
  }, [user]);

  return (
    <MatchContext.Provider value={{
      matchState, currentMatch, partner, messages, partnerLeft, restoringRoom,
      startSearch, cancelSearch, send, endMatch,
      startDemoMatch, sendDemo,
    }}
    >
      {children}
    </MatchContext.Provider>
  );
}

export function useMatch() {
  const ctx = useContext(MatchContext);
  if (!ctx) throw new Error('useMatch must be used within MatchProvider');
  return ctx;
}
