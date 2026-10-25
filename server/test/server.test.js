import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';

import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import { io as createSocketClient } from 'socket.io-client';

import { createApp, createSocketServer, loadConfig } from '../server.js';
import { getChallengeState } from '../growth.js';

const testConfig = loadConfig({
  JWT_SECRET: 'a'.repeat(48),
  ALLOW_PUBLIC_SIGNUP: 'true',
  META_APP_SECRET: 'test-meta-secret',
  META_WEBHOOK_VERIFY_TOKEN: 'test-verify-token',
  META_PAGE_ACCESS_TOKEN: 'test-page-access-token',
  META_PAGE_ID: 'test-page-id',
  META_GRAPH_API_VERSION: 'v99.0',
});

async function withApp(run, fetchImpl = globalThis.fetch, config = testConfig) {
  const db = new Database(':memory:');
  const emitted = [];
  const io = {
    to(room) {
      return {
        emit(event, payload) {
          emitted.push({ room, event, payload });
        },
      };
    },
  };
  const { app } = createApp({ config, db, fetchImpl, io });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    await run({ baseUrl, db, emitted });
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    db.close();
  }
}

async function register(baseUrl, email = 'person@example.com') {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test User',
      email,
      password: 'correct-horse-42',
    }),
  });
  return { response, body: await response.json() };
}

