/**
 * NanoBanana API client for human-style portrait generation.
 * Used for prospect avatars when NANOBANANA_API_KEY is set.
 * Defaults to nanobananaapi.ai (free credits). Optional: set NANOBANANA_API_BASE_URL to https://api.nanobananaapi.dev for paid .dev API.
 * @see https://docs.nanobananaapi.ai/quickstart
 */

const NANOBANANA_API_KEY = process.env.NANOBANANA_API_KEY?.trim() || undefined;
// Default to .ai (free credits). Override with NANOBANANA_API_BASE_URL for .dev (e.g. https://api.nanobananaapi.dev).
const BASE_URL = (process.env.NANOBANANA_API_BASE_URL || 'https://api.nanobananaapi.ai').replace(/\/$/, '');
// API requires callBackUrl; we ignore it and poll record-info. Set NANOBANANA_CALLBACK_URL if you have a real webhook.
const CALLBACK_URL = process.env.NANOBANANA_CALLBACK_URL?.trim() || 'https://example.com/nanobanana-callback';

const IS_AI_API = BASE_URL.includes('nanobananaapi.ai');

export function isNanoBananaConfigured(): boolean {
  return Boolean(NANOBANANA_API_KEY);
}

export interface GenerateImageOptions {
  prompt: string;
  num?: number;
  model?: string;
  image_size?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '2:3' | '3:2';
}

export interface GenerateImageResult {
  url: string;
}

/** Poll interval for .ai task status (ms). */
const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 120000;

/**
 * Generate an image from a text prompt. Returns the image URL on success.
 * Uses nanobananaapi.ai by default (POST + poll for result). Requires NANOBANANA_API_KEY in env.
 */
export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResult> {
  if (!NANOBANANA_API_KEY) {
    throw new Error('NANOBANANA_API_KEY is not set');
  }

  if (IS_AI_API) {
    return generateImageAi(options);
  }
  return generateImageDev(options);
}

/** nanobananaapi.ai: POST /api/v1/nanobanana/generate then poll record-info for resultImageUrl. */
async function generateImageAi(options: GenerateImageOptions): Promise<GenerateImageResult> {
  const generateUrl = `${BASE_URL}/api/v1/nanobanana/generate`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  let res: Response;
  try {
    res = await fetch(generateUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${NANOBANANA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: options.prompt,
        type: 'TEXTTOIAMGE',
        numImages: options.num ?? 1,
        image_size: options.image_size ?? '1:1',
        callBackUrl: CALLBACK_URL,
      }),
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const cause = err instanceof Error ? err.cause ?? err.message : String(err);
    console.error('[NanoBanana .ai] fetch failed', generateUrl, cause);
    throw new Error(`NanoBanana request failed: ${cause}`);
  }
  clearTimeout(timeoutId);

  let data: {
    code?: number;
    msg?: string;
    data?: { taskId?: string };
  };
  try {
    data = (await res.json()) as typeof data;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[NanoBanana .ai] invalid JSON response', res.status, msg);
    throw new Error(`NanoBanana invalid response: ${msg}`);
  }

  if (!res.ok) {
    console.error('[NanoBanana .ai] API error', res.status, data);
    throw new Error(data.msg || `NanoBanana API error: ${res.status}`);
  }
  if (data.code !== 200) {
    console.error('[NanoBanana .ai] API returned error', data);
    throw new Error(data.msg || `NanoBanana error: ${data.code}`);
  }

  const taskId = data.data?.taskId;
  if (!taskId) {
    console.error('[NanoBanana .ai] No taskId in response:', JSON.stringify(data));
    throw new Error(data.msg || 'No taskId in response');
  }

  const url = await pollForImageUrlAi(taskId);
  return { url };
}

const POLL_RETRY_ATTEMPTS = 3;
const POLL_RETRY_DELAY_MS = 2000;

/** Extract first image URL from record-info response (API uses multiple shapes). */
function extractImageUrlFromRecordInfo(data: Record<string, unknown>): string | null {
  const response = data.response as Record<string, unknown> | undefined;
  if (response?.resultImageUrl && typeof response.resultImageUrl === 'string')
    return response.resultImageUrl as string;
  const urls = response?.result_urls;
  if (Array.isArray(urls) && urls[0] && typeof urls[0] === 'string') return urls[0];
  if (typeof urls === 'string') return urls;

  const info = (data.info ?? response?.info) as Record<string, unknown> | undefined;
  if (info?.resultImageUrl && typeof info.resultImageUrl === 'string')
    return info.resultImageUrl as string;

  const inner = data.data as Record<string, unknown> | undefined;
  const innerInfo = inner?.info as Record<string, unknown> | undefined;
  if (innerInfo?.resultImageUrl && typeof innerInfo.resultImageUrl === 'string')
    return innerInfo.resultImageUrl as string;

  const resultUrls = data.result_urls;
  if (Array.isArray(resultUrls) && resultUrls[0] && typeof resultUrls[0] === 'string')
    return resultUrls[0];
  if (typeof resultUrls === 'string') return resultUrls;

  return null;
}

