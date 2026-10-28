# Public demo privacy review

## Demo image update — 2026-10-27

The current zoom-reveal demo now embeds one reviewed CC0 tortilla photograph instead of the generated house drawing described in the original review below. Source, license, dimensions and the SHA-256 of the metadata-free Wikimedia thumbnail are recorded in [demo image provenance](demo-image-source.md). The privacy audit permits only those exact decoded JPEG bytes; other raster uploads remain flagged. The historical findings below describe the September review and are unchanged.


Reviewed 2026-10-11. Deployment remains on hold.

## Changes made

- `default_questions.json` is the public demo fixture used by the example loader and browser tests. Its nine fictional characters are Nora, Emil, Frida, Aksel, Maja, Jonas, Ingrid, Sander, and Thea, with deterministic `demo-player` IDs. These names were chosen for the fixture, not copied from a personal roster. All five relationship kinds are represented by invented reciprocal links.
- The demo has all ten question types. The image-reveal example is an original SVG house drawing with no people, photos, or embedded metadata. Trivia examples use general knowledge.
- Scores, answered flags, and score history start clean. No question-type drafts are bundled. The fictional demo teams are Granskuddene, Gavegjengen, and Bjelleklang. Public cultural/geographic quiz content is retained.
- The backup panel labels example players and relationships as fictional. Existing browser storage is not migrated, cleared, or uploaded by these changes. Loading example data still explicitly replaces the local quiz.
- `.env` remains ignored. The committed environment template contains blank values. `private/` and downloaded `kimquizak-backup-*.json` exports are now ignored.
- `npm run audit:privacy` checks tracked and unignored files for selected credential patterns, private paths, raster image files, and raster images embedded in JSON. `npm run audit:privacy -- --history` also checks historical file blobs. Matches report filenames and blob IDs, never credential values or image contents.

## Audit findings and limits

The local repository has 201 reachable commits and 607 historical file blobs at review time. The history scan found no matches for the checked credential patterns or tracked `.env` and private backup paths. However, the expanded image scan found embedded raster pictures in two historical versions of `default_questions.json`: blobs `bfb075a777d6` and `7a714f377c1a`. The locally recorded `origin/main` fixture contains five embedded pictures. An earlier filename-based review missed these because they are inside JSON, not separate photograph files. Treat these pictures as private pending cleanup; no picture contents were printed or exported during review.

The current working-tree demo contains only a generated SVG house; browser tests use generated shapes, a one-pixel PNG, and dummy image strings. No uploaded test photographs were found in the pending files. Image uploads in the editor are stored in browser IndexedDB; explicitly saved cloud snapshots and downloaded backups can also contain them, but those are separate from the repository. The historical example JSON also contains nine first-name player labels that were not independently confirmed to be fictional. The current fixture uses invented names and relationships.

The original Git history retains one author/committer identity and the earlier example player labels. An isolated release copy now removes the historical fixture and those player labels while preserving source authorship. GitHub and the original checkout have not been rewritten. A new content commit alone does not erase old history. The scan covers locally available Git references, not hosted artifacts, forks, logs, or previous deployments.

Public audio assets are accompanied by source/license credits. Embedded audio tags were inspected: most files have no tags or encoder tags only; the bronze fanfare also has the credited public creator, date, genre, and tempo. Attribution is retained. Public creators and named cultural figures in trivia are distinct from private player identities and relationships. No personal photos are present in the public asset inventory; the application icon/logo and generic SVGs remain.

Pattern checks cannot prove the absence of all PII or all secret formats. Browser-local quizzes, ignored private files, secret values, and live cloud configuration are outside this audit. The user's local `.env` was not copied or changed by this task. Browser verification uses an isolated disposable profile with demo content only.

## Release verification and remaining gates

Local password login and cloud saves were confirmed by the host. Both SQL migrations match remote history; live metadata checks confirmed RLS enabled, anonymous DELETE denied, and owner-scoped deletion. No saved quizzes were deleted during verification. Vercel Production has the four required environment variables and Node 22; the apex domain was verified. Google API restrictions and quotas were confirmed by the host. Production deployment has not changed.

Next.js and its lint configuration were updated to 16.3.8, with compatible transitive security fixes. `npm audit --omit=dev` reports zero findings. Five high-severity findings remain in the development-only `braces` → `micromatch` → `fast-glob` → Next lint chain. The proposed automatic fix downgrades the lint configuration to Next 14 and was not applied.

Release review: all 54 regression tests and the production build/TypeScript check passed. ESLint has zero errors and 15 warnings. Disposable browser checks passed for anonymous host/API access, the Geoguesser setup links, fictional demo import/export, trivia scoring, vertical shaking/spinning, and the full board/finale/image-reveal suite. The gesture check exposed a relationship encounter clearing active dizzy eyes; preserving that state fixed the regression. The broad browser suite uses `QUIZ_TEST_PRODUCTION=1` against a production server so it does not look for the development-only finale preview. Image-reveal assertions now wait for image loading before inspecting the rendered mask.

- Publish only the verified sanitized release history. The original checkout's history audit still detects the old pictures; a clean working-tree audit alone is insufficient. Replacing GitHub's existing `main` requires a separately approved history rewrite and will trigger Vercel's production build.
- Verify host login, archive open/download/delete, logout, and Street View on the eventual production deployment. Live negative-user RLS behavior still needs verification beyond the completed policy metadata checks.
- Browser-local quizzes remain device-local after logout; use Clear everything on shared devices. Authenticated local-cache isolation is not implemented.
- The prepared `release-ready` branch incorporates the frontend renovation and pending features. Its intended publication target is `main`, which Vercel Production follows.

## Prepared history cleanup (local only)

GitHub ref inspection on 2026-10-11 found only `main` and no tags, matching the locally recorded remote tip `4fb9231dc407847d57b3e9a4612b543e06662aee`. A recovery bundle and archive of pending files are stored under ignored `private/release-cleanup-20261011/` with restricted directory permissions. These recovery files contain the original private history and must never be published.

An independent mirror was sanitized with `git-filter-repo --path default_questions.json --invert-paths`. All 201 commit mappings were checked: every non-fixture file retains its original blob and mode. Both flagged picture blobs are absent from the sanitized object database. The review checkout restores the current fictional fixture alongside the reviewed application changes. Original Git history and working files are retained for recovery; the sanitized candidate has no GitHub push remote configured.

Publication must use an explicit lease against the inspected remote tip, not a blanket force-push or mirror push. Recheck remote branches/tags before publishing, and stop if the remote changed. Commit IDs change, so collaborators must resynchronize rather than merge old history back in. Hosted caches, forks, and prior deployments require separate inspection; rewriting Git history does not erase them. The old production deployment may still serve historical fixture content until it is replaced, and older deployment URLs need a separate cleanup review. No GitHub rewrite or deployment has been performed during preparation.
