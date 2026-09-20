# Regression review — September 2026

## Running the checks

- `npm test` runs deterministic backup, board-reveal, host-variable, and replay-economy checks.
- `npx playwright install chromium` installs the browser for UI checks once.
- `npm run test:browser` starts an isolated development server on port 3012 with `.next-regression` as its build cache. Tests use a fresh browser profile and example data, never the host's browser storage. The server stops after the run.
- `QUIZ_TEST_URL=http://localhost:3000 npm run test:browser` uses an already-running server instead.
- For a stable production run without Fast Refresh: `QUIZ_TEST_DIST_DIR=.next-regression npm run build`, then `QUIZ_TEST_PRODUCTION=1 npm run test:browser`. Production skips the development-only finale preview button; the actual end-of-game finale is still tested.
- Optional `PLAYWRIGHT_CHROMIUM_EXECUTABLE` selects an existing Chromium binary; `PLAYWRIGHT_MODULE` selects an externally installed Playwright package.

Browser screenshots are written to `/tmp/finale-1440.png`, `/tmp/finale-1720.png`, `/tmp/finale-1920.png`, and `/tmp/config-geo.png`.

## Regressions found and fixed

1. **Question editor remounts:** Standard, Audio, Text Grid, GeoGuessr, Joker, and Timeline editors were declared inside the page component. A parent update recreated their component types and discarded in-progress state. The image-upload/draft-switch test first failed by restoring the old question text. Moving these declarations to module scope preserves the mounted editor and its state.
2. **Backup chose stale legacy progress:** Current progress with no drawn order could be replaced by legacy turn state. A deliberately empty current roster could also resurrect legacy teams. The failing regression now passes: an existing current record takes precedence regardless of its contents.
3. **GeoGuessr stage configuration contrast:** The stage instructions still used light text designed for a dark background. Browser measurement reproduced approximately 1.4:1 contrast. Dark text on a solid cream panel measures 7.62:1 for the main helper paragraph.

## Automated coverage

- Independent text drafts across all eight question types, image upload, reload, and backup/import.
- Reload checks wait for the asynchronous IndexedDB write to complete. An immediate hard refresh before a pending save finishes can still discard the latest edit; a visible saving/saved indicator and unload guard remain follow-up work.
- A 6 MiB inactive image draft survives archive import/export through IndexedDB without using the legacy localStorage question key. This is a storage stress fixture, not a rendered image or a change to the upload-size limit.
- Route width checks at 1440×960 (3:2), 1720×720 (ultrawide), 1920×1080, and 3840×2160.
- Drawn order persists after reload; hidden scores can be adjusted; scores persist across routes; Undo reverses the correction.
- Finale preview at 1440×960, 1720×720, and 1920×1080: row dimensions stay stable, second/third reveal positions stay stable, controls fit, and each reveal has visible particles with reduced-motion emulated. First-place completion may reposition the entire podium when the reveal button is replaced by finale controls.
- Reset returns the board to the opening draw with zero scores.
- Actual final question, concealed category text, persisted random host message, and five-team staged finale on a 3:2 viewport.
- Unit checks cover final row/category/individual bonus unlock conditions, replay point tiers, countdown classification, non-repeating mixed-gender random draws, and draft backup serialization.

## Remaining manual checks

Validation completed: five unit tests, the development browser suite, the production browser suite, TypeScript, and the production build passed. ESLint reports zero errors and 13 existing warnings (image optimization and hook dependencies).

- Physical Surface Pro/TV/ultrawide readability and touch behavior; viewport emulation cannot verify viewing distance or device scaling.
- Microsoft Edge itself: this pass uses Chromium, including reduced-motion emulation.
- Audible music/cue balance and YouTube buffering/autoplay failures. Browser tests verify UI flow, not perceived loudness or reliable external playback.
- Live Google Maps exploration, timer locking, and geolocation scoring against the configured API key.
- Larger rosters, unusually long host messages, all gameplay permutations, and real quota exhaustion beyond the tested archive size.

No claim of whole-app accessibility certification is made by the targeted contrast check.
