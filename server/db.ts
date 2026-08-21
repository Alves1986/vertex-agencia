import { and, asc, desc, eq, gte, isNull, like, lte, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  adCampaigns,
  aiGenerations,
  calendarEvents,
  carouselSlides,
  creativeApprovals,
  creativeVersions,
  clientAgencyProfiles,
  clientAiConnections,
  clientPortalMembers,
  clients,
  contentBriefs,
  InsertUser,
  notifications,
  operators,
  originalAppConnections,
  projectArtifacts,
  projects,
  saasPlans,
  saasSubscriptions,
  strategyDecisions,
  tasks,
  teams,
  trendSignals,
  userDashboardPreferences,
  users,
  videoScripts,
  whatsappAuditLogs,
  whatsappAiPolicies,
  whatsappAiRuns,
  whatsappAutomationExecutions,
  whatsappAutomationRules,
  whatsappChannels,
  whatsappContacts,
  whatsappConversations,
  whatsappMessages,
  whatsappWebhookEvents,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let testDbOverride: ReturnType<typeof drizzle> | null = null;

/** Disponível exclusivamente para testes unitários; não é usado no runtime da aplicação. */
export function setDbForTests(database: ReturnType<typeof drizzle> | null) {
  testDbOverride = database;
}

export async function getDb() {
  if (testDbOverride) return testDbOverride;
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };
  (["name", "email", "loginMethod"] as const).forEach(field => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listClients(userId: number) {
  const db = await requireDb();
  return db.select().from(clients).where(eq(clients.createdByUserId, userId)).orderBy(asc(clients.name));
}

export async function createClient(userId: number, input: {
  name: string;
  contactName?: string | null;
  contactEmail?: string | null;
  segment?: string | null;
}) {
  const db = await requireDb();
  await db.insert(clients).values({ ...input, createdByUserId: userId });
}

export async function listTeams(userId: number) {
  const db = await requireDb();
  return db.select().from(teams).where(eq(teams.createdByUserId, userId)).orderBy(asc(teams.name));
}

export async function createTeam(userId: number, input: { name: string; color?: string }) {
  const db = await requireDb();
  await db.insert(teams).values({
    name: input.name,
    color: input.color ?? "#E85D3F",
    leadUserId: userId,
    createdByUserId: userId,
  });
}

export async function updateTeam(userId: number, teamId: number, input: { name: string; color: string }) {
  const db = await requireDb();
  await db.update(teams).set(input).where(and(eq(teams.id, teamId), eq(teams.createdByUserId, userId)));
}

export async function listOperators(userId: number) {
  const db = await requireDb();
  return db
    .select({ operator: operators, team: teams })
    .from(operators)
    .leftJoin(teams, eq(operators.teamId, teams.id))
    .where(eq(operators.createdByUserId, userId))
    .orderBy(asc(operators.name));
}

export async function createOperator(userId: number, input: { name: string; email?: string | null; role?: string | null; teamId?: number | null }) {
  const db = await requireDb();
  if (input.teamId) {
    const ownedTeam = await db.select({ id: teams.id }).from(teams).where(and(eq(teams.id, input.teamId), eq(teams.createdByUserId, userId))).limit(1);
    if (!ownedTeam[0]) throw new Error("Equipe inválida para este espaço de trabalho");
  }
  await db.insert(operators).values({ ...input, createdByUserId: userId });
}

type ProjectFilters = {
  clientId?: number;
  teamId?: number;
  query?: string;
  status?: "briefing" | "in_progress" | "review" | "approved" | "on_hold" | "completed";
};

export async function listProjects(userId: number, filters: ProjectFilters) {
  const db = await requireDb();
  const conditions = [eq(projects.ownerUserId, userId)];
  if (filters.clientId) conditions.push(eq(projects.clientId, filters.clientId));
  if (filters.teamId) conditions.push(eq(projects.teamId, filters.teamId));
  if (filters.status) conditions.push(eq(projects.status, filters.status));
  if (filters.query?.trim()) conditions.push(like(projects.name, `%${filters.query.trim()}%`));

  return db
    .select({ project: projects, client: clients, team: teams, responsible: operators })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .leftJoin(teams, eq(projects.teamId, teams.id))
    .leftJoin(operators, eq(projects.responsibleOperatorId, operators.id))
    .where(and(...conditions))
    .orderBy(asc(projects.dueAt), desc(projects.updatedAt));
}

export async function getProject(userId: number, projectId: number) {
  const db = await requireDb();
  const rows = await db
    .select({ project: projects, client: clients, team: teams, responsible: operators })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .leftJoin(teams, eq(projects.teamId, teams.id))
    .leftJoin(operators, eq(projects.responsibleOperatorId, operators.id))
    .where(and(eq(projects.id, projectId), eq(projects.ownerUserId, userId)))
    .limit(1);
  return rows[0];
}

export async function createProject(userId: number, input: {
  name: string;
  description?: string | null;
  clientId: number;
  teamId?: number | null;
  responsibleOperatorId?: number | null;
  status?: "briefing" | "in_progress" | "review" | "approved" | "on_hold" | "completed";
  priority?: "low" | "medium" | "high" | "urgent";
  progress?: number;
  sourceSkill?: "agencia" | "carrosseis" | "manual";
  startsAt?: Date | null;
  dueAt?: Date | null;
}) {
  const db = await requireDb();
  const ownedClient = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, input.clientId), eq(clients.createdByUserId, userId)))
    .limit(1);
  if (!ownedClient[0]) throw new Error("Cliente inválido para este espaço de trabalho");

  if (input.teamId) {
    const ownedTeam = await db
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.id, input.teamId), eq(teams.createdByUserId, userId)))
      .limit(1);
    if (!ownedTeam[0]) throw new Error("Equipe inválida para este espaço de trabalho");
  }

  if (input.responsibleOperatorId) {
    const ownedOperator = await db
      .select({ id: operators.id })
      .from(operators)
      .where(and(eq(operators.id, input.responsibleOperatorId), eq(operators.createdByUserId, userId)))
      .limit(1);
    if (!ownedOperator[0]) throw new Error("Responsável inválido para este espaço de trabalho");
  }

  await db.insert(projects).values({
    ...input,
    ownerUserId: userId,
    progress: Math.max(0, Math.min(100, input.progress ?? 0)),
    status: input.status ?? "briefing",
    priority: input.priority ?? "medium",
    sourceSkill: input.sourceSkill ?? "manual",
  });
}

export async function updateProjectStatus(userId: number, projectId: number, status: "briefing" | "in_progress" | "review" | "approved" | "on_hold" | "completed") {
  const db = await requireDb();
  await db.update(projects).set({ status }).where(and(eq(projects.id, projectId), eq(projects.ownerUserId, userId)));
}

export async function assignProjectResponsible(userId: number, projectId: number, responsibleOperatorId: number | null) {
  const db = await requireDb();
  if (responsibleOperatorId) {
    const operator = await db.select({ id: operators.id }).from(operators).where(and(eq(operators.id, responsibleOperatorId), eq(operators.createdByUserId, userId))).limit(1);
    if (!operator[0]) throw new Error("Responsável inválido para este espaço de trabalho");
  }
  await db.update(projects).set({ responsibleOperatorId }).where(and(eq(projects.id, projectId), eq(projects.ownerUserId, userId)));
}

type TaskFilters = {
  clientId?: number;
  teamId?: number;
  projectId?: number;
  status?: "backlog" | "ready" | "in_progress" | "review" | "done" | "blocked";
};

export async function listTasks(userId: number, filters: TaskFilters) {
  const db = await requireDb();
  const conditions = [eq(tasks.createdByUserId, userId)];
  if (filters.teamId) conditions.push(eq(tasks.teamId, filters.teamId));
  if (filters.projectId) conditions.push(eq(tasks.projectId, filters.projectId));
  if (filters.status) conditions.push(eq(tasks.status, filters.status));
  if (filters.clientId) conditions.push(eq(projects.clientId, filters.clientId));

  return db
    .select({ task: tasks, project: projects, client: clients, team: teams, responsible: operators })
    .from(tasks)
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .leftJoin(clients, eq(projects.clientId, clients.id))
    .leftJoin(teams, eq(tasks.teamId, teams.id))
    .leftJoin(operators, eq(tasks.responsibleOperatorId, operators.id))
    .where(and(...conditions))
    .orderBy(asc(tasks.sortOrder), asc(tasks.dueAt), desc(tasks.createdAt));
}

export async function getTask(userId: number, taskId: number) {
  const db = await requireDb();
  const rows = await db
    .select({ task: tasks, project: projects, client: clients, team: teams, responsible: operators })
    .from(tasks)
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .leftJoin(clients, eq(projects.clientId, clients.id))
    .leftJoin(teams, eq(tasks.teamId, teams.id))
    .leftJoin(operators, eq(tasks.responsibleOperatorId, operators.id))
    .where(and(eq(tasks.id, taskId), eq(tasks.createdByUserId, userId)))
    .limit(1);
  return rows[0];
}

export async function createTask(userId: number, input: {
  title: string;
  description?: string | null;
  projectId?: number | null;
  teamId?: number | null;
  responsibleOperatorId?: number | null;
  assignedUserId?: number | null;
  status?: "backlog" | "ready" | "in_progress" | "review" | "done" | "blocked";
  priority?: "low" | "medium" | "high" | "urgent";
  dueAt?: Date | null;
  estimateMinutes?: number | null;
}) {
  const db = await requireDb();
  if (input.projectId) {
    const ownedProject = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, input.projectId), eq(projects.ownerUserId, userId))).limit(1);
    if (!ownedProject[0]) throw new Error("Projeto inválido para este espaço de trabalho");
  }
  if (input.teamId) {
    const ownedTeam = await db.select({ id: teams.id }).from(teams).where(and(eq(teams.id, input.teamId), eq(teams.createdByUserId, userId))).limit(1);
    if (!ownedTeam[0]) throw new Error("Equipe inválida para este espaço de trabalho");
  }
  if (input.responsibleOperatorId) {
    const ownedOperator = await db.select({ id: operators.id }).from(operators).where(and(eq(operators.id, input.responsibleOperatorId), eq(operators.createdByUserId, userId))).limit(1);
    if (!ownedOperator[0]) throw new Error("Responsável inválido para este espaço de trabalho");
  }
  await db.insert(tasks).values({
    ...input,
    createdByUserId: userId,
    status: input.status ?? "backlog",
    priority: input.priority ?? "medium",
  });
}

export async function updateTaskStatus(userId: number, taskId: number, status: "backlog" | "ready" | "in_progress" | "review" | "done" | "blocked") {
  const db = await requireDb();
  await db
    .update(tasks)
    .set({ status, completedAt: status === "done" ? new Date() : null })
    .where(and(eq(tasks.id, taskId), eq(tasks.createdByUserId, userId)));
}

export async function assignTaskResponsible(userId: number, taskId: number, responsibleOperatorId: number | null) {
  const db = await requireDb();
  if (responsibleOperatorId) {
    const operator = await db.select({ id: operators.id }).from(operators).where(and(eq(operators.id, responsibleOperatorId), eq(operators.createdByUserId, userId))).limit(1);
    if (!operator[0]) throw new Error("Responsável inválido para este espaço de trabalho");
  }
  await db.update(tasks).set({ responsibleOperatorId }).where(and(eq(tasks.id, taskId), eq(tasks.createdByUserId, userId)));
}

