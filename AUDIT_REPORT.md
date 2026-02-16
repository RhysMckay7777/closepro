# ClosePro Deep Codebase Audit Report

**Date:** February 16, 2026
**Auditor:** Claude (Senior Architect)
**Stack:** Next.js 16.1.4 (App Router), TypeScript, Tailwind, Drizzle ORM, PostgreSQL (Neon), Vercel

---

## 1. Architecture Map

### Data Flow Overview

```
CALL FLOW:
  Upload audio → Assembly AI transcription → status='transcribing'
    → Webhook callback → status='pending_confirmation'
    → User confirms on /confirm page → POST /api/calls/[callId]/confirm
    → analyzeCallAsync() via after() → status='analyzing'
    → Analysis complete → status='completed' → results on call detail page

ROLEPLAY FLOW:
  Select offer + difficulty + mode → POST /api/roleplay → session created
    → Voice mode: GET /voice-token → ElevenLabs WebSocket (Conversational AI)
    → Text mode: Web Speech API STT → POST /message → Groq LLM → ElevenLabs TTS
    → End session → POST /score → Groq/Anthropic analysis → results page

PERFORMANCE FLOW:
  GET /api/performance?range=&month=&source=
    → Aggregates callAnalysis + roleplayAnalysis
    → Computes 9 Core Principles from 10 scoring categories
    → Returns trends, strengths, weaknesses, action steps

FIGURES FLOW:
  GET /api/performance/figures?month=YYYY-MM
    → Queries salesCalls + paymentPlanInstalments
    → Commission = rate x cash_collected (in cents)
    → Month 1 instalment = full deal revenue; subsequent = 0
```

### Key File Locations

| Area | Files |
|------|-------|
| DB Schema | `db/schema.ts` (729 lines, 23 tables) |
| Analysis Engine | `lib/ai/analysis.ts` (DO NOT MODIFY), `lib/calls/analyze-call.ts` |
| Roleplay Engine | `lib/ai/roleplay/roleplay-engine.ts`, `behaviour-rules.ts`, `voice-mapping.ts` |
| Voice Session | `hooks/use-voice-session.ts` (reconnection, transcript persistence) |
| 9 Core Principles | `lib/training/core-principles.ts` |
| 10 Scoring Categories | `lib/training/scoring-framework.ts` |
| Difficulty Model | `lib/training/prospect-difficulty-model.ts` |
| Shared Components | `components/call-review/` (PhaseAnalysisTabs, ProspectDifficultyPanel, etc.) |
| Auth | `lib/auth.ts` (better-auth + Drizzle adapter) |

---

## 2. Spec Alignment (Connor's Requirements)

### Summary: ALL AREAS FULLY ALIGNED

| Area | Status | Notes |
|------|--------|-------|
| 9 Core Principles | **FULLY ALIGNED** | All 9 defined in `core-principles.ts`, mapped to 10 categories, used in performance dashboard |
| Performance Dashboard | **FULLY ALIGNED** | Shows principle scores, strengths/weaknesses per principle, top 3 Action Steps, time range filtering, data source toggle |
| Figures / Commission | **FULLY ALIGNED** | Commission = rate x cash_collected (not revenue); payment plan: month 1 = full revenue, later = 0; Payment Type column present; cents storage / pounds display |
| Call Review | **FULLY ALIGNED** | MM:SS timestamps, Closer/Prospect speaker labels, Prospect Context UI matches manual creation, "Replay This Call in Roleplay" passes full state |
| Roleplay System | **FULLY ALIGNED** | Zoom-style dual tiles, control bar always visible, guarded prospect start, voice locked per-session, gender-aware mapping, exponential backoff reconnection |
| Roleplay Results | **FULLY ALIGNED** | 5-dimension difficulty (/10 scores + 2-4 sentence justifications), tier color scheme, phase-based analysis with shared components, comparison banner for replays |
| Difficulty Model | **FULLY ALIGNED** | 50-point scale, inverted bands (higher=easier), 5 tiers, backward compat for renamed dimensions |

---

## 3. Code Quality & Architecture

### Strengths

- **Shared component architecture** is excellent. PhaseAnalysisTabs, ProspectDifficultyPanel, ActionPointCards, OutcomeDiagnostic are properly parameterized and reused between call review and roleplay results
- **Backward compatibility** is thoughtful: v1/v2 detection (`isV2 = !!phaseScores`), dimension rename fallbacks (`painAndAmbition` -> `motivationIntensity`), 4-pillar columns kept but deprecated
- **Voice session hook** (`use-voice-session.ts`) has robust reconnection: exponential backoff (2s/4s/8s), 10s stable connection timer before resetting attempts, rapid-reconnect loop detection (5 in 60s)
- **Financial calculations** correctly use cents storage with `/100` display, commission = rate x cash (not revenue)
- **Auth** consistently uses `auth.api.getSession()` across all API routes

