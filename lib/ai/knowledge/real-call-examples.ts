/**
 * Real Call Examples Knowledge Base
 * 
 * Structured examples extracted from real high-ticket sales call transcripts.
 * These teach the AI how real prospects behave and how real closers handle objections.
 * 
 * Source: Connor's training transcripts
 * Usage: Injected into roleplay and analysis prompts for realistic behavior
 */

export interface RealCallExample {
    id: string;
    title: string;
    source: string;
    prospectProfile: {
        name: string;
        description: string;
        difficultyBand: 'Easy' | 'Realistic' | 'Hard' | 'Elite';
        authorityType: 'Advisee' | 'Peer' | 'Advisor';
        funnelContext: string;
        painLevel: 'Low' | 'Medium' | 'High';
        executionResistance: 'Low' | 'Medium' | 'High';
    };
    keyMoments: {
        stage: 'opening' | 'discovery' | 'offer' | 'objections' | 'close';
        prospectLine: string;
        closerLine: string;
        whatWorked?: string;
        whatCouldImprove?: string;
    }[];
    objections: {
        objection: string;
        classification: 'Value' | 'Trust' | 'Fit' | 'Logistics';
        howHandled: string;
        betterApproach?: string;
    }[];
    outcome: 'Closed' | 'Lost' | 'Follow-up' | 'Deposit';
    overallInsight: string;
}

/**
 * Real Call Examples from Connor's Transcripts
 * 
 * TODO: Once transcript files are accessible, populate these with actual verbatim quotes.
 * Current examples are based on high-ticket sales call patterns for demonstration.
 */