export async function listCalendarEvents(userId: number, from?: Date, to?: Date) {
  const db = await requireDb();
  const conditions = [eq(calendarEvents.ownerUserId, userId)];
  if (from) conditions.push(gte(calendarEvents.startsAt, from));
  if (to) conditions.push(lte(calendarEvents.startsAt, to));
  return db
    .select({ event: calendarEvents, project: projects, client: clients, team: teams, responsible: operators })
    .from(calendarEvents)
    .leftJoin(projects, eq(calendarEvents.projectId, projects.id))
    .leftJoin(clients, eq(calendarEvents.clientId, clients.id))
    .leftJoin(teams, eq(calendarEvents.teamId, teams.id))
    .leftJoin(operators, eq(calendarEvents.responsibleOperatorId, operators.id))
    .where(and(...conditions))
    .orderBy(asc(calendarEvents.startsAt));
}

export async function createCalendarEvent(userId: number, input: {
  title: string;
  description?: string | null;
  projectId?: number | null;
  clientId?: number | null;
  teamId?: number | null;
  responsibleOperatorId?: number | null;
  eventType?: "meeting" | "review" | "delivery" | "focus" | "deadline";
  startsAt: Date;
  endsAt?: Date | null;
}) {
  const db = await requireDb();
  if (input.projectId) {
    const ownedProject = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, input.projectId), eq(projects.ownerUserId, userId))).limit(1);
    if (!ownedProject[0]) throw new Error("Projeto inválido para este espaço de trabalho");
  }
  if (input.clientId) {
    const ownedClient = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, input.clientId), eq(clients.createdByUserId, userId))).limit(1);
    if (!ownedClient[0]) throw new Error("Cliente inválido para este espaço de trabalho");
  }
  if (input.teamId) {
    const ownedTeam = await db.select({ id: teams.id }).from(teams).where(and(eq(teams.id, input.teamId), eq(teams.createdByUserId, userId))).limit(1);
    if (!ownedTeam[0]) throw new Error("Equipe inválida para este espaço de trabalho");
  }
  if (input.responsibleOperatorId) {
    const ownedOperator = await db.select({ id: operators.id }).from(operators).where(and(eq(operators.id, input.responsibleOperatorId), eq(operators.createdByUserId, userId))).limit(1);
    if (!ownedOperator[0]) throw new Error("Responsável inválido para este espaço de trabalho");
  }
  await db.insert(calendarEvents).values({ ...input, ownerUserId: userId, eventType: input.eventType ?? "meeting" });
}

export async function updateCalendarEvent(userId: number, eventId: number, input: {
  title: string;
  eventType: "meeting" | "review" | "delivery" | "focus" | "deadline";
  startsAt: Date;
  endsAt?: Date | null;
}) {
  const db = await requireDb();
  await db
    .update(calendarEvents)
    .set(input)
    .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.ownerUserId, userId)));
}

export async function listNotifications(userId: number) {
  const db = await requireDb();
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(50);
}

export async function createNotification(userId: number, input: {
  type: "approval" | "deadline" | "comment" | "delivery" | "system";
  title: string;
  body?: string | null;
  entityType?: string | null;
  entityId?: number | null;
  actionPath?: string | null;
}) {
  const db = await requireDb();
  await db.insert(notifications).values({ ...input, userId });
}

export async function markNotificationRead(userId: number, notificationId: number) {
  const db = await requireDb();
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
}

export async function markAllNotificationsRead(userId: number) {
  const db = await requireDb();
  await db.update(notifications).set({ readAt: new Date() }).where(eq(notifications.userId, userId));
}

export async function getDashboardPreferences(userId: number) {
  const db = await requireDb();
  const existing = await db.select().from(userDashboardPreferences).where(eq(userDashboardPreferences.userId, userId)).limit(1);
  if (existing[0]) return existing[0];
  await db.insert(userDashboardPreferences).values({ userId });
  const created = await db.select().from(userDashboardPreferences).where(eq(userDashboardPreferences.userId, userId)).limit(1);
  return created[0];
}

export async function updateDashboardPreferences(userId: number, input: {
  activeClientId?: number | null;
  activeTeamId?: number | null;
  preferredRange?: "week" | "month";
}) {
  const db = await requireDb();
  if (input.activeClientId) {
    const ownedClient = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, input.activeClientId), eq(clients.createdByUserId, userId))).limit(1);
    if (!ownedClient[0]) throw new Error("Cliente inválido para este espaço de trabalho");
  }
  if (input.activeTeamId) {
    const ownedTeam = await db.select({ id: teams.id }).from(teams).where(and(eq(teams.id, input.activeTeamId), eq(teams.createdByUserId, userId))).limit(1);
    if (!ownedTeam[0]) throw new Error("Equipe inválida para este espaço de trabalho");
  }
  await getDashboardPreferences(userId);
  await db.update(userDashboardPreferences).set(input).where(eq(userDashboardPreferences.userId, userId));
}

export async function getOriginalAppConnection(userId: number) {
  const db = await requireDb();
  const rows = await db.select().from(originalAppConnections).where(eq(originalAppConnections.userId, userId)).limit(1);
  return rows[0];
}

export async function saveOriginalAppConnection(userId: number, baseUrl: string) {
  const db = await requireDb();
  await db
    .insert(originalAppConnections)
    .values({ userId, baseUrl, connectionStatus: "pending" })
    .onDuplicateKeyUpdate({ set: { baseUrl, connectionStatus: "pending", lastError: null, lastCheckedAt: null } });
}

export async function updateOriginalAppConnectionStatus(userId: number, status: "connected" | "error", lastError?: string | null) {
  const db = await requireDb();
  await db
    .update(originalAppConnections)
    .set({ connectionStatus: status, lastError: lastError ?? null, lastCheckedAt: new Date() })
    .where(eq(originalAppConnections.userId, userId));
}

export async function listProjectArtifacts(userId: number, projectId: number) {
  const db = await requireDb();
  const project = await getProject(userId, projectId);
  if (!project) return [];
  return db.select().from(projectArtifacts).where(eq(projectArtifacts.projectId, projectId)).orderBy(desc(projectArtifacts.syncedAt));
}

export async function addProjectArtifacts(userId: number, projectId: number, artifacts: Array<{ fileName: string; fileSize?: number | null; sourcePath?: string | null }>) {
  const db = await requireDb();
  const project = await getProject(userId, projectId);
  if (!project || artifacts.length === 0) return;
  await db.insert(projectArtifacts).values(artifacts.map(artifact => ({ projectId, ...artifact })));
}

type ProviderKind = "manus" | "openai" | "openai_compatible" | "gemini" | "anthropic";
type CampaignMode = "ads" | "carousel" | "bundle";
type CampaignStatus = "draft" | "generating" | "ready" | "review" | "approved" | "failed";
type GenerationKind = "strategy" | "ads" | "carousel" | "bundle" | "image";
type GenerationStatus = "queued" | "running" | "succeeded" | "failed";
type CreativeKind = "ads" | "carousel" | "strategy" | "video" | "bundle";
type ApprovalDecision = "approved" | "changes_requested" | "rejected";

export async function listClientAiConnections(userId: number, clientId?: number) {
  const db = await requireDb();
  const conditions = [eq(clientAiConnections.ownerUserId, userId)];
  if (clientId) conditions.push(eq(clientAiConnections.clientId, clientId));
  return db
    .select({
      id: clientAiConnections.id,
      clientId: clientAiConnections.clientId,
      label: clientAiConnections.label,
      provider: clientAiConnections.provider,
      apiBaseUrl: clientAiConnections.apiBaseUrl,
      defaultModel: clientAiConnections.defaultModel,
      defaultImageModel: clientAiConnections.defaultImageModel,
      keyHint: clientAiConnections.keyHint,
      status: clientAiConnections.status,
      lastTestedAt: clientAiConnections.lastTestedAt,
      createdAt: clientAiConnections.createdAt,
      updatedAt: clientAiConnections.updatedAt,
    })
    .from(clientAiConnections)
    .where(and(...conditions))
    .orderBy(asc(clientAiConnections.label));
}

export async function createClientAiConnection(userId: number, input: {
  clientId: number;
  label: string;
  provider: ProviderKind;
  apiBaseUrl?: string | null;
  defaultModel: string;
  defaultImageModel?: string | null;
  encryptedApiKey?: string | null;
  keyHint?: string | null;
  lastTestedAt?: Date | null;
}) {
  const db = await requireDb();
  const ownedClient = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, input.clientId), eq(clients.createdByUserId, userId))).limit(1);
  if (!ownedClient[0]) throw new Error("Cliente inválido para este espaço de trabalho");
  const [created] = await db.insert(clientAiConnections).values({ ...input, ownerUserId: userId }).$returningId();
  return created.id;
}

export async function updateClientAiConnection(userId: number, connectionId: number, input: {
  label: string;
  provider: ProviderKind;
  apiBaseUrl?: string | null;
  defaultModel: string;
  defaultImageModel?: string | null;
  encryptedApiKey?: string | null;
  keyHint?: string | null;
  lastTestedAt?: Date | null;
}) {
  const db = await requireDb();
  const rows = await db
    .select({ id: clientAiConnections.id, provider: clientAiConnections.provider })
    .from(clientAiConnections)
    .where(and(eq(clientAiConnections.id, connectionId), eq(clientAiConnections.ownerUserId, userId)))
    .limit(1);
  const connection = rows[0];
  if (!connection) throw new Error("Conexão de IA não encontrada");
  if (connection.provider !== input.provider && input.provider !== "manus" && !input.encryptedApiKey) {
    throw new Error("Ao trocar de provedor, informe uma nova chave de API");
  }
  await db
    .update(clientAiConnections)
    .set(input)
    .where(and(eq(clientAiConnections.id, connectionId), eq(clientAiConnections.ownerUserId, userId)));
  return connectionId;
}

export async function setClientAiConnectionStatus(userId: number, connectionId: number, status: "active" | "disabled") {
  const db = await requireDb();
  const rows = await db
    .select({ id: clientAiConnections.id })
    .from(clientAiConnections)
    .where(and(eq(clientAiConnections.id, connectionId), eq(clientAiConnections.ownerUserId, userId)))
    .limit(1);
  if (!rows[0]) throw new Error("Conexão de IA não encontrada");
  await db
    .update(clientAiConnections)
    .set({ status })
    .where(and(eq(clientAiConnections.id, connectionId), eq(clientAiConnections.ownerUserId, userId)));
  return connectionId;
}

export async function recordClientAiConnectionTest(userId: number, connectionId: number, testedAt = new Date()) {
  const db = await requireDb();
  const rows = await db
    .select({ id: clientAiConnections.id })
    .from(clientAiConnections)
    .where(and(eq(clientAiConnections.id, connectionId), eq(clientAiConnections.ownerUserId, userId)))
    .limit(1);
  if (!rows[0]) throw new Error("Conexão de IA não encontrada");
  await db
    .update(clientAiConnections)
    .set({ lastTestedAt: testedAt })
    .where(and(eq(clientAiConnections.id, connectionId), eq(clientAiConnections.ownerUserId, userId)));
  return connectionId;
}

