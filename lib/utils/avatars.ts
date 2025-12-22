// Lista de emojis para avatares de jugadores
const AVATAR_EMOJIS = [
  "🦊",
  "🐻",
  "🐼",
  "🐨",
  "🐯",
  "🦁",
  "🐮",
  "🐷",
  "🐸",
  "🐵",
  "🐔",
  "🐧",
  "🐦",
  "🐤",
  "🦆",
  "🦅",
  "🦉",
  "🦇",
  "🐺",
  "🐗",
  "🐴",
  "🦄",
  "🐝",
  "🦋",
  "🐌",
  "🐛",
  "🐙",
  "🦑",
  "🦐",
  "🦞",
  "🦀",
  "🐡",
  "🐠",
  "🐟",
  "🐬",
  "🐳",
  "🦈",
  "🐊",
  "🐆",
  "🦒",
  "🦘",
  "🦬",
  "🐃",
  "🐂",
  "🐄",
  "🦌",
  "🐕",
  "🐩",
  "🦮",
  "🐈",
  "🦤",
  "🦩",
  "🦚",
  "🦜",
  "🦢",
  "🦫",
  "🦭",
  "🐲",
  "🦖",
  "🦕",
];

// Colores de fondo para avatares
const AVATAR_COLORS = [
  "bg-red-100 dark:bg-red-900/30",
  "bg-orange-100 dark:bg-orange-900/30",
  "bg-amber-100 dark:bg-amber-900/30",
  "bg-yellow-100 dark:bg-yellow-900/30",
  "bg-lime-100 dark:bg-lime-900/30",
  "bg-green-100 dark:bg-green-900/30",
  "bg-emerald-100 dark:bg-emerald-900/30",
  "bg-teal-100 dark:bg-teal-900/30",
  "bg-cyan-100 dark:bg-cyan-900/30",
  "bg-sky-100 dark:bg-sky-900/30",
  "bg-blue-100 dark:bg-blue-900/30",
  "bg-indigo-100 dark:bg-indigo-900/30",
  "bg-violet-100 dark:bg-violet-900/30",
  "bg-purple-100 dark:bg-purple-900/30",
  "bg-fuchsia-100 dark:bg-fuchsia-900/30",
  "bg-pink-100 dark:bg-pink-900/30",
  "bg-rose-100 dark:bg-rose-900/30",
];

// Genera un número hash basado en un string
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Obtiene un avatar (emoji) consistente basado en userId
export function getAvatarEmoji(userId: string): string {
  const hash = hashString(userId);
  return AVATAR_EMOJIS[hash % AVATAR_EMOJIS.length];
}

// Obtiene un color de fondo consistente basado en userId
export function getAvatarColor(userId: string): string {
  const hash = hashString(userId + "color");
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

// Obtiene tanto el emoji como el color
export function getAvatar(userId: string): { emoji: string; color: string } {
  return {
    emoji: getAvatarEmoji(userId),
    color: getAvatarColor(userId),
  };
}