test('health check, registration, password hashing, and protected routes work', async () => {
  await withApp(async ({ baseUrl, db }) => {
    const health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });

    const unauthorized = await fetch(`${baseUrl}/api/leads`);
    assert.equal(unauthorized.status, 401);

    const { response, body } = await register(baseUrl);
    assert.equal(response.status, 201);
    assert.equal(body.user.name, 'Test User');
    assert.equal(typeof body.token, 'string');
    assert.equal(JSON.stringify(body).includes('correct-horse-42'), false);

    const stored = db.prepare('SELECT password_hash FROM users WHERE email = ?').get('person@example.com');
    assert.notEqual(stored.password_hash, 'correct-horse-42');
    assert.equal(await bcrypt.compare('correct-horse-42', stored.password_hash), true);

    const me = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${body.token}` },
    });
    assert.equal(me.status, 200);
    assert.deepEqual((await me.json()).user, body.user);
  });
});

test('growth records are validated, user-private, exportable, and deletable', async () => {
  await withApp(async ({ baseUrl, db }) => {
    const { body: first } = await register(baseUrl);
    const { body: second } = await register(baseUrl, 'other@example.com');
    const create = await fetch(`${baseUrl}/api/growth/daily-actions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${first.token}`,
      },
      body: JSON.stringify({
        title: 'Solve two DSA problems',
        category: 'dsa',
        date: '2026-10-26',
        priority: 1,
      }),
    });
    assert.equal(create.status, 201);
    const { record } = await create.json();
    assert.equal(record.status, 'planned');

    const ownRecords = await fetch(`${baseUrl}/api/growth/daily-actions`, {
      headers: { Authorization: `Bearer ${first.token}` },
    });
    assert.equal((await ownRecords.json()).records.length, 1);

    const privateRecords = await fetch(`${baseUrl}/api/growth/daily-actions`, {
      headers: { Authorization: `Bearer ${second.token}` },
    });
    assert.equal((await privateRecords.json()).records.length, 0);

    const otherUserUpdate = await fetch(
      `${baseUrl}/api/growth/daily-actions/${record.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${second.token}`,
        },
        body: JSON.stringify({ status: 'completed' }),
      },
    );
    assert.equal(otherUserUpdate.status, 404);

    const invalidApplication = await fetch(`${baseUrl}/api/growth/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${first.token}`,
      },
      body: JSON.stringify({
        company: 'Example Co',
        jobTitle: 'Engineer',
        status: 'applied',
      }),
    });
    assert.equal(invalidApplication.status, 400);

    const dashboard = await fetch(
      `${baseUrl}/api/growth/dashboard?date=2026-10-26`,
      { headers: { Authorization: `Bearer ${first.token}` } },
    );
    const summary = await dashboard.json();
    assert.equal(summary.plannedActions, 1);
    assert.equal(summary.completionPercent, 0);

    const assistant = await fetch(`${baseUrl}/api/growth/assistant/plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${first.token}`,
      },
      body: JSON.stringify({ date: '2026-10-26', availableMinutes: 90 }),
    });
    const plan = await assistant.json();
    assert.equal(assistant.status, 200);
    assert.equal(plan.mode, 'fallback');
    assert.equal(plan.requiresConfirmation, true);
    assert.equal(plan.facts.plannedActions, 1);
    assert.match(plan.summary, /0 completed of 1 planned actions/);

    const updated = await fetch(`${baseUrl}/api/growth/daily-actions/${record.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${first.token}`,
      },
      body: JSON.stringify({ status: 'completed' }),
    });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).record.title, 'Solve two DSA problems');

    const completedDashboard = await fetch(
      `${baseUrl}/api/growth/dashboard?date=2026-10-26`,
      { headers: { Authorization: `Bearer ${first.token}` } },
    );
    assert.equal((await completedDashboard.json()).completionPercent, 100);
    const analytics = await fetch(
      `${baseUrl}/api/growth/analytics?date=2026-10-26`,
      { headers: { Authorization: `Bearer ${first.token}` } },
    );
    const analyticsData = await analytics.json();
    assert.equal(analyticsData.daily.at(-1).completedActions, 1);
    assert.equal(analyticsData.daily.at(-1).completionPercent, 100);

    const exported = await fetch(`${baseUrl}/api/growth/export`, {
      headers: { Authorization: `Bearer ${first.token}` },
    });
    assert.equal((await exported.json()).data['daily-actions'].length, 1);

    const deleted = await fetch(`${baseUrl}/api/account`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${first.token}` },
    });
    assert.equal(deleted.status, 204);
    assert.equal(
      db.prepare('SELECT COUNT(*) AS count FROM growth_records WHERE user_id = ?').get(first.user.id).count,
      0,
    );
    const expired = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${first.token}` },
    });
    assert.equal(expired.status, 401);
  });
});

test('challenge calculations use date-only UTC boundaries', () => {
  assert.deepEqual(getChallengeState('2026-01-01', '2026-01-01'), {
    startDate: '2026-01-01',
    day: 1,
    elapsedDays: 0,
    daysRemaining: 90,
    phase: 1,
    completed: false,
    progressPercent: 0,
    milestones: [
      { day: 30, date: '2026-01-30', reached: false },
      { day: 60, date: '2026-03-01', reached: false },
      { day: 90, date: '2026-03-31', reached: false },
    ],
  });
  assert.equal(getChallengeState('2026-01-01', '2026-01-30').day, 30);
  assert.equal(getChallengeState('2026-01-01', '2026-01-31').phase, 2);
  assert.equal(getChallengeState('2026-01-01', '2026-03-30').daysRemaining, 2);
  assert.equal(getChallengeState('2026-01-01', '2026-03-31').completed, true);
  assert.equal(getChallengeState('2026-01-01', '2026-03-31').daysRemaining, 0);
  assert.equal(getChallengeState('2026-01-01', '2026-03-31').progressPercent, 100);
});

test('registration is closed without an invite when public signup is disabled', async () => {
  await withApp(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        email: 'person@example.com',
        password: 'correct-horse-42',
      }),
    });
    assert.equal(response.status, 403);
  }, globalThis.fetch, { ...testConfig, allowPublicSignup: false, signupInviteCode: '' });
});

test('Socket.IO rejects anonymous clients and broadcasts to authenticated workspace members', async () => {
  const db = new Database(':memory:');
  const { app } = createApp({ config: testConfig, db });
  const httpServer = createServer(app);
  const io = createSocketServer(httpServer, testConfig, db);
  httpServer.listen(0, '127.0.0.1');
  await once(httpServer, 'listening');
  const url = `http://127.0.0.1:${httpServer.address().port}`;
  let anonymous;
  let authenticated;

  try {
    const { body: session } = await register(url);
    anonymous = createSocketClient(url, { autoConnect: false, transports: ['websocket'] });
    const rejected = once(anonymous, 'connect_error');
    anonymous.connect();
    const [error] = await rejected;
    assert.match(error.message, /Authentication required/);

    authenticated = createSocketClient(url, {
      auth: { token: session.token },
      autoConnect: false,
      transports: ['websocket'],
    });
    const connected = once(authenticated, 'connect');
    authenticated.connect();
    await connected;

    const payload = { id: 'socket-lead', status: 'new' };
    const received = once(authenticated, 'lead:new');
    io.to('default').emit('lead:new', payload);
    assert.deepEqual((await received)[0], payload);
  } finally {
    anonymous?.disconnect();
    authenticated?.disconnect();
    await new Promise((resolve) => io.close(resolve));
    db.close();
  }
});

