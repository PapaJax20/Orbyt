# Design Team Handoff: Orbyt UI/UX Integration Guide

## What This Document Is

This guide gives the design team everything needed to create UI/UX designs, style guides, and character assets that integrate seamlessly into the existing Orbyt codebase. Designs delivered following these specs can be implemented with minimal friction — mostly CSS variable changes and file swaps.

---

## 1. How the Theme System Works (Your Design Playground)

Orbyt uses **CSS custom properties** (variables) for all colors. The app supports **9 themes** (5 dark, 4 light) that users can switch in real-time. Every UI element references semantic tokens, never hardcoded colors.

**What this means for you:** Design using the semantic token names below. When you deliver a new color palette, we update ONE file (`globals.css`) and the entire app changes.

### Semantic Color Tokens

| Token Name | Purpose | Example (Cosmic theme) |
|---|---|---|
| `--color-bg` | Page background | `rgb(11, 25, 41)` — deep navy |
| `--color-bg-subtle` | Slightly raised background | `rgb(15, 34, 56)` |
| `--color-surface` | Card/panel background | `rgb(21, 45, 74)` |
| `--color-border` | Borders and dividers | `rgb(0, 212, 255)` — teal |
| `--color-text` | Primary text | `rgb(240, 248, 255)` — near white |
| `--color-text-muted` | Secondary/helper text | `rgb(200, 224, 240)` |
| `--color-accent` | Primary interactive elements (buttons, links, highlights) | `rgb(0, 212, 255)` — teal |
| `--color-accent-hover` | Accent hover state | `rgb(51, 220, 255)` |
| `--color-cta` | Call-to-action buttons | `rgb(255, 215, 0)` — gold |
| `--color-cta-hover` | CTA hover state | `rgb(255, 228, 77)` |

### Current 9 Themes

| Theme | Type | Background | Accent | CTA |
|---|---|---|---|---|
| **Cosmic** (default) | Dark | Deep navy | Teal | Gold |
| **Aurora** | Dark | Deep purple | Purple | Gold |
| **Nebula** | Dark | Deep indigo | Indigo | Gold |
| **Titanium** | Dark | Neutral gray | Silver | Teal |
| **Ember** | Dark | Warm brown | Orange | Gold |
| **Solar** | Light | Warm cream | Gold | Teal |
| **Aurora Light** | Light | Lavender white | Purple | Teal |
| **Titanium Light** | Light | Cool gray | Silver | Teal |
| **Ember Light** | Light | Warm peach | Orange | Teal |

**Deliverable format:** For new themes or palette changes, provide values for ALL 10 tokens per theme. We'll drop them into the CSS.

### Structural Colors (Theme-Agnostic — Don't Change Per Theme)

| Color | Usage |
|---|---|
| `green-400/500` | Success, completed tasks, positive balance |
| `red-400/500` | Error, destructive actions, overdue, negative balance |
| `orange-400` | High priority, warnings |
| `yellow-400` | Medium priority |
| `amber-500` | Warning states |
| `blue-400/500` | Info states |
| `purple-400` | Secondary accent |

---

## 2. Glass-Morphism Design System (3 Tiers)

All cards and surfaces use frosted-glass styling. There are 3 tiers:

### Tier 1: `.glass-card` (Primary Surfaces)
- **Use for:** Main content cards, drawers, modals
- Background: surface color at 65% opacity
- Backdrop blur: 16px
- Border: 1px solid border color at 15% opacity
- Shadow: `0 4px 24px rgba(0,0,0,0.3)` + `inset 0 1px 0 rgba(255,255,255,0.05)`
- Corner radius: 16px (1rem)

### Tier 2: `.glass-card-elevated` (Elevated Surfaces)
- **Use for:** Dropdowns, popovers, tooltips, mobile nav sheet
- Background: surface at 80% opacity
- Backdrop blur: 24px
- Border: border at 20% opacity
- Shadow: `0 8px 32px rgba(0,0,0,0.12)`

### Tier 3: `.glass-card-subtle` (Subtle Surfaces)
- **Use for:** Input fields, secondary panels, stat cards
- Background: surface at 40% opacity
- Backdrop blur: 8px
- Border: border at 10% opacity

