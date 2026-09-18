# Audio replay and question-value economy

Status: implemented. Replay is opt-in per Audio question and disabled by default.

## Decision recommendation

An `Allow one replay` toggle is available on individual Audio questions. When enabled, the answering team may replay the same clip once after its first playback has begun.

The replay moves the question down one configured board-value tier:

| Face value | Value after replay |
| ---: | ---: |
| 100 | Replay unavailable |
| 200 | 100 |
| 300 | 200 |
| 400 | 300 |
| 500 | 400 |

The value tiers come from the current board, not a hard-coded 100-point subtraction. If there is no lower tier, replay is unavailable. The live control discloses the consequence before use, for example: `Replay for 400 pts`.

Apply the reduction only when YouTube reports actual playback. Clicking, loading, buffering, autoplay blocking, or a playback error must not consume the replay or reduce the value. Stopping after audible playback has begun does consume it.

## Shared economic rule

Keep three concepts separate:

1. **Face value** — the value printed on the board tile.
2. **Available value** — the current reward after an in-question aid or modifier.
3. **Awarded score** — the final score transaction after adjudication.

In-question decisions such as Audio replay and GeoGuessr exploration may reduce available value. They should never immediately deduct already-earned team points. A correct answer awards the available value; a wrong answer awards zero. Manual leaderboard editing remains the host's path for corrections, penalties, and bonuses.

## Why one tier?

The board already teaches players a hierarchy of question values. Moving down one tier makes the cost obvious without a percentage calculation. Replaying the same clip is a mild hint; a future hint that provides new information could cost two tiers, but that is not part of Audio replay.

Do not expose an arbitrary numeric penalty per question. Keep one consistent rule across the game and measure actual use before adding global economy settings.

## Live interaction

- Before the first listen, disclose that one reduced-value replay is available.
- After the first listen, show `Replay for 400 pts` on a 500-point question.
- While loading, show `Preparing replay · still worth 500 pts`.
- Once playback starts, show `400 pts available · replay used`.
- On failure, show `Replay did not start · no value lost` and allow retry.
- Replay does not rotate teams. If Audio later supports steals, the reduced value follows the question because every team heard the replay.

## Persistence prerequisite

Playback count, replay consumption, and the chosen replay payout are persisted by question ID in turn state. Closing the modal, refreshing, or navigating between routes does not restore full points or provide extra listens. Board reset clears this state. Backups include it.

The final score-history transaction describes the awarded result, for example: `Music · 500 · Correct after replay (400 awarded)`. No immediate negative replay transaction is created; this keeps Undo straightforward.

## Validation and telemetry

Test first playback, replay, stop, buffering, errors, autoplay blocking, modal reopening, route navigation, refresh, Correct, Wrong, Undo, backup/import, and board reset across every point tier.

If balance needs later calibration, record privacy-light events such as tier, team count, clip duration, replay offered/requested/started, available value, playback errors, and outcome. Raw replay-versus-no-replay accuracy is selection-biased because less-confident teams choose replay.

## Related inconsistency

GeoGuessr currently tells the host that a wrong explored answer deducts points, while the scoring code awards zero and only reduces `geoPotential`. Update that wording when the shared available-value model is introduced.
