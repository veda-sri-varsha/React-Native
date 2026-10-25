import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import bcrypt from 'bcryptjs';
import cors from 'cors';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import { Server as SocketServer } from 'socket.io';
import { z } from 'zod';

import { mountGrowthRoutes } from './growth.js';

const directory = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(directory, '.env') });

const emailSchema = z.string().trim().email().max(254);
const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: emailSchema,
  password: z.string().min(8).max(72),
  inviteCode: z.string().max(200).optional(),
});
const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
});

export function loadConfig(env = process.env) {
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be set to a random value of at least 32 characters.');
  }

  const allowedOrigins = (
    env.ALLOWED_ORIGINS ??
    'http://localhost:8081,http://127.0.0.1:8081,http://localhost:8082,http://127.0.0.1:8082'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    port: Number(env.PORT ?? 3000),
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: '1h',
    databasePath: resolve(directory, env.DATABASE_PATH ?? './data/leads.sqlite'),
    workspaceId: env.WORKSPACE_ID ?? 'default',
    allowPublicSignup: env.ALLOW_PUBLIC_SIGNUP === 'true',
    signupInviteCode: env.SIGNUP_INVITE_CODE ?? '',
    allowedOrigins,
    webhookVerifyToken: env.META_WEBHOOK_VERIFY_TOKEN ?? '',
    appSecret: env.META_APP_SECRET ?? '',
    pageAccessToken: env.META_PAGE_ACCESS_TOKEN ?? '',
    pageId: env.META_PAGE_ID ?? '',
    graphApiVersion: env.META_GRAPH_API_VERSION ?? '',
    aiApiKey: env.AI_API_KEY ?? '',
    aiEndpoint: env.AI_API_ENDPOINT ?? '',
    aiModel: env.AI_MODEL ?? '',
  };
}

function initializeDatabase(db) {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (workspace_id, email)
    );

    CREATE TABLE IF NOT EXISTS leads (
      id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      page_id TEXT NOT NULL,
      name TEXT,
      email TEXT,
      phone TEXT,
      submitted_at TEXT,
      received_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      PRIMARY KEY (workspace_id, id)
    );
    CREATE INDEX IF NOT EXISTS leads_received_at_idx
      ON leads (workspace_id, received_at DESC);

    CREATE TABLE IF NOT EXISTS webhook_events (
      page_id TEXT NOT NULL,
      lead_id TEXT NOT NULL,
      state TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (page_id, lead_id)
    );

    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id TEXT NOT NULL,
      lead_id TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS activities_created_at_idx
      ON activities (workspace_id, created_at DESC);
  `);
}

function createDatabase(databasePath) {
  mkdirSync(dirname(databasePath), { recursive: true });
  const db = new Database(databasePath);
  initializeDatabase(db);
  return db;
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email };
}

function signToken(user, config) {
  return jwt.sign(
    { sub: user.id, workspaceId: user.workspace_id },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
  );
}

function constantTimeEquals(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function leadFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    submittedAt: row.submitted_at,
    receivedAt: row.received_at,
    status: row.status,
  };
}

function valueFromFields(fields, names) {
  const field = fields.find((item) => names.includes(item.name.toLowerCase()));
  if (!field || !Array.isArray(field.values)) return null;
  return field.values.find((value) => typeof value === 'string' && value.trim())?.trim() ?? null;
}

function isoDate(value) {
  if (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) {
    const milliseconds = Number(value) * 1000;
    return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : null;
  }
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function graphLeadFields(graphLead) {
  const fields = Array.isArray(graphLead.field_data)
    ? graphLead.field_data.filter(
        (field) =>
          field &&
          typeof field.name === 'string' &&
          Array.isArray(field.values),
      )
    : [];
  const firstName = valueFromFields(fields, ['first_name', 'firstname']);
  const lastName = valueFromFields(fields, ['last_name', 'lastname']);
  const fullName =
    valueFromFields(fields, ['full_name', 'fullname', 'name']) ??
    [firstName, lastName].filter(Boolean).join(' ') ??
    null;

  return {
    name: fullName,
    email: valueFromFields(fields, ['email', 'email_address']),
    phone: valueFromFields(fields, ['phone_number', 'phone', 'mobile_phone']),
    submittedAt: isoDate(graphLead.created_time),
  };
}

function verifyWebhookSignature(req, appSecret) {
  const signature = req.get('x-hub-signature-256') ?? '';
  if (!signature.startsWith('sha256=')) return false;
  const expected = `sha256=${createHmac('sha256', appSecret).update(req.body).digest('hex')}`;
  return constantTimeEquals(signature, expected);
}

function authorize(config, db) {
  return (req, res, next) => {
    const header = req.get('authorization') ?? '';
    const match = /^Bearer (.+)$/.exec(header);
    if (!match) return res.status(401).json({ error: 'Authentication required.' });

    let payload;
    try {
      payload = jwt.verify(match[1], config.jwtSecret);
    } catch {
      return res.status(401).json({ error: 'Your session is invalid or has expired.' });
    }
    if (
      typeof payload !== 'object' ||
      typeof payload.sub !== 'string' ||
      typeof payload.workspaceId !== 'string'
    ) {
      return res.status(401).json({ error: 'Your session is invalid or has expired.' });
    }
    try {
      const user = db
        .prepare('SELECT id, workspace_id, name, email FROM users WHERE id = ?')
        .get(payload.sub);
      if (!user || user.workspace_id !== payload.workspaceId) {
        return res.status(401).json({ error: 'Your session is invalid or has expired.' });
      }
      req.user = user;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

async function retrieveMetaLead(config, leadId, fetchImpl) {
  if (!config.pageAccessToken || !config.graphApiVersion) {
    const error = new Error('Meta lead retrieval is not configured.');
    error.status = 503;
    throw error;
  }

  const url = new URL(`https://graph.facebook.com/${config.graphApiVersion}/${encodeURIComponent(leadId)}`);
  url.searchParams.set(
    'fields',
    'id,created_time,field_data,form_id,ad_id,ad_name,campaign_id,campaign_name',
  );
  url.searchParams.set('access_token', config.pageAccessToken);
  let response;
  try {
    response = await fetchImpl(url, { signal: AbortSignal.timeout(10_000) });
  } catch {
    const error = new Error('Meta Graph API could not be reached.');
    error.status = 502;
    throw error;
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || !body || body.id !== leadId) {
    const error = new Error('Meta Graph API could not retrieve this lead.');
    error.status = response.status === 429 ? 503 : 502;
    throw error;
  }
  return { id: body.id, ...graphLeadFields(body) };
}

