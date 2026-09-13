# Audio replay and question-value economy

Status: reviewed, not implemented.

## Decision recommendation

Add an `Allow one replay` toggle to individual Audio questions. Keep it disabled by default for backward compatibility. When enabled, the answering team may replay the same clip once after its first completed playback.

The replay should reduce the question's available reward to 75% of its face value:

| Face value | Value after replay |
| ---: | ---: |
| 100 | 75 |
| 200 | 150 |
| 300 | 225 |
| 400 | 300 |
| 500 | 375 |

The live control must disclose the exact consequence before use, for example: `Replay · value drops to 375 pts`.

Apply the reduction only when YouTube reports actual playback. Clicking, loading, buffering, autoplay blocking, or a playback error must not consume the replay or reduce the value. Stopping after audible playback has begun does consume it.

## Shared economic rule

Keep three concepts separate:

1. **Face value** — the value printed on the board tile.
2. **Available value** — the current reward after an in-question aid or modifier.
3. **Awarded score** — the final score transaction after adjudication.

In-question decisions such as Audio replay and GeoGuessr exploration may reduce available value. They should never immediately deduct already-earned team points. A correct answer awards the available value; a wrong answer awards zero. Manual leaderboard editing remains the host's path for corrections, penalties, and bonuses.

## Why 75%

A flat 100-point cost is disproportionately severe for low-value questions. Half value is highly legible but is usually too punitive to create an interesting choice. Retaining 75% means replay becomes worthwhile when the second listen improves the team's perceived chance of success by roughly one third. Under plausible success assumptions across the 100–500 tiers, this is approximately neutral to the overall score economy.

Do not initially expose an arbitrary numeric penalty per question. Keep one consistent rule across the game and measure actual use before adding global economy settings.

## Live interaction

- Before the first listen, disclose that one reduced-value replay is available.
- After the first listen, show `Replay for 375 pts` and `Second and final listen · value drops from 500 to 375 pts`.
- While loading, show `Preparing replay · still worth 500 pts`.
- Once playback starts, show `375 pts available · replay used`.
- On failure, show `Replay did not start · no value lost` and allow retry.
- Replay does not rotate teams. If Audio later supports steals, the reduced value follows the question because every team heard the replay.

## Persistence prerequisite

Playback count, replay consumption, and current available value must be runtime state persisted by question ID. Closing the modal, refreshing, or navigating between routes must not restore full points or provide extra listens. Clear this state only through the board reset flow.

The final score-history transaction should describe the awarded result, for example: `Music · 500 · Correct after replay (375 awarded)`. Do not create an immediate negative replay transaction; this keeps Undo straightforward.

## Validation and telemetry

Test first playback, replay, stop, buffering, errors, autoplay blocking, modal reopening, route navigation, refresh, Correct, Wrong, Undo, backup/import, and board reset across every point tier.

If balance needs later calibration, record privacy-light events such as tier, team count, clip duration, replay offered/requested/started, available value, playback errors, and outcome. Raw replay-versus-no-replay accuracy is selection-biased because less-confident teams choose replay.

## Related inconsistency

GeoGuessr currently tells the host that a wrong explored answer deducts points, while the scoring code awards zero and only reduces `geoPotential`. Update that wording when the shared available-value model is introduced.
