# Julebord Games

Lightweight holiday party game board built with Next.js 14 (App Router + TypeScript). Configure teams and categories, then run the game with a slot-machine turn order picker, question modals, timelines, audio clips, text grids, and more. State (teams, questions, turn order) is stored in the browser via `localStorage`.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000 and use the config pages to add teams and questions.
Prod: https://julebord-games.vercel.app/

## Main flows
- `Config / Teams`: set team names, colors/emojis, players; reset turn order.
- `Config / Questions`: add categories and question types (standard, text grid, geoguesser, joker, timeline, MCQ, audio); upload optional images where supported.
- `Game`: spin the slot machine to set board turn order, play tiles, and track scores/answers.

## Question types (cheat sheet)
- **Standard**: prompt + answer; optional question/answer images.
- **MCQ**: 2 or 4 options. Rotation on wrong only applies in 4-option mode if enabled.
- **Text grid (lyrics)**: one word/segment per line. Answer video must be a YouTube *embed* URL (not a share link). Rotation can depend on red tiles.
- **Geoguesser**: Google Maps Street View *embed* URL (share → embed); avoid views with visible street addresses. Optional hint, timer, unlock cost, and answer link/label.
- **Timeline**: events with years. Center year/label configurable. Rotation on miss optional.
- **Audio**: hidden YouTube *embed* URL plus start/stop seconds; plays once, then locks.
- **Joker high/low**: configurable count, min/max, increment, and rotation on miss.

## Persistence
- Local-only: teams (`julebord_teams_v1`), questions (`julebord_questions_v1`), and turn state (`julebord_turn_state_v1`) are saved in `localStorage`.
- Reset turn order from the Teams config if you need a fresh spin.

## Scripts
- `npm run dev` – start dev server
- `npm run build` – production build
- `npm run lint` – lint with Next/ESLint defaults

## Notes
- No secrets or API keys are required; everything runs client-side.
- Images are kept in `localStorage`; large images may bloat storage limits—prefer smaller uploads.
- Built by Codex as the developer, with a human acting as product owner and QA lead.
- Tested in Microsoft Edge; iframes may behave differently in other browsers (e.g., embed autoplay quirks).
