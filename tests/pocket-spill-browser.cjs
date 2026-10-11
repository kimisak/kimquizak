/* eslint-disable @typescript-eslint/no-require-imports -- Standalone browser regression. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const base = process.env.QUIZ_TEST_URL || 'http://localhost:3016';
    await page.goto(base + '/config/questions');
    await page.waitForFunction(() => localStorage.getItem('kimquizak_settings_v1') !== null);
    await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Add example data' }).click()]);
    await page.goto(base + '/game');
    const player = page.locator('.scoreboard-player').first();
    const pickup = async () => {
      await player.waitFor();
      await player.scrollIntoViewIfNeeded();
      const box = await player.boundingBox();
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      assert(await player.evaluate(el => el.classList.contains('is-dragging')));
      return { x, y };
    };
    const shake = async ({ x, y }) => {
      // Exactly the requested interaction: grab, up, down, up. No preparatory lift.
      for (const dy of [-24, 24, -24]) {
        await page.mouse.move(x, y + dy, { steps: 4 });
        await page.waitForTimeout(80);
      }
      assert.equal(await player.evaluate(el => el.classList.contains('mood-dizzy')), false);
      assert.equal(await page.locator('[data-pocket-particle]').count(), 0, 'Keep the delayed reveal');
    };
    const spin = async ({ x, y }, interval) => {
      for (let i = 0; i <= 40; i++) {
        const angle = i * Math.PI / 16;
        await page.mouse.move(x + Math.cos(angle) * 60, y - 100 + Math.sin(angle) * 60);
        await page.waitForTimeout(interval);
      }
      assert.equal(await player.evaluate(el => el.classList.contains('mood-dizzy')), true, 'Circular movement triggers dizzy eyes');
      assert.equal(await page.locator('[data-pocket-particle]').count(), 0, 'Spinning does not mix with falling items');
    };
    const held = await pickup();
    await shake(held);
    await page.locator('[data-pocket-particle]').first().waitFor({ timeout: 3000 });
    await page.waitForTimeout(450);
    await page.screenshot({ path: '/tmp/pocket-spill.png' });
    // Spinning remains available after a spill without dropping/regrabbing.
    await spin(held, 25);
    await page.mouse.up();
    await page.reload();
    await shake(await pickup());
    await page.mouse.up();
    await page.locator('[data-pocket-particle]').first().waitFor({ timeout: 3000 });
    await page.waitForTimeout(3500);
    assert.equal(await page.locator('[data-pocket-particle]').count(), 0, 'Released-player particles are cleaned up');
    await page.reload();
    const paused = await pickup();
    await page.mouse.move(paused.x, paused.y - 100);
    await page.waitForTimeout(2500);
    await spin(paused, 100); // Slow circle, longer than the old 1.8-second window.
    await page.mouse.up();
    assert.deepEqual(errors, []);
    console.log('PASS: up-down-up held/released spills; spinning after spill and after holding still');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
