/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS test runner. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Compile project TS in memory, with a fresh module cache and explicit storage fakes.
function projectLoader(stubs = {}) {
  const cache = new Map();
  function load(name) {
    if (Object.hasOwn(stubs, name)) return stubs[name];
    if (!name.startsWith('@/')) return require(name);
    if (cache.has(name)) return cache.get(name).exports;
    const filename = path.resolve(__dirname, '../src', name.slice(2) + '.ts');
    const loaded = { exports: {} };
    cache.set(name, loaded);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    new Function('require', 'module', 'exports', code)(load, loaded, loaded.exports);
    return loaded.exports;
  }
  return load;
}

test('public demo uses synthetic players, reciprocal mock relationships, and every question type', () => {
  const demo = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../default_questions.json'), 'utf8'));
  const players = demo.teams.flatMap(team => team.players);
  assert.equal(players.length, 9);
  assert.equal(new Set(players.map(player => player.id)).size, players.length);
  const kinds = new Set();
  players.forEach((player, index) => {
    const number = String(index + 1).padStart(2, '0');
    assert.equal(player.name, ['Nora', 'Emil', 'Frida', 'Aksel', 'Maja', 'Jonas', 'Ingrid', 'Sander', 'Thea'][index]);
    assert.equal(player.id, `demo-player-${number}`);
    assert(Object.keys(player).every(key => ['id', 'name', 'bonds'].includes(key)));
    for (const bond of player.bonds ?? []) {
      kinds.add(bond.kind);
      const target = players.find(candidate => candidate.id === bond.playerId);
      assert(target?.bonds.some(reverse => reverse.playerId === player.id && reverse.kind === bond.kind));
    }
  });
  assert.deepEqual([...kinds].sort(), ['drinking-buddies', 'engaged', 'married', 'parents', 'sweethearts']);
  assert.deepEqual([...new Set(demo.questions.map(question => question.type))].sort(),
    ['audio', 'booby', 'geoguesser', 'imageReveal', 'joker', 'lyrics', 'mcq', 'standard', 'timeline', 'trivia']);
  const { getQuestionIssues } = projectLoader()('@/lib/questionValidation');
  for (const question of demo.questions) {
    assert.deepEqual(getQuestionIssues(question), [], question.id);
    assert.equal(question.answered, false);
    assert.equal(question.typeDrafts, undefined, 'No hidden drafts in the public demo');
  }
  assert(demo.teams.every(team => team.score === 0));
  assert.deepEqual(demo.scoreHistory, []);
  assert.deepEqual(demo.turnState.order, []);
});

test('removing a reveal image clears all image-specific authoring state but keeps question rules', () => {
  const { clearImageRevealImage, getImageAreaOpeningTiles, getImageRevealAreas } = projectLoader()('@/lib/imageReveal');
  const original = { id:'reset', prompt:'Question', answer:'Answer', imageRevealStyle:'areas',
    imageRevealRotateOnMiss:false, imageRevealCostsPoints:false, imageRevealAreaMode:'limited',
    imageData:'old', imageName:'old.png', imageRevealLevels:[1,20],
    imageRevealStyleLevels:{blur:[20,30]}, imageRevealPatchOverrides:[{0:true}],
    imageRevealAreas:[[1,2]], imageRevealOpeningCoverage:70, imageRevealInitiallyVisible:[3],
    imageRevealOpeningOverrides:{4:true}, imageRevealFocusX:12, imageRevealFocusY:80,
    imageRevealStageFocus:[{x:10,y:20}], imageRevealFraming:{areas:{zoom:3,x:20,y:30}},
    imageRevealFillFrame:true };
  const cleared = JSON.parse(JSON.stringify({...original, ...clearImageRevealImage()}));
  assert.equal(cleared.imageData, null);
  assert.equal(cleared.imageName, null);
  assert.deepEqual(getImageRevealAreas(cleared), []);
  assert.deepEqual(getImageAreaOpeningTiles(cleared), []);
  for (const key of ['imageRevealLevels','imageRevealStyleLevels','imageRevealPatchOverrides',
    'imageRevealFocusX','imageRevealFocusY','imageRevealStageFocus','imageRevealFraming']) {
    assert.equal(cleared[key], undefined, key);
  }
  assert.equal(cleared.imageRevealFillFrame, false);
  for (const key of ['prompt','answer','imageRevealStyle','imageRevealRotateOnMiss','imageRevealCostsPoints','imageRevealAreaMode']) {
    assert.equal(cleared[key], original[key], key);
  }
});

test('trivia rewards every team independently and requires all answers reviewed', () => {
  const { getTriviaResults, isTriviaReviewed } = projectLoader()('@/lib/trivia');
  const { getQuestionIssues } = projectLoader()('@/lib/questionValidation');
  const question = { type:'trivia', points:300, triviaItems:[
    {id:'1',prompt:'First?',answer:'Yes'}, {id:'2',prompt:'Second?',answer:'Yes'}, {id:'3',prompt:'Third?',answer:'Yes'},
  ] };
  const marks = {'1':['a','b'], '2':['a','b'], '3':['a']};
  assert.deepEqual(getTriviaResults(question, ['a','b','c'], marks), [
    {teamId:'a',correct:3,points:300},{teamId:'b',correct:2,points:200},{teamId:'c',correct:0,points:0},
  ]);
  assert.equal(getTriviaResults({...question,points:100}, ['b'], marks)[0].points, 67);
  assert.equal(getTriviaResults(question,['a','b'],{'1':['a','b'],'2':['a','b'],'3':['a','b']}).reduce((n,r)=>n+r.points,0),600);
  assert.equal(isTriviaReviewed(question, ['1','2']), false);
  assert.equal(isTriviaReviewed(question, ['1','2','3']), true);
  assert.equal(isTriviaReviewed({triviaItems:[]}, []), false);
  assert.deepEqual(getQuestionIssues(question), []);
  assert(getQuestionIssues({...question,triviaItems:[]}).length);
  assert(getQuestionIssues({...question,triviaItems:[{id:'1',prompt:'',answer:''},{id:'1',prompt:'x',answer:'y'}]}).length);
});

