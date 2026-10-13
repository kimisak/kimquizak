/* eslint-disable @typescript-eslint/no-require-imports -- Standalone browser regression. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
  try {
    const base = process.env.QUIZ_TEST_URL || 'http://localhost:3017';
    const palettes = ['capra-liflig','birthday','party','halloween','easter','mardi-gras','jul'];
    const cases = [
      ...palettes.map(themeId=>({saved:JSON.stringify({themeId,companyBranding:true,quizTitle:'Startup test'}),expected:themeId})),
      {saved:JSON.stringify({themeId:'studio',companyBranding:true,quizTitle:'Startup test'}),expected:'birthday'},
      {saved:JSON.stringify({themeId:'unknown',companyBranding:true,quizTitle:'Startup test'}),expected:'jul'},
      {saved:JSON.stringify({themeId:'birthday',companyBranding:false,quizTitle:'Startup test'}),expected:null},
      {saved:'{invalid',expected:null},
      {saved:null,expected:null},
    ];
    for (const {saved,expected} of cases) {
      const page = await browser.newPage();
      const hydrationErrors = [];
      page.on('console',message=>{
        if(message.type()==='error' && /hydrat|didn't match/i.test(message.text())) hydrationErrors.push(message.text());
      });
      await page.addInitScript(saved=>{
        if(saved!==null) localStorage.setItem('kimquizak_settings_v1',saved);
        window.themeFrames = [];
        const observeFrame = () => {
          if(document.querySelector('.site-header')) window.themeFrames.push(document.documentElement.dataset.siteTheme || null);
          requestAnimationFrame(observeFrame);
        };
        requestAnimationFrame(observeFrame);
      },saved);
      let releaseScripts;
      const scriptsReady = new Promise(resolve=>{releaseScripts=resolve;});
      let heldScripts=0;
      await page.route('**/_next/**/*.js*',async route=>{heldScripts++;await scriptsReady;await route.continue();});
      try {
        // Blocking external app scripts makes a late React effect incapable of passing this check.
        await page.goto(base,{waitUntil:'commit'});
        await page.waitForFunction(()=>window.themeFrames.length>0);
        assert(heldScripts>0,'App scripts are delayed during the first-paint assertion');
        assert.deepEqual(await page.evaluate(()=>[...new Set(window.themeFrames)]),[expected],`First paint uses ${expected || 'default'} without React`);
        releaseScripts();
        if(saved && !saved.startsWith('{invalid')) {
          await page.getByRole('heading',{name:'Startup test',exact:true}).waitFor();
          await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
          assert.deepEqual(await page.evaluate(()=>[...new Set(window.themeFrames)]),[expected],'Hydration never paints the default theme over the saved one');
          const toggle = page.getByRole('switch',{name:'Brand the site'});
          await toggle.setChecked(!expected);
          await page.waitForFunction(branded=>Boolean(document.documentElement.dataset.siteTheme)===branded,!expected);
        }
        assert.deepEqual(hydrationErrors,[]);
      } finally {
        releaseScripts();
        await page.close();
      }
    }
    console.log('PASS: saved themes before first paint, stable hydration, live toggling, legacy/fallback settings');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