export async function getClientAiConnectionSecret(userId: number, connectionId: number) {
  const db = await requireDb();
  const rows = await db.select().from(clientAiConnections).where(and(eq(clientAiConnections.id, connectionId), eq(clientAiConnections.ownerUserId, userId), eq(clientAiConnections.status, "active"))).limit(1);
  return rows[0];
}

export async function getClientAiConnection(userId: number, connectionId: number) {
  const db = await requireDb();
  const rows = await db.select().from(clientAiConnections).where(and(eq(clientAiConnections.id, connectionId), eq(clientAiConnections.ownerUserId, userId))).limit(1);
  return rows[0];
}

export async function listClientCredentialStatuses(userId: number) {
  const db = await requireDb();
  const [ownedClients, connections] = await Promise.all([
    db.select({ id: clients.id, name: clients.name }).from(clients).where(eq(clients.createdByUserId, userId)).orderBy(asc(clients.name)),
    db.select({ clientId: clientAiConnections.clientId, status: clientAiConnections.status }).from(clientAiConnections).where(eq(clientAiConnections.ownerUserId, userId)),
  ]);
  return ownedClients.map(client => {
    const related = connections.filter(connection => connection.clientId === client.id);
    const activeCount = related.filter(connection => connection.status === "active").length;
    const disabledCount = related.filter(connection => connection.status === "disabled").length;
    return { ...client, activeCount, disabledCount, status: activeCount ? "active" as const : disabledCount ? "disabled" as const : "missing" as const };
  });
}

export async function updateClientMonthlyApiCallLimit(userId: number, clientId: number, monthlyApiCallLimit: number | null) {
  const db = await requireDb();
  const result = await db
    .update(clients)
    .set({ monthlyApiCallLimit })
    .where(and(eq(clients.id, clientId), eq(clients.createdByUserId, userId)));
  if (!result[0].affectedRows) throw new Error("Cliente não encontrado neste espaço de trabalho");
  return clientId;
}

async function assertOwnedWhatsappClient(userId: number, clientId: number) {
  const db = await requireDb();
  const owned = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, clientId), eq(clients.createdByUserId, userId))).limit(1);
  if (!owned[0]) throw new Error("Cliente não encontrado neste espaço de trabalho");
}

export async function listWhatsAppChannels(userId: number, clientId?: number) {
  const db = await requireDb();
  if (clientId) await assertOwnedWhatsappClient(userId, clientId);
  const conditions = [eq(whatsappChannels.ownerUserId, userId)];
  if (clientId) conditions.push(eq(whatsappChannels.clientId, clientId));
  return db.select({
    id: whatsappChannels.id,
    clientId: whatsappChannels.clientId,
    label: whatsappChannels.label,
    provider: whatsappChannels.provider,
    status: whatsappChannels.status,
    displayPhoneNumber: whatsappChannels.displayPhoneNumber,
    externalAccountId: whatsappChannels.externalAccountId,
    externalSenderId: whatsappChannels.externalSenderId,
    configHint: whatsappChannels.configHint,
    verifiedAt: whatsappChannels.verifiedAt,
    lastInboundAt: whatsappChannels.lastInboundAt,
    lastOutboundAt: whatsappChannels.lastOutboundAt,
    lastError: whatsappChannels.lastError,
    createdAt: whatsappChannels.createdAt,
    updatedAt: whatsappChannels.updatedAt,
  }).from(whatsappChannels).where(and(...conditions)).orderBy(asc(whatsappChannels.label));
}

export async function createWhatsAppChannel(userId: number, input: { clientId: number; label: string; provider: "meta_cloud" | "twilio"; displayPhoneNumber?: string | null; externalAccountId?: string | null; externalSenderId?: string | null }) {
  const db = await requireDb();
  await assertOwnedWhatsappClient(userId, input.clientId);
  const [created] = await db.insert(whatsappChannels).values({ ...input, ownerUserId: userId, status: "draft", displayPhoneNumber: input.displayPhoneNumber || null, externalAccountId: input.externalAccountId || null, externalSenderId: input.externalSenderId || null }).$returningId();
  await db.insert(whatsappAuditLogs).values({ clientId: input.clientId, actorUserId: userId, action: "whatsapp.channel_created", entityType: "whatsapp_channel", entityId: created.id, detailsJson: JSON.stringify({ provider: input.provider, label: input.label }) });
  return created.id;
}

/** Troca o adaptador de um canal sem mover conversas entre clientes nem reutilizar segredos do provedor anterior. */
export async function updateWhatsAppChannelProvider(userId: number, input: { clientId: number; channelId: number; provider: "meta_cloud" | "twilio"; displayPhoneNumber?: string | null; externalAccountId?: string | null; externalSenderId?: string | null }) {
  const db = await requireDb();
  await assertOwnedWhatsappClient(userId, input.clientId);
  const current = (await db.select({ id: whatsappChannels.id, provider: whatsappChannels.provider }).from(whatsappChannels).where(and(eq(whatsappChannels.id, input.channelId), eq(whatsappChannels.clientId, input.clientId), eq(whatsappChannels.ownerUserId, userId))).limit(1))[0];
  if (!current) throw new Error("O canal selecionado não pertence a este cliente.");
  await db.update(whatsappChannels).set({ provider: input.provider, status: "draft", displayPhoneNumber: input.displayPhoneNumber || null, externalAccountId: input.externalAccountId || null, externalSenderId: input.externalSenderId || null, encryptedConfig: null, configHint: null, verifiedAt: null, lastError: null }).where(eq(whatsappChannels.id, input.channelId));
  await db.insert(whatsappAuditLogs).values({ clientId: input.clientId, actorUserId: userId, action: "whatsapp.channel_provider_changed", entityType: "whatsapp_channel", entityId: input.channelId, detailsJson: JSON.stringify({ previousProvider: current.provider, provider: input.provider, credentialsCleared: true, conversationsPreserved: true, externalDelivery: "disabled" }) });
  return input.channelId;
}

export async function getWhatsAppAiPolicy(userId: number, clientId: number) {
  const db = await requireDb();
  await assertOwnedWhatsappClient(userId, clientId);
  const rows = await db.select({
    id: whatsappAiPolicies.id,
    clientId: whatsappAiPolicies.clientId,
    aiAccessMode: whatsappAiPolicies.aiAccessMode,
    providerConnectionId: whatsappAiPolicies.providerConnectionId,
    workflowMode: whatsappAiPolicies.workflowMode,
    systemInstructions: whatsappAiPolicies.systemInstructions,
    businessHoursJson: whatsappAiPolicies.businessHoursJson,
    handoffKeywordsJson: whatsappAiPolicies.handoffKeywordsJson,
    monthlyManagedMessageLimit: whatsappAiPolicies.monthlyManagedMessageLimit,
    managedAiCostPerThousandCents: whatsappAiPolicies.managedAiCostPerThousandCents,
    managedAiMarkupPercent: whatsappAiPolicies.managedAiMarkupPercent,
    managedAiOveragePricePerThousandCents: whatsappAiPolicies.managedAiOveragePricePerThousandCents,
    updatedAt: whatsappAiPolicies.updatedAt,
  }).from(whatsappAiPolicies).where(and(eq(whatsappAiPolicies.clientId, clientId), eq(whatsappAiPolicies.ownerUserId, userId))).limit(1);
  return rows[0] ?? null;
}

export async function upsertWhatsAppAiPolicy(userId: number, input: { clientId: number; aiAccessMode: "client_api_key" | "vertex_managed"; providerConnectionId?: number | null; workflowMode: "auto_reply" | "draft_for_approval" | "handoff_only"; systemInstructions?: string | null; businessHoursJson?: string | null; handoffKeywordsJson?: string | null; monthlyManagedMessageLimit?: number | null; managedAiCostPerThousandCents?: number | null; managedAiMarkupPercent?: number | null; managedAiOveragePricePerThousandCents?: number | null }) {
  const db = await requireDb();
  await assertOwnedWhatsappClient(userId, input.clientId);
  const providerConnectionId = input.aiAccessMode === "client_api_key" ? input.providerConnectionId ?? null : null;
  if (input.aiAccessMode === "client_api_key") {
    if (!providerConnectionId) throw new Error("Selecione uma conexão de IA ativa do cliente.");
    const connection = await db.select({ id: clientAiConnections.id }).from(clientAiConnections).where(and(eq(clientAiConnections.id, providerConnectionId), eq(clientAiConnections.clientId, input.clientId), eq(clientAiConnections.ownerUserId, userId), eq(clientAiConnections.status, "active"))).limit(1);
    if (!connection[0]) throw new Error("A conexão de IA selecionada não pertence ao cliente ou está inativa.");
  }
  const vertexPricing = input.aiAccessMode === "vertex_managed" ? {
    monthlyManagedMessageLimit: input.monthlyManagedMessageLimit ?? null,
    managedAiCostPerThousandCents: input.managedAiCostPerThousandCents ?? null,
    managedAiMarkupPercent: input.managedAiMarkupPercent ?? null,
    managedAiOveragePricePerThousandCents: input.managedAiOveragePricePerThousandCents ?? null,
  } : {
    monthlyManagedMessageLimit: null,
    managedAiCostPerThousandCents: null,
    managedAiMarkupPercent: null,
    managedAiOveragePricePerThousandCents: null,
  };
  const values = { clientId: input.clientId, ownerUserId: userId, aiAccessMode: input.aiAccessMode, providerConnectionId, workflowMode: input.workflowMode, systemInstructions: input.systemInstructions || null, businessHoursJson: input.businessHoursJson || null, handoffKeywordsJson: input.handoffKeywordsJson || null, ...vertexPricing };
  const existing = await db.select({ id: whatsappAiPolicies.id }).from(whatsappAiPolicies).where(and(eq(whatsappAiPolicies.clientId, input.clientId), eq(whatsappAiPolicies.ownerUserId, userId))).limit(1);
  if (existing[0]) {
    await db.update(whatsappAiPolicies).set(values).where(eq(whatsappAiPolicies.id, existing[0].id));
    return existing[0].id;
  }
  const [created] = await db.insert(whatsappAiPolicies).values(values).$returningId();
  return created.id;
}

export type ManagedAiQuoteInput = {
  currentMonthlyMessages: number;
  projectedAdditionalMessages: number;
  includedMonthlyMessages: number;
  costPerThousandCents: number;
  markupPercent: number;
  overagePricePerThousandCents: number;
};