/** Poll record-info until success (successFlag 1) or failure (2/3); return resultImageUrl. */
async function pollForImageUrlAi(taskId: string): Promise<string> {
  await new Promise((r) => setTimeout(r, 2000)); // give server time to create task
  const start = Date.now();
  const recordUrl = `${BASE_URL}/api/v1/nanobanana/record-info`;
  const fullUrl = `${recordUrl}?taskId=${encodeURIComponent(taskId)}`;
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    let res: Response | null = null;
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < POLL_RETRY_ATTEMPTS; attempt++) {
      try {
        res = await fetch(fullUrl, {
          method: 'GET',
          headers: { Authorization: `Bearer ${NANOBANANA_API_KEY}` },
        });
        break;
      } catch (err: unknown) {
        lastErr = err;
        const isRetryable =
          String(err).includes('closed') ||
          String(err).includes('ECONNRESET') ||
          String(err).includes('ETIMEDOUT') ||
          String(err).includes('SocketError');
        if (attempt < POLL_RETRY_ATTEMPTS - 1 && isRetryable) {
          await new Promise((r) => setTimeout(r, POLL_RETRY_DELAY_MS));
          continue;
        }
        const cause = err instanceof Error ? err.cause ?? err.message : String(err);
        console.error('[NanoBanana .ai] poll fetch failed', recordUrl, cause);
        throw new Error(`NanoBanana poll failed: ${cause}`);
      }
    }
    if (!res) {
      const cause = lastErr instanceof Error ? lastErr.message : String(lastErr);
      throw new Error(`NanoBanana poll failed: ${cause}`);
    }
    const raw = (await res.json()) as Record<string, unknown>;

    if (!res.ok) {
      const errMsg = (raw as { errorMessage?: string }).errorMessage;
      console.error('[NanoBanana .ai] record-info error', res.status, raw);
      throw new Error(errMsg || `record-info error: ${res.status}`);
    }

    // record-info returns { code, msg, data: { taskId, successFlag, response, ... } }; successFlag is inside data
    const data = (raw.data ?? raw) as Record<string, unknown>;
    const flag = data.successFlag as number | undefined;
    if (flag === 2 || flag === 3) {
      throw new Error((data.errorMessage as string) || (raw.errorMessage as string) || 'Image generation failed');
    }
    if (flag === 1) {
      const url = extractImageUrlFromRecordInfo(data) ?? extractImageUrlFromRecordInfo(raw);
      if (url) return url;
      console.error('[NanoBanana .ai] success but no image URL in response:', JSON.stringify(raw));
      throw new Error('No image URL in response');
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error('Image generation timed out');
}

/** nanobananaapi.dev: sync POST /v1/images/generate returns url in body. */
async function generateImageDev(options: GenerateImageOptions): Promise<GenerateImageResult> {
  const res = await fetch(`${BASE_URL}/v1/images/generate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${NANOBANANA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: options.prompt,
      num: options.num ?? 1,
      model: options.model ?? 'gemini-2.5-flash-image',
      image_size: options.image_size ?? '1:1',
    }),
  });

  const data = (await res.json()) as {
    code?: number;
    message?: string;
    msg?: string;
    data?: { url?: string | string[]; taskId?: string; resultImageUrl?: string; info?: { resultImageUrl?: string } };
  };

  if (!res.ok) {
    console.error('[NanoBanana .dev] API error', res.status, data);
    throw new Error(data.message || data.msg || `NanoBanana API error: ${res.status}`);
  }
  const errCode = data.code;
  if (typeof errCode === 'number' && errCode !== 0) {
    const msg = data.message || data.msg || `NanoBanana error ${errCode}`;
    console.error('[NanoBanana .dev] API returned error', errCode, data);
    throw new Error(msg);
  }

  const url = data.data?.url ?? data.data?.resultImageUrl ?? data.data?.info?.resultImageUrl;
  if (typeof url === 'string') return { url };
  if (Array.isArray(url) && url.length > 0) return { url: url[0] };
  if (data.data?.taskId) {
    console.error('[NanoBanana .dev] async taskId not supported here:', JSON.stringify(data));
    throw new Error('NanoBanana returned taskId; use .ai or callback flow.');
  }
  console.error('[NanoBanana .dev] No image URL:', JSON.stringify(data));
  throw new Error(data.message || data.msg || 'No image URL in response');
}

/**
 * Build a prompt for a realistic human headshot (not stiff corporate).
 * Optional context (e.g. position/role) adds variety and alignment with the prospect.
 */
export function buildProspectAvatarPrompt(
  name?: string,
  context?: string | null
): string {
  const base =
    'Photorealistic headshot portrait, natural lighting, realistic skin and expression, ' +
    'approachable and diverse, head and shoulders, neutral or soft background, ' +
    'high quality photo, professional but natural, not stiff or corporate';
  const parts = [base];
  if (name?.trim()) {
    parts.push(`person named ${name.trim()}`);
  }
  if (context?.trim()) {
    const safe = context.trim().slice(0, 80).replace(/[^\w\s,.-]/g, '');
    if (safe) {
      parts.push(`person who could be ${safe}`);
    }
  }
  return parts.join(', ');
}