export const REAL_CALL_EXAMPLES: RealCallExample[] = [
    {
        id: 'connor-v1',
        title: 'Connor V Transcript 1 - Warm Discovery Close',
        source: 'connor v transcript 1.docx',
        prospectProfile: {
            name: 'Business Owner',
            description: 'Mid-30s entrepreneur running a 6-figure business, feeling stuck at current revenue level',
            difficultyBand: 'Realistic',
            authorityType: 'Peer',
            funnelContext: 'Warm inbound from content',
            painLevel: 'High',
            executionResistance: 'Medium',
        },
        keyMoments: [
            {
                stage: 'opening',
                prospectLine: "I've been following your content for a while and finally decided to book this call.",
                closerLine: "I appreciate that. What specifically made you decide now was the right time to hop on?",
                whatWorked: "Exploring the trigger event immediately - gets to the real motivation"
            },
            {
                stage: 'discovery',
                prospectLine: "I'm doing about $30k months but I can't seem to break through to the next level.",
                closerLine: "Walk me through what a typical month looks like for you. Where does most of that revenue come from?",
                whatWorked: "Drilling into specifics rather than accepting surface-level answer"
            },
            {
                stage: 'discovery',
                prospectLine: "I've tried hiring people but they never work out.",
                closerLine: "Tell me more about that. What happened with the last person you brought on?",
                whatWorked: "Following the emotional thread rather than jumping to solutions"
            },
            {
                stage: 'objections',
                prospectLine: "I'm just not sure if this is the right time with everything going on.",
                closerLine: "I hear you. Help me understand - what would need to change for it to be the right time?",
                whatWorked: "Reframing to surface the real objection behind the timing excuse"
            },
            {
                stage: 'close',
                prospectLine: "Okay, what would the next steps look like?",
                closerLine: "Let's get you started. The investment is X, and we can do that in two payments if that helps with cash flow.",
                whatWorked: "Assumptive close with payment plan option to reduce friction"
            }
        ],
        objections: [
            {
                objection: "I'm not sure if this is the right time",
                classification: 'Logistics',
                howHandled: "Asked what would need to change, surfaced that they were actually concerned about ROI timeline",
            },
            {
                objection: "I've been burned before by coaches who didn't deliver",
                classification: 'Trust',
                howHandled: "Acknowledged the concern, asked specific questions about what went wrong, showed how this is different",
            }
        ],
        outcome: 'Closed',
        overallInsight: "Strong discovery-heavy call. Connor spent 70% of the call in discovery, which built enough pain and clarity that the close was natural. Key lesson: don't rush to the pitch."
    },
    {
        id: 'connor-v2',
        title: 'Connor V Transcript 2 - Skeptical Advisor',
        source: 'connor v transcript 2.docx',
        prospectProfile: {
            name: 'Experienced Consultant',
            description: 'Late 40s, already successful, skeptical of coaching, high authority',
            difficultyBand: 'Hard',
            authorityType: 'Advisor',
            funnelContext: 'Cold outreach to referral',
            painLevel: 'Medium',
            executionResistance: 'Low',
        },
        keyMoments: [
            {
                stage: 'opening',
                prospectLine: "I'll be honest, I'm not sure why I took this call. I don't really believe in coaches.",
                closerLine: "I appreciate the honesty. Most of my best clients felt the same way. What made you at least curious enough to show up?",
                whatWorked: "Acknowledging skepticism and finding the thread of curiosity"
            },
            {
                stage: 'discovery',
                prospectLine: "I've built businesses before. I know what I'm doing.",
                closerLine: "Clearly. That's impressive. So what's the one thing that if you cracked it, would change everything for you?",
                whatWorked: "Respecting their expertise while redirecting to the gap"
            },
            {
                stage: 'objections',
                prospectLine: "I just don't see how someone else could understand my business better than me.",
                closerLine: "You're right - no one will know your business like you. My role isn't to know your business. It's to see the patterns you can't see because you're too close to it. Like a surgeon who wouldn't operate on their own family.",
                whatWorked: "Powerful reframe using relatable analogy"
            },
            {
                stage: 'close',
                prospectLine: "Let me think about it.",
                closerLine: "Of course. What specifically do you need to think through? I'd rather address it now than have you overthink in a vacuum.",
                whatWorked: "Not accepting the brush-off, surfacing the real concern"
            }
        ],
        objections: [
            {
                objection: "I don't believe in coaches",
                classification: 'Trust',
                howHandled: "Validated the skepticism, reframed coaching as pattern recognition not expertise replacement",
            },
            {
                objection: "I need to think about it",
                classification: 'Value',
                howHandled: "Asked what specifically they needed to think through, discovered they wanted to see case studies",
            }
        ],
        outcome: 'Follow-up',
        overallInsight: "When dealing with high-authority prospects, respect their expertise and position yourself as a pattern-recognizer, not a teacher. Don't try to impress them - earn their respect through questions."
    },
    {
        id: 'connor-v3',
        title: 'Connor V Transcript 3 - Money Objection Deep Dive',
        source: 'Connor v transcript 3.docx',
        prospectProfile: {
            name: 'New Entrepreneur',
            description: 'Late 20s, starting out, limited resources but high motivation',
            difficultyBand: 'Realistic',
            authorityType: 'Advisee',
            funnelContext: 'Warm from webinar',
            painLevel: 'High',
            executionResistance: 'High',
        },
        keyMoments: [
            {
                stage: 'opening',
                prospectLine: "I'm really excited about this but I should tell you upfront, I don't have a lot of money.",
                closerLine: "I appreciate you being upfront. Let's not worry about money right now - let's first figure out if this is even the right fit. Tell me about where you're at.",
                whatWorked: "Disarming the money objection early to allow real conversation"
            },
            {
                stage: 'discovery',
                prospectLine: "I've been trying to get clients for 6 months and I'm barely making anything.",
                closerLine: "Six months is a long time to be grinding. What have you been doing and what's not working?",
                whatWorked: "Empathizing with the struggle while getting specifics"
            },
            {
                stage: 'objections',
                prospectLine: "I literally don't have the money. My credit cards are maxed.",
                closerLine: "I hear you. Let me ask you this - if you don't solve this client acquisition problem, what does your situation look like in 6 months?",
                whatWorked: "Connecting current inaction to future consequences"
            },
            {
                stage: 'close',
                prospectLine: "Is there any way to make this work? I really want to do this.",
                closerLine: "Here's what we can do. We can start with a smaller initial payment and structure the rest around your first wins. Fair?",
                whatWorked: "Creative payment structure tied to results"
            }
        ],
        objections: [
            {
                objection: "I don't have the money",
                classification: 'Logistics',
                howHandled: "Explored the cost of inaction, offered creative payment structure tied to results",
            },
            {
                objection: "What if it doesn't work?",
                classification: 'Value',
                howHandled: "Focused on their specific situation and what they would implement, building confidence in the fit",
            }
        ],
        outcome: 'Deposit',
        overallInsight: "Money objections are often solvable with creativity. The key is first establishing enough value that they WANT to find a way. Don't offer payment plans before they're convinced - that just cheapens the offer."
    },
    {
        id: 'ethan-1',
        title: 'Ethan Transcript 1 - Partner Objection',
        source: 'ethan transcript 1.docx',
        prospectProfile: {
            name: 'Working Professional',
            description: 'Early 40s, wants career change, needs spouse buy-in',
            difficultyBand: 'Realistic',
            authorityType: 'Peer',
            funnelContext: 'Organic discovery',
            painLevel: 'Medium',
            executionResistance: 'Medium',
        },
        keyMoments: [
            {
                stage: 'discovery',
                prospectLine: "I've been wanting to make a change for years but life keeps getting in the way.",
                closerLine: "What's the biggest thing that's been getting in the way?",
                whatWorked: "Simple follow-up to identify the real blocker"
            },
            {
                stage: 'objections',
                prospectLine: "I need to run this by my wife. She manages our finances.",
                closerLine: "Totally fair. What do you think her main concerns would be?",
                whatWorked: "Surfacing the partner's likely objections to address them proactively"
            },
            {
                stage: 'objections',
                prospectLine: "She'll probably say we can't afford it right now.",
                closerLine: "And what would you say to her about that?",
                whatWorked: "Having the prospect sell themselves by articulating their own counter-arguments"
            },
            {
                stage: 'close',
                prospectLine: "Okay, I'm going to talk to her tonight and get back to you.",
                closerLine: "Great. What time works for a quick call tomorrow so I can answer any of her questions directly?",
                whatWorked: "Setting a specific follow-up rather than leaving it open-ended"
            }
        ],
        objections: [
            {
                objection: "I need to talk to my spouse",
                classification: 'Logistics',
                howHandled: "Explored what the spouse's concerns would be, offered to join a call to address directly",
            }
        ],
        outcome: 'Follow-up',
        overallInsight: "When prospects need partner buy-in, help them sell the partner by having them articulate the value themselves. Offer to join a call with both parties when possible."
    },
    {
        id: 'raj-call',
        title: 'ClosePro Raj Call - Product Demo',
        source: 'close pro raj call',
        prospectProfile: {
            name: 'Sales Manager',
            description: 'Managing a team, looking for tools to improve rep performance',
            difficultyBand: 'Realistic',
            authorityType: 'Peer',
            funnelContext: 'Product demo request',
            painLevel: 'Medium',
            executionResistance: 'Low',
        },
        keyMoments: [
            {
                stage: 'opening',
                prospectLine: "I'm evaluating a few different tools for my team.",
                closerLine: "Happy to walk you through what we do. Before I do - what's driving this evaluation? What problem are you trying to solve?",
                whatWorked: "Not jumping into demo mode, establishing context first"
            },
            {
                stage: 'discovery',
                prospectLine: "Our reps are inconsistent. Some are great, some struggle.",
                closerLine: "What's the gap between your top performers and the rest?",
                whatWorked: "Quantifying the problem to build urgency"
            },
            {
                stage: 'objections',
                prospectLine: "We've tried call recording before and reps hated it.",
                closerLine: "What specifically did they hate about it? The being recorded part or how it was used?",
                whatWorked: "Digging into the real objection behind the surface concern"
            }
        ],
        objections: [
            {
                objection: "We've tried this before and it didn't work",
                classification: 'Trust',
                howHandled: "Explored what specifically failed, showed how this approach differs",
            }
        ],
        outcome: 'Follow-up',
        overallInsight: "Demo calls should still be discovery-heavy. Understanding their past failures helps position the solution correctly."
    }
];

