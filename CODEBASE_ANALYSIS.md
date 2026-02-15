# ClosePro — Complete Codebase Analysis

## 1. Architecture Overview

### Tech Stack
- **Framework**: Next.js 16.1.4 (App Router, Turbopack for dev, Webpack for prod)
- **Language**: TypeScript 5.x
- **Database**: PostgreSQL (Neon) via Drizzle ORM 0.37
- **Auth**: better-auth 1.2.6 (email/password + Google OAuth)
- **UI**: React 19.2.3, Shadcn UI (Radix primitives), Tailwind CSS 4
- **AI**: Groq (llama-3.3-70b for roleplay), Anthropic Claude (fallback), Deepgram (transcription), Gemini 2.5 Flash (image gen)
- **TTS**: ElevenLabs (text-to-speech for roleplay)
- **Payments**: Whop (subscription billing)
- **Storage**: Vercel Blob (audio files, avatar images)
- **Deployment**: Vercel (Hobby plan, 300s max function timeout)
- **Charts**: Recharts 2.15

### Folder Structure
```
app/
├── (auth)/                    # Auth pages (signin, signup)
├── (dashboard)/               # Dashboard pages (all protected)
│   ├── dashboard/
│   │   ├── calls/             # Call upload, list, detail, confirm, review
│   │   ├── offers/            # Offer CRUD
│   │   ├── roleplay/          # Roleplay session, new, results
│   │   ├── performance/       # Performance analytics + figures
│   │   ├── manager/           # Manager dashboard (team, insights)
│   │   ├── profile/           # User profile
│   │   ├── settings/          # Settings + transcripts
│   │   ├── team/              # Team management
│   │   ├── billing/           # Billing/subscription
│   │   ├── support/           # Support page
│   │   └── create-organization/
│   ├── pricing/               # Pricing page
│   └── layout.tsx             # Dashboard layout (sidebar + header)
├── api/                       # API routes (see section 3)
├── layout.tsx                 # Root layout (ThemeProvider, Sonner)
└── page.tsx                   # Landing page

components/
├── call-review/               # Shared analysis components (7 files)
├── dashboard/                 # Dashboard UI (header, sidebar, panels)
├── roleplay/                  # Roleplay-specific components (6 files)
├── illustrations/             # SVG illustrations for empty states
├── landing/                   # Landing page components
├── team/                      # Team invite dialog
├── tour/                      # Onboarding tour system
└── ui/                        # Shadcn UI primitives (~50 files)

lib/
├── ai/
│   ├── analysis.ts            # Core analysis engine (DO NOT MODIFY)
│   ├── scoring-framework.ts   # 10-category scoring re-exports
│   ├── transcription.ts       # Deepgram + AssemblyAI
│   ├── extract-call-details.ts
│   ├── mock-analysis.ts
│   ├── prospect-avatar-image.ts
│   ├── knowledge/             # AI knowledge docs (3 files)
│   ├── prompts/               # Roleplay context prompts
│   └── roleplay/              # Roleplay engine (7 files)
├── calls/
│   ├── analyze-call.ts        # Orchestrates analysis + DB storage
│   └── extract-transcript-text.ts
├── training/                  # Connor's framework (6 files)
├── tts/                       # TTS provider + ElevenLabs client
├── auth.ts                    # Server-side auth config
├── auth-client.ts             # Client-side auth
├── plans.ts                   # Plan tiers + features
├── subscription.ts            # Subscription checks + usage
├── feature-access.ts          # Feature gating
├── whop.ts                    # Whop API integration
├── gemini-image.ts            # Gemini image generation
├── prospect-avatar.ts         # Avatar URL resolution
├── organizations.ts           # Org helpers
├── utils.ts                   # cn() utility
├── toast.ts                   # Toast wrapper
├── dev-mode.ts                # Dev mode bypass
├── seo.ts                     # SEO metadata
├── nanobanana.ts              # NanoBanana avatar (legacy)
├── seed-data.ts               # Demo data seeder
└── roleplayApi.ts             # Client-side roleplay API

db/
├── schema.ts                  # Complete database schema (730 lines)
└── index.ts                   # Drizzle client + postgres connection

contexts/
└── user-context.tsx           # UserProvider (profile caching)

hooks/
├── use-call-analysis.ts       # Call analysis polling hook
├── use-confirm-dialog.tsx     # Confirmation dialog hook
├── use-debounce.ts
├── use-mobile.ts
└── use-transcription.ts       # Transcription hook
```

### NPM Scripts
| Script | Command |
|--------|---------|
| `dev` | `next dev` (Turbopack) |
| `build` | `next build` |
| `postbuild` | `drizzle-kit push` (auto-migrate on deploy) |
| `start` | `next start` |
| `lint` | `eslint` |
| `db:generate` | `drizzle-kit generate` |
| `db:migrate` | `drizzle-kit migrate` |
| `db:push` | `drizzle-kit push` |
| `db:studio` | `drizzle-kit studio` |

### Next.js Config
- `typescript.ignoreBuildErrors: true` (builds with TS errors)
- Turbopack enabled for dev
- Webpack: excludes `canvas` and `fs` from server bundles
- No middleware.ts — auth is checked per-route in API handlers

---

## 2. Database Schema

### Tables (16 total)

#### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | text PK | Better-auth generated |
| email | text NOT NULL UNIQUE | |
| password | text | Nullable (OAuth users) |
| name | text NOT NULL | |
| role | enum('admin','manager','rep') | Default 'rep' |
| organizationId | uuid FK→organizations | Primary org |
| emailVerified | boolean | Default false |
| profilePhoto | text | URL |
| bio, phone, location, website | text | Profile fields |
| isTourCompleted | boolean | Default false |
| commissionRatePct | integer | Default commission % (0-100) |
| createdAt, updatedAt | timestamp | |

#### `organizations`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text NOT NULL | |
| planTier | enum('starter','pro','enterprise') | Default 'starter' |
| maxSeats | integer | Default 5 |
| isActive | boolean | Default true |
| trialEndsAt | timestamp | |

