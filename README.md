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
- `Config / Teams`: set team names, colors/emojis, theme, players; reset turn order; adjust quiz title.
- `Config / Questions`: add categories (tabbed, one at a time) and question types (standard, text grid, geoguesser, joker, timeline, MCQ, audio); upload optional images where supported. Drag questions within a category to reorder point slots.
- `Game`: spin the slot machine to set board turn order, play tiles, and track scores/answers. Pre-spin tiles give a small bounce/boing; spinning plays a short chime loop. Board turn advances after each resolved question.

## Question types (cheat sheet)
- **Standard**: prompt + answer; optional question/answer images.
- **MCQ**: 2 or 4 options. No rotation; the picking team gets one shot (win or lose the points).
- **Text grid (lyrics)**: one word/segment per line. Answer video must be a YouTube *embed* URL (not a share link). Red tiles rotate to the next team and shave the pot; “Next team” button available for hosts on wrong guesses.
- **Geoguesser**: Google Maps Street View *embed* URL (share → embed); avoid views with visible street addresses. Optional hint, timer, unlock cost, and answer link/label. Unlock caps reward and adds to the penalty on a miss.
- **Timeline**: events with years. Center year/label configurable. Rotation on miss optional.
- **Audio**: hidden YouTube *embed* URL plus start/stop seconds; plays once, then locks.
- **Joker high/low**: configurable count, min/max, increment, and rotation on miss.

## Persistence
- Local-only: teams (`kimquizak_teams_v1`), questions (`kimquizak_questions_v1`), turn state (`kimquizak_turn_state_v1`), and settings (`kimquizak_settings_v1`) are saved in `localStorage`.
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
