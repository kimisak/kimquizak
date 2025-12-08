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
