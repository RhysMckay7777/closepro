/**
 * Resolve prospect avatar URL: use stored human portrait if present, else null.
 * Returns null when no real image is available so the UI can show a proper placeholder.
 */
export function resolveProspectAvatarUrl(
  prospectId: string,
  name?: string,
  avatarUrl?: string | null
): string | null {
  if (avatarUrl && avatarUrl.trim()) return avatarUrl;
  return null;
}

/**
 * Get initials from a prospect name (e.g. "Michael Johnson" → "MJ")
 */
export function getProspectInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0]?.toUpperCase() || '')
    .slice(0, 2)
    .join('');
}

/**
 * Get a deterministic accent color for a prospect based on their name.
 * Returns a CSS gradient class for the placeholder background.
 */
export function getProspectPlaceholderColor(name: string): string {
  const colors = [
    'from-emerald-400 to-teal-500',
    'from-blue-400 to-indigo-500',
    'from-violet-400 to-purple-500',
    'from-rose-400 to-pink-500',
    'from-amber-400 to-orange-500',
    'from-cyan-400 to-sky-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash = hash & hash;
  }
  return colors[Math.abs(hash) % colors.length];
}
