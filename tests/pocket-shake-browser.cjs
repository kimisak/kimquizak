/* eslint-disable @typescript-eslint/no-require-imports -- Standalone browser regression. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const demo = require('../default_questions.json');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  try {
    for (const reducedMotion of ['no-preference', 'reduce']) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(demo => {
        localStorage.setItem('kimquizak_settings_v1', JSON.stringify(demo.settings));
        localStorage.setItem('kimquizak_teams_v1', JSON.stringify(demo.teams));
      }, demo);
      await page.goto((process.env.QUIZ_TEST_URL || 'http://localhost:3017') + '/game');
      const player = page.locator('.scoreboard-player:not(.scoreboard-host-player)').first();
      await player.scrollIntoViewIfNeeded();
      const box = await player.boundingBox();
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x, y - 90, { steps: 15 });
      await page.waitForTimeout(100);
      await page.mouse.move(x + 6, y - 25, { steps: 15 });
      await page.waitForTimeout(100);
      await page.mouse.move(x - 5, y - 100, { steps: 15 });
      const particles = page.locator('[data-pocket-particle]');
      await particles.first().waitFor();
      await page.waitForTimeout(150);
      const visible = await particles.evaluateAll(elements => elements.some(el => {
        const style = getComputedStyle(el);
        return Number(style.opacity) > 0.1 && parseFloat(style.animationDuration) >= 0.5;
      }));
      assert(visible, 'Pocket contents remain visible with motion preference: ' + reducedMotion);
      const trajectory = await particles.first().evaluate(el => {
        const animation = el.getAnimations()[0];
        const elapsed = animation.currentTime;
        animation.pause();
        const sample = time => {
          animation.currentTime = time;
          const rect = el.getBoundingClientRect();
          return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        };
        const launch = sample(0);
        const peak = sample(195);
        const fall = sample(975);
        animation.currentTime = elapsed;
        animation.play();
        return { launch, peak, fall };
      });
      assert(trajectory.peak.y < trajectory.launch.y - 15, 'Contents launch upwards from the pocket');
      assert(Math.abs(trajectory.fall.x - trajectory.launch.x) > 60, 'Contents spray sideways');
      assert(trajectory.fall.y > trajectory.launch.y + 200, 'Contents visibly fall down');
      await page.mouse.up();
      assert.deepEqual(errors, []);
      console.log('PASS: vertical shake visibly spills pocket contents:', reducedMotion);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
