/* eslint-disable @typescript-eslint/no-require-imports -- Standalone browser regression. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const demo = require('../default_questions.json');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(demo => {
        localStorage.setItem('kimquizak_settings_v1', JSON.stringify({ ...demo.settings, themeId: 'capra-liflig', companyBranding: true }));
        localStorage.setItem('kimquizak_teams_v1', JSON.stringify(demo.teams));
        localStorage.setItem('kimquizak_host_profile_v1', JSON.stringify({ id: 'kimquizak-host', name: 'Test Host', emoji: '🎤' }));
      }, demo);
      await page.goto((process.env.QUIZ_TEST_URL || 'http://localhost:3017') + '/game');
      const player = page.locator('.scoreboard-player:not(.scoreboard-host-player)').first();
      const booth = page.locator('.scoreboard-host-booth');
      const scores = () => page.evaluate(() => JSON.parse(localStorage.getItem('kimquizak_teams_v1')).map(team => team.score));
      const initialScores = await scores();
      const visit = async () => {
        await booth.scrollIntoViewIfNeeded();
        await player.hover();
        await page.mouse.down();
        const target = await booth.boundingBox();
        await page.mouse.move(target.x + target.width - 35, target.y + target.height / 2, { steps: 10 });
        await page.mouse.up();
        await page.getByRole('dialog').waitFor();
      };
      // Decorative hands and props must never create another grid row.
      const effectLayout = await player.evaluate(el => {
        const before = el.getBoundingClientRect();
        const reaction = document.createElement('span');
        reaction.className = 'scoreboard-player-reaction';
        reaction.textContent = '🙌';
        el.append(reaction);
        const after = el.getBoundingClientRect();
        const absolute = getComputedStyle(reaction).position;
        const next = el.nextElementSibling;
        const nextReaction = reaction.cloneNode(true);
        next?.append(nextReaction);
        const aboveNeighbour = !next || Number(getComputedStyle(el).zIndex) > Number(getComputedStyle(next).zIndex);
        nextReaction.remove();
        reaction.remove();
        return { before: [before.width, before.height], after: [after.width, after.height], absolute, aboveNeighbour };
      });
      assert.deepEqual(effectLayout.after, effectLayout.before, 'Hands do not resize player pill');
      assert.equal(effectLayout.absolute, 'absolute');
      assert(effectLayout.aboveNeighbour, 'Effects stay above the next pill, even when both have effects');
      const boothLayout = await booth.evaluate(el => ({
        width: el.getBoundingClientRect().width,
        parentWidth: el.parentElement.clientWidth,
        height: el.getBoundingClientRect().height,
      }));
      if (width === 1440) {
        const positions = await page.evaluate(() => {
          const box = selector => document.querySelector(selector).getBoundingClientRect();
          const booth = box('.scoreboard-host-booth');
          const effects = box('.scoreboard-header-actions');
          const controls = box('.scoreboard-score-actions');
          const label = box('.scoreboard-host-label');
          const host = box('.scoreboard-host-player');
          return { between: booth.left >= effects.right && booth.right <= controls.left,
            aligned: Math.abs(label.top + label.height / 2 - host.top - host.height / 2) < 2 };
        });
        assert(positions.between, 'Booth fills space between effects and score controls');
        assert(positions.aligned, 'Host pill and label share vertical centre');
      }
      const buttonHeight = await page.locator('.scoreboard-visibility-toggle').evaluate(el => el.getBoundingClientRect().height);
      assert(Math.abs(boothLayout.height - buttonHeight) < 2, 'Booth matches score button height');
      await visit();
      const dialog = page.getByRole('dialog');
      assert.equal(await dialog.locator('.scoreboard-player').count(), 2, 'Scene reuses player pills');
      assert.equal(await dialog.locator('.scoreboard-player-mood').count(), 2);
      const firstTitle = await dialog.getByRole('heading').textContent();
      const rect = await dialog.boundingBox();
      assert(rect.x >= 0 && rect.x + rect.width <= width, 'Scene fits viewport');
      assert(rect.y >= 0 && rect.y + rect.height <= 900, 'Controls fit vertically');
      assert.equal(await dialog.evaluate(el => el.scrollWidth > el.clientWidth), false);
      await page.screenshot({ path: `/tmp/host-scene-${width}.png` });
      for (let i = 0; i < 3; i++) await dialog.getByRole('button', { name: 'Next line' }).click();
      await dialog.getByRole('button', { name: 'Back to the team' }).click();
      await dialog.waitFor({ state: 'detached' });
      await page.waitForFunction(() => !document.querySelector('.scoreboard-host-booth')?.hasAttribute('data-hangout-phase'));
      assert.deepEqual(await scores(), initialScores, 'Scene never changes scores');
      await visit();
      assert.notEqual(await dialog.getByRole('heading').textContent(), firstTitle, 'No consecutive repeat');
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'detached' });
      await page.waitForFunction(() => !document.querySelector('.scoreboard-host-booth')?.hasAttribute('data-hangout-phase'));
      await visit();
      await dialog.getByRole('button', { name: 'Skip scene' }).click();
      await dialog.waitFor({ state: 'detached' });
      assert.deepEqual(await scores(), initialScores);
      if (width === 1440) {
        await page.waitForFunction(() => !document.querySelector('.scoreboard-host-booth')?.hasAttribute('data-hangout-phase'));
        await visit();
        await dialog.waitFor({ state: 'detached', timeout: 20000 });
        await page.waitForFunction(() => !document.querySelector('.scoreboard-host-booth')?.hasAttribute('data-hangout-phase'));
        assert.deepEqual(await scores(), initialScores, 'Automatic scene completion keeps scores');
      }
      assert.deepEqual(errors, []);
      await page.close();
      console.log('PASS: scene dialogue, next/return/skip/Escape, no repeat, unchanged scores, viewport', width);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
