/**
 * Roleplay Context Prompts
 * 
 * Modular prompt templates for roleplay scenarios.
 * Centralizes knowledge from Connor's framework docs for easy extension.
 */

import { getCondensedExamples, getObjectionExamples, getOpeningExamples } from '../knowledge/real-call-examples';
import { SALES_CATEGORIES, getCategoryLabel } from '../scoring-framework';

/**
 * 10-Category Sales Framework Summary
 * Built dynamically from scoring-framework.ts so prompt always matches the canonical source.
 */
export const SALES_FRAMEWORK_CONTEXT = `
## 10-Category Sales Scoring Framework

Score each category 0-10 based on the rep's performance:

${SALES_CATEGORIES.map((c, i) => `${i + 1}. **${c.label}**`).join('\n')}

Each category has sub-skills. Focus on specific behaviors, not vague assessments.
`;

/**
 * Prospect Difficulty Framework
 * 50-point model for realistic prospect simulation
 */
export const PROSPECT_DIFFICULTY_CONTEXT = `
## Prospect Difficulty Model (50 Points)

### Layer A: Persuasion Difficulty (40 points)
- **Position-Problem Alignment** (0-10): How well does the offer match their situation?
- **Pain/Ambition Intensity** (0-10): How motivated are they to solve this?
- **Perceived Need for Help** (0-10): Do they think they need external help?
- **Authority Level**: Advisee (easy) | Peer (medium) | Advisor (hard)
- **Funnel Context** (0-10): Cold outbound (low) to Referral (high)

### Layer B: Execution Resistance (10 points)
- **Execution Resistance** (0-10): Ability to proceed if convinced (money, time, authority)

### Difficulty Tiers
- **Easy** (42-50): Warm, motivated, minimal objections
- **Realistic** (36-41): Normal skepticism, reasonable objections
- **Hard** (30-35): Skeptical, multiple objections, needs proof
- **Elite** (25-29): High authority, sophisticated objections, little patience
- **Near Impossible** (<25): Hostile, severe blockers, unlikely to close
`;

/**
 * High-Ticket Sales Context
 * For coaching and roleplay realism
 */
export const HIGH_TICKET_CONTEXT = `
## High-Ticket Sales Context

This is a high-ticket sales environment ($3,000-$50,000+ programs). Key characteristics:

1. **Advisor Positioning**: The rep is an expert/advisor, not a salesperson
2. **Discovery-Heavy**: 60%+ of call should be discovery, not pitching
3. **Pain Amplification**: Connect current pain to future consequences
4. **ROI Focus**: Frame investment against cost of inaction
5. **Objection Reframing**: Address concerns through questions, not features
6. **Commitment Stacking**: Build small yeses throughout the call
7. **Assumptive Close**: Present next steps as natural progression

### Common Objection Types
- **Value**: "Is this worth the investment?"
- **Trust**: "How do I know you can help me?"
- **Fit**: "Will this work for my specific situation?"
- **Logistics**: "I don't have time/money/need to talk to spouse"
`;

/**
 * Real Call Examples - Training Data
 * Extracted from actual high-ticket sales calls
 */
export const REAL_CALL_EXAMPLES_CONTEXT = `
## Real Call Examples (Training Data)

The following are extracted from real high-ticket sales calls.
Use these to understand:
- How real prospects speak and behave
- What realistic objections sound like
- How experienced closers handle different situations
- What natural conversation flow looks like

${getCondensedExamples(3)}
`;

/**
 * Realistic Prospect Behavior Guidelines
 * From Connor's transcript examples
 */
