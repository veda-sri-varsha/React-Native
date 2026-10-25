import { randomUUID } from 'node:crypto';
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
});
const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
});
const createLeadSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.union([emailSchema, z.literal('')]).optional(),
  phone: z.string().trim().max(40).optional(),
  submittedAt: z.iso.datetime().optional(),
}).strict().refine((lead) => Boolean(lead.email || lead.phone), {
  message: 'Provide an email address or phone number.',
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
    allowedOrigins,
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

export function createApp({
  config,
  db: injectedDb,
  io,
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

  app.use(express.json({ limit: '32kb' }));

  app.post('/api/auth/register', authenticationLimit, async (req, res, next) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Enter a name, valid email, and a password of at least 8 characters.' });
    }
    const { name, password } = parsed.data;
    const email = parsed.data.email.toLowerCase();

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

  app.post('/api/leads', auth, (req, res, next) => {
    const parsed = createLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Lead details are invalid.' });
    }
    try {
      const leadId = randomUUID();
      const receivedAt = new Date().toISOString();
      const { name, email, phone, submittedAt } = parsed.data;
      const insertLead = db.transaction(() => {
        db.prepare(`
          INSERT INTO leads (
            id, workspace_id, page_id, name, email, phone, submitted_at, received_at, status
          ) VALUES (?, ?, 'manual', ?, ?, ?, ?, ?, 'new')
        `).run(
          leadId,
          req.user.workspace_id,
          name,
          email || null,
          phone || null,
          submittedAt ?? receivedAt,
          receivedAt,
        );
        db.prepare(`
          INSERT INTO activities (workspace_id, lead_id, description, created_at)
          VALUES (?, ?, 'Lead added manually', ?)
        `).run(req.user.workspace_id, leadId, receivedAt);
      });
      insertLead();

      const lead = leadFromRow(
        db.prepare('SELECT * FROM leads WHERE workspace_id = ? AND id = ?')
          .get(req.user.workspace_id, leadId),
      );
      const socketServer = io ?? app.get('io');
      socketServer?.to(req.user.workspace_id).emit('lead:new', lead);
      return res.status(201).json({ lead });
    } catch (error) {
      return next(error);
    }
  });

  mountGrowthRoutes(app, { auth, db, config });

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