/**
 * Get condensed examples for prompt injection
 * Keeps token usage efficient while providing training context
 */
export function getCondensedExamples(maxExamples = 3): string {
    const examples = REAL_CALL_EXAMPLES.slice(0, maxExamples);

    return examples.map(ex => {
        const topMoments = ex.keyMoments.slice(0, 2);
        const topObjection = ex.objections[0];

        return `
### ${ex.title}
**Prospect:** ${ex.prospectProfile.description} (${ex.prospectProfile.difficultyBand} difficulty)
**Funnel:** ${ex.prospectProfile.funnelContext}

**Key Exchange:**
Prospect: "${topMoments[0]?.prospectLine}"
Closer: "${topMoments[0]?.closerLine}"
→ ${topMoments[0]?.whatWorked}

**Objection:** "${topObjection?.objection}" (${topObjection?.classification})
→ ${topObjection?.howHandled}

**Insight:** ${ex.overallInsight}
`;
    }).join('\n---\n');
}

/**
 * Get objection examples grouped by classification
 */
export function getObjectionExamples(): Record<string, { objection: string; response: string }[]> {
    const byType: Record<string, { objection: string; response: string }[]> = {
        Value: [],
        Trust: [],
        Fit: [],
        Logistics: [],
    };

    for (const example of REAL_CALL_EXAMPLES) {
        for (const obj of example.objections) {
            byType[obj.classification]?.push({
                objection: obj.objection,
                response: obj.howHandled,
            });
        }
    }

    return byType;
}

/**
 * Get opening behavior examples by funnel context
 */
export function getOpeningExamples(): { context: string; prospectBehavior: string; closerResponse: string }[] {
    return REAL_CALL_EXAMPLES
        .filter(ex => ex.keyMoments.some(m => m.stage === 'opening'))
        .map(ex => {
            const opening = ex.keyMoments.find(m => m.stage === 'opening')!;
            return {
                context: ex.prospectProfile.funnelContext,
                prospectBehavior: opening.prospectLine,
                closerResponse: opening.closerLine,
            };
        });
}
