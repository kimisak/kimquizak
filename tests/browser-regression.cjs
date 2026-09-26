/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node browser runner. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const assert = require('node:assert/strict');
let browser, server, page;
const baseUrl = process.env.QUIZ_TEST_URL || 'http://localhost:3012';
(async () => {
  if (!process.env.QUIZ_TEST_URL) {
    const command=process.env.QUIZ_TEST_PRODUCTION ? ['start'] : ['dev','--webpack'];
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next',...command,'--port','3012'], {
      env: {...process.env, QUIZ_TEST_DIST_DIR: '.next-regression'}, stdio:['ignore','pipe','pipe'],
    });
    server.stderr.on('data', data=>process.stderr.write(data));
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Test server startup timed out')),60000);
      server.stdout.on('data',data=>{if(data.toString().includes('Ready')){clearTimeout(timer);resolve()}});
      server.once('exit',code=>{clearTimeout(timer);reject(new Error('Test server exited '+code))});
    });
  }
  browser = await chromium.launch({headless:true, executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
  page = await browser.newPage({ viewport: {width:1440,height:960}, reducedMotion:'reduce' });
  const errors=[];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(baseUrl+'/config/questions');
  await page.waitForFunction(()=>localStorage.getItem('kimquizak_settings_v1')!==null);
  await Promise.all([page.waitForEvent('load'), page.getByRole('button', {name:'Add example data'}).click()]);
  await page.locator('.question-card').first().waitFor();
  await page.locator('.question-card').first().click();
  const card=page.locator('.question-card').first();
  await card.locator('textarea').first().fill('Draft test standard');
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
  await card.locator('input[type=file]').first().setInputFiles({name:'draft.png',mimeType:'image/png',buffer:png});
  await card.locator('img').first().waitFor();
  const types=['Multiple choice','Guess the audio','Challenge','Text grid','Geoguesser','Joker high/low','Timeline'];
  for (const type of types) {
    await card.locator('.question-type-picker').getByRole('button',{name:type,exact:true}).click();
    const input=type==='Timeline'?card.getByPlaceholder('Timeline',{exact:true}):card.locator('textarea').first();
    assert(!(await input.inputValue()).includes('Draft test standard'), type+' leaks standard text');
    await input.fill('Independent '+type);
  }
  await card.locator('.question-type-picker').getByRole('button',{name:'Standard',exact:true}).click();
  assert.equal(await card.locator('textarea').first().inputValue(),'Draft test standard');
  // IndexedDB saves asynchronously: verify the write completed before a hard reload.
  await page.waitForFunction(() => new Promise(resolve => {
    const open = indexedDB.open('kimquizak-content', 1);
    open.onsuccess = () => {
      const db = open.result;
      const request = db.transaction('quiz', 'readonly').objectStore('quiz').get('questions');
      request.onsuccess = () => { resolve(request.result?.[0]?.type === 'standard' && request.result?.[0]?.prompt === 'Draft test standard'); db.close(); };
      request.onerror = () => { resolve(false); db.close(); };
    };
    open.onerror = () => resolve(false);
  }));
  await page.reload();
  await page.locator('.question-card').first().click();
  assert.equal(await page.locator('.question-card').first().locator('textarea').first().inputValue(),'Draft test standard');
  assert.equal(await card.locator('img').first().getAttribute('src'),'data:image/png;base64,'+png.toString('base64'));
  for (const type of types) {
    await card.locator('.question-type-picker').getByRole('button',{name:type,exact:true}).click();
    const input=type==='Timeline'?card.getByPlaceholder('Timeline',{exact:true}):card.locator('textarea').first();
    assert.equal(await input.inputValue(),'Independent '+type);
  }
  await card.locator('.question-type-picker').getByRole('button',{name:'Standard',exact:true}).click();
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:/Download backup/}).click();
  const downloaded=await downloadPromise;
  const backupText=fs.readFileSync(await downloaded.path(),'utf8');
  const backup=JSON.parse(backupText);
  if (process.env.QUIZ_TEST_FINALE_ONLY === '1') {
    await require('./finale-reveal-browser.cjs')(page, baseUrl, backup);
    assert.deepEqual(errors, [], 'Browser runtime errors');
    return;
  }
  if (process.env.QUIZ_TEST_IMAGE_ONLY === '1') {
    await require('./image-reveal-browser.cjs')(page, baseUrl, backup);
    assert.deepEqual(errors, [], 'Browser runtime errors');
    return;
  }
  assert.equal(Object.keys(backup.questions[0].typeDrafts).length,7);
  await Promise.all([page.waitForEvent('load'), page.locator('.archive-panel input[type=file]').setInputFiles({name:'roundtrip.json',mimeType:'application/json',buffer:Buffer.from(backupText)})]);
  await page.locator('.question-card').first().click();
  assert.equal(await card.locator('textarea').first().inputValue(),'Draft test standard');
  console.log('PASS: all eight independent drafts, image, reload, backup import/export');
  for (const viewport of [{width:1440,height:960},{width:1720,height:720},{width:1920,height:1080},{width:3840,height:2160}]) {
    await page.setViewportSize(viewport);
    for (const route of ['/','/config/teams','/config/questions','/game']) {
      await page.goto(baseUrl+route);
      await page.waitForTimeout(300);
      const size=await page.evaluate(()=>({vw:innerWidth,sw:document.documentElement.scrollWidth}));
      console.log('LAYOUT',viewport,route,size);
      assert(size.sw<=size.vw+1, `${route} overflows at ${viewport.width}`);
    }
  }
  await page.setViewportSize({width:1440,height:960});
  await page.getByRole('button',{name:'Spin to begin',exact:true}).click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('kimquizak_turn_state_v1')||'{}').order?.length>0);
  await page.reload();
  await page.locator('.scoreboard-team').first().waitFor();
  await page.getByRole('button',{name:'Hide scores',exact:true}).click();
  await page.getByRole('button',{name:'Add 100 hidden points to Granbarbanden',exact:true}).click();
  await page.goto(baseUrl+'/config/teams');
  await page.goto(baseUrl+'/game');
  await page.getByRole('button',{name:'Reveal scores',exact:true}).click();
  assert.equal(await page.getByRole('spinbutton',{name:'Set score for Granbarbanden'}).inputValue(),'100');
  await page.getByRole('button',{name:/^History/}).click();
  await page.getByRole('button',{name:'Undo',exact:true}).first().click();
  assert.equal(await page.getByRole('spinbutton',{name:'Set score for Granbarbanden'}).inputValue(),'0');
  console.log('HIDDEN SCORE / ROUTES / UNDO PASS');
  // The preview button is intentionally development-only; the real finale is tested below in both modes.
  const previewViewports = process.env.QUIZ_TEST_PRODUCTION === '1' ? [] : [{width:1440,height:960},{width:1720,height:720},{width:1920,height:1080}];
  for (const vp of previewViewports) {
    await page.setViewportSize(vp);
    await page.getByRole('button',{name:'Preview finale',exact:true}).click();
    await page.getByRole('button',{name:'Continue to the podium',exact:true}).click();
    const before=await page.locator('.finale-team').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}}));
    while (await page.locator('.finale-place-reveal').count()) {
      const place = await page.locator('.finale-place-reveal').innerText();
      await page.locator('.finale-place-reveal').click();
      await page.waitForTimeout(850);
      const awaitingMore = await page.locator('.finale-place-reveal').count() > 0;
      const after=await page.locator('.finale-team').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}}));
      after.forEach((r,i)=>{assert.equal(r.width,before[i].width);assert.equal(r.height,before[i].height);if(awaitingMore)assert.equal(r.y,before[i].y)});
      const particles=await page.locator('.finale-intermediate-ooze > span').evaluateAll(els=>els.map(el=>({opacity:Number(getComputedStyle(el).opacity),duration:getComputedStyle(el).animationDuration})));
      assert(particles.some(p=>p.opacity>0.1),place+' has no visible particles');
      assert(await page.locator('.finale-actions').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight),'Finale controls clipped');
    }
    await page.screenshot({path:`/tmp/finale-${vp.width}.png`});
    await page.getByRole('button',{name:'Back to the board',exact:true}).click();
    console.log('PASS: staged finale dimensions, controls, reduced-motion particles',vp);
  }
  await page.goto(baseUrl+'/config/questions');
  await page.locator('.question-card').first().click();
  await page.locator('.question-card').first().locator('.question-type-picker').getByRole('button',{name:'Geoguesser',exact:true}).click();
  await page.locator('.question-editor select').first().selectOption('stage');
  await page.locator('.geo-stage-config p').waitFor();
  const contrast=await page.locator('.geo-stage-config p').evaluate(el=>{
    const rgb=s=>s.match(/[\d.]+/g).slice(0,3).map(Number);
    const lum=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
    return (lum(rgb(getComputedStyle(el.parentElement).backgroundColor))+.05)/(lum(rgb(getComputedStyle(el).color))+.05);
  });
  assert(contrast>=4.5,`Geo stage helper contrast only ${contrast.toFixed(2)}:1`);
  await page.screenshot({path:'/tmp/config-geo.png',fullPage:true});
  console.log('PASS: Geo stage helper contrast',contrast.toFixed(2)+':1');
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Reset game progress',exact:true}).click();
  await page.goto(baseUrl+'/game');
  await page.getByRole('button',{name:'Spin to begin',exact:true}).waitFor();
  assert.equal(await page.getByRole('spinbutton',{name:'Set score for Granbarbanden'}).inputValue(),'0');
  console.log('PASS: board reset');
  await page.goto(baseUrl+'/config/questions');
  // Draft image strings can exceed localStorage's old quota; the archive must use IndexedDB.
  const largeBackup=structuredClone(backup);
  const largeImage='data:image/png;base64,'+'A'.repeat(6*1024*1024);
  largeBackup.questions[0].typeDrafts.audio.answerImageData=largeImage;
  await Promise.all([page.waitForEvent('load'), page.locator('.archive-panel input[type=file]').setInputFiles({name:'large-draft.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(largeBackup))})]);
  const largeDownloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:/Download backup/}).click();
  const largeDownload=await largeDownloadPromise;
  const largeRoundtrip=JSON.parse(fs.readFileSync(await largeDownload.path(),'utf8'));
  assert.equal(largeRoundtrip.questions[0].typeDrafts.audio.answerImageData,largeImage);
  assert.equal(await page.evaluate(()=>localStorage.getItem('kimquizak_questions_v1')),null);
  console.log('PASS: 6 MiB inactive image draft archive round trip through IndexedDB');
  const finaleFixture={...backup,
    teams:[...backup.teams,...backup.teams.slice(0,2).map((t,i)=>({...t,id:'extra-'+i,name:['Når en pepperkakebaker','Extra team'][i],players:t.players.map(p=>({...p,id:'extra-'+i+p.id}))}))].map(t=>({...t,score:0})),
    questions:[{id:'last-question',category:'TEST CATEGORY',points:100,type:'standard',prompt:'Last question',answer:'The answer',answered:false}],
    turnState:{order:[],boardIndex:0,lyricsIndex:0},scoreHistory:[],
    settings:{...backup.settings,finaleMusicEnabled:false,stagedPodiumReveal:true,boardRevealRules:{},hostMessages:[{id:'test-toast',afterQuestionCount:1,text:'Cheers {random.player} {1-2}',revealStyle:'direct'}]},
  };
  await Promise.all([page.waitForEvent('load'), page.locator('.archive-panel input[type=file]').setInputFiles({name:'finale.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(finaleFixture))})]);
  await page.setViewportSize({width:1440,height:960});
  await page.goto(baseUrl+'/game');
  await page.getByRole('button',{name:'Spin to begin',exact:true}).click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('kimquizak_turn_state_v1')||'{}').order?.length>0);
  await page.getByRole('button',{name:'TEST CATEGORY, 100 points',exact:true}).click();
  assert(!(await page.locator('.question-modal-card').innerText()).includes('TEST CATEGORY'),'Hidden category leaked into question');
  await page.getByRole('button',{name:'Reveal answer',exact:true}).click();
  await page.getByRole('button',{name:'Correct',exact:true}).click();
  await page.getByRole('button',{name:'Continue the game',exact:true}).waitFor();
  const hostText=await page.locator('#host-message-title').innerText();
  await page.reload();
  await page.getByRole('button',{name:'Continue the game',exact:true}).waitFor();
  assert.equal(await page.locator('#host-message-title').innerText(),hostText,'Host random selection rerolled');
  await page.getByRole('button',{name:'Continue the game',exact:true}).click();
  await page.getByRole('button',{name:'Continue to the podium',exact:true}).click();
  while (await page.locator('.finale-place-reveal').count()) await page.locator('.finale-place-reveal').click();
  await page.getByRole('heading',{name:/that's a wrap!/i}).waitFor();
  assert.equal(await page.locator('.finale-encore-team').count(),2);
  assert(await page.locator('.finale-actions').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight),'Five-team finale controls clipped');
  console.log('PASS: actual final question, hidden category, host-message persistence, staged finale');
  await require('./image-reveal-browser.cjs')(page, baseUrl, backup);
  assert.deepEqual(errors,[],'Browser runtime errors');
})().catch(async e=>{
  console.error(e);
  if(page){
    console.error('Failure page:',page.url(),(await page.locator('body').innerText()).slice(-4000));
    await page.screenshot({path:'/tmp/quiz-regression-failure.png',fullPage:true});
  }
  process.exitCode=1;
}).finally(async()=>{await browser?.close();server?.kill('SIGTERM');});
