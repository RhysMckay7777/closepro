/**
 * Resolve prospect avatar URL: use stored human portrait if present,
 * fall back to a static randomuser.me portrait based on name hash,
 * or return null as a last resort.
 * IMPORTANT: Filters out cartoon/illustration URLs (DiceBear, UI Avatars, etc.)
 * so old prospects with cartoon avatars stored in DB will fall back to realistic photos.
 */

// URLs matching these patterns are cartoon/illustration generators — reject them
const CARTOON_URL_PATTERNS = [
  'api.dicebear.com',
  'dicebear.com',
  'avatars.dicebear.com',
  'ui-avatars.com',
  'robohash.org',
  'avatar.iran.liara.run',
  'pravatar.cc',
  'boringavatars.com',
  'multiavatar.com',
];

// Common female first names for gender inference
const FEMALE_FIRST_NAMES = new Set([
  'maria', 'sarah', 'emma', 'rachel', 'sophie', 'jessica', 'laura', 'hannah',
  'charlotte', 'olivia', 'nicole', 'katie', 'amy', 'lisa', 'jennifer', 'emily',
  'amanda', 'megan', 'ashley', 'brooke', 'hayley', 'lauren', 'bella', 'anna',
  'natasha', 'rebecca', 'victoria', 'samantha', 'katherine', 'catherine',
]);

// Static fallback portrait IDs (randomuser.me)
const MALE_PORTRAIT_IDS = [32, 45, 67, 22, 55, 78, 11, 36];
const FEMALE_PORTRAIT_IDS = [44, 68, 33, 55, 12, 72, 26, 81];

/**
 * Hash a string to a consistent positive integer.
 */
function nameHash(name: string): number {
  let hash = 0;
  const s = name.toLowerCase().trim();
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Infer gender from a prospect's first name.
 */
function inferGender(name?: string): 'male' | 'female' {
  if (!name) return 'male';
  const firstName = name.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  return FEMALE_FIRST_NAMES.has(firstName) ? 'female' : 'male';
}

/**
 * Get a deterministic static fallback portrait URL from randomuser.me.
 */
function getStaticFallbackUrl(name?: string): string {
  const gender = inferGender(name);
  const hash = nameHash(name || 'default');
  const ids = gender === 'female' ? FEMALE_PORTRAIT_IDS : MALE_PORTRAIT_IDS;
  const portraitId = ids[hash % ids.length];
  const folder = gender === 'female' ? 'women' : 'men';
  return `https://randomuser.me/api/portraits/${folder}/${portraitId}.jpg`;
}

export function resolveProspectAvatarUrl(
  prospectId: string,
  name?: string,
  avatarUrl?: string | null
): string | null {
  if (!avatarUrl || !avatarUrl.trim()) {
    // No stored URL — return a static fallback portrait
    return getStaticFallbackUrl(name);
  }

  // Reject any URL from cartoon/illustration avatar services
  const lower = avatarUrl.toLowerCase();
  for (const pattern of CARTOON_URL_PATTERNS) {
    if (lower.includes(pattern)) {
      return getStaticFallbackUrl(name); // Return photo fallback instead of null
    }
  }

  return avatarUrl;
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
  const hash = nameHash(name);
  return colors[hash % colors.length];
}