/** Calcula valores em centavos por mil mensagens, sem expor segredos de provedor. */
export function calculateManagedAiQuote(input: ManagedAiQuoteInput) {
  const currentMonthlyMessages = Math.max(0, Math.trunc(input.currentMonthlyMessages));
  const projectedAdditionalMessages = Math.max(0, Math.trunc(input.projectedAdditionalMessages));
  const includedMonthlyMessages = Math.max(0, Math.trunc(input.includedMonthlyMessages));
  const costPerThousandCents = Math.max(0, Math.trunc(input.costPerThousandCents));
  const markupPercent = Math.max(0, Math.trunc(input.markupPercent));
  const derivedOveragePrice = Math.ceil((costPerThousandCents * (100 + markupPercent)) / 100);
  const overagePricePerThousandCents = Math.max(0, Math.trunc(input.overagePricePerThousandCents || derivedOveragePrice));
  const totalMonthlyMessages = currentMonthlyMessages + projectedAdditionalMessages;
  const overageMessages = Math.max(0, totalMonthlyMessages - includedMonthlyMessages);
  const thousands = (messages: number) => Math.ceil(messages / 1000);
  const projectedCostCents = thousands(totalMonthlyMessages) * costPerThousandCents;
  const overageCostCents = thousands(overageMessages) * costPerThousandCents;
  const projectedOverageRevenueCents = thousands(overageMessages) * overagePricePerThousandCents;
  return {
    currentMonthlyMessages,
    projectedAdditionalMessages,
    includedMonthlyMessages,
    totalMonthlyMessages,
    overageMessages,
    costPerThousandCents,
    markupPercent,
    overagePricePerThousandCents,
    projectedCostCents,
    projectedOverageRevenueCents,
    projectedOverageGrossMarginCents: projectedOverageRevenueCents - overageCostCents,
    annualIncludedCapacityCostCents: thousands(includedMonthlyMessages * 12) * costPerThousandCents,
  };
}

export async function getManagedAiBillingOverview(userId: number, clientId: number, projectedAdditionalMessages = 0) {
  const db = await requireDb();
  await assertOwnedWhatsappClient(userId, clientId);
  const [policy, subscriptionRows, usage] = await Promise.all([
    getWhatsAppAiPolicy(userId, clientId),
    db.select({ status: saasSubscriptions.status, managedAiAddOn: saasSubscriptions.managedAiAddOn, managedAiMonthlyLimit: saasSubscriptions.managedAiMonthlyLimit, currentPeriodEnd: saasSubscriptions.currentPeriodEnd, planName: saasPlans.name, annualPriceCents: saasPlans.annualPriceCents, includedManagedAiMessages: saasPlans.includedManagedAiMessages, managedAiCostPerThousandCents: saasPlans.managedAiCostPerThousandCents, managedAiMarkupPercent: saasPlans.managedAiMarkupPercent, managedAiOveragePricePerThousandCents: saasPlans.managedAiOveragePricePerThousandCents }).from(saasSubscriptions).leftJoin(saasPlans, eq(saasPlans.id, saasSubscriptions.planId)).where(and(eq(saasSubscriptions.clientId, clientId), eq(saasSubscriptions.ownerUserId, userId))).limit(1),
    db.select({ id: whatsappAiRuns.id }).from(whatsappAiRuns).where(and(eq(whatsappAiRuns.clientId, clientId), eq(whatsappAiRuns.billingMode, "vertex_managed"), gte(whatsappAiRuns.createdAt, getCurrentMonthStart()))),
  ]);
  const subscription = subscriptionRows[0] ?? null;
  const quote = calculateManagedAiQuote({
    currentMonthlyMessages: usage.length,
    projectedAdditionalMessages,
    includedMonthlyMessages: policy?.monthlyManagedMessageLimit ?? (subscription?.managedAiMonthlyLimit || subscription?.includedManagedAiMessages || 0),
    costPerThousandCents: policy?.managedAiCostPerThousandCents ?? subscription?.managedAiCostPerThousandCents ?? 0,
    markupPercent: policy?.managedAiMarkupPercent ?? subscription?.managedAiMarkupPercent ?? 0,
    overagePricePerThousandCents: policy?.managedAiOveragePricePerThousandCents ?? subscription?.managedAiOveragePricePerThousandCents ?? 0,
  });
  return { aiAccessMode: policy?.aiAccessMode ?? "client_api_key", subscription: subscription ? { status: subscription.status, planName: subscription.planName, annualPriceCents: subscription.annualPriceCents, managedAiAddOn: Boolean(subscription.managedAiAddOn), currentPeriodEnd: subscription.currentPeriodEnd } : null, quote };
}

export async function getAnnualCheckoutContext(userId: number, clientId: number, planId: number) {
  const db = await requireDb();
  await assertOwnedWhatsappClient(userId, clientId);
  const [planRows, clientRows] = await Promise.all([
    db.select({ id: saasPlans.id, code: saasPlans.code, name: saasPlans.name, annualPriceCents: saasPlans.annualPriceCents, stripePriceId: saasPlans.stripePriceId }).from(saasPlans).where(and(eq(saasPlans.id, planId), eq(saasPlans.ownerUserId, userId), eq(saasPlans.isActive, 1))).limit(1),
    db.select({ id: clients.id, name: clients.name, contactEmail: clients.contactEmail }).from(clients).where(and(eq(clients.id, clientId), eq(clients.createdByUserId, userId))).limit(1),
  ]);
  if (!planRows[0]) throw new Error("Plano anual ativo não encontrado neste espaço de trabalho.");
  if (!clientRows[0]) throw new Error("Cliente não encontrado neste espaço de trabalho.");
  return { plan: planRows[0], client: clientRows[0] };
}

export async function listAnnualSaasPlans(userId: number) {
  const db = await requireDb();
  return db.select({ id: saasPlans.id, code: saasPlans.code, name: saasPlans.name, annualPriceCents: saasPlans.annualPriceCents, stripePriceId: saasPlans.stripePriceId, includedChannels: saasPlans.includedChannels, includedHumanSeats: saasPlans.includedHumanSeats, includedManagedAiMessages: saasPlans.includedManagedAiMessages, managedAiOveragePricePerThousandCents: saasPlans.managedAiOveragePricePerThousandCents, isActive: saasPlans.isActive }).from(saasPlans).where(eq(saasPlans.ownerUserId, userId)).orderBy(asc(saasPlans.name));
}

export async function upsertAnnualSaasPlan(userId: number, input: { id?: number; code: string; name: string; annualPriceCents: number; stripePriceId?: string | null; includedChannels: number; includedHumanSeats: number; includedManagedAiMessages: number; managedAiCostPerThousandCents: number; managedAiMarkupPercent: number; managedAiOveragePricePerThousandCents: number; isActive: boolean }) {
  const db = await requireDb();
  const values = { code: input.code, name: input.name, annualPriceCents: input.annualPriceCents, stripePriceId: input.stripePriceId || null, includedChannels: input.includedChannels, includedHumanSeats: input.includedHumanSeats, includedManagedAiMessages: input.includedManagedAiMessages, managedAiCostPerThousandCents: input.managedAiCostPerThousandCents, managedAiMarkupPercent: input.managedAiMarkupPercent, managedAiOveragePricePerThousandCents: input.managedAiOveragePricePerThousandCents, isActive: input.isActive ? 1 : 0 };
  if (input.id) {
    const existing = await db.select({ id: saasPlans.id }).from(saasPlans).where(and(eq(saasPlans.id, input.id), eq(saasPlans.ownerUserId, userId))).limit(1);
    if (!existing[0]) throw new Error("Plano anual não encontrado neste espaço de trabalho.");
    await db.update(saasPlans).set(values).where(eq(saasPlans.id, existing[0].id));
    return existing[0].id;
  }
  const result = await db.insert(saasPlans).values({ ownerUserId: userId, ...values });
  return Number(result[0].insertId);
}

/** Mantém identificadores Stripe e um cache operacional de entitlement; nenhum dado de cartão, fatura ou payload é armazenado. */
export async function upsertStripeSubscriptionReference(input: { ownerUserId: number; clientId: number; planId: number; stripeCustomerId: string | null; externalSubscriptionId: string; stripePriceId: string | null; status: "trialing" | "active" | "past_due" | "paused" | "canceled" | "expired" }) {
  const db = await requireDb();
  await assertOwnedWhatsappClient(input.ownerUserId, input.clientId);
  const plan = await db.select({ id: saasPlans.id }).from(saasPlans).where(and(eq(saasPlans.id, input.planId), eq(saasPlans.ownerUserId, input.ownerUserId))).limit(1);
  if (!plan[0]) throw new Error("Plano anual não pertence a este espaço de trabalho.");
  const values = { planId: input.planId, billingProvider: "stripe" as const, stripeCustomerId: input.stripeCustomerId, externalSubscriptionId: input.externalSubscriptionId, stripePriceId: input.stripePriceId, status: input.status };
  const existing = await db.select({ id: saasSubscriptions.id }).from(saasSubscriptions).where(and(eq(saasSubscriptions.clientId, input.clientId), eq(saasSubscriptions.ownerUserId, input.ownerUserId))).limit(1);
  if (existing[0]) await db.update(saasSubscriptions).set(values).where(eq(saasSubscriptions.id, existing[0].id));
  else await db.insert(saasSubscriptions).values({ clientId: input.clientId, ownerUserId: input.ownerUserId, ...values });
  await db.insert(whatsappAuditLogs).values({ clientId: input.clientId, actorUserId: input.ownerUserId, action: "saas.stripe_subscription_synced", entityType: "saas_subscription", entityId: existing[0]?.id ?? null, detailsJson: JSON.stringify({ planId: input.planId, status: input.status, event: "stripe_sync" }) });
}

export async function listWhatsAppAutomationRules(userId: number, clientId: number) {
  const db = await requireDb();
  await assertOwnedWhatsappClient(userId, clientId);
  return db.select().from(whatsappAutomationRules).where(and(eq(whatsappAutomationRules.clientId, clientId), eq(whatsappAutomationRules.ownerUserId, userId))).orderBy(asc(whatsappAutomationRules.priority), asc(whatsappAutomationRules.name));
}

export async function upsertWhatsAppAutomationRule(userId: number, input: { id?: number; clientId: number; channelId?: number | null; name: string; triggerType: "inbound_message" | "keyword" | "outside_business_hours" | "handoff_requested"; triggerConfigJson?: string | null; actionType: "ai_reply" | "draft_for_approval" | "handoff_human" | "tag_conversation"; actionConfigJson?: string | null; requiresApproval: boolean; priority: number; status: "draft" | "active" | "paused" }) {
  const db = await requireDb();
  await assertOwnedWhatsappClient(userId, input.clientId);
  if (input.channelId) {
    const channel = await db.select({ id: whatsappChannels.id }).from(whatsappChannels).where(and(eq(whatsappChannels.id, input.channelId), eq(whatsappChannels.clientId, input.clientId), eq(whatsappChannels.ownerUserId, userId))).limit(1);
    if (!channel[0]) throw new Error("O canal selecionado não pertence a este cliente.");
  }
  const values = { clientId: input.clientId, ownerUserId: userId, channelId: input.channelId ?? null, name: input.name, triggerType: input.triggerType, triggerConfigJson: input.triggerConfigJson || null, actionType: input.actionType, actionConfigJson: input.actionConfigJson || null, requiresApproval: input.requiresApproval ? 1 : 0, priority: input.priority, status: input.status };
  if (input.id) {
    const existing = await db.select({ id: whatsappAutomationRules.id }).from(whatsappAutomationRules).where(and(eq(whatsappAutomationRules.id, input.id), eq(whatsappAutomationRules.clientId, input.clientId), eq(whatsappAutomationRules.ownerUserId, userId))).limit(1);
    if (!existing[0]) throw new Error("Regra de automação não encontrada neste cliente.");
    await db.update(whatsappAutomationRules).set(values).where(eq(whatsappAutomationRules.id, input.id));
    return input.id;
  }
  const [created] = await db.insert(whatsappAutomationRules).values(values).$returningId();
  return created.id;
}