**Deliverable format:** If redesigning cards, provide: background opacity %, blur radius, border opacity %, shadow values, corner radius.

---

## 3. Typography

- **Font:** Urbanist (Google Fonts) — weights 400, 500, 600, 700
- **Display headings:** `font-display` (Urbanist bold/semibold)
- **Body text:** `font-body` (Urbanist regular/medium)
- **Sizes used:** text-xs (12px), text-sm (14px), text-base (16px), text-lg (18px), text-xl (20px), text-2xl (24px), text-3xl (30px)
- **Labels:** text-sm, font-medium, uppercase, tracking-wider, text-muted

**Deliverable format:** If changing fonts, provide: Google Fonts URL or .woff2 files, weight mappings for display vs body.

---

## 4. Component Patterns (What Already Exists)

### Buttons (3 variants)
| Variant | Class | Visual | Use Case |
|---|---|---|---|
| **Primary CTA** | `.orbyt-button-primary` | Gold gradient, dark text, glow shadow | Main actions (Save, Create) |
| **Accent** | `.orbyt-button-accent` | Accent gradient, dark text, glow shadow | Secondary actions (Add, Edit) |
| **Ghost** | `.orbyt-button-ghost` | Surface background, muted text, subtle border | Tertiary actions (Cancel, Back) |

All buttons: rounded-xl, px-4 py-2.5, font-medium, hover lifts -1px with stronger shadow. Disabled: 60% opacity.

### Input Fields
- Class: `.orbyt-input`
- Rounded-xl corners, surface background at 50% opacity, thin border
- Focus: accent-colored border + 3px accent glow ring at 10% opacity

### Drawers (Side Panels)
- Desktop: Slides in from right, configurable width (default 480px)
- Mobile: Slides up from bottom as a sheet, drag-to-close gesture
- Spring animation: damping 30, stiffness 300
- Header: title + X close button
- Backdrop: semi-transparent black overlay

### Modals (Confirm Dialogs)
- Centered overlay, scale animation (95% → 100%)
- Backdrop: blur + black/50
- Two variants: default and destructive (red confirm button)

### Empty States
- Character illustration (Rosie or Eddie, full-body)
- Headline text + description
- Optional CTA button
- Centered layout with generous padding

### Cards (Content Containers)
- Glass-card styling with hover effect (lift + accent border glow)
- Responsive grid: 1 col → 2 col (sm) → 3 col (lg)
- Internal layout: icon/badge top-right, title, metadata, action buttons

---

## 5. Character Assets — Rosie & Eddie

### Current State
Placeholder geometric robot SVGs exist. Real character illustrations are needed.

### Requirements

**2 Characters:**
- **Rosie** — Warm, nurturing, organized personality
- **Eddie** — Efficient, direct, analytical personality

**5 Expressions Each:**
- `happy` — Default/greeting state
- `winking` — Playful/celebratory moments
- `thinking` — Loading/processing states
- `concerned` — Error/warning states
- `celebrating` — Success/achievement moments

**3 Formats Each:**
| Format | Size Target | Use Case |
|---|---|---|
| `avatar-{expression}.svg` | ~80px circle | User avatars, compact references |
| `portrait-{expression}.svg` | ~150px | Medium references, chat interface |
| `full-body-{expression}.svg` | ~200-300px tall | Empty states, onboarding, hero moments |

### File Naming Convention (MUST follow exactly)
```
/public/characters/rosie/avatar-happy.svg
/public/characters/rosie/avatar-winking.svg
/public/characters/rosie/portrait-thinking.svg
/public/characters/rosie/full-body-celebrating.svg
/public/characters/eddie/avatar-happy.svg
... (same pattern)
```

**Total: 30 SVG files** (2 characters × 5 expressions × 3 formats)

### Style Guidelines
- Should feel retro-futuristic (Jetsons-inspired, space-age optimism)
- Clean lines, friendly faces, approachable
- Work on both dark and light backgrounds (SVGs should have transparent backgrounds or work universally)
- Accent-colored elements are ideal (teal/gold highlights that match themes)

### Additional Illustrated Avatars
For the avatar picker in Settings (users choose an illustrated avatar):
```
/public/avatars/illustrated/avatar-01.svg through avatar-20.svg
```
- 20 diverse illustrated avatar options
- Circle-framed, ~80px, transparent background
- Variety of styles/characters representing diverse family members

