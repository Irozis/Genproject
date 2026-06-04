# Audit: layout-engine-v2 integration

## 1. Project data model

* files:
  * `src/lib/types.ts`
  * `src/lib/defaults.ts`
  * `src/lib/serialize.ts`
  * `src/lib/storage.ts`
  * `src/lib/formatDocuments.ts`
  * `src/App.tsx`
* summary:
  * The main project model is the `Project` type in `src/lib/types.ts`. It stores the master `Scene`, enabled block map, brand kit, asset/image metadata, selected formats, per-format overrides, densities, custom formats, active locale, and optional per-format `ProjectFormatDocument` objects.
  * The generated ad material is represented by `Scene`, also in `src/lib/types.ts`. It contains `background`, optional `title`, `subtitle`, `cta`, `badge`, `logo`, `image`, optional `scrim`, `decor`, and `layoutPolicy`.
  * Blocks use percent geometry (`x`, `y`, `w`, optional `h`) relative to the target format, while typography is mostly stored as percent of format width.
  * `src/lib/defaults.ts` defines `DEFAULT_MASTER`, `DEFAULT_BRAND_KIT`, `DEFAULT_ENABLED`, default selected formats, and `newProject()`.
  * `src/lib/serialize.ts` mirrors the project shape with Zod schemas for JSON import/export validation.
  * `src/lib/formatDocuments.ts` converts generated scenes into editable object documents (`SceneObject[]`) for per-format editing.
* risks:
  * `Project` mixes source content, generated layout state, manual per-format overrides, image processing metadata, and editor state. A new engine should treat `Project` as an input boundary, not as internal state.
  * `Scene` is both the layout engine output and the renderer input. Any v2 output should either produce a compatible `Scene` or use an explicit adapter.
  * `serialize.ts` has a fixed schema. Persisting new v2-only fields inside `Project` or `Scene` would require schema changes and migration care.

## 2. Target formats

* files:
  * `src/data/adFormats.ts`
  * `src/lib/formats.ts`
  * `src/lib/types.ts`
  * `src/lib/defaults.ts`
  * `src/lib/layoutDensity.ts`
  * `src/lib/formatGeometry.ts`
  * `src/components/CreationWizard.tsx`
* summary:
  * The expanded catalog is `AD_FORMAT_CATALOG` in `src/data/adFormats.ts`.
  * `src/lib/formats.ts` adapts the catalog into the legacy API: `FORMATS`, `FORMAT_KEYS`, `BASE_FORMAT_KEYS`, `RU_MARKETPLACE_FORMAT_KEYS`, `DEFAULT_COMPOSITION_BY_FORMAT`, and `getFormat()`.
  * Format shape is `FormatRuleSet` in `src/lib/types.ts`; it includes dimensions, aspect ratio, safe zones, visible/overlay areas, export constraints, required elements, text/logo rules, source metadata, and layout heuristics like `gutter`, `minTitleSize`, `maxTitleLines`, and `typescaleBoost`.
  * `DEFAULT_FORMATS` in `src/lib/defaults.ts` defines the initial selected format subset.
  * `CreationWizard` uses format groups and catalog data for selection UI.
* risks:
  * Format records include both platform constraints and layout hints. v2 should separate hard platform constraints from engine heuristics internally.
  * `getFormat()` throws for unknown built-in keys and relies on `custom:` keys for custom formats. v2 should preserve that behavior at the adapter boundary.
  * `layoutDensity` mutates effective format rules before generation; v2 must account for density if it wants parity with current previews.

## 3. Current layout generation

* files:
  * `src/lib/buildScene.ts`
  * `src/lib/composition.ts`
  * `src/lib/layoutPolicy.ts`
  * `src/lib/layoutDensity.ts`
  * `src/lib/styleSettings.ts`
  * `src/lib/formatGeometry.ts`
  * `src/lib/textMeasure.ts`
  * `src/lib/formatDocuments.ts`
  * `src/App.tsx`
  * `src/components/FormatPreview.tsx`
  * `src/components/CreationWizard.tsx`
* summary:
  * `buildScene()` in `src/lib/buildScene.ts` is the main deterministic generation pipeline. It accepts master `Scene`, `formatKey`, `BrandKit`, `EnabledMap`, and `BuildOptions`, then returns a positioned `Scene`.
  * The pipeline applies brand colors, selects or honors a composition model, calls `LAYOUTS[model]`, applies style settings, applies layout policy, snaps text, localizes copy, clamps to safe zones, applies block overrides, and runs readability guards.
  * `src/lib/composition.ts` contains composition scoring, format/content profiling, and the concrete `LAYOUTS` implementations.
  * `src/lib/layoutPolicy.ts` applies geometry policy, content reduction, gradient/scrim/decor rules, and manual-review markers.
  * `src/App.tsx`, `src/components/FormatPreview.tsx`, `src/components/CreationWizard.tsx`, and `src/lib/formatDocuments.ts` all call `buildScene()` directly or through local helper wrappers.
