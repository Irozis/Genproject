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

## Website and Desktop Builds

The normal Vite website workflow is unchanged:

```bash
npm install
npm run dev
npm run build
npm run preview
```

The Windows desktop app is an additional Electron wrapper around the local Vite build. It does not replace the website build and does not require hosting the app online.

```bash
npm run desktop:dev
```

Desktop development starts the Vite dev server on port 5173 and opens Electron against that local server.

```bash
npm run desktop:dist
```

The installer build runs a desktop-mode Vite build with relative asset paths, then packages the app with electron-builder/NSIS. The resulting Windows installer appears in `desktop-release/*.exe` and is configured to create Desktop and Start Menu shortcuts named `Ad Layout Generator`.

For an unpacked local package instead of an installer:

```bash
npm run desktop:pack
```

## Desktop Release Verification

Before sharing a Windows desktop build, run this smoke checklist:

- Install the generated `desktop-release/*.exe` installer.
- Launch the app from the Desktop shortcut.
- Launch the app from the Start Menu shortcut.
- Upload an image through the app's file picker.
- Generate layouts for the supported formats.
- Export SVG, PNG, PDF, and ZIP outputs where those export options are available.
- Restart the desktop app and verify the saved project/state is restored from localStorage.
- Verify the website dev workflow still starts with `npm run dev`.
- Verify the website production build still succeeds with `npm run build`.

Desktop release notes:

- ASAR packaging is disabled intentionally because local Windows build limitations blocked electron-builder's ASAR integrity rewrite step in this environment.
- The installer is unsigned.
- Windows SmartScreen may show a warning for the unsigned installer.
- This is acceptable for local/demo usage; production distribution should add a proper app icon and code signing.

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
