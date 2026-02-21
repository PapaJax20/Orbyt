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