### Issues Found

#### Hardcoded Magic Numbers (MEDIUM)

Difficulty tier boundaries appear in 3+ files with slight discrepancies:

| File | Easy threshold | Realistic threshold |
|------|---------------|-------------------|
| `prospect-difficulty-model.ts` | >= 41 | >= 32 |
| `prospect-avatar.ts` | >= 42 | >= 36 |
| `analysis.ts` | >= 41 | >= 32 |

**Fix:** Create single `lib/constants.ts` with `DIFFICULTY_BANDS` and import everywhere.

#### Regex Fragility (MEDIUM)

`analyzeRepAction()` in roleplay-engine.ts uses naive keyword matching:
- `includes('i\'ve')` -> triggers `demonstratedAuthority` for "I've seen this before" (false positive)
- `includes('today')` -> triggers `appliedPressure` for "I'll have it by tomorrow" (false positive)
- No speaker role filtering

`cleanResponse()` regex edge cases:
- `[Call ends at 5:15 PM]` starts with `[` + numbers -> preserved instead of removed
- Em-dash narration `—They pause—` missed (capital T)

#### N+1 Query Problems (HIGH)

Both `GET /api/calls` and `GET /api/roleplay` loop through `offerIds` fetching each offer individually:
```typescript
for (const offerId of offerIds) {
  const offer = await db.select().from(offers).where(eq(offers.id, offerId));
}
```

**Fix:** Use `inArray(offers.id, offerIds)` for batch fetch.

#### Functions Too Long (MEDIUM)

- `normalizeV2Analysis()` in analysis.ts: 180+ lines with deeply nested conditionals
- `renderAvatarArea()` in roleplay session page: 200+ lines
- `handleSend()` in roleplay session page: 100+ lines mixing API call, state updates, TTS

#### Dead Code (LOW)

- `normalizePillar()` in analysis.ts: defined but never imported/called
- `normalizeV1Analysis()`: may never be called if all new calls are v2
- `elite` tier still appears in behaviour-rules.ts but not in `DifficultyTier` type

---

## 4. Database & Data Contracts

### Critical Issues

#### 1. `stagesCompleted` NULL CRASH (P0)
**File:** `app/api/roleplay/[sessionId]/score/route.ts`
**Problem:** `stagesCompleted` is nullable TEXT, but code accesses `.opening` without null check:
```typescript
const isIncomplete = !stagesCompleted.opening; // CRASHES if null
```
**Fix:** `const parsed = analysis?.stagesCompleted ? JSON.parse(analysis.stagesCompleted) : {};`

#### 2. `trainingTranscripts.organizationId` TYPE MISMATCH (P0)
**File:** `db/schema.ts` line 562
**Problem:** Column is `text()` but references `organizations.id` which is `uuid()`. FK constraint cannot be enforced.
**Fix:** Change to `uuid('organization_id').notNull().references(...)` + migration.

#### 3. Double JSON Serialization Risk (P0)
**File:** `app/api/offers/route.ts`
**Problem:** If `primaryProblemsSolved` is already an array, `JSON.stringify([value])` double-serializes.
**Fix:** Audit all JSON field mappings in offers route.

### High Priority Issues

#### 4. Missing Database Indexes (P1)
No indexes exist on query-critical paths:
- `salesCalls(userId, organizationId, createdAt)` - calls listing
- `roleplaySessions(userId, organizationId, createdAt)` - session listing
- `paymentPlanInstalments(salesCallId, status)` - due instalments
- `subscriptions(organizationId)` - org subscription lookup
- `notifications(userId, read)` - unread count

**Impact:** Full table scans on every query. Will degrade at scale.

#### 5. Weak Replay Foreign Keys (P1)
`replaySourceCallId` and `replaySourceSessionId` stored as TEXT, not UUID FK. No referential integrity - if original call is deleted, orphaned replay records remain.

#### 6. `analysisId` FK Missing in Schema (P1)
`roleplaySessions.analysisId` references `roleplayAnalysis.id` but FK constraint only exists in migration file, not in Drizzle schema definition.

