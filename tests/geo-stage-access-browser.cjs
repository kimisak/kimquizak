/* eslint-disable @typescript-eslint/no-require-imports -- Standalone browser regression. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const demo = require('../default_questions.json');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  try {
    for (const width of [1440, 390]) {
      for (const status of [401, 503]) {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        const errors = [];
        const googleRequests = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => {
          if (request.url().startsWith('https://maps.googleapis.com/')) googleRequests.push(request.url());
        });
        await page.route('**/api/maps/config', route => route.fulfill({
          status, contentType: 'application/json',
          body: JSON.stringify({ error: status === 401 ? 'Sign in as the host to use Street View.' : 'Google Maps API key is not configured' }),
        }));
        await page.addInitScript(demo => {
          localStorage.setItem('kimquizak_settings_v1', JSON.stringify({ ...demo.settings, hostMessages: [], boardRevealRules: {}, hideCategoryHeadersAtStart: false }));
          localStorage.setItem('kimquizak_teams_v1', JSON.stringify(demo.teams));
          localStorage.setItem('kimquizak_turn_state_v1', JSON.stringify({ order: demo.teams.map(team => team.id), boardIndex: 0, lyricsIndex: 0 }));
          localStorage.setItem('kimquizak_questions_v1', JSON.stringify([
            { id: 'geo', type: 'geoguesser', category: 'MAP', points: 100, prompt: 'Find the place', answer: 'Bergen', answered: false, mapEmbedUrl: 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=60.39,5.32', geoExplorationMode: 'stage' },
            { id: 'spare', type: 'standard', category: 'MAP', points: 200, prompt: 'Spare', answer: 'A', answered: false },
          ]));
        }, demo);
        await page.goto((process.env.QUIZ_TEST_URL || 'http://localhost:3017') + '/game');
        await page.getByRole('button', { name: 'MAP, 100 points', exact: true }).click();
        const message = status === 401 ? 'Sign in through Host to use Street View.' : 'Google Maps is not configured';
        const warning = page.locator('.street-view-setup-status');
        await warning.waitFor({ state: 'visible' });
        assert.equal(await warning.getByText(message, { exact: true }).isVisible(), true, 'Load failure is visible');
        assert.equal(await page.getByRole('link', { name: 'Host login ↗', exact: true }).isVisible(), true);
        assert.equal(await page.getByRole('link', { name: 'Read the setup guide ↗' }).isVisible(), true);
        assert.equal(await page.locator('.geo-stage-curtain').count(), 0, 'Intro cannot cover the error');
        assert.equal(await page.getByRole('button', { name: 'Start exploring', exact: true }).isDisabled(), true);
        assert.equal(await page.getByText('Preparing Street View…', { exact: true }).count(), 0);
        assert.deepEqual(googleRequests, [], 'Failed access never loads a Google Maps script');
        assert.deepEqual(errors, []);
        await page.screenshot({ path: `/tmp/geo-access-${width}-${status}.png` });
        console.log('PASS: visible stage access failure, disabled Start, setup links:', width, status);
        await page.close();
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