#### `user_organizations` (junction)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| userId | text FK→users | |
| organizationId | uuid FK→organizations | |
| role | enum | Role in this org |
| isPrimary | boolean | |

#### `subscriptions`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organizationId | uuid FK→organizations | |
| whopSubscriptionId | text UNIQUE | Whop integration |
| whopCustomerId, whopPlanId | text | |
| status | enum('active','past_due','canceled','trialing','incomplete','paused') | |
| planTier | enum | |
| seats | integer | Default 5 |
| callsPerMonth | integer | Default 50 |
| roleplaySessionsPerMonth | integer | Default 0 |
| currentPeriodStart/End | timestamp | |
| cancelAtPeriodEnd | boolean | |

#### `sessions` (better-auth)
| Column | Type |
|--------|------|
| id | text PK |
| userId | text FK→users |
| expiresAt | timestamp |
| token | text UNIQUE |

#### `accounts` (better-auth social)
| Column | Type |
|--------|------|
| id | text PK |
| userId | text FK→users |
| accountId, providerId | text |
| accessToken, refreshToken, idToken | text |

#### `sales_calls`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organizationId | uuid FK→organizations | |
| userId | text FK→users | Rep who made call |
| fileName, fileUrl | text NOT NULL | Audio file |
| fileSize | integer | Bytes |
| duration | integer | Seconds |
| status | text | 'uploaded','processing','transcribing','analyzing','pending_confirmation','completed','failed','manual' |
| transcript | text | Full text |
| transcriptJson | text | JSON with speaker diarization |
| metadata | text | JSON |
| offerId | uuid FK→offers | |
| offerType | enum | |
| callType | enum('closing_call','follow_up','no_show','roleplay') | |
| result | enum('no_show','closed','lost','unqualified','follow_up','deposit','payment_plan','follow_up_result') | |
| qualified | boolean | |
| cashCollected | integer | Cents |
| revenueGenerated | integer | Cents |
| depositTaken | boolean | |
| reasonForOutcome | text | Mandatory text |
| reasonTag | text | Pre-populated tag |
| analysisIntent | text | 'update_figures' or 'analysis_only' |
| originalCallId | uuid FK→sales_calls | For follow-ups |
| callDate | timestamp | Manual backdating |
| prospectName | text | |
| commissionRatePct | integer | Per-call override |
| addToSalesFigures | boolean | Default true |
| extractedDetails | text | JSON from AI extraction |

#### `call_analysis`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| callId | uuid FK→sales_calls | |
| overallScore | integer | 0-100 |
| valueScore, trustScore, fitScore, logisticsScore | integer | 4 pillars (0-100) |
| valueDetails, trustDetails, fitDetails, logisticsDetails | text | JSON |
| skillScores | text | JSON: `{authority: 7, structure: 8, ...}` (10 categories) |
| objectionDetails | text | JSON array |
| prospectDifficulty | integer | 0-50 |
| prospectDifficultyTier | text | easy/realistic/hard/expert |
| coachingRecommendations | text | JSON array |
| timestampedFeedback | text | JSON array |
| outcomeDiagnostic | text | v1 narrative |
| categoryFeedback | text | v1 per-category JSON |
| momentCoaching | text | v1 JSON array |
| priorityFixes | text | v1 JSON array |
| **phaseScores** | text | v2: `{overall, intro, discovery, pitch, close, objections}` |
| **phaseAnalysis** | text | v2: per-phase analysis JSON |
| outcomeDiagnosticP1, outcomeDiagnosticP2 | text | v2: cause-effect + context |
| closerEffectiveness | text | 'above/at/below_expectation' |
| prospectDifficultyJustifications | text | v2: per-dimension JSON |
| actionPoints | text | v2: JSON array (max 3) |

#### `payment_plan_instalments`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| salesCallId | uuid FK→sales_calls | |
| instalmentNumber | integer | 1, 2, 3... |
| dueDate | timestamp NOT NULL | |
| amountCents | integer NOT NULL | |
| status | text | 'pending','collected','missed','refunded' |
| collectedDate | timestamp | |
| commissionRatePct | integer | |
| commissionAmountCents | integer | |

#### `offers`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organizationId | uuid FK→organizations | |
| userId | text FK→users | Creator |
| name | text NOT NULL | |
| offerCategory | enum | b2c_health/b2c_relationships/b2c_wealth/mixed_wealth/b2b_services |
| whoItsFor, coreOutcome, mechanismHighLevel | text NOT NULL | |
| deliveryModel | text NOT NULL | 'dfy','dwy','diy','hybrid' |
| coreOfferPrice | text | Single price (new) |
| priceRange | text | Legacy |
| customerStage | enum | 'aspiring','current','mixed' |
| coreProblems, desiredOutcome, tangibleOutcomes, emotionalOutcomes | text | |
| deliverables, paymentOptions, timePerWeek | text | |
| estimatedTimeToResults | text | |
| caseStudyStrength | enum | 'none','weak','moderate','strong' |
| guaranteesRefundTerms | text | |
| primaryFunnelSource | enum | |
| (many legacy fields) | text | Backward compat |

#### `prospect_avatars`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organizationId | uuid FK→organizations | |
| offerId | uuid FK→offers | All prospects belong to an offer |
| userId | text FK→users | Creator |
| name | text NOT NULL | |
| sourceType | text | 'manual','transcript_derived','auto_generated' |
| positionProblemAlignment | integer NOT NULL | 0-10 |
| painAmbitionIntensity | integer NOT NULL | 0-10 |
| perceivedNeedForHelp | integer NOT NULL | 0-10 |
| authorityLevel | text NOT NULL | 'advisee','peer','advisor' |
| funnelContext | integer NOT NULL | 0-10 |
| executionResistance | integer | 0-10, default 5 |
| difficultyIndex | integer NOT NULL | 0-50 |
| difficultyTier | text NOT NULL | 'easy','realistic','hard','expert' |
| avatarUrl | text | Gemini-generated or NanoBanana |
| positionDescription, voiceStyle | text | |
| problems, painDrivers, ambitionDrivers | text | JSON arrays |

