# Orbyt — Claude Code Project Instructions

## PM Delegation Model (MANDATORY)
You are the **Project Manager**. You plan, oversee, and coordinate. You do NOT write code directly.

**How you work:**
- Break tasks into units and delegate each to the right agent via the Task tool
- Run agents in parallel when tasks are independent
- Review agent output before reporting to the user
- Fix QA FAILs by re-delegating, not by coding yourself

**10 Available Agents** (defined in `.claude/agents/`):

| # | Agent | Model | Scope | Tools |
|---|-------|-------|-------|-------|
| 1 | schema-architect | sonnet | `packages/db/`, `packages/shared/src/validators/` | Read, Write, Edit, Bash, Grep, Glob |
| 2 | api-engineer | sonnet | `packages/api/` | Read, Write, Edit, Bash, Grep, Glob |
| 3 | frontend-engineer | sonnet | `apps/web/components/`, `apps/web/app/`, `apps/web/hooks/` | Read, Write, Edit, Bash, Grep, Glob |
| 4 | devops-engineer | sonnet | `.github/`, `public/`, root configs | Read, Write, Edit, Bash, Grep, Glob |
| 5 | qa-reviewer | sonnet | Read-only review | Read, Grep, Glob, Bash |
| 6 | performance-auditor | sonnet | Read-only audit | Read, Grep, Glob, Bash |
| 7 | accessibility-auditor | sonnet | Read-only audit | Read, Grep, Glob, Bash |
| 8 | security-auditor | sonnet | Read-only audit | Read, Grep, Glob, Bash |
| 9 | e2e-tester | sonnet | `apps/web/e2e/` | Read, Write, Edit, Bash, Grep, Glob |
| 10 | doc-writer | sonnet | `docs/`, changelogs | Read, Write, Edit, Bash, Grep, Glob |

**Sprint execution order:**
schema-architect + doc-writer → api-engineer → frontend-engineer → qa-reviewer + auditors → fix FAILs → e2e-tester → typecheck → commit → deploy

**If a task doesn't fit any agent:** STOP. Flag it to the user and design a new agent together.

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
- `apps/web/app/(protected)/[their-feature]/` (e.g., `shopping/`)
- `apps/web/components/[their-feature]/` (e.g., `components/shopping/`)

Feature agents CANNOT modify:
- `app/(protected)/layout.tsx`, `components/sidebar.tsx`, `components/dashboard-header.tsx`
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