function normalizeLeadChange(change) {
  const value = change?.value;
  if (!value || typeof value !== 'object') return null;
  const leadId = value.leadgen_id ?? value.id;
  const pageId = value.page_id;
  if (typeof leadId !== 'string' || typeof pageId !== 'string') return null;
  return { leadId, pageId };
}

export function createApp({
  config,
  db: injectedDb,
  io,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!config) throw new Error('Server configuration is required.');
  const db = injectedDb ?? createDatabase(config.databasePath);
  if (injectedDb) initializeDatabase(db);
  const app = express();
  const auth = authorize(config, db);
  const authenticationLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Origin is not allowed.'));
      },
    }),
  );

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.get('/webhooks', (req, res) => {
    const mode = req.query['hub.mode'];
    const verifyToken = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (
      mode === 'subscribe' &&
      typeof verifyToken === 'string' &&
      config.webhookVerifyToken &&
      constantTimeEquals(verifyToken, config.webhookVerifyToken) &&
      typeof challenge === 'string'
    ) {
      return res.status(200).type('text/plain').send(challenge);
    }
    return res.sendStatus(403);
  });

  app.post(
    '/webhooks',
    express.raw({ type: 'application/json', limit: '1mb' }),
    async (req, res, next) => {
      if (!config.appSecret) {
        return res.status(503).json({ error: 'Meta webhook signature verification is not configured.' });
      }
      if (!Buffer.isBuffer(req.body) || !verifyWebhookSignature(req, config.appSecret)) {
        return res.status(401).json({ error: 'Invalid webhook signature.' });
      }

      let notification;
      try {
        notification = JSON.parse(req.body.toString('utf8'));
      } catch {
        return res.status(400).json({ error: 'Webhook body must contain valid JSON.' });
      }
      if (
        !notification ||
        notification.object !== 'page' ||
        !Array.isArray(notification.entry)
      ) {
        return res.status(400).json({ error: 'Webhook notification has an invalid format.' });
      }

      const leadChanges = [];
      for (const entry of notification.entry) {
        if (!entry || typeof entry.id !== 'string' || !Array.isArray(entry.changes)) continue;
        for (const change of entry.changes) {
          if (change?.field !== 'leadgen') continue;
          const lead = normalizeLeadChange(change);
          if (!lead || (change.value.page_id && change.value.page_id !== entry.id)) {
            return res.status(400).json({ error: 'Lead notification is missing a valid page or lead ID.' });
          }
          leadChanges.push({ ...lead, pageId: entry.id });
        }
      }

      if (leadChanges.length > 25) {
        return res.status(413).json({ error: 'Too many lead notifications in one delivery.' });
      }

      try {
        for (const lead of leadChanges) {
          if (config.pageId && lead.pageId !== config.pageId) {
            return res.status(403).json({ error: 'Webhook notification is for an unconfigured Page.' });
          }

          const current = db
            .prepare('SELECT state, updated_at FROM webhook_events WHERE page_id = ? AND lead_id = ?')
            .get(lead.pageId, lead.leadId);
          const staleBefore = Date.now() - 2 * 60 * 1000;
          if (current?.state === 'complete') continue;
          if (
            current?.state === 'processing' &&
            new Date(current.updated_at).getTime() > staleBefore
          ) {
            return res.status(503).json({ error: 'Lead notification is still being processed. Retry later.' });
          }

          db.prepare(`
            INSERT INTO webhook_events (page_id, lead_id, state, updated_at)
            VALUES (?, ?, 'processing', ?)
            ON CONFLICT (page_id, lead_id) DO UPDATE SET
              state = 'processing',
              updated_at = excluded.updated_at
          `).run(lead.pageId, lead.leadId, new Date().toISOString());

          try {
            if (!config.pageId) {
              const error = new Error('Meta Page configuration is missing.');
              error.status = 503;
              throw error;
            }
            const details = await retrieveMetaLead(config, lead.leadId, fetchImpl);
            const receivedAt = new Date().toISOString();
            const existing = db
              .prepare('SELECT id FROM leads WHERE workspace_id = ? AND id = ?')
              .get(config.workspaceId, details.id);

            const persistLead = db.transaction(() => {
              db.prepare(`
                INSERT INTO leads (
                  id, workspace_id, page_id, name, email, phone, submitted_at, received_at, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new')
                ON CONFLICT (workspace_id, id) DO UPDATE SET
                  page_id = excluded.page_id,
                  name = excluded.name,
                  email = excluded.email,
                  phone = excluded.phone,
                  submitted_at = excluded.submitted_at
              `).run(
                details.id,
                config.workspaceId,
                lead.pageId,
                details.name,
                details.email,
                details.phone,
                details.submittedAt,
                receivedAt,
              );
              if (!existing) {
                db.prepare(`
                  INSERT INTO activities (workspace_id, lead_id, description, created_at)
                  VALUES (?, ?, 'New lead received', ?)
                `).run(config.workspaceId, details.id, receivedAt);
              }
              db.prepare(`
                UPDATE webhook_events SET state = 'complete', updated_at = ?
                WHERE page_id = ? AND lead_id = ?
              `).run(receivedAt, lead.pageId, lead.leadId);
            });
            persistLead();

            const socketServer = io ?? app.get('io');
            if (!existing && socketServer) {
              const row = db
                .prepare('SELECT * FROM leads WHERE workspace_id = ? AND id = ?')
                .get(config.workspaceId, details.id);
              socketServer.to(config.workspaceId).emit('lead:new', leadFromRow(row));
            }
          } catch (error) {
            db.prepare(`
              UPDATE webhook_events SET state = 'failed', updated_at = ?
              WHERE page_id = ? AND lead_id = ?
            `).run(new Date().toISOString(), lead.pageId, lead.leadId);
            throw error;
          }
        }
        return res.sendStatus(200);
      } catch (error) {
        return next(error);
      }
    },
  );

  app.use(express.json({ limit: '32kb' }));

  app.post('/api/auth/register', authenticationLimit, async (req, res, next) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Enter a name, valid email, and a password of at least 8 characters.' });
    }
    const { name, password } = parsed.data;
    const email = parsed.data.email.toLowerCase();

    if (
      !config.allowPublicSignup &&
      (!config.signupInviteCode ||
        !parsed.data.inviteCode ||
        !constantTimeEquals(config.signupInviteCode, parsed.data.inviteCode))
    ) {
      return res.status(403).json({ error: 'A valid workspace invite code is required to create an account.' });
    }

    try {
      const id = cryptoRandomId();
      const passwordHash = await bcrypt.hash(password, 12);
      db.prepare(`
        INSERT INTO users (id, workspace_id, name, email, password_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, config.workspaceId, name, email, passwordHash, new Date().toISOString());
      const user = { id, workspace_id: config.workspaceId, name, email };
      return res.status(201).json({ token: signToken(user, config), user: publicUser(user) });
    } catch (error) {
      if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({ error: 'An account with this email already exists.' });
      }
      return next(error);
    }
  });

  app.post('/api/auth/login', authenticationLimit, async (req, res, next) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email and password.' });

    try {
      const user = db
        .prepare(`
          SELECT id, workspace_id, name, email, password_hash
          FROM users WHERE workspace_id = ? AND email = ?
        `)
        .get(config.workspaceId, parsed.data.email.toLowerCase());
      if (!user || !(await bcrypt.compare(parsed.data.password, user.password_hash))) {
        return res.status(401).json({ error: 'Email or password is incorrect.' });
      }
      return res.json({ token: signToken(user, config), user: publicUser(user) });
    } catch (error) {
      return next(error);
    }
  });

  app.get('/api/auth/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));

  app.get('/api/dashboard', auth, (req, res) => {
    const since = typeof req.query.since === 'string' ? new Date(req.query.since) : null;
    if (since && Number.isNaN(since.getTime())) {
      return res.status(400).json({ error: 'The dashboard date is invalid.' });
    }
    const total = db
      .prepare('SELECT COUNT(*) AS count FROM leads WHERE workspace_id = ?')
      .get(req.user.workspace_id).count;
    const newToday = since
      ? db.prepare(`
          SELECT COUNT(*) AS count FROM leads
          WHERE workspace_id = ? AND received_at >= ?
        `).get(req.user.workspace_id, since.toISOString()).count
      : 0;
    const recentLeads = db
      .prepare('SELECT * FROM leads WHERE workspace_id = ? ORDER BY received_at DESC LIMIT 5')
      .all(req.user.workspace_id)
      .map(leadFromRow);
    const recentActivity = db
      .prepare(`
        SELECT id, lead_id AS leadId, description, created_at AS createdAt
        FROM activities WHERE workspace_id = ?
        ORDER BY created_at DESC LIMIT 5
      `)
      .all(req.user.workspace_id);
    return res.json({ totalLeads: total, newToday, recentLeads, recentActivity });
  });

  app.get('/api/leads', auth, (req, res) => {
    const limit = Number(req.query.limit ?? 100);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      return res.status(400).json({ error: 'Limit must be a number between 1 and 200.' });
    }
    const leads = db
      .prepare('SELECT * FROM leads WHERE workspace_id = ? ORDER BY received_at DESC LIMIT ?')
      .all(req.user.workspace_id, limit)
      .map(leadFromRow);
    return res.json({ leads });
  });

  mountGrowthRoutes(app, { auth, db, config, fetchImpl });

  app.use((error, _req, res, _next) => {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    if (status >= 500) console.error('Request failed:', error?.message ?? 'Unknown server error');
    return res.status(status).json({
      error: status >= 500 ? 'The request could not be completed.' : error.message,
    });
  });

  return { app, db };
}

function cryptoRandomId() {
  return randomUUID();
}

export function createSocketServer(httpServer, config, db) {
  const io = new SocketServer(httpServer, {
    cors: { origin: config.allowedOrigins },
  });
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string') return next(new Error('Authentication required.'));
    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret);
    } catch {
      return next(new Error('Session is invalid or has expired.'));
    }
    if (
      typeof payload !== 'object' ||
      typeof payload.sub !== 'string' ||
      typeof payload.workspaceId !== 'string'
    ) {
      return next(new Error('Session is invalid or has expired.'));
    }
    try {
      const user = db
        .prepare('SELECT id, workspace_id FROM users WHERE id = ?')
        .get(payload.sub);
      if (!user || user.workspace_id !== payload.workspaceId) {
        return next(new Error('Session is invalid or has expired.'));
      }
      socket.data.workspaceId = user.workspace_id;
      return next();
    } catch (error) {
      return next(error);
    }
  });
  io.on('connection', (socket) => {
    socket.join(socket.data.workspaceId);
  });
  return io;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const config = loadConfig();
    const { app, db } = createApp({ config });
    const httpServer = app.listen(config.port, '0.0.0.0', () => {
      console.log(`Lead management API listening on port ${config.port}`);
    });
    const io = createSocketServer(httpServer, config, db);
    app.set('io', io);

    const shutdown = () => {
      io.close(() => {
        db.close();
        process.exit(0);
      });
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