#### `roleplay_sessions`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organizationId | uuid FK | |
| userId | text FK | |
| mode | text | 'manual','transcript_replay' |
| offerId | uuid FK→offers | |
| prospectAvatarId | uuid FK→prospect_avatars | |
| selectedDifficulty | text | User selection |
| actualDifficultyTier | text | From avatar |
| sourceCallId | uuid FK→sales_calls | For replays |
| status | text | 'in_progress','completed','abandoned' |
| inputMode | text | 'text','voice' |
| overallScore | integer | 0-100 |
| analysisId | uuid | FK to roleplay_analysis |
| metadata | text | JSON (behaviourState, pinnedMessageIds, notes) |
| replayPhase | text | intro/discovery/pitch/close/objection/skill |
| replaySourceCallId, replaySourceSessionId | text | |
| replayContext | text | JSON: phase feedback + prospect profile |

#### `roleplay_messages`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| sessionId | uuid FK→roleplay_sessions | |
| role | text | 'rep','prospect' |
| content | text NOT NULL | |
| messageType | text | 'text','voice','system' |
| audioUrl | text | |
| timestamp | integer | Ms from session start |
| metadata | text | JSON (sentiment, objectionType) |

#### `roleplay_analysis`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| roleplaySessionId | uuid FK→roleplay_sessions | |
| overallScore | integer | 0-100 |
| valueScore, trustScore, fitScore, logisticsScore | integer | DEPRECATED (v1) |
| skillScores | text | JSON 10-category scores |
| prospectDifficulty, prospectDifficultyTier | | |
| categoryFeedback | text | Per-category feedback |
| priorityFixes | text | JSON array |
| objectionAnalysis | text | JSON |
| phaseScores, phaseAnalysis | text | v2 |
| outcomeDiagnosticP1, outcomeDiagnosticP2 | text | v2 |
| closerEffectiveness | text | v2 |
| actionPoints | text | v2 JSON array |
| roleplayFeedback | text | 5-dimension feedback |

#### `training_transcripts`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| userId | text FK→users | |
| organizationId | text FK→organizations | |
| title | text NOT NULL | |
| rawTranscript | text NOT NULL | |
| extractedPatterns | text | JSON |
| tags | text | JSON array |
| status | text | 'uploaded','processing','processed','error' |
| wordCount | integer | |

#### Other tables: `usage_tracking`, `billing_history`, `notifications`, `team_invites`

### Entity Relationships (Text ERD)
```
organizations ──< user_organizations >── users
organizations ──< subscriptions
organizations ──< usage_tracking
organizations ──< billing_history
organizations ──< notifications
organizations ──< team_invites
organizations ──< sales_calls
organizations ──< offers
organizations ──< prospect_avatars
organizations ──< roleplay_sessions

users ──< sales_calls
users ──< roleplay_sessions
users ──< training_transcripts
users ──< notifications

sales_calls ──< call_analysis (1:1)
sales_calls ──< payment_plan_instalments
sales_calls ──o sales_calls (originalCallId self-ref for follow-ups)
sales_calls ──o offers

offers ──< prospect_avatars
offers ──< roleplay_sessions

prospect_avatars ──< roleplay_sessions
roleplay_sessions ──< roleplay_messages
roleplay_sessions ──< roleplay_analysis (1:1 via analysisId)
```

---

## 3. API Reference

### Auth
| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/auth/[...all]` | ALL | No | Better-auth catch-all (login, signup, session) |

### Calls
| Endpoint | Method | Auth | maxDuration | Purpose |
|----------|--------|------|------------|---------|
| `/api/calls` | GET | Yes | — | List user's calls (filters out transcribing/pending_confirmation/analyzing) |
| `/api/calls/upload` | POST | Yes | — | Upload audio file → Vercel Blob → start transcription |
| `/api/calls/upload-blob` | POST | Yes | — | Alternative blob upload |
| `/api/calls/transcript` | POST | Yes | 120s | Transcribe audio file via Deepgram |
| `/api/calls/manual` | POST | Yes | — | Create manual call entry (no audio) |
| `/api/calls/no-show` | POST | Yes | — | Create no-show call entry |
| `/api/calls/follow-up` | POST | Yes | — | Create follow-up linked to original call |
| `/api/calls/[callId]` | GET | Yes | — | Get single call details |
| `/api/calls/[callId]` | PATCH | Yes | — | Update call fields |
| `/api/calls/[callId]` | DELETE | Yes | — | Delete call |
| `/api/calls/[callId]/status` | GET | Yes | — | Get call status + analysis (used by polling) |
| `/api/calls/[callId]/confirm` | POST | Yes | 120s | Confirm call details → triggers AI analysis |
| `/api/calls/[callId]/analyze` | POST | Yes | 120s | Re-analyze a call |
| `/api/calls/[callId]/outcome` | PATCH | Yes | — | Update call outcome |
| `/api/calls/webhook/transcription` | POST | No | — | Transcription webhook callback |

### Performance
| Endpoint | Method | Auth | maxDuration | Purpose |
|----------|--------|------|------------|---------|
| `/api/performance` | GET | Yes | 60s | Skill breakdown, principle scores, action steps. Query: `month=YYYY-MM` or `range=all_time` |
| `/api/performance/figures` | GET | Yes | 60s | Sales figures for a month. Query: `month=YYYY-MM` |

### Roleplay
| Endpoint | Method | Auth | maxDuration | Purpose |
|----------|--------|------|------------|---------|
| `/api/roleplay` | GET | Yes | — | List all roleplay sessions |
| `/api/roleplay` | POST | Yes | — | Create new session (accepts replay params) |
| `/api/roleplay/[sessionId]` | GET | Yes | — | Get session details + messages + analysis |
| `/api/roleplay/[sessionId]/message` | POST | Yes | 60s | Send message → get AI prospect response |
| `/api/roleplay/[sessionId]/score` | POST | Yes | 120s | End session + run AI scoring |
| `/api/roleplay/[sessionId]/restart` | POST | Yes | — | Restart session (clear messages, reset state) |
| `/api/roleplay/replay` | POST | Yes | — | Create replay session from call transcript |
| `/api/roleplay/extract-prospect` | POST | Yes | — | Extract prospect avatar from call transcript |

### Offers
| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/offers` | GET | Yes | List org's offers |
| `/api/offers` | POST | Yes | Create new offer |
| `/api/offers/[offerId]` | GET | Yes | Get offer details |
| `/api/offers/[offerId]` | PUT | Yes | Update offer |
| `/api/offers/[offerId]` | DELETE | Yes | Delete offer |
| `/api/offers/[offerId]/prospects` | GET | Yes | List prospects for offer |
| `/api/offers/[offerId]/prospects` | POST | Yes | Create prospect avatar |
| `/api/offers/[offerId]/prospects/generate` | POST | Yes (300s) | Generate AI prospect avatar + image |

