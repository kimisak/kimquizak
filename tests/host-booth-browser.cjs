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
        localStorage.setItem('kimquizak_questions_v1', JSON.stringify(demo.questions.filter(question => question.type === 'standard')));
        localStorage.setItem('kimquizak_turn_state_v1', JSON.stringify({ order: demo.teams.map(team => team.id), boardIndex: 0, lyricsIndex: 0 }));
        localStorage.setItem('kimquizak_host_profile_v1', JSON.stringify({ id: 'kimquizak-host', name: 'Test Host', emoji: '🎤' }));
      }, demo);
      await page.goto((process.env.QUIZ_TEST_URL || 'http://localhost:3017') + '/game');
      const player = page.locator('.scoreboard-player:not(.scoreboard-host-player)').first();
      const booth = page.locator('.scoreboard-host-booth');
      const scores = () => page.evaluate(() => JSON.parse(localStorage.getItem('kimquizak_teams_v1')).map(team => team.score));
      const initialScores = await scores();
      const teamData = () => page.evaluate(() => JSON.parse(localStorage.getItem('kimquizak_teams_v1')).map(({ id, name, score, players }) => ({ id, name, score, players })));
      const originalTeams = await teamData();
      const playerName = await player.locator('.scoreboard-player-name').textContent();
      const teamList = player.locator('..');
      const teamLabel = await teamList.getAttribute('aria-label');
      const homePlayer = () => page.getByRole('list', { name: teamLabel, exact: true }).locator('.scoreboard-player').filter({ has: page.getByText(playerName, { exact: true }) });
      const visit = async (checkMovement = false) => {
        await booth.scrollIntoViewIfNeeded();
        await homePlayer().hover();
        await page.mouse.down();
        const target = await booth.boundingBox();
        await page.mouse.move(target.x + target.width - 35, target.y + target.height / 2, { steps: 10 });
        await page.mouse.up();
        await booth.locator('.scoreboard-guest-player').waitFor();
        if (checkMovement) {
          const movement = await page.getByRole('list', { name: teamLabel, exact: true }).locator('.scoreboard-player').first().evaluate(async element => {
            const animation = element.getAnimations().find(animation => {
              const frames = animation.effect.getKeyframes();
              return frames.length === 2 && frames[0].transform && frames[0].transform !== frames[1].transform;
            });
            if (!animation) return null;
            const during = element.getBoundingClientRect();
            await animation.finished;
            const after = element.getBoundingClientRect();
            return Math.hypot(after.left - during.left, after.top - during.top);
          });
          assert(movement !== null && movement > 1, 'Teammates visibly move to close the gap instead of snapping');
        }
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
        const laterPillAbove = !next || Number(getComputedStyle(next).zIndex) > Number(getComputedStyle(el).zIndex);
        nextReaction.remove();
        reaction.remove();
        return { before: [before.width, before.height], after: [after.width, after.height], absolute, laterPillAbove };
      });
      assert.deepEqual(effectLayout.after, effectLayout.before, 'Hands do not resize player pill');
      assert.equal(effectLayout.absolute, 'absolute');
      assert(effectLayout.laterPillAbove, 'Later pills and their effects overlap in front of earlier pills');
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
      await visit(true);
      const guest = booth.locator('.scoreboard-guest-player');
      assert.equal(await guest.locator('.scoreboard-player-name').textContent(), playerName);
      assert.equal(await homePlayer().count(), 0, 'Guest leaves the podium visually');
      assert.equal(await booth.locator('.scoreboard-player').count(), 2, 'Host and guest stand together');
      assert.equal(await page.getByRole('dialog').count(), 0, 'Visit never opens an overlay');
      const assertVisit = async () => {
        assert.deepEqual(await scores(), initialScores, 'Visiting never changes scores');
        assert.deepEqual(await teamData(), originalTeams, 'Membership and team data stay untouched');
        const layout = await booth.evaluate(el => {
          const rect = el.getBoundingClientRect();
          return { fits: rect.left >= 0 && rect.right <= innerWidth,
            playersFit: [...el.querySelectorAll('.scoreboard-player')].every(player => { const pill = player.getBoundingClientRect(); return pill.left >= rect.left && pill.right <= rect.right; }) };
        });
        assert(layout.fits && layout.playersFit, `Booth and both players fit the viewport: ${JSON.stringify(layout)}`);
        if (await guest.count()) {
          const hostBox = await booth.locator('.scoreboard-host-player').boundingBox();
          const guestBox = await guest.boundingBox();
          const overlap = Math.min(guestBox.y + guestBox.height, hostBox.y + hostBox.height) - Math.max(guestBox.y, hostBox.y);
          assert(guestBox.x >= hostBox.x + hostBox.width - 2 && overlap > Math.min(guestBox.height, hostBox.height) / 2, `Guest stands beside the host: ${JSON.stringify({ hostBox, guestBox })}`);
        }
      };
      await assertVisit();
      await page.screenshot({ path: `/tmp/host-booth-${width}.png` });
      if (width === 1440) {
        const applyEffect = async (name, target) => {
          await page.getByRole('button', { name: `Drag ${name} onto a team or the host`, exact: true }).hover();
          await page.mouse.down();
          const rect = await target.boundingBox();
          await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2, { steps: 6 });
          await page.mouse.up();
        };
        await applyEffect('Beer shower', booth);
        assert.equal(await guest.locator('.scoreboard-player-prop.is-beer').count(), 1, 'Booth guest receives booth effects');
        await applyEffect('Snow flurry', page.locator('.scoreboard-team').first());
        assert.equal(await guest.locator('.scoreboard-player-prop.is-beer').count(), 1, 'Home team effect does not replace booth effect');
        assert.equal(await guest.locator('.scoreboard-player-prop.is-snow').count(), 0, 'Guest does not receive home team effects');
        await applyEffect('Party burst', booth);
        assert.equal(await guest.locator('.scoreboard-player-prop.is-confetti').count(), 1, 'New booth effect replaces the old one');
      }
      // Quiz play remains available and does not dismiss the guest.
      await page.locator('.quiz-board-tile:not(:disabled)').first().click();
      await page.keyboard.press('Escape');
      assert.equal(await guest.count(), 1, 'Guest stays while a question is opened and closed');
      await booth.scrollIntoViewIfNeeded();
      // Drop the guest outside the booth to return to their own team.
      await guest.hover(); await page.mouse.down();
      const home = await page.getByRole('list', { name: teamLabel, exact: true }).boundingBox();
      await page.mouse.move(home.x + home.width / 2, home.y + home.height / 2, { steps: 10 });
      await page.waitForTimeout(180); // A held drop must walk home too, without relying on throw velocity.
      await page.mouse.up();
      await page.locator('.scoreboard-player-home').waitFor({ state: 'attached' });
      assert.equal(await guest.count(), 1, 'Returning guest walks home before leaving the booth DOM');
      await homePlayer().waitFor();
      assert.equal(await page.locator('.scoreboard-player-home').count(), 0, 'Reserved space becomes the returned pill');
      assert.equal(await guest.count(), 0);
      if (width === 1440) {
        assert.equal(await homePlayer().locator('.scoreboard-player-prop.is-snow').count(), 1, 'Returned player receives their team effect');
        assert.equal(await homePlayer().locator('.scoreboard-player-prop.is-confetti').count(), 0, 'Returned player no longer receives booth effects');
      }
      // A second guest replaces the first without creating a queue.
      await visit();
      const second = page.locator('.scoreboard-team .scoreboard-player').first();
      const secondName = await second.locator('.scoreboard-player-name').textContent();
      await second.hover(); await page.mouse.down();
      const target = await booth.boundingBox();
      await page.mouse.move(target.x + target.width - 15, target.y + target.height / 2, { steps: 10 });
      await page.mouse.up();
      await homePlayer().waitFor();
      assert.equal(await guest.locator('.scoreboard-player-name').textContent(), secondName);
      assert.equal(await booth.locator('.scoreboard-player').count(), 2);
      await assertVisit();
      assert.equal(await booth.getByRole('button').count(), 0, 'Returning uses dragging, without extra controls');
      await guest.hover(); await page.mouse.down();
      const outside = await page.locator('.scoreboard-team').first().boundingBox();
      await page.mouse.move(outside.x + outside.width / 2, outside.y + outside.height / 2, { steps: 10 });
      await page.mouse.up();
      await page.locator('.scoreboard-team .scoreboard-player').filter({ has: page.getByText(secondName, { exact: true }) }).waitFor();
      assert.equal(await guest.count(), 0);
      assert.equal(await booth.locator('.scoreboard-player').count(), 1);
      await assertVisit();
      assert.deepEqual(errors, []);
      await page.close();
      console.log('PASS: host booth drop, persistent guest during play, drag return, replacement, unchanged membership/scores, viewport', width);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
