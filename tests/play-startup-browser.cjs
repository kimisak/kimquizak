/* eslint-disable @typescript-eslint/no-require-imports -- Standalone browser regression. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const demo = require('../default_questions.json');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(demo => {
      if (!sessionStorage.getItem('startup-seeded')) {
        localStorage.setItem('kimquizak_settings_v1', JSON.stringify({ ...demo.settings, themeId: 'easter', companyBranding: true, hideCategoryHeadersAtStart: false }));
        // Deliberately save the previous palette, as happens with imported quizzes.
        localStorage.setItem('kimquizak_teams_v1', JSON.stringify(demo.teams));
        localStorage.setItem('kimquizak_questions_v1', JSON.stringify([
          { id: 'startup-question', category: 'Startup', points: 100, type: 'standard', prompt: 'Ready?', answer: 'Yes', answered: false },
        ]));
        localStorage.setItem('kimquizak_turn_state_v1', JSON.stringify({ order: demo.teams.map(team => team.id), boardIndex: 0, lyricsIndex: 0 }));
        sessionStorage.setItem('startup-seeded', 'true');
      }
      window.playFrames = [];
      function sample() {
        const game = document.querySelector('.game-page');
        if (game) {
          const podium = game.querySelector('.game-leaderboard-panel');
          const board = game.querySelector('.game-board-panel');
          window.playFrames.push({
            spinner: game.querySelector('.turn-draw')?.textContent || '',
            resolved: Boolean(game.querySelector('.turn-draw.resolved')),
            tiles: game.querySelectorAll('.quiz-board-tile').length,
            podium: Boolean(podium),
            podiumTop: podium?.getBoundingClientRect().top,
            boardBottom: board?.getBoundingClientRect().bottom,
          });
        }
        requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    }, demo);
    const base = process.env.QUIZ_TEST_URL || 'http://localhost:3017';
    const check = async label => {
      await page.getByRole('button', { name: 'Startup, 100 points', exact: true }).waitFor();
      await page.getByLabel('Board turn order').waitFor();
      await page.waitForTimeout(250);
      const frames = await page.evaluate(() => window.playFrames);
      assert(frames.some(frame => frame.podium), `${label}: podium rendered`);
      for (const frame of frames) {
        assert(!/[🎄🎁🔔]/u.test(frame.spinner), `${label}: no Christmas identities before Easter`);
        if (frame.podium) {
          assert(frame.resolved, `${label}: saved turn order renders resolved immediately`);
          assert.equal(frame.tiles, 1, `${label}: podium appears with the populated board`);
          assert(frame.podiumTop >= frame.boardBottom, `${label}: podium stays below the board`);
        }
      }
      const teams = await page.evaluate(() => JSON.parse(localStorage.getItem('kimquizak_teams_v1')));
      assert.deepEqual(teams.map(team => team.name), demo.teams.map(team => team.name), 'Saved roster is preserved');
    };
    await page.goto(`${base}/game`);
    await check('direct load');
    await page.reload();
    await check('reload');
    await page.getByRole('navigation').getByRole('link', { name: 'Questions' }).click();
    await page.waitForURL('**/config/questions');
    await page.evaluate(() => { window.playFrames = []; });
    await page.getByRole('navigation').getByRole('link', { name: 'Play' }).click();
    await page.waitForURL('**/game');
    await check('client navigation');
    await page.getByRole('button', { name: 'Redraw', exact: false }).click();
    await page.locator('.turn-draw.spinning').waitFor();
    await page.locator('.turn-draw.resolved').waitFor();
    const order = await page.evaluate(() => JSON.parse(localStorage.getItem('kimquizak_turn_state_v1')).order);
    assert.deepEqual([...order].sort(), demo.teams.map(team => team.id).sort(), 'Redraw preserves the saved roster');
    assert.deepEqual(errors, []);
    console.log('PASS: first-frame team palette, saved roster, and board/podium startup layout');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
