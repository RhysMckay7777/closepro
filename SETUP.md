# ClosePro Setup Instructions

## 1. Install Dependencies

```bash
npm install
```

## 2. Setup Environment Variables

Create a `.env.local` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/closepro"

# Auth
BETTER_AUTH_SECRET="dev-secret-key-change-in-production-min-32-chars"
BETTER_AUTH_URL="http://localhost:3000"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

**Important:** Change the `DATABASE_URL` to match your PostgreSQL credentials.

## 3. Setup PostgreSQL Database

Make sure you have PostgreSQL installed and running.

### Create the database:

```bash
createdb closepro
```

Or via psql:

```sql
CREATE DATABASE closepro;
```

## 4. Push Database Schema

```bash
npm run db:push
```

This will create all the necessary tables in your database using Drizzle ORM.

## 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 6. Test Authentication

1. Go to `/signup` to create an account
2. Fill in your details
3. You'll be redirected to `/dashboard`
4. Sign out and test `/signin`

## Database Commands

- `npm run db:generate` - Generate migrations
- `npm run db:migrate` - Run migrations
- `npm run db:push` - Push schema changes (dev only)
- `npm run db:studio` - Open Drizzle Studio (GUI for your database)

## Troubleshooting

### Database connection issues

Make sure PostgreSQL is running:

```bash
# macOS
brew services start postgresql

# Linux
sudo systemctl start postgresql
```

### Module not found errors

Clear Next.js cache:

```bash
rm -rf .next
npm run dev
```

## Project Structure

```
/app
  /(auth)           # Auth pages (signin, signup)
  /(dashboard)      # Protected dashboard pages
  /api              # API routes
  layout.tsx        # Root layout
  page.tsx          # Landing page
  globals.css       # Global styles
/db
  schema.ts         # Database schema
  index.ts          # Database client
/lib
  auth.ts           # Server-side auth
  auth-client.ts    # Client-side auth
middleware.ts       # Route protection
drizzle.config.ts   # Drizzle ORM config
```

## Next Steps

1. ✅ Auth system is set up
2. Add Whop integration for subscriptions
3. Build call upload functionality
4. Implement AI analysis engine
5. Create manager dashboards
6. Build AI roleplay feature