---

## 6. Responsive Design Constraints

### Breakpoints
| Breakpoint | Width | Layout Change |
|---|---|---|
| Mobile (default) | < 640px | Single column, bottom nav, bottom-sheet drawers |
| sm | 640px+ | 2-column grids start |
| md | 768px+ | Sidebar appears, 4-column stat grids, side drawers |
| lg | 1024px+ | Full sidebar with labels, 3-column content grids |

### Key Layout Rules
- **Mobile-first** — design for 375px first, then scale up
- **Sidebar:** Hidden on mobile, icon-only at md (64px wide), full with labels at lg (224px wide)
- **Mobile nav:** Fixed bottom bar (64px height) with 4 primary tabs + "More" menu
- **Content area:** Full width minus sidebar, padded (16px mobile, 24px desktop)
- **Touch targets:** Minimum 44px for all interactive elements

---

## 7. Animation Specifications

### Page Transitions
- Entry: fade in (opacity 0→1) + slide up (y: 12px→0px), duration 350ms, easeOut

### Drawers
- Desktop: Slide from right, spring physics (damping: 30, stiffness: 300)
- Mobile: Slide from bottom, same spring, drag-to-close at 30% viewport threshold

### Modals
- Scale 95%→100% + opacity, duration 150-200ms

### Hover States
- Cards: translateY(-2px) + stronger shadow + accent border glow, 200ms ease
- Buttons: translateY(-1px) + stronger glow, 200ms ease

### Loading States
- Skeleton pulse animation on placeholder cards
- Same dimensions as loaded content to prevent layout shift

---

## 8. Icon Library

**Library:** Lucide React (https://lucide.dev/icons/)
- Open source, consistent 24px grid, 2px stroke weight
- ~50 icons currently used across the app
- Standard sizes: 16px (compact), 18px (default), 20-22px (emphasis)

**If designing custom icons:** Match Lucide's 24px grid, 2px stroke weight, rounded caps/joins for visual consistency. Or provide alternatives from Lucide's catalog.

---

## 9. How to Deliver Designs for Easy Integration

### Color Changes
**Deliver as:** A table of token → value mappings for each theme
```
Theme: "Cosmic"
--color-bg: rgb(11, 25, 41)
--color-surface: rgb(21, 45, 74)
... etc
```
**Integration effort:** One CSS file edit, zero component changes.

### Component Redesigns
**Deliver as:** Figma frames showing all states (default, hover, active, disabled, focus, loading, empty, error) with exact specs (padding, radius, shadow, colors using token names)
**Integration effort:** Update CSS classes, no structural code changes.

### Layout Restructuring
**Deliver as:** Annotated wireframes showing responsive behavior at 375px, 768px, 1024px
**Integration effort:** Modify component JSX and Tailwind classes. Medium effort.

### Character Assets
**Deliver as:** SVG files following the exact naming convention above. Transparent background. Optimized (SVGO or similar).
**Integration effort:** File drop into `/public/characters/`. Zero code changes.

### New Pages/Features
**Deliver as:** Full mockups at mobile + desktop showing all states. Annotate which existing components to reuse (glass-card, drawer, buttons, etc.)
**Integration effort:** New component files, wiring to existing data layer.

---

## 10. What's Safe to Change vs What Breaks Things

### Safe to Change (Design Layer)
- All color values (via CSS variables)
- Font choice and weights
- Border radius values
- Shadow definitions
- Animation timings and curves
- Icon choices (within Lucide library)
- Glass-morphism opacity/blur values
- Character illustrations
- Spacing and padding values
- Card layouts and grid configurations

### Risky to Change (Requires Engineering)
- Responsive breakpoint values (affects all pages)
- Component structure (e.g., tabs → accordion)
- Navigation pattern (sidebar → top nav)
- Drawer behavior (side panel → full-page overlay)
- Adding entirely new interaction patterns (drag-and-drop, gestures)

### Cannot Change (Architecture)
- CSS variable token names (the names are referenced in 50+ component files)
- File naming conventions for character assets
- Tailwind as the styling framework
- Radix UI as the accessibility primitive layer

---
*Document generated from Orbyt codebase analysis. Last updated: February 2026.*
