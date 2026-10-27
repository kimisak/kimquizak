# Product backlog

## New game rounds — requested 2026-10-11

Direction: grow KimQuizak into a quiz and games platform, with team games that fit the existing board and host-led play.

Requested modes:

- **Wordle-inspired word guessing:** the host supplies a secret word and optional clue; guesses reveal correct letters and positions. Decide word lengths, accepted guesses/languages, attempt limits, team rotation, and scoring before implementation.
- **Connections-inspired grouping — implemented locally 2026-10-11:** 16 tiles in four real groups, with a host-selected finish target of 1–4 connections, a shuffle control, fading near-miss hints, split scoring, configurable rollover, 120 seconds per guess and four shared mistakes by default (both adjustable/optional). Without rollover the same team keeps playing. The host can end early; remaining answers animate into view one by one. See `docs/connections.md`.
- **Hangman or an equivalent letter-reveal game:** the host supplies a word or phrase and optional clue; teams guess letters or attempt the full solution. A non-hanging visual could track mistakes. Decide turn rules, mistake limits, and scoring before implementation.

Shared requirements: host-authored puzzles, readable shared-screen presentation, clear team turns and scoring, progress preserved across closing/reloading, backup and cloud-save support, and predictable reset behavior. Consider Norwegian letters (Æ, Ø, Å) in word-based modes.

Connections was selected as the first implementation. Wordle and Hangman rules and priority remain to be agreed. Hosts control evening pacing; there is no restriction on the number of game rounds on a board.

## Podium playground experiments — requested 2026-10-27

These are optional host-led entertainment ideas, separate from quiz rules and scoring.

- **Reconsider Host Booth cutscenes:** the current prerecorded scenes are a starting point, but their purpose and entertainment value are still unclear to the host. Explore what makes a scene worth interrupting play for, and improve the dialogue, pacing and presentation only if that purpose holds up. Removing the cutscenes is an equally valid outcome; do not treat further development as decided.
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

## Persistence follow-up

- Show saving/saved status for question edits and guard hard navigation while IndexedDB writes are pending. An immediate refresh can otherwise discard the latest edit before its save completes.
