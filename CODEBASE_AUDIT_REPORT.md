# CLOSEPRO CODEBASE AUDIT REPORT

**Generated:** 2026-02-08  
**Scope:** Full state assessment of ClosePro codebase vs Connor's & Rhys's requirements

---

## STEP 1: PROJECT STRUCTURE MAP

### Root Config Files
| File | Description |
|---|---|
| `package.json` | Next.js 16.1.4 app, deps: Anthropic SDK, Groq SDK, Deepgram, better-auth, Drizzle ORM, Recharts, Zod, react-hook-form |
| `next.config.ts` | Next.js config with image domains |
| `drizzle.config.ts` | Drizzle config pointing to `db/schema.ts` |
| `tsconfig.json` | TypeScript config with path aliases |
| `postcss.config.mjs` | PostCSS with Tailwind v4 |
| `proxy.ts` | Dev proxy helper |
| `scope.md` | Feature scope document |

### `/app` — Routes & Pages

| Path | Description |
|---|---|
| `layout.tsx` | Root layout with providers, fonts, metadata |
| `page.tsx` | Landing/marketing page |
| `globals.css` | Global CSS + Tailwind imports |
| `robots.ts` | SEO robots.txt config |
| `sitemap.ts` | SEO sitemap generator |

#### `/app/(auth)` — Auth Pages
| Path | Description |
|---|---|
| `layout.tsx` | Auth layout wrapper |
| `signin/` | Sign-in page with forms |
| `signup/` | Sign-up page with forms |

#### `/app/(dashboard)/dashboard` — Dashboard Pages (29 pages total)
| Path | Description |
|---|---|
| `page.tsx` | Main dashboard with stats cards, date range selector, recent activity |
| `loading.tsx` | Dashboard loading skeleton |
| `billing/page.tsx` | Billing/subscription page |
| `calls/page.tsx` | Calls list page |
| `calls/new/page.tsx` | New call page (Upload & Analyse, Manual, No-Show, Follow-up tabs) |
| `calls/[callId]/page.tsx` | Individual call detail + analysis view |
| `calls/review/page.tsx` | Call review page |
| `create-organization/page.tsx` | Organization creation |
| `manager/page.tsx` | Manager dashboard |
| `manager/categories/page.tsx` | Manager category view |
| `manager/insights/page.tsx` | Manager insights |
| `manager/reps/[repId]/page.tsx` | Individual rep view |
| `manager/team/page.tsx` | Manager team view |
| `offers/page.tsx` | Offers list page |
| `offers/new/page.tsx` | Create new offer form |
| `offers/[offerId]/page.tsx` | Offer detail |
| `offers/[offerId]/edit/page.tsx` | Edit offer |
| `offers/[offerId]/prospects/new/page.tsx` | Create prospect for offer |
| `performance/page.tsx` | Performance page with charts, categories |
| `performance/figures/page.tsx` | Figures/commission page |
| `profile/page.tsx` | User profile page |
| `prospect-avatars/new/page.tsx` | Create new prospect avatar |
| `prospect-avatars/[avatarId]/edit/page.tsx` | Edit prospect avatar |
| `roleplay/page.tsx` | Roleplay sessions list |
| `roleplay/new/page.tsx` | Start new roleplay |
| `roleplay/new/prospect/page.tsx` | Select/create prospect for roleplay |
| `roleplay/[sessionId]/page.tsx` | Active roleplay session |
| `roleplay/[sessionId]/results/page.tsx` | Roleplay results + analysis |
| `settings/page.tsx` | App settings |
| `team/page.tsx` | Team management |

#### `/app/api` — API Routes (17 groups)
| Path | Description |
|---|---|
| `auth/` | Better-auth handler |
| `billing/` | Billing/subscription management |
| `calls/` | Calls CRUD, upload, transcript, manual, follow-up, no-show, webhook |
| `checkout/` | Payment checkout flow |
| `manager/` | Manager-level endpoints |
| `notifications/` | User notifications |
| `offers/` | Offers CRUD + per-offer operations |
| `organizations/` | Organization management |
| `performance/` | Performance stats + figures |
| `profile/` | User profile |
| `prospect-avatars/` | Prospect avatar CRUD + image generation |
| `roleplay/` | Roleplay sessions, messages, restart, extract-prospect |
| `subscription/` | Subscription management |
| `team/` | Team invites and management |
| `tts/` | Text-to-speech (ElevenLabs) |
| `usage/` | Usage tracking |
| `webhooks/` | External webhook handlers |

### `/components`
| Path | Description |
|---|---|
| `ui/` | 54 shadcn/radix UI components |
| `dashboard/` | Dashboard-specific components (skeletons, etc.) |
| `illustrations/` | SVG/illustration components |
| `landing/` | Landing page components |
| `roleplay/` | Roleplay UI components (MomentFeedbackList, etc.) |
| `team/` | Team management components |
| `tour/` | Onboarding tour components |
| `error-boundary.tsx` | Global error boundary |

