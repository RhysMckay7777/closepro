# Whop Subscription Integration Setup Guide

This guide explains how to set up and use the Whop subscription system in ClosePro.

## 📋 Overview

ClosePro now includes a complete Whop.com integration for subscription management with:
- 3 plan tiers (Starter, Pro, Enterprise)
- Seat-based pricing
- Usage tracking (calls, roleplay sessions)
- Feature access control
- Webhook handling for subscription events

## 🗄️ Database Schema Changes

New tables added:
- `subscriptions` - Stores Whop subscription data
- `billing_history` - Payment and billing events
- `usage_tracking` - Monthly usage counters (already existed, now properly used)

New enums:
- `subscription_status` - active, past_due, canceled, trialing, incomplete, paused

## 🔧 Environment Variables

Add these to your `.env.local`:

```env
# Whop Configuration
WHOP_API_KEY=your_whop_api_key_here
WHOP_WEBHOOK_SECRET=your_webhook_secret_here
NEXT_PUBLIC_WHOP_COMPANY_ID=your_company_id_here

# Whop Plan IDs (get these from your Whop dashboard)
WHOP_STARTER_PLAN_ID=plan_xxxxx
WHOP_PRO_PLAN_ID=plan_xxxxx
WHOP_ENTERPRISE_PLAN_ID=plan_xxxxx
```

## 📊 Database Migration

Run the database migration to create new tables:

```bash
npx drizzle-kit push
```

When prompted about `trial_ends_at` column:
- Select "+ trial_ends_at create column"

For organizations table changes:
- The migration will remove `whop_subscription_id`, `calls_per_month`, and `roleplay_sessions_per_month` from organizations
- These fields now live in the `subscriptions` table

## 🎯 Plan Configuration

Plans are configured in `/lib/plans.ts`:

| Feature | Starter | Pro | Enterprise |
|---------|---------|-----|-----------|
| Seats | 1-5 | 6-20 | Unlimited |
| Calls/month | 50 | 200 | Unlimited |
| AI Analysis | ✅ | ✅ | ✅ |
| Manager Dashboard | ✅ | ✅ | ✅ |
| AI Roleplay | ❌ | ✅ | ✅ |
| Roleplay sessions/mo | 0 | 50 | Unlimited |
| Priority support | ❌ | ✅ | ✅ |
| Price | $99/mo | $399/mo | Custom |

## 🔗 Whop Webhook Setup

1. Go to your Whop dashboard
2. Navigate to Settings → Webhooks
3. Add a new webhook endpoint: `https://yourdomain.com/api/webhooks/whop`
4. Select these events:
   - `subscription.created`
   - `subscription.updated`
   - `subscription.canceled`
   - `payment.succeeded`
   - `payment.failed`
5. Copy the webhook secret to your `.env.local`

## 🚀 User Flow

### 1. Checkout Flow

```typescript
// User visits /pricing page
// Clicks on a plan
// Redirects to /api/checkout
// Redirects to Whop checkout with metadata
// User completes payment on Whop
// Whop redirects back to your app
// Webhook activates subscription in your database
```

### 2. Feature Access Control

```typescript
import { hasFeatureAccess } from '@/lib/feature-access';

// Check if organization has access to AI Roleplay
const hasRoleplay = await hasFeatureAccess(organizationId, 'aiRoleplay');
```

### 3. Usage Tracking

```typescript
import { canPerformAction, incrementUsage } from '@/lib/subscription';

// Before uploading a call
const { allowed, reason } = await canPerformAction(organizationId, 'upload_call');

if (!allowed) {
  return { error: reason };
}

// After successful upload
await incrementUsage(organizationId, 'calls');
```

### 4. Check Usage Limits (API)

```bash
POST /api/usage/check
{
  "action": "upload_call" | "start_roleplay"
}

Response:
{
  "allowed": true | false,
  "reason": "string (if not allowed)"
}
```

### 5. Track Usage (API)

```bash
POST /api/usage/track
{
  "type": "calls" | "roleplay"
}

Response:
{
  "success": true
}
```

## 📱 UI Components

### Pricing Page
- `/pricing` - Shows all plans with features
- Redirects to Whop checkout