#### 7. All JSON Columns as TEXT (P1)
Every JSON column (skillScores, phaseScores, phaseAnalysis, etc.) uses `text()` instead of `jsonb()`. No DB-level validation, no indexing, no atomic updates.

### Schema Recommendations

- Convert all JSON columns from `text()` to `jsonb()`
- Create ENUM types for status fields (call_status, roleplay_status, message_type)
- Add unique constraints: `(organizationId, month)` on usage_tracking, `(organizationId, inviteeId)` on team_invites
- Add NOT NULL with defaults where columns should never be null post-creation

---

## 5. Security & Auth

### Strengths
- better-auth with httpOnly + secure cookies in production
- Consistent `auth.api.getSession()` check across all routes
- Organization-scoped queries throughout
- Webhook signature verification on Whop webhooks
- File upload: MIME whitelist + extension check + 100MB size limit
- All API keys in environment variables, `.env*` in `.gitignore`

### Critical Issues

#### 1. Transcription Webhook: NO Signature Verification (P0)
**File:** `app/api/calls/webhook/transcription/route.ts`
**Problem:** Accepts ANY POST request and processes transcript data. An attacker could send fake transcription notifications.
**Fix:** Implement Assembly AI webhook signature verification.

#### 2. Client-Side Only Dashboard Auth Guard (P1)
**File:** `app/(dashboard)/dashboard-shell.tsx`
**Problem:** Uses `useSession()` client hook. Dashboard pages lack server-side/middleware auth enforcement.
**Fix:** Implement Next.js middleware for `/dashboard/*` routes.

#### 3. Dev Mode Bypass in Production (P1)
**File:** `lib/dev-mode.ts`
**Problem:** `ENVIRONMENTTYPE=dev` bypasses all subscription checks and grants enterprise-tier access.
**Fix:** Remove or restrict to localhost only.

#### 4. No Rate Limiting (P1)
No rate limiting on any API routes. Expensive operations (AI analysis, TTS, scoring) are unprotected against abuse.
**Fix:** Implement per-user rate limiting via Vercel Middleware or KV.

### Medium Issues

- Admin endpoints (`/api/admin/seed-transcripts`) lack role check - any authenticated user can access
- Base64 image storage in DB (`/api/profile/photo`) causes bloat - should use Vercel Blob
- Error messages leak schema hints (`"schemaHint": "Run npm run db:migrate"`)
- Email verification disabled by default
- No session revocation mechanism
- Long session timeout (7 days)

---

## 6. UI & Frontend

### Strengths
- Shared component architecture across call review + roleplay results
- Good responsive patterns (flex-col md:flex-row, progressive avatar sizing)
- Loading skeletons for key pages
- Consistent toast notifications for errors
- Callbacks properly memoized with useCallback

### Critical Issues

#### 1. Fixed 400px Transcript Sidebar (P0 - Mobile Breaking)
**File:** `app/(dashboard)/dashboard/roleplay/[sessionId]/page.tsx` line 1010
**Problem:** `w-[400px] shrink-0` breaks on phones (375px wide). Sidebar overflows or pushes content off-screen.
**Fix:** `className="hidden lg:flex w-[400px] shrink-0 ..."` (hide on mobile, show on desktop)

#### 2. Missing ARIA on Icon Buttons (P1 - Accessibility)
VoiceSessionControls buttons have `title` but no `aria-label`. Screen readers can't announce button purpose.

#### 3. Missing ARIA Tab Roles (P1 - Accessibility)
PhaseAnalysisTabs and transcript tabs lack `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`. Tab structure not announced to screen readers.

### Medium Issues
- Color utility functions duplicated across 4 files with inconsistent color scales
- Phase labels duplicated with variations ("Pitch" vs "Pitch / Presentation")
- No `aria-live` regions for message updates or status changes
- 10px text at 80% opacity may fail WCAG AA contrast
- No dynamic imports for below-fold components (MomentFeedbackList, ObjectionAnalysis)
- Polling (3s interval) instead of SSE for async scoring status
- Calls page: all filtering client-side after full fetch (could be server-side)

---

## 7. Prioritized Recommendations

### P0: Critical (Fix Before Demo/Scale)