export async function getWhatsAppChannelSecret(channelId: number) {
  const db = await requireDb();
  const rows = await db.select().from(whatsappChannels).where(eq(whatsappChannels.id, channelId)).limit(1);
  return rows[0];
}

export async function recordWhatsAppWebhookEvent(input: {
  channelId: number | null;
  provider: "meta_cloud" | "twilio";
  externalEventId: string;
  payloadJson: string;
}) {
  const db = await requireDb();
  const existing = await db
    .select({ id: whatsappWebhookEvents.id })
    .from(whatsappWebhookEvents)
    .where(and(eq(whatsappWebhookEvents.provider, input.provider), eq(whatsappWebhookEvents.externalEventId, input.externalEventId)))
    .limit(1);
  if (existing[0]) return { id: existing[0].id, duplicate: true };
  try {
    const [created] = await db.insert(whatsappWebhookEvents).values(input).$returningId();
    return { id: created.id, duplicate: false };
  } catch (error) {
    const duplicate = await db
      .select({ id: whatsappWebhookEvents.id })
      .from(whatsappWebhookEvents)
      .where(and(eq(whatsappWebhookEvents.provider, input.provider), eq(whatsappWebhookEvents.externalEventId, input.externalEventId)))
      .limit(1);
    if (duplicate[0]) return { id: duplicate[0].id, duplicate: true };
    throw error;
  }
}

export async function markWhatsAppWebhookEvent(eventId: number, processingStatus: "processed" | "ignored" | "failed", errorMessage?: string | null) {
  const db = await requireDb();
  await db.update(whatsappWebhookEvents).set({ processingStatus, errorMessage: errorMessage ?? null, processedAt: new Date() }).where(eq(whatsappWebhookEvents.id, eventId));
}

export async function ingestInboundWhatsAppMessage(input: {
  channelId: number;
  clientId: number;
  sender: string;
  providerMessageId: string;
  body: string | null;
  occurredAt: Date;
  rawPayloadJson: string;
}) {
  const db = await requireDb();
  let contact = (await db.select().from(whatsappContacts).where(and(eq(whatsappContacts.clientId, input.clientId), eq(whatsappContacts.phoneE164, input.sender))).limit(1))[0];
  if (!contact) {
    const [created] = await db.insert(whatsappContacts).values({ clientId: input.clientId, phoneE164: input.sender, optInStatus: "unknown", lastInboundAt: input.occurredAt }).$returningId();
    contact = (await db.select().from(whatsappContacts).where(eq(whatsappContacts.id, created.id)).limit(1))[0];
  } else {
    await db.update(whatsappContacts).set({ lastInboundAt: input.occurredAt }).where(eq(whatsappContacts.id, contact.id));
  }
  let conversation = (await db.select().from(whatsappConversations).where(and(eq(whatsappConversations.channelId, input.channelId), eq(whatsappConversations.contactId, contact.id))).limit(1))[0];
  if (!conversation) {
    const [created] = await db.insert(whatsappConversations).values({ clientId: input.clientId, channelId: input.channelId, contactId: contact.id, status: "ai_active", lastMessagePreview: input.body?.slice(0, 300) ?? null, lastMessageAt: input.occurredAt, serviceWindowExpiresAt: new Date(input.occurredAt.getTime() + 24 * 60 * 60 * 1000) }).$returningId();
    conversation = (await db.select().from(whatsappConversations).where(eq(whatsappConversations.id, created.id)).limit(1))[0];
  } else {
    await db.update(whatsappConversations).set({ lastMessagePreview: input.body?.slice(0, 300) ?? null, lastMessageAt: input.occurredAt, serviceWindowExpiresAt: new Date(input.occurredAt.getTime() + 24 * 60 * 60 * 1000) }).where(eq(whatsappConversations.id, conversation.id));
  }
  const [message] = await db.insert(whatsappMessages).values({ clientId: input.clientId, channelId: input.channelId, conversationId: conversation.id, providerMessageId: input.providerMessageId, direction: "inbound", authorType: "contact", body: input.body, deliveryStatus: "received", providerPayloadJson: input.rawPayloadJson, occurredAt: input.occurredAt }).$returningId();
  await Promise.all([
    db.update(whatsappChannels).set({ lastInboundAt: input.occurredAt }).where(eq(whatsappChannels.id, input.channelId)),
    db.insert(whatsappAuditLogs).values({ clientId: input.clientId, action: "whatsapp.inbound_received", entityType: "whatsapp_message", entityId: message.id, detailsJson: JSON.stringify({ channelId: input.channelId, providerMessageId: input.providerMessageId }) }),
  ]);
  return { contactId: contact.id, conversationId: conversation.id, messageId: message.id };
}

type AutomationConfig = {
  keywords?: unknown;
  keyword?: unknown;
  draftBody?: unknown;
  body?: unknown;
  message?: unknown;
  start?: unknown;
  end?: unknown;
  days?: unknown;
  weekdays?: unknown;
  timeZone?: unknown;
};

function parseAutomationConfig(value: string | null | undefined): AutomationConfig {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as AutomationConfig : {};
  } catch {
    return {};
  }
}

function configStrings(...values: unknown[]) {
  return values.flatMap(value => Array.isArray(value) ? value : [value]).filter((value): value is string => typeof value === "string" && value.trim().length > 0).map(value => value.trim().toLocaleLowerCase());
}

function matchesConfiguredKeyword(body: string | null, ...configs: AutomationConfig[]) {
  if (!body) return false;
  const keywords = configs.flatMap(config => configStrings(config.keywords, config.keyword));
  if (!keywords.length) return false;
  const normalizedBody = body.toLocaleLowerCase();
  return keywords.some(keyword => normalizedBody.includes(keyword));
}