### `/lib`
| Path | Description |
|---|---|
| `ai/analysis.ts` | Call analysis using Anthropic/Groq with 10-category scoring |
| `ai/scoring-framework.ts` | 10 sales categories + difficulty tiers (canonical definitions) |
| `ai/roleplay.ts` | Roleplay session management |
| `ai/transcription.ts` | Deepgram audio transcription |
| `ai/mock-analysis.ts` | Mock analysis for testing |
| `ai/prospect-avatar-image.ts` | Avatar image generation orchestration |
| `ai/prompts/roleplay-context.ts` | Roleplay prompt templates (⚠️ has wrong categories) |
| `ai/knowledge/real-call-examples.ts` | Real call transcript training data |
| `ai/roleplay/behaviour-rules.ts` | Prospect behaviour adaptation rules |
| `ai/roleplay/funnel-context.ts` | Funnel context for prospect simulation |
| `ai/roleplay/offer-intelligence.ts` | Offer-specific behaviour rules |
| `ai/roleplay/prospect-avatar.ts` | Prospect avatar generation logic |
| `ai/roleplay/roleplay-engine.ts` | Core roleplay AI engine |
| `ai/roleplay/voice-mapping.ts` | ElevenLabs voice mapping by character type |
| `auth.ts` | Better-auth config (email/password only, NO Google OAuth) |
| `auth-client.ts` | Client-side auth hooks |
| `nanobanana.ts` | NanoBanana API client for avatar generation |
| `gemini-image.ts` | Google Gemini image generation |
| `prospect-avatar.ts` | Prospect avatar URL resolver |
| `calls/analyze-call.ts` | Call analysis orchestration |
| `calls/extract-transcript-text.ts` | Transcript text extraction |
| `whop.ts` | Whop payment integration (has bypass logic) |
| `subscription.ts` | Subscription tier management |
| `feature-access.ts` | Feature gating by plan |
| `seed-data.ts` | Seed/demo data generation |
| `plans.ts` | Plan definitions |
| `organizations.ts` | Organization helpers |
| `roleplayApi.ts` | Client-side roleplay API helpers |
| `seo.ts` | SEO utilities |
| `utils.ts` | General utilities (cn) |
| `toast.ts` | Toast notification helpers |
| `dev-mode.ts` | Dev mode flag |

### `/types`
| File | Description |
|---|---|
| `roleplay.ts` | Roleplay types, stage labels, ⚠️ WRONG category names |

### `/db`
| File | Description |
|---|---|
| `index.ts` | Drizzle DB connection |
| `schema.ts` | Full database schema (667 lines, 15+ tables) |

### `/scripts`
| File | Description |
|---|---|
| Various `.js/.sql` | Migration + utility scripts |

---

## STEP 2: DATABASE SCHEMA AUDIT

### Tables & Columns

#### `users`
| Column | Type | Notes |
|---|---|---|
| id | text PK | Better-auth generated |
| email | text UNIQUE | ✅ |
| password | text nullable | ✅ |
| name | text | ✅ |
| role | enum (admin/manager/rep) | ✅ |
| organizationId | uuid FK → organizations | ✅ |
| emailVerified | boolean | ✅ |
| profilePhoto, bio, phone, location, website | text nullable | ✅ Profile fields |
| isTourCompleted | boolean | ✅ |
| commissionRatePct | integer nullable | ✅ Default commission % |
| createdAt, updatedAt | timestamp | ✅ |

#### `organizations`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | ✅ |
| name | text | ✅ |
| planTier | enum (starter/pro/enterprise) | ✅ |
| maxSeats | integer | ✅ |
| isActive | boolean | ✅ |
| trialEndsAt | timestamp nullable | ✅ |

#### `subscriptions`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | ✅ |
| organizationId | uuid FK | ✅ |
| whopSubscriptionId, whopCustomerId, whopPlanId | text | ✅ Whop integration |
| status | enum (active/past_due/canceled/trialing/incomplete/paused) | ✅ |
| planTier | enum | ✅ |
| seats, callsPerMonth, roleplaySessionsPerMonth | integer | ✅ |
| currentPeriodStart/End | timestamp | ✅ |
| cancelAtPeriodEnd, canceledAt | boolean/timestamp | ✅ |

#### `sales_calls`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | ✅ |
| organizationId, userId | FK | ✅ |
| fileName, fileUrl | text | ✅ |
| fileSize, duration | integer | ✅ |
| status | text | uploaded/processing/transcribing/analyzing/completed/failed |
| transcript, transcriptJson | text | ✅ |
| metadata | text JSON | ✅ |
| offerId | uuid FK → offers | ✅ |
| offerType | enum | ✅ |
| callType | enum (closing_call/follow_up/no_show) | ✅ |
| result | enum (no_show/closed/lost/unqualified/follow_up/deposit) | ✅ Correct values |
| qualified | boolean | ⚠️ Still exists in schema (should be removed per spec) |
| cashCollected, revenueGenerated | integer (cents) | ✅ |
| depositTaken | boolean | ✅ |
| reasonForOutcome | text | ✅ |
| analysisIntent | text | ✅ update_figures / analysis_only |
| wasConfirmed, bookingSource | for no-shows | ✅ |
| originalCallId | uuid FK → self | ✅ For follow-ups |
| callDate | timestamp | ✅ Manual backdating |
| prospectName | text | ✅ |
| commissionRatePct | integer | ✅ Per-call commission override |

#### `call_analysis`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | ✅ |
| callId | uuid FK → sales_calls | ✅ |
| overallScore | integer (0-100) | ✅ |
| valueScore, trustScore, fitScore, logisticsScore | integer (0-100) | ⚠️ DEPRECATED but still present |
| valueDetails, trustDetails, fitDetails, logisticsDetails | text JSON | ⚠️ DEPRECATED |
| skillScores | text JSON | ✅ 10-category scores `{ category_id: score }` |
| objectionDetails | text JSON | ✅ Objection breakdown by pillar |
| prospectDifficulty | integer (0-50) | ✅ |
| prospectDifficultyTier | text | ✅ |
| coachingRecommendations | text JSON | ✅ |
| timestampedFeedback | text JSON | ✅ |

