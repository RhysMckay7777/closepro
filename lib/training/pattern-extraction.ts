/**
 * Shared pattern extraction logic for training transcripts.
 * Used by both the training transcripts API route and the admin seed route.
 */

import { chatComplete, getActiveProvider, isProviderConfigured, stripJsonFences } from '@/lib/ai/llm';
import { sampleForExtraction } from '@/lib/training/transcript-parser';

/**
 * Extract sales patterns from a transcript using AI.
 * For long transcripts, samples from 4 sections (intro, discovery, objections, close)
 * instead of just truncating to the first 5000 chars.
 */
export async function extractPatterns(transcript: string): Promise<Record<string, string[]> | null> {
  if (!isProviderConfigured(getActiveProvider())) return null;
  try {
    // Smart sampling: covers the whole call instead of just the opening
    const sample = sampleForExtraction(transcript, 6000);

    const content = await chatComplete({
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
      maxTokens: 2000,
      jsonMode: true,
    });

    if (!content) return null;
    return JSON.parse(stripJsonFences(content));
  } catch (err) {
    console.error('[pattern-extraction] Error:', err);
    return null;
  }
}
