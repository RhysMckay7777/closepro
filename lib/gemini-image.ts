/**
 * Gemini Image Generation Client
 * 
 * Uses Google AI Studio (Gemini) API for photorealistic image generation.
 * Images are uploaded to Vercel Blob storage for proper URLs.
 * 
 * Requires GOOGLE_AI_STUDIO_KEY or GOOGLE_GENERATIVE_AI_API_KEY in env.
 * Requires BLOB_READ_WRITE_TOKEN in env for Vercel Blob uploads.
 */

import { put } from '@vercel/blob';

const GOOGLE_API_KEY = process.env.GOOGLE_AI_STUDIO_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    undefined;

export function isGeminiImageConfigured(): boolean {
    const configured = Boolean(GOOGLE_API_KEY);
    console.log(`[Gemini Image] isGeminiImageConfigured() = ${configured} (GOOGLE_AI_STUDIO_KEY=${GOOGLE_API_KEY ? 'SET' : 'NOT SET'}, GOOGLE_GENERATIVE_AI_API_KEY=${process.env.GOOGLE_GENERATIVE_AI_API_KEY ? 'SET' : 'NOT SET'})`);
    return configured;
}

export interface GeminiImageOptions {
    prompt: string;
}

export interface GeminiImageResult {
    url: string;
}

/**
 * Generate an image using Gemini's native image generation.
 * Uploads result to Vercel Blob for a proper URL (not base64 data URL).
 */