#### `payment_plan_instalments`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | ✅ |
| salesCallId | uuid FK → sales_calls | ✅ |
| dueDate | timestamp | ✅ |
| amountCents | integer | ✅ |
| commissionRatePct, commissionAmountCents | integer | ✅ |

#### `offers`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | ✅ |
| organizationId, userId | FK | ✅ |
| name | text | ✅ |
| offerCategory | enum (b2c_health/b2c_relationships/b2c_wealth/mixed_wealth/b2b_services) | ✅ |
| whoItsFor | text | ✅ ICP definition |
| coreOutcome | text | ✅ |
| mechanismHighLevel | text | ✅ |
| deliveryModel | text (dfy/dwy/diy/hybrid) | ✅ |
| customerStage | enum (aspiring/current/mixed) | ✅ |
| coreProblems | text | ✅ Free text for problems |
| desiredOutcome, tangibleOutcomes, emotionalOutcomes | text | ✅ |
| deliverables, paymentOptions | text | ✅ |
| timePerWeek, estimatedTimeToResults | text | ✅ |
| caseStudyStrength | enum (none/weak/moderate/strong) | ✅ |
| guaranteesRefundTerms | text | ✅ |
| primaryFunnelSource | enum | ✅ |
| funnelContextAdditional | text | ✅ |
| coreOfferPrice | text | ✅ Single price field |
| + many legacy fields | text | ✅ Backward compat |

#### `prospect_avatars`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | ✅ |
| organizationId, offerId, userId | FK | ✅ |
| name | text | ✅ |
| sourceType | text (manual/transcript_derived/auto_generated) | ✅ |
| sourceTranscriptId | uuid FK → sales_calls | ✅ |
| positionProblemAlignment | integer (0-10) | ✅ |
| painAmbitionIntensity | integer (0-10) | ✅ |
| perceivedNeedForHelp | integer (0-10) | ✅ |
| authorityLevel | text (advisee/peer/advisor) | ✅ |
| funnelContext | integer (0-10) | ✅ |
| executionResistance | integer (0-10) | ✅ |
| difficultyIndex | integer (0-50) | ✅ |
| difficultyTier | text (easy/realistic/hard/elite/near_impossible) | ✅ |
| avatarUrl | text | ✅ NanoBanana URL |
| positionDescription, voiceStyle | text | ✅ |
| problems, painDrivers, ambitionDrivers | text JSON | ✅ |
| resistanceStyle, behaviouralBaseline | text JSON | ✅ |

#### `roleplay_sessions`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | ✅ |
| organizationId, userId | FK | ✅ |
| mode | text (manual/transcript_replay) | ✅ |
| offerId, prospectAvatarId | FK | ✅ |
| selectedDifficulty, actualDifficultyTier | text | ✅ |
| sourceCallId | uuid FK → sales_calls | ✅ |
| status | text (in_progress/completed/abandoned) | ✅ |
| inputMode | text (text/voice) | ✅ |
| overallScore | integer (0-100) | ✅ |
| analysisId | uuid | ✅ |
| metadata | text JSON | ✅ |

#### `roleplay_messages`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | ✅ |
| sessionId | uuid FK → roleplay_sessions | ✅ |
| role | text (rep/prospect) | ✅ |
| content | text | ✅ |
| messageType | text (text/voice/system) | ✅ |
| audioUrl | text | ✅ |
| timestamp | integer (ms from start) | ✅ |

#### `roleplay_analysis`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | ✅ |
| roleplaySessionId | uuid FK | ✅ |
| overallScore | integer (0-100) | ✅ |
| valueScore, trustScore, fitScore, logisticsScore | integer | ⚠️ DEPRECATED |
| valueDetails, trustDetails, fitDetails, logisticsDetails | text | ⚠️ DEPRECATED |
| skillScores | text JSON | ✅ 10-category |
| prospectDifficulty, prospectDifficultyTier | integer/text | ✅ |
| coachingRecommendations, timestampedFeedback | text JSON | ✅ |
| isIncomplete | boolean | ✅ |
| stagesCompleted | text JSON | ✅ |
| categoryFeedback | text JSON | ✅ Per-category good/missing/improve |
| priorityFixes | text JSON | ✅ 3-5 priority items |
| objectionAnalysis | text JSON | ✅ Detailed objection eval |

#### Other Tables
- `sessions` — Better-auth sessions ✅
- `accounts` — Better-auth social accounts ✅
- `user_organizations` — Many-to-many user↔org ✅
- `usage_tracking` — Monthly usage counters ✅
- `billing_history` — Whop payment events ✅
- `notifications` — User notifications ✅
- `team_invites` — Pending team invites ✅

### Missing from Schema
- No standalone `commissions` table (commission is calculated per-call via `commissionRatePct`)
- No standalone `no_shows` table (no-shows are `sales_calls` with `callType='no_show'`)
- No standalone `follow_ups` table (follow-ups are `sales_calls` with `originalCallId` set)
- `qualified` column still exists on `sales_calls` (should be removed per spec)

---

## STEP 3: API ROUTES AUDIT

