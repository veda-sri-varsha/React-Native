import { randomUUID } from 'node:crypto';
import { z } from 'zod';

const shortText = (max = 200) => z.string().trim().min(1).max(max);
const optionalText = (max = 2000) => z.string().trim().max(max).optional();
const date = z.iso.date();
const optionalDate = date.optional();
const url = z
  .url()
  .max(2048)
  .refine((value) => value.startsWith('https://') || value.startsWith('http://'), {
    message: 'URL must use HTTP or HTTPS.',
  });
const optionalUrl = url.optional();
const duration = z.number().int().min(0).max(1440);
const status = (values) => z.enum(values);

const recordSchemas = {
  'daily-actions': z.object({
    title: shortText(160),
    description: optionalText(1000),
    category: status(['dsa', 'cybersecurity', 'project', 'career', 'exercise', 'principle', 'other']),
    date,
    priority: z.number().int().min(1).max(3).default(2),
    status: status(['planned', 'attempted', 'completed', 'partial', 'not_completed']).default('planned'),
    durationMinutes: duration.optional(),
    reflection: optionalText(1000),
    completedAt: optionalDate,
  }).strict(),
  'dsa-problems': z.object({
    title: shortText(200),
    topic: shortText(100),
    source: optionalText(120),
    sourceUrl: optionalUrl,
    difficulty: status(['unknown', 'easy', 'medium', 'hard']).default('unknown'),
    sheetPosition: z.number().int().positive().optional(),
    status: status(['not_started', 'attempted', 'solved_independently', 'solved_with_hints', 'solution_reviewed', 'needs_revision', 'mastered']).default('not_started'),
    revisionDate: optionalDate,
    approach: optionalText(4000),
    timeComplexity: optionalText(100),
    spaceComplexity: optionalText(100),
    mistakes: optionalText(2000),
  }).strict(),
  'dsa-attempts': z.object({
    problemId: shortText(100),
    attemptedAt: z.iso.datetime().default(() => new Date().toISOString()),
    outcome: status(['independent', 'hints', 'solution_reviewed', 'revisit']),
    durationMinutes: duration.optional(),
    approach: optionalText(4000),
    timeComplexity: optionalText(100),
    spaceComplexity: optionalText(100),
    mistakes: optionalText(2000),
    revisionDate: optionalDate,
  }).strict(),
  'mock-tests': z.object({
    date,
    source: shortText(200),
    sourceUrl: optionalUrl,
    questionCount: z.number().int().min(1).max(500),
    solved: z.number().int().min(0).max(500),
    accuracy: z.number().min(0).max(100).optional(),
    durationMinutes: duration.optional(),
    difficultTopics: optionalText(1000),
    mistakes: optionalText(2000),
    lessons: optionalText(2000),
    followUp: optionalText(1000),
  }).strict().refine((value) => value.solved <= value.questionCount, {
    message: 'Solved questions cannot exceed total questions.',
  }),
  learning: z.object({
    title: shortText(200),
    topic: shortText(120),
    resource: optionalText(200),
    resourceUrl: optionalUrl,
    startDate: optionalDate,
    completionDate: optionalDate,
    plannedMinutes: duration.optional(),
    actualMinutes: duration.optional(),
    notes: optionalText(4000),
    keyConcepts: optionalText(2000),
    nextRevisionDate: optionalDate,
  }).strict(),
  labs: z.object({
    title: shortText(200),
    platform: shortText(160),
    authorizedEnvironment: z.literal(true),
    completed: z.boolean().default(false),
    date,
    durationMinutes: duration.optional(),
    notes: optionalText(3000),
    nextRevisionDate: optionalDate,
  }).strict(),
  projects: z.object({
    name: shortText(200),
    problem: optionalText(2000),
    technologies: optionalText(500),
    repositoryUrl: optionalUrl,
    startDate: optionalDate,
    targetDate: optionalDate,
    stage: status(['idea', 'planning', 'development', 'testing', 'deployment', 'documentation', 'completed']).default('idea'),
    deploymentUrl: optionalUrl,
    acceptanceCriteria: optionalText(2000),
    testsCompleted: z.boolean().default(false),
    documentationComplete: z.boolean().default(false),
    demoComplete: z.boolean().default(false),
    lessons: optionalText(2000),
  }).strict(),
  milestones: z.object({
    projectId: shortText(100),
    title: shortText(200),
    dueDate: optionalDate,
    acceptanceCriteria: optionalText(1000),
    status: status(['planned', 'in_progress', 'completed', 'missed']).default('planned'),
    completedAt: optionalDate,
    mvpComplete: z.boolean().default(false),
    polished: z.boolean().default(false),
  }).strict(),
  applications: z.object({
    company: shortText(200),
    jobTitle: shortText(200),
    jobUrl: optionalUrl,
    platform: optionalText(120),
    appliedDate: optionalDate,
    deadline: optionalDate,
    status: status(['saved', 'ready_to_apply', 'applied', 'assessment', 'interview', 'offer', 'rejected', 'withdrawn', 'no_response']).default('saved'),
    recruiter: optionalText(200),
    followUpDate: optionalDate,
    assessmentDate: optionalDate,
    interviewRounds: z.number().int().min(0).max(50).optional(),
    outcome: optionalText(500),
    notes: optionalText(3000),
    nextAction: optionalText(500),
  }).strict().refine((value) => value.status === 'saved' || value.status === 'ready_to_apply' || Boolean(value.appliedDate), {
    message: 'Record the actual application date before setting an application as submitted.',
  }),
  'principle-actions': z.object({
    principle: z.number().int().min(1).max(7),
    action: shortText(300),
    date,
    status: status(['planned', 'completed', 'partial', 'not_completed']).default('planned'),
    evidenceUrl: optionalUrl,
    notes: optionalText(2000),
    reflection: optionalText(1000),
  }).strict(),
  exercise: z.object({
    activity: shortText(120),
    date,
    durationMinutes: duration,
    status: status(['completed', 'partial', 'rest_day', 'not_completed']),
    notes: optionalText(1000),
  }).strict(),
  reflections: z.object({
    date,
    accountability: status(['completed', 'partial', 'not_completed']),
    wentWell: optionalText(1000),
    blockedProgress: optionalText(1000),
    changeTomorrow: optionalText(1000),
  }).strict(),
  challenges: z.object({
    startDate: date,
    lengthDays: z.literal(90).default(90),
  }).strict(),
  'weekly-reviews': z.object({
    weekOf: date,
    wins: optionalText(2000),
    obstacles: optionalText(2000),
    dsaReview: optionalText(1000),
    learningReview: optionalText(1000),
    projectsReview: optionalText(1000),
    careerReview: optionalText(1000),
    nextWeek: optionalText(2000),
  }).strict(),
  settings: z.object({
    weeklyReviewDay: status(['friday', 'sunday']),
    dailyStudyMinutes: z.number().int().min(15).max(960),
    cybersecurityTargetMinutes: z.number().int().min(0).max(480),
    exerciseTargetDays: z.number().int().min(0).max(7),
    theme: status(['dark', 'light']),
  }).strict(),
};