### Prospect Avatars
| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/prospect-avatars` | GET | Yes | List all prospect avatars |
| `/api/prospect-avatars/[avatarId]` | GET/PUT/DELETE | Yes | CRUD |
| `/api/prospect-avatars/[avatarId]/generate-avatar` | POST | Yes (300s) | Generate avatar image via Gemini |

### Profile & Team
| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/profile` | GET/PATCH | Yes | Get/update user profile |
| `/api/profile/photo` | POST | Yes | Upload profile photo |
| `/api/team` | GET | Yes | List team members |
| `/api/team` | POST | Yes | Add team member |
| `/api/team/[memberId]` | DELETE | Yes | Remove team member |
| `/api/team/invite` | POST | Yes | Send team invite |
| `/api/team/invite/[inviteId]` | PUT | Yes | Accept/decline invite |
| `/api/team/invites` | GET | Yes | List pending invites |

### Manager
| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/manager/reps` | GET | Yes | List managed reps |
| `/api/manager/reps/[repId]` | GET | Yes | Get rep details + performance |
| `/api/manager/categories` | GET | Yes | Category-level team analytics |
| `/api/manager/team-performance` | GET | Yes | Aggregated team performance |

### Billing & Subscriptions
| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/billing` | GET | Yes | Get billing info + history |
| `/api/checkout` | POST | Yes | Create Whop checkout URL |
| `/api/subscription/check` | GET | Yes | Check subscription status |
| `/api/usage/check` | GET | Yes | Check usage limits |
| `/api/usage/track` | POST | Yes | Increment usage counter |
| `/api/webhooks/whop` | POST | No | Whop webhook handler |

### Other
| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/organizations` | GET/POST | Yes | Org CRUD |
| `/api/organizations/list` | GET | Yes | List user's orgs |
| `/api/organizations/switch` | POST | Yes | Switch active org |
| `/api/notifications` | GET/PATCH | Yes | Notifications |
| `/api/tts` | POST | Yes | ElevenLabs TTS |
| `/api/training/transcripts` | GET/POST/DELETE | Yes | Training transcript CRUD |

---

## 4. Page Map

| Route | Purpose | API Dependencies |
|-------|---------|-----------------|
| `/` | Landing page | None |
| `/signin` | Sign in | `/api/auth` |
| `/signup` | Sign up | `/api/auth` |
| `/pricing` | Pricing tiers | None |
| `/dashboard` | Main dashboard (stats overview) | `/api/calls`, `/api/roleplay`, `/api/performance` |
| `/dashboard/calls` | Call list | `/api/calls` |
| `/dashboard/calls/new` | Upload new call | `/api/calls/upload`, `/api/offers` |
| `/dashboard/calls/[callId]` | Call detail + analysis | `/api/calls/[callId]/status` |
| `/dashboard/calls/[callId]/confirm` | Confirm call details pre-analysis | `/api/calls/[callId]/confirm` |
| `/dashboard/calls/review` | Call review (alternative view) | `/api/calls/[callId]/status` |
| `/dashboard/offers` | Offer list | `/api/offers` |
| `/dashboard/offers/new` | Create offer | `/api/offers` POST |
| `/dashboard/offers/[offerId]` | Offer detail + prospects | `/api/offers/[offerId]`, `/api/offers/[offerId]/prospects` |
| `/dashboard/offers/[offerId]/edit` | Edit offer | `/api/offers/[offerId]` PUT |
| `/dashboard/offers/[offerId]/prospects/new` | Create prospect | `/api/offers/[offerId]/prospects` POST |
| `/dashboard/roleplay` | Session list + replay dispatcher | `/api/roleplay` |
| `/dashboard/roleplay/new` | Start new roleplay | `/api/offers`, `/api/roleplay` POST |
| `/dashboard/roleplay/new/prospect` | Select prospect for roleplay | `/api/prospect-avatars` |
| `/dashboard/roleplay/[sessionId]` | Live roleplay session | `/api/roleplay/[sessionId]`, `/api/roleplay/[sessionId]/message`, `/api/tts` |
| `/dashboard/roleplay/[sessionId]/results` | Roleplay results + comparison | `/api/roleplay/[sessionId]` |
| `/dashboard/performance` | Performance analytics | `/api/performance` |
| `/dashboard/performance/figures` | Sales figures | `/api/performance/figures` |
| `/dashboard/profile` | User profile | `/api/profile` |
| `/dashboard/settings` | App settings | `/api/profile` |
| `/dashboard/settings/transcripts` | Training transcripts | `/api/training/transcripts` |
| `/dashboard/team` | Team management | `/api/team` |
| `/dashboard/billing` | Billing + subscription | `/api/billing` |
| `/dashboard/manager` | Manager dashboard | `/api/manager/reps` |
| `/dashboard/manager/team` | Team overview | `/api/manager/team-performance` |
| `/dashboard/manager/reps/[repId]` | Rep detail | `/api/manager/reps/[repId]` |
| `/dashboard/manager/categories` | Category analytics | `/api/manager/categories` |
| `/dashboard/manager/insights` | Team insights | `/api/manager/team-performance` |
| `/dashboard/create-organization` | Org setup | `/api/organizations` POST |
| `/dashboard/support` | Support page | None |
| `/dashboard/prospect-avatars/new` | Create avatar | `/api/prospect-avatars` POST |
| `/dashboard/prospect-avatars/[avatarId]/edit` | Edit avatar | `/api/prospect-avatars/[avatarId]` |

---

## 5. Component Library

### Shared Call Review Components (`components/call-review/`)
| Component | Props | Purpose |
|-----------|-------|---------|
| `PhaseAnalysisTabs` | `phaseAnalysis, phaseScores, callId?, sessionId?, defaultTab?` | Tabbed view of phase-by-phase analysis (intro/discovery/pitch/close/objections). Includes replay buttons via `buildReplayUrl()` |
| `ProspectDifficultyPanel` | `difficulty, difficultyTier, justifications?, dimensions?` | Radar chart + dimension breakdown of prospect difficulty |
| `OutcomeDiagnostic` | `p1, p2, closerEffectiveness, result?` | Outcome explanation (cause-effect + contextual) |
| `ActionPointCards` | `actionPoints` | Cards for top 3 action items (thePattern, whyItsCostingYou, whatToDoInstead, microDrill) |
| `CallSnapshotBar` | `overallScore, phaseScores, result, prospectDifficulty` | Top-level summary bar |
| `PhaseTimelineBar` | `phaseScores` | Visual timeline showing phase scores as colored bar |
| `SalesFiguresPanel` | `result, cashCollected, revenueGenerated, ...` | Editable figures panel for call detail |
| `TranscriptView` | `transcript, transcriptJson, timestampedFeedback?` | Formatted transcript with speaker labels |

### Roleplay Components (`components/roleplay/`)
| Component | Purpose |
|-----------|---------|
| `CategoryFeedbackSection` | Renders per-category feedback from roleplay analysis |
| `MomentFeedbackList` | List of key moments with coaching |
| `ObjectionAnalysis` | Objection handling breakdown |
| `ProspectCard` | Prospect avatar display card |
| `StageChips` | Conversation stage completion chips |

### Dashboard Components (`components/dashboard/`)
| Component | Purpose |
|-----------|---------|
| `header.tsx` | Top nav bar (search, notifications, profile) |
| `sidebar.tsx` | Left sidebar navigation |
| `InsightsPanel` | Dashboard insights panel |
| `ObjectionInsights` | Objection analytics |
| `PerformanceSummary` | Performance overview cards |
| `skeletons.tsx` | Loading skeleton states |

### Tour Components (`components/tour/`)
| Component | Purpose |
|-----------|---------|
| `tour-provider.tsx` | Tour state management |
| `tour-overlay.tsx` | Full-screen overlay |
| `tour-step-card.tsx` | Individual step card |
| `tour-auto-start.tsx` | Auto-start on first visit |
| `steps.ts` | Tour step definitions |

---

## 6. Data Flow Diagrams

### A. Call Analysis Flow
```
1. User uploads audio → POST /api/calls/upload
   → File stored in Vercel Blob → DB row created (status='transcribing')