test('finale reveals every tier separately from last to first, keeping ties together', () => {
  const { getFinaleRevealPlan, ordinalPlace } = projectLoader()('@/lib/finaleReveal');
  const teams = scores => scores.map((score, i) => ({ id: String(i), score }));
  const four = getFinaleRevealPlan(teams([400, 300, 200, 100]));
  assert.deepEqual(four.steps.map(step => step.teamIds), [['3'], ['2'], ['1'], ['0']]);
  assert.deepEqual(four.steps.map(step => step.label), ['Reveal 4th place', 'Reveal 3rd place', 'Reveal 2nd place', 'Reveal 1st place']);
  assert.deepEqual(four.steps.map(step => step.final), [false, false, false, true]);
  assert.deepEqual(getFinaleRevealPlan(teams([500, 400, 300, 200, 100])).steps.map(step => step.ranks), [[5], [4], [3], [2], [1]]);
  assert.deepEqual(getFinaleRevealPlan(teams([500, 300, 300, 100])).steps.map(step => step.teamIds), [['3'], ['1', '2'], ['0']]);
  assert.deepEqual(getFinaleRevealPlan(teams([500, 500, 300, 100])).steps.map(step => step.ranks), [[4], [3], [1]]);
  assert.equal(getFinaleRevealPlan(teams([0, 0, 0, 0])).steps.length, 1);
  assert.equal(getFinaleRevealPlan(teams([100, 50])).steps.length, 2);
  assert.equal(getFinaleRevealPlan(teams([100])).steps[0].label, 'Reveal 1st place');
  assert.deepEqual(getFinaleRevealPlan([]).steps, []);
  assert.equal(ordinalPlace(11), '11th'); assert.equal(ordinalPlace(22), '22nd');
});

test('timeline misses leave shares unclaimed instead of rewarding any team', () => {
  const { allocateTimelinePoints } = projectLoader()('@/lib/timelineScoring');
  const allocate = (total, count, outcomes, teams = ['a', 'b', 'c']) => allocateTimelinePoints(total, count, outcomes, teams);
  const results = allocate(400, 4, [
    { teamId: 'a', correct: true }, { teamId: 'a', correct: false },
    { teamId: 'b', correct: true }, { teamId: 'b', correct: false },
  ]);
  assert.deepEqual(results, [
    { teamId: 'a', correctCount: 1, wrongCount: 1, points: 100 },
    { teamId: 'b', correctCount: 1, wrongCount: 1, points: 100 },
    { teamId: 'c', correctCount: 0, wrongCount: 0, points: 0 },
  ]);
  assert.equal(allocate(400, 1, [{ teamId: 'a', correct: false }], ['a'])[0].points, 0);
  assert(allocate(400, 2, [{ teamId: 'a', correct: false }, { teamId: 'b', correct: false }]).every(r => r.points === 0));
  const rounded = allocate(100, 3, [{ teamId: 'a', correct: true }, { teamId: 'b', correct: true }, { teamId: 'c', correct: false }]);
  assert.equal(rounded.reduce((sum, r) => sum + r.points, 0), 67);
  assert.equal(rounded[2].points, 0);
  const perfect = allocate(100, 3, ['a', 'b', 'c'].map(teamId => ({ teamId, correct: true })));
  assert.equal(perfect.reduce((sum, r) => sum + r.points, 0), 100);
  assert(allocate(400, 4, []).every(r => r.points === 0));
});

test('timeline recycles misses, including the last card, and preserves the full pool', () => {
  const { advanceTimelineQueue, allocateTimelinePoints } = projectLoader()('@/lib/timelineScoring');
  const cards = [{ id: 'one', year: 1800 }, { id: 'two', year: 1900 }];
  const afterMiss = advanceTimelineQueue(cards, false);
  assert.deepEqual(afterMiss.map(c => c.id), ['two', 'one']);
  assert.deepEqual(cards.map(c => c.id), ['one', 'two']);
  const last = advanceTimelineQueue(afterMiss, true);
  assert.deepEqual(advanceTimelineQueue(last, false), last);
  assert.deepEqual(advanceTimelineQueue(last, true), []);
  assert.deepEqual(advanceTimelineQueue([], false), []);
  const outcomes = [{ teamId: 'a', correct: false }, { teamId: 'b', correct: true },
    { teamId: 'b', correct: false }, { teamId: 'a', correct: false }, { teamId: 'b', correct: true }];
  const result = allocateTimelinePoints(500, 2, outcomes, ['a', 'b']);
  assert.equal(result[0].points, 0);
  assert.equal(result[1].points, 500);
  assert.equal(result[1].correctCount, 2);
});

test('fill-frame portrait crops can pan to either edge even at minimum zoom', () => {
  const { getImageRevealVisibleFractions, panImageRevealFrame, getImageRevealStageFrame, constrainImageRevealFrame } = projectLoader()('@/lib/imageReveal');
  const visible = getImageRevealVisibleFractions(.5, 2);
  assert.deepEqual(visible, { x:1, y:.25 });
  const top = panImageRevealFrame(100, 50, 50, 0, 10, visible);
  const bottom = panImageRevealFrame(100, 50, 50, 0, -10, visible);
  assert.deepEqual(top, { x:50, y:12.5 });
  assert.deepEqual(bottom, { x:50, y:87.5 });
  for (const focus of [top, bottom]) {
    const frame = getImageRevealStageFrame({ imageRevealLevels:[100,100], imageRevealFillFrame:true, imageRevealStageFocus:[focus] }, 0);
    const rendered = constrainImageRevealFrame(frame, visible);
    assert.equal((rendered.y + rendered.size / 2) * 100, focus.y);
  }
  assert.deepEqual(panImageRevealFrame(100, 50, 50, 0, 10), { x:50, y:50 }, 'Fit-image still prevents blank edges');
  assert.deepEqual(getImageRevealVisibleFractions(2, .5), { x:.25, y:1 });
});

