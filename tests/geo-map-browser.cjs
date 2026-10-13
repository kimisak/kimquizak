/* eslint-disable @typescript-eslint/no-require-imports -- Standalone browser regression. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const demo = require('../default_questions.json');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  try {
    const page = await browser.newPage();
    const errors = [];
    const warnings = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
      if (message.type() === 'warning') warnings.push(message.text());
    });
    await page.addInitScript(demo => {
      localStorage.setItem('kimquizak_settings_v1', JSON.stringify({...demo.settings,hostMessages:[],boardRevealRules:{},hideCategoryHeadersAtStart:false}));
      localStorage.setItem('kimquizak_teams_v1', JSON.stringify(demo.teams));
      localStorage.setItem('kimquizak_turn_state_v1', JSON.stringify({order:demo.teams.map(t=>t.id),boardIndex:0,lyricsIndex:0}));
      localStorage.setItem('kimquizak_questions_v1', JSON.stringify([
        {id:'geo',type:'geoguesser',category:'MAP',points:100,prompt:'Find the place',answer:'Bergen',answered:false,mapEmbedUrl:'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=60.39,5.32',geoExplorationMode:'stage',geoStageExploreSeconds:5},
        {id:'spare',type:'standard',category:'MAP',points:200,prompt:'Spare',answer:'A',answered:false},
      ]));
      window.mapOverlays = [];
      window.mapLines = [];
      window.google = { maps: {
        importLibrary: async () => ({}),
        StreetViewPanorama: class {
          addListener() { return {remove(){}}; }
          getStatus() { return 'OK'; }
          getPov() { return {heading:0,pitch:0}; }
          getPano() { return 'test'; }
          setOptions() {}
        },
        Map: class {
          constructor(element) { this.element=element; this.offset=0; window.guessMap=this; }
          addListener(name, callback) {
            if(name==='click') window.placeMapGuess=(lat,lng)=>callback({latLng:{lat:()=>lat,lng:()=>lng}});
            const timer=name==='tilesloaded'?setTimeout(callback,20):null;
            return {remove(){if(timer) clearTimeout(timer);}};
          }
          setMapTypeId(type) { this.type=type; }
          fitBounds() { window.fittedBounds=true; }
        },
        OverlayView: class {
          setMap(map) {
            this.map=map;
            if(map) { window.mapOverlays.push(this); this.onAdd(); this.draw(); }
            else this.onRemove();
          }
          getPanes() { return {markerLayer:this.map.element}; }
          getProjection() { return {fromLatLngToDivPixel:point=>({x:point.lng+this.map.offset,y:point.lat})}; }
        },
        LatLng: class { constructor(point) { Object.assign(this,point); } },
        LatLngBounds: class { extend() {} },
        Polyline: class { constructor(options) { this.map=options.map; window.mapLines.push(this); } setMap(map) {this.map=map;} },
        // Deliberately no deprecated Marker constructor.
      }};
    }, demo);
    const base=process.env.QUIZ_TEST_URL || 'http://localhost:3017';
    await page.goto(base+'/game');
    await page.getByRole('button',{name:'MAP, 100 points',exact:true}).click();
    await page.getByRole('button',{name:'Start exploring',exact:true}).click();
    await page.getByRole('button',{name:'Place pin first',exact:true}).waitFor();
    await page.evaluate(()=>window.placeMapGuess(50,70));
    const dot=page.getByRole('img',{name:'Player guess',exact:true});
    await dot.waitFor();
    assert.equal(await dot.evaluate(el=>el.style.left),'70px');
    await page.evaluate(()=>{window.guessMap.offset=10;window.mapOverlays.filter(o=>o.map).forEach(o=>o.draw());});
    assert.equal(await dot.evaluate(el=>el.style.left),'80px','Dot follows the map projection');
    await page.evaluate(()=>window.placeMapGuess(55,75));
    await page.waitForFunction(()=>document.querySelector('[aria-label="Player guess"]').style.left==='85px');
    assert.equal(await dot.count(),1,'Changing guess removes the previous dot');
    await page.getByRole('button',{name:'Lock pin now',exact:true}).click();
    await page.evaluate(()=>window.placeMapGuess(1,1));
    assert.equal(await dot.evaluate(el=>el.style.left),'85px','Locked guess cannot move');
    await page.getByRole('button',{name:'Reveal location & distance',exact:true}).click();
    await page.getByRole('img',{name:'Correct location',exact:true}).waitFor();
    assert(await page.evaluate(()=>window.fittedBounds));
    assert.equal(await page.evaluate(()=>window.mapLines.filter(line=>line.map).length),1);
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>window.mapOverlays.every(overlay=>!overlay.map));
    assert(await page.evaluate(()=>window.mapLines.every(line=>!line.map)));
    // Both direct requests and client navigations should reach login without an aborted AccountPage.
    await page.goto(base+'/account');
    await page.getByRole('heading',{name:'Host login'}).waitFor();
    assert.equal(new URL(page.url()).pathname,'/login');
    for(let i=0;i<3;i++) {
      await page.getByRole('link',{name:'Continue with the public demo'}).click();
      await page.getByRole('link',{name:/Host$/,exact:false}).click();
      await page.getByRole('heading',{name:'Host login'}).waitFor();
    }
    assert.deepEqual(errors,[],'No browser errors during map play or host navigation');
    assert.deepEqual(warnings,[],'No browser warnings during map play or host navigation');
    console.log('PASS: map placement, redraw, replacement, lock, reveal, cleanup and anonymous host navigation; no console errors/warnings');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
