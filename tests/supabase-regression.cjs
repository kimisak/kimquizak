/* eslint-disable @typescript-eslint/no-require-imports -- Node regression runner. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { NextRequest } = require('next/server');

function load(file, stubs) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function('require', 'module', 'exports', code)(name => stubs[name] ?? require(name), loaded, loaded.exports);
  return loaded.exports;
}
const config = { url: 'https://example.supabase.co', publishableKey: 'publishable-test-placeholder' };

test('proxy verifies claims and propagates every cookie batch with no-cache headers', async () => {
  let verified = false;
  const { updateSession } = load('src/lib/supabase/proxy.ts', {
    './config': { getSupabaseConfig: () => config },
    '@supabase/ssr': { createServerClient: (_url, _key, { cookies }) => ({ auth: {
      getClaims: async () => {
        verified = true;
        assert.equal(cookies.getAll()[0].value, 'expired');
        cookies.setAll([{ name: 'session', value: 'refreshed', options: { path: '/', sameSite: 'lax' } }], { 'Cache-Control': 'private, no-store' });
        cookies.setAll([{ name: 'session.1', value: 'chunk', options: { path: '/' } }], {});
        return { data: { claims: { sub: 'test-owner' } }, error: null };
      },
    } }) },
  });
  const request = new NextRequest('https://example.com/game', { headers: { cookie: 'session=expired' } });
  const response = await updateSession(request);
  assert(verified);
  assert.equal(request.cookies.get('session').value, 'refreshed');
  assert.equal(response.cookies.get('session').value, 'refreshed');
  assert.equal(response.cookies.get('session.1').value, 'chunk');
  assert.match(response.headers.get('Cache-Control'), /private.*no-store/);
  assert.equal(response.headers.get('Pragma'), 'no-cache');
});

test('unconfigured demo passes through without constructing a Supabase client', async () => {
  const { updateSession } = load('src/lib/supabase/proxy.ts', {
    './config': { getSupabaseConfig: () => null },
    '@supabase/ssr': { createServerClient: () => { throw new Error('Unexpected client'); } },
  });
  const response = await updateSession(new NextRequest('https://example.com/game'));
  assert.equal(response.status, 200);
});

test('server helpers create separate clients for separate requests and await cookies', async () => {
  let count = 0;
  const written = [];
  const { createClient } = load('src/lib/supabase/server.ts', {
    './config': { requireSupabaseConfig: () => config },
    'next/headers': { cookies: async () => ({ getAll: () => [], set: (...args) => written.push(args) }) },
    '@supabase/ssr': { createServerClient: (_url, _key, options) => ({ id: ++count, options }) },
  });
  const first = await createClient(), second = await createClient();
  assert.notEqual(first.id, second.id);
  first.options.cookies.setAll([{ name: 'test', value: 'value', options: { path: '/' } }]);
  assert.deepEqual(written, [['test', 'value', { path: '/' }]]);
});

test('proxy matcher covers app requests and excludes audio and framework assets', () => {
  const { unstable_doesMiddlewareMatch } = require('next/experimental/testing/server');
  const { config: matcher } = load('src/proxy.ts', { '@/lib/supabase/proxy': {} });
  for (const url of ['/', '/game', '/config/questions', '/login', '/auth/callback', '/api/maps/config']) {
    assert(unstable_doesMiddlewareMatch({ config: matcher, nextConfig: {}, url }), url);
  }
  for (const url of ['/audio/sleigh-bells-fast.mp3', '/favicon.ico', '/_next/static/main.js', '/kimquizak-logo.svg']) {
    assert.equal(unstable_doesMiddlewareMatch({ config: matcher, nextConfig: {}, url }), false, url);
  }
});

test('owner guard rejects missing configuration, anonymous, invalid, and other users', async () => {
  const original = process.env.KIMQUIZAK_OWNER_USER_ID;
  try {
    let result = { data: { user: null }, error: null };
    let calls = 0;
    const client = { auth: { getUser: async () => { calls++; return result; } } };
    const { getOwner } = load('src/lib/auth/owner.ts', {
      '@/lib/supabase/config': { getSupabaseConfig: () => config },
      '@/lib/supabase/server': { createClient: async () => client },
    });
    delete process.env.KIMQUIZAK_OWNER_USER_ID;
    assert.equal(await getOwner(), null);
    assert.equal(calls, 0);
    process.env.KIMQUIZAK_OWNER_USER_ID = 'owner';
    assert.equal(await getOwner(), null);
    result = { data: { user: { id: 'someone-else' } }, error: null };
    assert.equal(await getOwner(), null);
    result = { data: { user: { id: 'owner' } }, error: new Error('invalid token') };
    assert.equal(await getOwner(), null);
    result.error = null;
    assert.equal((await getOwner()).userId, 'owner');
  } finally {
    if (original === undefined) delete process.env.KIMQUIZAK_OWNER_USER_ID;
    else process.env.KIMQUIZAK_OWNER_USER_ID = original;
  }
});

test('Maps key is never returned to an unauthorized caller', async () => {
  const { GET } = load('src/app/api/maps/config/route.ts', {
    '@/lib/auth/owner': { getOwner: async () => null },
  });
  const response = await GET();
  assert.equal(response.status, 401);
  assert.equal((await response.json()).apiKey, undefined);
  assert.match(response.headers.get('cache-control'), /no-store/);
});

test('archive denies anonymous reads and writes, and cross-origin owner writes', async () => {
  const { GET, POST } = load('src/app/api/quizzes/route.ts', {
    '@/lib/auth/owner': { getOwner: async () => null },
    '@/lib/backup': { parseBackupPayload: JSON.parse },
  });
  assert.equal((await GET(new Request('https://example.com/api/quizzes'))).status, 401);
  assert.equal((await GET(new Request('https://example.com/api/quizzes?id=123'))).status, 401);
  assert.equal((await POST(new Request('https://example.com/api/quizzes', { method: 'POST', headers: { origin: 'https://example.com' }, body: '{}' }))).status, 401);
  assert.equal((await POST(new Request('https://example.com/api/quizzes', { method: 'POST', headers: { origin: 'https://other.com' }, body: '{}' }))).status, 403);
});

test('archive inserts the verified owner and rejects oversized or malformed backups', async () => {
  const inserted = [];
  const { POST } = load('src/app/api/quizzes/route.ts', {
    '@/lib/auth/owner': { getOwner: async () => ({ userId: 'real-owner', supabase: {
      from: () => ({ insert: async row => { inserted.push(row); return { error: null }; } }),
    } }) },
    '@/lib/backup': { parseBackupPayload: JSON.parse },
  });
  const request = body => new Request('https://example.com/api/quizzes', { method: 'POST', headers: { origin: 'https://example.com' }, body });
  assert.equal((await POST(request('{'))).status, 400);
  assert.equal((await POST(request('x'.repeat(3_000_001)))).status, 413);
  assert.equal(inserted.length, 0);
  assert.equal((await POST(request(JSON.stringify({ owner_id: 'fake-owner', settings: { quizTitle: 'Example' } })))).status, 201);
  assert.equal(inserted[0].owner_id, 'real-owner');
  assert.equal(inserted[0].title, 'Example');
});

test('login removes a valid session belonging to a non-owner', async () => {
  const original = process.env.KIMQUIZAK_OWNER_USER_ID;
  process.env.KIMQUIZAK_OWNER_USER_ID = 'owner';
  let signedOut = false;
  try {
    const { signIn } = load('src/app/login/actions.ts', {
      'next/navigation': { redirect: () => assert.fail('Must not redirect non-owner') },
      '@/lib/supabase/config': { getSupabaseConfig: () => config },
      '@/lib/supabase/server': { createClient: async () => ({ auth: {
        signInWithPassword: async () => ({ data: { user: { id: 'other' }, session: {} }, error: null }),
        signOut: async () => { signedOut = true; },
      } }) },
    });
    const form = new FormData(); form.set('email', 'demo@example.com'); form.set('password', 'test-only');
    assert.equal(await signIn('', form), 'Unable to sign in with this account.');
    assert(signedOut);
  } finally {
    if (original === undefined) delete process.env.KIMQUIZAK_OWNER_USER_ID;
    else process.env.KIMQUIZAK_OWNER_USER_ID = original;
  }
});

test('archive reads constrain queries to the verified owner and never list quiz contents', async () => {
  const calls = [];
  const query = {
    select: value => { calls.push(['select', value]); return query; },
    eq: (key, value) => { calls.push(['eq', key, value]); return query; },
    order: () => query,
    limit: async () => ({ data: [], error: null }),
    maybeSingle: async () => ({ data: null, error: null }),
  };
  const { GET } = load('src/app/api/quizzes/route.ts', {
    '@/lib/auth/owner': { getOwner: async () => ({ userId: 'owner', supabase: { from: () => query } }) },
    '@/lib/backup': { parseBackupPayload: JSON.parse },
  });
  const listing = await GET(new Request('https://example.com/api/quizzes'));
  assert.equal(listing.status, 200);
  assert.deepEqual(calls, [['select', 'id,title,created_at'], ['eq', 'owner_id', 'owner']]);
  calls.length = 0;
  const id = '00000000-0000-0000-0000-000000000001';
  const missing = await GET(new Request(`https://example.com/api/quizzes?id=${id}`));
  assert.equal(missing.status, 404);
  assert.deepEqual(calls, [['select', 'payload'], ['eq', 'owner_id', 'owner'], ['eq', 'id', id]]);
});

test('owner login redirects only after successful authentication', async () => {
  const original = process.env.KIMQUIZAK_OWNER_USER_ID;
  process.env.KIMQUIZAK_OWNER_USER_ID = 'owner';
  try {
    const redirectSignal = new Error('redirect');
    const { signIn } = load('src/app/login/actions.ts', {
      'next/navigation': { redirect: path => { assert.equal(path, '/account'); throw redirectSignal; } },
      '@/lib/supabase/config': { getSupabaseConfig: () => config },
      '@/lib/supabase/server': { createClient: async () => ({ auth: {
        signInWithPassword: async () => ({ data: { user: { id: 'owner' }, session: {} }, error: null }),
      } }) },
    });
    const form = new FormData(); form.set('email', 'demo@example.com'); form.set('password', 'test-only');
    await assert.rejects(signIn('', form), error => error === redirectSignal);
  } finally {
    if (original === undefined) delete process.env.KIMQUIZAK_OWNER_USER_ID;
    else process.env.KIMQUIZAK_OWNER_USER_ID = original;
  }
});

test('archive accepts the public Host when Next reconstructs an internal request URL', async () => {
  const { POST } = load('src/app/api/quizzes/route.ts', {
    '@/lib/auth/owner': { getOwner: async () => null },
    '@/lib/backup': { parseBackupPayload: JSON.parse },
  });
  const response = await POST(new Request('http://localhost:3016/api/quizzes', {
    method: 'POST', headers: { origin: 'https://example.com', host: 'example.com' }, body: '{}',
  }));
  // Reaches authentication instead of falsely rejecting a legitimate origin.
  assert.equal(response.status, 401);
});

test('delete rejects unauthenticated, cross-site, and invalid requests before touching storage', async () => {
  let owner = null;
  const { DELETE } = load('src/app/api/quizzes/route.ts', {
    '@/lib/auth/owner': { getOwner: async () => owner },
    '@/lib/backup': {},
  });
  const request = (id = '', origin = 'https://example.com') => new Request(`https://example.com/api/quizzes?id=${id}`, { method: 'DELETE', headers: { origin } });
  assert.equal((await DELETE(request())).status, 401);
  owner = { userId: 'owner', supabase: { from: () => assert.fail('Must not access storage') } };
  assert.equal((await DELETE(request('', 'https://other.com'))).status, 403);
  assert.equal((await DELETE(request('', ''))).status, 403);
  for (const id of ['', 'all', '-'.repeat(36)]) assert.equal((await DELETE(request(id))).status, 400);
});

test('delete targets exactly one owner snapshot and reports missing rows and database failures', async () => {
  const calls = [];
  const id = '00000000-0000-0000-0000-000000000001';
  let result = { data: { id }, error: null };
  const query = {
    delete: () => { calls.push(['delete']); return query; },
    eq: (key, value) => { calls.push(['eq', key, value]); return query; },
    select: value => { calls.push(['select', value]); return query; },
    maybeSingle: async () => result,
  };
  const { DELETE } = load('src/app/api/quizzes/route.ts', {
    '@/lib/auth/owner': { getOwner: async () => ({ userId: 'verified-owner', supabase: { from: table => { assert.equal(table, 'quiz_snapshots'); return query; } } }) },
    '@/lib/backup': {},
  });
  const request = () => new Request(`https://example.com/api/quizzes?id=${id}&owner_id=someone-else`, { method: 'DELETE', headers: { origin: 'https://example.com' } });
  const response = await DELETE(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { deleted: true });
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.deepEqual(calls, [['delete'], ['eq', 'owner_id', 'verified-owner'], ['eq', 'id', id], ['select', 'id']]);
  result = { data: null, error: null };
  assert.equal((await DELETE(request())).status, 404);
  result = { data: null, error: { message: 'database details must stay private' } };
  const failed = await DELETE(request());
  assert.equal(failed.status, 503);
  assert.doesNotMatch(await failed.text(), /database details/);
});

test('all Supabase clients use Secure cookies in production and allow local HTTP development', async () => {
  const original = process.env.NODE_ENV;
  try {
    for (const environment of ['production', 'development']) {
      process.env.NODE_ENV = environment;
      const options = [];
      const clientFactory = (_url, _key, settings) => {
        options.push(settings);
        return { auth: { getClaims: async () => ({ data: { claims: null }, error: null }) } };
      };
      const stubs = {
        './config': { getSupabaseConfig: () => config, requireSupabaseConfig: () => config },
        '@supabase/ssr': { createServerClient: clientFactory, createBrowserClient: clientFactory },
        'next/headers': { cookies: async () => ({ getAll: () => [], set: () => {} }) },
      };
      await load('src/lib/supabase/server.ts', stubs).createClient();
      load('src/lib/supabase/client.ts', stubs).createClient();
      await load('src/lib/supabase/proxy.ts', stubs).updateSession(new NextRequest('https://example.com/game'));
      assert.equal(options.length, 3);
      for (const settings of options) {
        assert.equal(settings.cookieOptions.secure, environment === 'production');
      }
    }
  } finally {
    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
  }
});
