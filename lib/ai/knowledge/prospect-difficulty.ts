export const PROSPECT_DIFFICULTY_KNOWLEDGE = `
PROSPECT DIFFICULTY MODEL — SCORING GUIDE

1. PURPOSE
Prospect Difficulty represents the starting conditions of the sale — not the outcome.
Difficulty must be measured consistently, based only on what the prospect brings into
the call, independent of closer performance.

2. THE FIVE DIMENSIONS (Each Scored 0–10, Total = /50)

DIMENSION 1: ICP ALIGNMENT (0–10)
What It Measures: How closely the prospect's situation and problems match what the
offer is designed to solve. Includes demographic alignment, situational alignment,
problem alignment, relevance of goals. Does NOT measure motivation — only fit.

Scoring:
9–10 (Very High): Clear ICP match, problems exactly what offer solves, minimal conceptual resistance
7–8 (Good): Strong fit but missing one ICP element, relevant problems but not urgent
4–6 (Moderate): Partial match, some relevant problems, needs reframing to fit
1–3 (Low): Weak fit, conceptual mismatch, offer not clearly designed for them
0 (None): Completely wrong market

Transcript Signals: Clear description of problems matching offer, statements like "That's exactly what I'm struggling with", or mismatched signals like "I don't really have that issue"

Summary Output: Explain whether they clearly fit the ICP, which elements matched, which did not. 2–4 sentences.

DIMENSION 2: MOTIVATION INTENSITY (Pain + Ambition) (0–10)
What It Measures: How emotionally and logically driven the prospect is to change.
Includes pain (escaping current situation), ambition (achieving future goal), urgency language.
This is about internal drive — not logic.

Scoring:
9–10 (Very High): Strong pain AND/OR strong ambition, clear urgency, emotional intensity
7–8 (Strong): One strong driver, one moderate
4–6 (Moderate): Wants change but not urgent, comfortable but curious
1–3 (Low): Passive, "just exploring", no strong dissatisfaction
0: Indifferent

Transcript Signals:
Pain: "I'm sick of…", "I can't keep doing this"
Ambition: "I need to hit…", "I want to build…"
Urgency: Time pressure, emotional frustration, consequence awareness

Summary Output: Explain whether motivation came from pain or ambition, whether urgency was strong or weak, how emotionally invested they appeared. 2–4 sentences.

DIMENSION 3: PROSPECT AUTHORITY & COACHABILITY (0–10)
What It Measures: How the prospect sees themselves relative to the closer and how open they are to being helped. Includes ego level, coachability, openness, need for external help.

Scoring:
8–10 (Advisee/Coachable): Open, shares details freely, respects expertise, expresses need for help
5–7 (Peer/Balanced): Neutral authority, slight skepticism, needs proof
2–4 (High Authority/Guarded): Tests the closer, challenges framing, withholds emotional depth
0–1 (Advisor/Resistant): Attempts to control, low openness, believes they know better

Transcript Signals: Long open answers = higher coachability. Interrupting or correcting = lower. "I've already tried everything" = low need for help.

Summary Output: Explain whether they were open or guarded, whether they saw themselves as needing help, how much resistance their authority created. 2–4 sentences.

DIMENSION 4: FUNNEL CONTEXT / WARMTH (0–10)
What It Measures: How warm the prospect is before the call begins.
Based on: Prior exposure to brand/offer, proof exposure, expectation alignment, trust baseline.
This is NOT about closer performance — it's about prospect's starting trust and awareness.

Scoring:
9–10 (Hot): Referral/repeat buyer/highly educated inbound. Followed content, seen proof, understands offer. Strong baseline trust, low friction.
6–8 (Warm): Familiar with brand or consumed some content. Seen some proof but may need confirmation. Moderate trust baseline.
3–5 (Cold): Came from cold ads or minimal funnel context. Limited proof exposure. Needs trust-building early, may show skepticism.
0–2 (Ice Cold): Outbound/minimal-to-zero awareness. No meaningful proof exposure. Strong early trust resistance.

Detection Priority (in order of reliability):
1. Explicit funnel source (if available): "Referral", "inbound", "webinar", "DM", "ads", "outbound"
2. Prospect statements: "I've been following you for months", "I watched the case study", "I just saw an ad"
3. Early-call trust posture (supporting evidence only): Immediate buy-in vs "prove it" skepticism
If both present, prefer explicit funnel source over inferred posture.

Summary Output: Explain how warm/cold they were (source + awareness), what they had/hadn't seen before the call, how that likely impacted trust and speed-to-decision. 2–4 sentences.

DIMENSION 5: ABILITY TO PROCEED (Execution Capacity) (0–10)
What It Measures: Whether the prospect has the practical ability to act.
Includes money, time, effort capacity, decision authority, prioritisation.
This is logistical — not emotional.

Scoring:
9–10 (Fully Able): Has money available, has time capacity, can decide independently, no structural blockers
6–8 (Mostly Able): Minor restructuring needed, payment plan possible, reprioritisation required
3–5 (Restricted): Tight financially, limited time, needs partner sign-off
0–2 (Severe Resistance): No funds, no time, external dependency, not realistically closable on-call

Transcript Signals: Income discussion, savings mention, partner authority, "I'd have to move things around", "I need to check with…"

Summary Output: Explain whether logistics were strong or restrictive, whether ability was real or conditional, whether execution resistance was minor or severe. 2–4 sentences.

3. TOTAL PROSPECT DIFFICULTY CALCULATION
Total = ICP Alignment + Motivation Intensity + Authority & Coachability + Funnel Context + Ability to Proceed = /50

4. DIFFICULTY BANDS
43–50 = Easy
36–42 = Realistic
30–35 = Hard
25–29 = Expert
24 and under = Near Impossible

Higher score = more favorable conditions = easier sale.
Difficulty reflects starting conditions — not outcome.

5. CRITICAL RULES FOR AI
- Analyse full transcript, extract behavioural indicators per dimension, score each independently
- If the closer creates urgency, that does NOT increase Motivation score — only what prospect brings counts
- If the closer builds authority successfully, that does NOT change Authority score — reflects initial posture
- Difficulty is fixed at call start
- Do NOT inflate difficulty to excuse poor sales
- Do NOT lower difficulty to punish closers
- Do NOT change difficulty mid-call
- Do NOT let outcome influence difficulty score

6. JUSTIFICATION FORMAT (Per Dimension)
2–4 sentences. Clear. Direct. No fluff. Reference transcript evidence. Avoid blaming the closer.
Structure: State the level → Explain why → Mention specific indicators → Conclude how it affected difficulty.
`;
