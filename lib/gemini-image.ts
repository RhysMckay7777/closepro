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
 * Build a prompt for realistic human headshot photo.
 * CRITICAL: Must produce a real photograph, never a cartoon/illustration.
 */
export function buildGeminiAvatarPrompt(
    name?: string,
    context?: string | null,
    gender?: 'male' | 'female' | 'any' | null
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

    if (gender === 'male') {
        parts.push('The person is male.');
    } else if (gender === 'female') {
        parts.push('The person is female.');
    }

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
