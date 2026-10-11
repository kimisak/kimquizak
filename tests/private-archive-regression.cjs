/* eslint-disable @typescript-eslint/no-require-imports -- Node component regression runner. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const jsx = require('react/jsx-runtime');
const snapshot = { id: '00000000-0000-0000-0000-000000000001', title: 'Synthetic saved quiz', created_at: '2026-01-01T12:00:00Z' };

function harness({ confirm = true, status = 200, invalid = false, storageFailure = false } = {}) {
  const calls = [];
  const messages = [];
  const busy = [];
  let state = 0;
  const backup = { teams: [], questions: [], settings: { quizTitle: snapshot.title }, scoreHistory: [] };
  const stubs = {
    react: {
      useEffect: () => {},
      useState: () => [
        [[snapshot], () => {}], ['', value => messages.push(value)],
        [false, value => busy.push(value)], [true, () => {}],
      ][state++],
    },
    'react/jsx-runtime': jsx,
    'next/link': { default: 'a' },
    '@/lib/backup': {
      parseBackupPayload: text => {
        calls.push('parse');
        if (invalid) throw new Error('Backup is missing questions.');
        assert.deepEqual(JSON.parse(text), backup);
        return backup;
      },
      persistBackupToLocalStorage: async payload => {
        assert.equal(payload, backup);
        calls.push('restore');
        if (storageFailure) throw new Error('Storage is full.');
        await Promise.resolve();
        calls.push('restored');
      },
    },
  };
  const loaded = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('src/app/account/PrivateArchive.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const window = {
    confirm: message => { calls.push('confirm'); assert.match(message, /Synthetic saved quiz/); assert.match(message, /replaces.*teams, questions, settings, scores, and game progress/); return confirm; },
    location: { assign: url => { assert.equal(url, '/config/questions'); calls.push('navigate'); } },
  };
  const fetch = async (url, options) => {
    calls.push('fetch');
    assert.equal(url, `/api/quizzes?id=${snapshot.id}`);
    assert.equal(options.cache, 'no-store');
    assert.equal(options.method, undefined, 'Opening must not mutate the cloud copy');
    return { ok: status === 200, json: async () => status === 200 ? backup : { error: 'Owner login required.' } };
  };
  new Function('require', 'module', 'exports', 'window', 'fetch', code)(name => stubs[name] ?? require(name), loaded, loaded.exports, window, fetch);
  const root = loaded.exports.PrivateArchive();
  function find(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'button' && node.props.children === 'Open in editor') return node;
    for (const child of [node.props?.children].flat(Infinity)) {
      const found = find(child); if (found) return found;
    }
  }
  const button = find(root);
  assert(button, 'Open in editor button must be present');
  return { open: button.props.onClick, calls, messages, busy };
}

test('canceling open leaves both local and cloud quizzes untouched', async () => {
  const h = harness({ confirm: false }); await h.open();
  assert.deepEqual(h.calls, ['confirm']);
  assert.deepEqual(h.busy, []);
});

test('opening validates and finishes restoring before navigating to the editor', async () => {
  const h = harness(); await h.open();
  assert.deepEqual(h.calls, ['confirm', 'fetch', 'parse', 'restore', 'restored', 'navigate']);
  assert.deepEqual(h.busy, [true]);
});

test('expired login or invalid backups never overwrite local data', async () => {
  for (const options of [{ status: 401 }, { invalid: true }]) {
    const h = harness(options); await h.open();
    assert(!h.calls.includes('restore'));
    assert(!h.calls.includes('navigate'));
    assert(h.messages.at(-1));
    assert.deepEqual(h.busy, [true, false]);
  }
});

test('storage failure keeps the archive open and reports the error', async () => {
  const h = harness({ storageFailure: true }); await h.open();
  assert(!h.calls.includes('navigate'));
  assert.equal(h.messages.at(-1), 'Storage is full.');
  assert.deepEqual(h.busy, [true, false]);
});