| # | Issue | Impact | Files | Effort |
|---|-------|--------|-------|--------|
| 1 | `stagesCompleted` null crash | Runtime crash on every roleplay completion | `api/roleplay/[sessionId]/score/route.ts` | 5 min |
| 2 | Transcription webhook no signature verification | Security: fake transcripts can be injected | `api/calls/webhook/transcription/route.ts` | 1 hr |
| 3 | Fixed 400px sidebar breaks mobile | Roleplay unusable on phones | `roleplay/[sessionId]/page.tsx` L1010 | 5 min |
| 4 | `trainingTranscripts.organizationId` type mismatch | FK constraint not enforced | `db/schema.ts` L562 + migration | 30 min |
| 5 | Double JSON serialization in offers | Data corruption risk | `api/offers/route.ts` | 2 hrs |
| 6 | Call detail page polls indefinitely | No timeout if analysis stuck | `calls/[callId]/page.tsx` | 15 min |

### P1: Important (Next Sprint)

| # | Issue | Impact | Files | Effort |
|---|-------|--------|-------|--------|
| 7 | Missing database indexes | Full table scans, slow at scale | `db/schema.ts` + migration | 2 hrs |
| 8 | N+1 offer queries | Slow calls/roleplay listing | `api/calls/route.ts`, `api/roleplay/route.ts` | 1 hr |
| 9 | Client-side only dashboard auth | Security: bypassed by direct API calls | New `middleware.ts` | 2 hrs |
| 10 | Dev mode bypass in production | Security: free enterprise access | `lib/dev-mode.ts` | 30 min |
| 11 | No rate limiting | Abuse of expensive AI operations | Vercel Middleware | 3 hrs |
| 12 | Weak replay FK (TEXT not UUID) | Orphaned records on deletion | `db/schema.ts` L468-470 + migration | 1 hr |
| 13 | Missing aria-label on icon buttons | WCAG non-compliance | `VoiceSessionControls.tsx` | 30 min |
| 14 | Missing ARIA tab roles | WCAG non-compliance | `PhaseAnalysisTabs.tsx`, session page | 45 min |
| 15 | Difficulty tier boundary inconsistency | Different tier assignment depending on file | `prospect-avatar.ts` vs `prospect-difficulty-model.ts` | 1 hr |
| 16 | Single source of truth for constants | Magic numbers in 3+ files | New `lib/constants.ts` | 2 hrs |
| 17 | JSON columns as TEXT not JSONB | No DB validation, no indexing | `db/schema.ts` + migration | 3 hrs |
| 18 | Base64 profile photo storage | DB bloat, slow queries | `api/profile/photo/route.ts` | 2 hrs |
| 19 | Admin endpoints missing role check | Any user can seed transcripts | `api/admin/seed-transcripts/route.ts` | 15 min |

### P2: Polish (Backlog)

| # | Issue | Impact | Files | Effort |
|---|-------|--------|-------|--------|
| 20 | Extract duplicated color functions | Maintainability | 4 files -> `lib/ui/colors.ts` | 1 hr |
| 21 | Add aria-live for dynamic content | Screen reader notifications | Session page, controls | 15 min |
| 22 | Dynamic imports for below-fold components | Bundle size (-15KB) | Results page | 30 min |
| 23 | Replace polling with SSE | Server load, real-time updates | Results page + new API | 3 hrs |
| 24 | Status ENUM types in schema | Prevent invalid status values | `db/schema.ts` + migration | 2 hrs |
| 25 | Break down 180-line normalizeV2Analysis | Maintainability | `lib/ai/analysis.ts` | 2 hrs |
| 26 | Remove dead code (normalizePillar, elite tier) | Code clarity | `analysis.ts`, `behaviour-rules.ts` | 30 min |
| 27 | Add unique constraints (usage_tracking, team_invites) | Prevent duplicate records | `db/schema.ts` + migration | 1 hr |
| 28 | Calls page server-side filtering | Performance, bundle | `calls/page.tsx` | 3 hrs |
| 29 | Financial audit logging | Audit trail for cash changes | New table + triggers | 4 hrs |
| 30 | Color contrast (10px text at 80% opacity) | Accessibility edge case | Session page | 5 min |

---

## Overall Assessment

**Code Health: B+**

The codebase is well-structured with excellent shared component architecture, comprehensive spec alignment, and thoughtful backward compatibility. The main risks are:

1. **Data integrity** - NULL crashes, missing indexes, JSON as TEXT, weak FKs
2. **Security gaps** - unsigned webhooks, client-only auth guards, no rate limiting
3. **Mobile** - fixed sidebar width breaks on phones
4. **Accessibility** - missing ARIA attributes on interactive elements

The 6 P0 items are quick fixes (total ~4 hours) that should be done immediately. The P1 items (~20 hours) would bring this to production-grade quality. The architecture and spec alignment are already strong foundations.
