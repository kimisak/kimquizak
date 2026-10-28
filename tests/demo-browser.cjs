/* eslint-disable @typescript-eslint/no-require-imports -- Standalone browser regression. */
const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto((process.env.QUIZ_TEST_URL || 'http://localhost:3016') + '/config/questions');
    await page.waitForFunction(() => localStorage.getItem('kimquizak_settings_v1') !== null);
    await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Add example data' }).click()]);
    await page.locator('.question-card').first().waitFor();
    await page.locator('[data-category-tab="DEMO EXTRAS"] .question-category-tab-select').click();
    const imageCard = page.locator('.question-card[data-question-category="DEMO EXTRAS"][data-question-points="100"]');
    await imageCard.click();
    await imageCard.locator('.image-reveal-canvas svg image').first().waitFor({ state: 'attached' });
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download backup/ }).click();
    const download = await downloadPromise;
    const payload = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    const expected = JSON.parse(fs.readFileSync('default_questions.json', 'utf8'));
    assert.deepEqual(payload.teams, expected.teams, 'Import/export preserves only the synthetic roster and bonds');
    assert.equal(payload.questions.length, 17);
    assert(payload.questions.some(question => question.type === 'imageReveal' && question.imageData));
    assert(payload.questions.some(question => question.type === 'trivia' && question.triviaItems.length === 3));
    assert.deepEqual(payload.scoreHistory, []);
    assert.deepEqual(errors, []);
    console.log('PASS: fictional demo import/export, mock bonds, and public-domain zoom image render');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
