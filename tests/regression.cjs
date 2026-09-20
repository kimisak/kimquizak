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