test('image reveal stages are independently bounded and preserve a host-defined final stage', () => {
  const { getImageRevealLevels, getImageRevealPoints, getImageRevealOrder } = projectLoader()('@/lib/imageReveal');
  assert.deepEqual(getImageRevealLevels([5, 30, 20, 130]), [5, 30, 20, 100]);
  assert.deepEqual(getImageRevealLevels([5, 15, 40]), [5, 15, 40]);
  assert.deepEqual(getImageRevealLevels([5, 15, 40, 60, 80, 100]), [5, 15, 40, 60, 80]);
  const defaults = getImageRevealLevels();
  assert.equal(defaults.at(-1), 100);
  assert.equal(getImageRevealPoints(500, 2, [100, 300, 500], true), 100);
  assert.equal(getImageRevealPoints(500, 20, [100, 300, 500], true), 100);
  assert.equal(getImageRevealPoints(500, 2, [100, 300, 500], false), 500);
  assert.equal(getImageRevealPoints(100, 2, [100], true), 100);
  const order = getImageRevealOrder('same-image', 384);
  assert.equal(new Set(order).size, 384);
  assert.deepEqual(order, getImageRevealOrder('same-image', 384));
  assert.notDeepEqual(order, getImageRevealOrder('other-image', 384));
});

test('patch reveals accumulate without changing stage settings and survive serialization', () => {
  const { getImageRevealVisiblePatches } = projectLoader()('@/lib/imageReveal');
  const q = { id: 'patches', imageRevealLevels: [.04, 100], imageRevealPatchOverrides: [{ 7: true }, { 7: false, 999: true }] };
  assert.deepEqual(getImageRevealVisiblePatches(q, 0), [7]);
  assert.equal(getImageRevealVisiblePatches(q, 1).length, 384);
  assert(getImageRevealVisiblePatches(q, 1).includes(7));
  assert.deepEqual(getImageRevealVisiblePatches({ ...q, imageRevealLevels: [.04, .04] }, 1), [7]);
  assert.deepEqual(getImageRevealVisiblePatches(JSON.parse(JSON.stringify(q)), 1), getImageRevealVisiblePatches(q, 1));
});

test('image reveal needs a source image and answer, but no prompt', () => {
  const { getQuestionIssues } = projectLoader()('@/lib/questionValidation');
  const q = { type: 'imageReveal', prompt: '', answer: '', points: 500 };
  assert.deepEqual(getQuestionIssues(q), ['Add the image to reveal', 'Add the answer']);
  assert.deepEqual(getQuestionIssues({ ...q, imageData: 'data:image/png;base64,test', answer: 'A fox' }), []);
});

test('choose-area defaults include opening clues and painted areas never overlap', () => {
  const { getImageRevealAreas } = projectLoader()('@/lib/imageReveal');
  const defaults = getImageRevealAreas({});
  assert.equal(defaults.length, 0);
  assert.equal(defaults.flat().length, 0, 'Start blank without predefined covers');
  assert.equal(new Set(defaults.flat()).size, defaults.flat().length);
  assert.deepEqual(getImageRevealAreas({ imageRevealAreas: [[1, 1, -1], [1, 2, 500]] }), [[1], [2]]);
});

test('area islands keep nested and separated sections distinguishable', () => {
  const { getImageAreaIslands } = projectLoader()('@/lib/imageReveal');
  assert.equal(getImageAreaIslands([0, 1, 2, 24, 26, 48, 49, 50]).length, 1, 'Ring stays connected');
  assert.equal(getImageAreaIslands([25, 200]).length, 2, 'Enclosed and distant sections each need a badge');
  assert.equal(getImageAreaIslands([23, 24]).length, 2, 'Row edges must not wrap');
});

test('area opening clues are stable random patches plus deliberate visible tiles', () => {
  const { getImageAreaOpeningTiles } = projectLoader()('@/lib/imageReveal');
  const q = { id: 'opening', imageRevealOpeningCoverage: 10 };
  assert.deepEqual(getImageAreaOpeningTiles({ id: 'new' }), [], 'Fresh images are fully covered');
  assert.equal(getImageAreaOpeningTiles(q).length, 38);
  assert.deepEqual(getImageAreaOpeningTiles(q), getImageAreaOpeningTiles(JSON.parse(JSON.stringify(q))));
  assert.deepEqual(getImageAreaOpeningTiles({ ...q, imageRevealOpeningCoverage: 0, imageRevealInitiallyVisible: [4, 4, 999] }), [4]);
});

test('manual opening edits override random and legacy clues without assigning areas', () => {
  const { getImageAreaOpeningTiles, getImageAreaPlayableIndexes, getImageRevealAreas } = projectLoader()('@/lib/imageReveal');
  const q = { id: 'manual-opening', imageRevealOpeningCoverage: 100, imageRevealInitiallyVisible: [4], imageRevealOpeningOverrides: { 4: false, 5: true, 999: true, '-1': true } };
  assert.equal(getImageAreaOpeningTiles(q).length, 383);
  assert(!getImageAreaOpeningTiles(q).includes(4), 'A hidden cell stays covered at 100% random coverage');
  assert.deepEqual(getImageAreaOpeningTiles({ ...q, imageRevealOpeningCoverage: 0 }), [5], 'Forced shown cells survive zero random coverage');
  assert.deepEqual(getImageRevealAreas(q), [], 'Editing opening tiles never creates a default area');
  const assigned = { ...q, imageRevealAreas: [[4], [5]] };
  assert.deepEqual(getImageAreaPlayableIndexes(assigned), [0], 'A manually covered clue can belong to a reveal area');
  assert.deepEqual(getImageAreaOpeningTiles(JSON.parse(JSON.stringify(q))), getImageAreaOpeningTiles(q));
});

