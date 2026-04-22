// Provider-agnostic LLM client. Supports Groq and Google Gemini.
// Switch providers at runtime via the LLM_PROVIDER env var or per-call `provider` option.

import Groq from 'groq-sdk';
import { GoogleGenAI } from '@google/genai';

export type LLMProvider = 'groq' | 'gemini';
export type LLMRole = 'system' | 'user' | 'assistant';

export interface LLMMessage {
  role: LLMRole;
  content: string;
}

export interface ChatCompleteOptions {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  provider?: LLMProvider;
  model?: string;
}

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

let groqClient: Groq | null = null;
let geminiClient: GoogleGenAI | null = null;

function getGroqClient(): Groq | null {
  if (!GROQ_API_KEY) return null;
  if (!groqClient) groqClient = new Groq({ apiKey: GROQ_API_KEY });
  return groqClient;
}

function getGeminiClient(): GoogleGenAI | null {
  if (!GEMINI_API_KEY) return null;
  if (!geminiClient) geminiClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  return geminiClient;
}

export function getActiveProvider(override?: LLMProvider): LLMProvider {
  if (override === 'groq' || override === 'gemini') return override;
  const env = (process.env.LLM_PROVIDER || '').toLowerCase();
  if (env === 'groq' || env === 'gemini') return env;
  return 'groq';
}

export function isProviderConfigured(provider: LLMProvider): boolean {
  if (provider === 'groq') return !!GROQ_API_KEY;
  if (provider === 'gemini') return !!GEMINI_API_KEY;
  return false;
}

export function stripJsonFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '').trim();
}

export async function chatComplete(opts: ChatCompleteOptions): Promise<string> {
  const provider = getActiveProvider(opts.provider);
  if (provider === 'gemini') return chatCompleteGemini(opts);
  return chatCompleteGroq(opts);
}

async function chatCompleteGroq(opts: ChatCompleteOptions): Promise<string> {
  const client = getGroqClient();
  if (!client) throw new Error('GROQ_API_KEY is not configured');
  const model = opts.model || DEFAULT_GROQ_MODEL;

  const response = await client.chat.completions.create({
    model,
    messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
    ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
    ...(opts.maxTokens !== undefined ? { max_tokens: opts.maxTokens } : {}),
    ...(opts.jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
  });

  return response.choices[0]?.message?.content || '';
}

async function chatCompleteGemini(opts: ChatCompleteOptions): Promise<string> {
  const client = getGeminiClient();
  if (!client) throw new Error('GEMINI_API_KEY is not configured');
  const model = opts.model || DEFAULT_GEMINI_MODEL;

  const systemParts: string[] = [];
  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

  for (const m of opts.messages) {
    if (m.role === 'system') {
      systemParts.push(m.content);
    } else {
      contents.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      });
    }
  }

  const config: Record<string, unknown> = {};
  if (systemParts.length > 0) config.systemInstruction = systemParts.join('\n\n');
  if (opts.temperature !== undefined) config.temperature = opts.temperature;
  if (opts.maxTokens !== undefined) config.maxOutputTokens = opts.maxTokens;
  if (opts.jsonMode) config.responseMimeType = 'application/json';

  const response = await client.models.generateContent({
    model,
    contents,
    config,
  });

  return response.text || '';
}
