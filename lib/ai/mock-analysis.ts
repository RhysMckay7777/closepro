// Mock analysis for development/testing when API credits are unavailable
import { CallAnalysisResult, SkillScore, CoachingRecommendation, TimestampedFeedback, type CategoryScores } from './analysis';
import { SALES_CATEGORIES, type SalesCategoryId } from './scoring-framework';

/**
 * Generate mock analysis results for development (10-category framework)
 */
export function generateMockAnalysis(
  transcript: string,
  transcriptJson: { utterances: Array<{ speaker: string; start: number; end: number; text: string }> }
): CallAnalysisResult {
  const wordCount = transcript.split(/\s+/).length;
  const duration = transcriptJson.utterances.length > 0
    ? Math.max(...transcriptJson.utterances.map(u => u.end)) / 1000
    : 300;

  const baseScore = Math.min(8, Math.max(4, 6 + (wordCount / 500))); // 0-10 scale

  const categoryScores: CategoryScores = {};
  for (const { id } of SALES_CATEGORIES) {
    categoryScores[id as SalesCategoryId] = Math.round(Math.max(0, Math.min(10, baseScore + (Math.random() * 2 - 1))) * 10) / 10;
  }

  const skillScores: SkillScore[] = SALES_CATEGORIES.map((c) => ({
    category: c.label,
    subSkills: { [c.id]: categoryScores[c.id] ?? 0 },
  }));

  const coachingRecommendations: CoachingRecommendation[] = [
    {
      priority: 'high',
      category: 'Value & Offer Positioning',
      issue: 'ROI presentation needs strengthening',
      explanation: 'The value was communicated but lacked concrete numbers that would make the ROI undeniable.',
      timestamp: Math.floor(duration * 0.3),
      transcriptSegment: transcript.substring(0, 100),
      action: 'Practice presenting ROI with specific numbers: "This typically saves clients $X per month" or "ROI is typically X% within Y months".',
    },
    {
      priority: 'medium',
      category: 'Discovery & Questioning',
      issue: 'Discovery depth could improve',
      explanation: 'Good questions were asked, but deeper probing would reveal more specific pain points.',
      timestamp: Math.floor(duration * 0.2),
      transcriptSegment: transcript.substring(0, 100),
      action: 'Use the "5 Whys" technique to dig deeper into stated problems and uncover root causes.',
    },
    {
      priority: 'low',
      category: 'Closing & Commitment Integrity',
      issue: 'Could create more urgency',
      explanation: 'The close was attempted but lacked urgency drivers that would accelerate decision-making.',
      timestamp: Math.floor(duration * 0.8),
      transcriptSegment: transcript.substring(0, 100),
      action: 'Practice using consequence framing: "What happens if you wait 3 months?" to create appropriate urgency.',
    },
  ];

  const timestampedFeedback: TimestampedFeedback[] = [
    {
      timestamp: Math.floor(duration * 0.1),
      type: 'strength',
      message: 'Strong opening - established rapport quickly',
      transcriptSegment: transcript.substring(0, 50),
      pillar: 'trust',
    },
    {
      timestamp: Math.floor(duration * 0.4),
      type: 'opportunity',
      message: 'Good moment to present ROI with numbers',
      transcriptSegment: transcript.substring(0, 50),
      pillar: 'value',
    },
    {
      timestamp: Math.floor(duration * 0.7),
      type: 'weakness',
      message: 'Objection could have been anticipated earlier',
      transcriptSegment: transcript.substring(0, 50),
      pillar: 'fit',
    },
  ];

  const overallScore = Math.round(
    Math.max(0, Math.min(100, Object.values(categoryScores).reduce((a, b) => a + (b ?? 0), 0)))
  );

  return {
    overallScore,
    categoryScores,
    objections: [
      { objection: 'I need to think about it', pillar: 'trust', handling: 'Rep acknowledged and asked what specifically to think about.' },
    ],
    skillScores,
    coachingRecommendations,
    timestampedFeedback,
    prospectDifficulty: {
      totalDifficultyScore: 32,
      difficultyTier: 'hard',
    },
  };
}