### Billing Page
- `/dashboard/billing` - View subscription status, usage, and manage billing
- Shows usage progress bars
- Links to Whop customer portal

### Dashboard Integration
- Sidebar now includes "Billing" link
- Usage limits enforced on call upload and roleplay

## 🔐 Protected Routes & Features

Example of protecting a feature route:

```typescript
// app/api/calls/upload/route.ts
import { canPerformAction, incrementUsage } from '@/lib/subscription';

export async function POST(request: NextRequest) {
  // ... get organizationId from user session
  
  // Check if allowed
  const { allowed, reason } = await canPerformAction(organizationId, 'upload_call');
  
  if (!allowed) {
    return NextResponse.json({ error: reason }, { status: 403 });
  }
  
  // ... process call upload
  
  // Track usage
  await incrementUsage(organizationId, 'calls');
  
  return NextResponse.json({ success: true });
}
```

## 🎨 Upgrade Prompts

Add upgrade prompts in your UI when limits are reached:

```typescript
const { allowed, reason } = await canPerformAction(organizationId, 'start_roleplay');

if (!allowed && reason?.includes('not available')) {
  // Show upgrade modal
  return (
    <Alert>
      <p>{reason}</p>
      <Link href="/pricing">Upgrade Now</Link>
    </Alert>
  );
}
```

## 📊 Testing

1. **Test Checkout Flow**: Visit `/pricing` and click on a plan
2. **Test Webhooks**: Use Whop's webhook testing tool
3. **Test Usage Limits**: 
   - Upload calls until limit reached
   - Try to start roleplay on Starter plan (should be blocked)
4. **Test Billing Page**: Visit `/dashboard/billing` to see subscription details

## 🛠️ Utilities Reference

### `/lib/plans.ts`
- `getPlan(tier)` - Get plan configuration
- `hasFeature(tier, feature)` - Check feature availability
- `isWithinLimit(tier, type, usage)` - Check usage limits

### `/lib/subscription.ts`
- `getActiveSubscription(orgId)` - Get active subscription
- `getCurrentUsage(orgId)` - Get current month usage
- `canPerformAction(orgId, action)` - Check if action allowed
- `incrementUsage(orgId, type)` - Increment usage counter

### `/lib/feature-access.ts`
- `hasFeatureAccess(orgId, feature)` - Check feature access
- `getFeatureAccessMap(orgId)` - Get all feature access flags

### `/lib/whop.ts`
- `createWhopCheckoutUrl(tier, orgId, email)` - Create checkout link
- `verifyWhopWebhook(payload, signature, secret)` - Verify webhook
- `getWhopSubscription(subId)` - Fetch subscription from Whop

## 🎯 Next Steps

1. ✅ Set up Whop account and get API keys
2. ✅ Configure environment variables
3. ✅ Run database migration
4. ✅ Set up webhook endpoint
5. ✅ Test checkout flow
6. 🔲 Implement seat management UI
7. 🔲 Add upgrade prompts throughout app
8. 🔲 Implement call upload feature
9. 🔲 Implement roleplay feature
10. 🔲 Add email notifications for subscription events

## ⚠️ Important Notes

- **Webhook Security**: Always verify webhook signatures
- **Usage Tracking**: Increment usage AFTER successful operation
- **Error Handling**: Show clear upgrade prompts when limits reached
- **Trial Period**: Set `trialEndsAt` in organizations table for free trials
- **Seat Management**: Coming soon - allow admins to add/remove team members

## 🐛 Troubleshooting

**Issue**: Subscription not activating after payment
- Check webhook endpoint is accessible
- Verify webhook secret matches
- Check Whop dashboard for delivery failures
- Review `/api/webhooks/whop` logs

**Issue**: Usage limits not enforcing
- Ensure you're calling `canPerformAction()` before operations
- Check subscription status is 'active' or 'trialing'
- Verify usage_tracking table has current month record

**Issue**: Features not gating properly
- Use `hasFeatureAccess()` to check permissions
- Ensure subscription.planTier matches expected values
- Check feature flags in `/lib/plans.ts`

## 📚 Resources

- [Whop API Docs](https://docs.whop.com)
- [Whop Webhook Guide](https://docs.whop.com/webhooks)
- [Drizzle ORM Docs](https://orm.drizzle.team)
