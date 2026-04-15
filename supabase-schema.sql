-- ============================================
-- VibeTogether — Supabase Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- IMPORTANT: Drop old tables if re-running (comment out if you want to keep data)
DROP TABLE IF EXISTS blocks CASCADE;
DROP TABLE IF EXISTS friends CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS match_queue CASCADE;
DROP TABLE IF EXISTS user_interests CASCADE;
DROP TABLE IF EXISTS interests CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  is_guest BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Interests
CREATE TABLE interests (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

INSERT INTO interests (name) VALUES
  ('Music'), ('Gaming'), ('Movies'), ('Sports'), ('Technology'),
  ('Art'), ('Travel'), ('Cooking'), ('Reading'), ('Fitness'),
  ('Photography'), ('Anime'), ('Science'), ('Fashion'), ('Nature'),
  ('Comedy'), ('Dance'), ('Coding'), ('Pets'), ('Philosophy');

-- User interests (many-to-many)
CREATE TABLE user_interests (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  interest_id INT REFERENCES interests(id) ON DELETE CASCADE,
  UNIQUE(user_id, interest_id)
);

-- Match queue — NO foreign key so guests can join freely
CREATE TABLE match_queue (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  user_name TEXT,
  interests TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'waiting',
  matched_with UUID,
  match_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Matches — NO foreign keys so guests work
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL,
  user2_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Friends
CREATE TABLE friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Blocks
CREATE TABLE blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

-- ============================================
-- Row Level Security (RLS)
-- Guest users use anon key with no auth.uid(),
-- so we must allow anon access for MVP tables.
-- ============================================

-- DISABLE RLS on tables that guests need access to.
-- For production, you'd use service-role or edge functions instead.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_interests ENABLE ROW LEVEL SECURITY;

-- Open policies for MVP (guests have no auth.uid)
-- Users
CREATE POLICY "users_select" ON users FOR SELECT USING (true);
CREATE POLICY "users_insert" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "users_update" ON users FOR UPDATE USING (true);

-- Match queue
CREATE POLICY "queue_select" ON match_queue FOR SELECT USING (true);
CREATE POLICY "queue_insert" ON match_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "queue_update" ON match_queue FOR UPDATE USING (true);
CREATE POLICY "queue_delete" ON match_queue FOR DELETE USING (true);

-- Matches
CREATE POLICY "matches_select" ON matches FOR SELECT USING (true);
CREATE POLICY "matches_insert" ON matches FOR INSERT WITH CHECK (true);

-- Messages
CREATE POLICY "messages_select" ON messages FOR SELECT USING (true);
CREATE POLICY "messages_insert" ON messages FOR INSERT WITH CHECK (true);

-- Friends
CREATE POLICY "friends_select" ON friends FOR SELECT USING (true);
CREATE POLICY "friends_insert" ON friends FOR INSERT WITH CHECK (true);
CREATE POLICY "friends_update" ON friends FOR UPDATE USING (true);

-- Blocks
CREATE POLICY "blocks_select" ON blocks FOR SELECT USING (true);
CREATE POLICY "blocks_insert" ON blocks FOR INSERT WITH CHECK (true);
CREATE POLICY "blocks_delete" ON blocks FOR DELETE USING (true);

-- Interests (read-only for everyone)
CREATE POLICY "interests_select" ON interests FOR SELECT USING (true);

-- User interests
CREATE POLICY "user_interests_select" ON user_interests FOR SELECT USING (true);
CREATE POLICY "user_interests_insert" ON user_interests FOR INSERT WITH CHECK (true);
CREATE POLICY "user_interests_delete" ON user_interests FOR DELETE USING (true);

-- ============================================
-- Enable Realtime on tables that need it
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE match_queue;

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX idx_messages_match ON messages(match_id);
CREATE INDEX idx_messages_created ON messages(created_at);
CREATE INDEX idx_friends_user ON friends(user_id);
CREATE INDEX idx_friends_friend ON friends(friend_id);
CREATE INDEX idx_blocks_blocker ON blocks(blocker_id);
CREATE INDEX idx_match_queue_status ON match_queue(status);
CREATE INDEX idx_match_queue_user ON match_queue(user_id);
