# Product backlog

## Completed locally — reviewed 2026-11-13

- Standard questions support partial credit across 1–12 required answers.
- MCQ supports stable shuffled answer order, larger text, responsive layouts, and an adjustable image/answer split.
- Trivia can be played by all teams or one selected team.
- Host Booth cutscenes were removed in favour of direct player interactions; guests return home and teammates make space. Wrapped podium rows overlap in front.
- Play waits for saved quiz state before rendering team identities and turn order. Street View has full-screen controls and visible setup/access errors.
- Shuffling redistributes players across teams as evenly as possible, with optional M/F balancing.
- Public pages bypass Supabase session refresh, so an unavailable or paused project cannot block local quiz editing and play. Host and private API authorization remain required.

The remaining items below are future work; local audio/video and backend evaluation have not been implemented.

## New game rounds — requested 2026-10-11

Direction: grow KimQuizak into a quiz and games platform, with team games that fit the existing board and host-led play.

Requested modes:

- **Wordle-inspired word guessing:** the host supplies a secret word and optional clue; guesses reveal correct letters and positions. Decide word lengths, accepted guesses/languages, attempt limits, team rotation, and scoring before implementation.
- **Connections-inspired grouping — implemented locally 2026-10-11:** 16 tiles in four real groups, with a host-selected finish target of 1–4 connections, a shuffle control, fading near-miss hints, split scoring, configurable rollover, 120 seconds per guess and four shared mistakes by default (both adjustable/optional). Without rollover the same team keeps playing. The host can end early; remaining answers animate into view one by one. See `docs/connections.md`.
- **Hangman or an equivalent letter-reveal game:** the host supplies a word or phrase and optional clue; teams guess letters or attempt the full solution. A non-hanging visual could track mistakes. Decide turn rules, mistake limits, and scoring before implementation.

Shared requirements: host-authored puzzles, readable shared-screen presentation, clear team turns and scoring, progress preserved across closing/reloading, backup and cloud-save support, and predictable reset behavior. Consider Norwegian letters (Æ, Ø, Å) in word-based modes.

Connections was selected as the first implementation. Wordle and Hangman rules and priority remain to be agreed. Hosts control evening pacing; there is no restriction on the number of game rounds on a board.

## General ordering round and Timeline ranges — requested 2026-10-21

Generalize the Timeline mechanic into a reusable ordering/scale round without removing the existing year-based Timeline presentation.

- Support numeric axes beyond years, including height, length, distance, weight/mass, temperature, price, population, release order, and other host-defined units.
- Support subjective host-defined rankings such as least liked → most liked. The presentation must make it clear that the ordering is the host's stated preference rather than an objective fact.
- Give each entry a hidden numeric sort value and a separately formatted display value/unit, so the same placement engine can power every scale.
- Let the host define direction and endpoint labels, for example shortest → tallest, lightest → heaviest, or least liked → favourite.
- Keep the core interaction based on relative placement between existing entries. Treat exact placement on a continuous number line as a separate possible game mode.

Extend Timeline with optional ranges such as `1996–2015`:

- Store a start and end value and reveal the duration as a visual bar spanning the axis.
- Allow point events to occur inside a range; ranges must not reserve an exclusive section of the timeline.
- Use separate visual lanes when ranges overlap so labels and spans remain readable.
- Decide whether players place a range by its start value (preferred initial rule) or whether both endpoints affect validation.
- Define density limits and responsive behavior for several long or overlapping ranges before implementation.

## Podium playground experiments — requested 2026-10-27

These are optional host-led entertainment ideas, separate from quiz rules and scoring.

- **Explore free player placement and throwing:** let the host place player pills anywhere within the podium, with throws coming to rest where they land. Position must remain purely visual: moving a player near another team must never change team membership, turn order or scoring. Possible uses include separating a player from their team for a joke or staging interactions, but discuss the purpose with the host before implementing. Decide boundaries, collisions, reset/return-to-team controls, persistence and behavior when the podium resizes.