test('area rules separate fixed rollover from limited descending rewards', () => {
  const { getImageAreaRewards, chooseImageArea, missImageArea, canGuessImageArea } = projectLoader()('@/lib/imageReveal');
  const q = { id: 'areas', points: 500, imageRevealAreas: [[0], [1], [2]], imageRevealAreaMode: 'limited' };
  const tiers = [100, 200, 300, 400, 500];
  assert.deepEqual(getImageAreaRewards(q, tiers), [500, 400, 300]);
  assert.deepEqual(getImageAreaRewards({ ...q, points: 100 }, tiers), [100, 67, 33]);
  assert.deepEqual(getImageAreaRewards(q, [1, 500]), [500, 333, 167], 'Skip imported tiers too small to support remaining guesses');
  assert.deepEqual(getImageAreaRewards({ ...q, imageRevealAreaMode: 'rollover', imageRevealCostsPoints: true }, tiers), [500, 500, 500]);
  assert.deepEqual(getImageAreaRewards({ ...q, imageRevealAreas: [[0], [1], [2], [3], [4]] }, [100, 300, 500]), [500, 300, 100, 67, 33]);
  let p = { step: 0, points: 500 };
  assert.equal(canGuessImageArea(q, p), false);
  assert.equal(missImageArea(q, p), p, 'Cannot skip choose phase');
  p = chooseImageArea(q, p, 2, tiers, 'team-a');
  assert.equal(p.points, 500);
  assert.equal(p.teamId, 'team-a');
  assert.equal(chooseImageArea(q, p, 1, tiers, 'team-a'), p, 'One area per guess');
  p = missImageArea(q, p);
  assert.equal(p.points, 500, 'Wrong does not charge separately');
  assert.equal(p.answerRevealed, false);
  p = chooseImageArea(q, p, 0, tiers, 'team-b');
  assert.equal(p.teamId, 'team-a', 'Limited guesses remain with the original team');
  assert.equal(p.points, 400);
  p = chooseImageArea(q, missImageArea(q, p), 1, tiers, 'team-a');
  p = missImageArea(q, p);
  assert.equal(p.outcome, 'skipped');
  assert.equal(p.answerRevealed, true);
  assert.equal(chooseImageArea(q, p, 0, tiers, 'team-a'), p);
  const rollover = { ...q, imageRevealAreaMode: 'rollover' };
  p = { step: 0, points: 500 };
  for (const area of [0, 1, 2]) p = missImageArea(rollover, chooseImageArea(rollover, p, area, tiers, 'team-a'));
  assert.equal(canGuessImageArea(rollover, p), true, 'Rollover can continue after all areas open');
  assert.equal(p.points, 500);
  assert.equal(p.answerRevealed, false);
  assert.equal(p.outcome, undefined);
});

test('fully visible areas cannot consume guesses or rewards', () => {
  const { getImageAreaPlayableIndexes, chooseImageArea } = projectLoader()('@/lib/imageReveal');
  const { getQuestionIssues } = projectLoader()('@/lib/questionValidation');
  const q = { id: 'visible', type: 'imageReveal', imageRevealStyle: 'areas', answer: 'Fox', imageData: 'image', points: 500, imageRevealAreas: [[0], [1, 2]], imageRevealInitiallyVisible: [0] };
  assert.deepEqual(getImageAreaPlayableIndexes(q), [1]);
  const p = { step: 0, points: 500 };
  assert.equal(chooseImageArea(q, p, 0, [100, 500], 'a'), p);
  assert(getQuestionIssues(q).some(issue => issue.includes('covered cell')));
});

test('legacy random patch questions migrate while preserving their opening clues', () => {
  const { migrateImageRevealQuestion, getImageRevealVisiblePatches, getImageAreaOpeningTiles, getImageRevealAreas } = projectLoader()('@/lib/imageReveal');
  const old = { id: 'legacy-patches', imageRevealStyle: 'noise', imageRevealLevels: [10, 35, 100], imageRevealPatchOverrides: [{ 7: true, 8: false }] };
  const opening = getImageRevealVisiblePatches(old, 0);
  const migrated = migrateImageRevealQuestion(old);
  assert.equal(migrated.imageRevealStyle, 'areas');
  assert.deepEqual(getImageAreaOpeningTiles(migrated), opening);
  assert.deepEqual(getImageRevealAreas(migrated), [], 'Migration never assigns random cells to areas');
  assert.deepEqual(migrateImageRevealQuestion(migrated), migrated);
  const draft = migrateImageRevealQuestion({ id: old.id, type: 'standard', typeDrafts: { imageReveal: old } });
  assert.equal(draft.typeDrafts.imageReveal.imageRevealStyle, 'areas');
});

test('image zoom centers the chosen opening detail and expands continuously to the whole image', () => {
  const { getImageRevealFrame } = projectLoader()('@/lib/imageReveal');
  const first = getImageRevealFrame(4, 4, 80, 30);
  assert(Math.abs(first.x + first.size / 2 - .8) < 1e-9);
  assert(Math.abs(first.y + first.size / 2 - .3) < 1e-9);
  for (const focus of [0, 20, 50, 80, 100]) {
    let previous = getImageRevealFrame(4, 4, focus, 100 - focus);
    for (const detail of [10, 25, 60, 100]) {
      const frame = getImageRevealFrame(detail, 4, focus, 100 - focus);
      assert(frame.x >= -1e-9 && frame.y >= -1e-9);
      assert(frame.x + frame.size <= 1 + 1e-9 && frame.y + frame.size <= 1 + 1e-9);
      assert(frame.x <= previous.x + 1e-9 && frame.y <= previous.y + 1e-9);
      assert(frame.x + frame.size >= previous.x + previous.size - 1e-9);
      assert(frame.y + frame.size >= previous.y + previous.size - 1e-9);
      previous = frame;
    }
    assert.deepEqual(previous, { x: 0, y: 0, size: 1, scale: 1 });
  }
});

test('detail sliders never change neighbouring stages', () => {
  const { setImageRevealLevel, getImageRevealLevels } = projectLoader()('@/lib/imageReveal');
  assert.deepEqual(setImageRevealLevel([8, 18, 35, 60, 100], 1, 70), [8, 70, 35, 60, 100]);
  assert.deepEqual(setImageRevealLevel([8, 18, 35, 60, 100], 2, 10), [8, 18, 10, 60, 100]);
  assert.deepEqual(setImageRevealLevel([8, 18, 35, 60, 100], 0, 100), [100, 18, 35, 60, 100]);
  assert.deepEqual(setImageRevealLevel([8, 18, 35, 60, 100], 4, 30), [8, 18, 35, 60, 30]);
  const lowered = setImageRevealLevel([8, 18, 35, 60, 100], 3, 0);
  assert.deepEqual(getImageRevealLevels(JSON.parse(JSON.stringify(lowered))), [8, 18, 35, .04, 100]);
});

