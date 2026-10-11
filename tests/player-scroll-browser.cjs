/* eslint-disable @typescript-eslint/no-require-imports -- Standalone browser regression. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const demo = require('../default_questions.json');
(async () => {
  const browser = await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
  try {
    const page = await browser.newPage({viewport:{width:1280,height:800}});
    const origin = process.env.QUIZ_TEST_URL || 'http://127.0.0.1:3016';
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin+'/config/questions');
    await page.waitForFunction(()=>localStorage.getItem('kimquizak_settings_v1'));
    const fixture={...demo, turnState:{order:demo.teams.map(t=>t.id),boardIndex:0,lyricsIndex:0},settings:{...demo.settings,hostMessages:[],boardRevealRules:{}}};
    await Promise.all([page.waitForEvent('load'),page.locator('.archive-panel input[type=file]').setInputFiles({name:'synthetic-scroll.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))})]);
    await page.locator('a[href="/game"]').first().click();
    const player=page.locator('.scoreboard-player').first();
    await player.waitFor();
    // Make room to exercise scrolling in both directions in an isolated browser.
    await page.evaluate(()=>{document.body.style.paddingBottom='1000px';document.documentElement.style.scrollBehavior='auto';});
    await player.scrollIntoViewIfNeeded();
    const center=()=>player.evaluate(element=>{const r=element.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};});
    const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    let pointer=await center();
    await page.mouse.move(pointer.x,pointer.y); await page.mouse.down();
    await page.mouse.move(pointer.x+15,pointer.y-55,{steps:5});
    pointer={x:pointer.x+15,y:pointer.y-55};
    const held=await center();
    for(const delta of [160,-90,110,-80]) {
      const before=await page.evaluate(()=>window.scrollY);
      await page.mouse.wheel(0,delta);
      await page.waitForFunction(y=>window.scrollY!==y,before);
      await settle();
      const after=await center();
      assert(Math.abs(after.x-held.x)<2 && Math.abs(after.y-held.y)<2,`Held player moved while scrolling: ${JSON.stringify({held,after})}`);
    }
    await page.mouse.move(pointer.x+20,pointer.y+10,{steps:3});
    const moved=await center();
    assert(Math.abs(moved.x-held.x-20)<2 && Math.abs(moved.y-held.y-10)<2,'Pointer movement after scrolling stays aligned');
    assert(!(await player.getAttribute('class')).includes('mood-dizzy'),'Scroll does not trigger spinning');
    await page.mouse.up();
    await page.waitForFunction(()=>!document.querySelector('.scoreboard-player.is-dragging'));
    // Wait for the normal return animation before testing a directly scrolling parent.
    await page.waitForFunction(()=>document.querySelector('.scoreboard-player').getAnimations().length===0);
    await player.evaluate(element=>{
      const parent=element.parentElement;
      parent.style.cssText+=';display:block;overflow:auto;width:250px;height:120px;scroll-behavior:auto';
      const spacer=document.createElement('li');spacer.style.cssText='width:900px;height:700px;pointer-events:none';parent.appendChild(spacer);
    });
    await player.scrollIntoViewIfNeeded();
    pointer=await center();
    await page.mouse.move(pointer.x,pointer.y);await page.mouse.down();
    const nestedHeld=await center();
    await player.evaluate(element=>element.parentElement.scrollTo(70,60));await settle();
    const nestedAfter=await center();
    assert(Math.abs(nestedAfter.x-nestedHeld.x)<2 && Math.abs(nestedAfter.y-nestedHeld.y)<2,'Parent scrolling on both axes preserves pointer alignment');
    await page.mouse.up();
    await page.waitForFunction(()=>!document.querySelector('.scoreboard-player.is-dragging'));
    assert.deepEqual(errors,[]);
    console.log('PASS: stationary drag during page and nested scrolling, continued pointer movement, release and no false dizzy gesture');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
