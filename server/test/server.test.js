import assert from 'node:assert/strict';
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
});

async function withApp(run, config = testConfig) {
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
  const { app } = createApp({ config, db, io });
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

    const otherUserUpdate = await fetch(`${baseUrl}/api/growth/daily-actions/${record.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${second.token}`,
      },
      body: JSON.stringify({ status: 'completed' }),
    });
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

    const dashboard = await fetch(`${baseUrl}/api/growth/dashboard?date=2026-10-26`, {
      headers: { Authorization: `Bearer ${first.token}` },
    });
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

    const completedDashboard = await fetch(`${baseUrl}/api/growth/dashboard?date=2026-10-26`, {
      headers: { Authorization: `Bearer ${first.token}` },
    });
    assert.equal((await completedDashboard.json()).completionPercent, 100);
    const analytics = await fetch(`${baseUrl}/api/growth/analytics?date=2026-10-26`, {
      headers: { Authorization: `Bearer ${first.token}` },
    });
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

test('registration works without an invite code', async () => {
  await withApp(async ({ baseUrl }) => {
    const { response, body } = await register(baseUrl);
    assert.equal(response.status, 201);
    assert.equal(body.user.email, 'person@example.com');
    assert.equal(typeof body.token, 'string');
  });
});

test('manual lead creation validates details, emits a live update, and stays authenticated', async () => {
  await withApp(async ({ baseUrl, emitted, db }) => {
    assert.equal((await fetch(`${baseUrl}/api/leads`, { method: 'POST' })).status, 401);

    const { body: auth } = await register(baseUrl);
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth.token}`,
    };
    const invalid = await fetch(`${baseUrl}/api/leads`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'No Contact Details' }),
    });
    assert.equal(invalid.status, 400);

    const created = await fetch(`${baseUrl}/api/leads`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Manual Test Lead',
        email: 'manual@example.com',
        phone: '+15550000000',
      }),
    });
    assert.equal(created.status, 201);
    const { lead } = await created.json();
    assert.equal(lead.name, 'Manual Test Lead');
    assert.equal(lead.email, 'manual@example.com');
    assert.equal(lead.phone, '+15550000000');
    assert.equal(lead.status, 'new');
    assert.equal(lead.submittedAt, lead.receivedAt);
    assert.equal(emitted.length, 1);
    assert.equal(emitted[0].event, 'lead:new');
    assert.equal(emitted[0].payload.id, lead.id);
    assert.equal(emitted[0].room, 'default');

    const listed = await fetch(`${baseUrl}/api/leads`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    assert.deepEqual((await listed.json()).leads, [lead]);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM activities').get().count, 1);
  });
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