* risks:
  * Current generation is not isolated to one module: layout selection, placement, policy, text fitting, validation markers, density, style settings, and image decisions are spread across several modules.
  * `App.tsx` and `FormatPreview.tsx` duplicate some build options. Integrating v2 should start behind one adapter/helper, not by replacing calls one by one.
  * `layoutPolicy` imports `checkOverflow()` from `fixLayout.ts`, so generation already depends on validation diagnostics.
  * Manual overrides and edited format documents can bypass or freeze generated layout. v2 must define what happens to existing `blockOverrides` and `formatDocuments`.

## 4. SVG rendering

* files:
  * `src/renderers/SceneRenderer.tsx`
  * `src/lib/formatDocuments.ts`
  * `src/components/FormatPreview.tsx`
  * `src/App.tsx`
  * `src/lib/exportSvg.ts`
  * `src/lib/export.ts`
  * `scripts/generate.ts`
  * `scripts/runExperiment.ts`
  * `scripts/determinism-check.ts`
* summary:
  * `src/renderers/SceneRenderer.tsx` is the SVG renderer. It accepts a positioned `Scene`, `FormatRuleSet`, font settings, brand labels/colors, optional image aspect ratio, and optional `SceneObject[]`.
  * It renders background, decor, image, scrim, badge, title, subtitle, CTA, and logo into a pure SVG tree. Text wrapping uses `textMeasure`.
  * If `objects` are passed, it renders sorted `SceneObject` layers instead of the default scene block order.
  * `FormatPreview` embeds `SceneRenderer` and keeps a ref to the generated SVG node for export.
  * Headless scripts also render `SceneRenderer` through React server rendering.
* risks:
  * Renderer assumes the current `Scene` and `SceneObject` shapes. A v2 layout output should remain renderer-compatible or be converted before rendering.
  * Text sizing and fitting are split between generation and SVG rendering. Matching visual results requires respecting renderer behavior, not only numeric block positions.
  * Export depends on live SVG DOM nodes from previews; changing the render path can affect PNG/ZIP even if export code is untouched.

## 5. Export PNG/ZIP

* files:
  * `src/lib/export.ts`
  * `src/lib/exportSvg.ts`
  * `src/App.tsx`
  * `src/components/FormatGrid.tsx`
  * `src/components/FormatPreview.tsx`
  * `src/lib/compliance.ts`
  * `scripts/validatePngExports.ts`
  * `src/lib/__tests__/exportPipeline.test.ts`
* summary:
  * PNG ZIP export is implemented in `src/lib/export.ts` via `exportZip()`. It serializes live SVG nodes to PNG with `svgToPngDataUrl()`, adds PNG files to JSZip, and includes `ad-format-manifest.json`, `export-report.json`, and `export-report.txt`.
  * SVG ZIP export is separate in `src/lib/exportSvg.ts` via `exportSvgZip()`.
  * PDF export is also in `src/lib/export.ts` via `exportPdf()`.
  * `App.tsx` collects SVG refs from `FormatGrid` / `FormatPreview` and dispatches export by selected export kind.
  * Export reports use format rule metadata and optional scenes to mark official/derived/heuristic rule sources.
* risks:
  * Export operates on rendered SVG DOM, not on an abstract scene. v2 integration affects export indirectly through preview rendering.
  * `exportZip()` calls `getFormat()` again, so v2 must preserve selected/custom format keys and dimensions.
  * PNG rendering can expose SVG/runtime differences such as image CORS, clip paths, text wrapping, and font availability.

## 6. Validation / warnings

* files:
  * `src/lib/fixLayout.ts`
  * `src/lib/compliance.ts`
  * `src/lib/layoutPolicy.ts`
  * `src/components/FormatPreview.tsx`
  * `src/App.tsx`
  * `src/lib/objectEditValidation.ts`
  * `src/lib/__tests__/fixLayout.test.ts`
  * `src/lib/__tests__/compliance.test.ts`
  * `src/lib/__tests__/layoutCriticalFormats.test.ts`
