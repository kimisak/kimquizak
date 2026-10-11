# Connections rounds

Choose **Connections** in a question's type picker. Enter the puzzle in one textbox, with one connection per line:

```text
Things you can fold: Paper, Laundry, Arms, Poker hand
Instruments: Piano, Flute, Drums, Violin
Weather: Rain, Snow, Hail, Fog
Colours: Red, Blue, Green, Yellow
```

Use four connection lines, with four distinct tiles per connection: exactly 16 tiles in a 4×4 grid. All tiles belong to a real connection. Set **Connections needed to finish** to 1, 2, 3, or 4 (default) to control round length. Any connections count toward the target. Blank lines are ignored. Text containing delimiters can be quoted: `Greetings: "Hello, world", Hi, Hey, Welcome`. Inside quoted text, write a literal double quote as `""`. Invalid lines show their line number and keep the question unplayable until fixed. Unfinished text is saved too, including when switching question types or exporting a backup.

The textbox expands to fit its content without an internal scrollbar. The names explain the solutions and stay hidden during play. Tiles support Norwegian letters and other Unicode text; duplicates are checked without regard to case or surrounding spaces.

## Hosting and pacing

- **Connections needed to finish:** defaults to 4. Choose 1–3 for a shorter round; unsolved connections reveal on the answer screen.
- **Seconds per guess:** defaults to 120. Set to 0 to disable the timer. Disabled timers have no display or timer instructions during play.
- **Shared mistake limit:** defaults to 4 for the whole round, across teams. Set to 0 for unlimited mistakes.
- **Rollover after a wrong guess or timeout:** enabled by default. Turn it off to let the same team continue until the round ends.
- **End round:** the host can finish early and reveal the remaining connections. Earned points are kept.

The timer is per guess, not a limit for the entire round. Each accepted correct guess, wrong guess, or timeout starts a fresh timer. Invalid or previously attempted combinations do not reset it. A timeout consumes one shared mistake, with the same rollover behavior as a wrong guess. A guess submitted at or after the deadline cannot earn points.

Budget time for these rounds when planning an evening: with two minutes per guess and four mistakes, a round can approach fourteen minutes of guessing. Shorter timers make for brisker play. Nothing limits how many Connections questions a host can add to the board.

## Playing and scoring

The opening screen explains the rules. **Start round** shuffles and reveals 16 tiles and starts the timer when enabled. **Shuffle** rearranges unsolved tiles, and clears the current selection. It always changes their order while keeping solved groups, points, mistakes, attempted combinations, and the deadline intact. Select four tiles, then **Submit group**. A correct group is replaced with its connection name and earns an equal share of the question's points; the same team keeps playing. Integer rounding distributes the full point pool across the required connections. A wrong guess costs a mistake, but never removes earned points. Its four tiles stay selected, including after rollover, so the next attempt can replace a tile without reconstructing the guess. An unchanged previously submitted combination cannot be resubmitted. Solved tiles leave the selection automatically. If three tiles belong together, a “Three are correct” message appears briefly and fades away without identifying the tiles.

The round ends when the required number of connections is solved, the mistake limit is reached, or the host ends it. The answer screen keeps solved groups visible and animates the remaining connections into view one by one. Revealed solutions award no points. **Reveal all now** skips the sequence; **Continue** returns to the board. Reduced-motion preferences disable the animation.

## Saving and resuming

Tile order, attempted combinations, solved groups, mistakes, team, scores, and the current deadline are saved. Closing or reloading does not restart the current guess's timer. If it expired while the round was closed, reopening consumes one mistake and starts the next guess; it does not charge additional unseen turns for the time away.

File backups and host cloud archives include the round's configuration and saved progress. **Reset game progress** clears it along with the other game results. Changes to puzzle content should be made before play; reset game progress before replaying an edited puzzle.

## Checks

`npm test` covers validation, scoring, duplicate submissions, deadlines, rollover, and finish rules. With a local server running on port 3016, run `node tests/connections-browser.cjs` for authoring, responsive layout, gameplay, animated answers, backup/import, reload, and reset checks. Set `QUIZ_TEST_URL` to use another server and `PLAYWRIGHT_CHROMIUM_EXECUTABLE` if needed.

Older local filler drafts must be rewritten as four named connections before play. Their text remains visible in the editor for correction.
