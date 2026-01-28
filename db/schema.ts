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
  
  // Skill scores (10 categories, 40+ sub-skills) - stored as JSON
  skillScores: text('skill_scores'), // JSON: { category: { subSkill: score } }
  
  // AI coaching recommendations
  coachingRecommendations: text('coaching_recommendations'), // JSON array of recommendations
  
  // Timestamped feedback
  timestampedFeedback: text('timestamped_feedback'), // JSON array of { timestamp, type, message, transcriptSegment }
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Offers table (Layer 1: Offer Intelligence)
export const offers = pgTable('offers', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), // Creator
  name: text('name').notNull(), // Offer name/title
  offerCategory: text('offer_category').notNull(), // 'b2c_health', 'b2c_wealth', 'b2c_relationships', 'b2b_services', 'mixed_wealth'
  whoItsFor: text('who_its_for').notNull(), // ICP definition
  coreOutcome: text('core_outcome').notNull(), // Transformation/result
  mechanismHighLevel: text('mechanism_high_level').notNull(), // How it works
  deliveryModel: text('delivery_model').notNull(), // 'dfy', 'dwy', 'diy', 'hybrid'
  supportChannels: text('support_channels'), // JSON array
  touchpointsFrequency: text('touchpoints_frequency'),
  implementationResponsibility: text('implementation_responsibility'), // 'prospect_heavy', 'provider_heavy', 'balanced'
  priceRange: text('price_range').notNull(), // e.g., "5000-25000"
  paymentOptions: text('payment_options'), // JSON
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
  difficultyTier: text('difficulty_tier').notNull(), // 'easy', 'realistic', 'hard', 'elite', 'near_impossible'
  
  // Prospect Profile Details
  positionDescription: text('position_description'), // Current situation
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

// Roleplay analysis table (4 pillars + overall score) — for AI roleplay sessions only
export const roleplayAnalysis = pgTable('roleplay_analysis', {
  id: uuid('id').defaultRandom().primaryKey(),
  roleplaySessionId: uuid('roleplay_session_id').notNull().references(() => roleplaySessions.id, { onDelete: 'cascade' }),
  overallScore: integer('overall_score'), // 0-100
  
  valueScore: integer('value_score'),
  trustScore: integer('trust_score'),
  fitScore: integer('fit_score'),
  logisticsScore: integer('logistics_score'),
  
  valueDetails: text('value_details'),
  trustDetails: text('trust_details'),
  fitDetails: text('fit_details'),
  logisticsDetails: text('logistics_details'),
  
  skillScores: text('skill_scores'),
  coachingRecommendations: text('coaching_recommendations'),
  timestampedFeedback: text('timestamped_feedback'),
  
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
  analysis: one(callAnalysis, {
    fields: [salesCalls.id],
    references: [callAnalysis.callId],
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