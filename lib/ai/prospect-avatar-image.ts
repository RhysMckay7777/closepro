/**
 * Prospect Avatar Image Generation Abstraction
 * 
 * Generates consistent, realistic avatar images for prospect characters.
 * Uses deterministic seeding so the same prospect always gets the same image.
 * 
 * Current implementation: DiceBear avatars (placeholder)
 * Future: Can plug in DALL-E, Midjourney, Replicate, or custom avatar API
 */

export interface ProspectImageParams {
    name: string;
    gender?: 'male' | 'female' | 'neutral';
    ageRange?: 'young' | 'middle' | 'senior';
    style?: 'professional' | 'casual' | 'executive';
}

/**
 * Simple hash function for consistent seeding
 */
function hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
}

/**
 * Infer gender from name using common name patterns
 * Returns 'neutral' if uncertain
 */
function inferGender(name: string): 'male' | 'female' | 'neutral' {
    const firstName = name.split(' ')[0]?.toLowerCase() || '';

    const femaleNames = new Set([
        'maria', 'sarah', 'jessica', 'jennifer', 'lisa', 'amanda', 'ashley',
        'emily', 'emma', 'olivia', 'ava', 'sophia', 'isabella', 'mia', 'charlotte',
        'amelia', 'harper', 'evelyn', 'abigail', 'ella', 'elizabeth', 'camila',
        'luna', 'sofia', 'avery', 'scarlett', 'victoria', 'madison', 'grace',
    ]);

    const maleNames = new Set([
        'james', 'john', 'robert', 'michael', 'david', 'william', 'richard',
        'joseph', 'thomas', 'charles', 'christopher', 'daniel', 'matthew', 'anthony',
        'mark', 'donald', 'steven', 'paul', 'andrew', 'joshua', 'kenneth', 'kevin',
        'brian', 'george', 'timothy', 'ronald', 'edward', 'jason', 'jeffrey', 'ryan',
    ]);

    if (femaleNames.has(firstName)) return 'female';
    if (maleNames.has(firstName)) return 'male';
    return 'neutral';
}

/**
 * Generate a realistic avatar URL for a prospect
 * Uses DiceBear with consistent seeding based on name
 * 
 * @param params - Prospect image parameters
 * @returns URL string for the avatar image
 */
export function generateProspectImageUrl(params: ProspectImageParams): string {
    const { name, style = 'professional' } = params;
    const gender = params.gender || inferGender(name);

    // Create consistent seed from name
    const seed = hashString(name.toLowerCase().trim());

    // Use DiceBear's "notionists" or "lorelei" style for realistic-looking avatars
    // These are more professional than cartoon styles
    const diceBearStyle = style === 'executive' ? 'notionists' : 'lorelei';

    // Build URL with gender-appropriate options
    const baseUrl = `https://api.dicebear.com/7.x/${diceBearStyle}/svg`;
    const urlParams = new URLSearchParams({
        seed,
        backgroundColor: 'b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf',
        backgroundType: 'gradientLinear',
    });

    // Add gender-specific styling if not neutral
    if (gender === 'female') {
        urlParams.set('flip', 'false');
    } else if (gender === 'male') {
        urlParams.set('flip', 'true');
    }

    return `${baseUrl}?${urlParams.toString()}`;
}

/**
 * Generate a more realistic photo-style avatar using UI Avatars
 * This provides initials-based avatars with professional styling
 * 
 * @param name - Prospect name
 * @param style - Visual style
 * @returns URL string for the avatar image
 */
export function generateProspectInitialsUrl(name: string, style: 'professional' | 'casual' = 'professional'): string {
    const seed = hashString(name.toLowerCase().trim());

    // Professional color palette
    const professionalColors = ['0D9488', '0891B2', '6366F1', '8B5CF6', 'EC4899'];
    const casualColors = ['F59E0B', '10B981', '3B82F6', 'EF4444', '8B5CF6'];

    const colors = style === 'professional' ? professionalColors : casualColors;
    const colorIndex = parseInt(seed, 16) % colors.length;
    const bgColor = colors[colorIndex];

    const initials = name
        .split(' ')
        .map(part => part[0]?.toUpperCase() || '')
        .slice(0, 2)
        .join('');

    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${bgColor}&color=fff&size=256&font-size=0.4&bold=true`;
}

/**
 * Main function to get prospect avatar image
 * Tries realistic avatar first, falls back to initials
 * 
 * @param params - Prospect image parameters
 * @returns URL string for the avatar
 */
export function getProspectAvatarImage(params: ProspectImageParams): string {
    // Use DiceBear for a more illustrated but professional look
    return generateProspectImageUrl(params);
}

/**
 * Provider interface for future image generation integrations
 * (DALL-E, Midjourney, Replicate, etc.)
 */
export interface ImageGenerationProvider {
    name: string;
    generateImage(prompt: string, options?: Record<string, unknown>): Promise<string>;
    isConfigured(): boolean;
}

/**
 * Placeholder for AI-generated realistic images
 * To be implemented when provider is configured
 */
export async function generateRealisticProspectImage(
    params: ProspectImageParams & { bio?: string }
): Promise<string> {
    // TODO: Implement when AI image provider is configured
    // For now, return deterministic avatar
    return getProspectAvatarImage(params);
}

/**
 * Check if a realistic image provider is configured
 */
export function isRealisticImageProviderConfigured(): boolean {
    // Check for common image generation API keys
    return !!(
        process.env.OPENAI_API_KEY || // DALL-E
        process.env.REPLICATE_API_TOKEN || // Replicate (Stable Diffusion, etc.)
        process.env.MIDJOURNEY_API_KEY // Midjourney (if available)
    );
}
