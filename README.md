# kimquizak

Lightweight quiz game board built with Next.js 16 (App Router + TypeScript). Configure teams and categories, then run the game with a slot-machine turn order picker, question modals, timelines, audio clips, text grids, and more. State (teams, questions, turn order, settings) is stored in the browser via `localStorage`.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000 and use the config pages to add teams and questions. The game starts empty (no default categories/questions), so add your own before playing.
Prod: https://kimquizak.com/

## Main flows
- `Config / Teams`: set team names, colors/emojis and players; shuffle players; reset the turn order.
- `Config / Questions`: add and reorder categories, configure whether category titles start concealed, and build question types (standard, text grid, geoguesser, joker, timeline, MCQ, audio). Question editors start collapsed to protect answers during live hosting, and can be opened independently or as a category. Drag questions within a category to reorder point slots.
- `Game`: draw the complete board-turn order with sleigh bells, reveal concealed category titles, play tiles, and track scores/answers. A glockenspiel confirms the selected opening team. Board turn advances after each resolved question.

## Question types (cheat sheet)
- **Standard**: prompt + answer; optional question/answer images.
- **MCQ**: 2 or 4 options. No rotation; the picking team gets one shot (win or lose the points).
- **Text grid (lyrics)**: one word/segment per line. Answer video must be a YouTube *embed* URL (not a share link). Red tiles rotate to the next team and shave the pot; “Next team” button available for hosts on wrong guesses.
- **Geoguesser**: paste a Google Maps Street View embed URL or complete iframe. Preview the cropped, view-only panorama, then configure the explicit points-for-exploration choice, timer, and answer.
- **Timeline**: events with years. Center year/label configurable. Rotation on miss optional.
- **Audio**: paste any regular YouTube URL, configure start time and clip length, and preview the source. The audio plays once, then locks.
- **Joker high/low**: configurable count, min/max, increment, and rotation on miss.

## Project reminder: upgrade Geoguesser

- [ ] Create a Google Cloud project, attach a billing account, and enable the Maps JavaScript API.
- [ ] Create a browser API key restricted to `kimquizak.com` and local development, then configure a quota/budget alert. Do not commit the key; provide it through `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
- [ ] Replace the cropped Street View iframe with `StreetViewPanorama`. Hide Google&apos;s road-name and address overlays, keep required attribution visible, and only enable navigation after the team actively spends points for exploration.

This replaces the current embed-and-crop workaround while preserving physical signs and names captured in the Street View imagery as part of the clue.

## Persistence
- Local-only: teams (`kimquizak_teams_v1`), questions (`kimquizak_questions_v1`), turn state (`kimquizak_turn_state_v1`), score history (`kimquizak_score_history_v1`), and settings (`kimquizak_settings_v1`) are saved in `localStorage`.
- Automatic scores, direct score edits, and host bonuses are recorded in the leaderboard history and can be undone individually.
- Reset turn order from the Teams config if you need a fresh spin.
- Example data: click “Add example data” in the Backup & restore panel on the home page to load `default_questions.json` (bundled) into localStorage.

## Scripts
- `npm run dev` – start dev server
- `npm run build` – production build
- `npm run lint` – lint with Next/ESLint defaults

## Notes
- No secrets or API keys are required; everything runs client-side.
- Images are kept in `localStorage`; large images may bloat storage limits—prefer smaller uploads.
- Built by Codex as the developer, with a human acting as product owner and QA lead.
- Tested in Microsoft Edge; iframes may behave differently in other browsers (e.g., embed autoplay quirks).