export const REALISTIC_PROSPECT_BEHAVIOR = `
## Realistic Prospect Behavior

Based on real high-ticket sales call patterns:

### Opening Behavior by Funnel
- **Cold Outbound**: Skeptical, short answers, "Why should I give you my time?"
- **Warm Inbound**: Curious but guarded, "Tell me more but I've been burned before"
- **Content-Educated**: Already bought in conceptually, wants specifics
- **Referral**: Transferred trust, but still needs fit confirmation

### Realistic Objections (Not Excuses)
- "I've tried something like this before and it didn't work"
- "What makes you different from [competitor]?"
- "I need to think about it" (actually means: not convinced yet)
- "I don't have the time right now" (priority objection, not scheduling)
- "Let me talk to my [partner/team]" (often real, but dig deeper)

### Behavior Adaptation
Good reps earn deeper responses. If the rep:
- Asks smart questions → Give more detailed answers
- Builds genuine rapport → Become more open
- Demonstrates expertise → Respect them more
- Loses control or over-explains → Become dismissive
- Applies pressure too early → Resist harder
`;

/**
 * Analysis Prompt Context
 * Injected into analysis prompts for better feedback
 */
export const ANALYSIS_PROMPT_CONTEXT = `
${SALES_FRAMEWORK_CONTEXT}

${HIGH_TICKET_CONTEXT}

${REAL_CALL_EXAMPLES_CONTEXT}

When analyzing this conversation, evaluate the rep's performance against these frameworks.
Provide specific, actionable feedback referencing exact moments in the transcript.
Avoid vague advice like "build more rapport" - instead identify specific behaviors.

### What Good Looks Like (From Real Calls)
- Discovery questions that dig into specifics, not surface-level
- Objection handling that explores before answering
- Closing attempts that feel like natural next steps
- Rapport building through genuine curiosity, not scripts

### What Bad Looks Like
- Rushing to pitch before understanding pain
- Accepting "I need to think about it" without exploring
- Feature-dumping instead of asking questions
- Losing control to prospect tangents
`;

/**
 * Roleplay System Prompt Context
 * Injected into roleplay AI prompts
 */
export const ROLEPLAY_PROMPT_CONTEXT = `
${PROSPECT_DIFFICULTY_CONTEXT}

${REALISTIC_PROSPECT_BEHAVIOR}

${REAL_CALL_EXAMPLES_CONTEXT}

You are a realistic prospect in a high-ticket sales roleplay. Your behavior should:
1. Match real prospects from the transcripts, not scripted bots
2. Adapt naturally based on the rep's performance
3. Raise genuine objections at appropriate moments
4. Never give coaching advice - just act as the prospect
5. Show hesitation, ask follow-ups, challenge claims like a real person would

### Opening Lines (Match These Patterns)
${getOpeningExamples().slice(0, 3).map(o =>
    `- [${o.context}]: "${o.prospectBehavior}"`
).join('\n')}

### Objection Patterns (Use These Styles)
${(() => {
        const objections = getObjectionExamples();
        return Object.entries(objections).map(([type, objs]) =>
            objs.slice(0, 1).map(o => `- [${type}]: "${o.objection}"`).join('\n')
        ).join('\n');
    })()}
`;

/**
 * Moment-by-Moment Feedback Instructions
 * For generating specific timestamped feedback
 */
export const MOMENT_FEEDBACK_INSTRUCTIONS = `
For each key moment in the conversation, provide:

1. **What the rep said** - Quote or paraphrase the specific statement
2. **Why it worked / didn't work** - Explain the impact on the prospect
3. **What to say instead** - Provide a specific alternative (if applicable)

Focus on:
- Missed discovery opportunities
- Weak objection handling
- Strong rapport-building moments
- Premature closing attempts
- Effective reframes
- Lost control moments
`;

/**
 * Priority Fixes Template
 * For generating actionable improvement items
 */
export const PRIORITY_FIXES_TEMPLATE = `
Generate 3-5 priority fixes for this call. For each fix:

1. **What went wrong** - Specific behavior or moment
2. **Why it mattered** - Impact on the conversation and prospect
3. **What to do differently** - Concrete, actionable advice

Avoid generic advice. Be specific to this conversation and this offer type.
Example BAD: "Build more rapport"
Example GOOD: "When the prospect mentioned their failed attempt at [X], you moved to the pitch instead of exploring the emotional impact. Ask: 'How did that failure affect your confidence in trying again?'"
`;

