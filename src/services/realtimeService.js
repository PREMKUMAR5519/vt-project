import { supabase } from './supabase';

// Realtime service for features that need broadcast channels
// (typing indicators, music sync, game state)

export function createChannel(name) {
  return supabase.channel(name);
}

export function subscribeToPresence(channelName, callbacks) {
  const channel = supabase.channel(channelName, {
    config: { presence: { key: callbacks.userId } },
  });

  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      callbacks.onSync?.(state);
    })
    .on('presence', { event: 'join' }, ({ key, newPresences }) => {
      callbacks.onJoin?.(key, newPresences);
    })
    .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      callbacks.onLeave?.(key, leftPresences);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ user_id: callbacks.userId, online_at: new Date().toISOString() });
      }
    });

  return channel;
}

// Broadcast channel for typing, music, games
export function subscribeToBroadcast(channelName, event, callback) {
  const channel = supabase.channel(channelName);
  channel
    .on('broadcast', { event }, (payload) => callback(payload.payload))
    .subscribe();
  return channel;
}

export function broadcast(channel, event, payload) {
  channel.send({ type: 'broadcast', event, payload });
}

export function removeChannel(channel) {
  supabase.removeChannel(channel);
}
