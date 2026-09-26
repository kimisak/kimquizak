/* eslint-disable @typescript-eslint/no-require-imports -- Standalone browser helper. */
const assert = require('node:assert/strict');

module.exports = async function finaleRevealRegression(page, baseUrl, backup) {
  const run = async (scores, expected, width = 1280, height = 854) => {
    const teams = scores.map((score, index) => ({ ...backup.teams[index % backup.teams.length], id: `finalist-${index}`, name: `Finalist ${index + 1}`, score,
      players: [{ id: `member-${index}`, name: `Player ${index + 1}` }],
    }));
    const fixture = { ...backup, teams, scoreHistory: [],
      questions: [{ id: 'finale-spare', type: 'standard', category: 'Finale test', points: 100, prompt: 'Not played', answer: 'Test', answered: false }],
      settings: { ...backup.settings, stagedPodiumReveal: true, finaleMusicEnabled: false, hostMessages: [], boardRevealRules: {} },
      turnState: { order: teams.map(t => t.id), boardIndex: 0, lyricsIndex: 0 },
    };
    await page.setViewportSize({ width, height });
    await page.goto(baseUrl + '/config/questions');
    await Promise.all([page.waitForEvent('load'), page.locator('.archive-panel input[type=file]').setInputFiles({ name: 'podium-tiers.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) })]);
    await page.goto(baseUrl + '/game');
    await page.getByRole('button', { name: 'Preview finale', exact: true }).click();
    await page.getByRole('button', { name: 'Continue to the podium', exact: true }).click();
    assert.equal(await page.locator('.finale-overlay .is-place-visible').count(), 0);
    const revealBounds = await page.locator('.finale-place-reveal').boundingBox();
    const backBounds = await page.locator('.finale-actions .finale-close').boundingBox();
    assert(revealBounds.x > width / 2 && revealBounds.y > height * .75, 'Reveal stays in the bottom-right action area');
    assert(revealBounds.x > backBounds.x + backBounds.width, 'Reveal does not overlap the back button');
    const row = id => page.locator(`.finale-overlay [data-team-id="finalist-${id}"]`);
    for (let i = 0; i < teams.length; i++) {
      const content = row(i).locator('.finale-team-content, .finale-encore-content');
      assert.equal(await content.isVisible(), false, `Team ${i + 1} is concealed before any reveal`);
      assert.equal(await content.evaluate(el => getComputedStyle(el).opacity), '0', 'Conceal the entire identity, including animated children');
      const label = row(i).locator('.finale-skeleton-team strong, .finale-encore-concealed');
      const ordinal = ['1st', '2nd', '3rd'][i] ?? `${i + 1}th`;
      assert.equal(await label.textContent(), `${ordinal} place`, 'Placeholder describes the slot, not a hidden tie');
    }
    const initialSize = await page.locator('.finale-team').evaluateAll(rows => rows.map(row => ({ width: row.offsetWidth, height: row.offsetHeight })));
    const initialPodium = await page.locator('.finale-podium').boundingBox();
    const seen = new Set();
    for (const [label, ids] of expected) {
      const last = label === expected.at(-1)[0];
      await page.getByRole('button', { name: 'Reveal next', exact: true }).click();
      ids.forEach(id => seen.add(id));
      for (let i = 0; i < teams.length; i++) {
        assert.equal(await row(i).evaluate(el => el.classList.contains('is-place-visible')), seen.has(i), `${label}: wrong visibility for team ${i}`);
        assert.equal(await row(i).locator('.finale-team-content, .finale-encore-content').isVisible(), seen.has(i), `${label}: name leaked`);
      }
      assert.equal(await page.locator('.finale-overlay.celebration-active').count(), last ? 1 : 0, 'Full celebration only with first place');
      for (const id of ids.filter(id => id < 3)) {
        assert(await row(id).locator('.finale-intermediate-ooze').count(), 'Each podium tier gets its own reveal burst');
      }
      const currentSize = await page.locator('.finale-team').evaluateAll(rows => rows.map(row => ({ width: row.offsetWidth, height: row.offsetHeight })));
      assert.deepEqual(currentSize, initialSize, 'Revealing teams does not resize podium rows');
      const podium = await page.locator('.finale-podium').boundingBox();
      assert(Math.abs(podium.y - initialPodium.y) < 2, 'Final headline does not move the podium');
      assert(await page.locator('.finale-actions').evaluate(el => el.getBoundingClientRect().bottom <= innerHeight + 1), 'Finale controls fit viewport');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow');
      if (last) {
        const back = await page.locator('.finale-actions .finale-close').boundingBox();
        assert(Math.abs(back.x + back.width - revealBounds.x - revealBounds.width) < 2, 'Back occupies the reveal control’s right-hand position');
        const utilities = page.locator('.finale-motion-toggle, .finale-music-status');
        for (const utility of await utilities.all()) {
          const bounds = await utility.boundingBox();
          assert(bounds.x < width / 2 && bounds.x + bounds.width <= back.x, 'Playback controls stay left, clear of the back button');
        }
      }
      if (last && teams.length > 1) {
        const z = await page.locator('.finale-team').evaluateAll(rows => rows.map(row => Number(getComputedStyle(row).zIndex)));
        assert(z[0] > z[1], 'Winner must be above second-place ooze');
        assert(await row(0).locator('.finale-intermediate-ooze').count(), 'Winner gets its reveal burst');
        await page.waitForTimeout(450);
        await page.screenshot({ path: `/tmp/finale-tier-reveal-${teams.length}-${width}.png` });
        const winnerBounds = await row(0).boundingBox();
        const overWinner = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('.finale-team')?.getAttribute('data-team-id'), { x: winnerBounds.x + winnerBounds.width / 2, y: winnerBounds.y + winnerBounds.height / 2 });
        assert.equal(overWinner, 'finalist-0', 'Second-place effects do not cover winner content');
      }
    }
    assert.equal(await page.locator('.finale-place-reveal').count(), 0);
    if (teams.length === 4 && scores[0] === 400 && scores[2] === 200) {
      await page.waitForSelector('.finale-fountain');
      assert.equal(await page.locator('.finale-fountain').count(), 2);
      assert.equal(await page.locator('.finale-fountain-flight').count(), 36);
      await page.waitForTimeout(700);
      const particles = await page.locator('.finale-fountain-flight > span').evaluateAll(nodes => nodes.map(n => {
        const r = n.getBoundingClientRect(); return { x:r.x, y:r.y, opacity:getComputedStyle(n).opacity };
      }));
      assert(particles.some(p => Number(p.opacity) > .1), 'Fountain spray becomes visible');
      await page.waitForTimeout(200);
      const moved = await page.locator('.finale-fountain-flight > span').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().y));
      assert(moved.some((y, i) => Math.abs(y - particles[i].y) > 2), 'Spray moves through its arc');
      await page.screenshot({ path:'/tmp/finale-fountains.png' });
      await page.waitForSelector('.finale-flush', { state:'detached' });
      assert.equal(await row(3).locator('.finale-player-pill.is-flushed').count(), 1, 'Lower-place players stay upset after the shower');
      assert.equal(await row(3).locator('.finale-flush-residue > i').count(), 24, 'Plenty of tiny residue remains after the shower');
      const floor = await row(3).locator('.finale-flush-residue').boundingBox();
      const teamBounds = await row(3).boundingBox();
      assert(floor.y >= teamBounds.y && floor.y + floor.height <= teamBounds.y + teamBounds.height, 'Residue stays inside the row');
      const players = await row(3).locator('.finale-player-list').boundingBox();
      assert(floor.y >= players.y + players.height, 'Floor stays below the player names');
      assert.equal(await page.locator('.finale-podium .is-flushed').count(), 0, 'Unaffected podium players keep celebrating');
      const face = row(3).locator('.finale-player-mood');
      const mood = await face.textContent();
      assert(['😱', '😢', '😬', '🤢', '🤮'].includes(mood));
      await page.waitForTimeout(1100);
      assert.notEqual(await face.textContent(), mood, 'Upset reactions continue cycling after the spray ends');
    }
    await page.getByRole('button', { name: 'Back to the board', exact: true }).click();
    console.log(`PASS: ${teams.length}-team reveal ${scores.join('/')} at ${width}x${height}`);
  };
  await run([400, 300, 200, 100], [['4th', [3]], ['3rd', [2]], ['2nd', [1]], ['1st', [0]]]);
  await run([500, 400, 300, 200, 100], [['5th', [4]], ['4th', [3]], ['3rd', [2]], ['2nd', [1]], ['1st', [0]]], 1720, 720);
  await run([400, 300, 300, 100], [['4th', [3]], ['2nd', [1, 2]], ['1st', [0]]]);
  await run([400, 300, 200, 200, 100], [['5th', [4]], ['3rd', [2, 3]], ['2nd', [1]], ['1st', [0]]]);
  await run([0, 0, 0, 0], [['Reveal the winners', [0, 1, 2, 3]]]);
  await run([200, 100], [['2nd', [1]], ['1st', [0]]]);
  await run([100], [['Reveal the winner', [0]]]);
};