export async function generateImageWithGemini(
    options: GeminiImageOptions
): Promise<GeminiImageResult> {
    console.log('[Gemini Image] generateImageWithGemini() called');
    console.log('[Gemini Image] API key present:', Boolean(GOOGLE_API_KEY));
    console.log('[Gemini Image] Prompt (first 200 chars):', options.prompt.slice(0, 200));

    if (!GOOGLE_API_KEY) {
        console.error('[Gemini Image] ERROR: No Google AI API key configured!');
        throw new Error('Google AI API key is not configured');
    }

    const model = 'gemini-2.5-flash-image';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`;
    console.log(`[Gemini Image] Using model: ${model}`);
    console.log(`[Gemini Image] API URL: https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`);

    try {
        console.log('[Gemini Image] Sending request to Gemini API...');
        const startTime = Date.now();

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

        const elapsed = Date.now() - startTime;
        console.log(`[Gemini Image] Response received in ${elapsed}ms, status: ${response.status}`);

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[Gemini Image] API error ${response.status}:`, errorBody.slice(0, 1000));
            throw new Error(`Gemini API error ${response.status}: ${errorBody.slice(0, 200)}`);
        }

        const data = await response.json();
        console.log('[Gemini Image] Response parsed. Candidates count:', data.candidates?.length || 0);

        // Extract image from response
        const candidates = data.candidates || [];
        for (const candidate of candidates) {
            const parts = candidate.content?.parts || [];
            console.log('[Gemini Image] Parts in candidate:', parts.length);
            for (const part of parts) {
                if (part.text) {
                    console.log('[Gemini Image] Text part:', part.text.slice(0, 200));
                }
                if (part.inlineData?.mimeType?.startsWith('image/')) {
                    const mimeType = part.inlineData.mimeType;
                    const base64Data = part.inlineData.data;
                    console.log(`[Gemini Image] Image found! MIME: ${mimeType}, base64 length: ${base64Data.length}`);

                    // Upload to Vercel Blob for a proper URL
                    try {
                        const buffer = Buffer.from(base64Data, 'base64');
                        const ext = mimeType === 'image/png' ? 'png' : 'jpg';
                        const filename = `prospect-avatars/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

                        console.log(`[Gemini Image] Uploading to Vercel Blob as: ${filename} (${buffer.length} bytes)`);
                        const blob = await put(filename, buffer, {
                            access: 'public',
                            contentType: mimeType,
                        });
                        console.log(`[Gemini Image] Blob upload success! URL: ${blob.url}`);
                        return { url: blob.url };
                    } catch (blobErr: any) {
                        console.error('[Gemini Image] Vercel Blob upload failed:', blobErr?.message);
                        console.log('[Gemini Image] Falling back to base64 data URL');
                        // Fall back to data URL if blob upload fails
                        const dataUrl = `data:${mimeType};base64,${base64Data}`;
                        return { url: dataUrl };
                    }
                }
            }
        }

        console.error('[Gemini Image] No image in response. Full response (first 500 chars):', JSON.stringify(data).slice(0, 500));
        throw new Error('No image generated in Gemini response');
    } catch (error: any) {
        console.error('[Gemini Image] Generation failed:', error?.message);
        console.error('[Gemini Image] Stack:', error?.stack?.slice(0, 500));
        throw error;
    }
}

/**
 * Build a prompt for a photorealistic avatar (~95% realism).
 * Plain colored background, head+shoulders or mid-chest framing.
 * Context-conditioned: uses offer type + prospect context + archetype for wardrobe/vibe.
 * Does NOT inject raw context text to avoid offer names rendering visually.
 */
export function buildGeminiAvatarPrompt(
    name?: string,
    context?: string | null,
    gender?: 'male' | 'female' | 'any' | null,
    offerCategory?: string | null,
    age?: string | null,
    occupation?: string | null
): string {
    const parts: string[] = [
        'Generate a portrait photograph of a person — 95% photorealistic.',
        'The person must look like a REAL human being with natural skin texture, pores, and imperfections. NOT a digital painting, NOT smooth/airbrushed skin.',
        'This should be indistinguishable from a real photograph. Natural lighting, real skin, natural hair, subtle asymmetry.',
        'Head and shoulders framing, or mid-chest crop.',
        'Plain solid colored background — pick a muted, professional tone (slate, warm gray, soft blue, or sage green).',
        'Do NOT generate any cartoon, anime, illustration, sketch, CGI, or 3D render.',
        'Do NOT include any text, words, letters, watermarks, labels, or captions anywhere in the image. The image must contain ONLY the person against a plain solid color background.',
    ];

    if (gender === 'male') {
        parts.push('The person is male.');
    } else if (gender === 'female') {
        parts.push('The person is female.');
    }

    if (age) {
        parts.push(`The person is ${age} years old.`);
    } else if (name?.trim()) {
        const seed = name.toLowerCase();
        const hash = seed.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        const ages = ['late 20s', 'early 30s', 'mid 30s', 'early 40s', 'mid 40s'];
        const inferredAge = ages[hash % ages.length];
        parts.push(`The person appears to be in their ${inferredAge}.`);
    }

    if (occupation) {
        parts.push(`They work as a ${occupation}.`);
    }

    // Context-conditioned wardrobe/vibe from offer category + prospect context
    // Only use category/context for wardrobe keywords — never inject raw text
    const cat = (offerCategory || '').toLowerCase();
    const ctx = (context || '').toLowerCase();

    if (cat.includes('fitness') || cat.includes('health') || ctx.includes('gym') || ctx.includes('fitness')) {
        parts.push('Wearing casual athletic or activewear. Healthy, energetic appearance.');
    } else if (cat.includes('real_estate') || cat.includes('property') || ctx.includes('property')) {
        parts.push('Wearing smart casual attire. Confident, approachable look.');
    } else if (cat.includes('trades') || cat.includes('construction') || ctx.includes('electrician') || ctx.includes('plumb')) {
        parts.push('Wearing practical work attire or clean casual clothes. Down-to-earth appearance.');
    } else if (cat.includes('tech') || cat.includes('saas') || cat.includes('software')) {
        parts.push('Wearing a clean t-shirt or casual button-down. Modern, tech-savvy appearance.');
    } else if (cat.includes('creative') || cat.includes('design') || cat.includes('marketing')) {
        parts.push('Wearing casual creative attire. Expressive, modern style.');
    } else {
        parts.push('Wearing smart casual clothes. Natural, approachable expression.');
    }

    // NOTE: Raw context text is intentionally NOT injected into the prompt.
    // Previously `Context about the person: ${safe}` caused offer names and
    // descriptive text (e.g. "Mixed Wealth Closing Mastery") to render
    // visually on the generated image. Demographic/appearance conditioning
    // is handled above via category keyword matching.

    return parts.join(' ');
}