test('stage framing inherits the previous focus but keeps explicitly edited later stages independent', () => {
  const { getImageRevealStageFrame, setImageRevealStageFocus, getImageRevealLevels } = projectLoader()('@/lib/imageReveal');
  let q = { imageRevealLevels: [4, 9, 16, 100], imageRevealFocusX: 50, imageRevealFocusY: 50 };
  q = { ...q, imageRevealStageFocus: setImageRevealStageFocus(q, 0, 70, 35) };
  const first = getImageRevealStageFrame(q, 0);
  const inherited = getImageRevealStageFrame(q, 1);
  assert(Math.abs(inherited.x + inherited.size / 2 - .7) < 1e-9);
  q = { ...q, imageRevealStageFocus: setImageRevealStageFocus(q, 1, 40, 60) };
  assert.deepEqual(getImageRevealStageFrame(q, 0), first);
  const second = getImageRevealStageFrame(q, 1);
  assert(Math.abs(second.x + second.size / 2 - .4) < 1e-9);
  assert(Math.abs(getImageRevealStageFrame(q, 2).x + .2 - .4) < 1e-9);
  q = { ...q, imageRevealStageFocus: setImageRevealStageFocus(q, 0, 20, 20) };
  assert.deepEqual(getImageRevealStageFrame(q, 1), second);
  assert.deepEqual(getImageRevealStageFrame(q, 3), { x: 0, y: 0, size: 1, scale: 1 });
  assert.deepEqual(getImageRevealLevels([.04, .0625, .1111, 100]), [.04, .0625, .1111, 100]);
  assert.deepEqual(getImageRevealStageFrame(JSON.parse(JSON.stringify(q)), 1), second);
});

test('dragging the image pans the opening view proportionally without exposing edges', () => {
  const { panImageRevealFrame } = projectLoader()('@/lib/imageReveal');
  const moved = panImageRevealFrame(25, 50, 50, .1, -.1);
  assert(Math.abs(moved.x - 45) < 1e-9 && Math.abs(moved.y - 55) < 1e-9);
  assert.deepEqual(panImageRevealFrame(25, 50, 50, 10, -10), { x: 25, y: 75 });
  assert.deepEqual(panImageRevealFrame(100, 50, 50, 10, -10), { x: 50, y: 50 });
});

test('50x image zoom survives normalization and preserves an off-centre opening crop', () => {
  const { getImageRevealLevels, setImageRevealLevel, getImageRevealFrame, panImageRevealFrame } = projectLoader()('@/lib/imageReveal');
  const levels = setImageRevealLevel([8, 18, 35, 60, 100], 0, .04);
  assert.deepEqual(getImageRevealLevels(JSON.parse(JSON.stringify(levels))), [.04, 18, 35, 60, 100]);
  const frame = getImageRevealFrame(.04, .04, 80, 30);
  assert.equal(frame.scale, 50);
  assert(Math.abs(frame.x + frame.size / 2 - .8) < 1e-9);
  const moved = panImageRevealFrame(.04, 80, 30, .1, .1);
  assert(Math.abs(moved.x - 79.8) < 1e-9 && Math.abs(moved.y - 29.8) < 1e-9);
  assert.deepEqual(getImageRevealFrame(100, .04, 80, 30), { x: 0, y: 0, size: 1, scale: 1 });
});

test('backup retains pre-spin category and host-message progress instead of stale legacy state', async () => {
  const current = {
    order: [], boardIndex: 0, lyricsIndex: 0,
    revealedCategories: ['Christmas'], dismissedHostMessageIds: ['toast'],
    resolvedHostMessages: { toast: { text: 'Saved selection' } },
  };
  const data = new Map([
    ['kimquizak_turn_state_v1', JSON.stringify(current)],
    ['julebord_turn_state_v1', JSON.stringify({ order: ['obsolete-team'], boardIndex: 1 })],
    ['kimquizak_teams_v1', '[]'],
    ['julebord_teams_v1', JSON.stringify([{ id: 'obsolete-team' }])],
  ]);
  global.window = { localStorage: { getItem: key => data.get(key) ?? null } };
  try {
    const load = projectLoader({ '@/lib/questionStorage': { readQuestions: async () => [] } });
    const backup = await load('@/lib/backup').buildBackupPayload();
    assert.deepEqual(backup.turnState, current);
    assert.deepEqual(backup.teams, [], 'An intentionally empty current roster beats a legacy roster');
  } finally { delete global.window; }
});

test('backup import/export preserves inactive image drafts', () => {
  const { parseBackupPayload } = projectLoader({ '@/lib/questionStorage': {} })('@/lib/backup');
  const questions = [{ id: 'q', category: 'A', points: 100, type: 'audio', prompt: 'Listen', answer: 'Song', answered: false,
    typeDrafts: { standard: { prompt: 'Original', answer: 'Answer', imageData: 'data:image/png;base64,AAAA' } } }];
  const parsed = parseBackupPayload(JSON.stringify({ teams: [], questions }));
  assert.deepEqual(parsed.questions, questions);
  assert.deepEqual(parseBackupPayload(JSON.stringify(parsed)).questions, questions);
});

test('final row, final category, and category bonus unlock only after their opening questions', () => {
  const { getVisibleBoardQuestions } = projectLoader()('@/lib/boardReveal');
  const questions = ['A', 'B'].flatMap(category => [100, 200].map(points => ({
    id: category + points, category, points, prompt: 'Question', answer: 'Answer', answered: false,
  })));
  const row = { rows: { 200: { when: 'board-complete' } } };
  assert.equal(getVisibleBoardQuestions(questions, row).length, 2);
  const answered = questions.map(q => ({ ...q, answered: q.points === 100 }));
  assert.equal(getVisibleBoardQuestions(answered, row).length, 4);
  const column = { categories: { B: { when: 'board-complete' } } };
  assert.equal(getVisibleBoardQuestions(questions, column).length, 2);
  assert.equal(getVisibleBoardQuestions(questions.map(q => ({ ...q, answered: q.category === 'A' })), column).length, 4);
  const bonus = { questions: { A200: { when: 'category-complete', category: '__own_category__' } } };
  assert.equal(getVisibleBoardQuestions(questions, bonus).length, 3);
  assert.equal(getVisibleBoardQuestions(answered, bonus).length, 4);
});

