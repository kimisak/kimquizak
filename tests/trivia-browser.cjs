/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
module.exports = async (page, baseUrl, backup) => {
  const fixture = {...backup, teams:backup.teams.map(t=>({...t,score:0})),scoreHistory:[],
    settings:{...backup.settings,boardRevealRules:{},hostMessages:[],hideCategoryHeadersAtStart:true},
    turnState:{order:backup.teams.map(t=>t.id),boardIndex:0,lyricsIndex:0},
    questions:[{id:'trivia-test',type:'trivia',category:'ROUND',points:300,prompt:'Paper round',answer:'',answered:false,
      triviaItems:[{id:'a',prompt:'First question?',answer:'First secret'},{id:'b',prompt:'Second question?',answer:'Second secret'},{id:'c',prompt:'Third question?',answer:'Third secret'}]},
      {id:'spare',type:'standard',category:'ROUND',points:100,prompt:'Spare',answer:'Spare',answered:false}]};
  await page.goto(baseUrl+'/config/questions');
  await Promise.all([page.waitForEvent('load'),page.locator('.archive-panel input[type=file]').setInputFiles({name:'trivia.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))})]);
  const card=page.locator('.question-card[data-question-points="300"]');
  await card.click();
  assert.equal(await card.locator('.trivia-config-item').count(),3);
  await card.getByRole('button',{name:'Move question 2 up',exact:true}).click();
  assert.equal(await card.locator('.trivia-config-item').first().getByLabel('Question',{exact:true}).inputValue(),'Second question?');
  await card.getByRole('button',{name:'Move question 1 down',exact:true}).click();
  await page.reload();await card.click();
  assert.equal(await card.locator('.trivia-config-item').first().getByLabel('Question',{exact:true}).inputValue(),'First question?');
  await card.locator('.trivia-config-item').first().locator('input[type=file]').setInputFiles({
    name:'trivia-picture.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#235641"/><circle cx="200" cy="150" r="65" fill="#f2ca6c"/></svg>'),
  });
  await card.locator('.trivia-config-image img').waitFor();
  await page.goto(baseUrl+'/game');
  const open=()=>page.getByRole('button',{name:'ROUND, 300 points',exact:true}).click();
  const modal=page.locator('.trivia-modal');
  await open();
  const assertControlsRight = async () => {
    const layout = await modal.locator('.trivia-actions').evaluate(footer => {
      const controls = footer.querySelector('.trivia-controls');
      const rect = controls.getBoundingClientRect();
      const parent = footer.getBoundingClientRect();
      const padding = parseFloat(getComputedStyle(footer).paddingRight);
      return {gap: parent.right - padding - rect.right, expanded: [...controls.children].some(button => getComputedStyle(button).flexGrow !== '0')};
    });
    assert(Math.abs(layout.gap)<2,'Trivia controls align with footer right edge');
    assert.equal(layout.expanded,false,'Primary buttons must not expand and push navigation left');
  };
  await assertControlsRight();
  await page.setViewportSize({width:700,height:900});
  await assertControlsRight();
  await page.setViewportSize({width:1280,height:854});
  await modal.screenshot({path:'/tmp/trivia-question.png'});
  assert.equal(await modal.getByText('First secret',{exact:true}).count(),0,'Answers hidden');
  await modal.getByRole('button',{name:'Expand trivia-picture.svg',exact:true}).click();
  await page.keyboard.press('Escape');
  assert.equal(await modal.count(),1,'Closing expanded image keeps the round open');
  assert.equal(await modal.getByText('ROUND',{exact:true}).count(),0,'Category stays concealed');
  await modal.getByRole('button',{name:'Next',exact:true}).click();
  await page.keyboard.press('Escape'); await open();
  assert.equal(await modal.getByText('First question?',{exact:true}).count(),1,'Unfinished round resets on close');
  await modal.getByRole('button',{name:'Next',exact:true}).click();
  await modal.getByRole('button',{name:'Next',exact:true}).click();
  await modal.getByRole('button',{name:'Review answers',exact:true}).click();
  assert.equal(await modal.getByText('First secret',{exact:true}).count(),1);
  await assertControlsRight();
  await modal.screenshot({path:'/tmp/trivia-review.png'});
  for(let i=0;i<3;i++) {
    await modal.getByRole('button',{name:fixture.teams[0].name+' correct',exact:true}).click();
    if(i<2) await modal.getByRole('button',{name:fixture.teams[1].name+' correct',exact:true}).click();
    await modal.getByRole('button',{name:i===2?'Finish review':'Next',exact:true}).click();
    assert.equal(await modal.locator('.trivia-progress-tokens .is-complete').count(),i+1);
  }
  assert.equal(await modal.locator('.trivia-results').getByText('300 pts',{exact:true}).count(),1);
  assert.equal(await modal.locator('.trivia-results').getByText('200 pts',{exact:true}).count(),1);
  await modal.getByRole('button',{name:'Back to review',exact:true}).click();
  await modal.getByRole('button',{name:fixture.teams[0].name+' correct',exact:true}).click();
  assert.equal(await modal.getByRole('button',{name:'See round results',exact:true}).count(),0,'Changed marks need confirmation');
  await modal.getByRole('button',{name:fixture.teams[0].name+' correct',exact:true}).click();
  assert.equal(await modal.locator('.trivia-progress-tokens .is-complete').count(),2,'Editing a reviewed answer removes its completion');
  await modal.getByRole('button',{name:'Next',exact:true}).click();
  assert.equal(await modal.locator('.trivia-progress-tokens .is-complete').count(),3,'Next reconfirms changed marking');
  await modal.getByRole('button',{name:'Previous',exact:true}).click();
  assert.equal(await modal.locator('.trivia-progress-tokens .is-complete').count(),3,'Going back preserves marking');
  await modal.getByRole('button',{name:'Next',exact:true}).click();
  await modal.getByRole('button',{name:'Next',exact:true}).click();
  await modal.getByRole('button',{name:'Finish review',exact:true}).click();
  await page.setViewportSize({width:1280,height:854});
  const bounds=await modal.boundingBox();
  await assertControlsRight();
  await modal.screenshot({path:'/tmp/trivia-results.png'});
  assert(bounds.y>=0 && bounds.y+bounds.height<=854,'Round fits Surface viewport');
  const award=modal.getByRole('button',{name:'Award points & finish',exact:true});
  await award.evaluate(button=>{button.click();button.click();});
  await modal.waitFor({state:'detached'});
  await page.goto(baseUrl+'/config/questions');
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:/Download backup/}).click();
  const fs=require('node:fs');
  const saved=JSON.parse(fs.readFileSync(await (await download).path(),'utf8'));
  assert.equal(saved.teams[0].score,300); assert.equal(saved.teams[1].score,200); assert.equal(saved.teams[2].score,0);
  assert.equal(saved.questions.find(q=>q.id==='trivia-test').answered,true);
  assert(saved.questions.find(q=>q.id==='trivia-test').triviaItems[0].imageData.startsWith('data:image/'),'Nested image survives backup');
  assert.equal(saved.scoreHistory.filter(h=>h.questionId==='trivia-test').length,fixture.teams.length,'Single award per team, including zero');
  console.log('PASS: trivia config, reorder, persistence, concealed answers/category, close reset, all-team awards and double-click guard');
};
