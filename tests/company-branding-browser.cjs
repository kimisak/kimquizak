/* eslint-disable @typescript-eslint/no-require-imports -- Standalone browser regression. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const demo = require('../default_questions.json');
(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    const base = process.env.QUIZ_TEST_URL || 'http://localhost:3017';
    await page.addInitScript(settings => {
      if (!localStorage.getItem('kimquizak_settings_v1')) localStorage.setItem('kimquizak_settings_v1', JSON.stringify(settings));
    }, {...demo.settings,themeId:'capra-liflig',companyBranding:false,quizTitle:'Branding preview'});
    await page.goto(base);
    await page.getByRole('heading',{name:'Branding preview',exact:true}).waitFor();
    const theme = page.getByLabel('Team palette',{exact:true});
    const toggle = page.getByRole('switch',{name:'Brand the site'});
    const isBranded = () => page.evaluate(()=>document.documentElement.dataset.siteTheme === 'capra-liflig');
    assert.equal(await isBranded(),false);
    const animalsBefore = await page.locator('.theme-cast img').evaluateAll(images=>images.map(image=>image.src));
    await toggle.check();
    await page.waitForFunction(()=>document.documentElement.dataset.siteTheme === 'capra-liflig');
    assert.deepEqual(await page.locator('.theme-cast img').evaluateAll(images=>images.map(image=>image.src)),animalsBefore,'Branding does not replace team identities');
    await page.screenshot({path:'/tmp/company-branding-home.png',fullPage:true});
    const selectBox = await theme.boundingBox(), toggleBox = await toggle.locator('..').boundingBox();
    assert(toggleBox.x > selectBox.x+selectBox.width,'Switch sits to the right of the palette');
    await page.reload();
    await page.waitForFunction(()=>document.documentElement.dataset.siteTheme === 'capra-liflig');
    assert(await toggle.isChecked());
    await page.getByRole('link',{name:'02 Questions',exact:true}).click();
    assert(await isBranded(),'Theme stays active on navigation');
    const download = page.waitForEvent('download');
    await page.getByRole('button',{name:/Download backup/}).click();
    const fs = require('node:fs');
    const backup = JSON.parse(fs.readFileSync(await (await download).path(),'utf8'));
    assert.equal(backup.settings.companyBranding,true);
    const fixture = {...demo, settings:{...backup.settings,boardRevealRules:{},hostMessages:[]}, turnState:{order:demo.teams.map(team=>team.id),boardIndex:0,lyricsIndex:0}, questions:[
      {id:'branding-preview',type:'standard',category:'BRAND',points:100,prompt:'Which animal represents Capra?',answer:'A goat',answered:false},
      {id:'branding-spare',type:'standard',category:'BRAND',points:200,prompt:'Spare question',answer:'Spare answer',answered:false},
    ]};
    await Promise.all([page.waitForEvent('load'),page.locator('.archive-panel input[type=file]').setInputFiles({name:'branding.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))})]);
    await page.waitForFunction(()=>document.documentElement.dataset.siteTheme === 'capra-liflig');
    await page.goto(base+'/game');
    await page.getByRole('button',{name:'BRAND, 100 points',exact:true}).waitFor();
    assert.equal(await page.locator('.game-header .brand-wordmark strong').evaluate(element=>getComputedStyle(element).color),'rgb(12, 28, 53)','Play header title uses dark Capra text on the light branded header');
    const checkButtonContrast = async button => {
      const ratio = await button.evaluate(element => {
        const luminance = color => {
          const channels = color.match(/[\d.]+/g).slice(0,3).map(Number).map(value => {
            const channel = value / 255;
            return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
          });
          return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
        };
        const style = getComputedStyle(element);
        const foreground = luminance(style.color), background = luminance(style.backgroundColor);
        return (Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05);
      });
      assert(ratio >= 4.5, `${await button.textContent()} has readable contrast (${ratio.toFixed(2)}:1)`);
    };
    const scoreToggle = page.getByRole('button',{name:'Hide scores',exact:true});
    const history = page.getByRole('button',{name:/^History/});
    await checkButtonContrast(scoreToggle);
    await checkButtonContrast(history);
    await history.click();
    await checkButtonContrast(page.getByRole('button',{name:'Hide history',exact:true}));
    await page.getByRole('button',{name:'Hide history',exact:true}).click();
    await scoreToggle.click();
    await checkButtonContrast(page.getByRole('button',{name:'Reveal scores',exact:true}));
    assert(await history.isDisabled());
    await page.getByRole('button',{name:'Reveal scores',exact:true}).click();
    await page.screenshot({path:'/tmp/company-branding-game.png',fullPage:true});
    await page.getByRole('button',{name:'BRAND, 100 points',exact:true}).click();
    await page.locator('.game-modal-shell').screenshot({path:'/tmp/company-branding-question.png'});
    await page.keyboard.press('Escape');

    await page.evaluate(()=>localStorage.setItem('kimquizak_turn_state_v1',JSON.stringify({order:[],boardIndex:0,lyricsIndex:0})));
    await page.reload();
    await page.getByRole('button',{name:'Spin to begin',exact:true}).waitFor();
    await page.screenshot({path:'/tmp/company-branding-opening.png',fullPage:true});

    await page.getByRole('link',{name:/KimQuizak home/}).click();
    await theme.selectOption('birthday');
    await page.waitForFunction(()=>!document.documentElement.dataset.siteTheme);
    assert.equal(await toggle.count(),0);
    await theme.selectOption('capra-liflig');
    await page.waitForFunction(()=>document.documentElement.dataset.siteTheme === 'capra-liflig');
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.locator('.home-control-panel').screenshot({path:'/tmp/company-branding-mobile.png'});
    await toggle.uncheck();
    await page.waitForFunction(()=>!document.documentElement.dataset.siteTheme);
    console.log('PASS: company branding toggle, persistence, export, navigation, palette scope, and mobile layout');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
