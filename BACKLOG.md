# Product backlog

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
