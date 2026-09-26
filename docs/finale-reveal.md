# Tier-by-tier finale

The existing board-config toggle reveals every score tier separately, from last upward: four distinct scores produce **4th → 3rd → 2nd → 1st**, five produce **5th → 4th → 3rd → 2nd → 1st**.

Equal scores form one tier and reveal atomically, including ties that span the large podium rows and the smaller team rows below. Revealed ranks use competition ranking (1st, 1st, 3rd). Concealed placeholders describe their slots (1st, 2nd, 3rd…), not the hidden rankings. The button always says “Reveal next” so neither labels nor button copy spoil ties. One remaining score tier uses a winner/joint-winners reveal.

The FINAL SCORES screen and its Continue button remain. Every subsequent reveal is host-controlled, with the hover drumroll (volume reduced to 0.18). Fourth and lower tiers use the existing TADA cue; third uses Graciano Choc's CC0 Trumpet Fanfare, normalized to -20 LUFS. Second place uses Anime Wow, and first place starts the WRAP song and full celebration. The fanfare's source and license are stored beside the audio asset.

All rows reserve their content dimensions while concealed, including the non-podium rows. Each podium tier receives its own reveal burst. Higher podium rows sit above lower-row effect layers so second place's particles cannot cover the winner's team/player pills. The reveal control stays in the bottom-right action area.

Tests: `npm test` covers grouping, ordering, ties and small/empty games. `QUIZ_TEST_FINALE_ONLY=1 npm run test:browser` covers four/five teams, shared second/third, all tied, one/two teams, hidden identities, stable row dimensions, final-only celebration and viewport fit at 1280×854 and 1720×720. Real music playback remains subject to browser autoplay and YouTube availability.
