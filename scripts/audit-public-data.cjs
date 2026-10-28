/* eslint-disable @typescript-eslint/no-require-imports -- Node repository audit. */
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const git = (...args) => {
  try { return execFileSync('git', args, { maxBuffer: 64 * 1024 * 1024 }); }
  catch { throw new Error('Git audit could not complete. Output suppressed to avoid exposing file contents.'); }
};
const findings = new Set();
// Reviewed CC0 photograph, with provenance in docs/demo-image-source.md.
// Match decoded bytes, not a filename, so private replacement uploads still fail.
const reviewedPublicImages = new Set(['b29ec816f0886dd2f9826d347c78a56f495e7ffcc18bc5e39e9ec59439eb80f3']);
function isReviewedPublicImage(uri) {
  const match = /^data:image\/[a-z0-9.+-]+;base64,([a-z0-9+/=]+)$/i.exec(uri);
  return Boolean(match && reviewedPublicImages.has(createHash('sha256').update(Buffer.from(match[1], 'base64')).digest('hex')));
}
const patterns = [
  ['Google API key', /AIza[0-9A-Za-z_-]{35}/],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['GitHub token', /gh[pousr]_[A-Za-z0-9]{30,}/],
  ['AWS access key', /(?:AKIA|ASIA)[A-Z0-9]{16}/],
  ['Supabase secret key', /sb_secret_[A-Za-z0-9_-]{20,}/],
];
function inspect(filename, data, scope) {
  // Uploads can be embedded in quiz JSON, so checking image filenames alone
  // misses pictures in old exports and historical demo fixtures.
  if (/\.json$/i.test(filename)) {
    const images = data.toString('utf8').match(/data:image\/(?!svg\+xml)[^"\s]+/gi) ?? [];
    if (images.some(uri => !isReviewedPublicImage(uri))) {
      findings.add(`${scope}: embedded raster image requires privacy review: ${filename}`);
    }
  }
  if (data.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
    || data.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    || /\.(?:jpe?g|png|webp|gif|avif|heic|tiff?|bmp)$/i.test(filename)) {
    findings.add(`${scope}: raster image file requires privacy review: ${filename}`);
  }
  if ((/(^|\/)\.env(?:\.|$)/.test(filename) && filename !== '.env.example')
    || /(^|\/)private\//.test(filename) || /(^|\/)kimquizak-backup-.*\.json$/.test(filename)) {
    findings.add(`${scope}: private file included: ${filename}`);
  }
  for (const [label, pattern] of patterns) {
    if (pattern.test(data.toString('utf8'))) findings.add(`${scope}: ${label} pattern in ${filename}`);
  }
}
const files = [...new Set(git('ls-files', '--cached', '--others', '--exclude-standard', '-z').toString().split('\0').filter(Boolean))];
let count = 0;
for (const file of files) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
  inspect(file, fs.readFileSync(file), 'working tree');
  count++;
}
console.log(`Checked ${count} tracked/unignored files. Secret values are never printed.`);
if (process.argv.includes('--history')) {
  let blobs = 0;
  for (const row of git('rev-list', '--objects', '--all').toString().trim().split('\n')) {
    const split = row.indexOf(' ');
    if (split < 0) continue;
    const oid = row.slice(0, split), filename = row.slice(split + 1);
    if (git('cat-file', '-t', oid).toString().trim() !== 'blob') continue;
    inspect(filename, git('cat-file', 'blob', oid), `history ${oid.slice(0, 12)}`);
    blobs++;
  }
  const identities = new Set(git('log', '--all', '--format=%an <%ae>%n%cn <%ce>').toString().trim().split('\n'));
  console.log(`Checked ${blobs} historical file blobs. History retains ${identities.size} author/committer identities (values suppressed).`);
}
if (findings.size) {
  for (const finding of findings) console.error(finding);
  process.exitCode = 1;
} else {
  console.log('No checked credential patterns, private-file paths, or unreviewed raster pictures found. This is not a complete PII detector; content and metadata still need review.');
}