| Route | Method | Purpose | Called from Frontend? | Issues |
|---|---|---|---|---|
| `/api/auth/[...all]` | ALL | Better-auth handler | ✅ Yes | None |
| `/api/calls` | GET | List calls with analysis scores | ✅ Yes | None |
| `/api/calls/upload` | POST | Audio file upload + transcription | ✅ Yes | None |
| `/api/calls/transcript` | POST | Text transcript processing | ✅ Yes | None |
| `/api/calls/manual` | POST | Manual call log | ✅ Yes | None |
| `/api/calls/no-show` | POST | No-show log | ✅ Yes | None |
| `/api/calls/follow-up` | POST | Follow-up log | ✅ Yes | None |
| `/api/calls/[callId]` | GET/PUT/DELETE | Call detail CRUD | ✅ Yes | None |
| `/api/calls/[callId]/analyze` | POST | Trigger AI analysis | ✅ Yes | None |
| `/api/calls/webhook` | POST | External webhook | N/A | N/A |
| `/api/roleplay` | GET/POST | List/create roleplay sessions | ✅ Yes | None |
| `/api/roleplay/[sessionId]` | GET/PATCH | Session detail + messages | ✅ Yes | None |
| `/api/roleplay/[sessionId]/messages` | POST | Send message, get AI response | ✅ Yes | None |
| `/api/roleplay/[sessionId]/end` | POST | End session + trigger analysis | ✅ Yes | None |
| `/api/roleplay/[sessionId]/restart` | POST | Re-practice from context | ✅ Yes | None |
| `/api/roleplay/extract-prospect` | POST | Extract prospect from transcript | ✅ Yes | None |
| `/api/offers` | GET/POST | Offers CRUD | ✅ Yes | None |
| `/api/offers/[offerId]` | GET/PUT/DELETE | Offer detail + prospects | ✅ Yes | None |
| `/api/prospect-avatars` | GET/POST | Prospect avatar CRUD | ✅ Yes | None |
| `/api/prospect-avatars/[avatarId]` | GET/PUT/DELETE | Avatar detail + regenerate | ✅ Yes | None |
| `/api/performance` | GET | Performance stats (calls + roleplays) | ✅ Yes | None |
| `/api/performance/figures` | GET | Figures/commission data by month | ✅ Yes | None |
| `/api/tts` | POST | ElevenLabs TTS | ✅ Yes | May fail without API key |
| `/api/profile` | GET/PUT | User profile | ✅ Yes | None |
| `/api/billing` | GET | Billing info | ✅ Yes | None |
| `/api/subscription` | GET | Subscription status | ✅ Yes | None |
| `/api/usage` | GET | Usage tracking | ✅ Yes | None |
| `/api/team/*` | CRUD | Team management | ✅ Yes | None |
| `/api/organizations/*` | CRUD | Organization management | ✅ Yes | None |
| `/api/notifications` | GET/PUT | Notifications | ✅ Yes | None |
| `/api/manager/*` | GET | Manager views | ✅ Yes | None |
| `/api/webhooks` | POST | External webhooks | N/A | N/A |
| `/api/checkout` | POST | Checkout flow | ✅ Yes | None |

**Missing API Routes:** None critical — `/api/dashboard/*` doesn't exist as a separate route; dashboard stats come from `/api/performance`.

---

## STEP 4: FEATURE-BY-FEATURE STATUS CHECK

### 1. DASHBOARD (Section 1.1)

| Item | Status | Notes |
|---|---|---|
| "Total Sessions" → "Total Roleplay Sessions" | ⚠️ PARTIAL | API returns `totalRoleplays`; dashboard label may still say "Total Sessions" |
| "Practice Sessions" → "Average Roleplay Score" | ⚠️ PARTIAL | API returns `averageRoleplayScore`; UI label needs checking |
| Date range selector (week/month/quarter/year) | ✅ DONE | Implemented in dashboard with dropdown |
| Calls Analysed shows real data | ✅ DONE | Fetches from `/api/performance` |
| Average Score shows real data | ✅ DONE | `averageOverall` from API |
| Recent Activity shows real data | ✅ DONE | `recentAnalyses` from API |
| Quick Actions all functional | ✅ DONE | Links to calls/roleplay/offers |

### 2. PERFORMANCE PAGE (Section 1.2)

| Item | Status | Notes |
|---|---|---|
| Split into Sales Calls vs Roleplays sections | ✅ DONE | API returns `salesCallsSummary` and `roleplaysSummary` |
| Sales Calls: Overall Score, Total, Best Category, Improvement | ✅ DONE | In API response |
| Roleplays: duplicated structure | ✅ DONE | In API response |
| Performance Trend 12 weeks (not 7 days) | ✅ DONE | `weeklyData` loops 12 weeks |
| Month-by-month selector | ✅ DONE | Supports `month=YYYY-MM` param |
| Reports downloadable per month | ✅ DONE | `handleDownloadSummary` in page |
| 10 correct sales categories | ✅ DONE | `skillCategories` from API uses `getCategoryLabel` |
| Performance Summary 10-category breakdown | ✅ DONE | Sorted strongest→weakest |
| Objection Handling Insights section | ❌ NOT DONE | No dedicated objection insights in performance API |
| Prospect Difficulty Trends section | ⚠️ PARTIAL | `byDifficulty` in API but no trend chart for difficulty over time |

### 3. FIGURES PAGE (Section 1.3)

