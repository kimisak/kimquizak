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
