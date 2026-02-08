/**
 * Gemini Image Generation Client
 * 
 * Uses Google's Gemini API for image generation.
 * Fallback when NanoBanana credits are exhausted.
 * 
 * Requires GOOGLE_AI_STUDIO_KEY or GOOGLE_GENERATIVE_AI_API_KEY in env.
 */

const GOOGLE_API_KEY = process.env.GOOGLE_AI_STUDIO_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    undefined;

export function isGeminiImageConfigured(): boolean {
    return Boolean(GOOGLE_API_KEY);
}

export interface GeminiImageOptions {
    prompt: string;
}

export interface GeminiImageResult {
    url: string;
}

/**
 * Generate an image using Gemini's native image generation.
 * Uses gemini-2.0-flash-exp with image output capability.
 */
export async function generateImageWithGemini(
    options: GeminiImageOptions
): Promise<GeminiImageResult> {
    if (!GOOGLE_API_KEY) {
        throw new Error('Google AI API key is not configured');
    }

    const model = 'gemini-2.0-flash-exp-image-generation';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: options.prompt,
                            },
                        ],
                    },
                ],
                generationConfig: {
                    responseModalities: ['TEXT', 'IMAGE'],
                },
            }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            console.error('[Gemini Image] API error:', response.status, error);
            throw new Error(error?.error?.message || `Gemini API error: ${response.status}`);
        }

        const data = await response.json();

        // Extract image from response
        const candidates = data.candidates || [];
        for (const candidate of candidates) {
            const parts = candidate.content?.parts || [];
            for (const part of parts) {
                if (part.inlineData?.mimeType?.startsWith('image/')) {
                    // Convert base64 to data URL
                    const mimeType = part.inlineData.mimeType;
                    const base64Data = part.inlineData.data;
                    const dataUrl = `data:${mimeType};base64,${base64Data}`;
                    return { url: dataUrl };
                }
            }
        }

        console.error('[Gemini Image] No image in response:', JSON.stringify(data).slice(0, 500));
        throw new Error('No image generated in Gemini response');
    } catch (error: any) {
        console.error('[Gemini Image] Generation failed:', error?.message);
        throw error;
    }
}

/**
 * Build a prompt for realistic human headshot photo.
 */
export function buildGeminiAvatarPrompt(
    name?: string,
    context?: string | null
): string {
    const base = [
        'Professional headshot photograph of a real human person',
        'ultra-realistic photo style',
        'natural lighting',
        'genuine facial features with realistic skin texture',
        'authentic human expression',
        'head and shoulders framing',
        'soft neutral background',
        'high resolution photograph',
        'NOT a cartoon or illustration',
        'real photography only',
    ].join(', ');

    const parts = [base];

    if (name?.trim()) {
        const seed = name.toLowerCase();
        const hash = seed.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        const ages = ['late 20s', 'early 30s', 'mid 30s', 'early 40s', 'mid 40s'];
        const age = ages[hash % ages.length];
        parts.push(`${age} professional`);
    }

    if (context?.trim()) {
        const safe = context.trim().slice(0, 100).replace(/[^\w\s,.-]/g, '');
        if (safe) {
            parts.push(`who works in: ${safe}`);
        }
    }

    return parts.join(', ');
}