2. Deepgram transcription → POST /api/calls/transcript
   → Transcribes via Deepgram Nova-2 (speaker diarization)
   → Updates DB: transcript, transcriptJson, status='pending_confirmation'

3. User sees Confirm page → fills in result, revenue, qualified
   → POST /api/calls/[callId]/confirm
   → Updates call with user-confirmed figures
   → Triggers analyzeCallAsync()

4. analyzeCallAsync (lib/calls/analyze-call.ts)
   → Calls analyzeCall() from lib/ai/analysis.ts (Groq llama-3.3-70b)
   → AI returns: phaseScores, phaseAnalysis, categoryScores, outcomeDiagnostic, etc.
   → normalizeV2Analysis() → flat structure
   → INSERT into call_analysis table
   → Updates sales_calls: status='completed'

5. Frontend polls /api/calls/[callId]/status
   → Returns call + analysis data → renders shared components
```

### B. Roleplay Flow
```
1. User selects offer + prospect + difficulty → POST /api/roleplay
   → Creates roleplay_sessions row (status='in_progress')
   → Generates prospect avatar if needed (auto_generated)

2. Frontend loads session → starts conversation
   → User types/speaks message → POST /api/roleplay/[sessionId]/message
   → Backend builds RoleplayContext (offer, prospect, behaviour state)
   → buildRoleplaySystemPrompt() + buildPhaseReplayPrompt() + buildOriginalProspectPrompt()
   → Groq generates prospect response (llama-3.3-70b, temp=0.7)
   → Saves both messages to roleplay_messages
   → Persists updated behaviourState in session metadata

3. User ends session → POST /api/roleplay/[sessionId]/score
   → Builds full transcript from messages
   → AI generates v2 analysis (phaseScores, phaseAnalysis, actionPoints, etc.)
   → INSERT into roleplay_analysis
   → Updates session: status='completed', overallScore, analysisId

4. Results page → GET /api/roleplay/[sessionId]
   → Returns session + messages + analysis
   → Renders shared components (PhaseAnalysisTabs, ProspectDifficultyPanel, etc.)
   → If replay: shows comparison banner (original vs practice scores)
```

### C. Performance Page Flow
```
1. Frontend loads → GET /api/performance?range=all_time (or month=YYYY-MM)
   → API fetches all call_analysis + roleplay_analysis for user
   → For each analysis:
      a. parseSkillScoresFlat() extracts 10-category scores
      b. Fallback chain: skillScores → categoryFeedback → deriveSkillScoresFromPhases()
   → computeSkillBreakdown() aggregates across all analyses
   → Maps to 9 Core Principles via getPrincipleForCategory()
   → Computes principleSummaries (avg scores, descriptions)
   → Extracts priorityActionSteps from recent analyses
   → Returns: overallScore, totalAnalyses, skillBreakdown, principleSummaries, etc.

2. Frontend renders:
   → Overall score + trend
   → Core Sales Principles breakdown (9 principles)
   → Priority Action Steps
   → Skill radar chart
```

### D. Figures Page Flow
```
1. Frontend loads → GET /api/performance/figures?month=YYYY-MM
   → Fetches sales_calls WHERE status='manual' OR (status='completed' AND analysisIntent matches)
   → Filters by month using callDate (if set) or createdAt
   → Calculates: callsBooked, callsShowed, callsQualified, salesMade, closeRate, showRate
   → Aggregates: cashCollected, revenueGenerated
   → For each sale: calculates commission (per-call rate or user default)
   → Fetches payment_plan_instalments with dueDate in month
   → Deduplicates (removes parent rows with instalments)
   → Returns salesList with paymentType, isFutureInstalment flags

