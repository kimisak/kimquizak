/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
module.exports = async (page, baseUrl, backup) => {
  // Layout-only checks: never load Google Maps or incur panorama API usage.
  await page.route(/https:\/\/.*(googleapis|google|gstatic)\.com\/.*/,route=>route.abort());
  const fixture={...backup,scoreHistory:[],
    settings:{...backup.settings,boardRevealRules:{},hostMessages:[],hideCategoryHeadersAtStart:false},
    turnState:{order:backup.teams.map(t=>t.id),boardIndex:0,lyricsIndex:0},
    questions:[
      {id:'geo-size',type:'geoguesser',category:'SIZING',points:100,prompt:'Where are we?',answer:'Bergen',answered:false,mapEmbedUrl:'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=60.39,5.32',geoExplorationMode:'look'},
      {id:'standard-size',type:'standard',category:'SIZING',points:200,prompt:'Which city is known as the city of seven mountains?',answer:'Bergen',answered:false},
      {id:'geo-stage-size',type:'geoguesser',category:'SIZING',points:300,prompt:'Find the place',answer:'Bergen',answered:false,mapEmbedUrl:'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=60.39,5.32',geoExplorationMode:'stage'},
    ]};
  await page.goto(baseUrl+'/config/questions');
  await Promise.all([page.waitForEvent('load'),page.locator('.archive-panel input[type=file]').setInputFiles({name:'sizing.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))})]);
  await page.goto(baseUrl+'/game');
  for(const viewport of [{width:1280,height:854},{width:1920,height:1080},{width:3440,height:1440},{width:1280,height:640}]) {
    await page.setViewportSize(viewport);
    for(const points of [100,200,300]) {
      await page.getByRole('button',{name:`SIZING, ${points} points`,exact:true}).click();
      const shell=page.locator('.game-modal-shell');
      await shell.waitFor();
      const assertFits=async()=>{
        for(const locator of [shell,shell.locator('.game-modal-close'),shell.locator('.question-modal-actions')]) {
          const b=await locator.boundingBox();
          assert(b && b.x>=-1 && b.y>=-1 && b.x+b.width<=viewport.width+1 && b.y+b.height<=viewport.height+1,`Controls fit ${points}: ${JSON.stringify(b)} in ${JSON.stringify(viewport)}`);
        }
        assert.equal(await shell.evaluate(el=>el.scrollWidth>el.clientWidth+1),false,'No horizontal overflow');
      };
      await assertFits();
      const box=await shell.boundingBox();
      if(points!==200) {
        assert(box.width>=viewport.width*.95,'Geo uses nearly all available width');
        assert(box.height>=viewport.height*.93,'Geo grows with viewport height');
        const map=await shell.locator(points===100?'.geo-question-panorama':'.geo-stage-visual').boundingBox();
        assert(map.height>=viewport.height*.48,'Map receives the extra height');
      } else assert(box.width>=Math.min(viewport.width*.93,1599),'Standard card enlarged');
      if(points===100) {
        if(viewport.width===1920) await shell.screenshot({path:'/tmp/geo-expanded-question.png'});
        await shell.getByRole('button',{name:'Reveal answer',exact:true}).click();
        await assertFits();
        if(viewport.width===1920) await shell.screenshot({path:'/tmp/geo-expanded-answer.png'});
      }
      await shell.locator('.game-modal-close').click();
    }
  }
  console.log('PASS: larger question/Geo cards, panorama space and visible controls on Surface, desktop, ultrawide and short viewports');
};
