import { pgTable, text, timestamp, uuid, integer, boolean, pgEnum, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'manager', 'rep']);
export const planTierEnum = pgEnum('plan_tier', ['starter', 'pro', 'enterprise']);
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active',
  'past_due',
  'canceled',
  'trialing',
  'incomplete',
  'paused'
]);
export const callTypeEnum = pgEnum('call_type', ['closing_call', 'follow_up', 'no_show', 'roleplay']);
export const callResultEnum = pgEnum('call_result', ['no_show', 'closed', 'lost', 'unqualified', 'follow_up', 'deposit', 'payment_plan', 'follow_up_result']);
export const offerCategoryEnum = pgEnum('offer_category', ['b2c_health', 'b2c_relationships', 'b2c_wealth', 'mixed_wealth', 'b2b_services']);
export const customerStageEnum = pgEnum('customer_stage', ['aspiring', 'current', 'mixed']);
export const caseStudyStrengthEnum = pgEnum('case_study_strength', ['none', 'weak', 'moderate', 'strong']);
export const primaryFunnelSourceEnum = pgEnum('primary_funnel_source', ['cold_outbound', 'cold_ads', 'warm_inbound', 'content_driven_inbound', 'referral', 'existing_customer']);

// Users table
export const users = pgTable('users', {
  id: text('id').primaryKey(), // Better-auth generates custom IDs
  email: text('email').notNull().unique(),
  password: text('password'), // Nullable - Better Auth handles this
  name: text('name').notNull(),
  role: userRoleEnum('role').notNull().default('rep'),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }), // Primary/default org (for backward compatibility)
  emailVerified: boolean('email_verified').notNull().default(false),
  profilePhoto: text('profile_photo'), // URL to profile photo
  bio: text('bio'), // User bio/description
  phone: text('phone'), // Phone number
  location: text('location'), // Location/city
  website: text('website'), // Personal website
  isTourCompleted: boolean('is_tour_completed').notNull().default(false),
  commissionRatePct: integer('commission_rate_pct'), // Default commission % for figures (0-100)
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// User-Organization junction table (many-to-many relationship)
export const userOrganizations = pgTable('user_organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  role: userRoleEnum('role').notNull().default('rep'), // Role in this specific organization
  isPrimary: boolean('is_primary').notNull().default(false), // Primary organization for the user
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Organizations table
export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  planTier: planTierEnum('plan_tier').notNull().default('starter'),
  maxSeats: integer('max_seats').notNull().default(5),
  isActive: boolean('is_active').notNull().default(true),
  trialEndsAt: timestamp('trial_ends_at'), // For free trial period
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Subscriptions table (Whop integration)
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  whopSubscriptionId: text('whop_subscription_id').unique(),
  whopCustomerId: text('whop_customer_id'),
  whopPlanId: text('whop_plan_id'),
  status: subscriptionStatusEnum('status').notNull().default('incomplete'),
  planTier: planTierEnum('plan_tier').notNull(),
  seats: integer('seats').notNull().default(5),
  callsPerMonth: integer('calls_per_month').notNull().default(50),
  roleplaySessionsPerMonth: integer('roleplay_sessions_per_month').notNull().default(0),
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  canceledAt: timestamp('canceled_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Sessions table (for better-auth)
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Accounts table (for better-auth social providers)
export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  expiresAt: timestamp('expires_at'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Usage tracking table
export const usageTracking = pgTable('usage_tracking', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  month: text('month').notNull(), // Format: YYYY-MM
  callsUsed: integer('calls_used').notNull().default(0),
  roleplaySessionsUsed: integer('roleplay_sessions_used').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Billing history table (payment events from Whop)
export const billingHistory = pgTable('billing_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  subscriptionId: uuid('subscription_id').references(() => subscriptions.id, { onDelete: 'set null' }),
  whopEventId: text('whop_event_id').unique(),
  eventType: text('event_type').notNull(), // payment_succeeded, payment_failed, etc.
  amount: integer('amount'), // Amount in cents
  currency: text('currency').default('usd'),
  status: text('status'), // succeeded, failed, pending
  description: text('description'),
  metadata: text('metadata'), // JSON string for additional data
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Notifications table
export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'team_invite', 'team_invite_accepted', 'team_invite_declined', etc.
  title: text('title').notNull(),
  message: text('message').notNull(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  inviterId: text('inviter_id').references(() => users.id, { onDelete: 'set null' }), // Who sent the invite
  metadata: text('metadata'), // JSON string for additional data (e.g., role, inviteId)
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Team invites table (pending invites)
export const teamInvites = pgTable('team_invites', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  inviterId: text('inviter_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  inviteeId: text('invitee_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: userRoleEnum('role').notNull().default('rep'),
  status: text('status').notNull().default('pending'), // 'pending', 'accepted', 'declined'
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  userOrganizations: many(userOrganizations),
  salesCalls: many(salesCalls),
  roleplaySessions: many(roleplaySessions),
  notifications: many(notifications),
}));

export const userOrganizationsRelations = relations(userOrganizations, ({ one }) => ({
  user: one(users, {
    fields: [userOrganizations.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [userOrganizations.organizationId],
    references: [organizations.id],
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [subscriptions.organizationId],
    references: [organizations.id],
  }),
  billingHistory: many(billingHistory),
}));

export const usageTrackingRelations = relations(usageTracking, ({ one }) => ({
  organization: one(organizations, {
    fields: [usageTracking.organizationId],
    references: [organizations.id],
  }),
}));

export const billingHistoryRelations = relations(billingHistory, ({ one }) => ({
  organization: one(organizations, {
    fields: [billingHistory.organizationId],
    references: [organizations.id],
  }),
  subscription: one(subscriptions, {
    fields: [billingHistory.subscriptionId],
    references: [subscriptions.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [notifications.organizationId],
    references: [organizations.id],
  }),
  inviter: one(users, {
    fields: [notifications.inviterId],
    references: [users.id],
  }),
}));

export const teamInvitesRelations = relations(teamInvites, ({ one }) => ({
  organization: one(organizations, {
    fields: [teamInvites.organizationId],
    references: [organizations.id],
  }),
  inviter: one(users, {
    fields: [teamInvites.inviterId],
    references: [users.id],
  }),
  invitee: one(users, {
    fields: [teamInvites.inviteeId],
    references: [users.id],
  }),
}));

// Sales calls table
export const salesCalls = pgTable('sales_calls', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), // Rep who made the call
  fileName: text('file_name').notNull(),
  fileUrl: text('file_url').notNull(), // URL to stored audio file
  fileSize: integer('file_size'), // Size in bytes
  duration: integer('duration'), // Duration in seconds
  status: text('status').notNull().default('uploaded'), // 'uploaded', 'processing', 'transcribing', 'analyzing', 'completed', 'failed'
  transcript: text('transcript'), // Full transcript text
  transcriptJson: text('transcript_json'), // JSON with speaker diarization and timestamps
  metadata: text('metadata'), // JSON string for additional data (deal stage, outcome, etc.)

  // Calls system fields
  offerId: uuid('offer_id').references(() => offers.id, { onDelete: 'set null' }),
  offerType: offerCategoryEnum('offer_type'),
  callType: callTypeEnum('call_type'),
  result: callResultEnum('result'),
  qualified: boolean('qualified'),
  cashCollected: integer('cash_collected'), // Amount in cents
  revenueGenerated: integer('revenue_generated'), // Amount in cents
  depositTaken: boolean('deposit_taken'),
  reasonForOutcome: text('reason_for_outcome'), // Mandatory short text field
  reasonTag: text('reason_tag'), // Pre-populated tag: 'No money', 'Spouse', 'Not the decision maker', 'Timing', 'Not convinced', 'Other', or free-text
  analysisIntent: text('analysis_intent'), // 'update_figures' | 'analysis_only'
  wasConfirmed: boolean('was_confirmed'), // For no-shows
  bookingSource: text('booking_source'), // For no-shows
  originalCallId: uuid('original_call_id').references(() => salesCalls.id, { onDelete: 'set null' }), // For follow-ups
  callDate: timestamp('call_date'), // For manual backdating; figures use this for month attribution when set
  prospectName: text('prospect_name'), // Prospect name (no-show, manual, transcript)
  commissionRatePct: integer('commission_rate_pct'), // Per-call commission % override (0-100)
  addToSalesFigures: boolean('add_to_sales_figures').notNull().default(true), // Whether to include in performance figures
  extractedDetails: text('extracted_details'), // JSON from AI extraction of transcript (auto-populate confirm form)

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
});

// Call analysis table (4 pillars + overall score) — for real sales calls only
export const callAnalysis = pgTable('call_analysis', {
  id: uuid('id').defaultRandom().primaryKey(),
  callId: uuid('call_id').notNull().references(() => salesCalls.id, { onDelete: 'cascade' }),
  overallScore: integer('overall_score'), // 0-100 overall score

  // 4 Pillars (0-100 each)
  valueScore: integer('value_score'),
  trustScore: integer('trust_score'),
  fitScore: integer('fit_score'),
  logisticsScore: integer('logistics_score'),

  // Pillar details (JSON)
  valueDetails: text('value_details'), // JSON with breakdown, strengths, weaknesses
  trustDetails: text('trust_details'),
  fitDetails: text('fit_details'),
  logisticsDetails: text('logistics_details'),

  // Skill scores (10 categories) - stored as JSON: { categoryId: score } per agreed framework
  skillScores: text('skill_scores'), // JSON: { authority: 7, structure: 8, ... }

  // Objection breakdown (pillar classification only) - JSON array of { objection, pillar, handling }
  objectionDetails: text('objection_details'),

  // Objection tracking booleans (v2 — nullable for backward compat)
  objectionPresent: boolean('objection_present'),   // true if ANY objection was raised
  objectionResolved: boolean('objection_resolved'),  // true if objectionPresent AND call resulted in closed/deposit/payment_plan

  // Prospect difficulty (from AI analysis, for call list and reporting)
  prospectDifficulty: integer('prospect_difficulty'), // 0-50
  prospectDifficultyTier: text('prospect_difficulty_tier'), // easy | realistic | hard | expert

  // AI coaching recommendations
  coachingRecommendations: text('coaching_recommendations'), // JSON array of recommendations

  // Timestamped feedback
  timestampedFeedback: text('timestamped_feedback'), // JSON array of { timestamp, type, message, transcriptSegment }

  // Connor's 7-section analysis data (Prompt 3) — v1 legacy, kept for backward compat
  outcomeDiagnostic: text('outcome_diagnostic'), // Narrative paragraph explaining call outcome
  categoryFeedback: text('category_feedback'), // JSON: per-category { whyThisScore, whatWasDoneWell, whatWasMissing, howItAffectedOutcome }
  momentCoaching: text('moment_coaching'), // JSON array of { timestamp, whatHappened, whatShouldHaveHappened, affectedCategory, whyItMatters }
  priorityFixes: text('priority_fixes'), // JSON array of { problem, whatToDoDifferently, whenToApply, whyItMatters }

  // v2.0 Phase-based analysis columns (all nullable for backward compat)
  phaseScores: text('phase_scores'), // JSON: { overall, intro, discovery, pitch, close, objections } each 0-100
  phaseAnalysis: text('phase_analysis'), // JSON: per-phase analysis (summary, whatWorked, timestampedFeedback, etc.)
  outcomeDiagnosticP1: text('outcome_diagnostic_p1'), // Why the result occurred (cause-and-effect)
  outcomeDiagnosticP2: text('outcome_diagnostic_p2'), // Contextual paragraph based on outcome
  closerEffectiveness: text('closer_effectiveness'), // 'above_expectation' | 'at_expectation' | 'below_expectation'
  prospectDifficultyJustifications: text('prospect_difficulty_justifications'), // JSON: per-dimension 2-4 sentence justifications
  actionPoints: text('action_points'), // JSON array (max 2) replacing priorityFixes for v2

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Payment plan instalments (future cash/commission events for figures)
export const paymentPlanInstalments = pgTable('payment_plan_instalments', {
  id: uuid('id').defaultRandom().primaryKey(),
  salesCallId: uuid('sales_call_id').notNull().references(() => salesCalls.id, { onDelete: 'cascade' }),
  instalmentNumber: integer('instalment_number'), // 1, 2, 3, 4...
  dueDate: timestamp('due_date').notNull(),
  amountCents: integer('amount_cents').notNull(),
  status: text('status').default('pending'), // 'pending' | 'collected' | 'missed' | 'refunded'
  collectedDate: timestamp('collected_date'), // when actually collected (null if pending)
  commissionRatePct: integer('commission_rate_pct'), // 0-100, from deal or user default
  commissionAmountCents: integer('commission_amount_cents'), // computed or stored
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Offers table (Layer 1: Offer Intelligence)
export const offers = pgTable('offers', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), // Creator
  name: text('name').notNull(), // Offer name/title
  offerCategory: offerCategoryEnum('offer_category').notNull(), // Enum: b2c_health, b2c_relationships, b2c_wealth, mixed_wealth, b2b_services
  whoItsFor: text('who_its_for').notNull(), // ICP definition
  coreOutcome: text('core_outcome').notNull(), // Transformation/result
  mechanismHighLevel: text('mechanism_high_level').notNull(), // How it works
  deliveryModel: text('delivery_model').notNull(), // 'dfy', 'dwy', 'diy', 'hybrid'
  supportChannels: text('support_channels'), // JSON array
  touchpointsFrequency: text('touchpoints_frequency'),
  implementationResponsibility: text('implementation_responsibility'), // 'prospect_heavy', 'provider_heavy', 'balanced'

  // Updated fields
  coreOfferPrice: text('core_offer_price'), // Single price (replaces priceRange)
  priceRange: text('price_range'), // Keep for backward compatibility, will be migrated

  // New fields per spec
  customerStage: customerStageEnum('customer_stage'), // 'aspiring', 'current', 'mixed'
  coreProblems: text('core_problems'), // Free text (replaces primaryProblemsSolved structure)
  desiredOutcome: text('desired_outcome'), // Core Outcome & Timeline
  tangibleOutcomes: text('tangible_outcomes'), // Measurable results (legacy — use goals)
  emotionalOutcomes: text('emotional_outcomes'), // Confidence, relief, etc. (legacy — use goals)
  goals: text('goals'), // Consolidated goals field (replaces tangible + emotional)
  deliverables: text('deliverables'), // What customer receives
  paymentOptions: text('payment_options'), // Descriptive text (not JSON)
  timePerWeek: text('time_per_week'), // Number or range
  estimatedTimeToResults: text('estimated_time_to_results'), // Free text
  caseStudyStrength: caseStudyStrengthEnum('case_study_strength'), // 'none', 'weak', 'moderate', 'strong'
  guaranteesRefundTerms: text('guarantees_refund_terms'), // Free text
  primaryFunnelSource: primaryFunnelSourceEnum('primary_funnel_source'), // Enum
  funnelContextAdditional: text('funnel_context_additional'), // Additional context

  // Legacy fields (keep for backward compatibility)
  timeToResult: text('time_to_result'),
  effortRequired: text('effort_required'), // 'low', 'medium', 'high'
  primaryProblemsSolved: text('primary_problems_solved'), // JSON array
  emotionalDrivers: text('emotional_drivers'), // JSON: { pain: [], ambition: [] }
  logicalDrivers: text('logical_drivers'), // JSON array
  proofAssetsAvailable: text('proof_assets_available'), // JSON
  proofRelevanceNotes: text('proof_relevance_notes'),
  riskReversal: text('risk_reversal'), // 'refund', 'guarantee', 'conditional', 'none'
  commonSkepticismTriggers: text('common_skepticism_triggers'), // JSON array
  mustHaveConditions: text('must_have_conditions'), // JSON array
  disqualifiers: text('disqualifiers'), // JSON array
  softDisqualifiers: text('soft_disqualifiers'), // JSON array
  bestFitNotes: text('best_fit_notes'),

  isTemplate: boolean('is_template').notNull().default(false), // Practice templates
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Prospect Avatars table (Layer 2: Prospect Avatar & Difficulty)
export const prospectAvatars = pgTable('prospect_avatars', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  offerId: uuid('offer_id').notNull().references(() => offers.id, { onDelete: 'cascade' }), // All prospects belong to an offer
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }), // Creator (optional for org-wide)
  name: text('name').notNull(), // Avatar name/description
  sourceType: text('source_type').notNull().default('manual'), // 'manual', 'transcript_derived', 'auto_generated'
  sourceTranscriptId: uuid('source_transcript_id').references(() => salesCalls.id, { onDelete: 'set null' }),

  // 50-Point Difficulty Model (Layer 2)
  // Layer A: Persuasion Difficulty (40 points)
  positionProblemAlignment: integer('position_problem_alignment').notNull(), // 0-10
  painAmbitionIntensity: integer('pain_ambition_intensity').notNull(), // 0-10
  perceivedNeedForHelp: integer('perceived_need_for_help').notNull(), // 0-10
  authorityLevel: text('authority_level').notNull(), // 'advisee', 'peer', 'advisor'
  funnelContext: integer('funnel_context').notNull(), // 0-10
  // Layer B: Execution Resistance (10 points)
  executionResistance: integer('execution_resistance').notNull().default(5), // 0-10 (ability to proceed: money, time, effort, authority)
  // Calculated totals
  difficultyIndex: integer('difficulty_index').notNull(), // 0-50 (calculated: Layer A + Layer B)
  difficultyTier: text('difficulty_tier').notNull(), // 'easy', 'realistic', 'hard', 'expert'

  // Prospect Profile Details
  avatarUrl: text('avatar_url'), // Optional: NanoBanana or other human-style portrait URL
  positionDescription: text('position_description'), // Current situation
  voiceStyle: text('voice_style'), // Optional: e.g. Professional, Friendly; ElevenLabs maps to voice ID
  problems: text('problems'), // JSON array
  painDrivers: text('pain_drivers'), // JSON array
  ambitionDrivers: text('ambition_drivers'), // JSON array
  resistanceStyle: text('resistance_style'), // JSON: objection patterns, tone, etc.
  behaviouralBaseline: text('behavioural_baseline'), // JSON: how they typically respond

  isTemplate: boolean('is_template').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// AI Roleplay sessions table (Enhanced)
export const roleplaySessions = pgTable('roleplay_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // Session Configuration
  mode: text('mode').notNull().default('manual'), // 'manual', 'transcript_replay'
  offerId: uuid('offer_id').notNull().references(() => offers.id, { onDelete: 'restrict' }),
  prospectAvatarId: uuid('prospect_avatar_id').references(() => prospectAvatars.id, { onDelete: 'set null' }),
  selectedDifficulty: text('selected_difficulty'), // 'easy', 'intermediate', 'hard', 'expert' (user selection)
  actualDifficultyTier: text('actual_difficulty_tier'), // Calculated from avatar

  // Transcript Replay Mode
  sourceCallId: uuid('source_call_id').references(() => salesCalls.id, { onDelete: 'set null' }), // If replaying a call

  // Session State
  status: text('status').notNull().default('in_progress'), // 'in_progress', 'completed', 'abandoned'
  inputMode: text('input_mode').notNull().default('text'), // 'text', 'voice'

  // Scoring (set after completion)
  overallScore: integer('overall_score'), // 0-100
  analysisId: uuid('analysis_id'), // References roleplay_analysis.id (FK applied via migration to avoid circular def)

  // Metadata
  metadata: text('metadata'), // JSON for additional data

  // Phase Replay context (set when session is created from a replay button)
  replayPhase: text('replay_phase'), // 'intro'|'discovery'|'pitch'|'close'|'objection'|'skill'|null
  replaySourceCallId: text('replay_source_call_id'), // Original call ID
  replaySourceSessionId: text('replay_source_session_id'), // Original roleplay session ID
  replayContext: text('replay_context'), // JSON: phase feedback, objection block, or action point data

  startedAt: timestamp('started_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Roleplay Messages table (conversation history)
export const roleplayMessages = pgTable('roleplay_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').notNull().references(() => roleplaySessions.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'rep', 'prospect'
  content: text('content').notNull(),
  messageType: text('message_type').notNull().default('text'), // 'text', 'voice', 'system'
  audioUrl: text('audio_url'), // If voice message
  timestamp: integer('timestamp'), // Milliseconds from session start
  metadata: text('metadata'), // JSON for additional data (sentiment, interruptions, etc.)
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Roleplay analysis table — for AI roleplay sessions only
// Uses the same 10-category scoring framework as call_analysis via skillScores JSON
export const roleplayAnalysis = pgTable('roleplay_analysis', {
  id: uuid('id').defaultRandom().primaryKey(),
  roleplaySessionId: uuid('roleplay_session_id').notNull().references(() => roleplaySessions.id, { onDelete: 'cascade' }),
  overallScore: integer('overall_score'), // 0-100

  // DEPRECATED: 4-pillar scoring replaced by 10-category framework in skillScores
  // Kept for backwards compatibility only — do not use for new features
  valueScore: integer('value_score'), // @deprecated - use skillScores
  trustScore: integer('trust_score'), // @deprecated - use skillScores
  fitScore: integer('fit_score'), // @deprecated - use skillScores
  logisticsScore: integer('logistics_score'), // @deprecated - use skillScores

  // DEPRECATED: pillar details replaced by coaching recommendations
  valueDetails: text('value_details'), // @deprecated
  trustDetails: text('trust_details'), // @deprecated
  fitDetails: text('fit_details'), // @deprecated
  logisticsDetails: text('logistics_details'), // @deprecated

  // 10-category skill scores (JSON: { category_id: score 0-10 })
  // Uses SALES_CATEGORIES from lib/ai/scoring-framework.ts
  skillScores: text('skill_scores'),

  // Prospect difficulty assessment (replicates call_analysis fields)
  prospectDifficulty: integer('prospect_difficulty'), // 0-50 total difficulty index
  prospectDifficultyTier: text('prospect_difficulty_tier'), // 'easy' | 'realistic' | 'hard' | 'expert'

  // Coaching and timestamped feedback
  coachingRecommendations: text('coaching_recommendations'),
  timestampedFeedback: text('timestamped_feedback'),

  // Completion tracking
  isIncomplete: boolean('is_incomplete').default(false), // True if roleplay ended before full conversation
  stagesCompleted: text('stages_completed'), // JSON: { opening, discovery, offer, objections, close: boolean }

  // Enhanced feedback (JSON columns)
  categoryFeedback: text('category_feedback'), // JSON: per-category what-was-done-well/missing/improve
  priorityFixes: text('priority_fixes'), // JSON: 3-5 priority items with whatWentWrong/whyItMattered/whatToDo
  objectionAnalysis: text('objection_analysis'), // JSON: detailed objection handling evaluation

  // v2.0 Phase-based analysis columns (same as callAnalysis, all nullable for backward compat)
  phaseScores: text('phase_scores'), // JSON: { overall, intro, discovery, pitch, close, objections } each 0-100
  phaseAnalysis: text('phase_analysis'), // JSON: per-phase analysis (summary, whatWorked, timestampedFeedback, etc.)
  outcomeDiagnosticP1: text('outcome_diagnostic_p1'), // Why the result occurred (cause-and-effect)
  outcomeDiagnosticP2: text('outcome_diagnostic_p2'), // Contextual paragraph based on outcome
  closerEffectiveness: text('closer_effectiveness'), // 'above_expectation' | 'at_expectation' | 'below_expectation'
  prospectDifficultyJustifications: text('prospect_difficulty_justifications'), // JSON: per-dimension justifications
  actionPoints: text('action_points'), // JSON array (max 2) replacing priorityFixes for v2

  // Roleplay-specific post-call feedback (5 dimensions: pre_set, authority, objection_handling, close_attempt, overall)
  roleplayFeedback: text('roleplay_feedback'), // JSON: { dimensions, whatWorked, whatDidntWork, keyImprovement, transcriptMoment }

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Training Transcripts — user-uploaded sales call transcripts for AI training context
export const trainingTranscripts = pgTable('training_transcripts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: text('organization_id').references(() => organizations.id),

  // Transcript content
  title: text('title').notNull(), // User-provided or auto-generated name
  rawTranscript: text('raw_transcript').notNull(), // Full transcript text

  // Extracted patterns for roleplay injection
  extractedPatterns: text('extracted_patterns'), // JSON: { closingTechniques, objectionHandles, discoveryQuestions, valueStatements }

  // Metadata
  tags: text('tags'), // JSON array of user tags (e.g. ["cold call", "B2C", "coaching"])
  status: text('status').notNull().default('uploaded'), // 'uploaded' | 'processing' | 'processed' | 'error'
  wordCount: integer('word_count'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});


// Relations for new tables
export const salesCallsRelations = relations(salesCalls, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [salesCalls.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [salesCalls.userId],
    references: [users.id],
  }),
  offer: one(offers, {
    fields: [salesCalls.offerId],
    references: [offers.id],
  }),
  originalCall: one(salesCalls, {
    fields: [salesCalls.originalCallId],
    references: [salesCalls.id],
  }),
  analysis: one(callAnalysis, {
    fields: [salesCalls.id],
    references: [callAnalysis.callId],
  }),
  paymentPlanInstalments: many(paymentPlanInstalments),
}));

export const paymentPlanInstalmentsRelations = relations(paymentPlanInstalments, ({ one }) => ({
  salesCall: one(salesCalls, {
    fields: [paymentPlanInstalments.salesCallId],
    references: [salesCalls.id],
  }),
}));

export const callAnalysisRelations = relations(callAnalysis, ({ one }) => ({
  call: one(salesCalls, {
    fields: [callAnalysis.callId],
    references: [salesCalls.id],
  }),
}));

export const offersRelations = relations(offers, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [offers.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [offers.userId],
    references: [users.id],
  }),
  prospects: many(prospectAvatars),
  roleplaySessions: many(roleplaySessions),
}));

export const prospectAvatarsRelations = relations(prospectAvatars, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [prospectAvatars.organizationId],
    references: [organizations.id],
  }),
  offer: one(offers, {
    fields: [prospectAvatars.offerId],
    references: [offers.id],
  }),
  user: one(users, {
    fields: [prospectAvatars.userId],
    references: [users.id],
  }),
  sourceTranscript: one(salesCalls, {
    fields: [prospectAvatars.sourceTranscriptId],
    references: [salesCalls.id],
  }),
  roleplaySessions: many(roleplaySessions),
}));

export const roleplaySessionsRelations = relations(roleplaySessions, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [roleplaySessions.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [roleplaySessions.userId],
    references: [users.id],
  }),
  offer: one(offers, {
    fields: [roleplaySessions.offerId],
    references: [offers.id],
  }),
  prospectAvatar: one(prospectAvatars, {
    fields: [roleplaySessions.prospectAvatarId],
    references: [prospectAvatars.id],
  }),
  sourceCall: one(salesCalls, {
    fields: [roleplaySessions.sourceCallId],
    references: [salesCalls.id],
  }),
  analysis: one(roleplayAnalysis, {
    fields: [roleplaySessions.analysisId],
    references: [roleplayAnalysis.id],
  }),
  messages: many(roleplayMessages),
}));