test('audio replay uses the next available tier and preserves the consumed payout', () => {
  const { getAudioReplayValue, getAudioAvailablePoints } = projectLoader()('@/lib/audioScoring');
  assert.equal(getAudioReplayValue(750, [100, 300, 750]), 300);
  assert.equal(getAudioReplayValue(100, [100, 300, 750]), null);
  assert.equal(getAudioAvailablePoints(750, 1, [100, 300, 750]), 750);
  assert.equal(getAudioAvailablePoints(750, 2, [100, 600, 750], 300), 300);
});

test('host countdowns are not random draws and mixed player draws do not repeat', () => {
  const { hasRandomHostMessageVariable, parseHostMessageCountdown, resolveHostMessageTemplate } = projectLoader()('@/lib/hostMessageTemplates');
  assert.equal(hasRandomHostMessageVariable('Break {1m30s}'), false);
  assert.equal(parseHostMessageCountdown('100s'), 100);
  assert.equal(parseHostMessageCountdown('1m30s'), 90);
  const teams = [{ id: 'a', name: 'Team', score: 0, players: [
    { id: 'p1', name: 'Alex', gender: 'M' },
    { id: 'p2', name: 'Sam', gender: 'F' },
    { id: 'p3', name: 'Robin' },
  ] }];
  const result = resolveHostMessageTemplate('{random.player} {random.male} {random.female}', teams, () => 0);
  assert.equal(result.randomSelections.length, 3);
  assert.equal(new Set(result.randomSelections.map(draw => draw.playerId)).size, 3);
  assert.equal(result.randomSelections[1].playerId, 'p1');
  assert.equal(result.randomSelections[2].playerId, 'p2');
});

test('multiple choice accepts 2–12 complete options and validates the correct answer beyond D', () => {
  const { getQuestionIssues } = projectLoader()('@/lib/questionValidation');
  const base = { id: 'mcq', category: 'Test', points: 500, type: 'mcq', prompt: 'Choose one', answer: '' };
  for (const length of [2, 4, 5, 12]) {
    const q = { ...base, mcqOptions: Array.from({ length }, (_, i) => `Answer ${i + 1}`), mcqCorrectIndex: length - 1 };
    assert.deepEqual(getQuestionIssues(q), []);
    for (const index of [-1, length, 0.5, NaN]) assert(getQuestionIssues({ ...q, mcqCorrectIndex: index }).includes('Choose the correct option'));
    assert(getQuestionIssues({ ...q, mcqOptions: [...q.mcqOptions.slice(0, -1), ' '] }).length);
  }
  for (const length of [0, 1, 13]) assert(getQuestionIssues({ ...base, mcqOptions: Array(length).fill('Answer'), mcqCorrectIndex: 0 }).length);
});

test('multi-answer MCQ shares an exact point pool and rejects repeat picks', () => {
  const { pickMcqOption, createMcqProgress } = projectLoader()('@/lib/mcq');
  const q = { type: 'mcq', points: 500, mcqOptions: Array(12).fill('Option'), mcqCorrectIndexes: [0, 4, 11], mcqRequiredCorrect: 3, mcqRotateOnMiss: true };
  let result = pickMcqOption(q, createMcqProgress(), 0, 'first');
  assert.equal(result.points, 166);
  assert.equal(result.progress.finished, false);
  assert.equal(pickMcqOption(q, result.progress, 0, 'first'), null);
  result = pickMcqOption(q, result.progress, 1, 'first');
  assert.equal(result.points, 0);
  assert.equal(result.progress.finished, false);
  assert.deepEqual(result.progress.pointsByTeam, { first: 166 });
  assert.equal(pickMcqOption(q, result.progress, 1, 'second'), null);
  result = pickMcqOption(q, result.progress, 4, 'second');
  result = pickMcqOption(q, result.progress, 11, 'second');
  assert.equal(result.progress.finished, true);
  assert.deepEqual(result.progress.pointsByTeam, { first: 166, second: 334 });
  assert.equal(pickMcqOption(q, result.progress, 2, 'first'), null);
  let sweep = createMcqProgress();
  for (const index of [11, 0, 4]) sweep = pickMcqOption(q, sweep, index, 'first').progress;
  assert.deepEqual(sweep.pointsByTeam, { first: 500 });
});

test('multi-answer MCQ supports a smaller finish target, retained points on a miss, and legacy answers', () => {
  const { pickMcqOption, createMcqProgress } = projectLoader()('@/lib/mcq');
  const { getQuestionIssues } = projectLoader()('@/lib/questionValidation');
  const q = { type: 'mcq', prompt: 'Which ones?', points: 300, mcqOptions: ['A', 'B', 'C', 'D'], mcqCorrectIndexes: [0, 1, 2], mcqRequiredCorrect: 2, mcqRotateOnMiss: true };
  assert.deepEqual(getQuestionIssues(q), []);
  for (const required of [0, 4, 1.5]) assert(getQuestionIssues({ ...q, mcqRequiredCorrect: required }).length);
  assert(getQuestionIssues({ ...q, mcqCorrectIndexes: [0, 0] }).length);
  assert(getQuestionIssues({ ...q, mcqCorrectIndexes: [0, 12] }).length);
  let result = pickMcqOption(q, createMcqProgress(), 0, 'a');
  const stopped = pickMcqOption({ ...q, mcqRotateOnMiss: false }, result.progress, 3, 'a');
  assert(stopped.progress.finished);
  assert.deepEqual(stopped.progress.pointsByTeam, { a: 150 });
  result = pickMcqOption(q, result.progress, 2, 'b');
  assert(result.progress.finished);
  assert.deepEqual(result.progress.pointsByTeam, { a: 150, b: 150 });
  const legacy = { ...q, mcqCorrectIndexes: undefined, mcqRequiredCorrect: undefined, mcqCorrectIndex: 3 };
  result = pickMcqOption(legacy, createMcqProgress(), 3, 'a');
  assert.equal(result.points, 300);
  assert(result.progress.finished);
});

function connectionsQuestion(overrides = {}) {
  return { id: 'connections', type: 'connections', category: 'Games', prompt: '', answer: '', answered: false, points: 501,
    connectionsGroups: Array.from({ length: 4 }, (_, group) => ({ label: `Group ${group}`, words: Array.from({ length: 4 }, (_, word) => `Tile ${group}-${word}`) })), ...overrides };
}