2. Frontend renders:
   → KPI cards (booked, showed, qualified, sold, rates)
   → Revenue + cash collected
   → Sales list table (with instalment rows, future styling)
   → Commission totals (confirmed vs projected)
```

### E. Replay in Roleplay Flow
```
1. PhaseAnalysisTabs → "Practice This Phase" button
   → buildReplayUrl() generates URL: /dashboard/roleplay?phase=X&callId=Y

2. Roleplay listing page detects ?phase + ?callId params
   → handleReplay():
      a. Fetches original call analysis via /api/calls/[callId]/status
      b. Extracts phaseAnalysis, actionPoints, offerId
      c. Builds replayContext (phase feedback, objection blocks, skill data)
      d. Extracts originalProspectProfile from transcript (Part 2D):
         - Prospect dialogue samples, objections, pain points, communication style, warmth level
      e. POST /api/roleplay to create session with replay params

3. Roleplay session loads
   → message route reads replayPhase + replayContext from session
   → buildPhaseReplayPrompt() injects phase-specific behavior
   → buildOriginalProspectPrompt() injects original prospect mimicry
   → AI responds as the original prospect with matching behavior
```

---

## 7. Business Logic

### Scoring Framework
- **10 Categories** (each 0-10): authority, structure, communication, discovery, gap, value, trust, adaptation, objection_handling, closing
- **49 Subcategories** across the 10 categories (detailed in `scoring-categories.ts`)
- **4 Objection Pillars** (classification only): value, trust, fit, logistics
- **Overall Score**: AI-computed directly (0-100), NOT sum of categories

### 9 Core Principles
Maps 10 categories → 9 principles for the performance page:
1. Authority → authority
2. Structure → structure
3. Communication & Listening → communication
4. Gap Creation → gap, discovery
5. Value Positioning → value
6. Trust Building → trust
7. Adaptability → adaptation
8. Objection Strategy → objection_handling
9. Decision Leadership → closing

### 50-Point Difficulty Model
- **Layer A — Persuasion Difficulty (40 points)**:
  - positionProblemAlignment (0-10)
  - painAmbitionIntensity (0-10) — renamed from painAndAmbition
  - perceivedNeedForHelp (0-10)
  - authorityLevel: advisee(0) / peer(5) / advisor(10)
  - funnelContext (0-10) — renamed from funnelWarmth
- **Layer B — Execution Resistance (10 points)**:
  - abilityToProceed (0-10) — renamed from executionResistance
- **Tiers** (INVERTED — higher = easier):
  - easy: 41-50
  - realistic: 32-40
  - hard: 26-31
  - expert: 20-25
  - near_impossible: 0-19

### Commission Calculation
- Each call can have per-call `commissionRatePct` override
- Falls back to user's `commissionRatePct` default
- `commissionAmount = cashCollected * (pct / 100)`
- Cash/revenue stored in **cents** in DB, displayed as **pounds** on frontend

### Plan Tiers
| Feature | Starter ($99) | Pro ($399) | Enterprise (Custom) |
|---------|---------------|------------|---------------------|
| AI Analysis | Yes | Yes | Yes |
| Manager Dashboard | Yes | Yes | Yes |
| AI Roleplay | No | Yes | Yes |
| Priority Support | No | Yes | Yes |
| Custom Integrations | No | No | Yes |
| Seats | 5 | 20 | 999 |
| Calls/month | 50 | 200 | Unlimited |
| Roleplay/month | 0 | 50 | Unlimited |

---

## 8. External Integrations

| Service | Purpose | Env Vars |
|---------|---------|----------|
| **Neon PostgreSQL** | Database | `DATABASE_URL` |
| **Better Auth** | Authentication | `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` |
| **Google OAuth** | Social login | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| **Groq** | AI responses (roleplay + scoring) | `GROQ_API_KEY` |
| **Anthropic** | AI fallback | `ANTHROPIC_API_KEY` |
| **Deepgram** | Audio transcription (primary) | `DEEPGRAM_API_KEY` |
| **AssemblyAI** | Transcription fallback | `ASSEMBLYAI_API_KEY` |
| **Google AI Studio / Gemini** | Avatar image generation | `GOOGLE_AI_STUDIO_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY` |
| **ElevenLabs** | Text-to-speech for roleplay | `ELEVENLABS_API_KEY` |
| **Vercel Blob** | File/image storage | `BLOB_READ_WRITE_TOKEN` |
| **Whop** | Subscription billing | `WHOP_API_KEY`, `WHOP_WEBHOOK_SECRET`, `WHOP_*_PLAN_ID` |
| **NanoBanana** | Avatar image (legacy) | `NANOBANANA_API_KEY` |

### All Required Env Vars
```
DATABASE_URL=                    # Neon PostgreSQL connection string
BETTER_AUTH_SECRET=              # Auth encryption secret
BETTER_AUTH_URL=                 # App base URL (http://localhost:3000 or https://...)
NEXT_PUBLIC_APP_URL=             # Same as BETTER_AUTH_URL (client-side)

# AI Providers
GROQ_API_KEY=                    # Primary AI (roleplay, scoring)
ANTHROPIC_API_KEY=               # Fallback AI
GOOGLE_AI_STUDIO_KEY=            # Gemini image gen

# Transcription
DEEPGRAM_API_KEY=                # Primary transcription
ASSEMBLYAI_API_KEY=              # Fallback transcription

# Media
ELEVENLABS_API_KEY=              # TTS for roleplay
BLOB_READ_WRITE_TOKEN=           # Vercel Blob storage

# Payments
WHOP_API_KEY=                    # Whop API
WHOP_WEBHOOK_SECRET=             # Webhook verification
WHOP_STARTER_PLAN_ID=
WHOP_PRO_PLAN_ID=
WHOP_ENTERPRISE_PLAN_ID=
NEXT_PUBLIC_WHOP_COMPANY_ID=

