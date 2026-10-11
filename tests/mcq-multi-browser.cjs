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
    page.on('pageerror', error => errors.push(error.message));
    const origin = process.env.QUIZ_TEST_URL || 'http://127.0.0.1:3016';
    const fixture = { ...demo, questions: [
      { id: 'pokemon', category: 'POKEMON', points: 300, type: 'mcq', prompt: 'Which ones are Pokémon?', answer: '', mcqOptions: ['Pikachu', 'Sonic', 'Bulbasaur', 'Mario', 'Squirtle', 'Link', 'Kirby', 'Yoshi', 'Zelda', 'Luigi', 'Peach', 'Bowser'], mcqCorrectIndexes: [0, 2, 4], mcqRequiredCorrect: 3, mcqRotateOnMiss: true, answered: false },
      { id: 'spare', category: 'POKEMON', points: 100, type: 'standard', prompt: 'Spare', answer: 'Answer', answered: false },
    ], turnState: { order: demo.teams.map(team => team.id), boardIndex: 0, lyricsIndex: 0 }, settings: { ...demo.settings, boardRevealRules: {}, hostMessages: [], hideCategoryHeadersAtStart: false } };
    const importQuiz = async data => {
      await page.goto(origin + '/config/questions');
      await page.waitForFunction(() => localStorage.getItem('kimquizak_settings_v1'));
      await Promise.all([page.waitForEvent('load'), page.locator('.archive-panel input[type=file]').setInputFiles({ name: 'synthetic-multi.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) })]);
    };
    const exportQuiz = async () => {
      const promise = page.waitForEvent('download');
      await page.getByRole('button', { name: /Download backup/ }).click();
      return JSON.parse(fs.readFileSync(await (await promise).path(), 'utf8'));
    };
    const open = async () => {
      await page.locator('a[href="/game"]').first().click();
      await page.waitForURL('**/game');
      await page.getByRole('button', { name: 'POKEMON, 300 points', exact: true }).click();
    };
    const scores = () => page.evaluate(() => JSON.parse(localStorage.getItem('kimquizak_teams_v1')).map(team => team.score));
    const progress = () => page.evaluate(() => JSON.parse(localStorage.getItem('kimquizak_turn_state_v1')).mcqProgress.pokemon);
    const modal = page.locator('.mcq-question-modal');
    const option = index => modal.locator('.mcq-option').nth(index);
    await importQuiz(fixture);
    const card = page.locator('.question-card[data-question-points="300"]');
    await card.click();
    assert.equal(await card.locator('input[aria-label^="Option "]:checked').count(), 3);
    await card.getByRole('combobox', { name: 'Correct answers needed to finish' }).selectOption('2');
    let saved = await exportQuiz();
    assert.equal(saved.questions[0].mcqRequiredCorrect, 2);
    assert.deepEqual(saved.questions[0].mcqCorrectIndexes, [0, 2, 4]);
    await card.getByRole('combobox', { name: 'Correct answers needed to finish' }).selectOption('3');
    await open();
    await option(0).evaluate(el => { el.click(); el.click(); });
    assert.deepEqual(await scores(), [100, 0, 0], 'Duplicate click awards only once');
    assert(await option(0).isDisabled());
    assert.equal(await option(2).evaluate(el => el.classList.contains('is-correct')), false, 'Unfound correct answers stay concealed');
    assert.equal((await progress()).finished, false);
    await page.screenshot({ path: '/tmp/kimquizak-mcq-multiple.png' });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'POKEMON, 300 points', exact: true }).click();
    assert(await option(0).isDisabled());
    assert.deepEqual(await scores(), [100, 0, 0]);
    await option(1).click();
    assert.equal((await progress()).teamId, fixture.teams[1].id);
    assert.deepEqual(await scores(), [100, 0, 0], 'Miss keeps earned points');
    await page.reload();
    await page.getByRole('button', { name: 'POKEMON, 300 points', exact: true }).click();
    assert(await option(0).isDisabled()); assert(await option(1).isDisabled());
    await option(2).click();
    assert.deepEqual(await scores(), [100, 100, 0]);
    assert.equal((await progress()).teamId, fixture.teams[1].id, 'Correct pick keeps turn');
    await option(4).click();
    assert.deepEqual(await scores(), [100, 200, 0]);
    assert((await progress()).finished);
    await modal.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.goto(origin + '/config/questions');
    saved = await exportQuiz();
    assert(saved.questions[0].answered);
    assert.equal(saved.turnState.mcqProgress.pokemon.found.length, 3);
    await importQuiz(saved);
    assert.deepEqual(await scores(), [100, 200, 0], 'Backup restores split scores');
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Reset game progress', exact: true }).click();
    assert.deepEqual(await scores(), [0, 0, 0]);
    assert.equal(await progress(), undefined, 'Reset clears MCQ progress');
    await importQuiz({ ...fixture, questions: [{ ...fixture.questions[0], mcqRequiredCorrect: 2 }, fixture.questions[1]] });
    await open(); await option(0).click(); await option(2).click();
    assert.deepEqual(await scores(), [300, 0, 0]);
    assert((await progress()).finished, 'Finding any two closes a three-correct-answer question');
    assert(await option(4).isDisabled());
    await importQuiz({ ...fixture, questions: [{ ...fixture.questions[0], mcqRotateOnMiss: false }, fixture.questions[1]] });
    await open(); await option(0).click(); await option(1).click();
    assert.deepEqual(await scores(), [100, 0, 0]);
    assert((await progress()).finished, 'Without rollover, a miss closes the question');
    assert.deepEqual(errors, []);
    console.log('PASS: multiple correct answers, target setting, split scoring, rollover, duplicate guard, close/reload/backup persistence, reset and no-rollover finish');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
