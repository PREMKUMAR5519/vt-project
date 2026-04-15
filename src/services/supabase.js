import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase credentials not found. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

// ── Auth helpers ──

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  return { data, error };
}

export async function signInWithEmail(email) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

// ── User helpers ──

export async function upsertUser(profile) {
  const { data, error } = await supabase
    .from('users')
    .upsert(profile, { onConflict: 'id' })
    .select()
    .single();
  return { data, error };
}

export async function getUser(id) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();
  return { data, error };
}

// ── Interests ──

export async function getAllInterests() {
  const { data } = await supabase.from('interests').select('*').order('name');
  return data || [];
}

export async function setUserInterests(userId, interestIds) {
  await supabase.from('user_interests').delete().eq('user_id', userId);
  if (interestIds.length === 0) return;
  const rows = interestIds.map((id) => ({ user_id: userId, interest_id: id }));
  await supabase.from('user_interests').insert(rows);
}

export async function getUserInterests(userId) {
  const { data } = await supabase
    .from('user_interests')
    .select('interest_id, interests(name)')
    .eq('user_id', userId);
  return data || [];
}

// ── Matching ──

/**
 * Join the match queue. Inserts a row with status='waiting'.
 */
export async function joinQueue(userId, userName, interests = []) {
  // Delete any stale entry first
  await supabase.from('match_queue').delete().eq('user_id', userId);

  const { data, error } = await supabase
    .from('match_queue')
    .insert({
      user_id: userId,
      user_name: userName,
      interests,
      status: 'waiting',
      matched_with: null,
      match_id: null,
    })
    .select()
    .single();

  if (error) console.error('joinQueue error:', error);
  return { data, error };
}

export async function leaveQueue(userId) {
  await supabase.from('match_queue').delete().eq('user_id', userId);
}

/**
 * Check if my own queue entry was updated to 'matched' by someone else.
 * Returns the queue row if matched, null if still waiting.
 */
export async function checkMyQueueStatus(userId) {
  const { data } = await supabase
    .from('match_queue')
    .select('*')
    .eq('user_id', userId)
    .single();
  return data;
}

/**
 * Find another user in the queue who is waiting.
 * Returns their queue row or null.
 */
export async function findWaitingUser(userId) {
  const { data } = await supabase
    .from('match_queue')
    .select('*')
    .eq('status', 'waiting')
    .neq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1);
  return data?.[0] || null;
}

/**
 * Claim a match: create the match row, then update BOTH queue entries to 'matched'.
 * Uses the candidate's status check to avoid race conditions.
 */
export async function claimMatch(myUserId, candidateUserId) {
  // Double-check the candidate is still waiting
  const { data: check } = await supabase
    .from('match_queue')
    .select('status')
    .eq('user_id', candidateUserId)
    .eq('status', 'waiting')
    .single();

  if (!check) {
    // Someone else already claimed them
    return { match: null };
  }

  // Create the match
  const { data: match, error: matchErr } = await supabase
    .from('matches')
    .insert({ user1_id: myUserId, user2_id: candidateUserId })
    .select()
    .single();

  if (matchErr || !match) {
    console.error('Failed to create match:', matchErr);
    return { match: null };
  }

  // Update candidate's queue entry → 'matched'
  await supabase
    .from('match_queue')
    .update({ status: 'matched', matched_with: myUserId, match_id: match.id })
    .eq('user_id', candidateUserId)
    .eq('status', 'waiting');

  // Update my queue entry → 'matched'
  await supabase
    .from('match_queue')
    .update({ status: 'matched', matched_with: candidateUserId, match_id: match.id })
    .eq('user_id', myUserId);

  return { match };
}

export async function getMatch(matchId) {
  const { data } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single();
  return data;
}

// ── Messages ──

export async function sendMessage(matchId, senderId, content) {
  const { data, error } = await supabase
    .from('messages')
    .insert({ match_id: matchId, sender_id: senderId, content })
    .select()
    .single();
  return { data, error };
}

export async function getMessages(matchId) {
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true });
  return data || [];
}

export function subscribeToMessages(matchId, callback) {
  return supabase
    .channel(`messages:${matchId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
      (payload) => callback(payload.new)
    )
    .subscribe();
}

// ── Friends ──

export async function sendFriendRequest(userId, friendId) {
  const { data, error } = await supabase
    .from('friends')
    .insert({ user_id: userId, friend_id: friendId, status: 'pending' })
    .select()
    .single();
  return { data, error };
}

export async function respondFriendRequest(id, status) {
  const { data, error } = await supabase
    .from('friends')
    .update({ status })
    .eq('id', id)
    .select()
    .single();
  return { data, error };
}

export async function getFriends(userId) {
  const { data } = await supabase
    .from('friends')
    .select('*, user:users!friends_user_id_fkey(*), friend:users!friends_friend_id_fkey(*)')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
    .eq('status', 'accepted');
  return data || [];
}

export async function getPendingRequests(userId) {
  const { data } = await supabase
    .from('friends')
    .select('*, user:users!friends_user_id_fkey(*)')
    .eq('friend_id', userId)
    .eq('status', 'pending');
  return data || [];
}

// ── Blocks ──

export async function blockUser(blockerId, blockedId) {
  const { error } = await supabase
    .from('blocks')
    .insert({ blocker_id: blockerId, blocked_id: blockedId });
  return { error };
}

export async function unblockUser(blockerId, blockedId) {
  await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId);
}

export async function getBlockedUsers(userId) {
  const { data } = await supabase
    .from('blocks')
    .select('blocked_id')
    .eq('blocker_id', userId);
  return (data || []).map((b) => b.blocked_id);
}

export async function isBlocked(user1, user2) {
  const { data } = await supabase
    .from('blocks')
    .select('id')
    .or(`and(blocker_id.eq.${user1},blocked_id.eq.${user2}),and(blocker_id.eq.${user2},blocked_id.eq.${user1})`)
    .limit(1);
  return (data || []).length > 0;
}