# Optional
GOOGLE_CLIENT_ID=                # Google OAuth
GOOGLE_CLIENT_SECRET=
NANOBANANA_API_KEY=              # Legacy avatar
BYPASS_SUBSCRIPTION=true         # Dev mode - bypasses all checks
```

---

## 9. Issues & Tech Debt

### TODOs (4 items)
1. `lib/ai/knowledge/real-call-examples.ts:44` — Populate with actual verbatim quotes from transcripts
2. `lib/ai/prospect-avatar-image.ts:150` — Implement when AI image provider configured (Gemini now does this)
3. `components/dashboard/header.tsx:189` — Open mobile search modal
4. `app/api/team/route.ts:182` — Implement email invitation system

### Console.log Statements (95 across 19 files)
Heaviest files:
- `app/api/calls/transcript/route.ts` — 12 console.logs
- `app/api/offers/[offerId]/prospects/generate/route.ts` — 10
- `app/api/prospect-avatars/route.ts` — 9
- `app/api/calls/[callId]/confirm/route.ts` — 12
- `app/api/webhooks/whop/route.ts` — 7
- `app/api/roleplay/[sessionId]/score/route.ts` — 7
- `app/api/calls/[callId]/analyze/route.ts` — 7
- `app/api/performance/route.ts` — 5 (includes FULL DEBUG diagnostic logs)

### Auto-Migration Patterns (27 ALTER TABLE statements)
These indicate the schema in `db/schema.ts` was updated but the DB may not have been migrated:
- `lib/calls/analyze-call.ts` — 9 ALTER TABLEs for call_analysis v2 columns
- `app/api/roleplay/[sessionId]/score/route.ts` — 11 ALTER TABLEs for roleplay_analysis + roleplay_sessions v2 columns
- `app/api/performance/figures/route.ts` — 3 ALTER TABLEs for payment_plan_instalments columns
- **Recommendation**: Run `drizzle-kit push` to sync DB schema and remove auto-migration code

### Dead Code / Legacy
- `roleplay_analysis` still has v1 columns (valueScore, trustScore, fitScore, logisticsScore) marked DEPRECATED
- `offers` table has many legacy fields (priceRange, timeToResult, effortRequired, etc.) alongside new fields
- `lib/nanobanana.ts` — NanoBanana avatar generation (replaced by Gemini)
- `lib/ai/mock-analysis.ts` — Mock analysis data (dev only)
- `skill-clusters.ts` — Referenced but role may overlap with core-principles
- `proxy.ts` — Root proxy file (purpose unclear)

### Build Warning
- `typescript.ignoreBuildErrors: true` in next.config.ts — TypeScript errors are silently ignored during build

### Pre-existing DB Error
- PostgreSQL error about `training_transcripts_organization_id` — column type mismatch (text vs uuid FK) in trainingTranscripts table

---

## 10. File Index

### API Routes (41 files)
| File | Description |
|------|-------------|
| `app/api/auth/[...all]/route.ts` | Better-auth catch-all handler |
| `app/api/billing/route.ts` | GET billing info + history |
| `app/api/calls/route.ts` | GET list user's calls |
| `app/api/calls/upload/route.ts` | POST upload audio → Vercel Blob |
| `app/api/calls/upload-blob/route.ts` | POST alternative blob upload |
| `app/api/calls/transcript/route.ts` | POST transcribe audio via Deepgram |
| `app/api/calls/manual/route.ts` | POST create manual call entry |
| `app/api/calls/no-show/route.ts` | POST create no-show entry |
| `app/api/calls/follow-up/route.ts` | POST create follow-up call |
| `app/api/calls/[callId]/route.ts` | GET/PATCH/DELETE single call |
| `app/api/calls/[callId]/status/route.ts` | GET call status + analysis |
| `app/api/calls/[callId]/confirm/route.ts` | POST confirm details → trigger analysis |
| `app/api/calls/[callId]/analyze/route.ts` | POST re-analyze call |
| `app/api/calls/[callId]/outcome/route.ts` | PATCH update outcome |
| `app/api/calls/webhook/transcription/route.ts` | POST transcription webhook |
| `app/api/checkout/route.ts` | POST create Whop checkout URL |
| `app/api/manager/categories/route.ts` | GET category-level team analytics |
| `app/api/manager/reps/route.ts` | GET list managed reps |
| `app/api/manager/reps/[repId]/route.ts` | GET rep details |
| `app/api/manager/team-performance/route.ts` | GET aggregated team performance |
| `app/api/notifications/route.ts` | GET/PATCH notifications |
| `app/api/offers/route.ts` | GET/POST offers |
| `app/api/offers/[offerId]/route.ts` | GET/PUT/DELETE single offer |
| `app/api/offers/[offerId]/prospects/route.ts` | GET/POST prospects for offer |
| `app/api/offers/[offerId]/prospects/generate/route.ts` | POST generate AI prospect |
| `app/api/organizations/route.ts` | GET/POST organizations |
| `app/api/organizations/list/route.ts` | GET user's organizations |
| `app/api/organizations/switch/route.ts` | POST switch active org |
| `app/api/performance/route.ts` | GET performance analytics |
| `app/api/performance/figures/route.ts` | GET sales figures |
| `app/api/profile/route.ts` | GET/PATCH user profile |
| `app/api/profile/photo/route.ts` | POST upload profile photo |
| `app/api/prospect-avatars/route.ts` | GET list all avatars |
| `app/api/prospect-avatars/[avatarId]/route.ts` | GET/PUT/DELETE avatar |
| `app/api/prospect-avatars/[avatarId]/generate-avatar/route.ts` | POST generate avatar image |
| `app/api/roleplay/route.ts` | GET/POST roleplay sessions |
| `app/api/roleplay/[sessionId]/route.ts` | GET session details |
| `app/api/roleplay/[sessionId]/message/route.ts` | POST send message |
| `app/api/roleplay/[sessionId]/score/route.ts` | POST score session |
| `app/api/roleplay/[sessionId]/restart/route.ts` | POST restart session |
| `app/api/roleplay/replay/route.ts` | POST create replay session |
| `app/api/roleplay/extract-prospect/route.ts` | POST extract prospect from transcript |
| `app/api/subscription/check/route.ts` | GET check subscription |
| `app/api/team/route.ts` | GET/POST team members |
| `app/api/team/[memberId]/route.ts` | DELETE team member |
| `app/api/team/invite/route.ts` | POST send invite |
| `app/api/team/invite/[inviteId]/route.ts` | PUT accept/decline |
| `app/api/team/invites/route.ts` | GET pending invites |
| `app/api/training/transcripts/route.ts` | GET/POST/DELETE training transcripts |
| `app/api/tts/route.ts` | POST text-to-speech |
| `app/api/usage/check/route.ts` | GET usage limits |
| `app/api/usage/track/route.ts` | POST increment usage |
| `app/api/webhooks/whop/route.ts` | POST Whop webhook handler |

### Library Files (35 files)
| File | Description |
|------|-------------|
| `lib/ai/analysis.ts` | Core AI analysis engine — DO NOT MODIFY. normalizeV1/V2, analyzeCall, calculateCloserEffectiveness |
| `lib/ai/scoring-framework.ts` | 10-category scoring re-exports from training |
| `lib/ai/transcription.ts` | Deepgram + AssemblyAI transcription |
| `lib/ai/extract-call-details.ts` | AI extraction of call details from transcript |
| `lib/ai/mock-analysis.ts` | Mock analysis data for development |
| `lib/ai/prospect-avatar-image.ts` | Avatar image generation orchestrator |
| `lib/ai/knowledge/index.ts` | Knowledge doc exports |
| `lib/ai/knowledge/sales-philosophy.ts` | Connor's sales philosophy |
| `lib/ai/knowledge/prospect-difficulty.ts` | Difficulty model knowledge doc |
| `lib/ai/knowledge/coaching-output-rules.ts` | Coaching output rules |
| `lib/ai/knowledge/real-call-examples.ts` | Real call transcript examples |
| `lib/ai/prompts/roleplay-context.ts` | Roleplay context prompts |
| `lib/ai/roleplay/roleplay-engine.ts` | Core roleplay AI engine (system prompt, phase replay, prospect mimicry) |
| `lib/ai/roleplay/prospect-avatar.ts` | Prospect generation, difficulty calculation |
| `lib/ai/roleplay/behaviour-rules.ts` | Behaviour adaptation rules (resistance, trust, openness) |
| `lib/ai/roleplay/offer-intelligence.ts` | Offer profile and sales style |
| `lib/ai/roleplay/funnel-context.ts` | Funnel context types |
| `lib/ai/roleplay/voice-mapping.ts` | ElevenLabs voice ID mapping |
| `lib/ai/roleplay/transcript-patterns.ts` | User-specific transcript pattern extraction |
| `lib/calls/analyze-call.ts` | Orchestrates analysis + DB storage |
| `lib/calls/extract-transcript-text.ts` | Extract text from various file formats |
| `lib/training/index.ts` | Central exports for all training data |
| `lib/training/core-principles.ts` | 9 core principles mapping |
| `lib/training/scoring-categories.ts` | 10 categories + 49 subcategories |
| `lib/training/prospect-difficulty-model.ts` | 50-point difficulty model |
| `lib/training/roleplay-behavioral-rules.ts` | Roleplay behavioral rules |
| `lib/training/prospect-backstories.ts` | Backstory generation data |
| `lib/training/skill-clusters.ts` | Skill cluster definitions |
| `lib/auth.ts` | Better-auth server config |
| `lib/auth-client.ts` | Better-auth client + Google OAuth |
| `lib/plans.ts` | Plan tiers, features, limits |
| `lib/subscription.ts` | Subscription checks, usage tracking |
| `lib/feature-access.ts` | Feature gating |
| `lib/whop.ts` | Whop API integration |
| `lib/gemini-image.ts` | Gemini image generation + Vercel Blob upload |
| `lib/tts/tts-provider.ts` | TTS interface |
| `lib/tts/elevenlabs-client.ts` | ElevenLabs client |
| `lib/prospect-avatar.ts` | Avatar URL resolution, initials, colors |
| `lib/organizations.ts` | Organization helpers |
| `lib/utils.ts` | cn() class utility |
| `lib/toast.ts` | Toast wrapper |
| `lib/dev-mode.ts` | Dev mode bypass |
| `lib/seo.ts` | SEO metadata |
| `lib/nanobanana.ts` | NanoBanana avatar (legacy) |
| `lib/seed-data.ts` | Demo data seeder |
| `lib/roleplayApi.ts` | Client-side roleplay API helpers |

### Pages (33 page.tsx files)
See Section 4 (Page Map) for complete listing.

### Components (67+ files)
- `components/call-review/` — 8 files (shared analysis components)
- `components/dashboard/` — 6 files (header, sidebar, panels, skeletons)
- `components/roleplay/` — 6 files (roleplay-specific UI)
- `components/illustrations/` — 8 files (empty state SVGs)
- `components/landing/` — 3 files (landing page)
- `components/team/` — 1 file (invite dialog)
- `components/tour/` — 6 files (onboarding tour)
- `components/ui/` — ~50 files (Shadcn primitives)
- `components/error-boundary.tsx` — Error boundary wrapper

### Other
| File | Description |
|------|-------------|
| `db/schema.ts` | Complete DB schema (730 lines, 16 tables) |
| `db/index.ts` | Drizzle client |
| `drizzle.config.ts` | Drizzle Kit config |
| `contexts/user-context.tsx` | UserProvider with cache |
| `hooks/use-call-analysis.ts` | Call analysis polling |
| `hooks/use-confirm-dialog.tsx` | Confirmation dialog |
| `hooks/use-debounce.ts` | Debounce hook |
| `hooks/use-mobile.ts` | Mobile detection |
| `hooks/use-transcription.ts` | Transcription hook |
| `types/roleplay.ts` | Roleplay types |
| `proxy.ts` | Proxy utility |
| `next.config.ts` | Next.js config |
| `app/robots.ts` | robots.txt generator |
| `app/sitemap.ts` | Sitemap generator |