## Regression follow-up

The September regression pass and repeatable checks are documented in `docs/regression-review.md`.

- Verify physical Surface Pro, ultrawide, and TV readability; automated viewport checks are covered.
- Run the same flows in Microsoft Edge, including audio autoplay and actual cue balance.
- GeoGuessr production check completed by the host on 2026-10-11; reported working correctly.
- Expand browser coverage for unusually large rosters, long host messages, and remaining question gameplay permutations.

## Host-message variables — implemented 2026-09-13

Add template variables to scheduled host messages so messages can address configured teams and players dynamically.

Candidate syntax:

- `{team1}` — first configured team name.
- `{team1.member1}` — first named player on the first team.
- `{random.team}` — one randomly selected configured team.
- `{random.player}` — one randomly selected named player across all teams.

Requirements for implementation:

- Preview resolved example text in Questions / Board Config without changing the saved template.
- Resolve every random variable once when a message becomes due, then persist the result so rerenders, route changes, and dismissal do not reroll it.
- Define predictable behavior for missing teams, blank player names, and out-of-range indexes; never display raw unresolved tokens on the game board.
- Provide discoverable variable insertion/help rather than requiring hosts to memorize syntax.
- Preserve templates and resolved message state through backup/import and board reset semantics.
- Random selections resolve uniformly without replacement and appear directly inside the styled host message.

## Parked experiment — Three.js pachinko random-selection reveal

The completed Three.js + cannon-es pachinko reveal is parked because its physical-game metaphor adds too much ceremony to host-message variable selection.

- The prototype renders a real drop-the-marble sequence with a central release, Three.js presentation, and cannon-es collisions.
- Its final iteration lets physics determine the landing, while shuffling candidate-to-slot placement to neutralize the machine's natural center bias.
- The implementation remains in `src/components/game/PachinkoDraw.tsx` and `src/lib/pachinkoPhysics.ts`.
- It is intentionally disconnected from `HostMessageOverlay`.
- Reconsider it later as a standalone bonus challenge or dedicated random-draw game rather than an interruption before a host message.

## Local audio/video and media storage — requested 2026-10-28

Add host-supplied media for audio-guess questions, text-grid answer reveals, and the finale soundtrack. Use recordings the host has permission to use. The goal is predictable, ad-free playback without depending on Spotify integration or hidden YouTube players. Review the existing YouTube audio/finale presentation against the displayed-player requirements before deciding which integrations to retain.

Proposed storage split (to validate before implementation):

| Part | Proposed responsibility |
| --- | --- |
| localStorage | Small settings, scores, progress, and stable media IDs; no embedded media bytes |
| IndexedDB quiz records | Question content and references to media |
| IndexedDB media store | Images, audio, and video as separate Blob records, written only when the asset changes |
| Export/import | A portable quiz-and-media bundle, with continued support for existing JSON backups |
| Optional cloud copy | Quiz metadata/snapshots and private media objects; provider and upload design are pending the backend evaluation below |

The local design must work independently of the cloud-provider decision. Keep media references portable across browser storage, exported files, and any optional cloud copy.

Storage and portability are design requirements, not follow-up work:

