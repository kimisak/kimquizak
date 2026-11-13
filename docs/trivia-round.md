# Trivia Round

One board tile contains at least two questions. Choose **All teams** (the default)
or **One team** in the question configuration. In one-team mode, the host selects
the playing team before advancing past the first question; only that team is marked
and awarded points. All-team rounds let every team answer on paper.
The tile's points are available independently to each participating team; they are not a shared pool.
Each correct answer has equal weight. Final team awards are rounded once:
`round(tile points × correct answers / question count)`.

In Questions config, choose **Trivia round**, optionally name the round, and add
questions with answers and optional images. Entries can be reordered or removed.
Question text and answers are required; the outer answer field is not used.

During play, navigate questions with Previous/Next. Review answers becomes available
at the last question. In review, select every team that answered correctly and confirm
the marking, including questions where nobody was correct. Changing a mark invalidates
that question's confirmation. Scores remain untouched until **Award points & finish**.
The results screen supports going back to review before awarding.

Each team receives its own score-history entry, including zero-point results, visible
on the answered board tile unless scores are hidden. Normal score-history undo and
manual podium controls remain available. The board turn advances once for the whole round.

Closing an unfinished round discards its navigation and marking. Refreshing or leaving
the Play route also restarts an unfinished round. Uploaded images and question configuration
are saved with the quiz, including in backups and inactive type drafts.

Checks: `npm test`, `npx tsc --noEmit`, and
`QUIZ_TEST_TRIVIA_ONLY=1 npm run test:browser`.