function parseClock(value: unknown) {
  if (typeof value !== "string" || !/^\d{1,2}:\d{2}$/.test(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function getBusinessClock(date: Date, timeZone: unknown) {
  const zone = typeof timeZone === "string" && timeZone ? timeZone : "UTC";
  try {
    const values = new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
    const valueFor = (type: string) => values.find(part => part.type === type)?.value;
    const weekday = ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[valueFor("weekday") ?? ""];
    const hour = Number(valueFor("hour"));
    const minute = Number(valueFor("minute"));
    if (Number.isFinite(weekday) && Number.isFinite(hour) && Number.isFinite(minute)) return { weekday, minutes: hour * 60 + minute };
  } catch {
    // Uma zona inválida não pode tornar a automação mais permissiva; usamos UTC como referência estável.
  }
  return { weekday: date.getUTCDay(), minutes: date.getUTCHours() * 60 + date.getUTCMinutes() };
}

function isOutsideConfiguredBusinessHours(date: Date, config: AutomationConfig) {
  const start = parseClock(config.start);
  const end = parseClock(config.end);
  if (start === null || end === null) return false;
  const { weekday, minutes } = getBusinessClock(date, config.timeZone);
  const configuredDays = configStrings(config.days, config.weekdays).map(value => Number(value)).filter(value => Number.isInteger(value) && value >= 0 && value <= 6);
  const businessDays = configuredDays.length ? configuredDays : [1, 2, 3, 4, 5];
  if (!businessDays.includes(weekday)) return true;
  const isWithinHours = start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
  return !isWithinHours;
}

function draftBodyForAutomation(ruleName: string, config: AutomationConfig) {
  const configured = [config.draftBody, config.body, config.message].find((value): value is string => typeof value === "string" && value.trim().length > 0);
  return configured?.trim() ?? `Rascunho interno criado pela automação “${ruleName}”. Revisão humana obrigatória antes de qualquer envio.`;
}

async function getExistingAutomationExecution(sourceMessageId: number, automationRuleId: number) {
  const db = await requireDb();
  return (await db.select().from(whatsappAutomationExecutions).where(and(eq(whatsappAutomationExecutions.sourceMessageId, sourceMessageId), eq(whatsappAutomationExecutions.automationRuleId, automationRuleId))).limit(1))[0];
}

async function createAutomationExecution(input: { clientId: number; channelId: number; conversationId: number; sourceMessageId: number; automationRuleId: number }) {
  const db = await requireDb();
  const existing = await getExistingAutomationExecution(input.sourceMessageId, input.automationRuleId);
  if (existing) return { id: existing.id, duplicate: true };
  try {
    const [created] = await db.insert(whatsappAutomationExecutions).values({ ...input, status: "queued" }).$returningId();
    return { id: created.id, duplicate: false };
  } catch (error) {
    const duplicate = await getExistingAutomationExecution(input.sourceMessageId, input.automationRuleId);
    if (duplicate) return { id: duplicate.id, duplicate: true };
    throw error;
  }
}

async function finalizeAutomationExecution(executionId: number, status: "executed" | "skipped" | "blocked" | "failed", decisionReason: string, output?: Record<string, unknown>) {
  const db = await requireDb();
  await db.update(whatsappAutomationExecutions).set({ status, decisionReason, outputJson: output ? JSON.stringify(output) : null, executedAt: new Date() }).where(eq(whatsappAutomationExecutions.id, executionId));
}

/**
 * Avalia regras ativas para uma mensagem recebida. A execução é idempotente por
 * mensagem e regra e nunca envia mensagens a provedores externos: respostas são
 * salvas apenas como rascunho local para revisão humana.
 */
export async function evaluateWhatsAppAutomationRules(channelId: number, conversationId: number, messageId: number, clientId: number) {
  const db = await requireDb();
  const [message, conversation, contact] = await Promise.all([
    db.select({ id: whatsappMessages.id, body: whatsappMessages.body, direction: whatsappMessages.direction, occurredAt: whatsappMessages.occurredAt }).from(whatsappMessages).where(and(eq(whatsappMessages.id, messageId), eq(whatsappMessages.clientId, clientId), eq(whatsappMessages.channelId, channelId), eq(whatsappMessages.conversationId, conversationId))).limit(1),
    db.select({ id: whatsappConversations.id, status: whatsappConversations.status, contactId: whatsappConversations.contactId }).from(whatsappConversations).where(and(eq(whatsappConversations.id, conversationId), eq(whatsappConversations.clientId, clientId), eq(whatsappConversations.channelId, channelId))).limit(1),
    db.select({ id: whatsappContacts.id, optInStatus: whatsappContacts.optInStatus }).from(whatsappContacts).innerJoin(whatsappConversations, eq(whatsappConversations.contactId, whatsappContacts.id)).where(and(eq(whatsappConversations.id, conversationId), eq(whatsappContacts.clientId, clientId))).limit(1),
  ]);
  if (!message[0] || message[0].direction !== "inbound" || !conversation[0] || !contact[0]) throw new Error("A mensagem recebida não pertence ao contexto de automação informado.");

  const [policy, rules] = await Promise.all([
    db.select().from(whatsappAiPolicies).where(eq(whatsappAiPolicies.clientId, clientId)).limit(1),
    db.select().from(whatsappAutomationRules).where(and(eq(whatsappAutomationRules.clientId, clientId), eq(whatsappAutomationRules.status, "active"), or(eq(whatsappAutomationRules.channelId, channelId), isNull(whatsappAutomationRules.channelId)))).orderBy(asc(whatsappAutomationRules.priority), asc(whatsappAutomationRules.id)),
  ]);

  const policyConfig = parseAutomationConfig(policy[0]?.handoffKeywordsJson);
  const businessHoursConfig = parseAutomationConfig(policy[0]?.businessHoursJson);
  const results: Array<{ ruleId: number; executionId?: number; status: "executed" | "skipped" | "blocked"; reason: string }> = [];

  for (const rule of rules) {
    const triggerConfig = parseAutomationConfig(rule.triggerConfigJson);
    const triggerMatches = rule.triggerType === "inbound_message"
      || (rule.triggerType === "keyword" && matchesConfiguredKeyword(message[0].body, triggerConfig))
      || (rule.triggerType === "outside_business_hours" && isOutsideConfiguredBusinessHours(message[0].occurredAt, { ...businessHoursConfig, ...triggerConfig }))
      || (rule.triggerType === "handoff_requested" && matchesConfiguredKeyword(message[0].body, triggerConfig, policyConfig));
    if (!triggerMatches) continue;

    const execution = await createAutomationExecution({ clientId, channelId, conversationId, sourceMessageId: messageId, automationRuleId: rule.id });
    if (execution.duplicate) {
      results.push({ ruleId: rule.id, executionId: execution.id, status: "skipped", reason: "Execução idempotente já registrada para esta mensagem e regra." });
      continue;
    }

    const actionConfig = parseAutomationConfig(rule.actionConfigJson);
    if (rule.actionType === "handoff_human" || rule.triggerType === "handoff_requested" || policy[0]?.workflowMode === "handoff_only") {
      await db.update(whatsappConversations).set({ status: "waiting_human" }).where(eq(whatsappConversations.id, conversationId));
      const reason = rule.triggerType === "handoff_requested" || policy[0]?.workflowMode === "handoff_only" ? "Conversa encaminhada para atendimento humano pela política de handoff." : "Conversa encaminhada para atendimento humano pela automação.";
      await db.insert(whatsappAuditLogs).values({ clientId, action: "whatsapp.automation_handoff", entityType: "whatsapp_conversation", entityId: conversationId, detailsJson: JSON.stringify({ automationRuleId: rule.id, sourceMessageId: messageId, externalDelivery: "disabled" }) });
      await finalizeAutomationExecution(execution.id, "executed", reason, { outcome: "handoff", externalDelivery: "disabled" });
      results.push({ ruleId: rule.id, executionId: execution.id, status: "executed", reason });
      continue;
    }

    if (rule.actionType === "ai_reply") {
      const activeConnection = policy[0]?.aiAccessMode === "client_api_key" && policy[0].providerConnectionId
        ? (await db.select({ id: clientAiConnections.id, encryptedApiKey: clientAiConnections.encryptedApiKey, status: clientAiConnections.status, lastTestedAt: clientAiConnections.lastTestedAt }).from(clientAiConnections).where(and(eq(clientAiConnections.id, policy[0].providerConnectionId), eq(clientAiConnections.clientId, clientId))).limit(1))[0]
        : null;
      const managedSubscription = policy[0]?.aiAccessMode === "vertex_managed"
        ? (await db.select({ id: saasSubscriptions.id }).from(saasSubscriptions).where(and(eq(saasSubscriptions.clientId, clientId), eq(saasSubscriptions.managedAiAddOn, 1), or(eq(saasSubscriptions.status, "active"), eq(saasSubscriptions.status, "trialing")))).limit(1))[0]
        : null;
      const missingCredential = policy[0]?.aiAccessMode === "client_api_key" ? !activeConnection || activeConnection.status !== "active" || !activeConnection.encryptedApiKey || !activeConnection.lastTestedAt : !managedSubscription;
      if (missingCredential || contact[0].optInStatus !== "opted_in") {
        const reason = missingCredential ? "Ação bloqueada: não há credencial de IA validada ou assinatura VERTEX ativa para o cliente." : "Ação bloqueada: o contato ainda não possui consentimento explícito para atendimento automatizado.";
        await finalizeAutomationExecution(execution.id, "blocked", reason, { missingCredential, optInStatus: contact[0].optInStatus, externalDelivery: "disabled" });
        await db.insert(whatsappAuditLogs).values({ clientId, action: "whatsapp.automation_blocked", entityType: "whatsapp_automation_execution", entityId: execution.id, detailsJson: JSON.stringify({ automationRuleId: rule.id, sourceMessageId: messageId, reason, externalDelivery: "disabled" }) });
        results.push({ ruleId: rule.id, executionId: execution.id, status: "blocked", reason });
        continue;
      }
    }

    if (rule.actionType === "draft_for_approval" || rule.actionType === "ai_reply") {
      const [draft] = await db.insert(whatsappMessages).values({ clientId, channelId, conversationId, direction: "outbound", authorType: "ai", body: draftBodyForAutomation(rule.name, actionConfig), deliveryStatus: "queued" }).$returningId();
      const reason = "Rascunho interno criado para revisão humana; a entrega externa permanece desabilitada.";
      await db.insert(whatsappAuditLogs).values({ clientId, action: "whatsapp.automation_draft_created", entityType: "whatsapp_message", entityId: draft.id, detailsJson: JSON.stringify({ automationRuleId: rule.id, sourceMessageId: messageId, externalDelivery: "disabled" }) });
      await finalizeAutomationExecution(execution.id, "executed", reason, { outcome: "draft", draftMessageId: draft.id, externalDelivery: "disabled" });
      results.push({ ruleId: rule.id, executionId: execution.id, status: "executed", reason });
      continue;
    }

    const reason = "Regra registrada sem ação externa: a marcação de conversa exige uma taxonomia própria antes de ser aplicada.";
    await finalizeAutomationExecution(execution.id, "skipped", reason, { outcome: "tag_not_configured", externalDelivery: "disabled" });
    results.push({ ruleId: rule.id, executionId: execution.id, status: "skipped", reason });
  }

  return results;
}

async function assertOwnedWhatsAppConversation(userId: number, clientId: number, conversationId: number) {
  await assertOwnedWhatsappClient(userId, clientId);
  const db = await requireDb();
  const rows = await db.select({ id: whatsappConversations.id, channelId: whatsappConversations.channelId, assignedOperatorId: whatsappConversations.assignedOperatorId }).from(whatsappConversations).innerJoin(whatsappChannels, eq(whatsappChannels.id, whatsappConversations.channelId)).where(and(eq(whatsappConversations.id, conversationId), eq(whatsappConversations.clientId, clientId), eq(whatsappChannels.ownerUserId, userId))).limit(1);
  if (!rows[0]) throw new Error("A conversa solicitada não pertence ao cliente atual.");
  return rows[0];
}

export async function listWhatsAppInbox(userId: number, clientId: number) {
  await assertOwnedWhatsappClient(userId, clientId);
  const db = await requireDb();
  return db.select({
    id: whatsappConversations.id,
    channelId: whatsappConversations.channelId,
    contactId: whatsappConversations.contactId,
    assignedOperatorId: whatsappConversations.assignedOperatorId,
    status: whatsappConversations.status,
    lastMessagePreview: whatsappConversations.lastMessagePreview,
    lastMessageAt: whatsappConversations.lastMessageAt,
    serviceWindowExpiresAt: whatsappConversations.serviceWindowExpiresAt,
    updatedAt: whatsappConversations.updatedAt,
    contactName: whatsappContacts.displayName,
    contactPhone: whatsappContacts.phoneE164,
    optInStatus: whatsappContacts.optInStatus,
    channelLabel: whatsappChannels.label,
    channelProvider: whatsappChannels.provider,
  }).from(whatsappConversations).innerJoin(whatsappContacts, eq(whatsappContacts.id, whatsappConversations.contactId)).innerJoin(whatsappChannels, eq(whatsappChannels.id, whatsappConversations.channelId)).where(and(eq(whatsappConversations.clientId, clientId), eq(whatsappChannels.ownerUserId, userId))).orderBy(desc(whatsappConversations.lastMessageAt), desc(whatsappConversations.updatedAt));
}

export async function listWhatsAppConversationMessages(userId: number, clientId: number, conversationId: number) {
  await assertOwnedWhatsAppConversation(userId, clientId, conversationId);
  const db = await requireDb();
  return db.select({ id: whatsappMessages.id, direction: whatsappMessages.direction, authorType: whatsappMessages.authorType, body: whatsappMessages.body, mediaUrl: whatsappMessages.mediaUrl, templateName: whatsappMessages.templateName, deliveryStatus: whatsappMessages.deliveryStatus, occurredAt: whatsappMessages.occurredAt, providerMessageId: whatsappMessages.providerMessageId }).from(whatsappMessages).where(and(eq(whatsappMessages.clientId, clientId), eq(whatsappMessages.conversationId, conversationId))).orderBy(asc(whatsappMessages.occurredAt));
}

export async function activateWhatsAppHumanHandoff(userId: number, clientId: number, conversationId: number) {
  await assertOwnedWhatsAppConversation(userId, clientId, conversationId);
  const db = await requireDb();
  await db.update(whatsappConversations).set({ status: "human_active" }).where(and(eq(whatsappConversations.id, conversationId), eq(whatsappConversations.clientId, clientId)));
  await db.insert(whatsappAuditLogs).values({ clientId, actorUserId: userId, action: "whatsapp.handoff_claimed", entityType: "whatsapp_conversation", entityId: conversationId, detailsJson: JSON.stringify({ delivery: "human_review" }) });
  return conversationId;
}

export async function createWhatsAppDraft(userId: number, input: { clientId: number; conversationId: number; body: string }) {
  const conversation = await assertOwnedWhatsAppConversation(userId, input.clientId, input.conversationId);
  const db = await requireDb();
  const [created] = await db.insert(whatsappMessages).values({ clientId: input.clientId, channelId: conversation.channelId, conversationId: input.conversationId, direction: "outbound", authorType: "human", body: input.body, deliveryStatus: "queued" }).$returningId();
  await db.insert(whatsappAuditLogs).values({ clientId: input.clientId, actorUserId: userId, action: "whatsapp.draft_created", entityType: "whatsapp_message", entityId: created.id, detailsJson: JSON.stringify({ externalDelivery: "disabled" }) });
  return created.id;
}

export async function listClientPortalMembers(ownerUserId: number, clientId: number) {
  await assertOwnedWhatsappClient(ownerUserId, clientId);
  const db = await requireDb();
  return db.select({ id: clientPortalMembers.id, userId: clientPortalMembers.userId, name: users.name, email: users.email, role: clientPortalMembers.role, status: clientPortalMembers.status, createdAt: clientPortalMembers.createdAt, updatedAt: clientPortalMembers.updatedAt }).from(clientPortalMembers).innerJoin(users, eq(users.id, clientPortalMembers.userId)).where(eq(clientPortalMembers.clientId, clientId)).orderBy(asc(users.name));
}

export async function grantClientPortalMember(ownerUserId: number, input: { clientId: number; email: string; role: "client_admin" | "manager" | "agent" | "viewer" }) {
  await assertOwnedWhatsappClient(ownerUserId, input.clientId);
  const db = await requireDb();
  const targetUser = (await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1))[0];
  if (!targetUser) throw new Error("A pessoa precisa acessar a VERTEX ao menos uma vez antes de receber acesso ao portal.");
  await db.insert(clientPortalMembers).values({ clientId: input.clientId, userId: targetUser.id, invitedByUserId: ownerUserId, role: input.role, status: "active" }).onDuplicateKeyUpdate({ set: { role: input.role, status: "active", invitedByUserId: ownerUserId } });
  await db.insert(whatsappAuditLogs).values({ clientId: input.clientId, actorUserId: ownerUserId, action: "portal.member_granted", entityType: "client_portal_member", detailsJson: JSON.stringify({ userId: targetUser.id, role: input.role }) });
  return targetUser.id;
}

export async function updateClientPortalMemberStatus(ownerUserId: number, input: { clientId: number; memberId: number; status: "active" | "suspended" }) {
  await assertOwnedWhatsappClient(ownerUserId, input.clientId);
  const db = await requireDb();
  const current = (await db.select({ id: clientPortalMembers.id }).from(clientPortalMembers).where(and(eq(clientPortalMembers.id, input.memberId), eq(clientPortalMembers.clientId, input.clientId))).limit(1))[0];
  if (!current) throw new Error("A associação de portal não pertence ao cliente atual.");
  await db.update(clientPortalMembers).set({ status: input.status }).where(eq(clientPortalMembers.id, input.memberId));
  await db.insert(whatsappAuditLogs).values({ clientId: input.clientId, actorUserId: ownerUserId, action: "portal.member_status_updated", entityType: "client_portal_member", entityId: input.memberId, detailsJson: JSON.stringify({ status: input.status }) });
  return input.memberId;
}

async function getActiveClientPortalMembership(openId: string, clientId: number) {
  const db = await requireDb();
  const membership = (await db.select({ memberId: clientPortalMembers.id, role: clientPortalMembers.role, clientId: clientPortalMembers.clientId, clientName: clients.name, clientSegment: clients.segment }).from(clientPortalMembers).innerJoin(users, eq(users.id, clientPortalMembers.userId)).innerJoin(clients, eq(clients.id, clientPortalMembers.clientId)).where(and(eq(users.openId, openId), eq(clientPortalMembers.clientId, clientId), eq(clientPortalMembers.status, "active"))).limit(1))[0];
  if (!membership) throw new Error("Você não possui acesso ativo a este espaço de cliente.");
  return membership;
}

export async function listClientPortalWorkspaces(openId: string) {
  const db = await requireDb();
  return db.select({ clientId: clients.id, name: clients.name, segment: clients.segment, role: clientPortalMembers.role }).from(clientPortalMembers).innerJoin(users, eq(users.id, clientPortalMembers.userId)).innerJoin(clients, eq(clients.id, clientPortalMembers.clientId)).where(and(eq(users.openId, openId), eq(clientPortalMembers.status, "active"))).orderBy(asc(clients.name));
}

export async function getClientPortalOverview(openId: string, clientId: number) {
  const membership = await getActiveClientPortalMembership(openId, clientId);
  const db = await requireDb();
  const [channels, policyRows, subscriptionRows, conversations] = await Promise.all([
    db.select({ id: whatsappChannels.id, label: whatsappChannels.label, provider: whatsappChannels.provider, status: whatsappChannels.status, displayPhoneNumber: whatsappChannels.displayPhoneNumber, verifiedAt: whatsappChannels.verifiedAt, lastInboundAt: whatsappChannels.lastInboundAt, lastOutboundAt: whatsappChannels.lastOutboundAt }).from(whatsappChannels).where(eq(whatsappChannels.clientId, clientId)).orderBy(asc(whatsappChannels.label)),
    db.select({ aiAccessMode: whatsappAiPolicies.aiAccessMode, workflowMode: whatsappAiPolicies.workflowMode, monthlyManagedMessageLimit: whatsappAiPolicies.monthlyManagedMessageLimit, updatedAt: whatsappAiPolicies.updatedAt }).from(whatsappAiPolicies).where(eq(whatsappAiPolicies.clientId, clientId)).limit(1),
    db.select({ status: saasSubscriptions.status, interval: saasSubscriptions.interval, managedAiAddOn: saasSubscriptions.managedAiAddOn, managedAiMonthlyLimit: saasSubscriptions.managedAiMonthlyLimit, currentPeriodEnd: saasSubscriptions.currentPeriodEnd, planName: saasPlans.name, annualPriceCents: saasPlans.annualPriceCents }).from(saasSubscriptions).leftJoin(saasPlans, eq(saasPlans.id, saasSubscriptions.planId)).where(eq(saasSubscriptions.clientId, clientId)).limit(1),
    db.select({ id: whatsappConversations.id, status: whatsappConversations.status, lastMessagePreview: whatsappConversations.lastMessagePreview, lastMessageAt: whatsappConversations.lastMessageAt, channelLabel: whatsappChannels.label }).from(whatsappConversations).innerJoin(whatsappChannels, eq(whatsappChannels.id, whatsappConversations.channelId)).where(eq(whatsappConversations.clientId, clientId)).orderBy(desc(whatsappConversations.lastMessageAt)).limit(20),
  ]);
  return { client: { id: membership.clientId, name: membership.clientName, segment: membership.clientSegment }, membership: { role: membership.role }, channels, policy: policyRows[0] ?? null, subscription: subscriptionRows[0] ?? null, conversations };
}

export async function listClientPortalConversationMessages(openId: string, input: { clientId: number; conversationId: number }) {
  await getActiveClientPortalMembership(openId, input.clientId);
  const db = await requireDb();
  const exists = (await db.select({ id: whatsappConversations.id }).from(whatsappConversations).where(and(eq(whatsappConversations.id, input.conversationId), eq(whatsappConversations.clientId, input.clientId))).limit(1))[0];
  if (!exists) throw new Error("A conversa solicitada não pertence ao seu espaço de cliente.");
  const messages = await db.select({ id: whatsappMessages.id, direction: whatsappMessages.direction, authorType: whatsappMessages.authorType, body: whatsappMessages.body, mediaUrl: whatsappMessages.mediaUrl, templateName: whatsappMessages.templateName, deliveryStatus: whatsappMessages.deliveryStatus, occurredAt: whatsappMessages.occurredAt }).from(whatsappMessages).where(and(eq(whatsappMessages.clientId, input.clientId), eq(whatsappMessages.conversationId, input.conversationId))).orderBy(asc(whatsappMessages.occurredAt));
  return messages.filter(message => message.deliveryStatus !== "queued");
}

export async function listAdCampaigns(userId: number, clientId?: number) {
  const db = await requireDb();
  const conditions = [eq(adCampaigns.ownerUserId, userId)];
  if (clientId) conditions.push(eq(adCampaigns.clientId, clientId));
  return db
    .select({
      campaign: adCampaigns,
      client: clients,
      connection: {
        id: clientAiConnections.id,
        label: clientAiConnections.label,
        provider: clientAiConnections.provider,
        defaultModel: clientAiConnections.defaultModel,
        status: clientAiConnections.status,
      },
    })
    .from(adCampaigns)
    .innerJoin(clients, eq(adCampaigns.clientId, clients.id))
    .leftJoin(clientAiConnections, eq(adCampaigns.providerConnectionId, clientAiConnections.id))
    .where(and(...conditions))
    .orderBy(desc(adCampaigns.updatedAt));
}

export async function getAdCampaign(userId: number, campaignId: number) {
  const db = await requireDb();
  const rows = await db
    .select({ campaign: adCampaigns, client: clients, connection: clientAiConnections })
    .from(adCampaigns)
    .innerJoin(clients, eq(adCampaigns.clientId, clients.id))
    .leftJoin(clientAiConnections, eq(adCampaigns.providerConnectionId, clientAiConnections.id))
    .where(and(eq(adCampaigns.id, campaignId), eq(adCampaigns.ownerUserId, userId)))
    .limit(1);
  return rows[0];
}

export async function createAdCampaign(userId: number, input: {
  clientId: number;
  providerConnectionId?: number | null;
  name: string;
  mode: CampaignMode;
  objective: string;
  briefingJson: string;
}) {
  const db = await requireDb();
  const ownedClient = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, input.clientId), eq(clients.createdByUserId, userId))).limit(1);
  if (!ownedClient[0]) throw new Error("Cliente inválido para este espaço de trabalho");
  if (input.providerConnectionId) {
    const connection = await getClientAiConnectionSecret(userId, input.providerConnectionId);
    if (!connection || connection.clientId !== input.clientId) throw new Error("Provedor inválido para este cliente");
  }
  const [created] = await db.insert(adCampaigns).values({ ...input, ownerUserId: userId }).$returningId();
  return created.id;
}

