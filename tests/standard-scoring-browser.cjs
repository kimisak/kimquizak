/* eslint-disable @typescript-eslint/no-require-imports -- Standalone browser regression. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const demo = require('../default_questions.json');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  try {
    const page = await browser.newPage({ viewport: { width:1440, height:900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const origin = process.env.QUIZ_TEST_URL || 'http://localhost:3017';
    const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#92cda1"/></svg>');
    const base = { category:'MUSIC', type:'standard', prompt:'Name the song and the artist.', answer:'A fictional song · A fictional artist', answered:false };
    const fixture = { ...demo, questions:[
      { ...base, id:'single', points:100 },
      { ...base, id:'none', points:200, standardAnswerCount:2 },
      { ...base, id:'two', points:300 },
      { ...base, id:'image', points:400, standardAnswerCount:3, answerImageData:image },
      { ...base, id:'three', points:500, standardAnswerCount:3 },
      { ...base, id:'many', points:600, standardAnswerCount:12 },
      { ...base, id:'four', points:700, standardAnswerCount:4 },
    ], scoreHistory:[], turnState:{ order:demo.teams.map(team => team.id), boardIndex:0, lyricsIndex:0 }, settings:{ ...demo.settings, boardRevealRules:{}, hostMessages:[], hideCategoryHeadersAtStart:false } };
    const importQuiz = async data => {
      await page.goto(origin + '/config/questions');
      await page.waitForFunction(() => localStorage.getItem('kimquizak_settings_v1'));
      await Promise.all([page.waitForEvent('load'), page.locator('.archive-panel input[type=file]').setInputFiles({ name:'synthetic-standard.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(data)) })]);
      await page.locator('.question-card[data-question-points="300"]').waitFor();
    };
    const exportQuiz = async () => {
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name:/Download backup/ }).click();
      return JSON.parse(fs.readFileSync(await (await download).path(), 'utf8'));
    };
    const modal = page.locator('.standard-question-modal');
    const applyButton = modal.locator('.standard-marking-award');
    const open = async points => {
      await page.getByRole('button', { name:`MUSIC, ${points} points`, exact:true }).click();
      await modal.getByRole('button', { name:'Reveal answer', exact:true }).click();
    };
    const scores = () => page.evaluate(() => JSON.parse(localStorage.getItem('kimquizak_teams_v1')).map(team => team.score));
    await importQuiz(fixture);
    const card = page.locator('.question-card[data-question-points="300"]');
    await card.click();
    const answerCount = card.getByRole('spinbutton', { name:'Answers that earn points' });
    assert.equal(await answerCount.inputValue(), '1');
    await answerCount.fill('13'); await answerCount.blur();
    assert.equal(await answerCount.inputValue(), '12', 'Configured count is capped at twelve');
    await answerCount.fill('0'); await answerCount.blur();
    assert.equal(await answerCount.inputValue(), '1', 'Configured count has a minimum of one');
    await answerCount.fill(''); await answerCount.blur();
    assert.equal(await answerCount.inputValue(), '1', 'Clearing the config field restores the default');
    await answerCount.fill('2'); await answerCount.blur();
    await card.getByRole('button', { name:'Multiple choice', exact:true }).click();
    await card.getByRole('button', { name:'Standard', exact:true }).click();
    assert.equal(await answerCount.inputValue(), '2', 'Type drafts restore split scoring');
    let saved = await exportQuiz();
    assert.equal(saved.questions.find(q => q.id === 'two').standardAnswerCount, 2);
    await page.reload(); await card.click();
    assert.equal(await answerCount.inputValue(), '2', 'Answer count survives reload');
    await page.goto(origin + '/game');
    for (const viewport of [{width:1920,height:1080},{width:1280,height:720},{width:390,height:844}]) {
      await page.setViewportSize(viewport);
      for (const points of [300,400,500,600,700]) {
        await open(points);
        assert.equal(await applyButton.isDisabled(), points !== 600 && points !== 700, 'Numeric marking starts at zero; button choices require a selection');
        const layout = await modal.evaluate(root => {
          const footer = root.querySelector('.standard-marking-actions');
          const box = root.getBoundingClientRect();
          const controls = [...footer.querySelectorAll('button,input,select')];
          return { fits:footer.scrollWidth <= footer.clientWidth + 1 && footer.getBoundingClientRect().bottom <= box.bottom + 1 && controls.every(el => { const r=el.getBoundingClientRect(); return r.top >= box.top && r.right <= box.right + 1 && r.left >= box.left - 1 && r.bottom <= box.bottom + 1; }),
            scrollFits:root.querySelector('.standard-modal-scroll').scrollHeight <= root.querySelector('.standard-modal-scroll').clientHeight + 1 };
        });
        assert(layout.fits && layout.scrollFits, JSON.stringify({viewport,points,layout}));
        if (points === 600 || points === 700) {
          assert.equal(await modal.locator('.standard-marking-option').count(), 0, 'Four or more answers use a compact control');
          const count = points === 600 ? 12 : 4;
          const result = modal.getByRole('combobox', { name:'Correct answers', exact:true });
          assert.equal(await result.inputValue(), '0', 'Result opens at zero');
          assert.equal(await result.locator('option').count(), count+1);
          assert.equal(await modal.locator('.standard-marking-stepper').count(), 0, 'The counter is retired');
          const boxes = async () => ({ result:await result.boundingBox(), apply:await applyButton.boundingBox() });
          const initial = await boxes();
          const assertStable = async () => {
            const current = await boxes();
            for (const control of ['result','apply']) for (const dimension of ['x','y','width','height']) {
              assert(Math.abs(current[control][dimension] - initial[control][dimension]) < 1, `Stable ${control} ${dimension}: ${JSON.stringify({initial,current})}`);
            }
          };
          for (const value of [1,count,0]) {
            await result.selectOption(String(value));
            await assertStable();
            assert.deepEqual(await scores(), [0,0,0], 'Selecting a result never applies points');
            assert(await modal.getByRole('button', { name:`Apply & continue ${Math.floor(points*value/count)} pts`, exact:true }).isEnabled());
          }
          await result.focus();
          await page.keyboard.press('ArrowDown');
          await page.keyboard.press('Enter');
          assert.equal(await result.inputValue(), '1', 'Result selector supports the keyboard');
          await page.keyboard.press('Tab');
          await assertStable();
          if (points === 600 && viewport.width === 1920) {
            await result.selectOption('7');
            assert.equal(await result.locator('option:checked').textContent().then(text => text.trim()), '7 correct · 350 pts');
            await page.screenshot({ path:'/tmp/standard-result-selector-1080.png' });
          }
          if (points === 600 && viewport.width === 390) await page.screenshot({ path:'/tmp/standard-result-selector-mobile.png' });

        } else {
          assert.equal(await modal.locator('.standard-marking-option').count(), points === 300 ? 3 : 4, 'Two and three answers retain buttons');
        }
        if (viewport.width === 1920 && points === 300) {
          await modal.getByRole('button', { name:'1 of 2 correct · 150 pts', exact:true }).click();
          assert.deepEqual(await scores(), [0,0,0], 'Selecting a result does not award yet');
          await page.screenshot({ path:'/tmp/standard-partial-credit-1080.png' });
        }
        await page.keyboard.press('Escape');
      }
    }
    await page.setViewportSize({width:1440,height:900});
    await open(300);
    await modal.getByRole('button', { name:'2 of 2 correct · 300 pts', exact:true }).click();
    await modal.getByRole('button', { name:'1 of 2 correct · 150 pts', exact:true }).click();
    await modal.getByRole('button', { name:'Apply & continue 150 pts', exact:true }).evaluate(el => { el.click(); el.click(); });
    assert.deepEqual(await scores(), [150,0,0], 'Partial credit is awarded once');
    assert.equal(await page.getByRole('button', { name:/^MUSIC, 300 points, played/ }).isDisabled(), true);
    await open(500);
    await modal.getByRole('button', { name:'2 of 3 correct · 333 pts', exact:true }).click();
    await modal.getByRole('button', { name:'Apply & continue 333 pts', exact:true }).click();
    assert.deepEqual(await scores(), [150,333,0], 'Rounded partial credit goes to the next team');
    await open(200);
    await modal.getByRole('button', { name:'0 of 2 correct · 0 pts', exact:true }).click();
    await modal.getByRole('button', { name:'Apply & continue 0 pts', exact:true }).click();
    assert.deepEqual(await scores(), [150,333,0], 'Zero credit closes the question without changing scores');
    await open(100);
    assert.equal(await modal.locator('.standard-marking-options').count(), 0, 'Existing questions retain Wrong/Correct');
    await modal.getByRole('button', { name:'Correct', exact:true }).click();
    assert.deepEqual(await scores(), [250,333,0]);
    await open(400);
    await modal.getByRole('button', { name:'3 of 3 correct · 400 pts', exact:true }).click();
    await modal.getByRole('button', { name:'Apply & continue 400 pts', exact:true }).click();
    assert.deepEqual(await scores(), [250,733,0], 'Full credit preserves the entire point value');
    await open(600);
    await modal.getByRole('combobox', { name:'Correct answers', exact:true }).selectOption('7');
    await modal.getByRole('button', { name:'Apply & continue 350 pts', exact:true }).click();
    assert.deepEqual(await scores(), [250,733,350], 'The compact control awards the selected share');
    await page.goto(origin + '/config/questions');
    saved = await exportQuiz();
    assert(saved.scoreHistory.some(entry => entry.questionId === 'two' && entry.delta === 150 && entry.reason.includes('1/2 correct answers')));
    assert(saved.questions.find(q => q.id === 'none').answered);
    await importQuiz(saved);
    assert.deepEqual(await scores(), [250,733,350], 'Backup restores partial scores');
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name:'Reset game progress', exact:true }).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('kimquizak_teams_v1')).every(team => team.score === 0));
    const reset = await exportQuiz();
    assert.equal(reset.questions.length, fixture.questions.length, 'Reset keeps question content');
    assert(reset.questions.every(question => !question.answered), 'Reset clears played tiles');
    await page.locator('a[href="/game"]').first().click();
    await page.waitForURL('**/game');
    await page.getByRole('button', { name:'Spin to begin', exact:true }).click();
    await open(300);
    const openingTeam = await page.evaluate(() => JSON.parse(localStorage.getItem('kimquizak_turn_state_v1')).order[0]);
    await modal.getByRole('button', { name:'2 of 2 correct · 300 pts', exact:true }).click();
    await modal.getByRole('button', { name:'Apply & continue 300 pts', exact:true }).click();
    assert.deepEqual(await scores(), fixture.teams.map(team => team.id === openingTeam ? 300 : 0), 'A reset allows the same question to be scored again');
    assert.deepEqual(errors, []);
    console.log('PASS: standard split-point config/drafts, answer UI, responsive layout, partial/full/zero scores, duplicate guard, turn advance, backup and reset');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