export const roleplayAnalysisRelations = relations(roleplayAnalysis, ({ one }) => ({
  session: one(roleplaySessions, {
    fields: [roleplayAnalysis.roleplaySessionId],
    references: [roleplaySessions.id],
  }),
}));

export const roleplayMessagesRelations = relations(roleplayMessages, ({ one }) => ({
  session: one(roleplaySessions, {
    fields: [roleplayMessages.sessionId],
    references: [roleplaySessions.id],
  }),
}));

// Types for new tables
export type SalesCall = typeof salesCalls.$inferSelect;
export type NewSalesCall = typeof salesCalls.$inferInsert;
export type CallAnalysis = typeof callAnalysis.$inferSelect;
export type NewCallAnalysis = typeof callAnalysis.$inferInsert;
export type PaymentPlanInstalment = typeof paymentPlanInstalments.$inferSelect;
export type NewPaymentPlanInstalment = typeof paymentPlanInstalments.$inferInsert;
export type Offer = typeof offers.$inferSelect;
export type NewOffer = typeof offers.$inferInsert;
export type ProspectAvatar = typeof prospectAvatars.$inferSelect;
export type NewProspectAvatar = typeof prospectAvatars.$inferInsert;
export type RoleplaySession = typeof roleplaySessions.$inferSelect;
export type NewRoleplaySession = typeof roleplaySessions.$inferInsert;
export type RoleplayMessage = typeof roleplayMessages.$inferSelect;
export type NewRoleplayMessage = typeof roleplayMessages.$inferInsert;
export type RoleplayAnalysis = typeof roleplayAnalysis.$inferSelect;
export type NewRoleplayAnalysis = typeof roleplayAnalysis.$inferInsert;
export type TrainingTranscript = typeof trainingTranscripts.$inferSelect;
export type NewTrainingTranscript = typeof trainingTranscripts.$inferInsert;

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type UsageTracking = typeof usageTracking.$inferSelect;
export type NewUsageTracking = typeof usageTracking.$inferInsert;
export type BillingHistory = typeof billingHistory.$inferSelect;
export type NewBillingHistory = typeof billingHistory.$inferInsert;
export type UserOrganization = typeof userOrganizations.$inferSelect;
export type NewUserOrganization = typeof userOrganizations.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type TeamInvite = typeof teamInvites.$inferSelect;
export type NewTeamInvite = typeof teamInvites.$inferInsert;