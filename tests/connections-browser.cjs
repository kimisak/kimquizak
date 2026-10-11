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
    const groups = [
      { label:'Things you can fold', words:['Paper','Laundry','Arms','Poker hand'] },
      { label:'Musical instruments', words:['Piano','Flute','Drums','Violin'] },
      { label:'Weather', words:['Rain','Snow','Hail','Fog'] },
      { label:'Norwegian letters and words', words:['Æ','Ø','Å','Snø'] },
    ];
    const question = { id:'connections', category:'GAMES', points:400, type:'connections', prompt:'Find the connections', answer:'', answered:false, connectionsGroups:groups };
    const fixture = { ...demo, questions:[question, { id:'spare', category:'GAMES', points:100, type:'standard', prompt:'Spare', answer:'Answer', answered:false }], turnState:{ order:demo.teams.map(team => team.id), boardIndex:0, lyricsIndex:0 }, settings:{ ...demo.settings, boardRevealRules:{}, hostMessages:[], hideCategoryHeadersAtStart:false } };
    const importQuiz = async data => {
      await page.goto(origin + '/config/questions');
      await page.waitForFunction(() => localStorage.getItem('kimquizak_settings_v1'));
      await Promise.all([page.waitForEvent('load'), page.locator('.archive-panel input[type=file]').setInputFiles({ name:'synthetic-connections.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(data)) })]);
    };
    const exportQuiz = async () => {
      const promise = page.waitForEvent('download');
      await page.getByRole('button', { name:/Download backup/ }).click();
      return JSON.parse(fs.readFileSync(await (await promise).path(), 'utf8'));
    };
    const open = async () => {
      await page.locator('a[href="/game"]').first().click();
      await page.waitForURL('**/game');
      await page.getByRole('button', { name:'GAMES, 400 points', exact:true }).click();
    };
    const progress = () => page.evaluate(() => JSON.parse(localStorage.getItem('kimquizak_turn_state_v1')).connectionsProgress?.connections);
    const scores = () => page.evaluate(() => JSON.parse(localStorage.getItem('kimquizak_teams_v1')).map(team => team.score));
    const modal = page.locator('.connections-modal');
    const pick = async words => { for (const word of words) await modal.getByRole('button', { name:word, exact:true }).click(); };
    const submit = () => modal.getByRole('button', { name:'Submit group', exact:true });
    const assertFits = async () => {
      const issues = await modal.evaluate(root => {
        const box = root.getBoundingClientRect();
        const nodes = [root, ...root.querySelectorAll('.connections-body,.connections-play-grid,.connections-tile,.connections-group,.connections-actions')];
        return nodes.flatMap(node => {
          const rect = node.getBoundingClientRect();
          return rect.bottom > box.bottom + 1 || rect.right > box.right + 1 || node.scrollHeight > node.clientHeight + 2 ? [node.className] : [];
        });
      });
      assert.deepEqual(issues, [], 'Connections fits the card');
    };
    // Author the new type, including type-draft restoration and backup.
    await importQuiz({ ...fixture, questions:[{ ...question, type:'standard', connectionsGroups:undefined, answer:'A' }, fixture.questions[1]] });
    const card = page.locator('.question-card[data-question-points="400"]');
    await card.click();
    await card.getByRole('button', { name:'Connections', exact:true }).click();
    assert.equal(await card.getByRole('spinbutton', { name:'Seconds per guess' }).inputValue(), '120');
    assert.equal(await card.getByRole('spinbutton', { name:'Shared mistake limit' }).inputValue(), '4');
    const puzzleText = groups.map(group => `${group.label}: ${group.words.join(', ')}`).join('\n');
    await card.getByRole('textbox', { name:'Connections puzzle', exact:true }).fill('Unfinished connection:');
    let draft = await exportQuiz();
    assert.equal(draft.questions[0].connectionsText, 'Unfinished connection:');
    await page.reload();
    await card.click();
    assert.equal(await card.getByRole('textbox', { name:'Connections puzzle', exact:true }).inputValue(), 'Unfinished connection:');
    await card.getByRole('textbox', { name:'Connections puzzle', exact:true }).fill(puzzleText);
    for (const width of [1920,1440,1024,768,390,320]) {
      await page.setViewportSize({width,height:900});
      const fits = await card.locator('.question-type-picker').evaluate(element => element.scrollWidth <= element.clientWidth && [...element.children].every(button => button.getBoundingClientRect().right <= element.getBoundingClientRect().right));
      assert(fits, `Question types fit at ${width}`);
      const inputFits = await card.locator('.connections-text-input').evaluate(element => element.scrollHeight <= element.clientHeight + 2 && element.scrollWidth <= element.clientWidth);
      assert(inputFits, `Puzzle text fits without scrollbars at ${width}`);
    }
    await page.setViewportSize({width:1440,height:900});
    await card.getByRole('button', { name:'Standard', exact:true }).click();
    await card.getByRole('button', { name:'Connections', exact:true }).click();
    assert.equal(await card.getByRole('textbox', { name:'Connections puzzle', exact:true }).inputValue(), puzzleText);
    let saved = await exportQuiz();
    assert.deepEqual(saved.questions[0].connectionsGroups, groups);
    await open();
    assert.equal(await modal.locator('.connections-tile').count(), 0, 'No puzzle before starting');
    await modal.getByRole('button', { name:'Start round', exact:true }).click();
    assert.equal(await modal.locator('.connections-tile').count(), 16);
    assert.equal(await modal.getByText(groups[0].label, { exact:true }).count(), 0, 'Connections concealed');
    assert(await submit().isDisabled());
    for (const viewport of [{ width:1440,height:900 }, { width:1280,height:720 }, { width:1024,height:600 }, { width:390,height:844 }]) {
      await page.setViewportSize(viewport); await assertFits();
    }
    await page.setViewportSize({ width:1440,height:900 });
    await page.screenshot({ path:'/tmp/kimquizak-connections-play.png' });
    await pick(groups[0].words);
    await submit().evaluate(button => { button.click(); button.click(); });
    assert.deepEqual(await scores(), [100,0,0]);
    assert.equal((await progress()).teamId, demo.teams[0].id);
    const deadline = (await progress()).deadline;
    const beforeShuffle = await modal.locator('.connections-tile').allTextContents();
    const beforeState = await progress();
    await modal.getByRole('button', {name:'Shuffle',exact:true}).click();
    const tileOrder = await modal.locator('.connections-tile').allTextContents();
    assert.notDeepEqual(tileOrder, beforeShuffle);
    assert.deepEqual([...tileOrder].sort(), [...beforeShuffle].sort());
    assert.deepEqual({...await progress(),order:beforeState.order},beforeState);
    assert.equal(await modal.locator('.connections-group.earned').count(),1);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name:'GAMES, 400 points', exact:true }).click();
    assert.deepEqual(await modal.locator('.connections-tile').allTextContents(), tileOrder);
    assert.equal((await progress()).deadline, deadline);
    await pick(['Piano','Flute','Drums','Rain']); await submit().click();
    assert.equal((await progress()).teamId, demo.teams[1].id);
    assert.equal((await progress()).mistakes, 1);
    assert.equal(await modal.locator('.connections-hint').textContent(), 'Three are correct');
    const selectedWords = () => modal.locator('.connections-tile[aria-pressed="true"]').allTextContents();
    assert.deepEqual((await selectedWords()).sort(), ['Piano','Flute','Drums','Rain'].sort(), 'Wrong submission keeps all four tiles selected across rollover');
    assert(await submit().isDisabled(), 'An unchanged wrong combination cannot be submitted again');
    await modal.locator('.connections-hint').waitFor({state:'detached'});
    assert.equal((await selectedWords()).length,4,'Selection survives fading feedback');
    await modal.getByRole('button',{name:'Rain',exact:true}).click();
    assert.equal((await selectedWords()).length,3);
    await modal.getByRole('button',{name:'Violin',exact:true}).click();
    assert(await submit().isEnabled());
    await submit().click();
    assert.equal((await selectedWords()).length,0,'Solved tiles leave the active selection');
    assert.deepEqual(await scores(), [100,100,0]);
    await page.reload();
    await page.getByRole('button', { name:'GAMES, 400 points', exact:true }).click();
    assert.equal((await progress()).solved.length, 2);
    page.once('dialog', dialog => dialog.accept());
    await modal.getByRole('button', { name:'End round', exact:true }).click();
    assert.equal((await progress()).finishReason, 'host');
    assert.equal(await modal.locator('.connections-group.revealed').count(), 0);
    await page.waitForFunction(() => document.querySelectorAll('.connections-group.revealed').length === 1);
    assert(await modal.getByRole('button', { name:'Continue', exact:true }).isDisabled());
    await page.waitForFunction(() => document.querySelectorAll('.connections-group.revealed').length === 2);
    assert.deepEqual(await scores(), [100,100,0], 'Answer reveal awards no points');
    await page.screenshot({ path:'/tmp/kimquizak-connections-answers.png' });
    await modal.getByRole('button', { name:'Continue', exact:true }).click();
    await page.locator('a[href="/config/questions"]').first().click();
    saved = await exportQuiz();
    assert(saved.questions[0].answered);
    await importQuiz(saved);
    assert.deepEqual(await scores(), [100,100,0]);
    assert.equal((await progress()).solved.length, 2);
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name:'Reset game progress', exact:true }).click();
    assert.equal(await progress(), undefined);
    assert.deepEqual(await scores(), [0,0,0]);
    // Timer is per guess; rollover off retains team until shared limit.
    await importQuiz({ ...fixture, questions:[{ ...question, connectionsRotateOnMiss:false, connectionsGuessSeconds:2, connectionsMistakeLimit:2 }, fixture.questions[1]] });
    await open(); await modal.getByRole('button', { name:'Start round', exact:true }).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('kimquizak_turn_state_v1')).connectionsProgress.connections.mistakes === 1);
    assert.equal((await progress()).teamId, demo.teams[0].id);
    assert(!(await progress()).finished);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('kimquizak_turn_state_v1')).connectionsProgress.connections.finished);
    assert.equal((await progress()).finishReason, 'mistakes');
    assert.deepEqual(await scores(), [0,0,0]);
    // A clean sweep ends immediately and pays the whole question pool.
    await importQuiz({ ...fixture, questions:[{ ...question, connectionsGuessSeconds:0 }, fixture.questions[1]] });
    await open(); await modal.getByRole('button', { name:'Start round', exact:true }).click();
    for (const group of groups) { await pick(group.words); await submit().click(); }
    assert.equal((await progress()).finishReason, 'solved');
    assert.deepEqual(await scores(), [400,0,0]);
    assert(await modal.getByRole('button', { name:'Continue', exact:true }).isEnabled());
    // Four real connections, but the host can require any 1, 2 or 3 to finish.
    for (const target of [1,2,3]) {
      await importQuiz({ ...fixture, questions:[{ ...question, connectionsGuessSeconds:0 },fixture.questions[1]] });
      await card.click();
      await card.getByRole('combobox',{name:'Connections needed to finish',exact:true}).selectOption(String(target));
      saved = await exportQuiz();
      assert.equal(saved.questions[0].connectionsGroups.length,4);
      assert.equal(saved.questions[0].connectionsRequired,target);
      await importQuiz(saved);
      await open();
      assert(!/timer|seconds per guess/i.test(await modal.innerText()), 'Disabled timer has no text');
      assert(await modal.getByRole('heading',{name:`Find any ${target} of 4 connections`,exact:true}).isVisible());
      const initialOrder = (await progress()).order;
      await modal.getByRole('button',{name:'Start round',exact:true}).click();
      assert.notDeepEqual((await progress()).order,initialOrder,'Reveal actually shuffles the order');
      assert.equal(await modal.locator('.connections-tile').count(),16);
      assert.equal(await modal.locator('[role=timer]').count(),0);
      for (let index=0; index<target; index++) {
        await pick(groups[3-index].words); await submit().click();
        assert.equal((await progress()).finished,index === target-1);
      }
      assert.equal((await progress()).finishReason,'solved');
      assert.deepEqual(await scores(),[400,0,0]);
      assert.equal(await modal.locator('.connections-group.earned').count(),target);
      assert.equal(await modal.locator('.connections-group.pending').count(),4-target);
      assert(await modal.getByRole('button',{name:'Continue',exact:true}).isDisabled());
      await modal.getByRole('button',{name:'Reveal all now',exact:true}).click();
      assert.equal(await modal.locator('.connections-group.revealed').count(),4-target);
      assert.deepEqual(await scores(),[400,0,0], 'Revealing the remaining real groups adds no points');
      for (const viewport of [{width:1280,height:720},{width:390,height:844}]) {
        await page.setViewportSize(viewport); await assertFits();
      }
      await page.setViewportSize({width:1440,height:900});
    }
    assert.deepEqual(errors, []);
    console.log('PASS: Connections authoring, drafts, layout, scoring, rollover, per-guess timeout, animated answers, persistence, backup and reset');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