* summary:
  * `checkOverflow()` in `src/lib/fixLayout.ts` is the main read-only layout diagnostic. It reports safe-zone violations, visible-area/overlay intersections, likely text truncation, text overlaps, low contrast, small-ad copy/CTA issues, platform text limits, minimum font size, and related warnings.
  * `fixLayout()` in the same file is an optimizer/fixer that clamps blocks and adjusts text/contrast.
  * `runCompliance()` in `src/lib/compliance.ts` wraps `checkOverflow()` and adds official/layout/heuristic validation findings.
  * `layoutPolicy.ts` calls `checkOverflow()` during generation to mark `layoutPolicy.needsManualReview` and `manual-review-fallback`.
  * `FormatPreview` displays warning/info badges from `checkOverflow()`, and `App.tsx` records validation events in research mode.
* risks:
  * Validation is partly diagnostic and partly part of generation policy. Replacing generation without preserving validation semantics may change warning behavior.
  * `fixLayout()` can mutate scenes after generation in some workflows. v2 should specify whether it replaces, precedes, or follows this fixer.
  * Some validation rules are heuristic and depend on current block geometry assumptions.

## 7. Tests

* files:
  * `vite.config.ts`
  * `playwright.config.ts`
  * `src/lib/__tests__/*.test.ts`
  * `src/components/__tests__/FormatGrid.test.ts`
  * `src/renderers/__tests__/SceneRenderer.snapshot.test.ts`
  * `src/__tests__/editMode.test.ts`
  * `e2e/*.spec.ts`
  * `e2e/specs/*.spec.ts`
  * `e2e/fixtures/*`
  * `e2e/formats.spec.ts-snapshots/*`
* summary:
  * Vitest is configured in `vite.config.ts` with `environment: 'node'` and `include: ['src/**/*.test.ts']`.
  * Unit tests cover layout generation (`buildScene`, `composition`, `layoutCriticalFormats`), validation (`fixLayout`, `compliance`), formats, serialization, export, text measurement, style settings/composition, image decisions, format documents, and project/edit flows.
  * Renderer snapshots live under `src/renderers/__tests__`.
  * Playwright is configured in `playwright.config.ts`, with `testDir: './e2e'` and a Vite dev server at `http://localhost:5173`.
  * E2E specs live in `e2e/formats.spec.ts` and `e2e/specs/ad-generator.spec.ts`.
* risks:
  * Vitest does not include `.tsx` tests by pattern unless they are imported by `.test.ts`; this matters if future v2 tests are added as `.test.tsx`.
  * Existing tests assume current `buildScene()` output and renderer snapshots. v2 parity work will likely require either a feature flag or separate v2 test fixtures.
  * Playwright tests depend on the UI and may fail from visual/text changes even if engine output is structurally valid.

## 8. Safe place for new module

* proposed path:
  * `src/layout-engine-v2/`
* why:
  * A top-level `src/layout-engine-v2/` directory is outside current `src/lib/` helper modules, React components, renderer, export code, and data catalog.
  * It can import shared types from `src/lib/types.ts` and format data through `src/lib/formats.ts` without being imported back by the existing app.
  * Keeping the module isolated avoids accidental coupling to `buildScene.ts`, `composition.ts`, `layoutPolicy.ts`, and UI state while the engine is developed.
  * A later integration can add a narrow adapter, for example one function that maps `Project`/`FormatRuleSet` inputs into v2 and maps v2 output back to `Scene`.

## 9. Integration risks

* risk 1:
  * There are multiple current call sites for `buildScene()` (`App.tsx`, `FormatPreview.tsx`, `CreationWizard.tsx`, `formatDocuments.ts`, scripts, tests). A partial replacement can create inconsistent previews, exports, editor documents, research output, and tests.
* risk 2:
  * The current `Scene` contract is shared by generator, renderer, editor objects, validation, export, serialization, and tests. Any v2 output schema drift needs an adapter and focused compatibility tests.
* risk 3:
  * Existing generation includes post-processing concerns: layout policy, safe-zone clamping, text fitting, locale text, block overrides, image focal/fit decisions, style settings, density, and readability. Omitting one of these in v2 can regress real formats even if the core placement algorithm is better.

## 10. Recommended next step

* what to do next:
  * Add `src/layout-engine-v2/` as an isolated module with no app imports into it.
  * Define a small input/output contract first: `Project`/`Scene`/`FormatRuleSet` input, v2 internal model, and adapter back to renderer-compatible `Scene`.
  * Start with unit tests that compare invariants rather than exact visuals: safe-zone containment, required elements, no text overlap, readable text sizes, deterministic output, and compatibility with selected/custom formats.
  * Keep v2 behind a non-UI integration boundary until parity risks are understood.
* what not to touch:
  * Do not change React components, `SceneRenderer`, `buildScene()`, `composition.ts`, export modules, `package.json`, or existing generation call sites during the next isolated-module step.
