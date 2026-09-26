# Image Reveal

Choose **Image reveal** in the question type picker. Upload an image, enter its answer, and optionally add a prompt.

## Choose an area

The image starts fully covered, with no areas assigned. First set **Opening clues** (default 0%) to expose some random cells. The seeded pattern stays the same in configuration and play and never assigns areas. Existing deliberately painted opening clues remain intact; a conditional **Clear saved opening clues** action removes those older clues without changing random coverage or painted areas.

The editor opens in **Opening tiles**, not with Area 1 preselected. Click a cell to hide/show it, or drag to apply the stroke's first choice to more cells. These manual overrides persist above the random pattern even when its coverage changes. They never assign cells to an area. A covered opening cell can still be painted into an area and revealed when that area is selected in play. **Area tools → Reset cell edits** returns to the random/legacy opening pattern without changing drawn areas. Existing saved areas are preserved; **Reset all areas** removes them when the host wants to start over.

Next use **Add area** and drag to paint 2–5 numbered reveal areas. Starting a stroke on the selected area's cells erases instead; the entire stroke keeps that paint/erase behavior. Painting can move cells between areas, but does not change opening clues. **Show source** helps with deliberate placement, while **Player view** previews the covered opening on the same canvas. Cleanup actions live under **Area tools**: clear/remove the selected area, or reset all areas while keeping opening clues. Unassigned cells remain covered until the answer reveal.

**Show source** works in both Opening tiles and area painting. The image sits behind translucent covered cells, with the grid and area assignments still visible; revealed opening cells stay unobscured. This is editor-only: Player view and live play use opaque covers. Styled switches control both views. **Area tools** are directly visible below the canvas, not hidden in a disclosure.

Every area must contain at least one still-covered cell; already-visible areas cannot consume an attempt. Numbers repeat on disconnected sections, which all open together. There are no custom labels. In play, numbered buttons below the image provide an alternative to clicking the image. In the editor, the cell grid has one tab stop: arrow keys navigate and Enter/Space paints or erases.

Finally choose one mutually exclusive play mode:

- **Teams take turns** (default): choose one area, then guess. Wrong passes to the next team, keeps the answer hidden and never reduces points. All areas stay open. Once all areas are revealed, teams continue guessing until correct or the host ends the question.
- **One team, limited guesses**: one area and guess per attempt, with up to as many attempts as useful painted areas. The first attempt pays the face value. Each later selection reduces the available reward once; wrong guesses do not subtract from the team's score. The next reward is shown before selection. The last wrong guess reveals the answer with no award.

Limited-mode payouts use distinct descending board tiers. If those run out, remaining attempts divide the lowest reached tier into smaller positive whole-point rewards: 500 → 400 → 300 on a normal board, or 100 → 67 → 33 for a three-attempt 100-point question. Tiny imported tiers that cannot support the remaining positive rewards are skipped. Configuration previews the entire payout ladder; rollover has no cost control.

Correct/Wrong are unavailable until an area is selected (except rollover after all areas are open). Correct reveals the answer and offers **Award points & continue**; **End question & reveal** ends without an award. The answer reveals the entire image, including unassigned covered cells.

### Legacy Random patches migration

Random patches is no longer a selectable style and has no separate editor or live renderer. Existing questions and inactive type drafts migrate to Choose an area when loaded/imported. Their exact first-stage visible tiles become opening clues, with no areas generated from later stages. The host must paint the selectable areas. Compatibility parsing remains so old backups can still be imported. Questions already converted by an earlier version retain their saved areas; use Reset all areas to start over without losing opening clues.

## Stage-based styles

- **Zoom out:** scroll to zoom (up to 50×) and drag to pan. Arrow keys pan; keyboard +/− zoom. Recenter centers the selected stage. The stage slider only navigates: it never overwrites framing. **Copy previous framing** explicitly copies the preceding view into the current stage.
- **Clear the blur:** Blur amount controls the selected stage; **Copy previous blur** explicitly copies the preceding value. No zoom or pan controls.
- Choose 2–5 stages including the opening view. Each stage is independently editable, including the last. Only the answer reveal forces the full image. Each style retains its own levels when switching styles.
- Existing unedited zoom questions retain their automatic framing path. Saved per-stage focal points survive type drafts and backup/import.
- Wheel edits save after a short pause; dragging saves on release. Pending edits flush when switching stages or leaving the editor.
- Optional point costs move down one distinct board value per extra reveal, stopping at the lowest value. For a 100/300/500 board: 500 → 300 → 100 → 100. With costs off, the full value stays available.

## Live flow and persistence

For Zoom and Blur, **Reveal more** advances the stage. Its payout label appears only when reveal costs are enabled. **Reveal answer** is at the bottom right and shows the full image and answer without judging the guess. Correct/Wrong appear on the answer side; Back to question restores the current stage.

**Pass to next team on wrong guess** defaults on for these stage-based styles. Wrong returns to the question for the next team at the same stage and reward. With rollover off, Wrong finishes without points. This is a shared screen: teams will have seen the answer before rollover. Choose an area instead supports wrong/pass directly during guessing, keeping the answer hidden.

Correct locks a pending result; **Award points & continue** records it. Closing an unfinished question discards its stage, chosen areas, reduced reward and pending result—even a Correct not yet awarded. Finalized scores remain. Reload recovery still applies to attempts not explicitly closed.

## Verification

Removing an image also clears its areas, opening clues/manual cell edits, saved levels for every style, zoom positions and Fill frame crops. Editor selection/preview state and pending edits are reset too. Question text, answer, reveal style and scoring/rollover rules remain unchanged.

With Fill frame enabled, Blur supports wheel zoom and drag-to-pan without changing blur levels. Areas provides a dedicated **Frame image / Done framing** mode so framing gestures cannot paint tiles. New framed area setups use a fixed 16:10 crop canvas: frame first, then paint cells/areas on that crop. The grid stays fixed while reframing moves the source underneath. Editor, preview and gameplay preserve the same crop regardless of viewport shape. Existing whole-image setups are retained until the host converts them; conversion confirms before clearing old areas/manual cell edits. Each style saves its own crop. Reset framing restores the centered 1× crop; the final answer always shows the whole image.

All image-reveal styles have an optional **Fill frame** control. It crops without stretching in previews and gameplay; the answer still shows the whole image. Unframed areas use the full source; newly framed areas use the crop as their grid. Zoom Out pan limits use the visible viewport proportions, so portrait images can reach their top and bottom edges even at 1× zoom. Stage positions remain saved independently. “Reveal more” no longer repeats the reward in its button label; the header retains the current reward.

`npm test` covers independent stages, bounded zoom/framing, board reward tiers, area normalization/islands, stable opening clues, legacy migration, draft serialization and related game regressions.

`QUIZ_TEST_IMAGE_ONLY=1 npm run test:browser` exercises editor styles, previews, area painting, opening coverage, legacy imports, type drafts, rollover, reset-on-close, reload persistence, viewport fit and awards without duplicates.

September 23 design iteration adds 19 passing unit tests overall, limited-attempt browser checks (reduced awards and exhausted guesses), and rendered reviews at 390px config width and a 1280×854 play viewport. TypeScript passes; targeted lint has no errors, with four existing game-page hook dependency warnings.

Physical TV readability and touch should still be checked on the actual hardware; image difficulty is tuned by the host using Player view.
