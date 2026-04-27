# Adaptive Graphics MVP

Deterministic React app for generating marketplace/social promo graphics across multiple formats and composition models.

## Stack

- React 18 + TypeScript strict (`noUncheckedIndexedAccess`)
- Vite
- Plain CSS variables + SVG renderer
- Vitest

## Supported Formats

- `marketplace-card` — 1200x1200
- `marketplace-highlight` — 1080x1350
- `social-square` — 1080x1080
- `story-vertical` — 1080x1920
- custom formats (`custom:*`) via sidebar builder

## Composition Models

- `text-dominant` — no image, typography-first layout
- `split-right-image` — text left, image right
- `hero-overlay` — full-bleed image with scrim-backed text stack
- `image-top-text-bottom` — visual top, copy and CTA below

## Keyboard Shortcuts Cheat-Sheet

- `Ctrl/Cmd + Z` — Undo
- `Ctrl/Cmd + Shift + Z` (or `Ctrl + Y`) — Redo
- `T` — toggle title
- `S` — toggle subtitle
- `C` — toggle CTA
- `B` — toggle badge
- `L` — toggle logo
- `I` — toggle image
- `Space + Drag` — pan preview
- `Ctrl/Cmd + Wheel` — zoom preview
- `Shift + Click` on image hotspot — set per-format focal
- `Shift + Alt + Click` on image hotspot — reset focal override

## Visual Snapshot

Project currently does not include a committed screenshot asset. Add one image under the repo and reference it here when preparing release notes.

## Verification Commands

```bash
npx tsc --noEmit
npx vitest run
npx vite build
```

## Coverage

```bash
npx vitest run --coverage
```

Focus modules for regression protection:

- `buildScene`
- `composition`
- `fixLayout`
- `paletteFromImage`
- `serialize`
