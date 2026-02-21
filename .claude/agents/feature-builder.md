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
