# kimquizak

Lightweight quiz game board built with Next.js 16 (App Router + TypeScript). Configure teams and categories, then run the game with a slot-machine turn order picker, question modals, timelines, audio clips, text grids, and more. State is stored locally in the browser.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000 and use the config pages to add teams and questions. The game starts empty (no default categories/questions), so add your own before playing.
Prod: https://kimquizak.com/

## Main flows
- `Config / Teams`: set team names, colors/emojis and players; shuffle players; reset the turn order.
- `Config / Questions`: add and reorder categories, add or remove questions within each category in 100-point steps, configure whether category titles start concealed, and build question types (standard, text grid, geoguesser, joker, timeline, MCQ, audio). Question editors start collapsed to protect answers during live hosting, and can be opened independently or as a category. Drag questions within a category to reorder point slots. Categories can have different lengths; missing board positions remain empty.
- `Game`: draw the complete board-turn order with sleigh bells, reveal concealed category titles, play tiles, and track scores/answers. A glockenspiel confirms the selected opening team. Board turn advances after each resolved question.

## Question types (cheat sheet)
- **Standard**: prompt + answer; optional question/answer images.
- **MCQ**: 2 or 4 options. No rotation; the picking team gets one shot (win or lose the points).
- **Text grid (lyrics)**: one word/segment per line. Answer video must be a YouTube *embed* URL (not a share link). Red tiles rotate to the next team and shave the pot; “Next team” button available for hosts on wrong guesses.
- **Geoguesser**: find a place in Google Maps, paste its link, adjust the nearby Street View scene, and save the opening frame. Google Maps share links, Street View URLs, and iframe code are supported. The question starts on a fixed view. A timed choice to look around and move drops the correct-answer payout by one or two board-value levels; the host can freely explore on the answer side. Google's road/address overlays are hidden without cropping.
- **Timeline**: events with years. Center year/label configurable. Rotation on miss optional.
- **Audio**: paste any regular YouTube URL, configure start time and clip length, and preview the source. Optionally allow one replay that lowers a correct answer to the next lower board-value tier.
- **Challenge**: write a task with an optional picture and optional host-started countdown or count-up clock. The clock can show exact time or only an animated progress bar. The tile keeps its normal point value; after the reveal, the host marks the challenge completed for full points or not completed for 0 points. Reaching the time limit never scores automatically. Existing saved booby-trap tiles use this new behavior.
- **Joker high/low**: configurable count, min/max, increment, and rotation on miss.

## Google Street View setup

Set `GOOGLE_MAPS_API_KEY` in `.env` and enable the Maps JavaScript API with billing. The app does not need the Geocoding API: hosts find locations in Google Maps, then paste and adjust the link. The browser must receive this key to render Street View, so restrict it to the app's production and local-development HTTP referrers and the Maps JavaScript API in Google Cloud. Set a quota/budget alert. Never commit `.env`.

The API view disables Google's address and road-label overlays, while preserving required Google attribution. Signs and street names physically photographed in the panorama remain part of the clue.

## Persistence
- Local-only: question content and images are saved in IndexedDB; teams (`kimquizak_teams_v1`), turn state (`kimquizak_turn_state_v1`), score history (`kimquizak_score_history_v1`), and settings (`kimquizak_settings_v1`) are saved in `localStorage`. Existing localStorage questions migrate automatically.
- Automatic scores, direct score edits, and host bonuses are recorded in the leaderboard history and can be undone individually.
- Reset turn order from the Teams config if you need a fresh spin.
- Example data: click “Add example data” in the Backup & restore panel on the home page to load `default_questions.json` (bundled) into local browser storage.

## Scripts
- `npm run dev` – start dev server
- `npm run build` – production build
- `npm run lint` – lint with Next/ESLint defaults

## Notes
- No secrets or API keys are required; everything runs client-side.
- Images are kept with questions in IndexedDB, avoiding the small `localStorage` quota. Backups include the images.
- Built by Codex as the developer, with a human acting as product owner and QA lead.
- Tested in Microsoft Edge; iframes may behave differently in other browsers (e.g., embed autoplay quirks).
