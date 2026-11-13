/* eslint-disable @typescript-eslint/no-require-imports -- Standalone browser regression. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const demo = require('../default_questions.json');
const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="#92cda1"/><circle cx="300" cy="400" r="180" fill="#ead08d"/></svg>');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(({ demo, image }) => {
      localStorage.setItem('kimquizak_settings_v1', JSON.stringify({ ...demo.settings, hostMessages: [], boardRevealRules: {}, hideCategoryHeadersAtStart: false }));
      localStorage.setItem('kimquizak_teams_v1', JSON.stringify(demo.teams));
      localStorage.setItem('kimquizak_turn_state_v1', JSON.stringify({ order: demo.teams.map(team => team.id), boardIndex: 0, lyricsIndex: 0 }));
      const choices = ['Pikachu', 'Bulbasaur', 'Squirtle', 'Sonic', 'Mario', 'Luigi', 'Zelda', 'Kirby', 'Yoshi', 'Peach', 'Bowser', 'Link'];
      localStorage.setItem('kimquizak_questions_v1', JSON.stringify([
        { id: 'longer', category: 'OPTIONS', type: 'mcq', points: 400, prompt: 'Se på bildet og vurder alternativene. Hvilke av disse figurene tilhører Pokémon-universet, og hvilke kommer fra andre kjente spillserier?', answer: '', imageData: image, mcqOptions: choices.map(name => name + ' fra en kjent spillserie'), mcqCorrectIndexes: [0, 1, 2] },
        { id: 'pictured', category: 'OPTIONS', type: 'mcq', points: 300, prompt: 'Hvilke av disse figurene er Pokémon?', answer: '', imageData: image, imageName: 'Synthetic shapes', mcqOptions: choices, mcqCorrectIndexes: [0, 1, 2], mcqRequiredCorrect: 3 },
        { id: 'plain', category: 'OPTIONS', type: 'mcq', points: 200, prompt: 'Hvilke av disse figurene er Pokémon?', answer: '', mcqOptions: choices, mcqCorrectIndexes: [0, 1, 2] },
        { id: 'four', category: 'OPTIONS', type: 'mcq', points: 100, prompt: 'Hvilket alternativ er riktig?', answer: '', imageData: image, mcqOptions: choices.slice(0, 4), mcqCorrectIndexes: [0] },
      ]));
    }, { demo, image });
    const base = process.env.QUIZ_TEST_URL || 'http://localhost:3017';
    await page.goto(base + '/game');
    const modal = page.locator('.mcq-question-modal');
    const open = points => page.getByRole('button', { name: `OPTIONS, ${points} points`, exact: true }).click();
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      for (const points of [400, 300, 200, 100]) {
        await open(points);
        const layout = await modal.evaluate(root => {
          const main = root.querySelector('.mcq-main');
          const prompt = root.querySelector('.mcq-prompt');
          const area = root.querySelector('.mcq-modal-scroll');
          const rules = root.querySelector('.mcq-rule p');
          const footer = root.querySelector('.mcq-actions');
          const buttons = [...root.querySelectorAll('.mcq-option')];
          return {
            sizes: [root, main, area].map(el => [el.clientWidth, el.scrollWidth, el.clientHeight, el.scrollHeight]),
            noScroll: [root, main, area].every(el => el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1),
            promptFits: prompt.scrollHeight <= prompt.clientHeight + 1,
            noOverlap: buttons.every(el => el.getBoundingClientRect().top >= prompt.getBoundingClientRect().bottom),
            fits: buttons.every(el => {
              const text = el.querySelector('strong');
              const box = el.getBoundingClientRect(), rect = text.getBoundingClientRect();
              return rect.top >= box.top && rect.bottom <= box.bottom + 1 && text.scrollWidth <= text.clientWidth + 1;
            }),
            font: Math.min(...buttons.map(el => parseFloat(getComputedStyle(el.querySelector('strong')).fontSize))),
            titleFont: parseFloat(getComputedStyle(prompt.querySelector('h1')).fontSize),
            rulesFont: parseFloat(getComputedStyle(rules).fontSize),
            footerFits: footer.scrollHeight <= footer.clientHeight + 1 && footer.scrollWidth <= footer.clientWidth + 1 && footer.getBoundingClientRect().bottom <= root.getBoundingClientRect().bottom + 1,
          };
        });
        assert(layout.noScroll && layout.promptFits && layout.noOverlap && layout.fits, JSON.stringify({ viewport, points, layout }));
        assert(layout.font >= (viewport.width >= 1100 ? (points === 400 ? 16 : 22) : (points === 400 ? 12 : 16)), JSON.stringify({ viewport, points, layout }));
        assert(layout.titleFont >= (viewport.width >= 1100 ? (points === 400 ? 24 : 32) : (points === 400 ? 16 : 21)), JSON.stringify({ viewport, points, layout }));
        assert(layout.footerFits && layout.rulesFont >= (viewport.width >= 1440 ? 18 : 16), JSON.stringify({ viewport, points, layout }));
        if (points === 300 && viewport.width === 1440) await page.screenshot({ path: '/tmp/mcq-readable-1440.png' });
        await page.keyboard.press('Escape');
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(300);
    const divider = page.getByRole('separator', { name: 'Resize question image' });
    const imagePane = modal.locator('.mcq-media');
    const original = await imagePane.boundingBox();
    const handle = await divider.boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + 110, handle.y + handle.height / 2, { steps: 12 });
    await page.mouse.up();
    assert((await imagePane.boundingBox()).width < original.width - 60, 'Dragging gives more width to the answers');
    const adjusted = await divider.getAttribute('aria-valuenow');
    await page.keyboard.press('Escape');
    await open(300);
    assert.equal(await divider.getAttribute('aria-valuenow'), adjusted, 'Per-question layout survives reopening');
    await divider.focus();
    await page.keyboard.press('ArrowLeft');
    assert.equal(Number(await divider.getAttribute('aria-valuenow')), Number(adjusted) + 2);
    await page.keyboard.press('Escape');
    await page.reload();
    await open(300);
    assert.equal(Number(await divider.getAttribute('aria-valuenow')), Number(adjusted) + 2, 'Layout survives reload');
    await divider.dblclick();
    assert.equal(await divider.getAttribute('aria-valuenow'), '28', 'Double click restores automatic sizing');
    await page.getByRole('button', { name: 'Expand Synthetic shapes' }).click();
    await page.getByRole('button', { name: 'Close expanded image' }).click();
    assert.equal(await modal.locator('.mcq-option.is-correct').count(), 0, 'Resizing and image expansion never submit answers');
    assert.deepEqual(errors, []);
    console.log('PASS: readable clue/options, 4/12 choices, image/no image, responsive fit, pointer/keyboard resize, persistence, reset and expanded image');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
