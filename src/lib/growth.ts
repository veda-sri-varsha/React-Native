import { apiRequest } from '@/lib/api';

export type GrowthCollection =
  | 'daily-actions'
  | 'dsa-problems'
  | 'dsa-attempts'
  | 'mock-tests'
  | 'learning'
  | 'labs'
  | 'projects'
  | 'milestones'
  | 'applications'
  | 'principle-actions'
  | 'exercise'
  | 'reflections'
  | 'challenges'
  | 'weekly-reviews'
  | 'settings';

export type GrowthRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
};

export type GrowthDashboard = {
  date: string;
  challenge: {
    startDate: string;
    day: number;
    elapsedDays: number;
    daysRemaining: number;
    phase: number;
    completed: boolean;
    progressPercent: number;
    milestones: { day: number; date: string; reached: boolean }[];
  } | null;
  completionPercent: number | null;
  plannedActions: number;
  attemptedActions: number;
  completedActions: number;
  partialActions: number;
  dsa: {
    problemsTracked: number;
    attemptsToday: number;
    independentToday: number;
    revisionBacklog: number;
  };
  exerciseMinutes: number;
  accountability: 'completed' | 'partial' | 'not_completed' | null;
  currentStreak: number;
  weeklyCompletedActions: number;
  upcomingDeadlines: { id: string; title: string; date: string; kind: string }[];
  recentActions: GrowthRecord[];
  totals: {
    problemsAttempted: number;
    independentlySolved: number;
    assisted: number;
    labsCompleted: number;
    projectsCompleted: number;
    applicationsSubmitted: number;
    exerciseSessions: number;
  };
};

export type GrowthAnalytics = {
  period: { from: string; to: string };
  daily: {
    date: string;
    plannedActions: number;
    completedActions: number;
    completionPercent: number | null;
    dsaAttempts: number;
    dsaIndependent: number;
    exerciseMinutes: number;
    applications: number;
  }[];
  dsaTopics: { topic: string; tracked: number; mastered: number }[];
  mockTests: { id: string; date: string; score: number; source: string }[];
  learningMinutes: number;
  labCount: number;
  projectMilestones: { id: string; title: string; status: string; dueDate: string | null }[];
  applicationStatuses: { status: string; count: number }[];
  principleActions: { principle: number; completed: number; planned: number }[];
  challenge: GrowthDashboard['challenge'];
};

export type AssistantPlan = {
  mode: 'fallback' | 'ai';
  facts: Record<string, unknown>;
  summary: string;
  suggestions: string[];
  requiresConfirmation: true;
  warning?: string;
};

export async function getGrowthDashboard(token: string, date = localDateString()) {
  return apiRequest<GrowthDashboard>(`/api/growth/dashboard?date=${encodeURIComponent(date)}`, token);
}

export async function getGrowthAnalytics(token: string, date = localDateString()) {
  return apiRequest<GrowthAnalytics>(`/api/growth/analytics?date=${encodeURIComponent(date)}`, token);
}

export async function getAssistantPlan(token: string, date: string, availableMinutes?: number) {
  return apiRequest<AssistantPlan>('/api/growth/assistant/plan', token, {
    method: 'POST',
    body: JSON.stringify({ date, availableMinutes }),
  });
}

export async function listGrowthRecords(collection: GrowthCollection, token: string) {
  const result = await apiRequest<{ records: GrowthRecord[] }>(
    `/api/growth/${collection}`,
    token,
  );
  return result.records;
}

export async function createGrowthRecord(
  collection: GrowthCollection,
  value: Record<string, unknown>,
  token: string,
) {
  const result = await apiRequest<{ record: GrowthRecord }>(
    `/api/growth/${collection}`,
    token,
    { method: 'POST', body: JSON.stringify(value) },
  );
  return result.record;
}

export async function updateGrowthRecord(
  collection: GrowthCollection,
  id: string,
  value: Record<string, unknown>,
  token: string,
) {
  const result = await apiRequest<{ record: GrowthRecord }>(
    `/api/growth/${collection}/${encodeURIComponent(id)}`,
    token,
    { method: 'PATCH', body: JSON.stringify(value) },
  );
  return result.record;
}

export async function deleteGrowthRecord(
  collection: GrowthCollection,
  id: string,
  token: string,
) {
  await apiRequest<void>(
    `/api/growth/${collection}/${encodeURIComponent(id)}`,
    token,
    { method: 'DELETE' },
  );
}

export function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
