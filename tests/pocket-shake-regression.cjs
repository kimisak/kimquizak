/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS runner. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const compiled = ts.transpileModule(fs.readFileSync('src/lib/pocketShake.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const loaded = { exports: {} };
new Function('exports', compiled)(loaded.exports);
const { trackPocketShake } = loaded.exports;
function gesture(points) {
  let state = null;
  return points.map(([x, y, time]) => {
    const result = trackPocketShake(state, x, y, time);
    state = result.state;
    return result.ready;
  });
}
test('up-down-up works above, below, or across the pickup position at any pace', () => {
  for (const origin of [-100, 0, 100]) {
    for (const interval of [25, 100, 600]) {
      const result = gesture([[0,origin,0], [0,origin-20,interval], [0,origin+20,interval*2], [0,origin-20,interval*3]]);
      assert.deepEqual(result, [false, false, false, true]);
    }
  }
});
test('dense pointer samples do not erase a vertical shake', () => {
  const points = [[0, 0, 0]];
  for (const end of [-30, 30, -30]) {
    const start = points.at(-1)[1];
    for (let i = 1; i <= 300; i++) points.push([0, start + (end-start)*i/300, points.length]);
  }
  assert.equal(gesture(points).at(-1), true);
});
test('horizontal motion, small jitter, a single lift, and circles do not spill', () => {
  for (const points of [
    Array.from({ length: 20 }, (_, i) => [(i % 2) * 40, 0, i * 100]),
    Array.from({ length: 20 }, (_, i) => [0, (i % 2) * 5, i * 100]),
    Array.from({ length: 20 }, (_, i) => [0, -i * 10, i * 100]),
    Array.from({ length: 120 }, (_, i) => [Math.cos(i * .15) * 80, -150 + Math.sin(i * .15) * 80, i * 30]),
  ]) assert(gesture(points).every(ready => !ready));
});
test('vertical shaking tolerates horizontal wobble', () => {
  const points = Array.from({ length: 100 }, (_, i) =>
    [Math.sin(i * Math.PI / 10) * 8, Math.cos(i * Math.PI / 10) * 40, i * 16]);
  assert(gesture(points).some(Boolean));
});
test('unrelated movements separated by a pause do not count as a shake', () => {
  assert(gesture([[0,0,0],[0,-30,100],[0,30,200],[0,-30,2000]]).every(ready => !ready));
});
