import { and, asc, desc, eq, gte, like, lte } from "drizzle-orm";
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
  clients,
  contentBriefs,
  InsertUser,
  notifications,
  operators,
  originalAppConnections,
  projectArtifacts,
  projects,
  strategyDecisions,
  tasks,
  teams,
  trendSignals,
  userDashboardPreferences,
  users,
  videoScripts,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
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

export async function listClientApiUsage(userId: number) {
  const db = await requireDb();
  const [ownedClients, generations] = await Promise.all([
    db.select({ id: clients.id, name: clients.name }).from(clients).where(eq(clients.createdByUserId, userId)).orderBy(asc(clients.name)),
    db.select({ clientId: adCampaigns.clientId, id: aiGenerations.id, status: aiGenerations.status, provider: aiGenerations.provider, model: aiGenerations.model, inputTokens: aiGenerations.inputTokens, outputTokens: aiGenerations.outputTokens, totalTokens: aiGenerations.totalTokens, requestDurationMs: aiGenerations.requestDurationMs, createdAt: aiGenerations.createdAt, completedAt: aiGenerations.completedAt }).from(aiGenerations).innerJoin(adCampaigns, eq(aiGenerations.campaignId, adCampaigns.id)).where(eq(aiGenerations.ownerUserId, userId)),
  ]);
  return ownedClients.map(client => {
    const related = generations.filter(generation => generation.clientId === client.id);
    const succeeded = related.filter(generation => generation.status === "succeeded");
    const withTelemetry = related.filter(generation => generation.totalTokens != null || generation.inputTokens != null || generation.outputTokens != null);
    const sum = (field: "inputTokens" | "outputTokens" | "totalTokens" | "requestDurationMs") => related.reduce((total, generation) => total + (generation[field] ?? 0), 0);
    const lastUse = related.reduce<Date | null>((latest, generation) => {
      const candidate = generation.completedAt || generation.createdAt;
      return !latest || candidate > latest ? candidate : latest;
    }, null);
    return { id: client.id, name: client.name, requestCount: related.length, successfulCount: succeeded.length, failedCount: related.filter(generation => generation.status === "failed").length, inputTokens: sum("inputTokens"), outputTokens: sum("outputTokens"), totalTokens: sum("totalTokens"), averageDurationMs: related.length ? Math.round(sum("requestDurationMs") / related.length) : null, telemetryAvailable: withTelemetry.length > 0, costStatus: "unavailable" as const, lastUsedAt: lastUse };
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
