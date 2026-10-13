/* eslint-disable @typescript-eslint/no-require-imports -- Standalone browser regression. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const demo = require('../default_questions.json');
(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(demo => {
      localStorage.setItem('kimquizak_settings_v1',JSON.stringify({...demo.settings,hostMessages:[],boardRevealRules:{},hideCategoryHeadersAtStart:false}));
      localStorage.setItem('kimquizak_teams_v1',JSON.stringify(demo.teams));
      localStorage.setItem('kimquizak_turn_state_v1',JSON.stringify({order:demo.teams.map(team=>team.id),boardIndex:0,lyricsIndex:0}));
      localStorage.setItem('kimquizak_questions_v1',JSON.stringify([
        {...demo.questions.find(question=>question.type==='audio'),category:'AUDIO',points:100,answered:false},
        {id:'spare',category:'AUDIO',points:200,type:'standard',prompt:'Spare',answer:'A',answered:false},
      ]));
      window.audioPauses = 0;
      window.audioCreates = 0;
      window.audioDestroys = 0;
      // The iframe exposes playback methods only after its ready event.
      window.YT = {
        PlayerState:{PLAYING:1,ENDED:0,BUFFERING:3,PAUSED:2,CUED:5},
        Player:class {
          constructor(_host,options) {
            window.audioCreates++;
            window.makeAudioReady = () => {
              this.cueVideoById = () => {};
              this.pauseVideo = () => { window.audioPauses++; };
              options.events.onReady({target:this});
            };
          }
          destroy() { window.audioDestroys++; }
        },
      };
    },demo);
    await page.goto((process.env.QUIZ_TEST_URL || 'http://localhost:3017')+'/game');
    const tile = page.getByRole('button',{name:'AUDIO, 100 points',exact:true});
    await tile.click();
    await page.waitForFunction(()=>window.audioCreates===1);
    await page.getByRole('button',{name:'Reveal answer',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('.audio-answer-stage'));
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>window.audioDestroys===1);
    assert.deepEqual(errors,[],'Revealing and closing an unready player must not call missing methods');
    await tile.click();
    await page.waitForFunction(()=>window.audioCreates===2);
    await page.evaluate(()=>window.makeAudioReady());
    await page.getByRole('button',{name:'Reveal answer',exact:true}).click();
    await page.waitForFunction(()=>window.audioPauses>0);
    assert.deepEqual(errors,[],'A ready player still pauses on answer reveal');
    console.log('PASS: unready audio player cleanup and ready-player pause');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
