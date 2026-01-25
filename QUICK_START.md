# ClosePro - Quick Start Guide

## ✅ What's Already Done

Your complete authentication system is set up and ready to go:

- ✅ Better-Auth configured with email/password
- ✅ Drizzle ORM with PostgreSQL
- ✅ Database schema (users, organizations, sessions, usage tracking)
- ✅ Sign in & sign up pages
- ✅ Protected dashboard
- ✅ Route protection middleware
- ✅ Multi-tenant organization support
- ✅ Role-based access (Admin, Manager, Rep)
- ✅ Subscription tier structure (Starter, Pro, Enterprise)

## 🚀 Get Started in 3 Steps

### 1. Setup Database

```bash
# Create PostgreSQL database
createdb closepro

# Update .env.local with your PostgreSQL credentials
# Already created for you - just update the username/password:
# DATABASE_URL="postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/closepro"
```

### 2. Push Database Schema

```bash
npm run db:push
```

This creates all the tables (users, organizations, sessions, usage_tracking).

### 3. Run Dev Server

```bash
npm run dev
```

Open http://localhost:3000

## 🧪 Test It Out

1. Visit http://localhost:3000
2. Click "Get Started"
3. Fill in the signup form
4. See the dashboard (you're logged in!)
5. Sign out and try signing back in

## 📁 Project Structure

```
closepro/
├── app/
│   ├── (auth)/
│   │   ├── signin/page.tsx       # Sign in page
│   │   └── signup/page.tsx       # Sign up page
│   ├── (dashboard)/
│   │   └── dashboard/page.tsx    # Protected dashboard
│   ├── api/
│   │   ├── auth/[...all]/        # Better-auth endpoints
│   │   └── organizations/        # Org creation API
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Landing page
│   └── globals.css               # Tailwind
├── db/
│   ├── schema.ts                 # Database tables
│   └── index.ts                  # DB client
├── lib/
│   ├── auth.ts                   # Server auth
│   └── auth-client.ts            # Client auth hooks
├── middleware.ts                 # Route protection
├── drizzle.config.ts             # Drizzle config
└── .env.local                    # Environment variables
```

## 🔑 Environment Variables

Already set up in `.env.local`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/closepro"
BETTER_AUTH_SECRET="dev-secret-key-change-in-production-min-32-chars-long"
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

**Important:** Update `DATABASE_URL` with your actual PostgreSQL credentials!

## 💾 Database Schema

### Users
- Email, password (hashed), name
- Role: admin | manager | rep
- Linked to organization

### Organizations  
- Name, plan tier
- Whop subscription ID (for billing)
- Seat limits, call limits, roleplay limits
- Usage tracking

### Sessions
- Secure session storage
- 7-day expiry with refresh

### Usage Tracking
- Monthly usage per org
- Calls used, roleplay sessions used

## 🎨 UI Customization

The current UI is intentionally basic - ready for you to customize:

- All pages use Tailwind CSS
- Clean, simple forms
- Easy to restyle

Files to customize:
- `app/(auth)/signin/page.tsx` - Sign in UI
- `app/(auth)/signup/page.tsx` - Sign up UI
- `app/(dashboard)/dashboard/page.tsx` - Dashboard UI
- `app/page.tsx` - Landing page
- `app/globals.css` - Global styles

## 🛠 Useful Scripts

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run db:push      # Push DB schema changes
npm run db:studio    # Open Drizzle Studio (DB GUI)
```

## 🔐 Auth API

Using `better-auth` client hooks:

```typescript
import { signIn, signUp, signOut, useSession } from '@/lib/auth-client';

// Sign up
await signUp.email({ email, password, name });

// Sign in
await signIn.email({ email, password });

// Sign out
await signOut();

// Get session
const { data: session } = useSession();
```

## 🚧 What's Next?

Your auth foundation is solid. Now you can build:

1. **Whop Integration** - Billing & subscriptions
2. **Call Upload** - Audio file handling
3. **Transcription** - Speech-to-text pipeline
4. **AI Analysis** - 4-pillar evaluation
5. **Manager Dashboards** - Team analytics
6. **AI Roleplay** - Training environment

## 📖 Documentation

- [Better-Auth Docs](https://better-auth.com)
- [Drizzle ORM Docs](https://orm.drizzle.team)
- [Next.js 16 Docs](https://nextjs.org/docs)

## 💡 Tips

1. **Database GUI**: Run `npm run db:studio` to explore your database visually
2. **Type Safety**: All DB types are auto-generated (`User`, `Organization`, etc.)
3. **API Routes**: Use `auth.api.getSession()` to protect API routes
4. **Middleware**: Add routes to `publicRoutes` array to make them accessible without login

## 🐛 Troubleshooting

**Can't connect to database?**
```bash
brew services start postgresql  # macOS
# or
sudo systemctl start postgresql # Linux
```

**Module not found errors?**
```bash
rm -rf .next node_modules
npm install
```

**Auth not working?**
- Clear cookies
- Check `.env.local` is loaded
- Verify `DATABASE_URL` is correct

---

**Ready to build!** 🚀

Your auth system is production-ready. Start with `npm run dev` and begin adding your sales coaching features.