test('Connections validates four distinct groups, Unicode tiles, and optional pacing limits', () => {
  const { getQuestionIssues } = projectLoader()('@/lib/questionValidation');
  const q = connectionsQuestion();
  assert.deepEqual(getQuestionIssues(q), []);
  assert.deepEqual(getQuestionIssues({ ...q, connectionsGuessSeconds: 0, connectionsMistakeLimit: 0 }), []);
  for (const connectionsGuessSeconds of [-1, .5, NaN, 3601]) assert(getQuestionIssues({ ...q, connectionsGuessSeconds }).length);
  for (const connectionsMistakeLimit of [-1, .5, NaN, 101]) assert(getQuestionIssues({ ...q, connectionsMistakeLimit }).length);
  assert(getQuestionIssues({ ...q, connectionsGroups: q.connectionsGroups.slice(0, 3) }).length);
  q.connectionsGroups[0].words = ['Æ', 'Ø', 'Å', 'å '];
  assert(getQuestionIssues(q).includes('Every tile must be unique'));
  q.connectionsGroups[0].words = ['Æ', 'Ø', 'Å', 'Snø'];
  assert.deepEqual(getQuestionIssues(q), []);
});

test('Connections splits the exact pool, retains turns, and rejects duplicate or invalid submissions', () => {
  const { createConnectionsProgress, advanceConnections } = projectLoader()('@/lib/connections');
  const q = connectionsQuestion();
  const order = ['a', 'b'];
  let state = createConnectionsProgress('a');
  assert.equal(new Set(state.order).size, 16);
  assert.equal(advanceConnections(q, state, { type: 'guess', tiles: [0, 1, 2, 3] }, order, 0), null);
  state = advanceConnections(q, state, { type: 'start' }, order, 1000).progress;
  assert.equal(state.deadline, 121000);
  for (const tiles of [[0,0,1,2], [0,1,2,16], [0,1,2,.5], [0,1,2]]) assert.equal(advanceConnections(q, state, { type:'guess', tiles }, order, 2000), null);
  state = advanceConnections(q, state, { type:'guess', tiles:[0,1,2,3] }, order, 2000).progress;
  assert.equal(state.deadline, 122000);
  assert.equal(state.teamId, 'a');
  assert.equal(state.pointsByTeam.a, 125);
  assert.equal(advanceConnections(q, state, { type:'guess', tiles:[3,2,1,0] }, order, 2100), null);
  state = advanceConnections(q, state, { type:'guess', tiles:[4,5,6,8] }, order, 3000).progress;
  assert.equal(state.feedback, "Three are correct");
  assert.equal(state.teamId, 'b');
  assert.equal(state.mistakes, 1);
  assert.equal(advanceConnections(q, state, { type:'guess', tiles:[8,6,5,4] }, order, 4000), null);
  for (const group of [1,2,3]) state = advanceConnections(q, state, { type:'guess', tiles:[0,1,2,3].map(tile => group*4+tile) }, order, 5000).progress;
  assert(state.finished);
  assert.equal(state.finishReason, 'solved');
  assert.deepEqual(state.pointsByTeam, { a:125, b:376 });
  assert.equal(state.deadline, null);
  assert.equal(advanceConnections(q, state, { type:'end' }, order, 5000), null);
});

test('Connections expires late guesses without points, resets each guess timer, and honors rollover off', () => {
  const { createConnectionsProgress, advanceConnections } = projectLoader()('@/lib/connections');
  const q = connectionsQuestion({ connectionsRotateOnMiss:false, connectionsGuessSeconds:10, connectionsMistakeLimit:2 });
  let state = advanceConnections(q, createConnectionsProgress('a'), { type:'start' }, ['a','b'], 0).progress;
  assert.equal(advanceConnections(q, state, { type:'timeout' }, ['a','b'], 9999), null);
  state = advanceConnections(q, state, { type:'guess', tiles:[0,1,2,3] }, ['a','b'], 10000).progress;
  assert.equal(state.mistakes, 1);
  assert.equal(state.teamId, 'a');
  assert.equal(state.deadline, 20000);
  assert.deepEqual(state.solved, []);
  state = advanceConnections(q, state, { type:'guess', tiles:[0,1,2,3] }, ['a','b'], 11000).progress;
  assert.equal(state.deadline, 21000);
  assert.equal(state.pointsByTeam.a, 125);
  state = advanceConnections(q, state, { type:'timeout' }, ['a','b'], 21000).progress;
  assert(state.finished);
  assert.equal(state.finishReason, 'mistakes');
  assert.equal(state.pointsByTeam.a, 125);
});

test('Connections restores deadlines and progress, supports unlimited play, and host termination', () => {
  const { createConnectionsProgress, advanceConnections } = projectLoader()('@/lib/connections');
  const q = connectionsQuestion({ connectionsGuessSeconds:0, connectionsMistakeLimit:0 });
  let state = advanceConnections(q, createConnectionsProgress('a'), { type:'start' }, ['a','b'], 0).progress;
  assert.equal(state.deadline, null);
  assert.equal(advanceConnections(q, state, { type:'timeout' }, ['a','b'], 9999999), null);
  state = advanceConnections(q, state, { type:'guess', tiles:[0,1,2,4] }, ['a','b'], 9999999).progress;
  assert.equal(state.teamId, 'b');
  assert(!state.finished);
  const restored = JSON.parse(JSON.stringify(state));
  assert.deepEqual(restored, state);
  const finished = advanceConnections(q, restored, { type:'end' }, ['a','b'], 10000000);
  assert.equal(finished.progress.finishReason, 'host');
  assert.deepEqual(finished.progress.pointsByTeam, {});
  const timed = connectionsQuestion();
  state = advanceConnections(timed, createConnectionsProgress('a'), { type:'start' }, ['a','b'], 0).progress;
  state = advanceConnections(timed, JSON.parse(JSON.stringify(state)), { type:'timeout' }, ['a','b'], 500000).progress;
  assert.equal(state.mistakes, 1);
  assert.equal(state.teamId, 'b');
  assert.equal(state.deadline, 620000, 'returning after expiry starts a fresh guess, not a reset of the expired turn');
});

