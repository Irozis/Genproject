# Testing

This project uses Vitest for unit and layout tests and Playwright for end-to-end browser coverage.

## Commands

- `npm test` runs the full Vitest suite.
- `npm run test:unit` runs library, component, and app-state unit tests.
- `npm run test:layout` runs layout, safe-zone, and image-aware generation tests.
- `npm run test:export` runs export pipeline tests.
- `npm run test:watch` starts Vitest in watch mode.
- `npm run test:e2e` runs Playwright scenarios.
- `npm run test:e2e:ui` opens the Playwright UI runner.
- `npm run build` typechecks and builds the app.

## Fixtures

Shared deterministic fixtures live in `src/test/fixtures`. They cover light, dark, and premium brands; short and long content; horizontal, vertical, and square image analyses; and critical ad sizes including micro banners, wide banners, square cards, vertical stories, and marketplace cards.

Playwright image fixtures live in `e2e/fixtures`: `horizontal-product.jpg`, `vertical-product.jpg`, and `square-product.jpg`. They are tiny local SVG-backed mock images with `.jpg` names so the tests stay deterministic and do not depend on external assets.

## E2E Scenarios

The browser suite in `e2e/specs` covers the user-facing path through the guided wizard: create a project, upload an image, fill content, select a palette, apply recommended formats, inspect preview cards, enter editing, navigate back, and export a ZIP. It also covers image-orientation recommendations, small horizontal formats, palette stability across selection/regeneration/reload, browser/app back behavior, and final export feedback.

Stable selectors are exposed through `data-testid` attributes such as `app-start`, `create-project-button`, `upload-image-input`, `recommended-formats-panel`, `select-recommended-formats`, `palette-card`, `preview-card`, `validation-status`, `edit-format-button`, `back-button`, `export-step`, `export-all-button`, and `download-zip-button`.

## Critical Formats

The critical format set includes small horizontal banners (`320x50`, `320x100`, `319x57`), leaderboard and wide display banners (`728x90`, `1456x180`, `2880x300`, `2880x400`, `3000x360`), medium rectangles and skyscrapers (`300x250`, `300x600`), social cards (`1080x1080`, `1080x1350`, `1080x1920`), marketplace placements (`1472x600`, `600x750`), and tiny teaser cards (`145x165`).

## Layout Validation

Layout tests verify that generated scenes do not throw, blocks have finite coordinates and sizes, important blocks remain inside the canvas and safe areas, CTA does not overlap headline/body, micro banners avoid oversized hero images, and image-aware recommendations preserve the selected image strategy.

## Validator And Export

Compliance tests cover ready, warning, and error-equivalent states through existing `pass`, `warn`, and `fail` checks. Export tests verify SVG and PNG ZIP creation, manifest inclusion, and deterministic filenames without requiring a browser download.

## Experimental Work

The image-aware recommendation tests and critical layout fixtures are the most relevant suites for experimental VKR work: they exercise orientation matching, crop risk, recommended image mode, and the historically fragile horizontal and small-format layouts.

Before a demo or VKR defense, run `npm test`, `npm run test:e2e`, and `npm run build`. The critical demo checks are: project creation to export, image-based format recommendations, micro and horizontal banner rendering, palette persistence, editor/back state preservation, and ZIP export availability.
