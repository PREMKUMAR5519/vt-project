import { createContext, useContext, useState, useEffect } from 'react';
import { supabase, upsertUser, signOut as supabaseSignOut } from '../services/supabase';
import { generateGuestName, getAvatarUrl } from '../utils/helpers';

const AuthContext = createContext(null);
const GUEST_STORAGE_KEY = 'vibetogether_guest_user';

function loadGuestUser() {
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveGuestUser(user) {
  localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(user));
}

function clearGuestUser() {
  localStorage.removeItem(GUEST_STORAGE_KEY);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        handleAuthUser(session.user);
      } else {
        const guestUser = loadGuestUser();
        if (guestUser) {
          setUser(guestUser);
        }
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        handleAuthUser(session.user);
      } else {
        const guestUser = loadGuestUser();
        if (guestUser) {
          setUser(guestUser);
        } else {
          clearGuestUser();
          setUser(null);
        }
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleAuthUser(authUser) {
    const profile = {
      id: authUser.id,
      name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
      email: authUser.email,
      avatar_url: authUser.user_metadata?.avatar_url || getAvatarUrl(authUser.email),
      is_guest: false,
    };
    const { data } = await upsertUser(profile);
    setUser(data || profile);
    setLoading(false);
  }

  async function loginAsGuest() {
    const name = generateGuestName();
    const guestProfile = {
      name,
      email: null,
      avatar_url: getAvatarUrl(name),
      is_guest: true,
    };

    // Insert guest into Supabase DB so they get a real UUID
    // This is required for match_queue and other tables to work
    const { data, error } = await supabase
      .from('users')
      .insert(guestProfile)
      .select()
      .single();

    if (error) {
      console.error('Failed to create guest in DB:', error);
      // Fallback: local-only guest (DB matching won't work)
      const localGuest = { ...guestProfile, id: crypto.randomUUID(), _localOnly: true };
      saveGuestUser(localGuest);
      setUser(localGuest);
    } else {
      console.log('Guest created in DB:', data.id);
      saveGuestUser(data);
      setUser(data);
    }
  }

  async function logout() {
    clearGuestUser();
    if (user && !user.is_guest) {
      await supabaseSignOut();
    }
    setUser(null);
  }

  function updateUser(updates) {
    setUser((prev) => (prev ? { ...prev, ...updates } : prev));
  }

  return (
    <AuthContext.Provider value={{ user, loading, loginAsGuest, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