test('Connections text parses four lines and preserves quoted punctuation and Unicode', () => {
  const { parseConnectionsText, formatConnectionsText, getConnectionsIssues } = projectLoader()('@/lib/connections');
  const q = connectionsQuestion();
  q.connectionsGroups[0] = { label:'Say: something', words:['Hello, world','Say "yes"','Æ','Snø'] };
  const raw = formatConnectionsText(q.connectionsGroups);
  const parsed = parseConnectionsText('\n' + raw.replace(/\n/g, '\r\n') + '\n');
  assert.deepEqual(parsed.issues, []);
  assert.deepEqual(parsed.groups, q.connectionsGroups);
  for (const text of ['No delimiter', 'Name: one, two, three', 'Name: one, two, three, four, five', 'Name: one, two, three,', 'Name: "unclosed, two, three, four']) {
    const result = parseConnectionsText(text);
    assert(result.issues.some(issue => issue.startsWith('Line 1:')));
    assert(getConnectionsIssues({ ...q, connectionsText:text }).length, 'Invalid raw draft cannot leave an old puzzle playable');
  }
  assert(parseConnectionsText(raw + '\nExtra: a,b,c,d').issues.length);
  assert.deepEqual(parseConnectionsText(raw).groups, q.connectionsGroups);
});

test('Connections finish targets accept any groups, split the exact pool, and reject filler', () => {
  const { advanceConnections, createConnectionsProgress, getConnectionsIssues, parseConnectionsText } = projectLoader()('@/lib/connections');
  for (const target of [1,2,3,4]) {
    const q = connectionsQuestion({connectionsRequired:target});
    assert.deepEqual(getConnectionsIssues(q), []);
    let state = advanceConnections(q, createConnectionsProgress('a'), {type:'start'}, ['a','b'], 0).progress;
    for (let pick=0; pick<target; pick++) {
      const group = 3-pick;
      state = advanceConnections(q, state, {type:'guess',tiles:[0,1,2,3].map(i=>group*4+i)}, ['a','b'], 1000).progress;
      assert.equal(state.finished, pick === target-1);
      if (pick === 0 && target > 1) state = advanceConnections(q, state, {type:'guess',tiles:[0,1,2,4]}, ['a','b'], 1500).progress;
    }
    assert.equal(state.finishReason, 'solved');
    assert.equal(Object.values(state.pointsByTeam).reduce((a,b)=>a+b,0),501);
    assert.equal(state.deadline,null);
    assert.equal(advanceConnections(q,state,{type:'guess',tiles:[0,1,2,3]},['a','b'],2000),null);
  }
  for (const required of [0,5,1.5,NaN]) assert(getConnectionsIssues(connectionsQuestion({connectionsRequired:required})).length);
  assert(getConnectionsIssues(connectionsQuestion({connectionsFiller:['legacy draft']})).length);
  assert(parseConnectionsText('Filler: one, two, three, four').issues.some(issue=>issue.includes('replace filler')));
  assert(getConnectionsIssues({...connectionsQuestion(),connectionsGroups:connectionsQuestion().connectionsGroups.slice(0,3)}).length);
});

test('Connections shuffle changes only unsolved positions and never resets rules or deadlines', () => {
  const { advanceConnections, createConnectionsProgress, shuffleConnectionsOrder } = projectLoader()('@/lib/connections');
  const q = connectionsQuestion();
  const unchangedRandom = () => .999999;
  const ordered = Array.from({length:16}, (_,i)=>i);
  assert.notDeepEqual(shuffleConnectionsOrder(ordered, [], unchangedRandom), ordered, 'Even an identity shuffle changes the layout');
  let state = createConnectionsProgress('a', unchangedRandom);
  state = advanceConnections(q, state, {type:'start'}, ['a','b'], 0, unchangedRandom).progress;
  state = advanceConnections(q, state, {type:'guess',tiles:[0,1,2,3]}, ['a','b'], 1000).progress;
  const shuffled = advanceConnections(q, state, {type:'shuffle'}, ['a','b'], 2000, unchangedRandom).progress;
  assert.notDeepEqual(shuffled.order, state.order);
  assert.deepEqual([...shuffled.order].sort((a,b)=>a-b), ordered);
  state.order.forEach((tile,index)=>{if(tile<4) assert.equal(shuffled.order[index],tile);});
  assert.deepEqual({...shuffled,order:state.order}, state);
  const expired = advanceConnections(q, state, {type:'shuffle'}, ['a','b'], state.deadline).progress;
  assert.equal(expired.mistakes, 1, 'Shuffle cannot bypass an expired guess');
  assert.equal(expired.teamId, 'b');
});

test('Capra and Liflig animal presets keep local SVGs across backup serialization without replacing other themes', () => {
  const load = projectLoader();
  const { getThemeById, legacyTeamThemes } = load('@/lib/defaultData');
  const { getTeamAnimalSrc } = load('@/lib/teamAnimals');
  const { reconcileTeamTheme } = load('@/lib/teamPresentation');
  const theme = getThemeById('capra-liflig');
  assert.equal(theme.options.length, 8);
  assert.equal(theme.options[0].emoji, '🐐');
  for (const option of theme.options) {
    const restored = JSON.parse(JSON.stringify({ badgeEmoji: option.emoji, accentBase: option.base }));
    const src = getTeamAnimalSrc(restored.badgeEmoji, restored.accentBase);
    assert(src);
    const svg = fs.readFileSync(path.resolve(__dirname, '../public' + src), 'utf8');
    assert.match(svg, /<svg/);
    assert.doesNotMatch(svg, /<script|<image|<foreignObject|onload=/i);
    assert.equal(getTeamAnimalSrc(option.emoji, '#123456'), undefined);
  }
  assert.equal(getTeamAnimalSrc('🎂', '#d62f68'), undefined);
  const old = legacyTeamThemes.find(theme => theme.id === 'capra-liflig-preview').options[0];
  const updated = reconcileTeamTheme({id:'example',name:'Example',players:[],score:0,badgeEmoji:old.emoji,accentBase:old.base}, theme.id);
  assert.equal(updated.badgeEmoji, '🐐');
  assert(getTeamAnimalSrc(updated.badgeEmoji, updated.accentBase));
});
