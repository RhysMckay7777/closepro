Perform a COMPLETE codebase analysis of this project. Go through every directory and file systematically. I need a full understanding of the architecture, data flow, and current state.

## Step 1: Project Structure
- Run `find . -type f \( -name "*.ts" -name "*.tsx" \) | grep -v node_modules | grep -v .next | sort` to list all source files
- Run `cat package.json` to get dependencies and scripts
- Run `cat tsconfig.json` for TypeScript config
- Run `cat next.config.*` for Next.js config

## Step 2: Database Schema
- Read `db/schema.ts` completely — document EVERY table, EVERY column, types, relationships, foreign keys
- Read `db/index.ts` or `db/drizzle.ts` for DB connection setup
- Read any migration files in `db/migrations/` or `drizzle/`
- Document the full ERD (Entity Relationship Diagram) as text

## Step 3: API Routes
- List every file in `app/api/` recursively
- Read EACH route.ts file and document:
  - HTTP methods (GET/POST/PUT/DELETE)
  - Auth requirements
  - Input parameters (query params, body)
  - DB queries performed
  - Response shape (what JSON is returned)
  - Any business logic / calculations

## Step 4: Pages & Components
- List every file in `app/(dashboard)/` and `app/` page files
- For each page, document:
  - What API it calls
  - What state it manages
  - What components it uses
  - User interactions available
- List every file in `components/` and document each component's props and purpose

## Step 5: Library / Utils
- Read every file in `lib/` — document:
  - `lib/ai/` — AI analysis, scoring framework, prompts
  - `lib/training/` — core principles, skill clusters, prospect backstories
  - `lib/auth.*` — authentication setup
  - `lib/roleplay-engine.ts` — roleplay AI system
  - Any utils, helpers, types

## Step 6: Data Flow Analysis
For each major feature, trace the COMPLETE data flow:

### A. Call Analysis Flow
Upload/record → transcription → AI analysis → score extraction → DB storage → display on call detail page → feeds into performance page

### B. Roleplay Flow  
Create session (select offer + prospect) → roleplay engine builds system prompt → conversation loop → end session → AI scoring → results page

### C. Performance Page Flow
API fetches all analyses → parseSkillScoresFlat / deriveSkillScoresFromPhases → computeSkillBreakdown → principleSummaries → priorityActionSteps → page renders

### D. Figures Page Flow
API fetches sales calls + instalments → commission calculation → paymentType assignment → isFutureInstalment check → page renders with table + exports

### E. Replay in Roleplay Flow
Call detail page → POST /api/roleplay/replay → extract transcript + prospect profile → create roleplay session → buildOriginalProspectPrompt → AI mimics prospect

## Step 7: Configuration & Environment
- Read `.env.example` or `.env.local` for required environment variables
- Document all external service integrations (Supabase, AI providers, etc.)
- Check `middleware.ts` for route protection

## Step 8: Known Issues & Tech Debt
- Find any TODO/FIXME/HACK comments: `grep -r "TODO\|FIXME\|HACK\|XXX" --include="*.ts" --include="*.tsx" | grep -v node_modules`
- Find unused exports: any files that are defined but never imported
- Check for `console.log` statements that should be removed: `grep -rn "console.log" app/ lib/ components/ --include="*.ts" --include="*.tsx" | grep -v node_modules | head -30`
- Identify any dead code (old skill-clusters references, etc.)

## Step 9: Output Format

Produce a single comprehensive document with:

1. **Architecture Overview** — tech stack, folder structure, deployment
2. **Database Schema** — every table with columns and types
3. **API Reference** — every endpoint with method, params, response
4. **Page Map** — every page with its features and API dependencies  
5. **Component Library** — every component with props
6. **Data Flow Diagrams** — text-based flow for each major feature
7. **Business Logic** — commission calculations, scoring framework, principle mappings
8. **External Integrations** — AI providers, payment, auth
9. **Issues & Tech Debt** — TODOs, dead code, debug logging to remove
10. **File Index** — every source file with a one-line description

Be thorough. Read every file. Don't skip anything. This document will be used as the single source of truth for the entire project.
