/* eslint-disable @typescript-eslint/no-require-imports -- Node browser regression runner. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const origin = process.env.QUIZ_TEST_URL || 'http://localhost:3016';
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/account`);
    await page.waitForURL('**/login');
    await page.getByRole('heading', { name: 'Host login' }).waitFor();
    assert.equal(await page.getByLabel('Email', { exact: true }).getAttribute('autocomplete'), 'username');
    assert.equal(await page.getByLabel('Password', { exact: true }).getAttribute('type'), 'password');
    for (const path of ['/api/quizzes', '/api/maps/config']) {
      const response = await context.request.get(origin + path);
      assert.equal(response.status(), 401);
      assert.match(response.headers()['cache-control'], /no-store/);
      assert.equal((await response.json()).apiKey, undefined);
    }
    const deniedWrite = await context.request.post(`${origin}/api/quizzes`, {
      headers: { origin }, data: { settings: { quizTitle: 'Synthetic test' } },
    });
    assert.equal(deniedWrite.status(), 401);
    await page.getByRole('link', { name: 'Continue with the public demo' }).click();
    await page.waitForURL(origin + '/');
    await page.getByRole('link', { name: /Enter game mode/ }).waitFor();
    await page.goto(`${origin}/config/questions`);
    await page.waitForFunction(() => localStorage.getItem('kimquizak_settings_v1') !== null);
    await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Add example data' }).click()]);
    await page.locator('.question-card').first().waitFor();
    await page.locator('[data-category-tab="NORSK JUL"] .question-category-tab-select').click();
    await page.locator('.question-card[data-question-category="NORSK JUL"][data-question-points="500"]').click();
    await page.getByRole('complementary', { name: 'Geoguesser setup' }).waitFor();
    await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('kimquizak_turn_state_v1') || '{}');
      state.order = JSON.parse(localStorage.getItem('kimquizak_teams_v1')).map(team => team.id);
      localStorage.setItem('kimquizak_turn_state_v1', JSON.stringify(state));
    });
    await page.goto(`${origin}/game`);
    await page.getByRole('button', { name: 'NORSK JUL, 500 points', exact: true }).click();
    const info = page.locator('.street-view-setup-status').getByRole('complementary', { name: 'Geoguesser setup' });
    await info.waitFor();
    assert.match(await info.textContent(), /no offline or image fallback/);
    const guide = info.getByRole('link', { name: 'Read the setup guide' });
    assert.match(await guide.getAttribute('href'), /README\.md#self-hosting-guide$/);
    assert.equal(await guide.getAttribute('target'), '_blank');
    await guide.click({ trial: true });
    await info.getByRole('link', { name: 'Host login' }).click({ trial: true });
    await page.screenshot({ path: '/tmp/kimquizak-geoguesser-setup.png' });
    assert.deepEqual(errors, []);
    await context.close();
    console.log('Host browser checks passed: Geoguesser infobox and links, login redirect, anonymous API denial, public demo, no page errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