| Item | Status | Notes |
|---|---|---|
| Top metrics (Booked/Showed/Qualified/Sales Made) | ✅ DONE | From figures API |
| Rate metrics (Close/Show/Qualified Rate) | ✅ DONE | Calculated in API |
| Revenue metrics (Cash Collected/Revenue/Cash %) | ✅ DONE | In API |
| Visual divider after metrics | ⚠️ PARTIAL | Needs UI verification |
| Commission table (Date/Offer/Prospect/Cash/Revenue/Commission%/Amount) | ✅ DONE | `salesList` from API |
| Commission table exportable as PDF | ❌ NOT DONE | No PDF export in figures page |
| Commission rate per deal (not global) | ✅ DONE | `commissionRatePct` per call |
| Sales data auto-fills from call logs | ✅ DONE | Figures reads from `sales_calls` |

### 4. CALLS (Section 2.1)

| Item | Status | Notes |
|---|---|---|
| Call list columns (Date/Offer/Prospect/Type/Result/Difficulty/Score) | ✅ DONE | All fields in API response |
| Prospect Difficulty auto-populates after analysis | ✅ DONE | `prospectDifficulty` from `call_analysis` |
| Overall Score auto-populates | ✅ DONE | `overallScore` joined from `call_analysis` |
| Upload & Analyse: audio upload | ✅ DONE | `/api/calls/upload` |
| Upload & Analyse: text transcript upload | ✅ DONE | `/api/calls/transcript` |
| Upload & Analyse: pasted transcript | ✅ DONE | Same endpoint |
| After upload: auto-populates Date, Offer, Prospect, Result | ⚠️ PARTIAL | AI suggests outcome; user must confirm |
| Call results: Closed/Lost/Deposit/Follow-up/Unqualified | ✅ DONE | Schema: `no_show/closed/lost/unqualified/follow_up/deposit` |
| "Qualified" checkbox REMOVED | ❌ NOT DONE | `qualified` column still in schema; may still show in UI |
| Payment fields only show if result = Closed | ⚠️ PARTIAL | Needs UI verification |
| Payment Plan option with instalments + monthly amount | ✅ DONE | `payment_plan_instalments` table exists |
| Payment plan creates future cash events in Figures | ✅ DONE | Instalments tracked |
| Commission applied on each instalment date | ✅ DONE | `commissionRatePct` + `commissionAmountCents` per instalment |
| "Reason for Outcome" placeholder updated | ⚠️ PARTIAL | Field exists; placeholder text needs checking |
| Analysis uses 10 correct categories | ✅ DONE | `analysis.ts` uses correct IDs |
| Analysis shows Overall Score out of 100 | ✅ DONE | `overallScore` 0-100 |

### 5. MANUAL CALL LOG (Section 2.2)

| Item | Status | Notes |
|---|---|---|
| Fields: Date/Offer/Prospect/Result | ✅ DONE | `handleManualSubmit` in `calls/new/page.tsx` |
| Assumes closing calls (no call type selector) | ⚠️ PARTIAL | `callType` still in schema; needs UI check |
| "Qualified" checkbox REMOVED | ❌ NOT DONE | Still in schema |
| If Closed: same payment logic | ✅ DONE | Payment plan flow exists |
| "Reason for outcome" field | ✅ DONE | `reasonForOutcome` column |

### 6. NO-SHOW LOG (Section 2.3)

| Item | Status | Notes |
|---|---|---|
| Fields: Date/Offer/Prospect | ✅ DONE | `handleNoShowSubmit` |
| "Was Call Confirmed?" toggle | ✅ DONE | `wasConfirmed` column |
| Booking Source (optional) | ✅ DONE | `bookingSource` column |
| Notes field | ⚠️ PARTIAL | `reasonForOutcome` used as notes; no dedicated notes field |

### 7. FOLLOW-UP LOG (Section 2.4)

| Item | Status | Notes |
|---|---|---|
| "Original Call Date" REMOVED | ⚠️ PARTIAL | Needs UI check — `originalCallId` still used |
| Fields: Prospect/Offer/Follow-up Date/Outcome/Reason | ✅ DONE | `handleFollowUpSubmit` |
| Outcomes: Closed/Lost/No-Show/Further Follow-up | ⚠️ PARTIAL | Uses `callResultEnum`; "Further Follow-up" may not be distinct |
| If Closed: full payment + commission logic | ✅ DONE | Same flow as main calls |

### 8. AI ROLEPLAY (Section 6)

