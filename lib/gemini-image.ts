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

    const model = 'gemini-3-pro-image-preview';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                systemInstruction: {
                    parts: [{
                        text: 'You are a professional portrait photographer. You ONLY produce ultra-realistic photographs of real human beings. You NEVER produce cartoons, illustrations, drawings, anime, sketches, CGI, 3D renders, vector art, or any non-photographic style. Every image you create must be indistinguishable from a real DSLR photograph.',
                    }],
                },
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
 * CRITICAL: Must produce a real photograph, never a cartoon/illustration.
 */
export function buildGeminiAvatarPrompt(
    name?: string,
    context?: string | null
): string {
    const parts = [
        'Generate a REAL photograph — a professional headshot photo taken with a DSLR camera.',
        'This must look like a genuine photograph of a real human being.',
        'Ultra-realistic photo with natural lighting, real skin texture with pores and imperfections, natural hair.',
        'Head and shoulders framing against a soft blurred bokeh background.',
        'Shot on Canon EOS R5, 85mm f/1.4 lens, shallow depth of field.',
        'Do NOT generate any cartoon, anime, illustration, drawing, sketch, CGI, 3D render, vector art, or any non-photographic style whatsoever.',
        'The output MUST be indistinguishable from a real photograph taken by a professional photographer.',
    ];

    if (name?.trim()) {
        const seed = name.toLowerCase();
        const hash = seed.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        const ages = ['late 20s', 'early 30s', 'mid 30s', 'early 40s', 'mid 40s'];
        const age = ages[hash % ages.length];
        parts.push(`The person is a ${age} professional.`);
    }

    if (context?.trim()) {
        const safe = context.trim().slice(0, 100).replace(/[^\w\s,.-]/g, '');
        if (safe) {
            parts.push(`They work in: ${safe}.`);
        }
    }

    return parts.join(' ');
}
