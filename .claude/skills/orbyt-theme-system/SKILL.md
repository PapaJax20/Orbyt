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
