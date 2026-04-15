export function generateGuestName() {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `Guest_${num}`;
}

export function generateId() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function formatTime(dateString) {
  const d = new Date(dateString);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(dateString) {
  const d = new Date(dateString);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString();
}

export function getAvatarUrl(name) {
  return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=7c3aed`;
}

export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export const INTERESTS_LIST = [
  'Music', 'Gaming', 'Movies', 'Sports', 'Technology',
  'Art', 'Travel', 'Cooking', 'Reading', 'Fitness',
  'Photography', 'Anime', 'Science', 'Fashion', 'Nature',
  'Comedy', 'Dance', 'Coding', 'Pets', 'Philosophy',
];

export const EMOJI_LIST = [
  '😀', '😂', '🥰', '😎', '🤔', '😢', '😡', '🤯',
  '👍', '👎', '❤️', '🔥', '💯', '🎉', '👋', '🙏',
  '😴', '🤝', '✨', '💀', '🥳', '😈', '🤗', '😤',
];