test('Meta webhook verifies, retrieves, persists, emits, and deduplicates a lead', async () => {
  let graphRequests = 0;
  const graphFetch = async (url) => {
    graphRequests += 1;
    assert.match(String(url), /graph\.facebook\.com\/v99\.0\/meta-lead-1/);
    assert.match(String(url), /access_token=test-page-access-token/);
    return new Response(
      JSON.stringify({
        id: 'meta-lead-1',
        created_time: '2026-10-25T08:00:00+0000',
        field_data: [
          { name: 'full_name', values: ['Actual Test Lead'] },
          { name: 'email', values: ['lead@example.com'] },
          { name: 'phone_number', values: ['+15550000000'] },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };

  await withApp(async ({ baseUrl, emitted }) => {
    const verify = new URL(`${baseUrl}/webhooks`);
    verify.searchParams.set('hub.mode', 'subscribe');
    verify.searchParams.set('hub.verify_token', 'test-verify-token');
    verify.searchParams.set('hub.challenge', 'challenge-123');
    const verified = await fetch(verify);
    assert.equal(verified.status, 200);
    assert.equal(await verified.text(), 'challenge-123');

    verify.searchParams.set('hub.verify_token', 'wrong-token');
    assert.equal((await fetch(verify)).status, 403);

    const { body: auth } = await register(baseUrl);
    const payload = JSON.stringify({
      object: 'page',
      entry: [
        {
          id: 'test-page-id',
          time: 1792953600,
          changes: [
            {
              field: 'leadgen',
              value: {
                leadgen_id: 'meta-lead-1',
                page_id: 'test-page-id',
                form_id: 'test-form-id',
                created_time: 1792915200,
              },
            },
          ],
        },
      ],
    });
    const signature = `sha256=${createHmac('sha256', 'test-meta-secret')
      .update(payload)
      .digest('hex')}`;
    const deliver = () =>
      fetch(`${baseUrl}/webhooks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': signature,
        },
        body: payload,
      });

    const rejected = await fetch(`${baseUrl}/webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': 'sha256=bad' },
      body: payload,
    });
    assert.equal(rejected.status, 401);

    assert.equal((await deliver()).status, 200);
    assert.equal((await deliver()).status, 200);
    assert.equal(graphRequests, 1);
    assert.equal(emitted.length, 1);
    assert.equal(emitted[0].room, 'default');
    assert.equal(emitted[0].event, 'lead:new');
    assert.equal(emitted[0].payload.name, 'Actual Test Lead');

    const leads = await fetch(`${baseUrl}/api/leads`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    const result = await leads.json();
    assert.equal(result.leads.length, 1);
    assert.equal(result.leads[0].email, 'lead@example.com');
    assert.equal(result.leads[0].phone, '+15550000000');
  }, graphFetch);
});

test('concurrent duplicate webhook deliveries are retried instead of acknowledged early', async () => {
  let graphRequests = 0;
  let announceStarted;
  let finishGraph;
  const started = new Promise((resolve) => {
    announceStarted = resolve;
  });
  const blocked = new Promise((resolve) => {
    finishGraph = resolve;
  });
  const graphFetch = async () => {
    graphRequests += 1;
    announceStarted();
    await blocked;
    return new Response(JSON.stringify({ id: 'concurrent-lead', field_data: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  await withApp(async ({ baseUrl }) => {
    const payload = JSON.stringify({
      object: 'page',
      entry: [
        {
          id: 'test-page-id',
          changes: [
            {
              field: 'leadgen',
              value: { leadgen_id: 'concurrent-lead', page_id: 'test-page-id' },
            },
          ],
        },
      ],
    });
    const signature = `sha256=${createHmac('sha256', 'test-meta-secret')
      .update(payload)
      .digest('hex')}`;
    const deliver = () =>
      fetch(`${baseUrl}/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature },
        body: payload,
      });

    const firstDelivery = deliver();
    await started;
    assert.equal((await deliver()).status, 503);
    finishGraph();
    assert.equal((await firstDelivery).status, 200);
    assert.equal((await deliver()).status, 200);
    assert.equal(graphRequests, 1);
  }, graphFetch);
});

test('webhook retries a previously failed Graph API retrieval', async () => {
  let graphRequests = 0;
  const flakyFetch = async () => {
    graphRequests += 1;
    if (graphRequests === 1) return new Response('{}', { status: 429 });
    return new Response(JSON.stringify({ id: 'retry-lead', field_data: [] }), { status: 200 });
  };
  await withApp(async ({ baseUrl }) => {
    const payload = JSON.stringify({
      object: 'page',
      entry: [
        {
          id: 'test-page-id',
          changes: [{ field: 'leadgen', value: { leadgen_id: 'retry-lead', page_id: 'test-page-id' } }],
        },
      ],
    });
    const signature = `sha256=${createHmac('sha256', 'test-meta-secret')
      .update(payload)
      .digest('hex')}`;
    const deliver = () =>
      fetch(`${baseUrl}/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature },
        body: payload,
      });
    assert.equal((await deliver()).status, 503);
    assert.equal((await deliver()).status, 200);
    assert.equal(graphRequests, 2);
  }, flakyFetch);
});