export const growthCollections = Object.keys(recordSchemas);

function parseRecord(collection, input, partial = false) {
  const schema = recordSchemas[collection];
  if (!schema) return null;
  return (partial ? schema.partial() : schema).safeParse(input);
}

function recordsFor(db, userId, collection) {
  return db
    .prepare(`
      SELECT id, payload, created_at AS createdAt, updated_at AS updatedAt
      FROM growth_records
      WHERE user_id = ? AND collection = ?
      ORDER BY updated_at DESC
    `)
    .all(userId, collection)
    .map((row) => ({
      id: row.id,
      ...JSON.parse(row.payload),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
}

function dateDifference(start, end) {
  const startTime = Date.parse(`${start}T00:00:00.000Z`);
  const endTime = Date.parse(`${end}T00:00:00.000Z`);
  return Math.floor((endTime - startTime) / 86_400_000);
}

export function getChallengeState(startDate, today) {
  if (!startDate) return null;
  const elapsed = dateDifference(startDate, today);
  const day = elapsed + 1;
  const phase = day <= 30 ? 1 : day <= 60 ? 2 : day <= 90 ? 3 : 3;
  return {
    startDate,
    day: Math.max(1, Math.min(day, 90)),
    elapsedDays: Math.max(0, elapsed),
    daysRemaining: elapsed >= 89 ? 0 : Math.max(0, 90 - Math.max(0, elapsed)),
    phase,
    completed: elapsed >= 89,
    progressPercent: elapsed >= 89 ? 100 : Math.round((Math.max(0, Math.min(elapsed, 89)) / 89) * 100),
    milestones: [30, 60, 90].map((milestoneDay) => ({
      day: milestoneDay,
      date: new Date(Date.parse(`${startDate}T00:00:00.000Z`) + (milestoneDay - 1) * 86_400_000)
        .toISOString()
        .slice(0, 10),
      reached: elapsed + 1 >= milestoneDay,
    })),
  };
}

function getDashboard(db, userId, today) {
  const all = Object.fromEntries(
    growthCollections.map((collection) => [collection, recordsFor(db, userId, collection)]),
  );
  const todaysActions = all['daily-actions'].filter((item) => item.date === today);
  const completed = todaysActions.filter((item) => item.status === 'completed').length;
  const partial = todaysActions.filter((item) => item.status === 'partial').length;
  const planned = todaysActions.length;
  const problems = all['dsa-problems'];
  const attempts = all['dsa-attempts'];
  const dueRevisions = problems.filter(
    (problem) => problem.revisionDate && problem.revisionDate <= today && problem.status !== 'mastered',
  );
  const exerciseToday = all.exercise.filter((entry) => entry.date === today);
  const reflection = all.reflections.find((entry) => entry.date === today) ?? null;
  const challengeRecord = all.challenges[0] ?? null;
  const challenge = getChallengeState(challengeRecord?.startDate, today);
  const startOfWeek = new Date(`${today}T00:00:00.000Z`);
  const weekday = (startOfWeek.getUTCDay() + 6) % 7;
  startOfWeek.setUTCDate(startOfWeek.getUTCDate() - weekday);
  const weekStart = startOfWeek.toISOString().slice(0, 10);
  const weeklyCompletedActions = all['daily-actions'].filter(
    (action) => action.date >= weekStart && action.date <= today && action.status === 'completed',
  ).length;

  return {
    date: today,
    challenge,
    completionPercent: planned === 0 ? null : Math.round(((completed + partial * 0.5) / planned) * 100),
    plannedActions: planned,
    attemptedActions: todaysActions.filter((item) => ['attempted', 'partial', 'completed'].includes(item.status)).length,
    completedActions: completed,
    partialActions: partial,
    dsa: {
      problemsTracked: problems.length,
      attemptsToday: attempts.filter((attempt) => attempt.attemptedAt?.slice(0, 10) === today).length,
      independentToday: attempts.filter(
        (attempt) => attempt.attemptedAt?.slice(0, 10) === today && attempt.outcome === 'independent',
      ).length,
      revisionBacklog: dueRevisions.length,
    },
    exerciseMinutes: exerciseToday.reduce((sum, item) => sum + (item.status === 'rest_day' ? 0 : item.durationMinutes), 0),
    accountability: reflection?.accountability ?? null,
    currentStreak: calculateStreak(all['daily-actions'], today),
    weeklyCompletedActions,
    upcomingDeadlines: [
      ...all.applications
        .filter((application) => application.deadline && application.deadline >= today && application.status !== 'rejected')
        .map((application) => ({ id: application.id, title: `${application.company}: ${application.jobTitle}`, date: application.deadline, kind: 'application' })),
      ...all.projects
        .filter((project) => project.targetDate && project.targetDate >= today && project.stage !== 'completed')
        .map((project) => ({ id: project.id, title: project.name, date: project.targetDate, kind: 'project' })),
    ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5),
    recentActions: all['daily-actions'].slice(0, 5),
    totals: {
      problemsAttempted: attempts.length,
      independentlySolved: attempts.filter((attempt) => attempt.outcome === 'independent').length,
      assisted: attempts.filter((attempt) => attempt.outcome === 'hints' || attempt.outcome === 'solution_reviewed').length,
      labsCompleted: all.labs.filter((lab) => lab.completed).length,
      projectsCompleted: all.projects.filter((project) => project.stage === 'completed').length,
      applicationsSubmitted: all.applications.filter((application) => Boolean(application.appliedDate)).length,
      exerciseSessions: all.exercise.filter((entry) => entry.status === 'completed').length,
    },
  };
}

function calculateStreak(actions, today) {
  const completedDates = new Set(
    actions.filter((action) => action.status === 'completed').map((action) => action.date),
  );
  let cursor = completedDates.has(today) ? today : shiftDate(today, -1);
  let streak = 0;
  while (completedDates.has(cursor)) {
    streak += 1;
    cursor = shiftDate(cursor, -1);
  }
  return streak;
}

function shiftDate(date, days) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function analytics(db, userId, today) {
  const all = Object.fromEntries(
    growthCollections.map((collection) => [collection, recordsFor(db, userId, collection)]),
  );
  const days = Array.from({ length: 30 }, (_, index) => shiftDate(today, index - 29));
  const daily = days.map((day) => {
    const actions = all['daily-actions'].filter((item) => item.date === day);
    const attempts = all['dsa-attempts'].filter((item) => item.attemptedAt?.slice(0, 10) === day);
    const planned = actions.length;
    const completed = actions.filter((item) => item.status === 'completed').length;
    return {
      date: day,
      plannedActions: planned,
      completedActions: completed,
      completionPercent: planned ? Math.round((completed / planned) * 100) : null,
      dsaAttempts: attempts.length,
      dsaIndependent: attempts.filter((item) => item.outcome === 'independent').length,
      exerciseMinutes: all.exercise
        .filter((item) => item.date === day && item.status !== 'rest_day')
        .reduce((sum, item) => sum + item.durationMinutes, 0),
      applications: all.applications.filter((item) => item.appliedDate === day).length,
    };
  });
  const topics = new Map();
  for (const problem of all['dsa-problems']) {
    const count = topics.get(problem.topic) ?? { topic: problem.topic, tracked: 0, mastered: 0 };
    count.tracked += 1;
    if (problem.status === 'mastered') count.mastered += 1;
    topics.set(problem.topic, count);
  }
  const challenge = getChallengeState(all.challenges[0]?.startDate, today);

  return {
    period: { from: days[0], to: today },
    daily,
    dsaTopics: [...topics.values()],
    mockTests: all['mock-tests']
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((item) => ({
        id: item.id,
        date: item.date,
        score: item.accuracy ?? Math.round((item.solved / item.questionCount) * 100),
        source: item.source,
      })),
    learningMinutes: all.learning.reduce((sum, item) => sum + (item.actualMinutes ?? 0), 0),
    labCount: all.labs.filter((item) => item.completed).length,
    projectMilestones: all.milestones.map((item) => ({
      id: item.id,
      title: item.title,
      status: item.status,
      dueDate: item.dueDate ?? null,
    })),
    applicationStatuses: Object.entries(
      all.applications.reduce((counts, item) => {
        counts[item.status] = (counts[item.status] ?? 0) + 1;
        return counts;
      }, {}),
    ).map(([status, count]) => ({ status, count })),
    principleActions: Array.from({ length: 7 }, (_, index) => ({
      principle: index + 1,
      completed: all['principle-actions'].filter((item) => item.principle === index + 1 && item.status === 'completed').length,
      planned: all['principle-actions'].filter((item) => item.principle === index + 1).length,
    })),
    challenge,
  };
}

function buildAssistantFallback(dashboard, actions, problems, applications, availableMinutes = null) {
  const suggestions = [];
  if (dashboard.plannedActions === 0) {
    suggestions.push(
      availableMinutes
        ? `Choose a small number of actions that fit your ${availableMinutes}-minute study budget.`
        : 'Choose a small number of actions that fit the time you actually have today.',
    );
  }
  if (dashboard.dsa.revisionBacklog > 0) {
    suggestions.push(`Review one of your ${dashboard.dsa.revisionBacklog} DSA problems due for revision.`);
  }
  if (applications.some((item) => item.followUpDate && item.followUpDate <= dashboard.date)) {
    suggestions.push('Review applications with a follow-up due today; send a personal, relevant follow-up only if appropriate.');
  }
  if (actions.some((item) => item.date === dashboard.date && item.status === 'not_completed')) {
    suggestions.push('Use your recorded blockers to reduce or reschedule an unfinished action; do not mark it complete retroactively.');
  }
  if (suggestions.length === 0) {
    suggestions.push('Prioritize your next DSA attempt, then schedule one focused learning or project block if time allows.');
  }
  return {
    mode: 'fallback',
    facts: {
      date: dashboard.date,
      plannedActions: dashboard.plannedActions,
      completedActions: dashboard.completedActions,
      dsaProblemsTracked: problems.length,
      revisionBacklog: dashboard.dsa.revisionBacklog,
      applicationsNeedingFollowUp: applications.filter((item) => item.followUpDate && item.followUpDate <= dashboard.date).length,
      availableMinutes,
    },
    summary: dashboard.plannedActions
      ? `You recorded ${dashboard.completedActions} completed of ${dashboard.plannedActions} planned actions for ${dashboard.date}.`
      : `No actions are planned for ${dashboard.date}. Consider adding only what fits your available time.`,
    suggestions,
    requiresConfirmation: true,
  };
}

export function mountGrowthRoutes(app, { auth, db, config, fetchImpl = globalThis.fetch }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS growth_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      collection TEXT NOT NULL,
      payload TEXT NOT NULL CHECK (json_valid(payload)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS growth_records_owner_collection_updated_idx
      ON growth_records (user_id, collection, updated_at DESC);
  `);

  app.get('/api/growth/dashboard', auth, (req, res) => {
    const today = req.query.date ?? new Date().toISOString().slice(0, 10);
    const parsedDate = date.safeParse(today);
    if (!parsedDate.success) return res.status(400).json({ error: 'Date must use YYYY-MM-DD format.' });
    return res.json(getDashboard(db, req.user.id, parsedDate.data));
  });

  app.get('/api/growth/analytics', auth, (req, res) => {
    const today = req.query.date ?? new Date().toISOString().slice(0, 10);
    const parsedDate = date.safeParse(today);
    if (!parsedDate.success) return res.status(400).json({ error: 'Date must use YYYY-MM-DD format.' });
    return res.json(analytics(db, req.user.id, parsedDate.data));
  });

  app.get('/api/growth/export', auth, (req, res) => {
    const exportedAt = new Date().toISOString();
    const data = Object.fromEntries(
      growthCollections.map((collection) => [
        collection,
        recordsFor(db, req.user.id, collection),
      ]),
    );
    return res.json({ exportedAt, data });
  });

  app.post('/api/growth/assistant/plan', auth, async (req, res, next) => {
    const requestSchema = z.object({
      date,
      availableMinutes: z.number().int().min(15).max(960).optional(),
    }).strict();
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Provide a valid date and available time.' });

    const dashboard = getDashboard(db, req.user.id, parsed.data.date);
    const actions = recordsFor(db, req.user.id, 'daily-actions');
    const problems = recordsFor(db, req.user.id, 'dsa-problems');
    const applications = recordsFor(db, req.user.id, 'applications');
    const settings = recordsFor(db, req.user.id, 'settings')[0];
    const availableMinutes = parsed.data.availableMinutes ?? settings?.dailyStudyMinutes ?? null;
    const fallback = buildAssistantFallback(
      dashboard,
      actions,
      problems,
      applications,
      availableMinutes,
    );
    if (!config.aiApiKey || !config.aiEndpoint || !config.aiModel) {
      return res.json(fallback);
    }

    const context = {
      date: parsed.data.date,
      availableMinutes,
      dashboard: fallback.facts,
      unfinishedActions: actions
        .filter((action) => action.date === parsed.data.date && action.status !== 'completed')
        .map(({ title, category, priority, status }) => ({ title, category, priority, status })),
      revisionProblems: problems
        .filter((problem) => problem.revisionDate && problem.revisionDate <= parsed.data.date && problem.status !== 'mastered')
        .map(({ title, topic, difficulty }) => ({ title, topic, difficulty })),
      dueFollowUps: applications
        .filter((application) => application.followUpDate && application.followUpDate <= parsed.data.date)
        .map(({ company, jobTitle, nextAction }) => ({ company, jobTitle, nextAction })),
    };
    try {
      const response = await fetchImpl(config.aiEndpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.aiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.aiModel,
          temperature: 0.2,
          messages: [
            {
              role: 'system',
              content: 'Create a realistic suggested daily plan from the supplied saved records. State facts separately from suggestions, respect available minutes, prioritize DSA, do not claim actions happened, and never modify records. Return concise JSON with a suggestions string array and summary string.',
            },
            { role: 'user', content: JSON.stringify(context) },
          ],
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) return res.json({ ...fallback, warning: 'AI provider was unavailable; showing a local suggestion.' });
      const body = await response.json();
      const content = body?.choices?.[0]?.message?.content;
      const result = JSON.parse(content);
      if (
        typeof result.summary !== 'string' ||
        !Array.isArray(result.suggestions) ||
        result.suggestions.some((item) => typeof item !== 'string')
      ) {
        return res.json({ ...fallback, warning: 'AI response was invalid; showing a local suggestion.' });
      }
      return res.json({
        mode: 'ai',
        facts: fallback.facts,
        summary: result.summary.slice(0, 1200),
        suggestions: result.suggestions.slice(0, 8).map((item) => item.slice(0, 500)),
        requiresConfirmation: true,
      });
    } catch (error) {
      if (error.name !== 'TimeoutError' && error.name !== 'SyntaxError') return next(error);
      return res.json({ ...fallback, warning: 'AI provider could not complete the request; showing a local suggestion.' });
    }
  });

  app.delete('/api/account', auth, (req, res, next) => {
    try {
      const removeAccount = db.transaction(() => {
        db.prepare('DELETE FROM growth_records WHERE user_id = ?').run(req.user.id);
        db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
      });
      removeAccount();
      return res.sendStatus(204);
    } catch (error) {
      return next(error);
    }
  });

  app.get('/api/growth/:collection', auth, (req, res) => {
    if (!recordSchemas[req.params.collection]) return res.status(404).json({ error: 'Unknown tracker collection.' });
    return res.json({ records: recordsFor(db, req.user.id, req.params.collection) });
  });

  app.post('/api/growth/:collection', auth, (req, res, next) => {
    const { collection } = req.params;
    const parsed = parseRecord(collection, req.body);
    if (!parsed) return res.status(404).json({ error: 'Unknown tracker collection.' });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Record is invalid.' });
    try {
      if (['challenges', 'settings'].includes(collection)) {
        const existing = db
          .prepare('SELECT id FROM growth_records WHERE user_id = ? AND collection = ? LIMIT 1')
          .get(req.user.id, collection);
        if (existing) return res.status(409).json({ error: 'A record already exists. Update the existing record instead.' });
      }
      const id = randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO growth_records (id, user_id, collection, payload, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, req.user.id, collection, JSON.stringify(parsed.data), now, now);
      return res.status(201).json({ record: { id, ...parsed.data, createdAt: now, updatedAt: now } });
    } catch (error) {
      return next(error);
    }
  });

  app.patch('/api/growth/:collection/:id', auth, (req, res, next) => {
    const { collection, id } = req.params;
    const parsed = parseRecord(collection, req.body, true);
    if (!parsed) return res.status(404).json({ error: 'Unknown tracker collection.' });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Record update is invalid.' });
    if (Object.keys(parsed.data).length === 0) return res.status(400).json({ error: 'Provide at least one field to update.' });
    try {
      const existing = db
        .prepare(`
          SELECT payload, created_at AS createdAt
          FROM growth_records WHERE id = ? AND user_id = ? AND collection = ?
        `)
        .get(id, req.user.id, collection);
      if (!existing) return res.status(404).json({ error: 'Record not found.' });
      const merged = { ...JSON.parse(existing.payload), ...parsed.data };
      const validated = parseRecord(collection, merged);
      if (!validated?.success) return res.status(400).json({ error: validated?.error.issues[0]?.message ?? 'Updated record is invalid.' });
      const updatedAt = new Date().toISOString();
      db.prepare(`
        UPDATE growth_records SET payload = ?, updated_at = ?
        WHERE id = ? AND user_id = ? AND collection = ?
      `).run(JSON.stringify(validated.data), updatedAt, id, req.user.id, collection);
      return res.json({ record: { id, ...validated.data, createdAt: existing.createdAt, updatedAt } });
    } catch (error) {
      return next(error);
    }
  });

  app.delete('/api/growth/:collection/:id', auth, (req, res, next) => {
    if (!recordSchemas[req.params.collection]) return res.status(404).json({ error: 'Unknown tracker collection.' });
    try {
      const result = db
        .prepare('DELETE FROM growth_records WHERE id = ? AND user_id = ? AND collection = ?')
        .run(req.params.id, req.user.id, req.params.collection);
      return result.changes ? res.sendStatus(204) : res.status(404).json({ error: 'Record not found.' });
    } catch (error) {
      return next(error);
    }
  });
}
