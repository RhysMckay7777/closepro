// Mock analysis for development/testing when API credits are unavailable
import { CallAnalysisResult, SkillScore, PillarDetails, CoachingRecommendation, TimestampedFeedback } from './analysis';

/**
 * Generate mock analysis results for development
 */
export function generateMockAnalysis(
  transcript: string,
  transcriptJson: { utterances: Array<{ speaker: string; start: number; end: number; text: string }> }
): CallAnalysisResult {
  // Calculate some basic metrics from transcript
  const wordCount = transcript.split(/\s+/).length;
  const duration = transcriptJson.utterances.length > 0
    ? Math.max(...transcriptJson.utterances.map(u => u.end)) / 1000 // Convert to seconds
    : 300; // Default 5 minutes

  // Generate realistic scores based on transcript length and content
  const baseScore = Math.min(85, Math.max(45, 60 + (wordCount / 100)));

  // Generate pillar scores (slight variation)
  const valueScore = baseScore + (Math.random() * 10 - 5);
  const trustScore = baseScore + (Math.random() * 10 - 5);
  const fitScore = baseScore + (Math.random() * 10 - 5);
  const logisticsScore = baseScore + (Math.random() * 10 - 5);

  const value: PillarDetails = {
    score: Math.round(Math.max(0, Math.min(100, valueScore))),
    strengths: [
      'Clear value proposition communicated',
      'Effective use of examples and case studies',
    ],
    weaknesses: [
      'Could have emphasized ROI more clearly',
      'Missing specific numbers or metrics',
    ],
    breakdown: 'The rep did a good job explaining the core value, but could strengthen the presentation with more concrete data.',
  };

  const trust: PillarDetails = {
    score: Math.round(Math.max(0, Math.min(100, trustScore))),
    strengths: [
      'Demonstrated expertise and authority',
      'Good use of social proof',
    ],
    weaknesses: [
      'Could have built more personal rapport',
      'Trust signals could be stronger',
    ],
    breakdown: 'Trust was established through competence, but personal connection could be deeper.',
  };

  const fit: PillarDetails = {
    score: Math.round(Math.max(0, Math.min(100, fitScore))),
    strengths: [
      'Good discovery questions asked',
      'Identified key pain points',
    ],
    weaknesses: [
      'Could have probed deeper into specific needs',
      'Fit confirmation was somewhat surface-level',
    ],
    breakdown: 'The rep identified basic fit, but could have gone deeper to confirm ideal customer profile alignment.',
  };

  const logistics: PillarDetails = {
    score: Math.round(Math.max(0, Math.min(100, logisticsScore))),
    strengths: [
      'Clear next steps outlined',
      'Timeline discussed',
    ],
    weaknesses: [
      'Payment options could have been presented earlier',
      'Implementation details were vague',
    ],
    breakdown: 'Logistics were handled adequately, but more detail on process would strengthen the close.',
  };

  const skillScores: SkillScore[] = [
    {
      category: 'Opening & Rapport Building',
      subSkills: {
        'Warm greeting': 75,
        'Personal connection': 70,
        'Setting agenda': 80,
      },
    },
    {
      category: 'Discovery & Questioning',
      subSkills: {
        'Open-ended questions': 72,
        'Deep probing': 68,
        'Active listening': 75,
      },
    },
    {
      category: 'Value Communication',
      subSkills: {
        'Value proposition clarity': 78,
        'ROI presentation': 70,
        'Benefit articulation': 75,
      },
    },
    {
      category: 'Objection Handling',
      subSkills: {
        'Objection anticipation': 65,
        'Reframing skills': 70,
        'Empathy in response': 72,
      },
    },
    {
      category: 'Closing Techniques',
      subSkills: {
        'Assumptive close': 68,
        'Urgency creation': 65,
        'Commitment seeking': 70,
      },
    },
  ];

  const coachingRecommendations: CoachingRecommendation[] = [
    {
      priority: 'high',
      category: 'Value Communication',
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
      category: 'Closing Techniques',
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

  return {
    overallScore: Math.round((value.score + trust.score + fit.score + logistics.score) / 4),
    value,
    trust,
    fit,
    logistics,
    skillScores,
    coachingRecommendations,
    timestampedFeedback,
  };
}