- **Keep file contents out of localStorage.** It should hold small settings, progress, and media references only, including the finale's selected media ID.
- **Design a separate IndexedDB media store.** Prefer Blob records with stable IDs, shared by images, audio, and video, instead of embedding large base64 strings in the questions array. Editing question text must not rewrite every attached file. Plan migration from the existing image data URLs and retain compatibility with current quizzes.
- Show per-file and total media usage. Use the browser's storage estimate, handle quota failures without losing the previous quiz, and consider requesting persistent storage. Define file-size and supported-format limits based on browser playback and practical event needs; do not promise a fixed storage allowance across devices. Explain that clearing site data removes local media.
- Load the active clip when needed and preload upcoming reveals; release unused playback resources and object URLs. Confirm the media is saved and playable before reporting readiness. Keep question/replay timing tied to actual media playback, with recoverable errors.
- Avoid duplicate media files and reclaim assets when no remaining question, draft, or finale setting references them. Protect the current quiz and its media during interrupted saves, imports, migrations, and deletion.
- Preserve export/import with all required media. Evaluate a quiz-and-media bundle (for example ZIP) to avoid unnecessarily large base64 JSON and memory spikes, while still accepting existing JSON backups. Decide how this interacts with private cloud snapshots: the current archive endpoint accepts only 3 MB for the whole payload, independently of IndexedDB capacity. Larger media may need separate object storage or a clear local-only backup path; cloud media storage is not yet decided.
- Validate mixed image/audio quizzes, repeated edits, reloads, unavailable storage, quota exhaustion, interrupted imports, and export/import to another browser/device. Test Edge playback and browser autoplay restrictions before relying on it for a live event.

## Backend choice: Supabase versus Google Cloud — requested 2026-10-28

**Status: evaluate before adding cloud media storage; no provider decision made.** The existing Google Cloud project makes consolidation worth considering. Supabase currently provides host authentication and the private PostgreSQL quiz archive; the Maps key is configured on the app server, not stored in Supabase. Local play and file backups must remain available without either cloud backend.

Compare concrete service combinations rather than treating Google Cloud as a single database replacement:

| Responsibility | Keep Supabase | Consolidate on Google Cloud |
| --- | --- | --- |
| Host identity | Existing Supabase Auth session integration | Firebase Authentication or Identity Platform, with server-side session verification |
| Saved quizzes | Existing PostgreSQL snapshots and owner-scoped RLS | Private snapshot JSON objects in Cloud Storage; evaluate Firestore only if a queryable metadata index is useful |
| Optional uploaded media | Private Supabase Storage buckets with access policies | Private Cloud Storage objects with authenticated access rules or server-authorized access |
| Maps and Street View | Existing Google Maps project and key restrictions | Same Google Maps project and key restrictions |
| App hosting | Existing Vercel deployment | Can keep Vercel; changing the backend does not by itself require changing hosting |

Evaluation criteria:

- Start from the actual scope: one configured host, local-first play, explicit cloud backups, and optional media. Assess whether a database is still useful if cloud snapshots and media are stored as objects.
- Compare setup steps, operational work, session handling, private-access controls, deletion, and ease of self-hosting. Google Maps project membership is not app-user authentication.
- Estimate total recurring cost using a representative image/audio quiz: storage, requests, downloads/egress, authentication, regions, and billing prerequisites. Compare costs after trial credits, not just during a promotion. Cloud Storage for Firebase requires the Blaze billing plan; no-cost allowances depend on the relevant services and usage.
- Compare retaining the working integration against migration work: host identity mapping, session cookies, API authorization, saved snapshots, data export, documentation, and regression tests. Keep a rollback path for saved quizzes.
- Keep cloud media separate from snapshot JSON and assess the current 3 MB archive request limit as an application/transport constraint. Choosing another database alone does not fix that limit.
- Produce a short decision with evidence: retain Supabase, move to a specific Google service combination, or postpone cloud media while shipping local files. Revisit the choice if actual usage or requirements change.

References checked 2026-10-28: [Firebase on an existing Google Cloud project](https://firebase.google.com/docs/projects/use-firebase-with-existing-cloud-project), [Firebase/Identity Platform comparison](https://docs.cloud.google.com/identity-platform/docs/product-comparison), [Firebase access rules](https://firebase.google.com/docs/rules/basics), [Firebase Storage billing requirements](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024), and [Supabase private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals).

## Persistence follow-up

Optional improvement, not a release requirement.

- Show saving/saved status for question edits and guard hard navigation while IndexedDB writes are pending. An immediate refresh can otherwise discard the latest edit before its save completes.
