Prompt 5 — Prospect Generation: Images, Context, Cards & Builder Consistency
Scope: Overhaul prospect image generation, structured context output, card descriptors, the Create Prospect form, and difficulty banding across the entire app.

Critical addition from Connor (WhatsApp — yesterday):
"we're now going to have more in depth prospect context with 2/3 lines for each difficulty maker, this is going to be so important but lets also make sure that the prospect context is based off of the 5 difficulty makers AND the offer itself. its going to be so important that it is pulling from the offer context as well as the difficulty markers."

Requirements to implement:
5A. Prospect Image Generation — New Style
Remove all photoreal constraints: "professional headshot," "Canon EOS R5," "85mm f/1.4," "bokeh background," "must be indistinguishable from real photo," and all strict anti-cartoon language.

New target: ~80–85% realism — credible realistic avatar, NOT a perfect photograph. Plain colored background. Head + shoulders or mid-chest framing.

Context-conditioned: Image prompt must use offer type + prospect context + archetype (busy dad, skeptic, fitness, career changer, etc.) to choose wardrobe + vibe. Stop defaulting everyone to suit-and-office.
​

Replace existing prompt template entirely. Speed should improve as a side benefit.

5B. Prospect Context — 8–12 Lines, Mapped to 5 Difficulty Markers + Offer
This is the most critical change per Connor's latest message. Every auto-generated prospect context must be 8–12 lines, with 2–3 lines per difficulty marker, and must pull from both the offer context AND the 5 difficulty scores:

Identity / Demographics (1–2 lines): Name, age, gender, location — singular and consistent. Never "male and female," never two locations.

Position + Problem as it relates to the offer (2–3 lines): Derived from offer ICP + offer context. Higher ICP alignment score → closer match to offer's ICP details. Must reflect the specific offer vertical (fitness, sales, relationships, etc.).

Motivation Intensity (2–3 lines): Pain and/or ambition intensity based on motivation score. Must feel real and specific to the offer.

Authority & Coachability (2–3 lines): What they've tried, how they think, how open they are. Higher score → more receptive, less defensive.

Funnel Context (1–2 lines): What they've seen before the call, how warm they are (based on funnel context score).

Ability to Proceed (1 line): Most likely logistical friction — money vs time vs effort/priorities.

Output format example: "Thomas is a 34-year-old ___ currently ___, wants ___ because ___. He's struggling with ___ and worries ___. He's interested but cautious due to ___."
Must never output contradictory identity info. Context must make the roleplay more realistic because the prospect has real grounding to act from.

5C. Prospect Card Descriptors
On roleplay prospect selection page, under prospect name, display a 2-line descriptor: (a) demographic anchor (age/role/stage) and (b) biggest problem or obstacle.

Replace vague labels ("wrong timing," "busy dad," "skeptical business") with specific ones. Example: "35-year-old B2C salesperson — wants career change, lacks confidence + clear path."

5D. Create Prospect / Prospect Builder — Category Alignment
Replace old fields with system-standard 5 categories:
​

ICP Alignment

Motivation Intensity — "How driven and emotionally motivated is this prospect — how much pain or ambition do they have?"

Prospect Authority & Coachability — "What is the prospect's authority level and how open to being helped are they?"

Funnel Context — "How warm is the prospect when they come onto the call — what have they seen so far and where did they come from?"

Ability to Proceed — "What is the ability of the prospect to proceed today?"

Category order everywhere: ICP Alignment → Motivation Intensity → Prospect Authority & Coachability → Funnel Context → Ability to Proceed.
​

Category titles when clickable → +20% font. Explainer text → larger font + white text color.
​

5E. Prospect Difficulty Banding (Global — Apply Everywhere)
Apply across Call Analysis, Performance, Roleplays, Prospect Builder:
​

≤ 24 = Near Impossible

25–29 = Expert

30–35 = Hard

36–42 = Realistic

43–50 = Easy

Replace any older band variants. This is final.

Acceptance Criteria:
Generated images look like realistic avatars on colored backgrounds (not DSLR/suit photos), styled to match the offer/archetype.

Prospect context is always 8–12 lines, maps to all 5 difficulty markers with 2–3 lines each, AND explicitly reflects the offer context. Never contradictory info.

Prospect cards show 2-line descriptors with demographic + problem.

Create Prospect uses the 5 correct categories in the correct order with white text descriptions.

Difficulty bands are consistent across every single module.