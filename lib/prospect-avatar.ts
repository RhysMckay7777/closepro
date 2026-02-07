/**
 * Deterministic avatar URL for prospects (no DB field required).
 * Uses DiceBear 'notionists' style for a more professional look.
 * Falls back to this only when NanoBanana human portrait not available.
 */
export function getProspectAvatarUrl(prospectId: string, name?: string): string {
  const seed = name ? `${prospectId}-${name}` : prospectId;
  const encoded = encodeURIComponent(seed);
  // Use notionists style for professional, non-cartoon appearance
  return `https://api.dicebear.com/7.x/notionists/svg?seed=${encoded}&size=128&backgroundColor=b6e3f4,c0aede,d1d4f9`;
}

/**
 * Resolve prospect avatar URL: use stored human portrait (e.g. NanoBanana) if present, else DiceBear.
 */
export function resolveProspectAvatarUrl(
  prospectId: string,
  name?: string,
  avatarUrl?: string | null
): string {
  if (avatarUrl && avatarUrl.trim()) return avatarUrl;
  return getProspectAvatarUrl(prospectId, name);
}
