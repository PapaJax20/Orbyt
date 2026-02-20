# Orbyt — Project Bible & Developer Handoff Document

> **"Your Family's AI Butler — Everything your family needs, in one place."**

| Field | Value |
|---|---|
| **Version** | 3.0 |
| **Last updated** | February 20, 2026 |
| **GitHub** | https://github.com/PapaJax20/Orbyt |
| **Local path** | `C:\Users\jmoon\Orbyt` |
| **Status** | App running locally. Auth, Dashboard, and Tasks fully built. 5 feature pages remain as stubs. |
| **Project Lead** | J. Moon |
| **Development Environment** | Claude Code Agent Teams (see Section 26) |

> **REVISION NOTE (v3.0):** This revision corrects 11 discrepancies between the original bible and the actual codebase, adds a complete Entity Relationship Diagram derived from the Drizzle schema files, rewrites the API Contract Reference to match runtime behavior, adds a full Claude Code Agent Teams development environment specification (Section 26), and incorporates all Tier 1 launch-blocking fixes. Changes from v2.0 are marked with `[v3 CHANGE]` or `[v3 NEW]` inline.

---

## TABLE OF CONTENTS

1. [Project Overview & Vision](#1-project-overview--vision)
2. [Quick Start for New Developers](#2-quick-start-for-new-developers)
3. [Environment Variables](#3-environment-variables)
4. [Architecture Overview](#4-architecture-overview)
5. [Tech Stack](#5-tech-stack)
6. [Repo Structure](#6-repo-structure)
7. [What Has Been Built (Completed Work)](#7-what-has-been-built-completed-work)
8. [Brand & Design Language](#8-brand--design-language)
9. [Front-End Development Guidelines](#9-front-end-development-guidelines)
10. [State Management Patterns](#10-state-management-patterns)
11. [Error Handling Strategy](#11-error-handling-strategy)
12. [Sprint Plan (Remaining Work)](#12-sprint-plan-remaining-work)
13. [Testing Strategy](#13-testing-strategy)
14. [CI/CD Pipeline](#14-cicd-pipeline)
15. [Branching Strategy for Parallel Agents](#15-branching-strategy-for-parallel-agents)
16. [Database Seeding & Fixtures](#16-database-seeding--fixtures)
17. [API Contract Reference](#17-api-contract-reference)
18. [Entity Relationship Diagram & Schema Reference](#18-entity-relationship-diagram--schema-reference)
19. [Security Checklist](#19-security-checklist)
20. [Performance Budget](#20-performance-budget)
21. [Deployment Plan](#21-deployment-plan)
22. [AI Integration Roadmap (Phase 3+)](#22-ai-integration-roadmap-phase-3)
23. [Known Issues & Tech Debt](#23-known-issues--tech-debt)
24. [Legal & Compliance Flags](#24-legal--compliance-flags)
25. [Observability & Logging](#25-observability--logging)
26. [Claude Code Development Environment](#26-claude-code-development-environment)
27. [Git History](#27-git-history)
28. [Useful Commands](#28-useful-commands)
29. [Glossary](#29-glossary)

---

## 1. PROJECT OVERVIEW & VISION

Orbyt is a household management Progressive Web App — a CRM for the family. Just as HubSpot or Salesforce serves as the single source of truth for a business, Orbyt serves as the single source of truth for a family unit. It consolidates tasks, calendar events, shared shopping lists, bill tracking, and contact management into one app with real-time collaboration between household members.

The app's identity is rooted in retro-futurism — the optimistic, space-age vision of domestic life from The Jetsons, reimagined for today. The feeling is "the future we were promised, finally delivered." Two AI companion characters, Rosie and Eddie, serve as the personality layer of the app and will eventually become fully autonomous AI agents (Phase 3+).

### Core Principles

The app should feel alive and collaborative — when one family member checks off a shopping item, every other member sees it instantly. Every feature should be so intuitive that a non-technical parent can adopt it without friction. The design earns trust through competence first, then rewards users with warmth and personality at the right moments.

### Target Users

Families of 2–8 members, primarily managed by one "admin" parent with other members having standard access. The primary adoption persona is a busy mom or dad who wants to reduce the mental load of running a household.

### Platform Targets

Phase 1 targets a Progressive Web App (responsive web, installable via manifest). Phase 2 will deliver native mobile via Expo/React Native. Phase 3 introduces AI agent integration. **No development time should be spent on Phase 2 or Phase 3 during the current sprint plan.**

> **⛔ PHASE BOUNDARY — HARD RULE:** No developer or agent should spend any time on Phase 2 (native mobile) or Phase 3 (AI integration) work during the current sprint cycle. The AI schema tables (`ai_conversations`, `ai_messages`) already exist in the database and should not be modified. The `/packages/api/src/routers/` directory should not gain any new AI-related routers. If you encounter a TODO referencing AI or Phase 3 in the codebase, leave it in place.

---

## 2. QUICK START FOR NEW DEVELOPERS

### Prerequisites

Node.js 22+, pnpm 10+, Docker Desktop running, Git configured.

```bash
# 1. Clone the repo
git clone https://github.com/PapaJax20/Orbyt.git
cd Orbyt

# 2. Install all workspace dependencies
pnpm install

# 3. Install Supabase CLI (Windows — download binary from GitHub releases)
#    https://github.com/supabase/cli/releases
#    Extract supabase.exe → add to system PATH
supabase --version   # Confirm: 2.75.0+

# 4. Start local Supabase (Docker Desktop must be running)
supabase start
# Outputs: API URL, anon key, service role key — COPY THESE

# 5. Create your local env file
cp apps/web/.env.local.example apps/web/.env.local
# Edit .env.local with the values from step 4 (see Section 3)

# 6. Apply the database migration
supabase db push

# 7. Seed the database with sample data
pnpm --filter @orbyt/db db:seed

# 8. Start the dev server
pnpm --filter @orbyt/web dev
# → http://localhost:3000
```

### Verification Checklist

Go to `/register` → complete the onboarding wizard (account → household → AI companion → choose your vibe) → land on `/dashboard`. Open Supabase Studio at `http://localhost:54323` — confirm rows exist in `profiles` and `households` tables. On the dashboard, confirm all 4 stat cards render (even if showing zeros). Open browser DevTools Network tab — confirm tRPC requests return 200. Open `http://localhost:54324` (Inbucket) — confirm the auth confirmation email arrived. If using seed data, log in with `demo@orbyt.app` / `password123` and confirm the dashboard shows populated widgets.

### Common Issues & Fixes

If `supabase start` fails with port conflicts, run `supabase stop` first, then check Docker Desktop is running. If tRPC queries return empty arrays, verify the `x-household-id` header is being sent (check Network tab → request headers). If you see "JWT expired" errors, clear `localStorage` and re-login. The `sb_publishable_*` / `sb_secret_*` key format is required for Supabase CLI v2.75+ — do NOT use old `eyJ...` JWT-format keys.

---

## 3. ENVIRONMENT VARIABLES

**File:** `apps/web/.env.local` (gitignored — create from `.env.local.example`)

```env
# Supabase (from `supabase start` output)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_<from supabase start>
SUPABASE_SERVICE_ROLE_KEY=sb_secret_<from supabase start>
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Email (not required for local dev — invites will log to console)
# RESEND_API_KEY=re_xxxxxxxxxxxx

# Error tracking (not required for local dev)
# NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
# SENTRY_AUTH_TOKEN=sntrys_xxxx
```

**Production-only variables (set in Vercel dashboard):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (Supabase connection pooler URL), `NEXT_PUBLIC_APP_URL` (production domain), `RESEND_API_KEY`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`.

> **🔒 SECURITY RULE:** Any variable prefixed with `NEXT_PUBLIC_` is exposed to the browser bundle. **NEVER** prefix `SUPABASE_SERVICE_ROLE_KEY` with `NEXT_PUBLIC_`. This is checked in CI and enforced by a pre-commit hook.

---

## 4. ARCHITECTURE OVERVIEW

```
┌──────────────────────────────────────────────────────────────────┐
│                        BROWSER (Client)                          │
│  Next.js App Router (React Server Components + Client Components)│
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────┐      │
│  │ RSC Pages│  │  Client Comp │  │ Supabase Realtime Sub │      │
│  │(SSR data)│  │ (trpc hooks) │  │ (postgres_changes)    │      │
│  └────┬─────┘  └──────┬───────┘  └───────────┬───────────┘      │
│       │               │                       │                  │
│       │    ┌──────────┴──────────┐            │                  │
│       │    │  TanStack Query     │ ◄──────────┘ (invalidate)     │
│       │    │  Cache              │                                │
│       │    └──────────┬──────────┘                                │
└───────┼───────────────┼──────────────────────────────────────────┘
        │               │
        ▼               ▼
┌───────────────────────────────────────┐
│     Next.js API Route: /api/trpc     │
│     ┌─────────────────────────┐      │
│     │   tRPC AppRouter        │      │
│     │   ┌───────────────────┐ │      │
│     │   │ Context:          │ │      │
│     │   │  - db (Drizzle)   │ │      │
│     │   │  - user (Profile) │ │      │
│     │   │  - householdId    │ │      │
│     │   └───────────────────┘ │      │
│     │   Procedure Tiers:      │      │
│     │   public → protected →  │      │
│     │   household → admin     │      │
│     └─────────────────────────┘      │
└───────────────┬───────────────────────┘
                │
                ▼
┌───────────────────────────────────────┐
│         Supabase (Postgres)           │
│  ┌──────────┐ ┌─────────┐ ┌───────┐  │
│  │ Auth     │ │ DB+RLS  │ │Storage│  │
│  └──────────┘ └─────────┘ └───────┘  │
│  Row Level Security on ALL tables     │
│  Realtime on: shopping_items,         │
│    notifications, tasks, events       │
└───────────────────────────────────────┘
```

### Key Architectural Decisions

**tRPC Context & Household Selection:** The route handler at `apps/web/app/api/trpc/[trpc]/route.ts` reads `x-household-id` from request headers. `components/providers.tsx` reads from `localStorage.getItem('orbyt-household-id')` and sends it on every request. This ID MUST be set after login/registration — it's set in `login-form.tsx` and `register-form.tsx`. If this header is missing, all household-scoped queries will fail with a `BAD_REQUEST` error ("No household selected"). `[v3 CHANGE]` The original bible said queries "fail silently (return empty results due to RLS)" — this is incorrect. The `householdProcedure` middleware throws a `TRPCError` with code `BAD_REQUEST` if `householdId` is null.

**tRPC Context Shape:** The context object (`packages/api/src/context.ts`) contains `db` (Drizzle client), `user` (the `Profile` row from the `profiles` table, or null if unauthenticated), and `householdId` (string or null). The `householdProcedure` middleware adds `memberRole` (`"admin" | "member" | "child"`) after verifying household membership. `[v3 NEW]`

**Procedure Tier Error Behavior:** `publicProcedure` has no auth check. `protectedProcedure` throws `UNAUTHORIZED` if no user session. `householdProcedure` throws `BAD_REQUEST` if no household ID, and `FORBIDDEN` if the user is not a member of the requested household. `adminProcedure` throws `FORBIDDEN` if the member's role is not `"admin"`. These are hard errors, not silent failures. `[v3 NEW]`

**Server Components vs. Client Components:** Page files (`page.tsx`) are React Server Components that fetch metadata and render the client wrapper. All interactive content lives in `*-content.tsx` Client Components that use tRPC hooks. This is a hard pattern — follow it for all new pages.

**Real-time Pattern:** Supabase Realtime subscriptions listen for Postgres changes and invalidate the relevant TanStack Query cache entry. This triggers a refetch, keeping the UI in sync. The subscription setup should live in a `useEffect` in the content component and must clean up on unmount. Tables with Realtime enabled: `shopping_items`, `notifications`, `tasks`, `events`.

### How to add a new tRPC query in a client component

```tsx
"use client";
import { trpc } from "@/lib/trpc/client";
import type { AppRouter } from "@orbyt/api";
import type { inferRouterOutputs } from "@trpc/server";

type RouterOutput = inferRouterOutputs<AppRouter>;
type MyItem = RouterOutput["someRouter"]["someQuery"][number];

export function MyComponent() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.someRouter.someQuery.useQuery({ ...inputs });
  const mutation = trpc.someRouter.someMutation.useMutation({
    onSuccess: () => utils.someRouter.someQuery.invalidate(),
  });
}
```

> **⚠️ TYPE SAFETY:** Never use `NonNullable<ReturnType<typeof trpc.xxx.useQuery>["data"]>` for types — it returns `{}`. Always use `inferRouterOutputs<AppRouter>` instead.

### How to set up real-time with Supabase

```tsx
import { createBrowserClient } from "@/lib/supabase/client";

const supabase = createBrowserClient();
const channel = supabase
  .channel('my-channel')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items' },
    payload => { /* invalidate query */ })
  .subscribe();

// Cleanup: return () => supabase.removeChannel(channel);
```

### CSS Theme System

Set theme by changing `data-theme` attribute on `<html>`:

```ts
document.documentElement.setAttribute('data-theme', 'aurora');
```

All Tailwind utilities like `bg-bg`, `text-accent`, `border-border` read from the theme's CSS variables automatically.

---

## 5. TECH STACK

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Monorepo | Turborepo + pnpm workspaces | Turbo 2, pnpm 10.30 | |
| Framework | Next.js App Router | 15.1.3 | RSC + Client Components |
| Language | TypeScript | 5.7+ (strict) | No `any` allowed |
| Font | Urbanist (Google Fonts) | — | via `next/font/google` |
| Styling | Tailwind CSS | 3.4 | Custom theme via CSS vars |
| Animations | Framer Motion | 11.18 | Page transitions, drawers |
| Drag & Drop | @dnd-kit/core | 6.3 | Tasks Kanban only |
| UI Primitives | Radix UI | Various | Accessible by default |
| Icons | Lucide React | 0.474 | Rounded stroke style |
| API | tRPC | 11.0 | Type-safe end-to-end |
| Server State | TanStack Query | 5.65 | Cache + background refetch |
| Database | Supabase (Postgres) + Drizzle ORM | — | RLS on all tables, 17 tables + relations |
| Auth | Supabase Auth | — | Email/password + magic link |
| Realtime | Supabase Realtime | — | Postgres changes channel |
| Toasts | Sonner | 1.7 | Bottom-right position |
| Calendar (planned) | @fullcalendar/react | 6.x | Sprint 4D |
| Deployment | Vercel (planned) | — | |
| Error Tracking | Sentry (planned) | — | Sprint 5 |
| Email | Resend (planned) | — | Sprint 5 |

---

## 6. REPO STRUCTURE

```
C:\Users\jmoon\Orbyt\
├── .github/
│   └── workflows/
│       ├── ci.yml                     ← [TO CREATE] CI pipeline
│       └── preview.yml                ← [TO CREATE] Vercel preview deploys
│
├── .claude/                           ← [v3 NEW] Claude Code configuration
│   ├── settings.json                  ← Agent permissions, hooks, env
│   ├── agents/                        ← Custom subagent definitions
│   │   ├── feature-builder.md
│   │   ├── e2e-tester.md
│   │   └── qa-reviewer.md
│   └── skills/                        ← Orbyt-specific knowledge
│       ├── orbyt-trpc-pattern/SKILL.md
│       ├── orbyt-page-pattern/SKILL.md
│       ├── orbyt-realtime-pattern/SKILL.md
│       ├── orbyt-ui-pattern/SKILL.md
│       └── orbyt-theme-system/SKILL.md
│
├── apps/
│   └── web/                           ← Next.js 15 (THE ACTIVE APP)
│       ├── app/
│       │   ├── (auth)/
│       │   │   ├── layout.tsx         ← Auth shell with orbital background
│       │   │   ├── login/login-form.tsx
│       │   │   ├── register/register-form.tsx
│       │   │   └── invite/[token]/page.tsx ← [STUB]
│       │   ├── (dashboard)/
│       │   │   ├── layout.tsx         ← Sidebar + Header + TRPCProvider + HouseholdGuard
│       │   │   ├── dashboard/
│       │   │   │   ├── page.tsx       ← ✅ Complete
│       │   │   │   └── loading.tsx    ← [TO CREATE]
│       │   │   ├── tasks/
│       │   │   │   ├── page.tsx       ← ✅ Complete
│       │   │   │   └── loading.tsx    ← [TO CREATE]
│       │   │   ├── shopping/page.tsx  ← STUB — Sprint 4B
│       │   │   ├── finances/page.tsx  ← STUB — Sprint 4C
│       │   │   ├── calendar/page.tsx  ← STUB — Sprint 4D
│       │   │   ├── contacts/page.tsx  ← STUB — Sprint 4E
│       │   │   └── settings/page.tsx  ← STUB — Sprint 4F
│       │   ├── api/
│       │   │   ├── trpc/[trpc]/route.ts
│       │   │   └── auth/callback/route.ts
│       │   ├── globals.css            ← ALL theme CSS variables
│       │   ├── layout.tsx             ← Root layout
│       │   └── not-found.tsx          ← [TO CREATE]
│       │
│       ├── components/
│       │   ├── ui/                    ← [TO CREATE] Shared UI components
│       │   │   ├── drawer.tsx
│       │   │   ├── confirm-dialog.tsx
│       │   │   ├── empty-state.tsx
│       │   │   ├── error-boundary.tsx
│       │   │   └── skeleton.tsx
│       │   ├── mobile-nav.tsx         ← [TO CREATE] Bottom tab bar
│       │   ├── sidebar.tsx
│       │   ├── dashboard-header.tsx
│       │   ├── household-guard.tsx
│       │   ├── providers.tsx
│       │   ├── dashboard-content.tsx
│       │   ├── tasks/                 ← ✅ Complete
│       │   ├── shopping/              ← Sprint 4B
│       │   ├── finances/              ← Sprint 4C
│       │   ├── calendar/              ← Sprint 4D
│       │   ├── contacts/              ← Sprint 4E
│       │   └── settings/              ← Sprint 4F
│       │
│       ├── hooks/                     ← [TO CREATE]
│       │   ├── use-realtime.ts
│       │   ├── use-household.ts
│       │   └── use-media-query.ts
│       │
│       ├── lib/
│       │   ├── supabase/client.ts
│       │   ├── supabase/server.ts
│       │   ├── trpc/client.ts
│       │   ├── trpc/server.ts
│       │   └── trpc/vanilla.ts
│       │
│       ├── middleware.ts
│       ├── .env.local                 ← LOCAL ONLY (gitignored)
│       └── .env.local.example         ← [TO CREATE]
│
├── packages/
│   ├── api/src/
│   │   ├── trpc.ts                    ← Procedure chain: public → protected → household → admin
│   │   ├── context.ts                 ← Context interface: { db, user, householdId }
│   │   ├── index.ts                   ← AppRouter export
│   │   └── routers/
│   │       ├── household.ts           ← create, list, getCurrent, update, inviteMember, acceptInvitation, removeMember, updateProfile
│   │       ├── calendar.ts            ← list, getById, create, update, delete
│   │       ├── tasks.ts               ← (see actual router for full procedures)
│   │       ├── finances.ts            ← listBills, getBillById, createBill, updateBill, deleteBill, markPaid, getMonthlyOverview, getUpcoming
│   │       ├── shopping.ts            ← listLists, createList, listItems, addItem, checkItem, deleteItem, clearChecked
│   │       ├── contacts.ts            ← list, getById, create, update, delete, addNote, linkRelationship, getUpcomingBirthdays
│   │       └── notifications.ts
│   │
│   ├── db/src/
│   │   ├── schema/
│   │   │   ├── households.ts          ← profiles, households, householdMembers, invitations
│   │   │   ├── events.ts              ← events, eventAttendees
│   │   │   ├── tasks.ts               ← tasks, taskAssignees, taskComments
│   │   │   ├── finances.ts            ← bills, billPayments
│   │   │   ├── shopping.ts            ← shoppingLists, shoppingItems
│   │   │   ├── contacts.ts            ← contacts, contactRelationships, contactNotes
│   │   │   ├── notifications.ts       ← notifications, pushTokens
│   │   │   ├── ai.ts                  ← aiConversations, aiMessages (Phase 3 scaffold — DO NOT MODIFY)
│   │   │   └── relations.ts           ← All Drizzle relation definitions
│   │   └── seed.ts                    ← [TO CREATE]
│   │
│   ├── shared/src/
│   │   ├── utils/
│   │   │   ├── dates.ts
│   │   │   ├── currency.ts
│   │   │   ├── recurrence.ts
│   │   │   └── color.ts
│   │   ├── validators/
│   │   └── constants/
│   │
│   ├── config/tailwind/base.config.ts
│   └── ui/
│
├── supabase/
│   ├── config.toml
│   ├── migrations/001_initial_schema.sql
│   └── seed.sql                       ← [TO CREATE]
│
├── docs/
│   ├── screenshots/                   ← [TO CREATE] Visual references
│   └── design/                        ← [TO CREATE] Design assets
│
├── CLAUDE.md                          ← [v3 NEW] Root project instructions for Claude Code
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

---

## 7. WHAT HAS BEEN BUILT (Completed Work)

### Infrastructure — ✅ Complete

Turborepo v2 + pnpm workspaces monorepo (5 packages). TypeScript 5.7+, strict mode, clean typecheck across all packages. Git history: 7 commits on main.

### Database (packages/db) — ✅ Complete

`[v3 CHANGE]` Complete Drizzle ORM schema across **8 schema files defining 17 tables** plus a relations file. Full table inventory: `profiles`, `households`, `household_members`, `invitations`, `tasks`, `task_assignees`, `task_comments`, `events`, `event_attendees`, `bills`, `bill_payments`, `shopping_lists`, `shopping_items`, `contacts`, `contact_relationships`, `contact_notes`, `notifications`, `push_tokens`, `ai_conversations`, `ai_messages`. Migration `001_initial_schema.sql` applied and working. RLS policies on every table enforcing household data isolation. `handle_new_user()` trigger auto-creates a `profiles` row on Supabase Auth signup. Realtime enabled on: `shopping_items`, `notifications`, `tasks`, `events`. See Section 18 for the complete Entity Relationship Diagram with column-level detail.

### API (packages/api) — ✅ Complete for Phase 1

tRPC AppRouter with SuperJSON transformer. 4-tier procedure chain: `publicProcedure` → `protectedProcedure` → `householdProcedure` → `adminProcedure`. Error formatter includes Zod flattened errors in the response shape. 7 fully implemented routers: `household` (8 procedures), `calendar` (5 procedures), `tasks`, `finances` (8 procedures), `shopping` (7 procedures), `contacts` (8 procedures), `notifications`. All CRUD operations covered — **no backend work is needed for remaining feature pages**. See Section 17 for the corrected API contract reference.

`[v3 CHANGE]` The original bible stated "All CRUD operations covered" without specifying procedure counts. The actual router implementations include procedures not documented in the original bible: `finances.getBillById`, `finances.updateBill`, `finances.getUpcoming`, `contacts.linkRelationship`, and `calendar.getById`. All are documented in the corrected Section 17.

### Shared Utilities (packages/shared) — ✅ Complete

Full TypeScript types for all entities. Zod validators for all create/update operations (`CreateShoppingListSchema`, `AddShoppingItemSchema`, `CheckShoppingItemSchema`, `CreateBillSchema`, `UpdateBillSchema`, `MarkBillPaidSchema`, `GetMonthlyOverviewSchema`, `CreateEventSchema`, `UpdateEventSchema`, `ListEventsSchema`, `DeleteEventSchema`, `CreateContactSchema`, `UpdateContactSchema`, `AddContactNoteSchema`, `LinkRelationshipSchema`, `CreateHouseholdSchema`, `UpdateHouseholdSchema`, `InviteMemberSchema`, `UpdateProfileSchema`). Utility functions: `formatFriendlyDate()`, `formatCurrency()`, `getNextBillDueDate()`, `getDaysUntilBirthday()`, `getNextBirthday()`, `expandRecurringEvents()`, `buildRRule()`, `stringToColor()`, `addDays()`. 9 theme definitions and CSS variable mappings.

### Design System (packages/config + packages/ui)

9 themes via `data-theme` attribute on `<html>`. All theme CSS defined in `apps/web/app/globals.css`. UI primitives: `GlassCard`, `StatCard`, `OrbitalLoader`, `MemberAvatar`, `SpaceButton`. CSS utility classes: `.glass-card`, `.orbyt-button-accent`, `.orbyt-button-ghost`, `.orbyt-input`.

### Web App — Auth — ✅ Complete

| File | What it does |
|---|---|
| `app/(auth)/layout.tsx` | Auth shell with orbital background decorations |
| `app/(auth)/login/login-form.tsx` | Email/password login + auto-select first household |
| `app/(auth)/register/register-form.tsx` | 3-step wizard: account → household → AI persona |
| `app/api/auth/callback/route.ts` | Supabase OAuth/magic-link callback |
| `middleware.ts` | Session refresh + route protection (redirects if unauthed) |

### Web App — Dashboard Shell — ✅ Complete

| File | What it does |
|---|---|
| `app/(dashboard)/layout.tsx` | Sidebar + header + TRPCProvider + HouseholdGuard |
| `components/sidebar.tsx` | Collapsible nav (icon-only mobile, full desktop) |
| `components/dashboard-header.tsx` | Top bar with notification bell + user avatar |
| `components/providers.tsx` | tRPC + React Query providers; sends `x-household-id` header |
| `components/household-guard.tsx` | Ensures household ID set; shows creation form if missing |
| `lib/trpc/client.ts` | `createTRPCReact<AppRouter>()` — Client Components |
| `lib/trpc/server.ts` | `createServerTRPCClient()` — Server Components |
| `lib/trpc/vanilla.ts` | Standalone client for auth forms (outside TRPCProvider) |
| `lib/supabase/client.ts` | Browser Supabase client |
| `lib/supabase/server.ts` | Server Supabase client |

### Web App — Dashboard Home (/dashboard) — ✅ Complete

| File | What it does |
|---|---|
| `app/(dashboard)/dashboard/page.tsx` | Server component wrapper with metadata |
| `components/dashboard-content.tsx` | All 4 stat cards + 4 widgets wired to real tRPC queries |

Stat cards: tasks due today, bills due this week, upcoming birthdays, unchecked shopping items. Widgets: Upcoming Events (7 days), Financial Snapshot (30 days), Tasks (pending), Shopping Lists. Each widget: skeleton loader → real data rows → empty CTA.

### Web App — Tasks (/tasks) — ✅ Complete

| File | What it does |
|---|---|
| `app/(dashboard)/tasks/page.tsx` | Server component wrapper |
| `components/tasks/tasks-content.tsx` | Kanban board + list view + all state management |
| `components/tasks/task-drawer.tsx` | Slide-out panel: create / view / edit / comments |

Features built: Kanban with 3 columns (To Do / In Progress / Done) using `@dnd-kit/core` drag-and-drop. List view toggle (grid ↔ list icons). Task cards with priority dot, title, stacked assignee avatars, due date (red if overdue). Drawer with title, priority, status, due date, assignee multi-select, description. Comment thread in view mode (list + add comment). Delete with confirmation.

`[v3 NOTE]` The `tasks` schema includes `parentTaskId` for subtasks, `tags` array, and `rrule` for recurring tasks. These fields exist in the database but are **not exposed in the Tasks UI in Phase 1**. Do not build subtask or recurring task UI. The fields are there for Phase 2.
```

---


---

## 8. BRAND & DESIGN LANGUAGE

### 8.1 Design Philosophy

> **"The future we were promised, finally delivered."**

Orbyt's design is rooted in retro-futurism — the optimistic, space-age vision of domestic life popularized by The Jetsons, reimagined through a modern product design lens. The aesthetic style is known as "Googie" — characterized by upswept roofs, bold curves, and atomic-age optimism. The goal is not to recreate the cartoon. The goal is to deliver the feeling that show promised: technology that makes family life effortless, warm, and even a little delightful.

This translates into three concrete design principles that govern every decision:

**Principle 1 — Invisible First.** The interface should disappear into the user's life. Core workflows (checking off a shopping item, adding a bill, creating a calendar event) must be completable in 1-3 taps with zero learning curve. If a non-technical parent can't figure out how to do something within 3 seconds of looking at the screen, the design has failed. No feature should require a tutorial, tooltip, or onboarding walkthrough to understand. Labels use family language: "Bills" not "Financial Instruments," "Family Contacts" not "Contact Relationship Management," "Shopping" not "Procurement Lists."

**Principle 2 — Personality at the Edges.** Orbyt sits at 60-65% on the spectrum between minimal productivity tool (Notion) and character-driven experience (Pixar). The core work surfaces — task lists, calendar grids, bill tables, shopping checkboxes — are clean, efficient, and unadorned. The personality (Rosie/Eddie characters, retro-futuristic illustration, playful microcopy, celebration animations) appears at the edges of the experience: onboarding, empty states, success moments, the dashboard greeting, and loading transitions. These moments of warmth exist to make the app feel human and approachable without slowing down the user who's in the middle of getting things done.

**Principle 3 — Earn Trust Through Competence.** The app must feel reliable before it feels fun. Smooth animations, fast load times, and correct data come first. The retro-futuristic charm is the reward for an app that already works flawlessly. If the user ever perceives that personality is coming at the cost of function, the balance is wrong.

### 8.2 Retro-Futuristic Aesthetic — Concrete Specifications

The Jetsons DNA is expressed through shape language, motion design, and ambient visual effects — never through literal cartoon imagery on work surfaces.

#### Shape Language

Every surface and interactive element uses generous rounding. This is the single strongest visual signal of the retro-futuristic identity. Hard corners feel corporate and cold; the rounded shapes feel friendly and optimistic.

| Element | Border Radius | Tailwind Class |
|---|---|---|
| Page-level cards (GlassCard) | 20px | `rounded-2xl` |
| Buttons (SpaceButton) | 14px | `rounded-xl` |
| Input fields | 12px | `rounded-xl` |
| Chips/badges | 9999px (full pill) | `rounded-full` |
| Avatars | 9999px (circle) | `rounded-full` |
| Modals/Drawers | 20px (visible corners) | `rounded-2xl` |
| Dropdown menus | 16px | `rounded-2xl` |
| Kanban columns | 20px | `rounded-2xl` |
| Small cards (task card, bill card) | 16px | `rounded-2xl` |

No element in the app should use a border radius smaller than 8px (`rounded-lg`). If an element looks angular, increase its radius.

#### Glass-Morphism (Refined)

The frosted-glass surface treatment is the primary surface style. It creates depth without heavy shadows and reinforces the futuristic feel. However, it must never compromise readability.

```css
/* Primary glass surface — GlassCard, drawers, modals */
.glass-card {
  background: rgba(var(--color-surface-rgb), 0.65);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(var(--color-border-rgb), 0.15);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
}

/* Elevated glass — dropdowns, popovers, tooltips */
.glass-card-elevated {
  background: rgba(var(--color-surface-rgb), 0.80);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(var(--color-border-rgb), 0.20);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}

/* Subtle glass — input fields, secondary surfaces */
.glass-card-subtle {
  background: rgba(var(--color-surface-rgb), 0.40);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(var(--color-border-rgb), 0.10);
}
```

**Performance rule:** On mobile devices where `backdrop-filter` causes jank, degrade gracefully to solid `background: var(--color-surface)` with higher opacity. Test on real devices and disable conditionally.

**Readability rule:** Text on glass surfaces must maintain a minimum contrast ratio of 4.5:1 (WCAG AA). If a theme's glass effect reduces contrast below this, increase the surface opacity for that theme. Test every theme.

#### Ambient Glow Effects

Interactive elements emit a soft glow on hover and focus. This replaces traditional box-shadows and reinforces the "living technology" feeling.

```css
/* Button hover glow */
.orbyt-button-accent:hover {
  box-shadow: 0 0 20px rgba(var(--color-accent-rgb), 0.35);
  transition: box-shadow 0.3s ease;
}

/* Focus ring — accessible and on-brand */
.orbyt-button-accent:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(var(--color-accent-rgb), 0.45);
}

/* Card hover glow */
.glass-card:hover {
  box-shadow: 0 8px 32px rgba(var(--color-accent-rgb), 0.10);
  border-color: rgba(var(--color-accent-rgb), 0.25);
  transition: all 0.3s ease;
}

/* Active/selected card */
.glass-card-active {
  border-color: rgba(var(--color-accent-rgb), 0.40);
  box-shadow: 0 0 16px rgba(var(--color-accent-rgb), 0.15);
}
```

**Restraint rule:** Glow effects appear ONLY on hover, focus, and active/selected states. Nothing glows at rest. The resting state of the UI is calm and still.

### 8.3 Typography

**Primary Font: Urbanist**

Urbanist is a low-contrast, geometric sans-serif with slightly rounded terminals, giving it a warm, approachable quality that aligns with the retro-futuristic aesthetic. Designed by Corey Hu, inspired by Modernist typography. It reads as modern and clean but not cold.

```tsx
// apps/web/app/layout.tsx
import { Urbanist } from 'next/font/google';

const urbanist = Urbanist({
  subsets: ['latin'],
  variable: '--font-urbanist',
  display: 'swap',
});

// Apply to <html>:
<html className={urbanist.variable}>
```

```css
font-family: var(--font-urbanist), system-ui, -apple-system, sans-serif;
```

Fallback consideration: If Urbanist feels too stylized after implementation, the safe fallback is Plus Jakarta Sans (similar warmth, slightly more neutral) or Inter (maximally readable but less personality). Try Urbanist first.

No secondary font. One font family, multiple weights. This keeps the app unified.

#### Type Scale

| Role | Size | Weight | Tailwind | Usage |
|---|---|---|---|---|
| Page title | 28px | 700 (Bold) | `text-[28px] font-bold` | Top of each feature page |
| Section heading | 20px | 600 (Semi) | `text-xl font-semibold` | Widget titles, drawer titles |
| Card title | 16px | 500 (Medium) | `text-base font-medium` | Task name, bill name, contact name |
| Body | 14px | 400 (Regular) | `text-sm` | Descriptions, notes, form labels |
| Caption/metadata | 12px | 400 (Regular) | `text-xs text-text-secondary` | Timestamps, due dates, counts |
| Button text | 14px | 600 (Semi) | `text-sm font-semibold` | All button labels |
| Badge/chip text | 11px | 600 (Semi) | `text-[11px] font-semibold` | Status badges, priority dots |
| Stat number | 32px | 700 (Bold) | `text-[32px] font-bold` | Dashboard stat card values |

**Type Rules:** Line height for body text: 1.5 (`leading-relaxed`). Line height for headings: 1.2 (`leading-tight`). Maximum line length: 65 characters (`max-w-prose`). Letter spacing on headings: `-0.01em`. No ALL CAPS except badges/chips. No underlines except actual links.

### 8.4 Color System & Theme Architecture

#### Structural Colors (Constant Across All Themes)

| Token | Value | Usage |
|---|---|---|
| `--color-success` | `#22C55E` (green-500) | Completed tasks, paid bills, online |
| `--color-warning` | `#F59E0B` (amber-500) | Due soon, medium priority |
| `--color-danger` | `#EF4444` (red-500) | Overdue, high priority, destructive, errors |
| `--color-info` | `#3B82F6` (blue-500) | Informational, low priority, links |

#### Priority Colors (Tasks & Bills)

| Priority | Color | Dot Class | Background Class |
|---|---|---|---|
| High | `#EF4444` | `bg-red-500` | `bg-red-500/10` |
| Medium | `#F59E0B` | `bg-amber-500` | `bg-amber-500/10` |
| Low | `#3B82F6` | `bg-blue-500` | `bg-blue-500/10` |
| None | `#6B7280` | `bg-gray-500` | `bg-gray-500/10` |

#### Calendar Event Category Colors

| Category | Color | CSS |
|---|---|---|
| Family | `#8B5CF6` (violet) | `bg-violet-500/20 text-violet-400` |
| Work | `#3B82F6` (blue) | `bg-blue-500/20 text-blue-400` |
| Health | `#22C55E` (green) | `bg-green-500/20 text-green-400` |
| Social | `#EC4899` (pink) | `bg-pink-500/20 text-pink-400` |
| School | `#F59E0B` (amber) | `bg-amber-500/20 text-amber-400` |
| Errands | `#06B6D4` (cyan) | `bg-cyan-500/20 text-cyan-400` |
| Other | `#6B7280` (gray) | `bg-gray-500/20 text-gray-400` |

#### Bill Category Values `[v3 NEW]`

The `bills.category` column is `varchar(50)`. The following are the standard category values used throughout the app. The front-end should use these as a select dropdown, not a freetext field:

`housing`, `utilities`, `insurance`, `subscriptions`, `food`, `transport`, `internet`, `water`, `phone`, `other`

#### Shopping Item Category Values `[v3 NEW]`

The `shopping_items.category` column is `varchar(100)` and is freetext (user can type any category). Common suggested categories for autocomplete: `Produce`, `Dairy`, `Meat`, `Bakery`, `Frozen`, `Beverages`, `Snacks`, `Household`, `Personal Care`, `Other`.

#### Contact Relationship Types `[v3 NEW]`

The `contacts.relationship_type` column is `varchar(50)`. Standard values for the dropdown: `parent`, `sibling`, `grandparent`, `aunt-uncle`, `cousin`, `friend`, `neighbor`, `doctor`, `dentist`, `teacher`, `coach`, `babysitter`, `pet-vet`, `emergency`, `other`.

#### Theme Definitions (9 Retro-Futuristic Themes)

| Theme Name | Mood | Primary Accent | Surface Tone | Best For |
|---|---|---|---|---|
| Orbit (default) | Balanced, trustworthy | Electric teal `#06B6D4` | Dark slate | Neutral default |
| Stardust | Warm, creative | Soft violet `#A78BFA` | Dark purple-gray | Warm/creative vibe |
| Nova | Energetic, bold | Hot coral `#F97316` | Dark warm gray | High-energy vibe |
| Skyline | Calm, focused | Sky blue `#38BDF8` | Dark navy | Cool/calm vibe |
| Aurora | Magical, vibrant | Emerald green `#34D399` | Dark forest | Nature-inspired |
| Neon | Electric, modern | Hot pink `#F472B6` | Near-black | Bold/expressive |
| Solaris | Bright, optimistic | Golden amber `#FBBF24` | Dark bronze | Warm/sunny |
| Lunar | Minimal, serene | Cool gray `#94A3B8` | Near-black | Minimal/monochrome |
| Rosie | Warm, nurturing | Dusty rose `#FDA4AF` | Dark mauve | Rosie persona fans |

#### CSS Variable Template (each theme defines all of these)

```css
[data-theme="orbit"] {
  --color-bg: #0F172A;
  --color-bg-rgb: 15, 23, 42;
  --color-surface: #1E293B;
  --color-surface-rgb: 30, 41, 59;
  --color-accent: #06B6D4;
  --color-accent-rgb: 6, 182, 212;
  --color-accent-hover: #22D3EE;
  --color-text: #F1F5F9;
  --color-text-secondary: #94A3B8;
  --color-border: #334155;
  --color-border-rgb: 51, 65, 85;
  --color-sidebar: #0B1120;
  --color-header: rgba(15, 23, 42, 0.80);
}
```

Full CSS for all 9 themes must be defined in `apps/web/app/globals.css`. Every theme must be tested for WCAG AA contrast (4.5:1 for body text, 3:1 for large text).

All 9 themes are dark-mode. Dark mode aligns with the space/retro-futuristic aesthetic and glass-morphism effects. Light-mode variants are a Phase 2 consideration.

`[v3 NOTE]` The `profiles.theme` column defaults to `"cosmic"` in the schema, but the bible's default theme is "Orbit." Ensure the registration form sets the theme to `"orbit"` (or whichever the user selects) and that `"cosmic"` is treated as a legacy default that maps to `"orbit"` in the front-end.

### 8.5 "Choose Your Vibe" — Onboarding Personalization

During the registration wizard, the flow is structured as:

**Step 1 — Create Account:** Email, password, display name.

**Step 2 — Create Household:** Household name.

**Step 3A — Choose Your AI Companion:** Two illustrated character cards side by side. Rosie (left) and Eddie (right). Each shows the character illustration, name, and a one-line personality descriptor. Rosie: "Warm, organized, and always one step ahead." Eddie: "Upbeat, energetic, and ready to tackle anything." This is a personality choice, not a gender assignment — any user can pick either.

**Step 3B — Choose Your Vibe:** A horizontal row (or 2×3 grid on mobile) of theme preview cards. Each card is a small rectangle filled with the theme's accent color gradient, with the theme name below. Five curated options are highlighted (Orbit, Stardust, Nova, Skyline, Aurora). The remaining four are in a "More vibes" expandable section. Tapping a card immediately previews the theme on the registration page. Selection is saved to the user's profile.

No gender question is asked during registration. The user's vibe choice is their personalization.

### 8.6 Rosie & Eddie — Character Design Brief

> **📎 PLACEHOLDER STRATEGY `[v3 NEW]`:** The design team is currently producing final character illustrations. Until those assets are delivered, all agents should use placeholder SVGs: a simple geometric robot silhouette (rounded rectangle body, circle head, two dot eyes) rendered in the theme's accent color, at the correct dimensions specified below. Placeholder files should be named following the final naming convention so they can be swapped without code changes.

#### Rosie

Inspiration: Rosie from The Jetsons, reimagined as a modern product character. Retains the recognizable elements — a rounded body shape suggesting an apron or domestic form factor, a circular head, and a small antenna or sensor on top. Proportions are modernized: sleeker, less boxy, like a friendly consumer robot (think Pixar's EVE crossed with the original Rosie). The "face" is a rounded screen or visor displaying simple, expressive emoji-like eyes conveying emotion: happy (default), winking (success), thinking (loading), concerned (error), celebrating (achievement). Color palette: warm dusty tones — soft whites, warm grays, dusty rose. Accent: warm teal. Clean vector illustration with subtle gradients, not flat, not 3D. Shape-based, no outlines.

#### Eddie

A counterpart to Rosie with his own distinct silhouette. More angular and upright — slim, tall-ish robot with a slightly sporty build. Where Rosie is round and nurturing, Eddie is streamlined and energetic. Visor instead of round face-screen, or treads instead of wheels. Same expression variants. Color palette: cool tones — slate blues, soft silvers, electric blue accent. Same illustration style as Rosie — they must look like they belong in the same universe.

#### Sizes Needed (per character)

Full body (onboarding, empty states): 400×600px SVG. Bust/portrait (chat interface, persona selection): 200×200px SVG. Avatar icon (header, comments): 40×40px SVG. Expression variants: happy, winking, thinking, concerned, celebrating — for each size.

#### File Organization

```
public/characters/
├── rosie/
│   ├── full-body-happy.svg
│   ├── full-body-winking.svg
│   ├── full-body-thinking.svg
│   ├── full-body-concerned.svg
│   ├── full-body-celebrating.svg
│   ├── portrait-happy.svg
│   ├── portrait-[expression].svg
│   ├── avatar-happy.svg
│   └── avatar-[expression].svg
├── eddie/
│   └── (same structure)
└── avatars/
    ├── illustrated/
    │   ├── avatar-01.svg through avatar-30.svg
    └── default-avatar.svg
```

### 8.7 User Avatar System

#### Phase 1 — Two Avatar Modes

**Mode 1 (Illustrated Avatar, Default):** On registration, user gets a default illustrated Jetsons-style avatar. In Settings → Profile, they browse a grid of 20-30 pre-made illustrated avatars with diverse skin tones, hair styles, and accessories, all in the same retro-futuristic style as Rosie and Eddie.

**Mode 2 (Photo Upload):** In Settings → Profile, user uploads their own photo, cropped to circle, stored in Supabase Storage.

`[v3 CHANGE]` The `profiles` schema has an `avatarType` column (`varchar(20)`, default `"photo"`) that distinguishes between the two modes. The front-end should set this to `"illustrated"` when the user selects from the avatar grid, and `"photo"` when they upload a photo.

#### MemberAvatar Component Props

```tsx
interface MemberAvatarProps {
  name: string;
  imageUrl?: string | null;
  illustratedAvatar?: string | null;
  avatarType?: "photo" | "illustrated";
  size: "sm" | "md" | "lg" | "xl";
  color?: string;
}
```

Size mapping: sm = 32px, md = 40px, lg = 56px, xl = 96px. Fallback chain: photo URL → illustrated avatar → initials on colored circle.

Phase 2+ — AI-Generated Custom Avatars: Users upload a photo and generate a Jetsons-style illustrated version. Out of scope for Phase 1.

### 8.8 Animation Specifications

**Motion Principles:** All motion serves one of two purposes — providing feedback (confirming an action) or guiding attention (drawing the eye). Motion that serves neither is removed. Animations feel smooth and effortless — things float and glide, never bounce or snap.

#### Page content entrance

```tsx
<motion.div
  initial={{ opacity: 0, y: 12 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.35, ease: "easeOut" }}
>
```

#### Drawer slide-in

```tsx
<motion.div
  initial={{ x: "100%" }}
  animate={{ x: 0 }}
  exit={{ x: "100%" }}
  transition={{ type: "spring", damping: 30, stiffness: 300 }}
>
```

#### Modal/dialog appearance

```tsx
<motion.div
  initial={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
  exit={{ opacity: 0, scale: 0.95 }}
  transition={{ duration: 0.2 }}
>
```

#### List item stagger

```tsx
// Parent
<motion.div variants={{ show: { transition: { staggerChildren: 0.04 } } }}>
// Each child
<motion.div variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}>
```

#### Checkbox completion

When checked, text gets strikethrough animating left to right over 200ms, row fades to 50% opacity over 300ms.

```css
.item-checked {
  text-decoration: line-through;
  text-decoration-color: var(--color-accent);
  opacity: 0.5;
  transition: opacity 0.3s ease;
}
```

#### Success celebration (lightweight)

When all tasks for today are done or a bill is marked paid, 3-5 small dots float up and fade out. Duration 600ms total. Subtle — a small dopamine hit, not fireworks.

```tsx
{showCelebration && (
  <AnimatePresence>
    {[...Array(5)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-1.5 h-1.5 rounded-full bg-accent"
        initial={{ opacity: 1, y: 0, x: 0 }}
        animate={{
          opacity: 0,
          y: -(30 + Math.random() * 20),
          x: (Math.random() - 0.5) * 40,
        }}
        transition={{ duration: 0.6, ease: "easeOut", delay: i * 0.05 }}
      />
    ))}
  </AnimatePresence>
)}
```

**Animations to Avoid:** No bounce easing. No spinning loaders except OrbitalLoader on initial page load. No parallax scrolling. No auto-playing background animations on work surfaces. No animation longer than 500ms for standard transitions (drawers/pages can go to 600ms max).

**Reduced Motion:** Respect `prefers-reduced-motion`. Replace all animations with 150ms opacity fades. No movement, no scale.

### 8.9 Empty State Design

Empty states are where Rosie and Eddie earn their keep. Every feature page has an empty state for new users. These should feel encouraging, not sterile.

**Structure:** Character illustration (persona-appropriate expression) + headline (warm, conversational) + subtext + CTA button.

| Page | Expression | Headline | Subtext | CTA |
|---|---|---|---|---|
| Dashboard (new) | Happy | "Welcome to your family HQ!" | "Let's get set up. Start with a few tasks or bills." | "Add Your First Task" |
| Tasks | Happy | "All clear! Nothing on the to-do list." | "When you add tasks, I'll help keep everyone on track." | "Create a Task" |
| Shopping | Happy | "No shopping lists yet." | "Create a list and I'll make sure nothing gets forgotten." | "Create a List" |
| Finances | Thinking | "No bills being tracked." | "Add your household bills and I'll keep an eye on what's due." | "Add a Bill" |
| Calendar | Happy | "Your calendar is wide open." | "Add events and I'll make sure the family stays in sync." | "Create an Event" |
| Contacts | Happy | "No family contacts yet." | "Keep track of the important people in your family's life." | "Add a Contact" |
| Shopping (no items) | Winking | "This list is empty — for now." | "Start adding items below." | (inline input) |

**Layout:** Vertically centered. Character illustration 200px tall above text. Headline `text-xl font-semibold`. Subtext `text-sm text-text-secondary`, max-width 360px, centered. CTA is SpaceButton accent variant, 16px below subtext.

> **📎 PLACEHOLDER NOTE:** Until final Rosie/Eddie illustrations are delivered, empty states should render the placeholder robot SVG at the correct size. The component should accept an `expression` prop even with placeholders so no code changes are needed when real assets arrive.

### 8.10 Iconography

**Primary Set:** Lucide React. Rounded stroke style (2px stroke, rounded caps/joins) aligns with the retro-futuristic shape language. Import individual icons only.

| Context | Size | Tailwind |
|---|---|---|
| Navigation (sidebar) | 20px | `w-5 h-5` |
| Card actions | 16px | `w-4 h-4` |
| Stat card icon | 24px | `w-6 h-6` |
| Empty state | 48px | `w-12 h-12` |
| Feature page header | 24px | `w-6 h-6` |

Always use default Lucide stroke style. Never mix outlined and filled icons. Use color change for state, not fill change.

### 8.11 Layout & Spacing

#### Spacing Scale

| Token | Value | Usage |
|---|---|---|
| `p-6` / `gap-6` | 24px | Card padding, grid gaps |
| `p-4` / `gap-4` | 16px | Inner sections, form fields |
| `p-3` / `gap-3` | 12px | Compact cards (task, shopping items) |
| `p-2` / `gap-2` | 8px | Inline spacing (icon + text) |
| `space-y-6` | 24px | Between major sections |
| `space-y-4` | 16px | Between form fields |
| `space-y-2` | 8px | Between compact list items |

#### Page Layout

```
┌──────────────────────────────────────────────────────────┐
│ Header (h-16, glass, fixed top)                          │
├────────┬─────────────────────────────────────────────────┤
│Sidebar │  Content Area                                   │
│ w-64   │  ┌─────────────────────────────────────────┐   │
│(desktop)│  │ Page Title               [Action Button]│   │
│ w-16   │  ├─────────────────────────────────────────┤   │
│(tablet)│  │  Page-specific content                  │   │
│ hidden │  │  Padding: p-6 on all sides              │   │
│(mobile)│  │  Max content width: none (fills space)  │   │
│        │  └─────────────────────────────────────────┘   │
└────────┴─────────────────────────────────────────────────┘
```

Header height: 64px. Sidebar width: 256px expanded, 64px collapsed. Content padding: 24px. Page title row: flex between title (left) and action button (right), with `mb-6`.

#### Responsive Rules

Below `lg` (1024px): sidebar collapses to 64px icon-only. Below `md` (768px): sidebar hidden, replaced by fixed bottom navigation bar (64px tall). Content full-width with `p-4` padding. Drawers become full-screen sheets from bottom. Below `sm` (640px): card grids become single column.

#### Mobile Bottom Navigation

```tsx
<nav className="fixed bottom-0 left-0 right-0 h-16 glass-card-elevated flex items-center justify-around md:hidden z-50">
  <NavTab icon={Home} label="Home" href="/dashboard" />
  <NavTab icon={CheckSquare} label="Tasks" href="/tasks" />
  <NavTab icon={ShoppingCart} label="Shop" href="/shopping" />
  <NavTab icon={Calendar} label="Calendar" href="/calendar" />
  <NavTab icon={Menu} label="More" onClick={openMoreSheet} />
</nav>
```

"More" opens a bottom sheet with Finances, Contacts, Settings.

#### Mobile Touch Interaction Specifications `[v3 NEW]`

**Tasks Kanban (touch):** `@dnd-kit` requires explicit touch configuration. Use `TouchSensor` with `activationConstraint: { delay: 150, tolerance: 5 }` to prevent accidental drags while scrolling. The delay gives the user time to distinguish between a scroll gesture and a drag intent. On screens below `md` (768px), consider defaulting to list view instead of Kanban, since dragging between three columns on a 375px screen is awkward.

**Shopping dual-panel (mobile):** On screens below `md`, the two-panel layout becomes a single-panel toggle. The list panel is the default view. Tapping a list name transitions to the items panel with a back arrow. This is a client-side state toggle (`selectedListId` is set/cleared), not a route change. The transition uses the standard page entrance animation.

**Drawers on mobile:** All drawers become full-screen bottom sheets with a drag handle (40px × 4px rounded bar, centered, `bg-border` color, 8px from top). The user can swipe down to dismiss. Use Framer Motion's `drag="y"` with `dragConstraints` and an `onDragEnd` handler that closes if dragged past 30% of screen height.

#### Drawer Dimensions

Desktop: 480px wide, from right, `rounded-l-2xl`. Mobile: full-screen, from bottom, `rounded-t-2xl`, with drag handle.

#### Mobile Testing Viewport Matrix `[v3 NEW]`

| Device | Viewport | Priority | Notes |
|---|---|---|---|
| iPhone SE | 375×667 | Critical | Smallest supported viewport |
| iPhone 15 | 390×844 | Critical | Standard iOS |
| Galaxy A14 | 360×800 | Critical | Mid-range Android |
| iPad Mini | 768×1024 | Medium | Tablet breakpoint boundary |
| Desktop | 1280×800 | Critical | Primary development viewport |
| Desktop (wide) | 1920×1080 | Medium | Large monitor |

All Playwright E2E tests run at 1280×800 (desktop) and 375×667 (mobile).

### 8.12 Micro-Copy & Tone of Voice

**Do:** "Bill marked as paid." "3 tasks due today." "You're all caught up!" "Invite sent — they'll get an email shortly." `[v3 CHANGE]` For Phase 1 (before Resend): "Invite link copied! Share it with your family member."

**Don't:** "Transaction successfully recorded in the financial tracking subsystem." "Great job completing your tasks, superstar!" "Oopsie! Something went wrong!"

**Button Labels:** Action verbs. "Add Task" not "New Task." "Save Changes" not "Submit." "Mark Paid" not "Payment." "Delete" for permanent, "Remove" for detaching. `[v3 CHANGE]` Note: `finances.deleteBill` is actually a soft delete (`isActive: false`). The button label should be "Archive" not "Delete." Use "Delete" only for hard deletes.

**Error Messages:** Always tell the user what happened and what to do. "Couldn't save — check your connection and try again." Never raw error codes. Never blame the user.

**Timestamps:** Relative for recent ("2 minutes ago", "Yesterday at 3:00 PM"), absolute for older ("Jan 15, 2026").

### 8.13 Accessibility Standards

**Target:** WCAG 2.1 AA

| Requirement | Implementation |
|---|---|
| Color contrast | 4.5:1 body text, 3:1 large text. Test every theme. |
| Keyboard nav | All elements reachable via Tab. Enter/Space to activate. Escape to close. |
| Focus indicators | Visible glow ring on all interactive elements. Never `outline: none` without replacement. |
| Screen readers | All images have `alt`. Icon-only buttons have `aria-label`. Inputs have `<label>`. |
| Touch targets | Minimum 44×44px on mobile. |
| Focus trapping | Drawers/modals trap focus. Focus returns on close. Radix handles this. |
| Reduced motion | Respect `prefers-reduced-motion`. See Section 8.8. |
| Semantic HTML | Use `<nav>`, `<main>`, `<section>`, `<header>`. Proper heading hierarchy. |

#### Accessibility Testing Protocol `[v3 NEW]`

**Theme Contrast Verification:** Each of the 9 themes must be checked for WCAG AA compliance across 4 text/surface combinations: primary text on bg, primary text on surface, secondary text on bg, secondary text on surface. This is 36 checks total. Use the axe-core browser extension or a script that reads CSS variable values and computes contrast ratios. Failures must be fixed by increasing surface opacity for the failing theme. This verification is a Sprint 5 acceptance criterion.

**Keyboard Navigation Smoke Test:** Before launch, every page must be navigated fully using only Tab, Shift+Tab, Enter, Space, Escape, and Arrow keys. All drawers must trap focus. All modals must return focus to the trigger element on close. Radix primitives handle most of this, but custom components (Kanban cards, shopping item rows) need explicit `tabIndex` and keyboard event handlers.

---
```

---


---

## 9. FRONT-END DEVELOPMENT GUIDELINES

### 9.1 Page File Pattern (MUST follow for every new page)

```tsx
// app/(dashboard)/[feature]/page.tsx — Server Component
import { Metadata } from "next";
import { FeatureContent } from "@/components/[feature]/[feature]-content";

export const metadata: Metadata = {
  title: "Feature Name — Orbyt",
};

export default function FeaturePage() {
  return <FeatureContent />;
}
```

```tsx
// components/[feature]/[feature]-content.tsx — Client Component
"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { motion } from "framer-motion";

export function FeatureContent() {
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.someRouter.someQuery.useQuery({ ... });

  if (isLoading) return <FeatureSkeleton />;
  if (error) return <FeatureError error={error} />;
  if (!data || data.length === 0) return <FeatureEmptyState />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {/* Page content */}
    </motion.div>
  );
}
```

### 9.2 Required States for Every Feature Page

**Loading:** Skeleton UI matching the loaded page layout. Pulsing gray rectangles (`animate-pulse bg-surface rounded-2xl`). NOT OrbitalLoader — that's for full-page transitions only.

**Empty:** Character illustration (Rosie or Eddie per user persona) + headline + subtext + CTA. Copy from Section 8.9.

**Error:** Friendly message + "Try Again" button. Log to console (Sentry when integrated). Never raw error messages.

**Loaded:** The actual feature UI with real data.

### 9.3 Mutation Pattern

```tsx
const utils = trpc.useUtils();

const createMutation = trpc.someRouter.create.useMutation({
  onSuccess: () => {
    utils.someRouter.list.invalidate();
    toast.success("Item created successfully");
    setDrawerOpen(false);
  },
  onError: (error) => {
    toast.error(error.message || "Something went wrong. Please try again.");
  },
});

// Disable submit while loading:
<SpaceButton disabled={createMutation.isPending}>
  {createMutation.isPending ? "Saving..." : "Save"}
</SpaceButton>
```

### 9.4 Real-Time Subscription Pattern

```tsx
// hooks/use-realtime.ts
"use client";
import { useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

export function useRealtimeInvalidation(
  table: "shopping_items" | "tasks" | "events" | "notifications",
  filter: { column: string; value: string } | undefined,
  queryToInvalidate: () => void
) {
  useEffect(() => {
    const supabase = createBrowserClient();
    const channelConfig: any = { event: "*", schema: "public", table };
    if (filter) channelConfig.filter = `${filter.column}=eq.${filter.value}`;

    const channel = supabase
      .channel(`${table}-${filter?.value ?? "all"}`)
      .on("postgres_changes", channelConfig, () => queryToInvalidate())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [table, filter?.value]);
}
```

### 9.5 Type Safety Pattern

```tsx
import type { AppRouter } from "@orbyt/api";
import type { inferRouterOutputs } from "@trpc/server";

type RouterOutput = inferRouterOutputs<AppRouter>;
type Task = RouterOutput["tasks"]["list"][number];
type Contact = RouterOutput["contacts"]["getById"];

// NEVER use: NonNullable<ReturnType<typeof trpc.xxx.useQuery>["data"]>
```

### 9.6 Form Handling

Controlled React state. Validate with Zod schemas from `@orbyt/shared/validators`. Inline validation errors below fields. `.orbyt-input` class on inputs, `.orbyt-label` on labels.

```tsx
import { createTaskSchema } from "@orbyt/shared/validators";

const result = createTaskSchema.safeParse(formData);
if (!result.success) {
  setErrors(result.error.flatten().fieldErrors);
  return;
}
createMutation.mutate(result.data);
```

### 9.7 Accessibility Requirements

All interactive elements keyboard-accessible. Drawers trap focus and return it on close. Use Radix UI primitives for dialogs, dropdowns, selects. All images have alt text. Inputs have labels. Color never sole indicator. Touch targets 44×44px minimum on mobile.

---

## 10. STATE MANAGEMENT PATTERNS

**Server State (primary):** TanStack Query via tRPC hooks. Cache is source of truth. Invalidate on mutation success.

**Household ID:** `localStorage.getItem('orbyt-household-id')`. Set on login/register. Read by `providers.tsx`, sent as `x-household-id` header.

**Theme:** `data-theme` attribute on `<html>`. Read from profile on load, persisted via `trpc.household.updateProfile`. Apply immediately with `document.documentElement.setAttribute('data-theme', name)`.

**UI State (local):** `useState` for component-local state: drawer open/close, active tab, selected list, form inputs, view mode. Don't lift unless two distant components share it.

**Drag State:** Managed by `@dnd-kit/core` internally in Tasks page.

### Cross-Cutting State Reference `[v3 NEW]`

The following state values are accessed by multiple components across the app. This table defines where each lives and how to access it, to prevent ad-hoc solutions from diverging.

| State | Storage | Written By | Read By | Access Pattern |
|---|---|---|---|---|
| Household ID | `localStorage` key `orbyt-household-id` | `login-form.tsx`, `register-form.tsx`, invite accept | `providers.tsx` → `x-household-id` header on every tRPC call | Direct `localStorage` read |
| Current User Profile | TanStack Query cache via `household.getCurrent` | `household.updateProfile` mutation → invalidates cache | Dashboard header (avatar, name), Settings profile tab, any component needing user info | `trpc.household.getCurrent.useQuery()` — the `members` array includes the current user. Filter by matching `userId` to Supabase auth user ID. |
| Active Theme | `data-theme` attribute on `<html>` | Settings appearance tab → `updateProfile({ theme })` + `setAttribute` | All CSS via theme variables (automatic) | CSS variables resolve automatically. To read the current theme name in JS: `document.documentElement.getAttribute('data-theme')` |
| Sidebar Collapsed | Component-local `useState` in `sidebar.tsx` | Sidebar toggle button | Sidebar component only | Not shared. If future features need it, lift to a context provider in dashboard layout. |
| Notification Unread Count | TanStack Query cache via `notifications.getUnread` (or computed from `notifications.list`) | Notification mutations (mark read) → invalidate | Dashboard header bell icon badge | `trpc.notifications.list.useQuery()` → filter `readAt === null` → `.length` |
| AI Persona | Profile field `aiPersona` from `household.getCurrent` | Registration wizard, Settings profile tab | Empty state components (choose Rosie vs Eddie illustration) | Read from the current user's profile in the `getCurrent` response |

**No global store (intentional).** TanStack Query + React state + localStorage is sufficient for this app's complexity. Do not add Redux, Zustand, or Jotai.

---

## 11. ERROR HANDLING STRATEGY

### 11.1 Global Error Boundary

Create `components/ui/error-boundary.tsx`. Catches rendering errors in dashboard area. Friendly "Something went wrong" + "Reload" button. Wrap dashboard layout's `{children}`.

### 11.2 tRPC Error Handling

**Mutations:** `onError` callback shows `toast.error()`. **Queries:** inline error state with "Retry" button (not toast).

#### tRPC Error Codes Reference `[v3 NEW]`

The following error codes are thrown by the backend. Front-end error handling should map these to user-friendly messages:

| tRPC Code | HTTP Status | When Thrown | User-Facing Message |
|---|---|---|---|
| `UNAUTHORIZED` | 401 | No valid session | "Your session has expired. Please log in again." |
| `FORBIDDEN` | 403 | Not a household member, or not admin | "You don't have permission to do that." |
| `BAD_REQUEST` | 400 | No household selected, or invalid input | "Something went wrong. Please try again." |
| `NOT_FOUND` | 404 | Entity doesn't exist or wrong household | "We couldn't find what you're looking for." |
| `CONFLICT` | 409 | Duplicate (e.g., inviting existing member) | Show the `error.message` directly — it's already user-friendly. |
| `PRECONDITION_FAILED` | 412 | Expired invitation | Show the `error.message` directly. |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected server error | "Something went wrong on our end. Please try again." |

The backend error formatter includes flattened Zod errors in `error.data.zodError` when input validation fails. Use this to display field-level errors in forms.

### 11.3 Auth Error Handling

Expired session → middleware redirects to `/login`. tRPC 401 → clear `localStorage`, redirect to `/login`. Handle in tRPC client error link.

### 11.4 Real-Time Connection Loss

Listen for connection state changes. Show subtle "Reconnecting..." in header when disconnected. TanStack Query's `refetchOnWindowFocus` provides fallback sync.

### 11.5 Toast Standards

Sonner. Bottom-right. Success auto-dismiss 3s. Error persists until dismissed. Concise: "Task created" not "Task creation mutation completed successfully."

---

## 12. SPRINT PLAN (Remaining Work)

### Parallel Execution Strategy

```
Sprint 0 (Foundation)  →  Sprint 4B  ─┐
                          Sprint 4C  ─┤
                          Sprint 4D  ─┤  (parallel)
                          Sprint 4E  ─┤
                          Sprint 4F  ─┘
                              ↓
                      Sprint 5 (Polish + Deploy)
```

### Sprint 0 — Foundation (MUST complete first)

**Estimated effort:** 2-3 days `[v3 CHANGE: was 1 day]`
**Branch:** `sprint-0/foundation`

**0A — Create shared UI components.** `components/ui/drawer.tsx` (animated slide-out, Framer Motion + Radix Dialog, props: `open`, `onClose`, `title`, `children`, `width`). `components/ui/confirm-dialog.tsx` (Radix AlertDialog, props: `open`, `onConfirm`, `onCancel`, `title`, `description`, `confirmLabel`, `variant`). `components/ui/empty-state.tsx` (props: `character`, `expression`, `title`, `description`, `actionLabel`, `onAction`). `components/ui/skeleton.tsx` (primitives with pulse). `components/ui/error-boundary.tsx` (React Error Boundary).

**0B — Create reusable real-time hook.** `hooks/use-realtime.ts` per Section 9.4.

**0C — Create `loading.tsx` for all routes.** Streaming skeletons for all 7 dashboard routes.

**0D — Create database seed script.** `packages/db/src/seed.ts` and `supabase/seed.sql` per Section 16.

**0E — Create `.env.local.example`.** Template from Section 3.

**0F — Set up CI pipeline.** `.github/workflows/ci.yml` per Section 14.

**0G — Capture screenshots of completed pages.** Desktop (1280px) and mobile (375px) of all completed pages. Save to `/docs/screenshots/`.

**0H — Mobile bottom navigation.** `components/mobile-nav.tsx` per Section 8.11. Update dashboard layout for conditional rendering.

**0I — Placeholder character SVGs. `[v3 NEW]`** Create simple geometric robot placeholder SVGs for Rosie and Eddie at all three sizes (full-body, portrait, avatar) with the "happy" expression. Follow the naming convention from Section 8.6 so real assets are a file swap.

**0J — Clipboard invite link utility. `[v3 NEW]`** Create a utility function that generates an invite link from an invitation token: `${NEXT_PUBLIC_APP_URL}/invite/${token}`. Create a "Copy Invite Link" button component that copies this URL to the clipboard and shows a toast: "Invite link copied! Share it with your family member." This is the Phase 1 workaround for email invitations.

**0K — Minimum viable E2E test setup. `[v3 NEW]`** Install Playwright. Configure for two viewports (1280×800 desktop, 375×667 mobile). Write the auth flow test (register → land on dashboard → logout → login → land on dashboard). See Section 13 for full test specifications.

**0L — CLAUDE.md and agent configuration. `[v3 NEW]`** Create the root `CLAUDE.md` file, `.claude/agents/` definitions, and `.claude/skills/` files per Section 26. This must be committed before feature agents begin work.

#### Acceptance Criteria

- [ ] `pnpm turbo typecheck` passes
- [ ] All shared components export correctly
- [ ] `loading.tsx` files render for all routes
- [ ] Seed script populates all tables with deterministic data
- [ ] CI runs typecheck on push
- [ ] `/docs/screenshots/` has reference images
- [ ] Mobile nav renders below `md` breakpoint
- [ ] Placeholder Rosie/Eddie SVGs exist at all sizes
- [ ] Copy-invite-link utility works (generates URL, copies to clipboard)
- [ ] Playwright auth flow test passes at both viewports
- [ ] `CLAUDE.md` and `.claude/` directory committed

---

### Sprint 4B — Shopping (/shopping)

**Estimated effort:** 2 days
**Branch:** `sprint-4b/shopping`

**Files:** Replace `shopping/page.tsx`. Create `components/shopping/shopping-content.tsx`, `list-panel.tsx`, `items-panel.tsx`.

**Layout:** Two-panel. Left (280px): shopping lists. Right (remaining): items for selected list.

**Left Panel:** "Shopping Lists" title + "New List" button. List cards with name, emoji `[v3 NEW]`, item count, unchecked count. Selected has `glass-card-active` border. Inline text input for new list. tRPC: `shopping.listLists`.

`[v3 CHANGE]` The `shoppingLists` schema includes `emoji` (default `"🛒"`) and `isDefault` fields. Display the emoji before the list name. Default lists sort first (the router already handles this via `orderBy: [desc(l.isDefault), asc(l.name)]`).

**Right Panel:** Selected list name + "Clear Checked" button. Items grouped by category (collapsible sections). Each row: checkbox, name, quantity badge, `notes` tooltip `[v3 NEW]`, added-by avatar, delete X. Check → `shopping.checkItem` with optimistic update. Checked items: strikethrough + reduced opacity, show `checkedBy` avatar `[v3 NEW]`. Clear checked → `shopping.clearChecked`. Add item: inline input at bottom with optional category autocomplete `[v3 NEW]`. tRPC: `shopping.listItems`, `shopping.addItem`, `shopping.checkItem`, `shopping.deleteItem`, `shopping.clearChecked`.

`[v3 CHANGE — CRITICAL]` The `shopping.checkItem` procedure expects `{ itemId, checked }`, NOT `{ id, checked }`. The `shopping.deleteItem` procedure expects `{ itemId }`, NOT `{ id }`. The original bible had incorrect field names. Use the corrected names.

**Real-Time:** `useRealtimeInvalidation("shopping_items", { column: "list_id", value: selectedListId }, ...)`.

**Mobile:** Single-panel. List panel default. Tap list → items panel with back button. State toggle, not routing.

#### Acceptance Criteria

- [ ] Create shopping list (with optional emoji)
- [ ] Select list, view items
- [ ] Add items with name, category (autocomplete suggestions), quantity
- [ ] Check/uncheck items (strikethrough, `checkedBy` avatar appears)
- [ ] Clear checked items
- [ ] Delete individual items
- [ ] Real-time: two tabs, check in one, see in other within 2s
- [ ] Loading skeleton, empty states (no lists, no items)
- [ ] Mobile 375px works (single-panel mode)
- [ ] `pnpm turbo typecheck` passes, no `any` types
- [ ] All mutations show toasts
- [ ] Empty states use placeholder character illustrations

---

### Sprint 4C — Finances (/finances)

**Estimated effort:** 2 days
**Branch:** `sprint-4c/finances`

**Files:** Replace `finances/page.tsx`. Create `components/finances/finances-content.tsx`, `bill-drawer.tsx`, `mark-paid-modal.tsx`.

**Layout:** Top: 3 summary StatCards. Below: bill grid.

**Summary Cards:** "Total Monthly" (sum all), "Paid This Month" (sum payments), "Outstanding" (difference, red if > 0). tRPC: `finances.getMonthlyOverview({ month: "YYYY-MM" })`.

`[v3 CHANGE — CRITICAL]` The `getMonthlyOverview` procedure takes `{ month: "YYYY-MM" }` as a single string field, NOT separate `{ month?, year? }` fields. Format the current month as `new Date().toISOString().slice(0, 7)` (e.g., `"2026-02"`) before passing. The response shape is `{ month, totalBilled, totalPaid, totalPending, billCount, paidCount }`.

**Bill Cards:** 3 columns lg+, 2 md, 1 sm. Each: category icon, name, amount (`formatCurrency`), due day, auto-pay badge, `currency` badge if not USD `[v3 NEW]`, status. Overdue: red border + "Overdue" badge. Click → bill drawer. tRPC: `finances.listBills`.

`[v3 CHANGE]` The `listBills` response includes `nextDueDate` (Date), `lastPayment` (object or null), and `currentStatus` (`"overdue" | "upcoming"`). Use `currentStatus` for badge rendering instead of computing overdue state client-side.

**Category Icons:**

```tsx
const CATEGORY_ICONS = {
  housing: Home, utilities: Zap, insurance: Shield, subscriptions: Tv,
  food: UtensilsCrossed, transport: Car, internet: Wifi,
  water: Droplets, phone: Phone, other: CreditCard,
};
```

**Bill Drawer:** Create: name, amount, due day (1-31), category (select from standard values), auto-pay toggle, notes, URL `[v3 NEW]`. View/edit: all fields + payment history via `finances.getBillById` `[v3 NEW]`. "Mark Paid" → modal. "Archive" (not "Delete") with confirmation `[v3 CHANGE]`.

`[v3 CHANGE]` The `bills` schema has `currency` (default `"USD"`), `rrule` (required field), `url`, and `isActive` fields. The create form should include currency selection and the `rrule` should default to `"FREQ=MONTHLY"`. The `deleteBill` procedure is a soft delete (sets `isActive: false`), so the button label should be "Archive" and the confirmation should say "Archive this bill? It will be removed from your active bills."

**Mark Paid Modal:** Radix AlertDialog. Bill name, amount (pre-filled from bill, editable), date (default today), optional notes `[v3 NEW]`. Confirm → `finances.markPaid({ billId, amount, paidAt?, notes? })`. Invalidate both queries.

`[v3 CHANGE]` The `markPaid` input includes optional `notes` and `receiptUrl` fields. For Phase 1, include the `notes` field. Receipt upload is a Phase 2 feature.

#### Acceptance Criteria

- [ ] Monthly overview shows correct totals
- [ ] Create bill with all fields (including category select, rrule defaults to monthly)
- [ ] View bill details in drawer with payment history
- [ ] Mark paid with confirmation modal
- [ ] Archive bill (soft delete) with confirmation
- [ ] Overdue red styling + badge (from `currentStatus`)
- [ ] Auto-pay green badge
- [ ] Currency formatting consistent
- [ ] Loading skeleton, empty state with character illustration
- [ ] Mobile responsive 375px
- [ ] Typecheck passes, toasts work

---

### Sprint 4D — Calendar (/calendar)

**Estimated effort:** 3 days
**Branch:** `sprint-4d/calendar`

**Install:** `pnpm --filter @orbyt/web add @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction`

**Files:** Replace `calendar/page.tsx`. Create `components/calendar/calendar-content.tsx`, `event-drawer.tsx`, `calendar-toolbar.tsx`.

**Layout:** Top toolbar (Month/Week/Day toggles + nav). Below: calendar grid.

**Grid:** FullCalendar with `daygrid` (month), `timegrid` (week/day), `interaction` (click/drag). Styled to match theme via CSS overrides. Events color-coded by category (see Section 8.4). tRPC: `calendar.list({ startDate, endDate })` — backend already handles RRULE expansion via `expandRecurringEvents()`.

`[v3 CHANGE]` The `calendar.list` input expects `{ startDate: ISO string, endDate: ISO string }` plus optional `{ memberIds?: string[], categories?: string[] }` for filtering. The backend also accepts these filter params — expose them in the toolbar as optional filter dropdowns.

**Event Drawer:** Create (click empty date): title, start/end date+time, category (select from Section 8.4 values), description, location `[v3 NEW]`, recurrence, attendees. View/edit (click event): all fields + delete. Use `calendar.getById` for the detail view (includes attendee profiles) `[v3 NEW]`.

`[v3 CHANGE]` The `events` schema has a `location` field (text) and a `metadata` JSONB field. Include location as a text input in the event form. Ignore `metadata` for Phase 1. The `eventAttendees` table has both `userId` and `contactId` — for Phase 1, only support household member attendees (`userId`). Contact attendees are Phase 2.

**Recurrence:** Frequency dropdown (None/Daily/Weekly/Monthly/Yearly), interval, weekday checkboxes (weekly), end condition. Use `buildRRule` and `describeRRule` from `@orbyt/shared/utils`.

`[v3 NOTE]` The `calendar.update` procedure supports an `updateMode` param (`"this" | "this_and_future" | "all"`) for recurring events, but the "this" and "this_and_future" modes have a TODO for full recurrence exception handling. For Phase 1, always pass `updateMode: "all"` when editing recurring events. Show a notice in the UI: "Changes will apply to all occurrences."

**Mobile:** Default to agenda/list view grouped by day. Tap event → full-screen drawer.

#### Acceptance Criteria

- [ ] Month/Week/Day views render correctly
- [ ] Navigation refetches data for visible range
- [ ] Create event by clicking date (with location field)
- [ ] View/edit event by clicking it (uses `getById` for attendee details)
- [ ] Recurring events display correctly (expanded by backend)
- [ ] Create recurring event with selector
- [ ] Delete with confirmation
- [ ] FullCalendar styled to match theme (CSS variable overrides)
- [ ] Mobile shows agenda view
- [ ] Typecheck passes, toasts work
- [ ] FullCalendar loaded via `dynamic()` import (performance)
- [ ] Empty state with character illustration

---

### Sprint 4E — Contacts (/contacts)

**Estimated effort:** 2 days
**Branch:** `sprint-4e/contacts`

**Files:** Replace `contacts/page.tsx`. Create `components/contacts/contacts-content.tsx`, `contact-drawer.tsx`.

**Layout:** Top: search + filter dropdown `[v3 NEW]` + "Add Contact" button. Upcoming birthdays scroll row. Below: contact grid.

**Contact Cards:** 3 columns lg+, 2 md, 1 sm. Avatar, full name, relationship badge (from `relationshipType`), phone, birthday countdown chip. Search filters with 300ms debounce via `contacts.list({ search })`. Relationship type filter dropdown `[v3 NEW]`.

`[v3 CHANGE]` The schema field is `relationshipType`, not `relationship`. The `contacts.list` procedure also accepts `{ relationshipType?: string, sortBy?: "name" | "birthday" | "createdAt" }`. Expose the sort option in the toolbar.

**Birthday Countdown:** 0 days → "Today!" green, 1-7 → green chip, 8-30 → default, >30 → gray. `daysUntilBirthday` already computed by API.

**Contact Drawer:** Create: first name, last name, relationship type (select from standard values in Section 8.4), phone, email, address `[v3 CHANGE]` (structured: street, city, state, zip — the schema uses JSONB), birthday, anniversary `[v3 NEW]`, social links `[v3 NEW]` (instagram, facebook, linkedin, twitter, website — collapsible "Social" section), notes. View: all fields + notes timeline (text, author name from joined profile, timestamp). Add note form. Edit toggle. Delete with confirmation.

`[v3 CHANGE — CRITICAL]` The `contacts` schema stores `address` as a JSONB object with `{ street?, city?, state?, zip?, country? }`, NOT a single string. The contact drawer must render this as separate form fields (street, city, state, zip) and display it formatted. The `socialLinks` JSONB has fields for instagram, facebook, linkedin, twitter, website. Render these as a collapsible "Social Links" section in the drawer with individual text inputs.

**Upcoming Birthdays Row:** Horizontal scroll above grid. Next 30 days. `contacts.getUpcomingBirthdays({ daysAhead: 30 })`. Hide if empty result.

#### Acceptance Criteria

- [ ] Contact list with avatars, relationship badges, birthday countdowns
- [ ] Search filters with 300ms debounce
- [ ] Relationship type filter dropdown
- [ ] Create contact with all fields (structured address, social links)
- [ ] View details in drawer (notes timeline with author names)
- [ ] Edit fields, add notes
- [ ] Delete with confirmation
- [ ] Birthday section shows/hides correctly
- [ ] Loading skeleton, empty states (no contacts, no search results)
- [ ] Mobile 375px responsive
- [ ] Typecheck passes, toasts work
- [ ] Empty state with character illustration

---

### Sprint 4F — Settings (/settings)

**Estimated effort:** 2 days
**Branch:** `sprint-4f/settings`

**Files:** Replace `settings/page.tsx`. Create `components/settings/settings-content.tsx`, `profile-tab.tsx`, `household-tab.tsx`, `appearance-tab.tsx`, `notifications-tab.tsx`.

**Layout:** Radix Tabs. 4 tabs: Profile, Household, Appearance, Notifications.

**Profile Tab:** Display name input + save. Avatar: illustrated picker grid (20-30 options, use placeholders until assets arrive) + photo upload to Supabase Storage `avatars`. Set `avatarType` to `"illustrated"` or `"photo"` accordingly `[v3 NEW]`. AI persona toggle (Rosie/Eddie). Timezone select `[v3 NEW]`. Email (read-only).

**Avatar Storage Setup (prerequisite):**

```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
-- Plus RLS policies for upload/read/update/delete
```

Upload path: `avatars/{userId}/avatar.{ext}`

**Household Tab:** Name (editable, admin). Member list with roles, display colors, "Remove" (admin only, with confirmation). `[v3 CHANGE]` Add safety check: if removing a member would leave zero admins, show error toast "Cannot remove the last admin. Promote another member first." (Note: the backend does NOT enforce this — the front-end must check before calling `removeMember`). Invite form with email input → `household.inviteMember` → on success, generate invite link and copy to clipboard `[v3 CHANGE]`. Toast: "Invite link copied! Share it with your family member."

**Appearance Tab:** 9 theme cards in 3×3 grid. Color swatch previews. Checkmark on active. Click → immediate `data-theme` apply + persist via `updateProfile({ theme: themeName })`.

**Notifications Tab:** Toggle switches per category. "Coming soon" label for now.

#### Acceptance Criteria

- [ ] Tab navigation works
- [ ] Update display name, timezone
- [ ] Illustrated avatar picker + photo upload (sets `avatarType`)
- [ ] AI persona toggle (Rosie/Eddie)
- [ ] Household name editable (admin)
- [ ] Member list with roles and colors
- [ ] Remove member (admin, with confirmation, blocked if last admin)
- [ ] Invite form creates record → copies link to clipboard → shows toast
- [ ] Theme picker applies + persists all 9 themes
- [ ] Mobile responsive 375px
- [ ] Typecheck passes, toasts work

---

### Sprint 5 — Invite Flow + Polish + Deploy

**Estimated effort:** 3-4 days
**Branch:** `sprint-5/deploy`
**Depends on:** All Sprint 4 branches merged

**5A — Invite Acceptance Page:** `app/(auth)/invite/[token]/page.tsx`. If not logged in: simplified registration (no household step — they're joining an existing one). If logged in: call `household.acceptInvitation({ token })` → set `localStorage` household ID → redirect to dashboard. Invalid token → `NOT_FOUND` error → show friendly message + link to `/register`. Expired token → `PRECONDITION_FAILED` → show "This invitation has expired. Ask your household admin for a new one." + link to `/register`.

**5B — Resend Email (optional for launch).** Add `RESEND_API_KEY`. Install `resend` in `@orbyt/api`. Wire the TODO at `household.ts`. Template: household name, inviter name, invite link. If Resend is not wired in time, the clipboard invite flow from Sprint 0J/4F is the launch fallback — this is acceptable. `[v3 CHANGE]`

**5C — PWA Assets:** 192×192 and 512×512 PNG icons. Basic service worker (`sw.js`). Manifest file with app name, theme color, display mode.

**5D — Error Tracking:** Sentry integration. `@sentry/nextjs`. Client, server, edge configs.

**5E — Performance Audit:** Lighthouse 90+ all pages. `loading.tsx` everywhere. `dynamic()` for FullCalendar. Bundle analysis. Verify glass-morphism performance on mobile emulators.

**5F — Accessibility Contrast Audit. `[v3 NEW]`** Verify all 9 themes pass WCAG AA contrast checks (36 combinations per Section 8.13). Fix any failures by adjusting surface opacity.

**5G — E2E Test Suite. `[v3 NEW]`** Write remaining 4 critical E2E flows (task, shopping, finance, multi-user real-time). See Section 13. All must pass at both viewports before deploy.

**5H — Deploy to Vercel:** Connect GitHub. Root directory `apps/web`. Build: `cd ../.. && pnpm turbo build --filter=@orbyt/web`. Supabase Cloud project. Apply migration. Configure auth, storage, Realtime. Set all env vars.

**5I — Post-deploy verification:** Full flow test in production.

#### Acceptance Criteria

- [ ] Invite flow end-to-end (both logged-in and new-user paths)
- [ ] PWA installs with icons
- [ ] Sentry captures errors
- [ ] Lighthouse 90+ Performance, 95+ Accessibility
- [ ] All 9 themes pass WCAG AA contrast
- [ ] All 5 E2E flows pass at both viewports
- [ ] Production deployed and functional
- [ ] All features work in production
- [ ] RLS correct in production

---

## 13. TESTING STRATEGY

### Testing Stack

| Type | Tool | Scope |
|---|---|---|
| Unit/Integration | Vitest + React Testing Library | Utils, hooks |
| E2E | Playwright | Full user flows |
| Type checking | `tsc --noEmit` | Compile-time |
| Accessibility | axe-core (via Playwright) | Contrast, ARIA |

### Unit Tests (packages/shared) — Sprint 0+

Priority functions with specific test cases `[v3 NEW]`:

**`formatCurrency(amount, currency)`:** Test `formatCurrency(1500, "USD")` → `"$1,500.00"`. Test `formatCurrency(15.99, "USD")` → `"$15.99"`. Test `formatCurrency(0, "USD")` → `"$0.00"`. Test with string input (the `bills.amount` column is `numeric` which Drizzle returns as string): `formatCurrency("1500.00", "USD")` → `"$1,500.00"`.

**`getDaysUntilBirthday(birthday)`:** Test with birthday tomorrow → `1`. Test with birthday today → `0`. Test with birthday yesterday (should return ~364/365). Test with leap year birthday on non-leap year. Test with `null` input → `null`.

**`getNextBillDueDate(dueDay)`:** Test with due day in the future this month → returns this month's date. Test with due day in the past this month → returns next month's date. Test with due day 31 in a 30-day month.

**`expandRecurringEvents(events, startDate, endDate)`:** Test single non-recurring event within range → returns it. Test single non-recurring event outside range → empty. Test weekly recurring event → returns correct number of instances. Test monthly recurring event crossing year boundary.

### E2E Tests (Playwright) — Sprint 0 + Sprint 5 `[v3 NEW]`

All E2E tests run at two viewports: `{ width: 1280, height: 800 }` and `{ width: 375, height: 667 }`.

**Flow 1 — Auth (Sprint 0K):**

```
1. Navigate to /register
2. Fill email: `test-${Date.now()}@orbyt.app`, password: `TestPass123!`, display name: "Test User"
3. Submit step 1 → step 2 appears
4. Fill household name: "Test Family"
5. Submit step 2 → step 3 appears
6. Select Rosie → select Orbit theme
7. Submit → redirected to /dashboard
8. Verify: page title contains "Dashboard"
9. Verify: stat cards are visible (even if showing zeros)
10. Click user avatar → logout
11. Navigate to /login
12. Fill same email + password → submit
13. Verify: redirected to /dashboard
14. Verify: stat cards visible
```

**Flow 2 — Tasks (Sprint 5G):**

```
1. Login with seed user (demo@orbyt.app)
2. Navigate to /tasks
3. Verify: Kanban columns visible (To Do, In Progress, Done)
4. Click "Add Task" → drawer opens
5. Fill title: "E2E Test Task", priority: High, status: To Do
6. Save → drawer closes → toast appears
7. Verify: new task card appears in "To Do" column
8. [Desktop only] Drag task to "In Progress" column
9. Verify: task now in "In Progress" column
10. Click task → drawer opens in view mode
11. Verify: title, priority, status displayed
12. Delete task → confirm → toast appears
13. Verify: task removed from board
```

**Flow 3 — Shopping (Sprint 5G):**

```
1. Login with seed user
2. Navigate to /shopping
3. Click "Create a List" (or CTA if empty state)
4. Enter list name: "E2E Groceries" → submit
5. Verify: list appears in left panel
6. Click list → right panel shows items (empty)
7. Add item: "Milk", quantity: "2", category: "Dairy"
8. Verify: item appears in list
9. Check the item checkbox
10. Verify: strikethrough applied
11. Click "Clear Checked" → confirm
12. Verify: item removed
```

**Flow 4 — Finances (Sprint 5G):**

```
1. Login with seed user
2. Navigate to /finances
3. Verify: summary cards visible
4. Click "Add a Bill" (or CTA if empty state)
5. Fill: name "E2E Electric", amount "120.00", due day 15, category "utilities"
6. Save → toast → bill card appears
7. Click bill → drawer opens
8. Click "Mark Paid" → modal appears with pre-filled amount
9. Confirm → toast → bill shows "paid" badge
10. Verify: summary cards updated (totalPaid increased)
```

**Flow 5 — Multi-User Real-Time (Sprint 5G):**

```
1. Open two browser contexts (Playwright's browser.newContext())
2. Context A: login as demo@orbyt.app
3. Context B: login as member@orbyt.app
4. Both navigate to /shopping
5. Context A: select same list, add item "Real-time Test Item"
6. Context B: verify item appears within 3 seconds (poll or wait)
7. Context B: check the item
8. Context A: verify item shows checked state within 3 seconds
```

### Commands

```bash
pnpm --filter @orbyt/shared test        # Unit
pnpm --filter @orbyt/web test:e2e       # E2E
pnpm turbo test                          # All
```

### Coverage Targets

80% on `packages/shared/src/utils/`. All 5 E2E flows pass at both viewports. Zero accessibility violations from axe-core on any page.

---

## 14. CI/CD PIPELINE

### GitHub Actions CI

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo typecheck
      - run: pnpm turbo lint
      - run: pnpm turbo test

  e2e:
    runs-on: ubuntu-latest
    needs: quality
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - uses: supabase/setup-cli@v1
      - run: supabase start
      - run: pnpm --filter @orbyt/web build
      - run: pnpm --filter @orbyt/web test:e2e
```

Vercel preview deployments automatic on PR. Pre-commit hooks optional (husky + lint-staged).

---

## 15. BRANCHING STRATEGY FOR PARALLEL AGENTS

### Branch Naming

`sprint-0/foundation`, `sprint-4b/shopping`, `sprint-4c/finances`, `sprint-4d/calendar`, `sprint-4e/contacts`, `sprint-4f/settings`, `sprint-5/deploy`

### Workflow

Each agent branches from `main` after Sprint 0 merges. Agents work independently. Must NOT modify files outside their sprint scope. PR to main when done. CI must pass before merge.

### Conflict Prevention — OFF-LIMITS Files

Feature agents (4B–4F) **cannot touch**:

- `app/(dashboard)/layout.tsx`
- `components/sidebar.tsx`
- `components/dashboard-header.tsx`
- `components/providers.tsx`
- `components/household-guard.tsx`
- `middleware.ts`
- `globals.css` (existing rules only — can ADD new classes at the end of the file, never modify existing ones)
- `packages/api/**` (all backend code)
- `packages/db/**` (all schema code)
- `packages/shared/**` (all shared utilities)
- `CLAUDE.md`
- `.claude/**`
- Root config files (`turbo.json`, `pnpm-workspace.yaml`, `package.json`, `tsconfig.json`)

If a shared file change is needed, document in PR description. Project lead applies.

### Merge Order

Sprint 0 → (all Sprint 4s in any order) → Sprint 5.

---

## 16. DATABASE SEEDING & FIXTURES

**Files:** `packages/db/src/seed.ts`, `supabase/seed.sql`

### Deterministic Seed Data `[v3 CHANGE — Fully Specified]`

All dates below are relative to "today" (the date the seed runs). This ensures seed data stays relevant regardless of when it's executed.

#### Users (2)

| Field | User 1 (Admin) | User 2 (Member) |
|---|---|---|
| Email | `demo@orbyt.app` | `member@orbyt.app` |
| Password | `password123` | `password123` |
| Display Name | Alex Moon | Sam Moon |
| Theme | `orbit` | `aurora` |
| AI Persona | `rosie` | `eddie` |
| Avatar Type | `photo` | `illustrated` |
| Timezone | `America/Chicago` | `America/Chicago` |

#### Household (1)

Name: "Moon Family". Both users as members. Alex as `admin`, Sam as `member`. Alex's display color: `#06B6D4` (teal). Sam's display color: `#A78BFA` (violet).

#### Tasks (8)

| Title | Status | Priority | Assigned To | Due Date | Description |
|---|---|---|---|---|---|
| Organize garage | `todo` | `high` | Alex | today + 1 day | "Sort through boxes and donate unused items" |
| Buy birthday gift for Mom | `todo` | `medium` | Sam | today + 3 days | "She mentioned wanting a new cookbook" |
| Schedule dentist appointments | `todo` | `low` | Alex | today + 7 days | "Both kids need checkups" |
| Fix leaky kitchen faucet | `in_progress` | `high` | Alex | today - 1 day (overdue) | "Washer replacement — parts ordered" |
| Plan weekend meals | `in_progress` | `medium` | Sam | today + 2 days | null |
| Update emergency contacts list | `todo` | `low` | (unassigned) | today + 14 days | null |
| Clean out fridge | `done` | `low` | Sam | today - 2 days | "Completed last Tuesday" |
| Pay quarterly taxes | `done` | `high` | Alex | today - 5 days | "Filed and confirmed" |

#### Events (6)

| Title | Category | Start | End | All Day | Recurrence | Attendees |
|---|---|---|---|---|---|---|
| Family Game Night | `family` | today + 2 days, 7:00 PM | today + 2 days, 9:00 PM | false | null | Alex, Sam |
| Sam's Soccer Practice | `school` | today + 3 days, 4:00 PM | today + 3 days, 5:30 PM | false | `FREQ=WEEKLY;BYDAY=WE` | Sam |
| Mortgage Payment Due | `other` | 1st of next month | null | true | `FREQ=MONTHLY;BYMONTHDAY=1` | Alex |
| Doctor Appointment | `health` | today + 5 days, 10:00 AM | today + 5 days, 11:00 AM | false | null | Alex |
| Anniversary Dinner | `social` | today - 3 days, 7:00 PM | today - 3 days, 10:00 PM | false | null | Alex, Sam |
| Spring Break | `family` | today + 20 days | today + 27 days | true | null | Alex, Sam |

#### Bills (5)

| Name | Amount | Due Day | Category | Auto-Pay | Currency | Active | Notes |
|---|---|---|---|---|---|---|---|
| Rent | 1500.00 | 1 | `housing` | false | USD | true | "Landlord: PropertyCo" |
| Electric | 120.00 | 15 | `utilities` | false | USD | true | null |
| Netflix | 15.99 | 22 | `subscriptions` | true | USD | true | "Family plan" |
| Car Insurance | 200.00 | 5 | `insurance` | true | USD | true | "Policy #INS-2024-8821" |
| Grocery Budget | 600.00 | 1 | `food` | false | USD | true | null |

**Payments for current month:** Rent (paid on 1st, amount 1500.00, by Alex), Netflix (paid on 22nd or today if before 22nd, amount 15.99, by Alex), Car Insurance (paid on 5th, amount 200.00, by Alex).

#### Shopping Lists (2)

**List 1: "Groceries"** (emoji: 🛒, isDefault: true)

| Item | Quantity | Category | Checked | Added By |
|---|---|---|---|---|
| Milk | "1 gallon" | Dairy | false | Alex |
| Eggs | "1 dozen" | Dairy | false | Alex |
| Chicken breast | "2 lbs" | Meat | false | Sam |
| Broccoli | "2 heads" | Produce | true | Sam |
| Rice | "5 lb bag" | Pantry | true | Alex |
| Bread | "1 loaf" | Bakery | true | Sam |
| Olive oil | null | Pantry | false | Alex |
| Bananas | "1 bunch" | Produce | false | Sam |

**List 2: "Home Depot"** (emoji: 🔨, isDefault: false)

| Item | Quantity | Category | Checked | Added By |
|---|---|---|---|---|
| Faucet washer kit | "1" | Plumbing | false | Alex |
| WD-40 | "1 can" | Tools | false | Alex |
| Light bulbs | "4-pack LED" | Electrical | false | Sam |
| Painter's tape | "2 rolls" | Paint | false | Alex |

#### Contacts (5)

| First | Last | Relationship Type | Phone | Birthday | Notes |
|---|---|---|---|---|---|
| Margaret | Moon | `grandparent` | (555) 123-4567 | today + 5 days (upcoming!) | "Prefers calls over texts" |
| Dr. Sarah | Chen | `doctor` | (555) 234-5678 | null | "Pediatrician — Oak Street Medical" |
| Mike | Johnson | `neighbor` | (555) 345-6789 | today + 12 days (upcoming!) | "Has spare key to our house" |
| Coach | Williams | `coach` | (555) 456-7890 | null | "Sam's soccer coach" |
| Lisa | Park | `friend` | (555) 567-8901 | 6 months from today | "College friend — lives in Austin" |

Contacts 1 and 3 have upcoming birthdays within 14 days. Contact notes: Margaret has 2 notes ("Called to wish happy holidays" dated today - 30 days, "Sent flowers for her birthday" dated today - 365 days). Dr. Chen has 1 note ("Annual checkup scheduled for March" dated today - 14 days).

### Commands

```bash
supabase db reset          # Reset + re-seed
pnpm --filter @orbyt/db db:seed  # TypeScript seed
```

---

## 17. API CONTRACT REFERENCE `[v3 CHANGE — FULLY REWRITTEN]`

> **AUTHORITATIVE SOURCE:** This section has been rewritten from the actual router source code pulled from the repository on February 20, 2026. If any discrepancy exists between this reference and runtime behavior, the runtime code in `packages/api/src/routers/` is authoritative — update this document.

### 17.1 Shopping Router (`packages/api/src/routers/shopping.ts`)

**`shopping.listLists`** — Procedure: `householdProcedure`
Input: none
Output: `Array<{ id, name, emoji, isDefault, householdId, createdBy, archivedAt, createdAt, updatedAt, itemCount: number, checkedCount: number, items: ShoppingItem[] }>`
Notes: Ordered by `isDefault` DESC then `name` ASC. The `items` relation is loaded (for count computation). `itemCount` and `checkedCount` are computed fields.

**`shopping.createList`** — Procedure: `householdProcedure`
Input: `CreateShoppingListSchema` — `{ name: string, emoji?: string }`
Output: `ShoppingList` row

**`shopping.listItems`** — Procedure: `householdProcedure`
Input: `{ listId: string (uuid) }`
Output: `Array<ShoppingItem>` — `{ id, listId, addedBy, checkedBy, name, quantity, category, notes, checked, checkedAt, sortOrder, createdAt }`
Errors: `NOT_FOUND` if list doesn't exist or belongs to different household
Notes: Ordered by `checked` ASC, `category` ASC, `name` ASC (unchecked items first, grouped by category)

**`shopping.addItem`** — Procedure: `householdProcedure`
Input: `AddShoppingItemSchema` — `{ listId: string, name: string, quantity?: string, category?: string }`
Output: `ShoppingItem` row
Errors: `NOT_FOUND` if list doesn't exist or wrong household

**`shopping.checkItem`** — Procedure: `householdProcedure`
Input: `CheckShoppingItemSchema` — **`{ itemId: string, checked: boolean }`**
Output: `ShoppingItem` row (updated)
Errors: `NOT_FOUND` if item doesn't exist
Notes: When `checked: true`, sets `checkedBy` to current user and `checkedAt` to now. When `checked: false`, clears both.

> **⚠️ FIELD NAME:** The input field is `itemId`, NOT `id`. The original bible documented this incorrectly.

**`shopping.deleteItem`** — Procedure: `householdProcedure`
Input: **`{ itemId: string (uuid) }`**
Output: `{ success: true }`

> **⚠️ FIELD NAME:** The input field is `itemId`, NOT `id`.

**`shopping.clearChecked`** — Procedure: `householdProcedure`
Input: `{ listId: string (uuid) }`
Output: `{ success: true }`
Notes: Hard deletes all items where `checked = true` in the specified list.

### 17.2 Finances Router (`packages/api/src/routers/finances.ts`)

**`finances.listBills`** — Procedure: `householdProcedure`
Input: none
Output: `Array<{ ...Bill, nextDueDate: Date, lastPayment: BillPayment | null, currentStatus: "overdue" | "upcoming" }>`
Notes: Only active bills (`isActive = true`). Ordered by `dueDay` ASC, `name` ASC. Each bill includes computed `nextDueDate`, last payment record, and overdue status.

**`finances.getBillById`** — Procedure: `householdProcedure`
Input: `{ id: string (uuid) }`
Output: `{ ...Bill, payments: BillPayment[] }`
Errors: `NOT_FOUND` if bill doesn't exist or wrong household
Notes: Includes full payment history ordered by `paidAt` DESC.

**`finances.createBill`** — Procedure: `householdProcedure`
Input: `CreateBillSchema` — `{ name, amount, dueDay: number (1-31), category, rrule: string, autoPay?: boolean, notes?: string, url?: string, currency?: string }`
Output: `Bill` row
Notes: `rrule` is required. Default should be `"FREQ=MONTHLY"`.

**`finances.updateBill`** — Procedure: `householdProcedure`
Input: `{ id: string, data: UpdateBillSchema }`
Output: `Bill` row (updated)
Errors: `NOT_FOUND`

**`finances.deleteBill`** — Procedure: `householdProcedure`
Input: `{ id: string (uuid) }`
Output: `{ success: true }` (implicit)
Notes: **SOFT DELETE** — sets `isActive: false`. Does not remove the row.

**`finances.markPaid`** — Procedure: `householdProcedure`
Input: `MarkBillPaidSchema` — `{ billId: string, amount: string | number, paidAt?: string (ISO), notes?: string, receiptUrl?: string }`
Output: `BillPayment` row
Errors: `NOT_FOUND` if bill doesn't exist or wrong household
Notes: Creates a new `bill_payments` row. `dueDate` is auto-computed from `getNextBillDueDate(bill.dueDay)`. `paidBy` is auto-set to current user.

**`finances.getMonthlyOverview`** — Procedure: `householdProcedure`
Input: `GetMonthlyOverviewSchema` — **`{ month: string }` format `"YYYY-MM"`**
Output: `{ month: string, totalBilled: number, totalPaid: number, totalPending: number, billCount: number, paidCount: number }`

> **⚠️ INPUT FORMAT:** This takes a single `month` string in `"YYYY-MM"` format (e.g., `"2026-02"`), NOT separate `month` and `year` fields. The original bible documented this incorrectly.

**`finances.getUpcoming`** — Procedure: `householdProcedure`
Input: `{ daysAhead: number }` (default 30)
Output: `Array<{ ...Bill, nextDueDate: Date }>` sorted by `nextDueDate` ASC
Notes: Not documented in original bible. Filters active bills to those with `nextDueDate` within `daysAhead` days.

### 17.3 Calendar Router (`packages/api/src/routers/calendar.ts`)

**`calendar.list`** — Procedure: `householdProcedure`
Input: `ListEventsSchema` — `{ startDate: string (ISO), endDate: string (ISO), memberIds?: string[], categories?: string[] }`
Output: Expanded event instances (recurring events materialized into individual occurrences)
Notes: Backend fetches all events where `startAt <= endDate`, filters by member/category if provided, then calls `expandRecurringEvents()` to materialize recurring instances within the range.

**`calendar.getById`** — Procedure: `householdProcedure`
Input: `{ id: string (uuid) }`
Output: `{ ...Event, attendees: Array<{ ...EventAttendee, profile: Profile }> }`
Errors: `NOT_FOUND`
Notes: Includes attendee profiles for displaying names/avatars.

**`calendar.create`** — Procedure: `householdProcedure`
Input: `CreateEventSchema` — `{ title, startAt: string (ISO), endAt?: string (ISO), allDay?: boolean, category?: string, description?: string, location?: string, rrule?: string, attendeeIds: string[] }`
Output: `Event` row
Notes: `attendeeIds` is required (can be empty array). The creator is auto-added as an attendee with `rsvpStatus: "accepted"`.

**`calendar.update`** — Procedure: `householdProcedure`
Input: `{ id: string, updateMode: "this" | "this_and_future" | "all" (default "this"), instanceDate?: string (ISO), data: UpdateEventSchema }`
Output: `Event` row (updated)
Errors: `NOT_FOUND`
Notes: **For Phase 1, always use `updateMode: "all"`.** The "this" and "this_and_future" modes have a TODO for recurrence exception handling. Both currently fall through to updating the base event.

**`calendar.delete`** — Procedure: `householdProcedure`
Input: `DeleteEventSchema` — `{ id: string }`
Output: `{ success: true }`
Errors: `NOT_FOUND`
Notes: Hard delete.

### 17.4 Contacts Router (`packages/api/src/routers/contacts.ts`)

**`contacts.list`** — Procedure: `householdProcedure`
Input: `{ search?: string, relationshipType?: string, sortBy?: "name" | "birthday" | "createdAt" (default "name") }`
Output: `Array<{ ...Contact, upcomingBirthday: Date | null, daysUntilBirthday: number | null }>`
Notes: Search is case-insensitive across `firstName`, `lastName`, and `email`. Ordered by `firstName` ASC, `lastName` ASC.

**`contacts.getById`** — Procedure: `householdProcedure`
Input: `{ id: string (uuid) }`
Output: `{ ...Contact, relationshipsFrom: Array<{ ...ContactRelationship, toContact: Contact }>, notes: Array<{ ...ContactNote, profile: Profile }> }`
Errors: `NOT_FOUND`
Notes: Includes related contacts and notes with author profiles. Notes ordered by `noteDate` DESC.

**`contacts.create`** — Procedure: `householdProcedure`
Input: `CreateContactSchema` — `{ firstName, lastName?, relationshipType, email?, phone?, address?: { street?, city?, state?, zip?, country? }, birthday?: string (date), anniversary?: string (date), socialLinks?: { instagram?, facebook?, linkedin?, twitter?, website? }, notes?: string, tags?: string[] }`
Output: `Contact` row

**`contacts.update`** — Procedure: `householdProcedure`
Input: `{ id: string, data: UpdateContactSchema }`
Output: `Contact` row (updated)
Errors: `NOT_FOUND`

**`contacts.delete`** — Procedure: `householdProcedure`
Input: `{ id: string (uuid) }`
Output: `{ success: true }`
Notes: Hard delete. Cascades to `contact_notes` and `contact_relationships`.

**`contacts.addNote`** — Procedure: `householdProcedure`
Input: `AddContactNoteSchema` — `{ contactId: string, content: string, noteDate?: string (ISO) }`
Output: `ContactNote` row
Errors: `NOT_FOUND` if contact doesn't exist or wrong household

**`contacts.linkRelationship`** — Procedure: `householdProcedure`
Input: `LinkRelationshipSchema` — `{ fromContactId: string, toContactId: string, label?: string }`
Output: `ContactRelationship` row
Notes: Not documented in original bible. Creates a directional relationship between two contacts.

**`contacts.getUpcomingBirthdays`** — Procedure: `householdProcedure`
Input: `{ daysAhead: number }` (default 30)
Output: `Array<{ ...Contact, daysUntilBirthday: number, nextBirthday: Date }>` sorted by `daysUntilBirthday` ASC
Notes: Filters server-side to contacts with non-null birthdays within range.

### 17.5 Household Router (`packages/api/src/routers/household.ts`)

**`household.create`** — Procedure: `protectedProcedure`
Input: `CreateHouseholdSchema` — `{ name: string, timezone?: string }`
Output: `Household` row
Notes: Auto-adds creator as admin with a display color generated by `stringToColor(userId)`.

**`household.list`** — Procedure: `protectedProcedure`
Input: none
Output: `Array<{ ...Household, role: string }>`
Notes: All households the current user is a member of.

**`household.getCurrent`** — Procedure: `householdProcedure`
Input: none
Output: `{ ...Household, members: Array<{ ...HouseholdMember, profile: Profile }> }`

> **⚠️ RESPONSE SHAPE:** Members are `HouseholdMember` rows with a nested `profile` object. To get a member's display name, access `member.profile.displayName`, NOT `member.displayName`. The original bible documented a flat shape that doesn't match the actual response.

**`household.update`** — Procedure: `adminProcedure`
Input: `UpdateHouseholdSchema`
Output: `Household` row (updated)

**`household.inviteMember`** — Procedure: `adminProcedure`
Input: `InviteMemberSchema` — `{ email: string, role?: string }`
Output: `Invitation` row (includes `token` field)
Errors: `CONFLICT` if email is already a household member
Notes: Creates invitation with 7-day expiry. Email sending is a TODO. Front-end should use the returned `token` to generate and copy an invite link.

**`household.acceptInvitation`** — Procedure: `protectedProcedure`
Input: `{ token: string (uuid) }`
Output: `{ householdId: string }`
Errors: `NOT_FOUND` (invalid token), `PRECONDITION_FAILED` (expired — auto-marks as expired)

**`household.removeMember`** — Procedure: `adminProcedure`
Input: `{ userId: string (uuid) }`
Output: implicit void
Notes: **⚠️ No safety check for removing the last admin.** The front-end MUST check if the target user is the last admin before calling this procedure. Count admins from the `getCurrent` response.

**`household.updateProfile`** — Procedure: `protectedProcedure`
Input: `UpdateProfileSchema` — `{ displayName?, theme?, avatarUrl?, aiPersona?, timezone? }`
Output: `Profile` row (updated)

---

## 18. ENTITY RELATIONSHIP DIAGRAM & SCHEMA REFERENCE `[v3 NEW — ENTIRE SECTION]`

### Visual ERD

```
┌─────────────────────┐       ┌──────────────────────────┐
│     auth.users       │       │        profiles           │
│  (Supabase managed)  │──1:1──│  id (PK, = auth.users.id)│
│                      │       │  email                    │
└─────────────────────┘       │  display_name             │
                               │  avatar_url               │
                               │  avatar_type              │
                               │  ai_persona               │
                               │  theme                    │
                               │  timezone                 │
                               └──────────┬───────────────┘
                                          │
                                   ┌──────┴───────┐
                                   │              │
                              ┌────▼────┐   ┌─────▼──────────┐
                              │household│   │  invitations    │
                              │_members │   │                 │
                              │(join)   │   │  token (unique) │
                              └────┬────┘   │  invited_email  │
                                   │        │  status         │
                              ┌────▼────┐   │  expires_at     │
                              │households│◄─┘                 │
                              │          │                    │
                              │  name    │                    │
                              │  slug    │                    │
                              │  settings│                    │
                              └────┬─────┘                    │
                                   │ (household_id FK on all below)
          ┌────────┬──────────┬────┴────┬──────────┬─────────┘
          ▼        ▼          ▼         ▼          ▼
     ┌─────────┐ ┌────────┐ ┌──────┐ ┌─────────┐ ┌──────────┐
     │  tasks   │ │ events │ │bills │ │shopping │ │ contacts │
     │         │ │        │ │      │ │_lists   │ │          │
     └────┬────┘ └───┬────┘ └──┬───┘ └────┬────┘ └────┬─────┘
          │          │         │           │           │
     ┌────┴────┐ ┌───┴─────┐ ┌▼────────┐ ┌▼────────┐ ├──┬────────┐
     │task_    │ │event_   │ │bill_    │ │shopping │ │  │contact │
     │assignees│ │attendees│ │payments │ │_items   │ │  │_notes  │
     └─────────┘ └─────────┘ └─────────┘ └─────────┘ │  └────────┘
     ┌─────────┐                                      │
     │task_    │                              ┌───────▼────────┐
     │comments │                              │contact_        │
     └─────────┘                              │relationships   │
                                              └────────────────┘
     ┌──────────────┐  ┌────────────┐
     │notifications │  │push_tokens │  (user-scoped, not household-scoped)
     └──────────────┘  └────────────┘

     ┌──────────────────┐  ┌─────────────┐
     │ai_conversations  │  │ai_messages  │  (Phase 3 scaffold — DO NOT MODIFY)
     └──────────────────┘  └─────────────┘
```

### Column-Level Schema Reference

#### `profiles`

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` PK | no | — | Matches `auth.users.id` exactly |
| `email` | `varchar(255)` | no | — | |
| `display_name` | `varchar(100)` | no | — | |
| `avatar_url` | `text` | yes | null | Photo URL or illustrated avatar path |
| `avatar_type` | `varchar(20)` | no | `'photo'` | `"photo"` or `"illustrated"` |
| `ai_persona` | `varchar(10)` | no | `'rosie'` | `"rosie"` or `"eddie"` |
| `theme` | `varchar(30)` | no | `'cosmic'` | Theme name. Note: default is `"cosmic"` in DB but should map to `"orbit"` in UI |
| `timezone` | `varchar(50)` | no | `'UTC'` | IANA timezone string |
| `created_at` | `timestamp` | no | `now()` | |
| `updated_at` | `timestamp` | no | `now()` | |

#### `households`

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` PK | no | `gen_random_uuid()` | |
| `name` | `varchar(100)` | no | — | |
| `slug` | `varchar(100)` UNIQUE | yes | null | URL-friendly name (not used in Phase 1) |
| `avatar_url` | `text` | yes | null | Household avatar/logo |
| `timezone` | `varchar(50)` | no | `'UTC'` | |
| `settings` | `jsonb` | yes | `{}` | `{ weekStartDay?: 0|1, dateFormat?: string, currency?: string }` |
| `created_at` | `timestamp` | no | `now()` | |
| `updated_at` | `timestamp` | no | `now()` | |

#### `household_members`

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` PK | no | `gen_random_uuid()` | |
| `household_id` | `uuid` FK → `households.id` | no | — | CASCADE delete |
| `user_id` | `uuid` FK → `profiles.id` | no | — | CASCADE delete |
| `role` | `varchar(20)` | no | `'member'` | `"admin"`, `"member"`, or `"child"` |
| `display_color` | `varchar(7)` | no | — | Hex color (e.g., `"#06B6D4"`) |
| `joined_at` | `timestamp` | no | `now()` | |

UNIQUE constraint on `(household_id, user_id)`.

#### `invitations`

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` PK | no | `gen_random_uuid()` | |
| `household_id` | `uuid` FK → `households.id` | no | — | CASCADE delete |
| `invited_email` | `varchar(255)` | no | — | |
| `invited_by` | `uuid` FK → `profiles.id` | no | — | |
| `token` | `uuid` UNIQUE | no | `gen_random_uuid()` | Used in invite URL |
| `role` | `varchar(20)` | no | `'member'` | |
| `status` | `varchar(20)` | no | `'pending'` | `"pending"`, `"accepted"`, `"expired"` |
| `expires_at` | `timestamp` | no | — | Set to 7 days from creation |
| `created_at` | `timestamp` | no | `now()` | |

#### `tasks`

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` PK | no | `gen_random_uuid()` | |
| `household_id` | `uuid` FK → `households.id` | no | — | CASCADE delete |
| `created_by` | `uuid` FK → `profiles.id` | no | — | |
| `parent_task_id` | `uuid` | yes | null | Self-reference for subtasks (Phase 2) |
| `title` | `varchar(500)` | no | — | |
| `description` | `text` | yes | null | |
| `status` | `varchar(20)` | no | `'todo'` | `"todo"`, `"in_progress"`, `"done"` |
| `priority` | `varchar(20)` | no | `'medium'` | `"high"`, `"medium"`, `"low"`, `"none"` |
| `due_at` | `timestamptz` | yes | null | |
| `completed_at` | `timestamptz` | yes | null | |
| `rrule` | `text` | yes | null | Recurring task rule (Phase 2) |
| `tags` | `text[]` | no | `'{}'` | Array of tag strings (Phase 2 UI) |
| `created_at` | `timestamp` | no | `now()` | |
| `updated_at` | `timestamp` | no | `now()` | |

#### `task_assignees`

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `task_id` | `uuid` FK → `tasks.id` | no | — | CASCADE delete. Composite PK. |
| `user_id` | `uuid` FK → `profiles.id` | no | — | CASCADE delete. Composite PK. |
| `assigned_at` | `timestamp` | no | `now()` | |

#### `task_comments`

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` PK | no | `gen_random_uuid()` | |
| `task_id` | `uuid` FK → `tasks.id` | no | — | CASCADE delete |
| `user_id` | `uuid` FK → `profiles.id` | no | — | CASCADE delete |
| `content` | `text` | no | — | |
| `created_at` | `timestamp` | no | `now()` | |
| `updated_at` | `timestamp` | no | `now()` | |

#### `events`

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` PK | no | `gen_random_uuid()` | |
| `household_id` | `uuid` FK → `households.id` | no | — | CASCADE delete |
| `created_by` | `uuid` FK → `profiles.id` | no | — | |
| `title` | `varchar(255)` | no | — | |
| `description` | `text` | yes | null | |
| `location` | `text` | yes | null | |
| `category` | `varchar(20)` | no | `'other'` | See Section 8.4 calendar categories |
| `start_at` | `timestamptz` | no | — | |
| `end_at` | `timestamptz` | yes | null | |
| `all_day` | `boolean` | no | `false` | |
| `rrule` | `text` | yes | null | RFC 5545 recurrence rule |
| `parent_event_id` | `uuid` | yes | null | Self-reference for recurrence exceptions |
| `color` | `varchar(7)` | yes | null | Override color (hex) |
| `metadata` | `jsonb` | yes | `{}` | Extensible metadata (Phase 2) |
| `created_at` | `timestamp` | no | `now()` | |
| `updated_at` | `timestamp` | no | `now()` | |

#### `event_attendees`

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` PK | no | `gen_random_uuid()` | |
| `event_id` | `uuid` FK → `events.id` | no | — | CASCADE delete |
| `user_id` | `uuid` FK → `profiles.id` | yes | null | Household member attendee |
| `contact_id` | `uuid` | yes | null | Non-member attendee (Phase 2) |
| `rsvp_status` | `varchar(20)` | yes | `'pending'` | `"pending"`, `"accepted"`, `"declined"` |

UNIQUE constraint on `(event_id, user_id)`.

#### `bills`

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` PK | no | `gen_random_uuid()` | |
| `household_id` | `uuid` FK → `households.id` | no | — | CASCADE delete |
| `created_by` | `uuid` FK → `profiles.id` | no | — | |
| `name` | `varchar(255)` | no | — | |
| `category` | `varchar(50)` | no | — | See Section 8.4 bill categories |
| `amount` | `numeric(10,2)` | no | — | **Returned as string by Drizzle.** Use `parseFloat()` before formatting. |
| `currency` | `varchar(3)` | no | `'USD'` | ISO 4217 currency code |
| `due_day` | `integer` | no | — | 1-31 |
| `rrule` | `text` | no | — | Required. Default `"FREQ=MONTHLY"` |
| `auto_pay` | `boolean` | no | `false` | |
| `notes` | `text` | yes | null | |
| `url` | `text` | yes | null | Bill provider URL |
| `is_active` | `boolean` | no | `true` | `false` = archived (soft deleted) |
| `created_at` | `timestamp` | no | `now()` | |
| `updated_at` | `timestamp` | no | `now()` | |

#### `bill_payments`

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` PK | no | `gen_random_uuid()` | |
| `bill_id` | `uuid` FK → `bills.id` | no | — | CASCADE delete |
| `paid_by` | `uuid` FK → `profiles.id` | no | — | |
| `amount` | `numeric(10,2)` | no | — | **String from Drizzle** |
| `paid_at` | `timestamptz` | no | — | |
| `due_date` | `timestamptz` | no | — | Auto-computed by `markPaid` |
| `status` | `varchar(20)` | no | `'paid'` | |
| `notes` | `text` | yes | null | |
| `receipt_url` | `text` | yes | null | Phase 2: receipt upload |
| `created_at` | `timestamp` | no | `now()` | |

#### `shopping_lists`

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` PK | no | `gen_random_uuid()` | |
| `household_id` | `uuid` FK → `households.id` | no | — | CASCADE delete |
| `created_by` | `uuid` FK → `profiles.id` | no | — | |
| `name` | `varchar(100)` | no | — | |
| `emoji` | `varchar(10)` | no | `'🛒'` | |
| `is_default` | `boolean` | no | `false` | Default list sorts first |
| `archived_at` | `timestamp` | yes | null | |
| `created_at` | `timestamp` | no | `now()` | |
| `updated_at` | `timestamp` | no | `now()` | |

#### `shopping_items`

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` PK | no | `gen_random_uuid()` | |
| `list_id` | `uuid` FK → `shopping_lists.id` | no | — | CASCADE delete |
| `added_by` | `uuid` FK → `profiles.id` | no | — | |
| `checked_by` | `uuid` FK → `profiles.id` | yes | null | Set when checked |
| `name` | `varchar(255)` | no | — | |
| `quantity` | `varchar(50)` | yes | null | Freetext (e.g., "2 lbs") |
| `category` | `varchar(100)` | yes | null | Freetext with autocomplete suggestions |
| `notes` | `text` | yes | null | |
| `checked` | `boolean` | no | `false` | |
| `checked_at` | `timestamp` | yes | null | |
| `sort_order` | `integer` | no | `0` | |
| `created_at` | `timestamp` | no | `now()` | |

#### `contacts`

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` PK | no | `gen_random_uuid()` | |
| `household_id` | `uuid` FK → `households.id` | no | — | CASCADE delete |
| `created_by` | `uuid` FK → `profiles.id` | no | — | |
| `first_name` | `varchar(100)` | no | — | |
| `last_name` | `varchar(100)` | yes | null | |
| `relationship_type` | `varchar(50)` | no | — | See Section 8.4 relationship types |
| `email` | `varchar(255)` | yes | null | |
| `phone` | `varchar(50)` | yes | null | |
| `address` | `jsonb` | yes | `{}` | `{ street?, city?, state?, zip?, country? }` |
| `birthday` | `date` | yes | null | Year-agnostic for recurring birthdays |
| `anniversary` | `date` | yes | null | |
| `avatar_url` | `text` | yes | null | |
| `social_links` | `jsonb` | yes | `{}` | `{ instagram?, facebook?, linkedin?, twitter?, website? }` |
| `notes` | `text` | yes | null | General notes (distinct from `contact_notes` timeline) |
| `tags` | `text[]` | no | `'{}'` | |
| `linked_user_id` | `uuid` FK → `profiles.id` | yes | null | Links contact to household member (ON DELETE SET NULL) |
| `created_at` | `timestamp` | no | `now()` | |
| `updated_at` | `timestamp` | no | `now()` | |

#### `contact_relationships`

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` PK | no | `gen_random_uuid()` | |
| `household_id` | `uuid` FK → `households.id` | no | — | CASCADE delete |
| `from_contact_id` | `uuid` FK → `contacts.id` | no | — | CASCADE delete |
| `to_contact_id` | `uuid` FK → `contacts.id` | no | — | CASCADE delete |
| `relationship_label` | `varchar(100)` | yes | null | e.g., "sibling", "parent of" |
| `created_at` | `timestamp` | no | `now()` | |

UNIQUE constraint on `(from_contact_id, to_contact_id)`.

#### `contact_notes`

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` PK | no | `gen_random_uuid()` | |
| `contact_id` | `uuid` FK → `contacts.id` | no | — | CASCADE delete |
| `user_id` | `uuid` FK → `profiles.id` | no | — | CASCADE delete |
| `content` | `text` | no | — | |
| `note_date` | `timestamp` | yes | `now()` | When the interaction/note occurred |
| `created_at` | `timestamp` | no | `now()` | |

#### `notifications`

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` PK | no | `gen_random_uuid()` | |
| `user_id` | `uuid` FK → `profiles.id` | no | — | CASCADE delete |
| `household_id` | `uuid` FK → `households.id` | no | — | CASCADE delete |
| `type` | `varchar(50)` | no | — | e.g., `"task_assigned"`, `"bill_due"`, `"invitation"` |
| `title` | `varchar(255)` | no | — | |
| `body` | `text` | yes | null | |
| `data` | `jsonb` | yes | `{}` | `{ route?, entityId?, entityType? }` for deep linking |
| `read_at` | `timestamp` | yes | null | null = unread |
| `sent_at` | `timestamp` | yes | null | |
| `channels` | `text[]` | no | `'{}'` | `"in_app"`, `"email"`, `"push"` |
| `created_at` | `timestamp` | no | `now()` | |

#### `push_tokens`

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` PK | no | `gen_random_uuid()` | |
| `user_id` | `uuid` FK → `profiles.id` | no | — | CASCADE delete |
| `token` | `text` | no | — | Device push token |
| `platform` | `varchar(20)` | no | — | `"ios"`, `"android"`, `"web"` |
| `created_at` | `timestamp` | no | `now()` | |
| `updated_at` | `timestamp` | no | `now()` | |

UNIQUE constraint on `(user_id, token)`.

#### `ai_conversations` (Phase 3 scaffold — DO NOT MODIFY)

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` PK | no | `gen_random_uuid()` | |
| `household_id` | `uuid` FK → `households.id` | no | — | CASCADE delete |
| `user_id` | `uuid` FK → `profiles.id` | no | — | CASCADE delete |
| `assistant_persona` | `varchar(10)` | no | `'rosie'` | |
| `title` | `varchar(255)` | yes | null | |
| `metadata` | `jsonb` | yes | `{}` | |
| `created_at` | `timestamp` | no | `now()` | |
| `updated_at` | `timestamp` | no | `now()` | |

#### `ai_messages` (Phase 3 scaffold — DO NOT MODIFY)

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` PK | no | `gen_random_uuid()` | |
| `conversation_id` | `uuid` FK → `ai_conversations.id` | no | — | CASCADE delete |
| `role` | `varchar(20)` | no | — | `"user"`, `"assistant"`, `"system"`, `"tool"` |
| `content` | `text` | no | — | |
| `tool_calls` | `jsonb` | yes | null | |
| `tool_results` | `jsonb` | yes | null | |
| `token_count` | `integer` | yes | null | |
| `created_at` | `timestamp` | no | `now()` | |

---
```

---


---

## 19. SECURITY CHECKLIST

### Pre-Launch Review

- [ ] `SUPABASE_SERVICE_ROLE_KEY` is NEVER in a `NEXT_PUBLIC_` variable
- [ ] Service role key only used in server-side code
- [ ] All tRPC mutations validate input with Zod
- [ ] All database queries go through RLS-protected Supabase client
- [ ] File uploads restricted by Storage policies (user's own folder only)
- [ ] Invite tokens are single-use and expire (7 days)
- [ ] `middleware.ts` redirects unauthed users from all dashboard routes
- [ ] No sensitive data logged to browser console in production
- [ ] CORS configured on Supabase
- [ ] Content Security Policy headers set in `next.config.js`
- [ ] Rate limiting on auth endpoints (Supabase default, verify)
- [ ] `household.removeMember` — front-end blocks removal of last admin `[v3 NEW]`
- [ ] `bills.amount` and `bill_payments.amount` are `numeric(10,2)` — always `parseFloat()` before arithmetic `[v3 NEW]`

### Rate Limiting `[v3 NEW]`

Supabase provides default rate limiting on auth endpoints. tRPC endpoints are currently unprotected against abuse. For Phase 1 launch, this is acceptable given the invite-only nature of household membership. For Phase 2, add rate limiting middleware to `householdProcedure` (e.g., 100 mutations per minute per user). Log this as tracked tech debt.

---

## 20. PERFORMANCE BUDGET

### Targets (Lighthouse, Desktop)

| Metric | Target |
|---|---|
| Performance | 90+ |
| Accessibility | 95+ |
| Best Practices | 95+ |
| SEO | 90+ |
| First Contentful Paint | < 1.5s |
| Largest Contentful Paint | < 2.5s |
| Total Blocking Time | < 200ms |

### Route-Level Bundle Budget `[v3 NEW]`

| Route | Max JS Bundle (gzipped) | Notes |
|---|---|---|
| `/dashboard` | 120KB | Stat cards + 4 widgets |
| `/tasks` | 150KB | Includes @dnd-kit |
| `/shopping` | 100KB | Lightweight two-panel |
| `/finances` | 100KB | Cards + drawer |
| `/calendar` | 200KB | FullCalendar is ~180KB — must use `dynamic()` |
| `/contacts` | 100KB | Cards + drawer |
| `/settings` | 120KB | Tabs + avatar upload |

Measure with `next build` + `@next/bundle-analyzer`. If any route exceeds its budget, investigate and split.

### Optimization Checklist

- [ ] All routes have `loading.tsx`
- [ ] FullCalendar loaded via `dynamic()` import with `{ ssr: false }`
- [ ] Images use `next/image`
- [ ] Only specific Lucide icons imported (not the barrel export)
- [ ] TanStack Query `staleTime` configured (5 minutes for lists, 1 minute for counts)
- [ ] Bundle analyzed — no unexpected large chunks
- [ ] Character SVGs optimized (SVGO)
- [ ] Glass-morphism `backdrop-filter` degrades on low-power devices
- [ ] `numeric(10,2)` amounts parsed once and cached, not re-parsed on every render `[v3 NEW]`

### Enforcement `[v3 NEW]`

Performance budgets are checked during Sprint 5E. If any page scores below 90 on Lighthouse Performance, it is a launch blocker. The CI pipeline does not enforce Lighthouse scores automatically in Phase 1, but this should be added in Phase 2 via Lighthouse CI GitHub Action.

---

## 21. DEPLOYMENT PLAN

### 21.1 Supabase Cloud Setup

Create project at `supabase.com/dashboard`. Note URL, anon key, service role key, connection pooler URL. Apply migration: `supabase link --project-ref <ref>` → `supabase db push`. Create `avatars` storage bucket (public). Verify RLS policies active. Configure auth: site URL, redirect URLs (`https://yourdomain.com/api/auth/callback`). Customize email templates with Orbyt branding. Enable Realtime for `shopping_items`, `tasks`, `events`, `notifications`.

### 21.2 Vercel Setup

Import from GitHub. Root directory: `apps/web`. Build: `cd ../.. && pnpm turbo build --filter=@orbyt/web`. Install: `pnpm install`. Set all production env vars from Section 3.

### 21.3 Rollback & Backup Strategy `[v3 NEW]`

**Database Backups:** Supabase Cloud provides automatic daily backups on Pro plans. For the Free plan, run `pg_dump` manually before each migration: `supabase db dump -f backup-$(date +%Y%m%d).sql`. Store backups in a private S3 bucket or local encrypted drive. Before any production migration, take a manual backup.

**Migration Rollback:** Every new migration file in `supabase/migrations/` must have a corresponding rollback comment block at the top of the file documenting the SQL to reverse the changes. Example:

```sql
-- ROLLBACK:
-- ALTER TABLE bills DROP COLUMN IF EXISTS new_column;
-- DROP INDEX IF EXISTS idx_bills_new_column;

-- MIGRATION:
ALTER TABLE bills ADD COLUMN new_column text;
CREATE INDEX idx_bills_new_column ON bills(new_column);
```

For Phase 1, there is only one migration (`001_initial_schema.sql`), so rollback means recreating the database from scratch with `supabase db reset`. For subsequent migrations, always test rollback SQL in local Supabase before applying to production.

**Vercel Rollback:** Vercel supports instant rollback to any previous deployment via the dashboard. If a deployment breaks production, roll back immediately via Vercel → Deployments → select previous successful deploy → "Promote to Production." This takes effect within seconds.

**Incident Protocol:** If a production issue is discovered: (1) Roll back Vercel deployment if it's a code issue. (2) If it's a data issue, assess whether the database backup needs restoration. (3) Post a brief incident summary in the project channel. (4) Create a GitHub issue tagged `incident` with root cause and prevention steps.

### 21.4 Post-Deploy Verification

- [ ] Registration works (real email confirmation via Supabase)
- [ ] Login works
- [ ] Dashboard loads with data
- [ ] All 6 feature pages functional
- [ ] Real-time works between two browser tabs
- [ ] Theme switching persists across page reloads
- [ ] PWA installs on mobile (test on real device)
- [ ] No console errors in production
- [ ] Sentry receives test error (throw a test error, verify it appears in Sentry dashboard)
- [ ] Invite link flow works end-to-end (copy link → open in incognito → register → join household)

### 21.5 Monitoring

Vercel Analytics (automatic with deployment). Sentry error tracking + performance monitoring. Supabase Dashboard for DB size, auth events, API usage, Realtime connections. Set up Sentry alerts for error rate spikes (>10 errors in 5 minutes).

### 21.6 Cost Estimation `[v3 NEW]`

| Scale | Supabase Tier | Vercel Tier | Estimated Monthly Cost |
|---|---|---|---|
| 1-50 households (launch) | Free | Free | $0 |
| 50-500 households | Pro ($25/mo) | Pro ($20/mo) | ~$45/mo |
| 500-5,000 households | Pro | Pro | ~$45-100/mo (bandwidth) |
| 5,000+ households | Team ($599/mo) | Enterprise | $600+/mo |

**Supabase Free Tier Limits to Watch:** 500MB database, 1GB file storage, 2GB bandwidth, 50,000 monthly active users, 500MB Realtime message throughput. The most likely first limit to hit is file storage (avatar uploads). At ~100KB per avatar photo × 1,000 users = 100MB. Comfortable within limits until ~5,000 users with photos.

**Vercel Free Tier Limits:** 100GB bandwidth, 100 hours serverless function execution, 6,000 minutes build time. Comfortable for Phase 1 launch.

---

## 22. AI INTEGRATION ROADMAP (Phase 3+)

> **⛔ PHASE BOUNDARY REMINDER:** This section exists for planning visibility and architectural awareness ONLY. No development time should be spent on Phase 3 during the current sprint plan. The AI schema tables (`ai_conversations`, `ai_messages`) already exist in the database and should not be modified.

### 22.1 Vision

Rosie and Eddie evolve from static mascot illustrations into fully interactive AI assistants that household members can talk to — via text and eventually voice — to manage their family's life. The AI reads household data, takes actions on behalf of the user, learns family patterns, and proactively surfaces helpful suggestions. The end state is that a parent can say "Rosie, what do we need from the store?" and get a real answer pulled from their actual shopping list, or say "Add a dentist appointment for Tuesday at 2pm" and have it appear on the family calendar without ever opening a form.

### 22.2 Real-World Reference

Andrew Warner's "The Next New Thing" episode (February 17, 2026) featuring Joseph Zapiain's voice AI agent demonstrates the exact interaction model Orbyt is targeting.

Video: https://www.youtube.com/watch?v=b1Xh_C_mvaE — Relevant segment: 25:03–36:09 (voice agent for task management)

What the demo shows: A user calls a phone number and speaks naturally to an AI assistant connected to ClickUp and Google Calendar via Zapier's MCP integration. The user says things like "What's on my calendar today?" and the AI reads from and writes to actual productivity tools in real time.

Where Orbyt differs and improves: Orbyt's AI routes through LLM function calling → our own tRPC procedures → Supabase directly, eliminating the middleware layer. Lower latency, zero third-party dependency, deeper household context. Orbyt's interface is in-app with dual-channel feedback (visual + auditory) rather than voice-only over a phone call.

### 22.3 Phase 3A — Text Chat Interface

Slide-out chat panel. Character portrait with expression changes. Message bubbles. Action confirmation cards for write operations. Streaming via Vercel AI SDK. Function definitions mapped 1:1 to tRPC procedures. 20-message session memory (client-side). Estimated effort: 3-4 weeks.

### 22.4 Phase 3B — Voice Interface

Speech-to-text via Web Speech API or Deepgram. Text-to-speech via ElevenLabs with custom Rosie/Eddie voices. Same backend as 3A. Estimated effort: 1-2 weeks on top of 3A.

### 22.5 Phase 3C — Proactive Suggestions

Time-based and pattern-based triggers. Dashboard suggestion cards from AI persona. Scheduled function (Vercel Cron or Supabase Edge Function). Estimated effort: 2-3 weeks.

### 22.6 Phase 3D — Autonomous Actions

Granular permission toggles in Settings. Activity log with undo. Persistent memory. Estimated effort: 3-4 weeks.

### 22.7 Phase 1 Decisions Supporting Phase 3

AI persona selection during onboarding (built). Character illustrations with 5 expression variants (design team producing). Notification system (tRPC built). Conversational microcopy tone (Section 8.12). Right-side drawer pattern (Section 8.11). tRPC procedure layer with Zod validators (built — function definitions for the LLM are generated from these). AI schema tables already in database (scaffolded).

### 22.8 What We Are NOT Building

We are NOT building a general-purpose AI assistant — Rosie/Eddie only manages household data within Orbyt. We are NOT building an always-listening voice assistant — voice is tap-to-talk only, no wake word. We are NOT replacing the UI with AI — chat/voice is an alternative input method. We are NOT training a custom model — we use commercial LLM APIs with prompt engineering and function calling.

---

## 23. KNOWN ISSUES & TECH DEBT

| Issue | Status | Priority | Sprint | Notes |
|---|---|---|---|---|
| Resend email for invitations | Not wired | Medium | Sprint 5B (optional) | TODO at `household.ts`. Clipboard invite is the Phase 1 fallback. |
| Avatar upload | Not built | Medium | Sprint 4F | Storage bucket needs creation |
| PWA icons | Missing | Medium | Sprint 5C | 192/512 PNGs don't exist |
| Theme persistence | Not wired in UI | Medium | Sprint 4F | CSS ready, settings UI needed |
| Invite acceptance page | Not built | High | Sprint 5A | `/invite/[token]` empty |
| No service worker | Not built | Low | Sprint 5C | PWA won't install properly |
| No tests | Not built | High | Sprint 0K + 5G | Zero coverage |
| No CI pipeline | Not built | High | Sprint 0F | No checks on PR |
| No error tracking | Not built | Medium | Sprint 5D | No Sentry |
| No database seeds | Not built | High | Sprint 0D | Empty DB for new devs |
| No `.env.local.example` | Missing | High | Sprint 0E | Must read docs to set up |
| Mobile navigation | Not built | High | Sprint 0H | No bottom tab bar |
| Rosie/Eddie illustrations | Not created | High | Sprint 0I (placeholders) | Design team producing finals |
| Illustrated user avatars | Not created | Medium | Sprint 4F (placeholders) | Design team deliverable |
| Font not yet Urbanist | Not implemented | Medium | Sprint 0 | Currently system font |
| FullCalendar bundle size | Risk | Medium | Sprint 4D | Must use `dynamic()` import |
| `profiles.theme` default mismatch | Note | Low | Sprint 4F | DB default is `"cosmic"`, should map to `"orbit"` |
| `removeMember` no last-admin check | Bug risk | High | Sprint 4F | Front-end must enforce |
| `bills.amount` is string from Drizzle | Gotcha | Medium | Sprint 4C | Must `parseFloat()` before arithmetic |
| `getMonthlyOverview` payment join | Bug risk | Medium | Sprint 4C | Uses `bills.id` in where clause for `billPayments` which may not work as expected for cross-table filtering — verify at runtime |
| No rate limiting on tRPC | Tech debt | Low | Phase 2 | Acceptable for launch |
| No structured logging | Tech debt | Low | Phase 2 | See Section 25 |
| No product analytics | Tech debt | Medium | Phase 2 | No usage metrics |
| No offline PWA support | Tech debt | Low | Phase 2 | Shopping lists are the key offline use case |
| No first-run onboarding tour | Tech debt | Low | Phase 2 | Empty dashboard may confuse new users |
| `calendar.update` recurrence exceptions | Incomplete | Low | Phase 2 | "this" and "this_and_future" modes have TODO |
| AI schema tables exist but unused | Intentional | N/A | Phase 3 | `ai_conversations`, `ai_messages` — do not modify |
| Mobile app | Phase 2 | N/A | — | `apps/mobile/` empty |

---

## 24. LEGAL & COMPLIANCE FLAGS `[v3 NEW — ENTIRE SECTION]`

> **This section flags compliance considerations that require legal review before public launch. It does not constitute legal advice.**

### Data Categories Collected

Orbyt collects the following categories of personal data: email addresses, display names, profile photos, household financial data (bill names and amounts), birthday and anniversary dates, phone numbers, physical addresses, and social media handles. If household members include children (the schema supports a `"child"` role), the app collects data about minors.

### Applicable Regulations (Assessment Needed)

**COPPA (Children's Online Privacy Protection Act):** If the app is used by or collects data about children under 13 in the United States, COPPA applies. The `"child"` member role implies this is likely. Legal counsel should assess whether parental consent mechanisms are needed and whether the current data collection practices comply.

**GDPR (General Data Protection Regulation):** If any users are in the EU/EEA. Requires consent for data processing, right to data export, right to deletion, and a privacy policy. The `contacts` table stores third-party personal data (people who haven't consented to being in the app), which adds complexity.

**CCPA (California Consumer Privacy Act):** If any users are California residents. Requires disclosure of data collection practices and right to deletion.

### Minimum Actions Before Public Launch

A privacy policy page must exist at `/privacy` explaining what data is collected, how it's stored, and how to request deletion. A terms of service page must exist at `/terms`. The registration flow should include a checkbox linking to both documents. Legal review of the above regulations should be completed. A data deletion workflow should be documented (even if manual for Phase 1): what happens when a user requests account deletion? All `profiles`, `household_members`, and associated data must be removable.

### Phase 1 Launch Decision

If the initial launch is limited to a closed beta (invite-only, known users), the compliance risk is low and launch can proceed while legal review is in progress. If the launch is public, legal review must be completed first.

---

## 25. OBSERVABILITY & LOGGING `[v3 NEW — ENTIRE SECTION]`

### Phase 1 (Launch Minimum)

**Client-Side Error Tracking:** Sentry (`@sentry/nextjs`) captures unhandled exceptions, React rendering errors, and tRPC errors. Configured in Sprint 5D. Source maps uploaded to Sentry during build.

**Server-Side Logging:** Next.js API routes log to Vercel's built-in log stream (stdout/stderr). tRPC error formatter includes Zod validation details. For Phase 1, `console.error()` in tRPC error handlers is sufficient — Vercel captures these.

**Supabase Dashboard:** Monitor database size, query performance, auth events, and Realtime connection count. Check weekly during initial launch period.

### Phase 2 (Post-Launch Improvement)

**Structured Logging:** Replace `console.error` with a structured logger (e.g., `pino`) that outputs JSON with correlation IDs. Each tRPC request should carry a `requestId` (UUID generated in the context factory) that appears in all log entries for that request. This enables tracing a user-reported issue ("my shopping list items disappeared") from the front-end error → Sentry event → server log → database query.

**Product Analytics:** Integrate PostHog or Mixpanel with 10 key events:

| Event | Trigger |
|---|---|
| `user_registered` | Registration complete |
| `household_created` | Household creation |
| `member_invited` | Invite sent |
| `task_created` | Task mutation success |
| `task_completed` | Status changed to "done" |
| `shopping_item_checked` | Item checked |
| `bill_marked_paid` | Payment recorded |
| `event_created` | Calendar event created |
| `contact_created` | Contact added |
| `theme_changed` | Theme selection in settings |

These 10 events provide enough signal to understand feature adoption, retention, and engagement patterns.

---

## 26. CLAUDE CODE DEVELOPMENT ENVIRONMENT `[v3 NEW — ENTIRE SECTION]`

> **This section defines the complete configuration for developing Orbyt using Claude Code Agent Teams. It includes the CLAUDE.md file, agent definitions, skills, hooks, and orchestration plan. The Claude Code team lead should read this section in its entirety before beginning work.**

### 26.1 Agent Skill Requirements

The Claude Code agents working on this project need the following technical competencies. These aren't optional nice-to-haves — an agent lacking any of these will produce code that appears correct but fails at runtime.

**Next.js 15 App Router:** Understanding of React Server Components vs Client Components, the `"use client"` directive, `app/` directory routing with route groups `(auth)` and `(dashboard)`, `layout.tsx` / `page.tsx` / `loading.tsx` conventions, `metadata` exports for SEO, and the `dynamic()` function for code splitting. The critical pattern is that `page.tsx` is always a Server Component that renders a `*-content.tsx` Client Component. Agents must never put `"use client"` in a `page.tsx` file or use React hooks in a Server Component.

**tRPC v11:** Router definitions, the 4-tier procedure chain (`publicProcedure` → `protectedProcedure` → `householdProcedure` → `adminProcedure`), `useQuery`/`useMutation` hooks, `inferRouterOutputs<AppRouter>` for type extraction, cache invalidation via `trpc.useUtils()`. The critical pattern is that every mutation's `onSuccess` must invalidate the relevant query cache, and types must be derived from the router output — never manually typed or inferred from hook return types.

**TanStack Query v5:** Query lifecycle (`isLoading`, `data`, `error`), cache invalidation patterns, `staleTime` configuration, and the relationship between tRPC hooks and TanStack Query under the hood.

**Tailwind CSS v3 with CSS Variable Theming:** Not just standard utility classes, but the custom `var(--color-*)` system where `bg-bg`, `text-accent`, `border-border` etc. resolve to theme-specific CSS variables. Agents must use the semantic color tokens (`bg-bg`, `bg-surface`, `text-text`, `text-text-secondary`, `text-accent`, `bg-accent`, `border-border`) and never hardcode colors like `bg-slate-900`.

**Drizzle ORM (read-only):** Agents need to read and understand the schema files in `packages/db/src/schema/` to know what columns and types are available, but must never modify schema files. Understanding that `numeric(10,2)` columns return strings from Drizzle (requiring `parseFloat()`) is critical.

**Supabase:** Browser client creation via `createBrowserClient()`, Realtime channel subscriptions using `postgres_changes`, the `useEffect` cleanup pattern for channel removal, and understanding that RLS policies enforce household data isolation at the database level.

**Framer Motion:** The specific animation patterns from Section 8.8 — `motion.div` with `initial`/`animate`/`exit`/`transition`, `AnimatePresence` for exit animations, spring transitions for drawers, stagger children for lists. Agents must also respect `prefers-reduced-motion`.

**Radix UI Primitives:** Dialog, AlertDialog, Tabs, DropdownMenu, Select. These provide accessible foundations that handle focus trapping, keyboard navigation, and ARIA attributes. Agents should use Radix for all modal/dropdown/select interactions rather than building custom ones.

**Turborepo Monorepo:** Workspace resolution (`pnpm --filter @orbyt/web`), cross-package imports (`import { something } from "@orbyt/shared/utils"`), and understanding that `pnpm turbo typecheck` runs across all packages.

**Playwright (QA agent only):** Browser context creation, page navigation, element selectors, assertion patterns, multi-context testing for real-time features, viewport configuration.

### 26.2 CLAUDE.md (Root Project File)

Create this file at the repository root (`/CLAUDE.md`):

# Orbyt — Claude Code Project Instructions

## Project Overview
Orbyt is a household management PWA (family CRM). Monorepo with Turborepo + pnpm.
Tech stack: Next.js 15 App Router, tRPC v11, TanStack Query v5, Tailwind CSS 3, Drizzle ORM, Supabase (Postgres + Auth + Realtime + Storage), Framer Motion, Radix UI, TypeScript 5.7+ strict.

## Critical Commands
- `pnpm install` — install all dependencies
- `pnpm --filter @orbyt/web dev` — start dev server at localhost:3000
- `pnpm turbo typecheck` — typecheck ALL packages (run after every set of changes)
- `pnpm --filter @orbyt/web test:e2e` — run Playwright E2E tests
- `supabase start` — start local Supabase (Docker required)
- `supabase status` — show local Supabase URLs + keys

## Architecture Rules (MUST FOLLOW)
1. **Page pattern:** `page.tsx` is ALWAYS a React Server Component. It exports `metadata` and renders a single `*-content.tsx` Client Component. NEVER put `"use client"` in `page.tsx`. NEVER use hooks in `page.tsx`.
2. **tRPC types:** ALWAYS use `inferRouterOutputs<AppRouter>` for types. NEVER use `NonNullable<ReturnType<typeof trpc.xxx.useQuery>["data"]>`.
3. **Mutations:** ALWAYS invalidate the relevant query cache in `onSuccess`. ALWAYS show a toast on success and error.
4. **Styling:** ALWAYS use semantic theme tokens (`bg-bg`, `bg-surface`, `text-text`, `text-accent`, `border-border`). NEVER hardcode colors.
5. **Border radius:** Minimum 8px (`rounded-lg`). Cards use `rounded-2xl`. Buttons use `rounded-xl`.
6. **Animations:** Use Framer Motion patterns from the project bible Section 8.8. Respect `prefers-reduced-motion`.
7. **Accessibility:** All interactive elements keyboard-accessible. Inputs have labels. Icon-only buttons have `aria-label`. Touch targets 44x44px on mobile.
8. **TypeScript:** Strict mode. No `any`. No `@ts-ignore` except with a comment explaining why.
9. **Glass-morphism:** Use `.glass-card`, `.glass-card-elevated`, `.glass-card-subtle` classes. Do not invent new glass effects.
10. **Realtime:** Use `useRealtimeInvalidation` hook from `hooks/use-realtime.ts` for tables: `shopping_items`, `tasks`, `events`, `notifications`.

## File Boundaries (Feature Agents)
Feature agents (Sprint 4B-4F) can ONLY create/modify files in:
- `apps/web/app/(dashboard)/[their-feature]/` (e.g., `shopping/`)
- `apps/web/components/[their-feature]/` (e.g., `components/shopping/`)

Feature agents CANNOT modify:
- `app/(dashboard)/layout.tsx`, `components/sidebar.tsx`, `components/dashboard-header.tsx`
- `components/providers.tsx`, `components/household-guard.tsx`
- `middleware.ts`, `globals.css` (except adding new classes at END of file)
- Anything in `packages/` (api, db, shared, config, ui)
- `CLAUDE.md`, `.claude/`, root config files

## Numeric Gotcha
`bills.amount` and `bill_payments.amount` are `numeric(10,2)` in Postgres. Drizzle returns these as STRINGS. Always `parseFloat()` before arithmetic or display formatting.

## Shopping Router Field Names
`shopping.checkItem` expects `{ itemId, checked }` — NOT `{ id, checked }`.
`shopping.deleteItem` expects `{ itemId }` — NOT `{ id }`.

## Finances Router Input
`finances.getMonthlyOverview` expects `{ month: "YYYY-MM" }` — NOT `{ month, year }`.
`finances.deleteBill` is a SOFT DELETE (sets `isActive: false`). Label the button "Archive".

## Household Members Response Shape
`household.getCurrent` returns members with nested profiles:
`member.profile.displayName` — NOT `member.displayName`.

## Theme Default
`profiles.theme` defaults to `"cosmic"` in the database. Map `"cosmic"` → `"orbit"` in the UI.

## Placeholder Assets
Character illustrations (Rosie/Eddie) use placeholder SVGs until the design team delivers finals. Use the files in `public/characters/` as-is. Do not create new character artwork.
```

### 26.3 Subagent Definitions

Create these files in `.claude/agents/`:

#### `.claude/agents/feature-builder.md`

---
name: feature-builder
description: Builds Orbyt feature pages following established patterns. Use for Shopping, Finances, Calendar, Contacts, and Settings pages.
tools: Read, Write, Edit, Bash, Grep, Glob
model: opus
---

You are building a feature page for the Orbyt household management app.

BEFORE writing any code:
1. Read the CLAUDE.md at the project root for architecture rules.
2. Read the existing completed feature for reference: `apps/web/components/tasks/tasks-content.tsx` and `apps/web/app/(dashboard)/tasks/page.tsx`.
3. Read the relevant tRPC router in `packages/api/src/routers/` to understand the exact procedure signatures and return types.
4. Read the Drizzle schema in `packages/db/src/schema/` to understand the column types.

ALWAYS follow this file pattern:
- `app/(dashboard)/[feature]/page.tsx` — Server Component, exports metadata, renders Content component
- `components/[feature]/[feature]-content.tsx` — Client Component with "use client", all logic here
- Additional components in `components/[feature]/` as needed (drawers, modals, sub-panels)

ALWAYS implement these states:
- Loading: skeleton UI with `animate-pulse bg-surface rounded-2xl`
- Empty: character illustration + headline + subtext + CTA (use EmptyState component)
- Error: friendly message + "Try Again" button
- Loaded: the actual feature UI

After implementing, run:
1. `pnpm turbo typecheck` — must pass with zero errors
2. Verify the page renders at localhost:3000 (if dev server is running)

Do NOT modify any files outside your feature's directories. If you need a shared component change, document it and stop.
```

#### `.claude/agents/e2e-tester.md`

---
name: e2e-tester
description: Writes and runs Playwright E2E tests for Orbyt. Use for testing feature flows at desktop and mobile viewports.
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
---

You are writing Playwright E2E tests for the Orbyt household management app.

Test files go in: `apps/web/e2e/`
Config file: `apps/web/playwright.config.ts`

ALWAYS test at two viewports:
- Desktop: { width: 1280, height: 800 }
- Mobile: { width: 375, height: 667 }

Seed data users:
- Admin: demo@orbyt.app / password123
- Member: member@orbyt.app / password123

Test patterns:
- Use `page.goto()` for navigation
- Use `page.getByRole()`, `page.getByText()`, `page.getByLabel()` for selectors (accessible selectors preferred)
- Use `expect(page.getByText('...')).toBeVisible()` for assertions
- For real-time tests, create two `browser.newContext()` instances

Run tests with: `pnpm --filter @orbyt/web test:e2e`
```

#### `.claude/agents/qa-reviewer.md`

---
name: qa-reviewer
description: Reviews Orbyt code for quality, accessibility, type safety, and adherence to project patterns. Use after feature implementation.
tools: Read, Grep, Glob, Bash
model: opus
---

You are reviewing code for the Orbyt household management app.

Check for:
1. **Pattern adherence:** page.tsx is Server Component, content.tsx is Client Component, types use inferRouterOutputs
2. **Type safety:** no `any`, no `@ts-ignore`, no manual type assertions where inferRouterOutputs works
3. **Accessibility:** all inputs have labels, icon buttons have aria-label, touch targets >= 44px, keyboard navigable
4. **Theme compliance:** only semantic color tokens used (bg-bg, text-accent, etc.), no hardcoded colors
5. **Error handling:** all mutations have onError with toast, queries have error states, no raw error messages shown to user
6. **Animation:** Framer Motion used correctly, prefers-reduced-motion respected
7. **tRPC field names:** verify shopping uses `itemId` not `id`, finances uses `month: "YYYY-MM"`, household members accessed as `member.profile.displayName`
8. **Numeric handling:** bills.amount parsed with parseFloat() before arithmetic
9. **Real-time:** useRealtimeInvalidation used for shopping_items, tasks, events
10. **Mobile responsive:** check for md: breakpoint usage, no fixed widths that break at 375px

Run `pnpm turbo typecheck` and report any errors.

Provide a structured report:
- PASS: things that look correct
- WARN: things that might cause issues
- FAIL: things that must be fixed before merge
```

### 26.4 Skills

Create these files in `.claude/skills/`:

#### `.claude/skills/orbyt-trpc-pattern/SKILL.md`

---
name: orbyt-trpc-pattern
description: How to use tRPC queries and mutations in Orbyt Client Components
---

# tRPC Usage in Orbyt

## Querying data
```tsx
"use client";
import { trpc } from "@/lib/trpc/client";
import type { AppRouter } from "@orbyt/api";
import type { inferRouterOutputs } from "@trpc/server";

type RouterOutput = inferRouterOutputs<AppRouter>;
type Bill = RouterOutput["finances"]["listBills"][number];

export function MyComponent() {
  const { data, isLoading, error } = trpc.finances.listBills.useQuery();
  // Handle all three states: isLoading, error, data
}
```

## Mutating data
```tsx
const utils = trpc.useUtils();
const mutation = trpc.finances.markPaid.useMutation({
  onSuccess: () => {
    utils.finances.listBills.invalidate();
    utils.finances.getMonthlyOverview.invalidate();
    toast.success("Bill marked as paid");
  },
  onError: (error) => {
    toast.error(error.message || "Something went wrong");
  },
});
```

## Key rules
- NEVER manually type API responses. Use `inferRouterOutputs<AppRouter>`.
- ALWAYS invalidate related queries on mutation success.
- ALWAYS show toast on success and error.
- Use `mutation.isPending` to disable submit buttons.
```

#### `.claude/skills/orbyt-page-pattern/SKILL.md`

---
name: orbyt-page-pattern
description: How to create a new feature page in Orbyt
---

# Feature Page Pattern

## Step 1: Server Component page
```tsx
// app/(dashboard)/[feature]/page.tsx
import { Metadata } from "next";
import { FeatureContent } from "@/components/[feature]/[feature]-content";

export const metadata: Metadata = {
  title: "Feature Name — Orbyt",
};

export default function FeaturePage() {
  return <FeatureContent />;
}
```

## Step 2: Client Component content
```tsx
// components/[feature]/[feature]-content.tsx
"use client";
import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { motion } from "framer-motion";
import { EmptyState } from "@/components/ui/empty-state";

export function FeatureContent() {
  const { data, isLoading, error } = trpc.someRouter.someQuery.useQuery();

  if (isLoading) return <FeatureSkeleton />;
  if (error) return <FeatureError error={error} />;
  if (!data || data.length === 0) return (
    <EmptyState
      character="rosie" // or "eddie" based on user persona
      expression="happy"
      title="Empty state headline"
      description="Helpful subtext"
      actionLabel="CTA Button"
      onAction={() => setDrawerOpen(true)}
    />
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {/* Page content */}
    </motion.div>
  );
}
```

## Step 3: Loading skeleton
```tsx
// app/(dashboard)/[feature]/loading.tsx
export default function FeatureLoading() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-48 animate-pulse bg-surface rounded-2xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse bg-surface rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
```
```

#### `.claude/skills/orbyt-realtime-pattern/SKILL.md`

---
name: orbyt-realtime-pattern
description: How to set up Supabase Realtime subscriptions in Orbyt
---

# Realtime Subscription Pattern

## Using the hook
```tsx
import { useRealtimeInvalidation } from "@/hooks/use-realtime";
import { trpc } from "@/lib/trpc/client";

export function ShoppingContent() {
  const utils = trpc.useUtils();
  const { data } = trpc.shopping.listItems.useQuery({ listId: selectedListId });

  // Invalidate the query when any shopping_items row changes for this list
  useRealtimeInvalidation(
    "shopping_items",
    selectedListId ? { column: "list_id", value: selectedListId } : undefined,
    () => utils.shopping.listItems.invalidate({ listId: selectedListId })
  );
}
```

## Tables with Realtime enabled
- `shopping_items` — filter by `list_id`
- `tasks` — filter by `household_id`
- `events` — filter by `household_id`
- `notifications` — filter by `user_id`

## Rules
- ALWAYS clean up subscriptions in useEffect return
- ALWAYS filter by the most specific column to reduce noise
- The hook handles cleanup automatically
```

#### `.claude/skills/orbyt-ui-pattern/SKILL.md`

---
name: orbyt-ui-pattern
description: Orbyt UI component patterns — glass cards, drawers, buttons, form inputs
---

# UI Patterns

## Glass card
```tsx
<div className="glass-card rounded-2xl p-6">
  {/* Card content */}
</div>
```
Variants: `.glass-card` (standard), `.glass-card-elevated` (dropdowns), `.glass-card-subtle` (inputs), `.glass-card-active` (selected state).

## Drawer
```tsx
import { Drawer } from "@/components/ui/drawer";

<Drawer open={isOpen} onClose={() => setIsOpen(false)} title="Drawer Title">
  {/* Drawer content */}
</Drawer>
```

## Buttons
```tsx
// Primary action
<button className="orbyt-button-accent">Add Task</button>
// Secondary action
<button className="orbyt-button-ghost">Cancel</button>
```

## Form inputs
```tsx
<label className="orbyt-label">Field Name</label>
<input className="orbyt-input" />
```

## Confirm dialog
```tsx
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

<ConfirmDialog
  open={showConfirm}
  onConfirm={handleDelete}
  onCancel={() => setShowConfirm(false)}
  title="Delete this item?"
  description="This action cannot be undone."
  confirmLabel="Delete"
  variant="destructive"
/>
```

## Page layout pattern
```tsx
<div className="space-y-6">
  {/* Page header */}
  <div className="flex items-center justify-between">
    <h1 className="text-[28px] font-bold text-text">Page Title</h1>
    <button className="orbyt-button-accent">Action</button>
  </div>

  {/* Content */}
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {/* Cards */}
  </div>
</div>
```
```

#### `.claude/skills/orbyt-theme-system/SKILL.md`

---
name: orbyt-theme-system
description: How the Orbyt CSS variable theme system works
---

# Theme System

## How it works
Themes are set via `data-theme` attribute on `<html>`.
Each theme defines CSS variables in `globals.css`.
Tailwind config maps these variables to utility classes.

## Semantic tokens (ALWAYS use these)
| Token | CSS Variable | Usage |
|---|---|---|
| `bg-bg` | `--color-bg` | Page background |
| `bg-surface` | `--color-surface` | Card/panel background |
| `text-text` | `--color-text` | Primary text |
| `text-text-secondary` | `--color-text-secondary` | Secondary/muted text |
| `text-accent` / `bg-accent` | `--color-accent` | Primary accent color |
| `border-border` | `--color-border` | Borders and dividers |

## Structural colors (same across all themes)
- Success: `text-green-500` / `bg-green-500`
- Warning: `text-amber-500` / `bg-amber-500`
- Danger: `text-red-500` / `bg-red-500`
- Info: `text-blue-500` / `bg-blue-500`

## NEVER do this
```tsx
// BAD — hardcoded colors
<div className="bg-slate-900 text-white">

// GOOD — semantic tokens
<div className="bg-bg text-text">
```

## Changing theme in code
```tsx
document.documentElement.setAttribute('data-theme', 'aurora');
```
```

### 26.5 Hooks Configuration

Create `.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "pnpm turbo typecheck --filter=@orbyt/web 2>&1 | tail -20"
          }
        ]
      }
    ]
  }
}
```

This runs typecheck after every file write/edit, catching type errors immediately rather than at the end of a session.

### 26.6 Agent Team Orchestration Plan

#### Phase 1: Sprint 0 (Foundation)

Run as a single Claude Code session (no team needed). The lead developer (or a single agent) completes all Sprint 0 tasks sequentially, since many are interdependent (e.g., shared UI components must exist before feature pages reference them).

```bash
cd Orbyt
claude
# Then describe the Sprint 0 work with full context from this bible
```

Verify all Sprint 0 acceptance criteria pass before proceeding.

#### Phase 2: Feature Sprints (4B–4F in Parallel)

After Sprint 0 is merged to `main`, start the agent team:

```
Create an agent team to build 5 feature pages in parallel.
Each teammate works in its own git worktree to avoid file conflicts.

Teammate 1 — Shopping (Sprint 4B):
- Worktree: sprint-4b-shopping
- Scope: apps/web/app/(dashboard)/shopping/ and apps/web/components/shopping/
- Reference: Section 12 Sprint 4B specs, Section 17.1 Shopping Router API
- Acceptance criteria from Sprint 4B

Teammate 2 — Finances (Sprint 4C):
- Worktree: sprint-4c-finances
- Scope: apps/web/app/(dashboard)/finances/ and apps/web/components/finances/
- Reference: Section 12 Sprint 4C specs, Section 17.2 Finances Router API
- Acceptance criteria from Sprint 4C

Teammate 3 — Calendar (Sprint 4D):
- Worktree: sprint-4d-calendar
- Scope: apps/web/app/(dashboard)/calendar/ and apps/web/components/calendar/
- Must run: pnpm --filter @orbyt/web add @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction
- Reference: Section 12 Sprint 4D specs, Section 17.3 Calendar Router API
- Acceptance criteria from Sprint 4D

Teammate 4 — Contacts (Sprint 4E):
- Worktree: sprint-4e-contacts
- Scope: apps/web/app/(dashboard)/contacts/ and apps/web/components/contacts/
- Reference: Section 12 Sprint 4E specs, Section 17.4 Contacts Router API
- Acceptance criteria from Sprint 4E

Teammate 5 — Settings (Sprint 4F):
- Worktree: sprint-4f-settings
- Scope: apps/web/app/(dashboard)/settings/ and apps/web/components/settings/
- Reference: Section 12 Sprint 4F specs, Section 17.5 Household Router API
- Acceptance criteria from Sprint 4F

RULES FOR ALL TEAMMATES:
- Read CLAUDE.md before starting
- Read the completed Tasks feature (components/tasks/) as a reference implementation
- Read the actual tRPC router source code for your feature before coding
- Do NOT modify any files listed in CLAUDE.md as off-limits
- Run pnpm turbo typecheck after implementation — must pass
- Each teammate creates a PR to main when done
```

**Key orchestration notes:**

Sprint 4D (Calendar) takes longest (3 days estimated) due to FullCalendar integration and CSS theming. It can start first or the lead can check on it more frequently.

Sprint 4F (Settings) depends on Sprint 0J (clipboard invite utility) being in `main`. Ensure Sprint 0 is fully merged before starting the team.

Use 3-5 teammates maximum. The 5 feature sprints map naturally to 5 teammates, but if token costs are a concern, combine the two smallest (Contacts + Settings) into a single sequential teammate.

Use `delegate mode` (Shift+Tab) for the lead to prevent it from grabbing implementation tasks.

#### Phase 3: Sprint 5 (Polish + Deploy)

Run as a single session or a small 2-person team (one for invite flow + deploy, one for E2E tests + accessibility audit). This phase depends on all Sprint 4 branches being merged, so it must run after the feature team completes.

### 26.7 Git Worktree Commands Quick Reference

```bash
# Create worktrees for each feature sprint
claude -w sprint-4b-shopping    # Shopping agent
claude -w sprint-4c-finances    # Finances agent
claude -w sprint-4d-calendar    # Calendar agent
claude -w sprint-4e-contacts    # Contacts agent
claude -w sprint-4f-settings    # Settings agent

# Check worktree status
git worktree list

# Clean up after merge
git worktree remove .claude/worktrees/sprint-4b-shopping
```

### 26.8 Quality Gates

Before any feature branch is merged to `main`:

1. `pnpm turbo typecheck` passes with zero errors
2. The feature page renders correctly at `localhost:3000` (manual verification or screenshot)
3. All 4 required states implemented (loading, empty, error, loaded)
4. Mobile viewport (375px) doesn't break layout
5. All mutations show success/error toasts
6. Real-time works (where applicable — shopping, tasks)
7. No `any` types, no `@ts-ignore` without justification
8. No hardcoded colors (all theme tokens)
9. All interactive elements keyboard-accessible

These gates should be verified by the QA reviewer agent (`.claude/agents/qa-reviewer.md`) before the lead approves a merge.

---

## 27. GIT COMMIT HISTORY

```
f235458  Sprint 4A: Tasks feature page — Kanban board + list view
d00c984  Add standard Next.js TypeScript compiler options
a688be3  Sprint 3: wire dashboard to real tRPC data
f0c32b9  Wire dashboard widget buttons to feature pages
c581882  Fix 404: move dashboard page to correct /dashboard URL
c71b0e0  Fix migration: move household policies after household_members table
9976fc5  Wire household ID: auto-create on register, auto-select on login
<initial>  Monorepo scaffold + TypeScript fixes
```

---

## 28. USEFUL COMMANDS

```bash
# === LOCAL DEVELOPMENT ===
supabase start                          # Start Supabase (once per session)
supabase status                         # Show URLs + keys
supabase stop                           # Stop Supabase
pnpm --filter @orbyt/web dev            # Start Next.js at localhost:3000

# === TYPE CHECKING ===
pnpm --filter @orbyt/web typecheck      # Web app only
pnpm turbo typecheck                    # All packages

# === TESTING ===
pnpm --filter @orbyt/shared test        # Unit tests
pnpm --filter @orbyt/web test:e2e       # E2E tests (Playwright)
pnpm turbo test                         # All tests

# === DATABASE ===
supabase db push                        # Apply migrations
supabase db reset                       # Reset + re-seed
pnpm --filter @orbyt/db db:generate     # Generate migration from schema
pnpm --filter @orbyt/db db:seed         # Run TypeScript seed

# === SUPABASE STUDIO ===
# http://localhost:54323   — Tables, SQL, auth users
# http://localhost:54324   — Inbucket — local auth emails

# === BUILD ===
pnpm turbo build                        # Build all
pnpm --filter @orbyt/web build          # Build web only

# === LINTING ===
pnpm turbo lint                         # Lint all
pnpm turbo lint -- --fix                # Auto-fix

# === CLAUDE CODE ===
claude                                  # Start interactive session
claude -w sprint-4b-shopping            # Start in worktree
claude --resume                         # Resume previous session
claude --continue                       # Continue most recent
```

---

## 29. GLOSSARY

| Term | Definition |
|---|---|
| **Household** | A family group. All data scoped via RLS. |
| **RLS** | Row Level Security — Postgres access control by household. |
| **tRPC** | Type-safe API. Procedures callable from front-end with full type inference. |
| **Procedure tier** | Auth level: `public` → `protected` → `household` → `admin`. |
| **RSC** | React Server Component — renders on server. Page wrappers. |
| **Client Component** | `"use client"` directive. Interactivity, hooks, browser APIs. |
| **Drizzle ORM** | TypeScript ORM for schema + migrations. Queries via tRPC only. |
| **Glass-morphism** | Frosted-glass UI style. `.glass-card` class. |
| **RRULE** | Recurrence Rule (RFC 5545). Expanded server-side by `expandRecurringEvents()`. |
| **Googie** | Architectural/design style from the 1950s-60s space age. The Jetsons' visual DNA. |
| **Retro-futurism** | Aesthetic of past visions of the future. Orbyt's core design identity. |
| **Vibe** | User's selected theme/color palette. Chosen during onboarding. |
| **Rosie** | Female-presenting AI companion character. Warm, organized, nurturing. |
| **Eddie** | Male-presenting AI companion character. Upbeat, energetic, sporty. |
| **Sprint** | Unit of work. 4B-4F are independent and parallelizable. |
| **Agent Team** | Multiple Claude Code instances working in parallel with a shared task list. |
| **Worktree** | Git feature allowing separate working directories sharing the same repo. Used to isolate agent work. |
| **Subagent** | A specialized Claude Code instance with scoped tools and a custom system prompt. |
| **CLAUDE.md** | Root-level file that Claude Code reads at the start of every session. Project-level instructions. |
| **Skill** | Reusable knowledge document in `.claude/skills/` that Claude loads on demand. |
| **Soft delete** | Setting `isActive: false` instead of deleting the row. Used for `bills`. |
| **Placeholder asset** | Temporary geometric robot SVG used until the design team delivers final character illustrations. |

---

*END OF ORBYT PROJECT BIBLE v3.0*