| Item | Status | Notes |
|---|---|---|
| Session list columns (Date/Offer/Prospect/Type/Difficulty/Score) | ✅ DONE | API returns all fields |
| Prospect images PHOTOREALISTIC | ⚠️ PARTIAL | NanoBanana prompt explicitly says "NOT a cartoon"; but depends on API/credits |
| Prospect card: photo, name, bio, difficulty | ✅ DONE | Roleplay session page shows avatar |
| NanoBanana prompt produces headshots (not cartoons) | ✅ DONE | `buildProspectAvatarPrompt` has strong anti-cartoon language |
| Voice matches character | ✅ DONE | `voice-mapping.ts` maps by character type |
| ElevenLabs voice mapping | ✅ DONE | Full mapping in `voice-mapping.ts` |
| Prospect opens realistically | ✅ DONE | `getOpeningLine` in `behaviour-rules.ts` |
| Opening depends on funnel/difficulty/authority | ✅ DONE | `OpeningLineContext` uses all three |
| Incomplete roleplay detection | ✅ DONE | `isIncomplete` + `stagesCompleted` |
| Incomplete shows warning + "Partial" badge | ✅ DONE | In results page |
| Roleplay scoring uses 10 correct categories | ⚠️ PARTIAL | Backend `analysis.ts` uses correct categories, BUT `roleplay-context.ts` SALES_FRAMEWORK_CONTEXT uses WRONG categories |
| Each category scored out of 10, total 100 | ✅ DONE | `skillScores` JSON |
| Results: full category breakdown (good/missing/improve) | ✅ DONE | `categoryFeedback` column |
| Priority Fixes section (3-5 items) | ✅ DONE | `priorityFixes` column |
| Moment-by-moment feedback with timestamps | ✅ DONE | `timestampedFeedback` column |
| "Re-practice from here" button | ✅ DONE | `/api/roleplay/[sessionId]/restart` exists |
| Re-practice creates new session with context | ✅ DONE | Restart API creates new session |
| Objection Analysis section (dedicated) | ✅ DONE | `objectionAnalysis` column |
| Objections classified as Value/Trust/Fit/Logistics | ✅ DONE | `OBJECTION_PILLARS` |
| Transcript upload → prospect creation | ✅ DONE | `/api/roleplay/extract-prospect` |
| Auto-populates prospect description/difficulty | ✅ DONE | Extract-prospect API does this |
| User can edit/confirm before starting | ✅ DONE | Edit prospect page exists |

### 9. SCORING FRAMEWORK

| Item | Status | Notes |
|---|---|---|
| 10 sales categories defined correctly | ✅ DONE | In `scoring-framework.ts` |
| **Exact 10 categories in codebase:** | | |
| 1. Authority & Leadership | ✅ | `authority_leadership` |
| 2. Structure & Framework | ✅ | `structure_framework` |
| 3. Communication & Storytelling | ✅ | `communication_storytelling` |
| 4. Discovery Depth & Diagnosis | ✅ | `discovery_diagnosis` |
| 5. Gap & Urgency | ✅ | `gap_urgency` |
| 6. Value & Offer Positioning | ✅ | `value_offer_positioning` |
| 7. Trust, Safety & Ethics | ✅ | `trust_safety_ethics` |
| 8. Adaptation & Calibration | ✅ | `adaptation_calibration` |
| 9. Objection Handling & Preemption | ✅ | `objection_handling` |
| 10. Closing & Commitment Integrity | ✅ | `closing_commitment` |
| Old incorrect categories removed from ALL prompts | 🐛 BROKEN | **Still in `roleplay-context.ts` and `types/roleplay.ts`** |
| Scoring consistent across call analysis, roleplay, performance | ⚠️ PARTIAL | `analysis.ts` correct; `roleplay-context.ts` wrong |
| Categories reference Connor's knowledge docs | ✅ DONE | `real-call-examples.ts` integrated |

### 10. PROSPECT DIFFICULTY MODEL

| Item | Status | Notes |
|---|---|---|
| 5 difficulty dimensions (1-10 each) | ✅ DONE | All in `prospect_avatars` schema |
| Difficulty bands (Easy 42-50 / Realistic 36-41 / Hard 30-35 / Elite 25-29) | ✅ DONE | In `scoring-framework.ts` |
| Authority types (Advisee/Peer/Advisor) with rules | ✅ DONE | In `behaviour-rules.ts` |
| Dynamic behaviour (changes during call) | ✅ DONE | `adaptBehaviour` in roleplay engine |
| Difficulty fixed at call start | ✅ DONE | Difficulty doesn't change mid-call |
| Integrated into roleplay system prompts | ✅ DONE | Full difficulty context in system prompt |
| Integrated into call analysis | ✅ DONE | `prospectDifficulty` section in analysis prompt |
| Reporting shows difficulty distribution | ✅ DONE | `byDifficulty` in performance API |

### 11. RHYS'S ADDITIONAL CHANGES

| Item | Status | Notes |
|---|---|---|
| Offers page: 3 offers for every new sign up | ❌ NOT DONE | No auto-creation of 3 offers for new users |
| Create offer form: Section 1 (ICP), Section 2 (Goals), Section 3 (Roadblocks) | ⚠️ PARTIAL | Form exists with fields but section organization needs checking |
| ICP section: text placeholder + customer stage box | ✅ DONE | `customerStage` enum + `whoItsFor` field |
| Creating Prospect: Position/Problems merged into 1 box | ⚠️ PARTIAL | Both fields exist separately; may need UI merge |
| Prospect text placeholder: "Working as electrician..." | ❌ NOT DONE | Placeholder text not verified |
| During Roleplay display layout changed (RepArena-style) | ⚠️ PARTIAL | Basic layout exists but may not match screenshot |
| Roleplay UI: "You" section has camera toggle | ✅ DONE | `toggleCamera` function in roleplay session page |
| RepArena layout (prospect right, You left, Audio/Camera toggle) | ⚠️ PARTIAL | Camera toggle exists; layout arrangement needs UI check |
| "Objection Handling" label removed from prospect area | ⚠️ PARTIAL | Needs UI verification |
| Call analysis voice feature | ❌ NOT DONE | No voice input for call analysis (only transcript) |
| Figures boxes auto-filled (not dashes) | ⚠️ PARTIAL | API returns data; UI may show dashes when no data |

### 12. KNOWLEDGE BASE INTEGRATION

