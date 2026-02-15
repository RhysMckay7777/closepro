/**
 * Shared pattern extraction logic for training transcripts.
 * Used by both the training transcripts API route and the admin seed route.
 */

import Groq from 'groq-sdk';
import { sampleForExtraction } from '@/lib/training/transcript-parser';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const groqClient = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

/**
 * Extract sales patterns from a transcript using AI.
 * For long transcripts, samples from 4 sections (intro, discovery, objections, close)
 * instead of just truncating to the first 5000 chars.
 */
export async function extractPatterns(transcript: string): Promise<Record<string, string[]> | null> {
  if (!groqClient) return null;
  try {
    // Smart sampling: covers the whole call instead of just the opening
    const sample = sampleForExtraction(transcript, 6000);

    const response = await groqClient.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are an expert sales analyst. Extract actionable patterns from sales call transcripts. Return only valid JSON.',
        },
        {
          role: 'user',
          content: `Analyze this sales call transcript and extract key patterns that can be used to train AI roleplay prospects.

TRANSCRIPT:
${sample}

Return JSON with these arrays (2-5 items each, be specific with actual phrases/techniques used):
{
  "closingTechniques": string[] (specific closing lines or approaches used),
  "objectionHandles": string[] (how objections were handled, with the objection and response),
  "discoveryQuestions": string[] (effective discovery questions asked),
  "valueStatements": string[] (compelling value propositions or reframes used),
  "commonObjections": string[] (objections raised by the prospect)
}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content.trim().replace(/^```json\n?/, '').replace(/\n?```$/, ''));
  } catch (err) {
    console.error('[pattern-extraction] Error:', err);
    return null;
  }
}
