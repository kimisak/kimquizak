/* eslint-disable @typescript-eslint/no-require-imports -- Standalone browser regression. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const demo = require('../default_questions.json');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const origin = process.env.QUIZ_TEST_URL || 'http://127.0.0.1:3016';
    const fixture = { ...demo, questions: [{ id: 'many-choices', category: 'OPTIONS', points: 500, type: 'mcq', prompt: 'Which is the last answer?', answer: '', mcqOptions: ['Answer 1', 'Answer 2', 'Answer 3', 'Answer 4'], mcqCorrectIndex: 3, mcqRotateOnMiss: true, answered: false }, { id: 'spare', category: 'OPTIONS', points: 100, type: 'standard', prompt: 'Spare', answer: 'Answer', answered: false }],
      turnState: { order: demo.teams.map(t => t.id), boardIndex: 0, lyricsIndex: 0 },
      settings: { ...demo.settings, boardRevealRules: {}, hostMessages: [], hideCategoryHeadersAtStart: false } };
    await page.goto(origin + '/config/questions');
    await page.waitForFunction(() => localStorage.getItem('kimquizak_settings_v1'));
    await Promise.all([page.waitForEvent('load'), page.locator('.archive-panel input[type=file]').setInputFiles({ name: 'synthetic-mcq.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) })]);
    const card = page.locator('.question-card[data-question-points="500"]');
    await card.click();
    for (let i = 5; i <= 12; i++) {
      await card.getByRole('button', { name: 'Add option', exact: true }).click();
      await card.getByRole('textbox', { name: `Option ${i}`, exact: true }).fill(`Answer ${i}`);
      await card.getByRole('textbox', { name: `Option ${i}`, exact: true }).blur();
    }
    console.log('Added 12 options');
    assert(await card.getByRole('button', { name: 'Add option', exact: true }).isDisabled());
    await card.getByRole('checkbox', { name: 'Option 4 is correct', exact: true }).uncheck();
    await card.getByRole('checkbox', { name: 'Option 12 is correct', exact: true }).check();
    await card.getByRole('button', { name: 'Remove option 1', exact: true }).click();
    assert(await card.getByRole('checkbox', { name: 'Option 11 is correct', exact: true }).isChecked());
    await card.getByRole('button', { name: 'Remove option 11', exact: true }).click();
    assert.equal(await card.locator('input[type=checkbox][aria-label^="Option"]:checked').count(), 0);
    for (let i = 11; i <= 12; i++) {
      await card.getByRole('button', { name: 'Add option', exact: true }).click();
      await card.getByRole('textbox', { name: `Option ${i}`, exact: true }).fill(`Final ${i}`);
      await card.getByRole('textbox', { name: `Option ${i}`, exact: true }).blur();
    }
    await card.getByRole('checkbox', { name: 'Option 12 is correct', exact: true }).check();
    console.log('Correct-answer removal verified');
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download backup/ }).click();
    const backup = JSON.parse(fs.readFileSync(await (await downloaded).path(), 'utf8'));
    assert.equal(backup.questions[0].mcqOptions.length, 12);
    assert.equal(backup.questions[0].mcqCorrectIndex, 11);
    assert(backup.questions[0].mcqOptions.every(option => option.trim()), JSON.stringify(backup.questions[0].mcqOptions));
    await page.reload(); await card.click();
    assert.equal(await card.getByRole('textbox', { name: /^Option \d+$/ }).count(), 12);
    assert(await card.getByRole('checkbox', { name: 'Option 12 is correct', exact: true }).isChecked());
    console.log('Backup and reload verified');
    await page.goto(origin + '/game');
    await page.getByRole('button', { name: 'OPTIONS, 500 points', exact: true }).click().catch(async error => { console.log((await page.locator('body').innerText()).slice(-2500)); throw error; });
    const modal = page.locator('.mcq-question-modal');
    const assertFits = async () => {
      const layout = await modal.evaluate(root => {
        const main = root.querySelector('.mcq-main');
        const prompt = root.querySelector('.mcq-prompt').getBoundingClientRect();
        const viewport = root.querySelector('.mcq-modal-scroll').getBoundingClientRect();
        const buttons = [...root.querySelectorAll('.mcq-option')];
        return {
          noScroll: [main, root.querySelector('.mcq-modal-scroll')].every(el => el.scrollHeight <= el.clientHeight + 1),
          belowPrompt: buttons.every(el => el.getBoundingClientRect().top >= prompt.bottom),
          insideCard: buttons.every(el => el.getBoundingClientRect().bottom <= viewport.bottom + 1),
          textFits: buttons.every(el => {
            const box = el.getBoundingClientRect(), text = el.querySelector('strong').getBoundingClientRect();
            return text.top >= box.top && text.bottom <= box.bottom + 1;
          }),
        };
      });
      assert.deepEqual(layout, { noScroll: true, belowPrompt: true, insideCard: true, textFits: true });
    };
    assert.equal(await modal.locator('.mcq-option').count(), 12);
    for (const viewport of [{width:1440,height:900}, {width:1280,height:720}, {width:390,height:844}]) {
      await page.setViewportSize(viewport);
      await assertFits();
      assert(await modal.locator('.mcq-option').last().isVisible());
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await modal.locator('.mcq-option').first().click();
    assert(await modal.locator('.mcq-option').first().isDisabled());
    await assertFits();
    await modal.locator('.mcq-option').last().click();
    assert(await modal.locator('.mcq-option').last().evaluate(el => el.classList.contains('is-correct')));
    await page.screenshot({ path: '/tmp/kimquizak-mcq-12.png' });
    // The image layout also needs to keep answer L reachable on short screens.
    backup.questions[0].prompt = 'Which of these twelve choices is the final answer? Read all the alternatives carefully before choosing the answer for your team.';
    backup.questions[0].mcqOptions = backup.questions[0].mcqOptions.map((text, index) => `Choice ${index + 1}: a longer possible answer`);
    backup.questions[0].imageData = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="green"/></svg>');
    await page.goto(origin + '/config/questions');
    await Promise.all([page.waitForEvent('load'), page.locator('.archive-panel input[type=file]').setInputFiles({ name: 'synthetic-mcq-image.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) })]);
    await page.goto(origin + '/game');
    await page.getByRole('button', { name: 'OPTIONS, 500 points', exact: true }).click();
    for (const viewport of [{width:1280,height:720}, {width:1024,height:600}, {width:390,height:844}]) {
      await page.setViewportSize(viewport);
      await assertFits();
    }
    await modal.locator('.mcq-option').last().click();
    assert(await modal.locator('.mcq-option').last().evaluate(el => el.classList.contains('is-correct')));
    await page.goto(origin + '/config/questions'); await card.click();
    for (let count = 12; count > 2; count--) await card.getByRole('button', { name: `Remove option ${count}`, exact: true }).click();
    assert(await card.getByRole('button', { name: 'Remove option 1', exact: true }).isDisabled());
    assert.equal(await card.getByRole('textbox', { name: /^Option \d+$/ }).count(), 2);
    assert.deepEqual(errors, []);
    console.log('PASS: 12-option editing, removal/correct-answer tracking, backup, reload, responsive layout, rollover and answer L');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