| Item | Status | Notes |
|---|---|---|
| Transcript training data integrated | ✅ DONE | `real-call-examples.ts` (17KB) |
| `real-call-examples.ts` exists | ✅ DONE | In `lib/ai/knowledge/` |
| Roleplay prompts reference real call examples | ✅ DONE | `ROLEPLAY_PROMPT_CONTEXT` uses `getCondensedExamples` |
| Call analysis prompts reference real call examples | ⚠️ PARTIAL | `ANALYSIS_PROMPT_CONTEXT` exists but may not be injected into main `buildAnalysisPrompt` |
| Prospect Difficulty Model document integrated | ✅ DONE | Implemented in code, no separate `.ts` doc file |
| `prospect-difficulty-model.ts` exists | ❌ NOT DONE | No standalone file; model is spread across `behaviour-rules.ts` and `scoring-framework.ts` |

### 13. AUTH & DEPLOYMENT

| Item | Status | Notes |
|---|---|---|
| Google OAuth support | ❌ NOT DONE | `auth.ts` only has `emailAndPassword` — no Google socialProviders |
| Whop payment bypass for testing | ✅ DONE | `lib/whop.ts` has bypass logic |
| Environment variables for production | ✅ DONE | `.env.example` with 2263 bytes |
| Build passes (`npm run build`) | ⚠️ UNKNOWN | Not tested in this audit — requires running the command |

---

## STEP 5: AI PROMPT AUDIT

### Files Containing AI System Prompts

| File | Purpose | Categories Used | Correct? | Difficulty Model? | Real Examples? |
|---|---|---|---|---|---|
| `lib/ai/analysis.ts` | Call analysis (Groq/Anthropic) | ✅ 10 correct categories (authority_leadership, etc.) | ✅ YES | ✅ Yes (full 50-point model in prompt) | ❌ Not directly in prompt |
| `lib/ai/roleplay/roleplay-engine.ts` | Roleplay prospect responses | N/A (behaviour-based, not scoring) | N/A | ✅ Yes (difficulty context) | ❌ Not directly |
| `lib/ai/prompts/roleplay-context.ts` | Roleplay analysis context templates | 🐛 **WRONG** categories (Opening & Rapport, Discovery & Qualification, Need Identification, etc.) | 🐛 **NO** | ✅ Yes | ✅ Yes (`getCondensedExamples`) |
| `lib/ai/roleplay/offer-intelligence.ts` | Offer-specific behaviour rules | N/A (scoring weights only) | N/A | ⚠️ Partial | ❌ No |
| `lib/ai/roleplay/behaviour-rules.ts` | Prospect behaviour adaptation | N/A | N/A | ✅ Yes | ❌ No |
| `lib/ai/roleplay/funnel-context.ts` | Funnel context for prospects | N/A | N/A | N/A | ❌ No |
| `lib/ai/roleplay/voice-mapping.ts` | ElevenLabs voice selection | N/A | N/A | N/A | N/A |
| `types/roleplay.ts` | Frontend type definitions | 🐛 **WRONG** categories (opening_and_rapport, etc.) | 🐛 **NO** | N/A | N/A |

### Wrong Categories Found

**`lib/ai/prompts/roleplay-context.ts` — `SALES_FRAMEWORK_CONTEXT`:**
1. Opening & Rapport
2. Discovery & Qualification
3. Need Identification
4. Pitch & Presentation
5. Objection Handling
6. Value Building
7. Trust Building
8. Urgency & Scarcity
9. Closing Instinct
10. Overall Call Control

**`types/roleplay.ts` — `SALES_CATEGORIES` & `CATEGORY_LABELS`:**
- `opening_and_rapport`, `discovery_and_qualification`, `need_identification`, etc.

> [!CAUTION]
> These WRONG categories are used in the roleplay analysis context prompt (`ANALYSIS_PROMPT_CONTEXT` in `roleplay-context.ts`). If this context is injected into roleplay analysis prompts, the AI may score using the wrong categories. The main `analysis.ts` correctly uses `scoring-framework.ts` categories, but there's a conflict.

---

## STEP 6: FRONTEND COMPONENT AUDIT

| Page | Renders? | Real Data? | Fields Match Spec? | Issues |
|---|---|---|---|---|
| Dashboard (`/dashboard`) | ✅ Yes | ✅ Yes | ⚠️ Labels may not match spec exactly | Label changes needed |
| Performance (`/performance`) | ✅ Yes | ✅ Yes | ✅ Mostly | Missing Objection Handling Insights section |
| Figures (`/performance/figures`) | ✅ Yes | ✅ Yes | ⚠️ Mostly | No PDF export; may show dashes with no data |
| Calls List (`/calls`) | ✅ Yes | ✅ Yes | ✅ Yes | None |
| New Call (`/calls/new`) | ✅ Yes | ✅ Yes | ⚠️ Partial | Qualified checkbox may still show |
| Roleplay List (`/roleplay`) | ✅ Yes | ✅ Yes | ✅ Yes | None |
| Active Roleplay (`/roleplay/[id]`) | ✅ Yes | ✅ Yes | ⚠️ Partial | Layout may not match RepArena style |
| Roleplay Results (`/roleplay/[id]/results`) | ✅ Yes | ✅ Yes | ⚠️ Partial | Uses types/roleplay.ts wrong categories for display |
| Prospects (`/prospect-avatars/new`) | ✅ Yes | ✅ Yes | ⚠️ Partial | Placeholder text not updated |
| Offers List (`/offers`) | ✅ Yes | ✅ Yes | ✅ Yes | No auto-3-offer creation |
| Create Offer (`/offers/new`) | ✅ Yes | ✅ Yes | ⚠️ Partial | Form sections may not match Rhys's spec |
| Profile (`/profile`) | ✅ Yes | ✅ Yes | ✅ Yes | None |

