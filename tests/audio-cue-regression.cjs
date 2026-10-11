/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS test runner. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const code = ts.transpileModule(fs.readFileSync('src/hooks/useAudioCue.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const flush = () => new Promise(resolve => setImmediate(resolve));

function mount(fetch, decoderAvailable = true) {
  const warnings = [];
  const audio = [];
  let cleanup;
  const sandbox = {
    exports: {}, AbortController, fetch,
    console: { warn: (...args) => warnings.push(args) },
    require: () => ({
      useRef: current => ({ current }),
      useEffect: effect => { cleanup = effect(); },
    }),
    Audio: class {
      constructor() { audio.push(this); }
      load() {}
      pause() {}
      play() { return Promise.resolve(); }
    },
    OfflineAudioContext: decoderAvailable ? class {
      async decodeAudioData(value) {
        return { sampleRate: 48000, length: 1, numberOfChannels: 1,
          getChannelData: () => new Float32Array([value]) };
      }
    } : undefined,
  };
  vm.runInNewContext(code, sandbox);
  const cues = sandbox.exports.useAudioCue();
  return { cues, warnings, audio, cleanup: () => cleanup() };
}

test('interrupted response bodies retain fallback volume and cancel remaining downloads', async () => {
  const signals = [];
  const hook = mount(async (_path, { signal }) => {
    signals.push(signal);
    return { ok: true, arrayBuffer: async () => { throw new TypeError('Failed to fetch'); } };
  });
  await flush();
  hook.cues.playSlotResolve();
  assert.equal(hook.audio.at(-1).volume, 0.32);
  assert.equal(signals.length, 2);
  assert(signals.every(signal => signal.aborted));
  assert.deepEqual(hook.warnings, []);
  hook.cleanup();
});

test('successful decoding still balances the selection cue', async () => {
  const hook = mount(async path => ({ ok: true,
    arrayBuffer: async () => path.includes('sleigh') ? 0.25 : 0.5 }));
  await flush();
  hook.cues.playSlotResolve();
  assert.equal(hook.audio.at(-1).volume, 0.34);
  hook.cleanup();
});

test('unmount cancels pending normalization without a warning', async () => {
  const signals = [];
  const hook = mount((_path, { signal }) => new Promise((_resolve, reject) => {
    signals.push(signal);
    signal.addEventListener('abort', () => reject(new Error('Aborted')));
  }));
  hook.cleanup();
  await flush();
  assert(signals.every(signal => signal.aborted));
  assert.deepEqual(hook.warnings, []);
});

test('browsers without offline decoding use the fallback without fetching', async () => {
  let fetched = false;
  const hook = mount(() => { fetched = true; }, false);
  await flush();
  hook.cues.playSlotResolve();
  assert.equal(fetched, false);
  assert.equal(hook.audio.at(-1).volume, 0.32);
  assert.deepEqual(hook.warnings, []);
  hook.cleanup();
});