export async function updateAdCampaignStatus(userId: number, campaignId: number, status: CampaignStatus) {
  const db = await requireDb();
  await db.update(adCampaigns).set({ status }).where(and(eq(adCampaigns.id, campaignId), eq(adCampaigns.ownerUserId, userId)));
}

export async function updateAdCampaignProvider(userId: number, campaignId: number, providerConnectionId: number | null) {
  const db = await requireDb();
  const campaigns = await db
    .select({ id: adCampaigns.id, clientId: adCampaigns.clientId })
    .from(adCampaigns)
    .where(and(eq(adCampaigns.id, campaignId), eq(adCampaigns.ownerUserId, userId)))
    .limit(1);
  const campaign = campaigns[0];
  if (!campaign) throw new Error("Campanha não encontrada");
  if (providerConnectionId) {
    const connection = await getClientAiConnectionSecret(userId, providerConnectionId);
    if (!connection || connection.clientId !== campaign.clientId) throw new Error("O provedor selecionado não está ativo para este cliente");
  }
  await db.update(adCampaigns).set({ providerConnectionId }).where(and(eq(adCampaigns.id, campaignId), eq(adCampaigns.ownerUserId, userId)));
  return campaignId;
}

export async function createAiGeneration(userId: number, input: {
  campaignId: number;
  kind: GenerationKind;
  provider: string;
  model: string;
  promptSnapshot: string;
}) {
  const db = await requireDb();
  const [created] = await db.insert(aiGenerations).values({ ...input, ownerUserId: userId, status: "running" }).$returningId();
  return created.id;
}

export async function completeAiGeneration(userId: number, generationId: number, input: { status: GenerationStatus; outputJson?: string | null; errorMessage?: string | null; inputTokens?: number | null; outputTokens?: number | null; totalTokens?: number | null; requestDurationMs?: number | null }) {
  const db = await requireDb();
  await db.update(aiGenerations).set({ ...input, completedAt: new Date() }).where(and(eq(aiGenerations.id, generationId), eq(aiGenerations.ownerUserId, userId)));
}

export function getCurrentMonthStart(referenceDate = new Date()) {
  return new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
}