---

## STEP 7: SUMMARY REPORT

### Feature Status Summary

| Feature Area | Total Items | ✅ Done | ⚠️ Partial | ❌ Missing | 🐛 Broken |
|---|---|---|---|---|---|
| Dashboard | 7 | 5 | 2 | 0 | 0 |
| Performance Page | 10 | 7 | 1 | 1 | 0 |
| Figures Page | 8 | 5 | 1 | 1 | 0 |
| Calls | 16 | 10 | 4 | 1 | 0 |
| Manual Call Log | 5 | 3 | 1 | 1 | 0 |
| No-Show Log | 4 | 3 | 1 | 0 | 0 |
| Follow-Up Log | 4 | 2 | 2 | 0 | 0 |
| AI Roleplay | 22 | 18 | 3 | 0 | 1 |
| Scoring Framework | 5 | 3 | 1 | 0 | 1 |
| Prospect Difficulty Model | 8 | 8 | 0 | 0 | 0 |
| Rhys's Changes | 11 | 2 | 5 | 3 | 0 |
| Knowledge Base | 6 | 4 | 1 | 1 | 0 |
| Auth & Deployment | 4 | 2 | 1 | 1 | 0 |
| **TOTALS** | **110** | **72** | **23** | **9** | **2** |

### npm run build Status

⚠️ **NOT TESTED** — Needs to be run to verify. Last known issues from conversation history suggest TypeScript errors may exist.

---

### TOP 10 HIGHEST PRIORITY FIXES

| # | Priority | Issue | Impact | Files to Change |
|---|---|---|---|---|
| **1** | 🐛 CRITICAL | **Wrong 10 categories in `roleplay-context.ts`** — SALES_FRAMEWORK_CONTEXT uses old categories (Opening & Rapport, etc.) instead of correct ones (Authority & Leadership, etc.) | Roleplay analysis may score using wrong framework when this context is injected | `lib/ai/prompts/roleplay-context.ts` |
| **2** | 🐛 CRITICAL | **Wrong 10 categories in `types/roleplay.ts`** — `SALES_CATEGORIES` and `CATEGORY_LABELS` use old IDs. Frontend results page displays wrong category names | Roleplay results show wrong category labels to users | `types/roleplay.ts` |
| **3** | ❌ BLOCKING | **No Google OAuth** — `lib/auth.ts` only configures email/password. Google social login is missing entirely | Users can't sign in with Google | `lib/auth.ts` |
| **4** | ❌ MISSING | **Figures PDF export** — No PDF generation/export for commission table | Connor/Rhys requirement not met | `app/(dashboard)/dashboard/performance/figures/page.tsx` |
| **5** | ❌ MISSING | **3 default offers for new signups** — No auto-creation logic exists | Rhys requirement not met | `app/api/auth/` or `app/(dashboard)/` |
| **6** | ❌ MISSING | **Performance: Objection Handling Insights section** — Not in API or UI | Connor requirement not met | `app/api/performance/route.ts`, performance page |
| **7** | ⚠️ HIGH | **"Qualified" checkbox still in schema** — `qualified` boolean on `sales_calls` should be removed per spec. May still show in UI | Confusing UX, wrong data being collected | `db/schema.ts`, `calls/new/page.tsx` |
| **8** | ⚠️ HIGH | **Call analysis voice feature broken** — Per Rhys, voice analysis not working. No voice input for call analysis exists | Key feature not functional | Needs new voice recording UI + integration |
| **9** | ⚠️ MEDIUM | **Prospect avatar images may still be cartoons** — NanoBanana prompt is correct, but existing avatars may have cartoon URLs cached. Need to clear old URLs and regenerate | Visual quality issue flagged by Connor | Database: clear old `avatarUrl` values |
| **10** | ⚠️ MEDIUM | **Roleplay layout doesn't match RepArena style** — Camera toggle exists but overall layout may not match Rhys's screenshots (prospect card right, "You" left) | UI polish issue from Rhys | `app/(dashboard)/dashboard/roleplay/[sessionId]/page.tsx` |

### Additional Items Needing Attention

| # | Priority | Issue |
|---|---|---|
| 11 | LOW | `prospect-difficulty-model.ts` standalone file doesn't exist (model is in code but not as a doc) |
| 12 | LOW | Real call examples not injected into main `buildAnalysisPrompt` in `analysis.ts` |
| 13 | LOW | `ANALYSIS_PROMPT_CONTEXT` from `roleplay-context.ts` may not be used by `analysis.ts` at all |
| 14 | LOW | Dashboard label changes ("Total Roleplay Sessions", "Average Roleplay Score") need verification |
| 15 | LOW | Offer creation form section organization (ICP/Goals/Roadblocks) needs UI matching to Rhys's spec |
| 16 | LOW | Prospect builder: merge Position Description + Problems into 1 box per Rhys |
| 17 | LOW | Prospect text placeholder update ("Working as electrician...") |
| 18 | LOW | Follow-up log: "Further Follow-up" outcome type may not be distinct from follow_up result |