export async function listClientApiUsage(userId: number, periodDays = 30) {
  const db = await requireDb();
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - periodDays);
  const monthStart = getCurrentMonthStart();
  const [ownedClients, generations] = await Promise.all([
    db.select({ id: clients.id, name: clients.name, monthlyApiCallLimit: clients.monthlyApiCallLimit }).from(clients).where(eq(clients.createdByUserId, userId)).orderBy(asc(clients.name)),
    db.select({ clientId: adCampaigns.clientId, id: aiGenerations.id, status: aiGenerations.status, provider: aiGenerations.provider, model: aiGenerations.model, inputTokens: aiGenerations.inputTokens, outputTokens: aiGenerations.outputTokens, totalTokens: aiGenerations.totalTokens, requestDurationMs: aiGenerations.requestDurationMs, createdAt: aiGenerations.createdAt, completedAt: aiGenerations.completedAt }).from(aiGenerations).innerJoin(adCampaigns, eq(aiGenerations.campaignId, adCampaigns.id)).where(and(eq(aiGenerations.ownerUserId, userId), gte(aiGenerations.createdAt, periodStart))),
  ]);
  const monthlyGenerations = await db.select({ clientId: adCampaigns.clientId, id: aiGenerations.id }).from(aiGenerations).innerJoin(adCampaigns, eq(aiGenerations.campaignId, adCampaigns.id)).where(and(eq(aiGenerations.ownerUserId, userId), gte(aiGenerations.createdAt, monthStart)));
  return ownedClients.map(client => {
    const related = generations.filter(generation => generation.clientId === client.id);
    const monthlyRequestCount = monthlyGenerations.filter(generation => generation.clientId === client.id).length;
    const succeeded = related.filter(generation => generation.status === "succeeded");
    const withTelemetry = related.filter(generation => generation.totalTokens != null || generation.inputTokens != null || generation.outputTokens != null);
    const sum = (field: "inputTokens" | "outputTokens" | "totalTokens" | "requestDurationMs") => related.reduce((total, generation) => total + (generation[field] ?? 0), 0);
    const lastUse = related.reduce<Date | null>((latest, generation) => {
      const candidate = generation.completedAt || generation.createdAt;
      return !latest || candidate > latest ? candidate : latest;
    }, null);
    const limit = client.monthlyApiCallLimit;
    const utilizationPercent = limit ? Math.round((monthlyRequestCount / limit) * 100) : null;
    const limitStatus = !limit ? "not_configured" as const : monthlyRequestCount > limit ? "exceeded" as const : monthlyRequestCount === limit ? "reached" as const : utilizationPercent !== null && utilizationPercent >= 80 ? "near" as const : "within" as const;
    return { id: client.id, name: client.name, requestCount: related.length, successfulCount: succeeded.length, failedCount: related.filter(generation => generation.status === "failed").length, inputTokens: sum("inputTokens"), outputTokens: sum("outputTokens"), totalTokens: sum("totalTokens"), averageDurationMs: related.length ? Math.round(sum("requestDurationMs") / related.length) : null, telemetryAvailable: withTelemetry.length > 0, costStatus: "unavailable" as const, lastUsedAt: lastUse, periodDays, monthlyApiCallLimit: limit, monthlyRequestCount, utilizationPercent, limitStatus };
  });
}

export async function createCreativeVersion(userId: number, input: {
  campaignId: number;
  generationId?: number | null;
  kind: CreativeKind;
  summary?: string | null;
  payloadJson: string;
}) {
  const db = await requireDb();
  const campaign = await getAdCampaign(userId, input.campaignId);
  if (!campaign) throw new Error("Campanha não encontrada");
  const latest = await db
    .select({ versionNumber: creativeVersions.versionNumber })
    .from(creativeVersions)
    .where(and(eq(creativeVersions.campaignId, input.campaignId), eq(creativeVersions.kind, input.kind), eq(creativeVersions.ownerUserId, userId)))
    .orderBy(desc(creativeVersions.versionNumber))
    .limit(1);
  const [created] = await db
    .insert(creativeVersions)
    .values({ ...input, ownerUserId: userId, versionNumber: (latest[0]?.versionNumber || 0) + 1, status: "review" })
    .$returningId();
  return created.id;
}

export async function listCreativeVersions(userId: number, campaignId: number) {
  const db = await requireDb();
  const campaign = await getAdCampaign(userId, campaignId);
  if (!campaign) return [];
  return db
    .select()
    .from(creativeVersions)
    .where(and(eq(creativeVersions.campaignId, campaignId), eq(creativeVersions.ownerUserId, userId)))
    .orderBy(desc(creativeVersions.createdAt));
}

export async function createCreativeApproval(userId: number, input: { creativeVersionId: number; decision: ApprovalDecision; note?: string | null }) {
  const db = await requireDb();
  const versionRows = await db
    .select()
    .from(creativeVersions)
    .where(and(eq(creativeVersions.id, input.creativeVersionId), eq(creativeVersions.ownerUserId, userId)))
    .limit(1);
  const version = versionRows[0];
  if (!version) throw new Error("Versão criativa não encontrada");
  const [created] = await db
    .insert(creativeApprovals)
    .values({ ...input, campaignId: version.campaignId, ownerUserId: userId, reviewerUserId: userId })
    .$returningId();
  const status = input.decision === "approved" ? "approved" : input.decision === "rejected" ? "rejected" : "review";
  await db.update(creativeVersions).set({ status }).where(and(eq(creativeVersions.id, version.id), eq(creativeVersions.ownerUserId, userId)));
  return created.id;
}

export async function listCreativeApprovals(userId: number, creativeVersionId: number) {
  const db = await requireDb();
  const versionRows = await db
    .select({ id: creativeVersions.id })
    .from(creativeVersions)
    .where(and(eq(creativeVersions.id, creativeVersionId), eq(creativeVersions.ownerUserId, userId)))
    .limit(1);
  if (!versionRows[0]) return [];
  return db
    .select()
    .from(creativeApprovals)
    .where(and(eq(creativeApprovals.creativeVersionId, creativeVersionId), eq(creativeApprovals.ownerUserId, userId)))
    .orderBy(desc(creativeApprovals.createdAt));
}

export async function listCarouselSlides(userId: number, campaignId: number) {
  const db = await requireDb();
  const campaign = await getAdCampaign(userId, campaignId);
  if (!campaign) return [];
  return db.select().from(carouselSlides).where(eq(carouselSlides.campaignId, campaignId)).orderBy(asc(carouselSlides.slideNumber));
}

export async function replaceCarouselSlides(userId: number, campaignId: number, generationId: number, slides: Array<{
  slideNumber: number;
  role: "cover" | "context" | "insight" | "proof" | "solution" | "cta";
  headline: string;
  body?: string | null;
  visualDirection?: string | null;
  imagePrompt?: string | null;
}>) {
  const db = await requireDb();
  const campaign = await getAdCampaign(userId, campaignId);
  if (!campaign) throw new Error("Campanha não encontrada");
  await db.delete(carouselSlides).where(eq(carouselSlides.campaignId, campaignId));
  if (slides.length) await db.insert(carouselSlides).values(slides.map(slide => ({ ...slide, campaignId, generationId })));
}

export async function updateCarouselSlideAsset(userId: number, slideId: number, assetUrl: string) {
  const db = await requireDb();
  const rows = await db
    .select({ id: carouselSlides.id })
    .from(carouselSlides)
    .innerJoin(adCampaigns, eq(carouselSlides.campaignId, adCampaigns.id))
    .where(and(eq(carouselSlides.id, slideId), eq(adCampaigns.ownerUserId, userId)))
    .limit(1);
  if (!rows[0]) throw new Error("Slide não encontrado");
  await db.update(carouselSlides).set({ assetUrl }).where(eq(carouselSlides.id, slideId));
}

export async function getClientAgencyProfile(userId: number, clientId: number) {
  const db = await requireDb();
  const rows = await db.select().from(clientAgencyProfiles).where(and(eq(clientAgencyProfiles.clientId, clientId), eq(clientAgencyProfiles.ownerUserId, userId))).limit(1);
  return rows[0];
}

export async function upsertClientAgencyProfile(userId: number, input: {
  clientId: number; positioning?: string | null; voice?: string | null; audience?: string | null; offers?: string | null;
  proofPolicy?: string | null; visualSystem?: string | null; departmentContextJson?: string | null;
}) {
  const db = await requireDb();
  const ownedClient = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, input.clientId), eq(clients.createdByUserId, userId))).limit(1);
  if (!ownedClient[0]) throw new Error("Cliente inválido para este espaço de trabalho");
  await db.insert(clientAgencyProfiles).values({ ...input, ownerUserId: userId }).onDuplicateKeyUpdate({ set: { ...input } });
  return getClientAgencyProfile(userId, input.clientId);
}

export async function createContentBrief(userId: number, input: {
  clientId: number; campaignId?: number | null; title: string; sourceType: "briefing" | "idea" | "trend" | "reference" | "decision"; objective?: string | null; content: string;
}) {
  const db = await requireDb();
  const [created] = await db.insert(contentBriefs).values({ ...input, ownerUserId: userId }).$returningId();
  return created.id;
}

export async function listAgencyBriefs(userId: number, clientId: number) {
  const db = await requireDb();
  return db.select().from(contentBriefs).where(and(eq(contentBriefs.ownerUserId, userId), eq(contentBriefs.clientId, clientId))).orderBy(desc(contentBriefs.updatedAt));
}

export async function createTrendSignal(userId: number, input: {
  clientId: number; campaignId?: number | null; platform: "instagram" | "youtube" | "x" | "tiktok" | "other"; sourceUrl?: string | null; title: string; reactionNotes?: string | null; metricsJson?: string | null; score?: number | null;
}) {
  const db = await requireDb();
  const [created] = await db.insert(trendSignals).values({ ...input, ownerUserId: userId }).$returningId();
  return created.id;
}

export async function listTrendSignals(userId: number, clientId: number) {
  const db = await requireDb();
  return db.select().from(trendSignals).where(and(eq(trendSignals.ownerUserId, userId), eq(trendSignals.clientId, clientId))).orderBy(desc(trendSignals.updatedAt));
}

export async function createVideoScript(userId: number, input: {
  clientId: number; campaignId?: number | null; contentBriefId?: number | null; title: string; scriptJson: string; editPlan?: string | null;
}) {
  const db = await requireDb();
  const [created] = await db.insert(videoScripts).values({ ...input, ownerUserId: userId }).$returningId();
  return created.id;
}

export async function listVideoScripts(userId: number, clientId: number) {
  const db = await requireDb();
  return db.select().from(videoScripts).where(and(eq(videoScripts.ownerUserId, userId), eq(videoScripts.clientId, clientId))).orderBy(desc(videoScripts.updatedAt));
}

export async function createStrategyDecision(userId: number, input: {
  clientId: number; campaignId?: number | null; question: string; lensOutputJson: string; recommendation: string; primaryRisk?: string | null;
}) {
  const db = await requireDb();
  const [created] = await db.insert(strategyDecisions).values({ ...input, ownerUserId: userId }).$returningId();
  return created.id;
}

export async function listStrategyDecisions(userId: number, clientId: number) {
  const db = await requireDb();
  return db.select().from(strategyDecisions).where(and(eq(strategyDecisions.ownerUserId, userId), eq(strategyDecisions.clientId, clientId))).orderBy(desc(strategyDecisions.updatedAt));
}
