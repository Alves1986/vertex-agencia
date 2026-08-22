import { and, asc, count, desc, eq, gte, inArray, isNull, like, lte, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createHash, randomBytes } from "node:crypto";
import {
  adCampaigns,
  assetUsageRights,
  approvalHistoryEmailDeliveries,
  approvalHistoryReportRecipients,
  aiGenerations,
  calendarEvents,
  capacityPlans,
  carouselSlideApprovalBatches,
  carouselSlides,
  carouselBriefTemplates,
  clientBrandAssetCollections,
  clientBrandAssets,
  clientBrandGuidelines,
  clientConsents,
  clientNotificationPreferences,
  clientOnboardingProgress,
  creativeApprovals,
  creativeVersions,
  clientAgencyProfiles,
  clientAccessGrants,
  clientAiConnections,
  clientPortalMembers,
  clients,
  contentBriefs,
  commercialProposals,
  dataRetentionPolicies,
  editorialItems,
  executiveReports,
  externalApprovalLinks,
  financialEntries,
  integrationHealthLogs,
  InsertUser,
  notifications,
  operators,
  originalAppConnections,
  projectArtifacts,
  projects,
  marketingResearches,
  marketingResearchSources,
  paidMediaPlans,
  paidMediaSnapshots,
  saasPlans,
  saasSubscriptions,
  salesActivities,
  salesLeads,
  serviceContracts,
  strategyDecisions,
  supportTicketUpdates,
  supportTickets,
  tasks,
  teams,
  timeEntries,
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
import { encryptProviderKey, getKeyHint } from "./aiAds/crypto";

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

export type ClientDeletionPreview = {
  client: { id: number; name: string };
  dependencies: {
    projects: number;
    campaigns: number;
    proposals: number;
    convertedLeads: number;
    channels: number;
    tickets: number;
    portalMembers: number;
  };
};

export async function getClientDeletionPreview(userId: number, clientId: number): Promise<ClientDeletionPreview> {
  const db = await requireDb();
  const ownedClient = await db.select({ id: clients.id, name: clients.name }).from(clients).where(and(eq(clients.id, clientId), eq(clients.createdByUserId, userId))).limit(1);
  if (!ownedClient[0]) throw new Error("Cliente não encontrado neste espaço de trabalho");

  const [projectCount, campaignCount, proposalCount, convertedLeadCount, channelCount, ticketCount, portalMemberCount] = await Promise.all([
    db.select({ value: count() }).from(projects).where(and(eq(projects.clientId, clientId), eq(projects.ownerUserId, userId))),
    db.select({ value: count() }).from(adCampaigns).where(and(eq(adCampaigns.clientId, clientId), eq(adCampaigns.ownerUserId, userId))),
    db.select({ value: count() }).from(commercialProposals).where(and(eq(commercialProposals.clientId, clientId), eq(commercialProposals.ownerUserId, userId))),
    db.select({ value: count() }).from(salesLeads).where(and(eq(salesLeads.convertedClientId, clientId), eq(salesLeads.ownerUserId, userId))),
    db.select({ value: count() }).from(whatsappChannels).where(and(eq(whatsappChannels.clientId, clientId), eq(whatsappChannels.ownerUserId, userId))),
    db.select({ value: count() }).from(supportTickets).where(and(eq(supportTickets.clientId, clientId), eq(supportTickets.ownerUserId, userId))),
    db.select({ value: count() }).from(clientPortalMembers).where(eq(clientPortalMembers.clientId, clientId)),
  ]);

  return {
    client: ownedClient[0],
    dependencies: {
      projects: Number(projectCount[0]?.value ?? 0),
      campaigns: Number(campaignCount[0]?.value ?? 0),
      proposals: Number(proposalCount[0]?.value ?? 0),
      convertedLeads: Number(convertedLeadCount[0]?.value ?? 0),
      channels: Number(channelCount[0]?.value ?? 0),
      tickets: Number(ticketCount[0]?.value ?? 0),
      portalMembers: Number(portalMemberCount[0]?.value ?? 0),
    },
  };
}

export async function deleteClient(userId: number, clientId: number, confirmationName: string): Promise<ClientDeletionPreview> {
  const preview = await getClientDeletionPreview(userId, clientId);
  if (preview.client.name !== confirmationName.trim()) throw new Error("Digite exatamente o nome do cliente para confirmar a exclusão");

  const db = await requireDb();
  await db.transaction(async tx => {
    await tx.delete(calendarEvents).where(and(eq(calendarEvents.clientId, clientId), eq(calendarEvents.ownerUserId, userId)));
    await tx.delete(commercialProposals).where(and(eq(commercialProposals.clientId, clientId), eq(commercialProposals.ownerUserId, userId)));
    await tx.delete(salesLeads).where(and(eq(salesLeads.convertedClientId, clientId), eq(salesLeads.ownerUserId, userId)));
    await tx.delete(projects).where(and(eq(projects.clientId, clientId), eq(projects.ownerUserId, userId)));
    await tx.delete(clients).where(and(eq(clients.id, clientId), eq(clients.createdByUserId, userId)));
  });

  return preview;
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

type ProviderKind = "manus" | "openai" | "openai_compatible" | "gemini" | "anthropic" | "nvidia";
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

export async function configureWhatsAppChannel(userId: number, input: { clientId: number; channelId: number; config: Record<string, string | undefined> }) {
  const db = await requireDb();
  await assertOwnedWhatsappClient(userId, input.clientId);
  const channel = (await db.select({ id: whatsappChannels.id, provider: whatsappChannels.provider }).from(whatsappChannels).where(and(eq(whatsappChannels.id, input.channelId), eq(whatsappChannels.clientId, input.clientId), eq(whatsappChannels.ownerUserId, userId))).limit(1))[0];
  if (!channel) throw new Error("O canal selecionado não pertence a este cliente.");
  const config = channel.provider === "meta_cloud"
    ? { accessToken: input.config.accessToken?.trim() || "", verifyToken: input.config.verifyToken?.trim() || "", phoneNumberId: input.config.phoneNumberId?.trim() || "", graphVersion: input.config.graphVersion?.trim() || "v20.0" }
    : { accountSid: input.config.accountSid?.trim() || "", authToken: input.config.authToken?.trim() || "", messagingServiceSid: input.config.messagingServiceSid?.trim() || undefined, from: input.config.from?.trim() || "" };
  const required = channel.provider === "meta_cloud" ? [config.accessToken, config.verifyToken, config.phoneNumberId] : [config.accountSid, config.authToken, config.from || config.messagingServiceSid];
  if (required.some(value => !value)) throw new Error("Preencha todas as credenciais obrigatórias para este provedor.");
  const secretForHint = channel.provider === "meta_cloud" ? config.accessToken : config.authToken;
  if (!secretForHint) throw new Error("A credencial principal do canal é obrigatória.");
  await db.update(whatsappChannels).set({ encryptedConfig: encryptProviderKey(JSON.stringify(config)), configHint: getKeyHint(secretForHint), status: "verification_pending", verifiedAt: null, lastError: null }).where(eq(whatsappChannels.id, input.channelId));
  await db.insert(whatsappAuditLogs).values({ clientId: input.clientId, actorUserId: userId, action: "whatsapp.channel_credentials_configured", entityType: "whatsapp_channel", entityId: input.channelId, detailsJson: JSON.stringify({ provider: channel.provider, secretStored: "encrypted", externalDelivery: "disabled_until_activation" }) });
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

export type ApprovedWhatsAppDispatch = { state: "claimed"; messageId: number; clientId: number; channelId: number; provider: "meta_cloud" | "twilio"; encryptedConfig: string; destination: string; body: string } | { state: "already_processed"; deliveryStatus: "sent" | "delivered" | "read" | "failed"; providerMessageId: string | null };

type ApprovedWhatsAppDispatchRow = {
  messageId: number;
  body: string | null;
  direction: string;
  deliveryStatus: string;
  providerMessageId: string | null;
  channelId: number;
  provider: "meta_cloud" | "twilio";
  channelStatus: string;
  encryptedConfig: string | null;
  destination: string | null;
  optInStatus: string;
  serviceWindowExpiresAt: Date | null;
};

/** Valida uma tentativa de entrega antes de alterar estado ou revelar configuração ao adaptador de servidor. */
export function checkApprovedWhatsAppDispatchEligibility(row: ApprovedWhatsAppDispatchRow, now = Date.now()): { state: "ready" } | Extract<ApprovedWhatsAppDispatch, { state: "already_processed" }> {
  if (row.direction !== "outbound") throw new Error("O rascunho selecionado não pertence a este cliente.");
  if (row.deliveryStatus !== "queued") return { state: "already_processed", deliveryStatus: row.deliveryStatus as "sent" | "delivered" | "read" | "failed", providerMessageId: row.providerMessageId };
  if (!row.body?.trim()) throw new Error("O rascunho não possui conteúdo para envio.");
  if (row.channelStatus !== "active") throw new Error("O canal não está ativo para entrega externa.");
  if (!row.encryptedConfig) throw new Error("O canal ainda não possui uma configuração cifrada válida.");
  if (!row.destination) throw new Error("O contato não possui um número de WhatsApp válido para entrega.");
  if (row.optInStatus !== "opted_in") throw new Error("O contato não possui consentimento explícito para receber mensagens automatizadas.");
  if (!row.serviceWindowExpiresAt || row.serviceWindowExpiresAt.getTime() <= now) throw new Error("A janela de atendimento de 24 horas está encerrada; use um modelo aprovado pelo provedor.");
  return { state: "ready" };
}

/** Reivindica um rascunho somente uma vez e devolve a configuração exclusivamente para o adaptador executado no servidor. */
export async function claimApprovedWhatsAppDispatch(userId: number, input: { clientId: number; messageId: number }): Promise<ApprovedWhatsAppDispatch> {
  await assertOwnedWhatsappClient(userId, input.clientId);
  const db = await requireDb();
  const row = (await db.select({ messageId: whatsappMessages.id, body: whatsappMessages.body, direction: whatsappMessages.direction, deliveryStatus: whatsappMessages.deliveryStatus, providerMessageId: whatsappMessages.providerMessageId, channelId: whatsappChannels.id, provider: whatsappChannels.provider, channelStatus: whatsappChannels.status, encryptedConfig: whatsappChannels.encryptedConfig, destination: whatsappContacts.phoneE164, optInStatus: whatsappContacts.optInStatus, serviceWindowExpiresAt: whatsappConversations.serviceWindowExpiresAt }).from(whatsappMessages).innerJoin(whatsappConversations, eq(whatsappConversations.id, whatsappMessages.conversationId)).innerJoin(whatsappContacts, eq(whatsappContacts.id, whatsappConversations.contactId)).innerJoin(whatsappChannels, eq(whatsappChannels.id, whatsappMessages.channelId)).where(and(eq(whatsappMessages.id, input.messageId), eq(whatsappMessages.clientId, input.clientId), eq(whatsappChannels.ownerUserId, userId))).limit(1))[0];
  if (!row) throw new Error("O rascunho selecionado não pertence a este cliente.");
  const eligibility = checkApprovedWhatsAppDispatchEligibility(row);
  if (eligibility.state === "already_processed") return eligibility;
  const claimed = await db.update(whatsappMessages).set({ deliveryStatus: "sent" }).where(and(eq(whatsappMessages.id, input.messageId), eq(whatsappMessages.deliveryStatus, "queued")));
  if (!claimed[0].affectedRows) {
    const current = (await db.select({ deliveryStatus: whatsappMessages.deliveryStatus, providerMessageId: whatsappMessages.providerMessageId }).from(whatsappMessages).where(eq(whatsappMessages.id, input.messageId)).limit(1))[0];
    return { state: "already_processed", deliveryStatus: (current?.deliveryStatus ?? "failed") as "sent" | "delivered" | "read" | "failed", providerMessageId: current?.providerMessageId ?? null };
  }
  await db.insert(whatsappAuditLogs).values({ clientId: input.clientId, actorUserId: userId, action: "whatsapp.delivery_approved", entityType: "whatsapp_message", entityId: input.messageId, detailsJson: JSON.stringify({ channelId: row.channelId, provider: row.provider, consent: row.optInStatus, serviceWindow: "open" }) });
  return { state: "claimed", messageId: row.messageId, clientId: input.clientId, channelId: row.channelId, provider: row.provider, encryptedConfig: row.encryptedConfig!, destination: row.destination!, body: row.body! };
}

export async function completeApprovedWhatsAppDispatch(userId: number, input: { clientId: number; messageId: number; channelId: number; providerMessageId: string; providerPayload: Record<string, unknown> }) {
  await assertOwnedWhatsappClient(userId, input.clientId);
  const db = await requireDb();
  await db.update(whatsappMessages).set({ deliveryStatus: "sent", providerMessageId: input.providerMessageId, providerPayloadJson: JSON.stringify(input.providerPayload), occurredAt: new Date() }).where(and(eq(whatsappMessages.id, input.messageId), eq(whatsappMessages.clientId, input.clientId)));
  await db.update(whatsappChannels).set({ lastOutboundAt: new Date(), lastError: null }).where(eq(whatsappChannels.id, input.channelId));
  await db.insert(whatsappAuditLogs).values({ clientId: input.clientId, actorUserId: userId, action: "whatsapp.delivery_sent", entityType: "whatsapp_message", entityId: input.messageId, detailsJson: JSON.stringify({ channelId: input.channelId, providerMessageId: input.providerMessageId }) });
}

export async function failApprovedWhatsAppDispatch(userId: number, input: { clientId: number; messageId: number; channelId: number; reason: string }) {
  await assertOwnedWhatsappClient(userId, input.clientId);
  const db = await requireDb();
  const safeReason = input.reason.slice(0, 500);
  await db.update(whatsappMessages).set({ deliveryStatus: "failed", providerPayloadJson: JSON.stringify({ deliveryError: safeReason }) }).where(and(eq(whatsappMessages.id, input.messageId), eq(whatsappMessages.clientId, input.clientId)));
  await db.update(whatsappChannels).set({ lastError: safeReason }).where(eq(whatsappChannels.id, input.channelId));
  await db.insert(whatsappAuditLogs).values({ clientId: input.clientId, actorUserId: userId, action: "whatsapp.delivery_failed", entityType: "whatsapp_message", entityId: input.messageId, detailsJson: JSON.stringify({ channelId: input.channelId, reason: safeReason }) });
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

export type CampaignApprovalHistoryEntry = {
  id: number;
  creativeVersionId: number;
  reviewerUserId: number;
  reviewerName: string | null;
  decision: "approved" | "changes_requested" | "rejected";
  note: string | null;
  createdAt: Date;
  source: "version_approval" | "carousel_batch";
  slideNumbers: number[];
};

/** Linha do tempo auditável da campanha, limitada ao proprietário da operação. */
export async function listCampaignApprovalHistory(userId: number, campaignId: number, filters?: { reviewerUserId?: number; decision?: CampaignApprovalHistoryEntry["decision"]; startDate?: string; endDate?: string }): Promise<CampaignApprovalHistoryEntry[]> {
  const db = await requireDb();
  const campaign = await getAdCampaign(userId, campaignId);
  if (!campaign) return [];

  const [versionApprovals, batchApprovals] = await Promise.all([
    db.select().from(creativeApprovals).where(and(eq(creativeApprovals.campaignId, campaignId), eq(creativeApprovals.ownerUserId, userId))).orderBy(desc(creativeApprovals.createdAt)),
    db.select().from(carouselSlideApprovalBatches).where(and(eq(carouselSlideApprovalBatches.campaignId, campaignId), eq(carouselSlideApprovalBatches.ownerUserId, userId))).orderBy(desc(carouselSlideApprovalBatches.createdAt)),
  ]);
  const reviewerIds = Array.from(new Set([...versionApprovals, ...batchApprovals].map(item => item.reviewerUserId)));
  const reviewers = reviewerIds.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, reviewerIds)) : [];
  const reviewerNames = new Map(reviewers.map(reviewer => [reviewer.id, reviewer.name]));
  const safeSlideNumbers = (value: string) => {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((number): number is number => Number.isInteger(number) && number > 0 && number <= 10) : [];
    } catch {
      return [];
    }
  };
  const entries = [
    ...versionApprovals.map(item => ({ id: item.id, creativeVersionId: item.creativeVersionId, reviewerUserId: item.reviewerUserId, reviewerName: reviewerNames.get(item.reviewerUserId) ?? null, decision: item.decision, note: item.note, createdAt: item.createdAt, source: "version_approval" as const, slideNumbers: [] })),
    ...batchApprovals.map(item => ({ id: item.id, creativeVersionId: item.creativeVersionId, reviewerUserId: item.reviewerUserId, reviewerName: reviewerNames.get(item.reviewerUserId) ?? null, decision: item.decision, note: item.note, createdAt: item.createdAt, source: "carousel_batch" as const, slideNumbers: safeSlideNumbers(item.slideNumbersJson) })),
  ].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  const startAt = filters?.startDate ? new Date(`${filters.startDate}T00:00:00.000Z`) : null;
  const endAt = filters?.endDate ? new Date(`${filters.endDate}T23:59:59.999Z`) : null;
  return entries.filter(entry => (!filters?.reviewerUserId || entry.reviewerUserId === filters.reviewerUserId) && (!filters?.decision || entry.decision === filters.decision) && (!startAt || entry.createdAt >= startAt) && (!endAt || entry.createdAt <= endAt));
}

/** Persiste somente metadados da entrega; nunca o conteúdo do PDF, corpo de e-mail ou credenciais. */
export async function recordApprovalHistoryEmailDelivery(userId: number, input: {
  campaignId: number;
  recipientEmail: string;
  subject: string;
  filtersJson: string;
  recordCount: number;
  status: "sent" | "failed";
  providerMessageId?: string | null;
  failureCode?: string | null;
}) {
  const db = await requireDb();
  const campaign = await getAdCampaign(userId, input.campaignId);
  if (!campaign) throw new Error("Campanha não encontrada neste espaço de trabalho");
  const [created] = await db.insert(approvalHistoryEmailDeliveries).values({
    campaignId: input.campaignId,
    clientId: campaign.client.id,
    actorUserId: userId,
    recipientEmail: input.recipientEmail,
    subject: input.subject,
    filtersJson: input.filtersJson,
    recordCount: input.recordCount,
    status: input.status,
    providerMessageId: input.providerMessageId || null,
    failureCode: input.failureCode || null,
  }).$returningId();
  return created.id;
}

export async function listApprovalHistoryReportRecipients(userId: number, clientId: number, includeDisabled = true) {
  const db = await requireOwnedAgencyClient(userId, clientId);
  return db.select().from(approvalHistoryReportRecipients).where(includeDisabled ? eq(approvalHistoryReportRecipients.clientId, clientId) : and(eq(approvalHistoryReportRecipients.clientId, clientId), eq(approvalHistoryReportRecipients.status, "active"))).orderBy(asc(approvalHistoryReportRecipients.name));
}

export async function createApprovalHistoryReportRecipient(userId: number, input: { clientId: number; name: string; email: string }) {
  const db = await requireOwnedAgencyClient(userId, input.clientId);
  const [created] = await db.insert(approvalHistoryReportRecipients).values({ clientId: input.clientId, name: input.name.trim(), email: input.email.trim().toLowerCase(), createdByUserId: userId, status: "active" }).$returningId();
  return created.id;
}

export async function setApprovalHistoryReportRecipientStatus(userId: number, input: { clientId: number; recipientId: number; status: "active" | "disabled" }) {
  const db = await requireOwnedAgencyClient(userId, input.clientId);
  const recipient = await db.select({ id: approvalHistoryReportRecipients.id }).from(approvalHistoryReportRecipients).where(and(eq(approvalHistoryReportRecipients.id, input.recipientId), eq(approvalHistoryReportRecipients.clientId, input.clientId))).limit(1);
  if (!recipient[0]) throw new Error("Destinatário autorizado não encontrado para este cliente");
  await db.update(approvalHistoryReportRecipients).set({ status: input.status }).where(eq(approvalHistoryReportRecipients.id, input.recipientId));
  return input.recipientId;
}

export async function deleteApprovalHistoryReportRecipient(userId: number, input: { clientId: number; recipientId: number }) {
  const db = await requireOwnedAgencyClient(userId, input.clientId);
  const recipient = await db.select({ id: approvalHistoryReportRecipients.id }).from(approvalHistoryReportRecipients).where(and(eq(approvalHistoryReportRecipients.id, input.recipientId), eq(approvalHistoryReportRecipients.clientId, input.clientId))).limit(1);
  if (!recipient[0]) throw new Error("Destinatário autorizado não encontrado para este cliente");
  await db.delete(approvalHistoryReportRecipients).where(eq(approvalHistoryReportRecipients.id, input.recipientId));
  return input.recipientId;
}

/** Retorna somente metadados seguros para alertas internos; o erro bruto não deixa o servidor. */
export async function listApprovalHistoryEmailFailures(userId: number, campaignId: number) {
  const db = await requireDb();
  const campaign = await getAdCampaign(userId, campaignId);
  if (!campaign) return [];
  return db.select({ id: approvalHistoryEmailDeliveries.id, recipientEmail: approvalHistoryEmailDeliveries.recipientEmail, createdAt: approvalHistoryEmailDeliveries.createdAt, recordCount: approvalHistoryEmailDeliveries.recordCount }).from(approvalHistoryEmailDeliveries).where(and(eq(approvalHistoryEmailDeliveries.campaignId, campaignId), eq(approvalHistoryEmailDeliveries.status, "failed"))).orderBy(desc(approvalHistoryEmailDeliveries.createdAt)).limit(10);
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

async function requireOwnedAgencyClient(userId: number, clientId: number) {
  const db = await requireDb();
  const ownedClient = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.createdByUserId, userId)))
    .limit(1);
  if (!ownedClient[0]) throw new Error("Cliente inválido para este espaço de trabalho");
  return db;
}

export async function listCarouselBriefTemplates(userId: number, clientId: number) {
  const db = await requireOwnedAgencyClient(userId, clientId);
  return db
    .select()
    .from(carouselBriefTemplates)
    .where(and(eq(carouselBriefTemplates.ownerUserId, userId), eq(carouselBriefTemplates.clientId, clientId)))
    .orderBy(desc(carouselBriefTemplates.updatedAt));
}

export async function createCarouselBriefTemplate(userId: number, input: { clientId: number; name: string; description?: string | null; fieldsJson: string }) {
  const db = await requireOwnedAgencyClient(userId, input.clientId);
  const [created] = await db.insert(carouselBriefTemplates).values({ ...input, ownerUserId: userId }).$returningId();
  return created.id;
}

export async function deleteCarouselBriefTemplate(userId: number, input: { clientId: number; templateId: number }) {
  const db = await requireOwnedAgencyClient(userId, input.clientId);
  const template = await db
    .select({ id: carouselBriefTemplates.id })
    .from(carouselBriefTemplates)
    .where(and(eq(carouselBriefTemplates.id, input.templateId), eq(carouselBriefTemplates.clientId, input.clientId), eq(carouselBriefTemplates.ownerUserId, userId)))
    .limit(1);
  if (!template[0]) throw new Error("Modelo de briefing não encontrado para este cliente");
  await db.delete(carouselBriefTemplates).where(eq(carouselBriefTemplates.id, input.templateId));
  return input.templateId;
}

export async function listClientBrandAssets(userId: number, clientId: number) {
  const db = await requireOwnedAgencyClient(userId, clientId);
  return db
    .select()
    .from(clientBrandAssets)
    .where(and(eq(clientBrandAssets.ownerUserId, userId), eq(clientBrandAssets.clientId, clientId)))
    .orderBy(desc(clientBrandAssets.updatedAt));
}

export async function createClientBrandAsset(userId: number, input: {
  clientId: number; collectionId?: number | null; name: string; assetType: "logo" | "product" | "reference" | "palette" | "other"; storageKey: string; assetUrl: string; mimeType: string; byteSize: number;
}) {
  const db = await requireOwnedAgencyClient(userId, input.clientId);
  if (input.collectionId) {
    const collection = await db.select({ id: clientBrandAssetCollections.id }).from(clientBrandAssetCollections).where(and(eq(clientBrandAssetCollections.id, input.collectionId), eq(clientBrandAssetCollections.clientId, input.clientId), eq(clientBrandAssetCollections.ownerUserId, userId))).limit(1);
    if (!collection[0]) throw new Error("Coleção de marca não encontrada para este cliente");
  }
  const [created] = await db.insert(clientBrandAssets).values({ ...input, ownerUserId: userId, status: "authorized" }).$returningId();
  return created.id;
}

export async function setClientBrandAssetStatus(userId: number, input: { clientId: number; assetId: number; status: "authorized" | "archived" }) {
  const db = await requireOwnedAgencyClient(userId, input.clientId);
  const asset = await db
    .select({ id: clientBrandAssets.id })
    .from(clientBrandAssets)
    .where(and(eq(clientBrandAssets.id, input.assetId), eq(clientBrandAssets.clientId, input.clientId), eq(clientBrandAssets.ownerUserId, userId)))
    .limit(1);
  if (!asset[0]) throw new Error("Ativo de marca não encontrado para este cliente");
  await db.update(clientBrandAssets).set({ status: input.status }).where(eq(clientBrandAssets.id, input.assetId));
  return input.assetId;
}

export async function listClientBrandAssetCollections(userId: number, clientId: number) {
  const db = await requireOwnedAgencyClient(userId, clientId);
  return db.select().from(clientBrandAssetCollections).where(and(eq(clientBrandAssetCollections.clientId, clientId), eq(clientBrandAssetCollections.ownerUserId, userId))).orderBy(asc(clientBrandAssetCollections.name));
}

export async function createClientBrandAssetCollection(userId: number, input: { clientId: number; name: string; description?: string | null }) {
  const db = await requireOwnedAgencyClient(userId, input.clientId);
  const [created] = await db.insert(clientBrandAssetCollections).values({ ...input, ownerUserId: userId }).$returningId();
  return created.id;
}

export async function updateClientBrandAssetCollection(userId: number, input: { clientId: number; collectionId: number; name: string; description?: string | null }) {
  const db = await requireOwnedAgencyClient(userId, input.clientId);
  const collection = await db.select({ id: clientBrandAssetCollections.id }).from(clientBrandAssetCollections).where(and(eq(clientBrandAssetCollections.id, input.collectionId), eq(clientBrandAssetCollections.clientId, input.clientId), eq(clientBrandAssetCollections.ownerUserId, userId))).limit(1);
  if (!collection[0]) throw new Error("Coleção de marca não encontrada para este cliente");
  await db.update(clientBrandAssetCollections).set({ name: input.name, description: input.description ?? null }).where(eq(clientBrandAssetCollections.id, input.collectionId));
  return input.collectionId;
}

export async function deleteClientBrandAssetCollection(userId: number, input: { clientId: number; collectionId: number }) {
  const db = await requireOwnedAgencyClient(userId, input.clientId);
  const collection = await db.select({ id: clientBrandAssetCollections.id }).from(clientBrandAssetCollections).where(and(eq(clientBrandAssetCollections.id, input.collectionId), eq(clientBrandAssetCollections.clientId, input.clientId), eq(clientBrandAssetCollections.ownerUserId, userId))).limit(1);
  if (!collection[0]) throw new Error("Coleção de marca não encontrada para este cliente");
  await db.update(clientBrandAssets).set({ collectionId: null }).where(and(eq(clientBrandAssets.clientId, input.clientId), eq(clientBrandAssets.collectionId, input.collectionId), eq(clientBrandAssets.ownerUserId, userId)));
  await db.delete(clientBrandAssetCollections).where(eq(clientBrandAssetCollections.id, input.collectionId));
  return input.collectionId;
}

export async function setClientBrandAssetCollection(userId: number, input: { clientId: number; assetId: number; collectionId?: number | null }) {
  const db = await requireOwnedAgencyClient(userId, input.clientId);
  const asset = await db.select({ id: clientBrandAssets.id }).from(clientBrandAssets).where(and(eq(clientBrandAssets.id, input.assetId), eq(clientBrandAssets.clientId, input.clientId), eq(clientBrandAssets.ownerUserId, userId))).limit(1);
  if (!asset[0]) throw new Error("Ativo de marca não encontrado para este cliente");
  if (input.collectionId) {
    const collection = await db.select({ id: clientBrandAssetCollections.id }).from(clientBrandAssetCollections).where(and(eq(clientBrandAssetCollections.id, input.collectionId), eq(clientBrandAssetCollections.clientId, input.clientId), eq(clientBrandAssetCollections.ownerUserId, userId))).limit(1);
    if (!collection[0]) throw new Error("Coleção de marca não encontrada para este cliente");
  }
  await db.update(clientBrandAssets).set({ collectionId: input.collectionId ?? null }).where(eq(clientBrandAssets.id, input.assetId));
  return input.assetId;
}

export async function approveCarouselSlidesBatch(userId: number, input: { clientId: number; creativeVersionId: number; slideNumbers: number[]; note?: string | null }) {
  const db = await requireOwnedAgencyClient(userId, input.clientId);
  const version = await db.select({ id: creativeVersions.id, campaignId: creativeVersions.campaignId, kind: creativeVersions.kind }).from(creativeVersions).innerJoin(adCampaigns, eq(creativeVersions.campaignId, adCampaigns.id)).where(and(eq(creativeVersions.id, input.creativeVersionId), eq(creativeVersions.ownerUserId, userId), eq(adCampaigns.clientId, input.clientId), eq(adCampaigns.ownerUserId, userId))).limit(1);
  if (!version[0] || version[0].kind !== "carousel") throw new Error("Prévia de carrossel não encontrada para este cliente");
  const slides = await db.select({ id: carouselSlides.id, slideNumber: carouselSlides.slideNumber, approvalStatus: carouselSlides.approvalStatus }).from(carouselSlides).where(eq(carouselSlides.campaignId, version[0].campaignId));
  const uniqueNumbers = Array.from(new Set(input.slideNumbers)).sort((left, right) => left - right);
  const selectedSlides = slides.filter(slide => uniqueNumbers.includes(slide.slideNumber));
  if (!selectedSlides.length || selectedSlides.length !== uniqueNumbers.length) throw new Error("Selecione apenas slides pertencentes a esta prévia");
  await Promise.all(selectedSlides.map(slide => db.update(carouselSlides).set({ approvalStatus: "approved" }).where(eq(carouselSlides.id, slide.id))));
  const [created] = await db.insert(carouselSlideApprovalBatches).values({ creativeVersionId: version[0].id, campaignId: version[0].campaignId, ownerUserId: userId, reviewerUserId: userId, slideNumbersJson: JSON.stringify(uniqueNumbers), note: input.note ?? null }).$returningId();
  const allApproved = slides.every(slide => uniqueNumbers.includes(slide.slideNumber) || slide.approvalStatus === "approved");
  if (allApproved) {
    await db.update(creativeVersions).set({ status: "approved" }).where(and(eq(creativeVersions.id, version[0].id), eq(creativeVersions.ownerUserId, userId)));
    await db.insert(creativeApprovals).values({ creativeVersionId: version[0].id, campaignId: version[0].campaignId, ownerUserId: userId, reviewerUserId: userId, decision: "approved", note: input.note ? `Aprovação em lote: ${input.note}` : `Aprovação em lote de ${uniqueNumbers.length} slides.` });
  }
  return { batchId: created.id, approvedSlides: uniqueNumbers, fullyApproved: allApproved };
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

type EditorialStatus = "idea" | "briefing" | "production" | "review" | "approved" | "published" | "archived";
type EditorialChannel = "instagram" | "facebook" | "tiktok" | "youtube" | "linkedin" | "blog" | "email" | "whatsapp" | "other";
type PaidMediaPlatform = "meta" | "google" | "tiktok" | "linkedin" | "other";
type PaidMediaStatus = "draft" | "active" | "paused" | "completed";

async function assertOwnedEditorialOperator(userId: number, operatorId: number | null | undefined) {
  if (!operatorId) return;
  const db = await requireDb();
  const operator = await db.select({ id: operators.id }).from(operators).where(and(eq(operators.id, operatorId), eq(operators.createdByUserId, userId))).limit(1);
  if (!operator[0]) throw new Error("Responsável não pertence a este espaço de trabalho.");
}

async function assertOwnedCampaignForClient(userId: number, clientId: number, campaignId: number | null | undefined) {
  if (!campaignId) return;
  const db = await requireDb();
  const campaign = await db.select({ id: adCampaigns.id }).from(adCampaigns).where(and(eq(adCampaigns.id, campaignId), eq(adCampaigns.clientId, clientId), eq(adCampaigns.ownerUserId, userId))).limit(1);
  if (!campaign[0]) throw new Error("Campanha não encontrada para este cliente.");
}

export async function listEditorialItems(userId: number, clientId: number, status?: EditorialStatus) {
  const db = await requireDb();
  await assertOwnedSuccessClient(userId, clientId);
  return db.select({ item: editorialItems, operator: operators }).from(editorialItems).leftJoin(operators, eq(editorialItems.assignedOperatorId, operators.id)).where(and(eq(editorialItems.ownerUserId, userId), eq(editorialItems.clientId, clientId), ...(status ? [eq(editorialItems.status, status)] : []))).orderBy(asc(editorialItems.plannedFor), desc(editorialItems.createdAt));
}

export async function createEditorialItem(userId: number, input: { clientId: number; projectId?: number | null; campaignId?: number | null; assignedOperatorId?: number | null; title: string; channel: EditorialChannel; format?: string | null; pillar?: string | null; objective?: string | null; brief?: string | null; plannedFor?: Date | null }) {
  const db = await requireDb();
  await assertOwnedSuccessClient(userId, input.clientId);
  await assertOwnedEditorialOperator(userId, input.assignedOperatorId);
  await assertOwnedCampaignForClient(userId, input.clientId, input.campaignId);
  if (input.projectId) {
    const project = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, input.projectId), eq(projects.clientId, input.clientId), eq(projects.ownerUserId, userId))).limit(1);
    if (!project[0]) throw new Error("Projeto não encontrado para este cliente.");
  }
  const [created] = await db.insert(editorialItems).values({ ...input, ownerUserId: userId, format: input.format?.trim() || null, pillar: input.pillar?.trim() || null, objective: input.objective?.trim() || null, brief: input.brief?.trim() || null }).$returningId();
  return created.id;
}

export async function updateEditorialItem(userId: number, input: { clientId: number; itemId: number; status?: EditorialStatus; assignedOperatorId?: number | null; plannedFor?: Date | null; publishedAt?: Date | null }) {
  const db = await requireDb();
  await assertOwnedSuccessClient(userId, input.clientId);
  await assertOwnedEditorialOperator(userId, input.assignedOperatorId);
  const row = await db.select({ id: editorialItems.id }).from(editorialItems).where(and(eq(editorialItems.id, input.itemId), eq(editorialItems.ownerUserId, userId), eq(editorialItems.clientId, input.clientId))).limit(1);
  if (!row[0]) throw new Error("Item editorial não encontrado para este cliente.");
  await db.update(editorialItems).set({ ...(input.status !== undefined ? { status: input.status } : {}), ...(input.assignedOperatorId !== undefined ? { assignedOperatorId: input.assignedOperatorId } : {}), ...(input.plannedFor !== undefined ? { plannedFor: input.plannedFor } : {}), ...(input.publishedAt !== undefined ? { publishedAt: input.publishedAt } : {}) }).where(eq(editorialItems.id, input.itemId));
  return input.itemId;
}

export async function listPaidMediaPlans(userId: number, clientId: number) {
  const db = await requireDb();
  await assertOwnedSuccessClient(userId, clientId);
  return db.select().from(paidMediaPlans).where(and(eq(paidMediaPlans.ownerUserId, userId), eq(paidMediaPlans.clientId, clientId))).orderBy(desc(paidMediaPlans.createdAt));
}

export async function createPaidMediaPlan(userId: number, input: { clientId: number; campaignId?: number | null; name: string; platform: PaidMediaPlatform; objective: string; targetMetric?: string | null; targetValue?: number | null; plannedBudgetCents: number; startsAt?: Date | null; endsAt?: Date | null }) {
  const db = await requireDb();
  await assertOwnedSuccessClient(userId, input.clientId);
  await assertOwnedCampaignForClient(userId, input.clientId, input.campaignId);
  const [created] = await db.insert(paidMediaPlans).values({ ...input, ownerUserId: userId, targetMetric: input.targetMetric?.trim() || null }).$returningId();
  return created.id;
}

export async function updatePaidMediaPlanStatus(userId: number, input: { clientId: number; planId: number; status: PaidMediaStatus }) {
  const db = await requireDb();
  await assertOwnedSuccessClient(userId, input.clientId);
  const result = await db.update(paidMediaPlans).set({ status: input.status }).where(and(eq(paidMediaPlans.id, input.planId), eq(paidMediaPlans.clientId, input.clientId), eq(paidMediaPlans.ownerUserId, userId)));
  if (!result[0]?.affectedRows) throw new Error("Plano de mídia não encontrado para este cliente.");
  return input.planId;
}

export async function listPaidMediaSnapshots(userId: number, clientId: number, mediaPlanId?: number) {
  const db = await requireDb();
  await assertOwnedSuccessClient(userId, clientId);
  return db.select().from(paidMediaSnapshots).where(and(eq(paidMediaSnapshots.ownerUserId, userId), eq(paidMediaSnapshots.clientId, clientId), ...(mediaPlanId ? [eq(paidMediaSnapshots.mediaPlanId, mediaPlanId)] : []))).orderBy(desc(paidMediaSnapshots.recordedAt));
}

export async function createPaidMediaSnapshot(userId: number, input: { clientId: number; mediaPlanId: number; recordedAt: Date; spendCents: number; impressions: number; reach: number; clicks: number; leads: number; conversions: number; conversionValueCents: number; notes?: string | null }) {
  const db = await requireDb();
  await assertOwnedSuccessClient(userId, input.clientId);
  const plan = await db.select({ id: paidMediaPlans.id }).from(paidMediaPlans).where(and(eq(paidMediaPlans.id, input.mediaPlanId), eq(paidMediaPlans.clientId, input.clientId), eq(paidMediaPlans.ownerUserId, userId))).limit(1);
  if (!plan[0]) throw new Error("Plano de mídia não encontrado para este cliente.");
  await db.insert(paidMediaSnapshots).values({ ...input, ownerUserId: userId, notes: input.notes?.trim() || null }).onDuplicateKeyUpdate({ set: { spendCents: input.spendCents, impressions: input.impressions, reach: input.reach, clicks: input.clicks, leads: input.leads, conversions: input.conversions, conversionValueCents: input.conversionValueCents, notes: input.notes?.trim() || null } });
  return input.mediaPlanId;
}

export async function getPaidMediaSummary(userId: number, clientId: number) {
  const [plans, snapshots] = await Promise.all([listPaidMediaPlans(userId, clientId), listPaidMediaSnapshots(userId, clientId)]);
  const aggregate = snapshots.reduce((total, snapshot) => ({ spendCents: total.spendCents + snapshot.spendCents, impressions: total.impressions + snapshot.impressions, reach: total.reach + snapshot.reach, clicks: total.clicks + snapshot.clicks, leads: total.leads + snapshot.leads, conversions: total.conversions + snapshot.conversions, conversionValueCents: total.conversionValueCents + snapshot.conversionValueCents }), { spendCents: 0, impressions: 0, reach: 0, clicks: 0, leads: 0, conversions: 0, conversionValueCents: 0 });
  return { plans: { total: plans.length, active: plans.filter(plan => plan.status === "active").length, plannedBudgetCents: plans.reduce((sum, plan) => sum + plan.plannedBudgetCents, 0) }, ...aggregate, ctrPercent: aggregate.impressions ? Number(((aggregate.clicks / aggregate.impressions) * 100).toFixed(2)) : null, cplCents: aggregate.leads ? Math.round(aggregate.spendCents / aggregate.leads) : null, roas: aggregate.spendCents ? Number((aggregate.conversionValueCents / aggregate.spendCents).toFixed(2)) : null };
}

type MarketingResearchStatus = "draft" | "collecting" | "review" | "accepted" | "archived";

export async function listMarketingResearches(userId: number, clientId: number, status?: MarketingResearchStatus) {
  const db = await requireDb();
  await assertOwnedSuccessClient(userId, clientId);
  return db.select().from(marketingResearches).where(and(eq(marketingResearches.ownerUserId, userId), eq(marketingResearches.clientId, clientId), ...(status ? [eq(marketingResearches.status, status)] : []))).orderBy(desc(marketingResearches.updatedAt));
}

export async function createMarketingResearch(userId: number, input: { clientId: number; campaignId?: number | null; title: string; objective: string; question: string; audience?: string | null; market?: string | null }) {
  const db = await requireDb();
  await assertOwnedSuccessClient(userId, input.clientId);
  await assertOwnedCampaignForClient(userId, input.clientId, input.campaignId);
  const [created] = await db.insert(marketingResearches).values({ ...input, ownerUserId: userId, audience: input.audience?.trim() || null, market: input.market?.trim() || null, status: "draft" }).$returningId();
  return created.id;
}

export async function updateMarketingResearch(userId: number, input: { clientId: number; researchId: number; status?: MarketingResearchStatus; summary?: string | null; recommendation?: string | null; risks?: string | null }) {
  const db = await requireDb();
  await assertOwnedSuccessClient(userId, input.clientId);
  const row = await db.select({ id: marketingResearches.id }).from(marketingResearches).where(and(eq(marketingResearches.id, input.researchId), eq(marketingResearches.clientId, input.clientId), eq(marketingResearches.ownerUserId, userId))).limit(1);
  if (!row[0]) throw new Error("Dossiê de pesquisa não encontrado para este cliente.");
  await db.update(marketingResearches).set({ ...(input.status !== undefined ? { status: input.status } : {}), ...(input.summary !== undefined ? { summary: input.summary?.trim() || null } : {}), ...(input.recommendation !== undefined ? { recommendation: input.recommendation?.trim() || null } : {}), ...(input.risks !== undefined ? { risks: input.risks?.trim() || null } : {}) }).where(eq(marketingResearches.id, input.researchId));
  return input.researchId;
}

export async function listMarketingResearchSources(userId: number, clientId: number, researchId: number) {
  const db = await requireDb();
  await assertOwnedSuccessClient(userId, clientId);
  const research = await db.select({ id: marketingResearches.id }).from(marketingResearches).where(and(eq(marketingResearches.id, researchId), eq(marketingResearches.clientId, clientId), eq(marketingResearches.ownerUserId, userId))).limit(1);
  if (!research[0]) throw new Error("Dossiê de pesquisa não encontrado para este cliente.");
  return db.select().from(marketingResearchSources).where(and(eq(marketingResearchSources.researchId, researchId), eq(marketingResearchSources.clientId, clientId), eq(marketingResearchSources.ownerUserId, userId))).orderBy(desc(marketingResearchSources.capturedAt));
}

export async function addMarketingResearchSource(userId: number, input: { clientId: number; researchId: number; sourceType: "web" | "social" | "video" | "community" | "report" | "competitor" | "other"; title: string; url: string; publisher?: string | null; excerpt?: string | null; publishedAt?: Date | null }) {
  const db = await requireDb();
  await listMarketingResearchSources(userId, input.clientId, input.researchId);
  const [created] = await db.insert(marketingResearchSources).values({ ...input, ownerUserId: userId, publisher: input.publisher?.trim() || null, excerpt: input.excerpt?.trim() || null }).$returningId();
  return created.id;
}

const portalWriterRoles = new Set(["client_admin", "manager", "reviewer"]);

const defaultNotificationEvents = {
  approvals: true,
  usage_limit: true,
  channel_status: true,
  email_failures: true,
  due_dates: true,
  billing: true,
  support: true,
};

type ClientNotificationEvent = keyof typeof defaultNotificationEvents;
type OnboardingStep = "brand" | "contacts" | "ai" | "whatsapp" | "goals" | "review" | "complete";

function parseJsonList(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every(item => typeof item === "string") ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeNotificationEvents(value: Partial<Record<ClientNotificationEvent, boolean>> | null | undefined) {
  return { ...defaultNotificationEvents, ...(value ?? {}) };
}

async function assertOwnedSuccessClient(userId: number, clientId: number) {
  const db = await requireDb();
  const client = (await db.select({ id: clients.id, name: clients.name, contactEmail: clients.contactEmail }).from(clients).where(and(eq(clients.id, clientId), eq(clients.createdByUserId, userId))).limit(1))[0];
  if (!client) throw new Error("Cliente não encontrado neste espaço de trabalho.");
  return client;
}

async function getClientPortalMembershipForSuccess(openId: string, clientId: number) {
  const db = await requireDb();
  const membership = (await db.select({ userId: users.id, email: users.email, role: clientPortalMembers.role, clientId: clientPortalMembers.clientId, clientName: clients.name }).from(clientPortalMembers).innerJoin(users, eq(users.id, clientPortalMembers.userId)).innerJoin(clients, eq(clients.id, clientPortalMembers.clientId)).where(and(eq(users.openId, openId), eq(clientPortalMembers.clientId, clientId), eq(clientPortalMembers.status, "active"))).limit(1))[0];
  if (!membership) throw new Error("Você não possui acesso ativo a este espaço de cliente.");
  return membership;
}

async function notifyConfiguredClientEvent(userId: number, clientId: number, event: ClientNotificationEvent, input: { title: string; message: string; type: "approval" | "deadline" | "comment" | "delivery" | "system"; actionPath?: string | null }) {
  const preferences = await getClientNotificationPreferences(userId, clientId);
  if (!preferences.events[event]) return;
  await createNotification(userId, { ...input, actionPath: input.actionPath ?? null });
}

/** Convites independentes do login: o acesso permanece pendente até uma aceitação explícita. */
export async function listClientAccessGrants(userId: number, clientId: number) {
  const db = await requireDb();
  await assertOwnedSuccessClient(userId, clientId);
  return db.select({ id: clientAccessGrants.id, clientId: clientAccessGrants.clientId, email: clientAccessGrants.email, displayName: clientAccessGrants.displayName, role: clientAccessGrants.role, status: clientAccessGrants.status, acceptedAt: clientAccessGrants.acceptedAt, createdAt: clientAccessGrants.createdAt, updatedAt: clientAccessGrants.updatedAt, invitedByName: users.name }).from(clientAccessGrants).leftJoin(users, eq(users.id, clientAccessGrants.invitedByUserId)).where(and(eq(clientAccessGrants.clientId, clientId), eq(clientAccessGrants.ownerUserId, userId))).orderBy(asc(clientAccessGrants.email));
}

export async function upsertClientAccessGrant(userId: number, input: { clientId: number; email: string; displayName?: string | null; role: "client_admin" | "manager" | "reviewer" | "viewer" }) {
  const db = await requireDb();
  await assertOwnedSuccessClient(userId, input.clientId);
  const email = input.email.trim().toLowerCase();
  const existing = (await db.select({ id: clientAccessGrants.id, status: clientAccessGrants.status }).from(clientAccessGrants).where(and(eq(clientAccessGrants.clientId, input.clientId), eq(clientAccessGrants.email, email), eq(clientAccessGrants.ownerUserId, userId))).limit(1))[0];
  if (existing) {
    await db.update(clientAccessGrants).set({ displayName: input.displayName?.trim() || null, role: input.role, status: existing.status === "revoked" ? "pending" : existing.status, invitedByUserId: userId }).where(eq(clientAccessGrants.id, existing.id));
    return existing.id;
  }
  const [created] = await db.insert(clientAccessGrants).values({ clientId: input.clientId, ownerUserId: userId, email, displayName: input.displayName?.trim() || null, role: input.role, status: "pending", invitedByUserId: userId }).$returningId();
  return created.id;
}

export async function updateClientAccessGrantStatus(userId: number, input: { clientId: number; grantId: number; status: "pending" | "active" | "revoked" }) {
  const db = await requireDb();
  await assertOwnedSuccessClient(userId, input.clientId);
  const result = await db.update(clientAccessGrants).set({ status: input.status, acceptedAt: input.status === "active" ? new Date() : null }).where(and(eq(clientAccessGrants.id, input.grantId), eq(clientAccessGrants.clientId, input.clientId), eq(clientAccessGrants.ownerUserId, userId)));
  if (!result[0]?.affectedRows) throw new Error("Convite não encontrado neste cliente.");
  return input.grantId;
}

export async function acceptOwnClientAccessGrant(openId: string, clientId: number) {
  const db = await requireDb();
  const user = (await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.openId, openId)).limit(1))[0];
  if (!user?.email) throw new Error("Seu perfil precisa ter um e-mail confirmado para aceitar um convite.");
  const grant = (await db.select().from(clientAccessGrants).where(and(eq(clientAccessGrants.clientId, clientId), eq(clientAccessGrants.email, user.email.trim().toLowerCase()), eq(clientAccessGrants.status, "pending"))).limit(1))[0];
  if (!grant) throw new Error("Não há convite pendente para este cliente e este e-mail.");
  const portalRole = grant.role === "reviewer" ? "viewer" : grant.role;
  await db.update(clientAccessGrants).set({ status: "active", acceptedAt: new Date() }).where(eq(clientAccessGrants.id, grant.id));
  await db.insert(clientPortalMembers).values({ clientId, userId: user.id, invitedByUserId: grant.invitedByUserId, role: portalRole, status: "active" }).onDuplicateKeyUpdate({ set: { role: portalRole, status: "active", invitedByUserId: grant.invitedByUserId } });
  await db.insert(whatsappAuditLogs).values({ clientId, actorUserId: user.id, action: "portal.invite_accepted", entityType: "client_access_grant", entityId: grant.id, detailsJson: JSON.stringify({ role: grant.role }) });
  return { clientId, role: grant.role };
}

export async function getClientOnboardingProgress(userId: number, clientId: number) {
  const db = await requireDb();
  await assertOwnedSuccessClient(userId, clientId);
  const row = (await db.select().from(clientOnboardingProgress).where(and(eq(clientOnboardingProgress.clientId, clientId), eq(clientOnboardingProgress.ownerUserId, userId))).limit(1))[0];
  return row ? { ...row, completedSteps: parseJsonList(row.completedStepsJson) } : { clientId, currentStep: "brand" as const, completedSteps: [], goals: null, reviewNote: null, completedAt: null };
}

export async function getClientPortalOnboardingProgress(openId: string, clientId: number) {
  await getClientPortalMembershipForSuccess(openId, clientId);
  const db = await requireDb();
  const owner = (await db.select({ ownerUserId: clients.createdByUserId }).from(clients).where(eq(clients.id, clientId)).limit(1))[0];
  if (!owner) throw new Error("Cliente não encontrado.");
  const onboarding = await getClientOnboardingProgress(owner.ownerUserId, clientId);
  return { clientId, currentStep: onboarding.currentStep, completedSteps: onboarding.completedSteps, completedAt: onboarding.completedAt };
}

export async function upsertClientOnboardingProgress(userId: number, input: { clientId: number; currentStep: OnboardingStep; completedSteps: OnboardingStep[]; goals?: string | null; reviewNote?: string | null }) {
  const db = await requireDb();
  await assertOwnedSuccessClient(userId, input.clientId);
  const completedSteps = Array.from(new Set(input.completedSteps.filter(step => step !== "complete")));
  const requiredSteps: Exclude<OnboardingStep, "complete">[] = ["brand", "contacts", "ai", "whatsapp", "goals", "review"];
  const isComplete = input.currentStep === "complete" || requiredSteps.every(step => completedSteps.includes(step));
  const values = { currentStep: isComplete ? "complete" as const : input.currentStep, completedStepsJson: JSON.stringify(completedSteps), goals: input.goals?.trim() || null, reviewNote: input.reviewNote?.trim() || null, completedAt: isComplete ? new Date() : null };
  const existing = (await db.select({ id: clientOnboardingProgress.id }).from(clientOnboardingProgress).where(and(eq(clientOnboardingProgress.clientId, input.clientId), eq(clientOnboardingProgress.ownerUserId, userId))).limit(1))[0];
  if (existing) await db.update(clientOnboardingProgress).set(values).where(eq(clientOnboardingProgress.id, existing.id));
  else await db.insert(clientOnboardingProgress).values({ clientId: input.clientId, ownerUserId: userId, ...values });
  return { ...values, completedSteps };
}

export async function getClientBrandGuidelines(userId: number, clientId: number) {
  const db = await requireDb();
  await assertOwnedSuccessClient(userId, clientId);
  const row = (await db.select().from(clientBrandGuidelines).where(and(eq(clientBrandGuidelines.clientId, clientId), eq(clientBrandGuidelines.ownerUserId, userId))).limit(1))[0];
  if (!row) return null;
  return { ...row, colors: parseJsonList(row.colorsJson), fonts: parseJsonList(row.fontsJson), prohibitedWords: parseJsonList(row.prohibitedWordsJson), approvedCtas: parseJsonList(row.approvedCtasJson), products: parseJsonList(row.productsJson), differentiators: parseJsonList(row.differentiatorsJson) };
}

export async function upsertClientBrandGuidelines(userId: number, input: { clientId: number; colors: string[]; fonts: string[]; toneOfVoice?: string | null; prohibitedWords: string[]; approvedCtas: string[]; products: string[]; differentiators: string[] }) {
  const db = await requireDb();
  await assertOwnedSuccessClient(userId, input.clientId);
  const cleanList = (values: string[]) => Array.from(new Set(values.map(value => value.trim()).filter(Boolean)));
  const values = { colorsJson: JSON.stringify(cleanList(input.colors)), fontsJson: JSON.stringify(cleanList(input.fonts)), toneOfVoice: input.toneOfVoice?.trim() || null, prohibitedWordsJson: JSON.stringify(cleanList(input.prohibitedWords)), approvedCtasJson: JSON.stringify(cleanList(input.approvedCtas)), productsJson: JSON.stringify(cleanList(input.products)), differentiatorsJson: JSON.stringify(cleanList(input.differentiators)) };
  const existing = (await db.select({ id: clientBrandGuidelines.id }).from(clientBrandGuidelines).where(and(eq(clientBrandGuidelines.clientId, input.clientId), eq(clientBrandGuidelines.ownerUserId, userId))).limit(1))[0];
  if (existing) {
    await db.update(clientBrandGuidelines).set(values).where(eq(clientBrandGuidelines.id, existing.id));
    return existing.id;
  }
  const [created] = await db.insert(clientBrandGuidelines).values({ clientId: input.clientId, ownerUserId: userId, ...values }).$returningId();
  return created.id;
}

export async function listSupportTickets(userId: number, clientId?: number) {
  const db = await requireDb();
  if (clientId) await assertOwnedSuccessClient(userId, clientId);
  const conditions = [eq(supportTickets.ownerUserId, userId)];
  if (clientId) conditions.push(eq(supportTickets.clientId, clientId));
  return db.select({ ticket: supportTickets, clientName: clients.name }).from(supportTickets).innerJoin(clients, eq(clients.id, supportTickets.clientId)).where(and(...conditions)).orderBy(desc(supportTickets.updatedAt));
}

export async function getSupportTicket(userId: number, clientId: number, ticketId: number) {
  const db = await requireDb();
  await assertOwnedSuccessClient(userId, clientId);
  const ticket = (await db.select().from(supportTickets).where(and(eq(supportTickets.id, ticketId), eq(supportTickets.clientId, clientId), eq(supportTickets.ownerUserId, userId))).limit(1))[0];
  if (!ticket) throw new Error("Ticket não encontrado neste cliente.");
  const updates = await db.select({ id: supportTicketUpdates.id, ticketId: supportTicketUpdates.ticketId, message: supportTicketUpdates.message, statusAfter: supportTicketUpdates.statusAfter, createdAt: supportTicketUpdates.createdAt, authorName: users.name }).from(supportTicketUpdates).leftJoin(users, eq(users.id, supportTicketUpdates.authorUserId)).where(eq(supportTicketUpdates.ticketId, ticketId)).orderBy(asc(supportTicketUpdates.createdAt));
  return { ticket, updates };
}

export async function createSupportTicket(userId: number, input: { clientId: number; requesterEmail: string; subject: string; description: string; priority: "low" | "normal" | "high" | "urgent"; dueAt?: Date | null }) {
  const db = await requireDb();
  await assertOwnedSuccessClient(userId, input.clientId);
  const [created] = await db.insert(supportTickets).values({ clientId: input.clientId, ownerUserId: userId, requesterEmail: input.requesterEmail.trim().toLowerCase(), subject: input.subject.trim(), description: input.description.trim(), priority: input.priority, dueAt: input.dueAt ?? null }).$returningId();
  await notifyConfiguredClientEvent(userId, input.clientId, "support", { type: "system", title: `Novo ticket: ${input.subject.trim()}`, message: `O ticket #${created.id} foi aberto para acompanhamento.`, actionPath: `/suporte?cliente=${input.clientId}` });
  return created.id;
}

export async function addSupportTicketUpdate(userId: number, input: { clientId: number; ticketId: number; message: string; statusAfter?: "open" | "in_progress" | "waiting_client" | "resolved" | "closed" | null }) {
  const db = await requireDb();
  await assertOwnedSuccessClient(userId, input.clientId);
  const ticket = (await db.select({ id: supportTickets.id }).from(supportTickets).where(and(eq(supportTickets.id, input.ticketId), eq(supportTickets.clientId, input.clientId), eq(supportTickets.ownerUserId, userId))).limit(1))[0];
  if (!ticket) throw new Error("Ticket não encontrado neste cliente.");
  const [created] = await db.insert(supportTicketUpdates).values({ ticketId: input.ticketId, authorUserId: userId, message: input.message.trim(), statusAfter: input.statusAfter ?? null }).$returningId();
  if (input.statusAfter) await db.update(supportTickets).set({ status: input.statusAfter }).where(eq(supportTickets.id, input.ticketId));
  return created.id;
}

export async function listClientPortalSupportTickets(openId: string, clientId: number) {
  await getClientPortalMembershipForSuccess(openId, clientId);
  const db = await requireDb();
  return db.select().from(supportTickets).where(eq(supportTickets.clientId, clientId)).orderBy(desc(supportTickets.updatedAt));
}

export async function createClientPortalSupportTicket(openId: string, input: { clientId: number; subject: string; description: string; priority: "low" | "normal" | "high" | "urgent" }) {
  const db = await requireDb();
  const membership = await getClientPortalMembershipForSuccess(openId, input.clientId);
  if (!portalWriterRoles.has(membership.role)) throw new Error("Seu papel no portal permite apenas consultar os tickets deste cliente.");
  const client = (await db.select({ ownerUserId: clients.createdByUserId }).from(clients).where(eq(clients.id, input.clientId)).limit(1))[0];
  if (!client) throw new Error("Cliente não encontrado.");
  const [created] = await db.insert(supportTickets).values({ clientId: input.clientId, ownerUserId: client.ownerUserId, requesterEmail: membership.email || "portal@vertex.local", subject: input.subject.trim(), description: input.description.trim(), priority: input.priority }).$returningId();
  await notifyConfiguredClientEvent(client.ownerUserId, input.clientId, "support", { type: "system", title: `Novo ticket do portal: ${input.subject.trim()}`, message: `O ticket #${created.id} foi aberto pelo portal do cliente.`, actionPath: `/suporte?cliente=${input.clientId}` });
  return created.id;
}

export async function addClientPortalSupportTicketUpdate(openId: string, input: { clientId: number; ticketId: number; message: string }) {
  const db = await requireDb();
  const membership = await getClientPortalMembershipForSuccess(openId, input.clientId);
  if (!portalWriterRoles.has(membership.role)) throw new Error("Seu papel no portal permite apenas consultar os tickets deste cliente.");
  const ticket = (await db.select({ id: supportTickets.id }).from(supportTickets).where(and(eq(supportTickets.id, input.ticketId), eq(supportTickets.clientId, input.clientId))).limit(1))[0];
  if (!ticket) throw new Error("Ticket não encontrado neste cliente.");
  const [created] = await db.insert(supportTicketUpdates).values({ ticketId: input.ticketId, authorUserId: membership.userId, message: input.message.trim(), statusAfter: "waiting_client" }).$returningId();
  await db.update(supportTickets).set({ status: "waiting_client" }).where(eq(supportTickets.id, input.ticketId));
  return created.id;
}

export async function createExternalApprovalLink(userId: number, input: { clientId: number; campaignId: number; creativeVersionId: number; recipientEmail: string; expiresAt: Date }) {
  const db = await requireDb();
  await assertOwnedSuccessClient(userId, input.clientId);
  if (input.expiresAt.getTime() <= Date.now()) throw new Error("Defina um prazo futuro para a aprovação externa.");
  const version = (await db.select({ id: creativeVersions.id, campaignId: creativeVersions.campaignId, summary: creativeVersions.summary }).from(creativeVersions).innerJoin(adCampaigns, eq(adCampaigns.id, creativeVersions.campaignId)).where(and(eq(creativeVersions.id, input.creativeVersionId), eq(creativeVersions.campaignId, input.campaignId), eq(creativeVersions.ownerUserId, userId), eq(adCampaigns.clientId, input.clientId), eq(adCampaigns.ownerUserId, userId))).limit(1))[0];
  if (!version) throw new Error("A versão criativa não pertence à campanha e ao cliente selecionados.");
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const [created] = await db.insert(externalApprovalLinks).values({ clientId: input.clientId, campaignId: input.campaignId, creativeVersionId: input.creativeVersionId, ownerUserId: userId, recipientEmail: input.recipientEmail.trim().toLowerCase(), tokenHash, expiresAt: input.expiresAt }).$returningId();
  await db.insert(whatsappAuditLogs).values({ clientId: input.clientId, actorUserId: userId, action: "approval.external_link_created", entityType: "external_approval_link", entityId: created.id, detailsJson: JSON.stringify({ campaignId: input.campaignId, creativeVersionId: input.creativeVersionId, expiresAt: input.expiresAt.toISOString() }) });
  return { id: created.id, token, expiresAt: input.expiresAt, creativeSummary: version.summary };
}

export async function listExternalApprovalLinks(userId: number, clientId: number, campaignId?: number) {
  const db = await requireDb();
  await assertOwnedSuccessClient(userId, clientId);
  const conditions = [eq(externalApprovalLinks.clientId, clientId), eq(externalApprovalLinks.ownerUserId, userId)];
  if (campaignId) conditions.push(eq(externalApprovalLinks.campaignId, campaignId));
  const rows = await db.select({ id: externalApprovalLinks.id, clientId: externalApprovalLinks.clientId, campaignId: externalApprovalLinks.campaignId, creativeVersionId: externalApprovalLinks.creativeVersionId, recipientEmail: externalApprovalLinks.recipientEmail, status: externalApprovalLinks.status, decisionNote: externalApprovalLinks.decisionNote, expiresAt: externalApprovalLinks.expiresAt, decidedAt: externalApprovalLinks.decidedAt, createdAt: externalApprovalLinks.createdAt, campaignName: adCampaigns.name, creativeSummary: creativeVersions.summary }).from(externalApprovalLinks).innerJoin(adCampaigns, eq(adCampaigns.id, externalApprovalLinks.campaignId)).innerJoin(creativeVersions, eq(creativeVersions.id, externalApprovalLinks.creativeVersionId)).where(and(...conditions)).orderBy(desc(externalApprovalLinks.createdAt));
  return rows.map(row => row.status === "open" && row.expiresAt.getTime() <= Date.now() ? { ...row, status: "expired" as const } : row);
}

export async function revokeExternalApprovalLink(userId: number, clientId: number, linkId: number) {
  const db = await requireDb();
  await assertOwnedSuccessClient(userId, clientId);
  const result = await db.update(externalApprovalLinks).set({ status: "revoked" }).where(and(eq(externalApprovalLinks.id, linkId), eq(externalApprovalLinks.clientId, clientId), eq(externalApprovalLinks.ownerUserId, userId), eq(externalApprovalLinks.status, "open")));
  if (!result[0]?.affectedRows) throw new Error("O link não está disponível para revogação.");
  await db.insert(whatsappAuditLogs).values({ clientId, actorUserId: userId, action: "approval.external_link_revoked", entityType: "external_approval_link", entityId: linkId, detailsJson: null });
  return linkId;
}

export async function getExternalApprovalByToken(token: string) {
  const db = await requireDb();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const row = (await db.select({ id: externalApprovalLinks.id, clientId: externalApprovalLinks.clientId, campaignId: externalApprovalLinks.campaignId, creativeVersionId: externalApprovalLinks.creativeVersionId, status: externalApprovalLinks.status, decisionNote: externalApprovalLinks.decisionNote, expiresAt: externalApprovalLinks.expiresAt, decidedAt: externalApprovalLinks.decidedAt, campaignName: adCampaigns.name, campaignObjective: adCampaigns.objective, creativeKind: creativeVersions.kind, versionNumber: creativeVersions.versionNumber, creativeSummary: creativeVersions.summary, payloadJson: creativeVersions.payloadJson, creativeStatus: creativeVersions.status }).from(externalApprovalLinks).innerJoin(adCampaigns, eq(adCampaigns.id, externalApprovalLinks.campaignId)).innerJoin(creativeVersions, eq(creativeVersions.id, externalApprovalLinks.creativeVersionId)).where(eq(externalApprovalLinks.tokenHash, tokenHash)).limit(1))[0];
  if (!row) throw new Error("Link de aprovação inválido ou indisponível.");
  if (row.status === "open" && row.expiresAt.getTime() <= Date.now()) {
    await db.update(externalApprovalLinks).set({ status: "expired" }).where(eq(externalApprovalLinks.id, row.id));
    return { ...row, status: "expired" as const };
  }
  return row;
}

export async function decideExternalApprovalByToken(token: string, input: { decision: "approved" | "changes_requested"; note?: string | null }) {
  const db = await requireDb();
  const approval = await getExternalApprovalByToken(token);
  if (approval.status !== "open") throw new Error("Esta aprovação já foi encerrada e não aceita nova decisão.");
  const status = input.decision;
  await db.update(externalApprovalLinks).set({ status, decisionNote: input.note?.trim() || null, decidedAt: new Date() }).where(and(eq(externalApprovalLinks.id, approval.id), eq(externalApprovalLinks.status, "open")));
  const owner = (await db.select({ ownerUserId: externalApprovalLinks.ownerUserId }).from(externalApprovalLinks).where(eq(externalApprovalLinks.id, approval.id)).limit(1))[0];
  if (owner) {
    await db.insert(whatsappAuditLogs).values({ clientId: approval.clientId, actorUserId: null, action: "approval.external_decision", entityType: "external_approval_link", entityId: approval.id, detailsJson: JSON.stringify({ decision: input.decision, hasNote: Boolean(input.note?.trim()) }) });
    await notifyConfiguredClientEvent(owner.ownerUserId, approval.clientId, "approvals", { type: "approval", title: `Aprovação externa ${input.decision === "approved" ? "concluída" : "com ajustes"}`, message: `A campanha “${approval.campaignName}” recebeu uma decisão externa.`, actionPath: `/agencia?campanha=${approval.campaignId}` });
  }
  return { id: approval.id, status, decidedAt: new Date() };
}

export async function getClientNotificationPreferences(userId: number, clientId: number) {
  const db = await requireDb();
  await assertOwnedSuccessClient(userId, clientId);
  const row = (await db.select().from(clientNotificationPreferences).where(and(eq(clientNotificationPreferences.clientId, clientId), eq(clientNotificationPreferences.ownerUserId, userId))).limit(1))[0];
  if (!row) return { clientId, events: { ...defaultNotificationEvents }, updatedAt: null };
  let events: Partial<Record<ClientNotificationEvent, boolean>> = {};
  try { events = JSON.parse(row.eventsJson) as Partial<Record<ClientNotificationEvent, boolean>>; } catch { events = {}; }
  return { id: row.id, clientId: row.clientId, events: normalizeNotificationEvents(events), updatedAt: row.updatedAt };
}

export async function upsertClientNotificationPreferences(userId: number, input: { clientId: number; events: Partial<Record<ClientNotificationEvent, boolean>> }) {
  const db = await requireDb();
  await assertOwnedSuccessClient(userId, input.clientId);
  const events = normalizeNotificationEvents(input.events);
  const existing = (await db.select({ id: clientNotificationPreferences.id }).from(clientNotificationPreferences).where(and(eq(clientNotificationPreferences.clientId, input.clientId), eq(clientNotificationPreferences.ownerUserId, userId))).limit(1))[0];
  if (existing) {
    await db.update(clientNotificationPreferences).set({ eventsJson: JSON.stringify(events) }).where(eq(clientNotificationPreferences.id, existing.id));
    return existing.id;
  }
  const [created] = await db.insert(clientNotificationPreferences).values({ clientId: input.clientId, ownerUserId: userId, eventsJson: JSON.stringify(events) }).$returningId();
  return created.id;
}

export async function getClientHealth(userId: number, clientId: number) {
  const db = await requireDb();
  const client = await assertOwnedSuccessClient(userId, clientId);
  const monthStart = getCurrentMonthStart();
  const [onboarding, subscriptionRows, channels, credentials, tickets, emailFailures, pendingApprovals, usage] = await Promise.all([
    getClientOnboardingProgress(userId, clientId),
    db.select({ status: saasSubscriptions.status, currentPeriodEnd: saasSubscriptions.currentPeriodEnd, planName: saasPlans.name }).from(saasSubscriptions).leftJoin(saasPlans, eq(saasPlans.id, saasSubscriptions.planId)).where(and(eq(saasSubscriptions.clientId, clientId), eq(saasSubscriptions.ownerUserId, userId))).limit(1),
    db.select({ id: whatsappChannels.id, status: whatsappChannels.status, lastError: whatsappChannels.lastError }).from(whatsappChannels).where(and(eq(whatsappChannels.clientId, clientId), eq(whatsappChannels.ownerUserId, userId))),
    db.select({ id: clientAiConnections.id, status: clientAiConnections.status, lastTestedAt: clientAiConnections.lastTestedAt }).from(clientAiConnections).where(and(eq(clientAiConnections.clientId, clientId), eq(clientAiConnections.ownerUserId, userId))),
    db.select({ id: supportTickets.id, status: supportTickets.status, priority: supportTickets.priority }).from(supportTickets).where(and(eq(supportTickets.clientId, clientId), eq(supportTickets.ownerUserId, userId))),
    db.select({ id: approvalHistoryEmailDeliveries.id }).from(approvalHistoryEmailDeliveries).where(and(eq(approvalHistoryEmailDeliveries.clientId, clientId), eq(approvalHistoryEmailDeliveries.status, "failed"))),
    db.select({ id: creativeVersions.id }).from(creativeVersions).innerJoin(adCampaigns, eq(adCampaigns.id, creativeVersions.campaignId)).where(and(eq(adCampaigns.clientId, clientId), eq(creativeVersions.ownerUserId, userId), eq(creativeVersions.status, "review"))),
    db.select({ id: aiGenerations.id }).from(aiGenerations).innerJoin(adCampaigns, eq(adCampaigns.id, aiGenerations.campaignId)).where(and(eq(adCampaigns.clientId, clientId), eq(aiGenerations.ownerUserId, userId), gte(aiGenerations.createdAt, monthStart))),
  ]);
  const subscription = subscriptionRows[0] ?? null;
  const activeChannels = channels.filter(channel => channel.status === "active").length;
  const credentialHealthy = credentials.some(credential => credential.status === "active" && credential.lastTestedAt);
  const openTickets = tickets.filter(ticket => !["resolved", "closed"].includes(ticket.status));
  const urgentTickets = openTickets.filter(ticket => ticket.priority === "urgent" || ticket.priority === "high");
  const onboardingComplete = onboarding.currentStep === "complete";
  const limit = (await db.select({ monthlyApiCallLimit: clients.monthlyApiCallLimit }).from(clients).where(eq(clients.id, clientId)).limit(1))[0]?.monthlyApiCallLimit ?? null;
  const usagePercent = limit ? Math.round((usage.length / limit) * 100) : null;
  const nextActions = [
    !onboardingComplete ? "Concluir as etapas restantes do onboarding." : null,
    !credentialHealthy ? "Validar uma credencial de IA ativa para o cliente." : null,
    channels.length === 0 ? "Configurar um canal de WhatsApp quando aplicável ao contrato." : activeChannels === 0 ? "Revisar o status dos canais de WhatsApp." : null,
    urgentTickets.length ? "Priorizar tickets de suporte críticos ou altos." : null,
    pendingApprovals.length ? "Concluir versões criativas pendentes de revisão." : null,
    emailFailures.length ? "Revisar os alertas de falha de e-mail." : null,
    usagePercent !== null && usagePercent >= 80 ? "Revisar o consumo de IA próximo ao limite mensal." : null,
  ].filter((action): action is string => Boolean(action));
  const score = Math.max(0, 100 - (onboardingComplete ? 0 : 20) - (credentialHealthy ? 0 : 15) - (channels.length && activeChannels === 0 ? 15 : 0) - Math.min(25, urgentTickets.length * 10) - Math.min(15, emailFailures.length * 5) - (usagePercent !== null && usagePercent >= 100 ? 10 : usagePercent !== null && usagePercent >= 80 ? 5 : 0));
  return { client, score, status: score >= 85 ? "healthy" as const : score >= 60 ? "attention" as const : "risk" as const, onboarding: { currentStep: onboarding.currentStep, completedSteps: onboarding.completedSteps, complete: onboardingComplete }, subscription, ai: { activeCredentials: credentials.filter(credential => credential.status === "active").length, credentialHealthy, monthlyRequests: usage.length, monthlyLimit: limit, usagePercent }, channels: { total: channels.length, active: activeChannels, withErrors: channels.filter(channel => Boolean(channel.lastError)).length }, support: { open: openTickets.length, urgentOrHigh: urgentTickets.length }, approvals: { pending: pendingApprovals.length }, email: { recentFailures: emailFailures.length }, nextActions };
}

export async function createExecutiveReport(userId: number, input: { clientId: number; periodStart: Date; periodEnd: Date; title: string; summary: string; metrics: Record<string, unknown> }) {
  const db = await requireDb();
  await assertOwnedSuccessClient(userId, input.clientId);
  if (input.periodEnd.getTime() < input.periodStart.getTime()) throw new Error("O período final do relatório deve ser posterior ao inicial.");
  const [created] = await db.insert(executiveReports).values({ clientId: input.clientId, ownerUserId: userId, periodStart: input.periodStart, periodEnd: input.periodEnd, title: input.title.trim(), summary: input.summary.trim(), metricsJson: JSON.stringify(input.metrics) }).$returningId();
  return created.id;
}

export async function listExecutiveReports(userId: number, clientId: number) {
  const db = await requireDb();
  await assertOwnedSuccessClient(userId, clientId);
  const rows = await db.select().from(executiveReports).where(and(eq(executiveReports.clientId, clientId), eq(executiveReports.ownerUserId, userId))).orderBy(desc(executiveReports.createdAt));
  return rows.map(row => {
    let metrics: Record<string, unknown> = {};
    try { metrics = JSON.parse(row.metricsJson) as Record<string, unknown>; } catch { metrics = {}; }
    return { ...row, metrics };
  });
}

/** Exportação administrativa de dados: não contém chaves, cifras de credenciais, tokens ou configurações secretas. */
export async function exportClientBackupSnapshot(userId: number, clientId: number) {
  const db = await requireDb();
  const client = await assertOwnedSuccessClient(userId, clientId);
  const [profile, onboarding, guidelines, grants, preferences, campaigns, channels, policy, subscription, tickets, reports, approvals] = await Promise.all([
    db.select().from(clientAgencyProfiles).where(and(eq(clientAgencyProfiles.clientId, clientId), eq(clientAgencyProfiles.ownerUserId, userId))).limit(1),
    getClientOnboardingProgress(userId, clientId),
    getClientBrandGuidelines(userId, clientId),
    listClientAccessGrants(userId, clientId),
    getClientNotificationPreferences(userId, clientId),
    db.select({ id: adCampaigns.id, name: adCampaigns.name, mode: adCampaigns.mode, objective: adCampaigns.objective, status: adCampaigns.status, briefingJson: adCampaigns.briefingJson, createdAt: adCampaigns.createdAt, updatedAt: adCampaigns.updatedAt }).from(adCampaigns).where(and(eq(adCampaigns.clientId, clientId), eq(adCampaigns.ownerUserId, userId))).orderBy(desc(adCampaigns.updatedAt)),
    db.select({ id: whatsappChannels.id, label: whatsappChannels.label, provider: whatsappChannels.provider, status: whatsappChannels.status, displayPhoneNumber: whatsappChannels.displayPhoneNumber, externalAccountId: whatsappChannels.externalAccountId, externalSenderId: whatsappChannels.externalSenderId, verifiedAt: whatsappChannels.verifiedAt, lastInboundAt: whatsappChannels.lastInboundAt, lastOutboundAt: whatsappChannels.lastOutboundAt, lastError: whatsappChannels.lastError, createdAt: whatsappChannels.createdAt, updatedAt: whatsappChannels.updatedAt }).from(whatsappChannels).where(and(eq(whatsappChannels.clientId, clientId), eq(whatsappChannels.ownerUserId, userId))),
    db.select({ aiAccessMode: whatsappAiPolicies.aiAccessMode, workflowMode: whatsappAiPolicies.workflowMode, systemInstructions: whatsappAiPolicies.systemInstructions, businessHoursJson: whatsappAiPolicies.businessHoursJson, handoffKeywordsJson: whatsappAiPolicies.handoffKeywordsJson, monthlyManagedMessageLimit: whatsappAiPolicies.monthlyManagedMessageLimit, updatedAt: whatsappAiPolicies.updatedAt }).from(whatsappAiPolicies).where(and(eq(whatsappAiPolicies.clientId, clientId), eq(whatsappAiPolicies.ownerUserId, userId))).limit(1),
    db.select({ status: saasSubscriptions.status, interval: saasSubscriptions.interval, currentPeriodEnd: saasSubscriptions.currentPeriodEnd, managedAiAddOn: saasSubscriptions.managedAiAddOn, managedAiMonthlyLimit: saasSubscriptions.managedAiMonthlyLimit, planName: saasPlans.name }).from(saasSubscriptions).leftJoin(saasPlans, eq(saasPlans.id, saasSubscriptions.planId)).where(and(eq(saasSubscriptions.clientId, clientId), eq(saasSubscriptions.ownerUserId, userId))).limit(1),
    db.select().from(supportTickets).where(and(eq(supportTickets.clientId, clientId), eq(supportTickets.ownerUserId, userId))).orderBy(desc(supportTickets.updatedAt)),
    listExecutiveReports(userId, clientId),
    listExternalApprovalLinks(userId, clientId),
  ]);
  const ticketIds = tickets.map(ticket => ticket.id);
  const updates = ticketIds.length ? await db.select({ id: supportTicketUpdates.id, ticketId: supportTicketUpdates.ticketId, message: supportTicketUpdates.message, statusAfter: supportTicketUpdates.statusAfter, createdAt: supportTicketUpdates.createdAt }).from(supportTicketUpdates).where(eq(supportTicketUpdates.ticketId, ticketIds[0])).orderBy(asc(supportTicketUpdates.createdAt)) : [];
  return { format: "vertex-client-backup/v1", exportedAt: new Date().toISOString(), restoreInstructions: "Importe somente em ambiente administrativo VERTEX, valide o cliente de destino, reconcilie IDs relacionados e nunca substitua dados existentes sem um backup prévio. Credenciais de IA e de canais não são exportadas e devem ser reconfiguradas manualmente.", client: { id: client.id, name: client.name, contactEmail: client.contactEmail }, profile: profile[0] ?? null, onboarding, brandGuidelines: guidelines, accessGrants: grants, notificationPreferences: preferences, campaigns, whatsapp: { channels, policy: policy[0] ?? null, subscription: subscription[0] ?? null }, support: { tickets, updates }, executiveReports: reports, externalApprovals: approvals };
}

type SalesLeadStatus = "new" | "qualified" | "proposal" | "negotiation" | "won" | "lost" | "archived";
type ProposalStatus = "draft" | "sent" | "viewed" | "accepted" | "rejected" | "expired";
type ContractStatus = "draft" | "active" | "suspended" | "ended" | "renewal_due";
type FinancialEntryType = "revenue" | "expense" | "media_spend" | "refund";
type FinancialEntryStatus = "planned" | "invoiced" | "paid" | "overdue" | "cancelled";

async function assertOwnedOperator(userId: number, operatorId: number | null | undefined) {
  if (!operatorId) return;
  const db = await requireDb();
  const operator = (await db
    .select({ id: operators.id })
    .from(operators)
    .where(and(eq(operators.id, operatorId), eq(operators.createdByUserId, userId)))
    .limit(1))[0];
  if (!operator) throw new Error("Responsável inválido para este espaço de trabalho.");
}

async function getOwnedSalesLead(userId: number, leadId: number) {
  const db = await requireDb();
  const lead = (await db
    .select()
    .from(salesLeads)
    .where(and(eq(salesLeads.id, leadId), eq(salesLeads.ownerUserId, userId)))
    .limit(1))[0];
  if (!lead) throw new Error("Lead não encontrado neste espaço de trabalho.");
  return lead;
}

async function getOwnedServiceContract(userId: number, clientId: number, contractId: number) {
  const db = await requireDb();
  const contract = (await db
    .select()
    .from(serviceContracts)
    .where(and(eq(serviceContracts.id, contractId), eq(serviceContracts.clientId, clientId), eq(serviceContracts.ownerUserId, userId)))
    .limit(1))[0];
  if (!contract) throw new Error("Contrato não encontrado para este cliente.");
  return contract;
}

export async function listSalesLeads(userId: number, status?: SalesLeadStatus) {
  const db = await requireDb();
  const conditions = [eq(salesLeads.ownerUserId, userId)];
  if (status) conditions.push(eq(salesLeads.status, status));
  return db
    .select({ lead: salesLeads, responsible: operators, convertedClient: clients })
    .from(salesLeads)
    .leftJoin(operators, eq(operators.id, salesLeads.responsibleOperatorId))
    .leftJoin(clients, eq(clients.id, salesLeads.convertedClientId))
    .where(and(...conditions))
    .orderBy(asc(salesLeads.nextActionAt), desc(salesLeads.updatedAt));
}

export async function createSalesLead(userId: number, input: {
  companyName: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  source?: string | null;
  responsibleOperatorId?: number | null;
  score?: number | null;
  estimatedMonthlyRevenueCents?: number | null;
  nextActionAt?: Date | null;
  notes?: string | null;
}) {
  const db = await requireDb();
  await assertOwnedOperator(userId, input.responsibleOperatorId);
  const [created] = await db
    .insert(salesLeads)
    .values({
      ownerUserId: userId,
      companyName: input.companyName.trim(),
      contactName: input.contactName?.trim() || null,
      contactEmail: input.contactEmail?.trim().toLowerCase() || null,
      contactPhone: input.contactPhone?.trim() || null,
      source: input.source?.trim() || null,
      responsibleOperatorId: input.responsibleOperatorId ?? null,
      score: input.score == null ? null : Math.max(0, Math.min(100, input.score)),
      estimatedMonthlyRevenueCents: input.estimatedMonthlyRevenueCents ?? null,
      nextActionAt: input.nextActionAt ?? null,
      notes: input.notes?.trim() || null,
    })
    .$returningId();
  return created.id;
}

export async function updateSalesLead(userId: number, input: {
  leadId: number;
  status?: SalesLeadStatus;
  responsibleOperatorId?: number | null;
  score?: number | null;
  estimatedMonthlyRevenueCents?: number | null;
  nextActionAt?: Date | null;
  lostReason?: string | null;
  notes?: string | null;
}) {
  const db = await requireDb();
  await getOwnedSalesLead(userId, input.leadId);
  await assertOwnedOperator(userId, input.responsibleOperatorId);
  const values: Partial<typeof salesLeads.$inferInsert> = {};
  if (input.status) values.status = input.status;
  if (input.responsibleOperatorId !== undefined) values.responsibleOperatorId = input.responsibleOperatorId;
  if (input.score !== undefined) values.score = input.score == null ? null : Math.max(0, Math.min(100, input.score));
  if (input.estimatedMonthlyRevenueCents !== undefined) values.estimatedMonthlyRevenueCents = input.estimatedMonthlyRevenueCents;
  if (input.nextActionAt !== undefined) values.nextActionAt = input.nextActionAt;
  if (input.lostReason !== undefined) values.lostReason = input.lostReason?.trim() || null;
  if (input.notes !== undefined) values.notes = input.notes?.trim() || null;
  await db.update(salesLeads).set(values).where(and(eq(salesLeads.id, input.leadId), eq(salesLeads.ownerUserId, userId)));
  return input.leadId;
}

export async function listSalesActivities(userId: number, leadId: number) {
  const db = await requireDb();
  await getOwnedSalesLead(userId, leadId);
  return db
    .select({ activity: salesActivities, author: users })
    .from(salesActivities)
    .leftJoin(users, eq(users.id, salesActivities.authorUserId))
    .where(eq(salesActivities.leadId, leadId))
    .orderBy(desc(salesActivities.occurredAt));
}

export async function createSalesActivity(userId: number, input: {
  leadId: number;
  activityType: "note" | "call" | "email" | "meeting" | "task" | "status_change";
  description: string;
  nextActionAt?: Date | null;
}) {
  const db = await requireDb();
  await getOwnedSalesLead(userId, input.leadId);
  const [created] = await db
    .insert(salesActivities)
    .values({ leadId: input.leadId, authorUserId: userId, activityType: input.activityType, description: input.description.trim(), nextActionAt: input.nextActionAt ?? null })
    .$returningId();
  if (input.nextActionAt !== undefined) {
    await db.update(salesLeads).set({ nextActionAt: input.nextActionAt ?? null }).where(eq(salesLeads.id, input.leadId));
  }
  return created.id;
}

export async function listCommercialProposals(userId: number, input?: { leadId?: number; clientId?: number; status?: ProposalStatus }) {
  const db = await requireDb();
  if (input?.leadId) await getOwnedSalesLead(userId, input.leadId);
  if (input?.clientId) await assertOwnedSuccessClient(userId, input.clientId);
  const conditions = [eq(commercialProposals.ownerUserId, userId)];
  if (input?.leadId) conditions.push(eq(commercialProposals.leadId, input.leadId));
  if (input?.clientId) conditions.push(eq(commercialProposals.clientId, input.clientId));
  if (input?.status) conditions.push(eq(commercialProposals.status, input.status));
  return db
    .select({ proposal: commercialProposals, lead: salesLeads, client: clients })
    .from(commercialProposals)
    .leftJoin(salesLeads, eq(salesLeads.id, commercialProposals.leadId))
    .leftJoin(clients, eq(clients.id, commercialProposals.clientId))
    .where(and(...conditions))
    .orderBy(desc(commercialProposals.updatedAt));
}

export async function createCommercialProposal(userId: number, input: {
  leadId?: number | null;
  clientId?: number | null;
  proposalNumber: string;
  title: string;
  scope: string;
  amountCents: number;
  currency?: string;
  validUntil?: Date | null;
}) {
  const db = await requireDb();
  if (!input.leadId && !input.clientId) throw new Error("Associe a proposta a um lead ou cliente.");
  if (input.leadId) await getOwnedSalesLead(userId, input.leadId);
  if (input.clientId) await assertOwnedSuccessClient(userId, input.clientId);
  const [created] = await db
    .insert(commercialProposals)
    .values({
      ownerUserId: userId,
      leadId: input.leadId ?? null,
      clientId: input.clientId ?? null,
      proposalNumber: input.proposalNumber.trim(),
      title: input.title.trim(),
      scope: input.scope.trim(),
      amountCents: Math.max(0, input.amountCents),
      currency: (input.currency || "BRL").toUpperCase().slice(0, 3),
      validUntil: input.validUntil ?? null,
    })
    .$returningId();
  return created.id;
}

export async function updateCommercialProposalStatus(userId: number, proposalId: number, status: ProposalStatus) {
  const db = await requireDb();
  const proposal = (await db.select({ id: commercialProposals.id }).from(commercialProposals).where(and(eq(commercialProposals.id, proposalId), eq(commercialProposals.ownerUserId, userId))).limit(1))[0];
  if (!proposal) throw new Error("Proposta não encontrada neste espaço de trabalho.");
  const now = new Date();
  await db.update(commercialProposals).set({ status, sentAt: status === "sent" ? now : undefined, decidedAt: ["accepted", "rejected"].includes(status) ? now : undefined }).where(eq(commercialProposals.id, proposalId));
  return proposalId;
}

export async function listServiceContracts(userId: number, clientId?: number) {
  const db = await requireDb();
  if (clientId) await assertOwnedSuccessClient(userId, clientId);
  const conditions = [eq(serviceContracts.ownerUserId, userId)];
  if (clientId) conditions.push(eq(serviceContracts.clientId, clientId));
  return db
    .select({ contract: serviceContracts, client: clients, proposal: commercialProposals, lead: salesLeads })
    .from(serviceContracts)
    .innerJoin(clients, eq(clients.id, serviceContracts.clientId))
    .leftJoin(commercialProposals, eq(commercialProposals.id, serviceContracts.proposalId))
    .leftJoin(salesLeads, eq(salesLeads.id, serviceContracts.leadId))
    .where(and(...conditions))
    .orderBy(desc(serviceContracts.updatedAt));
}

export async function createServiceContract(userId: number, input: {
  clientId: number;
  leadId?: number | null;
  proposalId?: number | null;
  code: string;
  title: string;
  scope: string;
  billingCycle: "monthly" | "annual" | "project";
  recurringRevenueCents?: number | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
}) {
  const db = await requireDb();
  await assertOwnedSuccessClient(userId, input.clientId);
  if (input.leadId) await getOwnedSalesLead(userId, input.leadId);
  if (input.proposalId) {
    const proposal = (await db.select({ id: commercialProposals.id, clientId: commercialProposals.clientId }).from(commercialProposals).where(and(eq(commercialProposals.id, input.proposalId), eq(commercialProposals.ownerUserId, userId))).limit(1))[0];
    if (!proposal || (proposal.clientId !== null && proposal.clientId !== input.clientId)) throw new Error("A proposta não pode ser vinculada a este cliente.");
  }
  if (input.startsAt && input.endsAt && input.endsAt.getTime() < input.startsAt.getTime()) throw new Error("A vigência final deve ser posterior ao início do contrato.");
  const [created] = await db
    .insert(serviceContracts)
    .values({ ...input, ownerUserId: userId, status: "draft", code: input.code.trim(), title: input.title.trim(), scope: input.scope.trim(), recurringRevenueCents: input.recurringRevenueCents ?? null, startsAt: input.startsAt ?? null, endsAt: input.endsAt ?? null })
    .$returningId();
  return created.id;
}

export async function updateServiceContractStatus(userId: number, input: { clientId: number; contractId: number; status: ContractStatus; signedAt?: Date | null }) {
  const db = await requireDb();
  await getOwnedServiceContract(userId, input.clientId, input.contractId);
  await db.update(serviceContracts).set({ status: input.status, signedAt: input.signedAt === undefined ? undefined : input.signedAt }).where(eq(serviceContracts.id, input.contractId));
  return input.contractId;
}

export async function listFinancialEntries(userId: number, clientId?: number) {
  const db = await requireDb();
  if (clientId) await assertOwnedSuccessClient(userId, clientId);
  const conditions = [eq(financialEntries.ownerUserId, userId)];
  if (clientId) conditions.push(eq(financialEntries.clientId, clientId));
  return db
    .select({ entry: financialEntries, client: clients, contract: serviceContracts, project: projects })
    .from(financialEntries)
    .innerJoin(clients, eq(clients.id, financialEntries.clientId))
    .leftJoin(serviceContracts, eq(serviceContracts.id, financialEntries.contractId))
    .leftJoin(projects, eq(projects.id, financialEntries.projectId))
    .where(and(...conditions))
    .orderBy(desc(financialEntries.dueAt), desc(financialEntries.updatedAt));
}

export async function createFinancialEntry(userId: number, input: {
  clientId: number;
  contractId?: number | null;
  projectId?: number | null;
  entryType: FinancialEntryType;
  status?: FinancialEntryStatus;
  category?: string | null;
  description: string;
  amountCents: number;
  currency?: string;
  dueAt?: Date | null;
  paidAt?: Date | null;
}) {
  const db = await requireDb();
  await assertOwnedSuccessClient(userId, input.clientId);
  if (input.contractId) await getOwnedServiceContract(userId, input.clientId, input.contractId);
  if (input.projectId) {
    const project = (await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, input.projectId), eq(projects.clientId, input.clientId), eq(projects.ownerUserId, userId))).limit(1))[0];
    if (!project) throw new Error("Projeto não encontrado para este cliente.");
  }
  const [created] = await db
    .insert(financialEntries)
    .values({ ...input, ownerUserId: userId, contractId: input.contractId ?? null, projectId: input.projectId ?? null, category: input.category?.trim() || null, description: input.description.trim(), amountCents: Math.max(0, input.amountCents), currency: (input.currency || "BRL").toUpperCase().slice(0, 3), status: input.status ?? "planned", dueAt: input.dueAt ?? null, paidAt: input.paidAt ?? null })
    .$returningId();
  return created.id;
}

export async function getClientProfitability(userId: number, clientId: number) {
  const db = await requireDb();
  await assertOwnedSuccessClient(userId, clientId);
  const [entries, contracts, time] = await Promise.all([
    db.select().from(financialEntries).where(and(eq(financialEntries.ownerUserId, userId), eq(financialEntries.clientId, clientId), inArray(financialEntries.status, ["invoiced", "paid", "overdue"]))),
    db.select().from(serviceContracts).where(and(eq(serviceContracts.ownerUserId, userId), eq(serviceContracts.clientId, clientId), eq(serviceContracts.status, "active"))),
    db.select().from(timeEntries).where(and(eq(timeEntries.ownerUserId, userId), eq(timeEntries.clientId, clientId))),
  ]);
  const revenueCents = entries.filter(entry => entry.entryType === "revenue").reduce((sum, entry) => sum + entry.amountCents, 0);
  const refundCents = entries.filter(entry => entry.entryType === "refund").reduce((sum, entry) => sum + entry.amountCents, 0);
  const directCostCents = entries.filter(entry => entry.entryType === "expense" || entry.entryType === "media_spend").reduce((sum, entry) => sum + entry.amountCents, 0);
  const laborCostCents = time.reduce((sum, entry) => sum + (entry.internalCostCents ?? 0), 0);
  const netRevenueCents = revenueCents - refundCents;
  const totalCostCents = directCostCents + laborCostCents;
  const marginCents = netRevenueCents - totalCostCents;
  const mrrCents = contracts.reduce((sum, contract) => sum + (contract.billingCycle === "monthly" ? contract.recurringRevenueCents ?? 0 : contract.billingCycle === "annual" ? Math.round((contract.recurringRevenueCents ?? 0) / 12) : 0), 0);
  return { clientId, revenueCents, refundCents, directCostCents, laborCostCents, totalCostCents, marginCents, marginPercent: netRevenueCents > 0 ? Math.round((marginCents / netRevenueCents) * 100) : null, mrrCents, hoursWorked: Math.round(time.reduce((sum, entry) => sum + entry.workedMinutes, 0) / 60 * 10) / 10, overdueEntries: entries.filter(entry => entry.status === "overdue").length };
}

export async function listAssetUsageRights(userId: number, clientId: number) {
  const db = await requireOwnedAgencyClient(userId, clientId);
  return db
    .select({ right: assetUsageRights, asset: clientBrandAssets })
    .from(assetUsageRights)
    .innerJoin(clientBrandAssets, eq(clientBrandAssets.id, assetUsageRights.brandAssetId))
    .where(and(eq(assetUsageRights.ownerUserId, userId), eq(assetUsageRights.clientId, clientId)))
    .orderBy(asc(assetUsageRights.expiresAt), desc(assetUsageRights.updatedAt));
}

export async function upsertAssetUsageRight(userId: number, input: {
  clientId: number; brandAssetId: number; versionLabel: string; licenseType: "owned" | "licensed" | "stock" | "partner" | "editorial" | "unknown";
  usageScope?: string | null; sourceUrl?: string | null; status: "active" | "expiring" | "expired" | "restricted"; expiresAt?: Date | null; reviewedAt?: Date | null;
}) {
  const db = await requireOwnedAgencyClient(userId, input.clientId);
  const asset = await db.select({ id: clientBrandAssets.id }).from(clientBrandAssets).where(and(eq(clientBrandAssets.id, input.brandAssetId), eq(clientBrandAssets.clientId, input.clientId), eq(clientBrandAssets.ownerUserId, userId))).limit(1);
  if (!asset[0]) throw new Error("Ativo de marca não encontrado para este cliente.");
  const versionLabel = input.versionLabel.trim() || "Versão atual";
  const existing = await db.select({ id: assetUsageRights.id }).from(assetUsageRights).where(and(eq(assetUsageRights.brandAssetId, input.brandAssetId), eq(assetUsageRights.versionLabel, versionLabel))).limit(1);
  const values = { versionLabel, licenseType: input.licenseType, usageScope: input.usageScope?.trim() || null, sourceUrl: input.sourceUrl?.trim() || null, status: input.status, expiresAt: input.expiresAt ?? null, reviewedAt: input.reviewedAt ?? null };
  if (existing[0]) {
    await db.update(assetUsageRights).set(values).where(eq(assetUsageRights.id, existing[0].id));
    return existing[0].id;
  }
  const [created] = await db.insert(assetUsageRights).values({ ...values, ownerUserId: userId, clientId: input.clientId, brandAssetId: input.brandAssetId }).$returningId();
  return created.id;
}

export async function listCapacityPlans(userId: number) {
  const db = await requireDb();
  return db
    .select({ plan: capacityPlans, operator: operators, team: teams })
    .from(capacityPlans)
    .innerJoin(operators, eq(operators.id, capacityPlans.operatorId))
    .leftJoin(teams, eq(teams.id, capacityPlans.teamId))
    .where(eq(capacityPlans.ownerUserId, userId))
    .orderBy(asc(capacityPlans.periodStart), asc(operators.name));
}

export async function upsertCapacityPlan(userId: number, input: { operatorId: number; teamId?: number | null; periodStart: Date; capacityMinutes: number; bookedMinutes: number; notes?: string | null }) {
  const db = await requireDb();
  await assertOwnedOperator(userId, input.operatorId);
  if (input.teamId) {
    const team = await db.select({ id: teams.id }).from(teams).where(and(eq(teams.id, input.teamId), eq(teams.createdByUserId, userId))).limit(1);
    if (!team[0]) throw new Error("Equipe não encontrada neste espaço de trabalho.");
  }
  const capacityMinutes = Math.max(0, Math.floor(input.capacityMinutes));
  const bookedMinutes = Math.max(0, Math.floor(input.bookedMinutes));
  const existing = await db.select({ id: capacityPlans.id }).from(capacityPlans).where(and(eq(capacityPlans.operatorId, input.operatorId), eq(capacityPlans.periodStart, input.periodStart))).limit(1);
  const values = { teamId: input.teamId ?? null, capacityMinutes, bookedMinutes, notes: input.notes?.trim() || null };
  if (existing[0]) {
    await db.update(capacityPlans).set(values).where(eq(capacityPlans.id, existing[0].id));
    return existing[0].id;
  }
  const [created] = await db.insert(capacityPlans).values({ ...values, ownerUserId: userId, operatorId: input.operatorId, periodStart: input.periodStart }).$returningId();
  return created.id;
}

export async function listClientConsents(userId: number, clientId: number) {
  const db = await requireOwnedAgencyClient(userId, clientId);
  return db.select().from(clientConsents).where(and(eq(clientConsents.ownerUserId, userId), eq(clientConsents.clientId, clientId))).orderBy(desc(clientConsents.updatedAt));
}

export async function createClientConsent(userId: number, input: { clientId: number; subjectName?: string | null; subjectEmail?: string | null; consentType: "marketing" | "data_processing" | "whatsapp" | "email" | "terms"; status: "granted" | "revoked" | "pending"; legalBasis?: string | null; evidenceUrl?: string | null }) {
  const db = await requireOwnedAgencyClient(userId, input.clientId);
  const now = new Date();
  const [created] = await db.insert(clientConsents).values({ ...input, ownerUserId: userId, subjectName: input.subjectName?.trim() || null, subjectEmail: input.subjectEmail?.trim().toLowerCase() || null, legalBasis: input.legalBasis?.trim() || null, evidenceUrl: input.evidenceUrl?.trim() || null, grantedAt: input.status === "granted" ? now : null, revokedAt: input.status === "revoked" ? now : null }).$returningId();
  return created.id;
}

export async function updateClientConsentStatus(userId: number, input: { clientId: number; consentId: number; status: "granted" | "revoked" | "pending" }) {
  const db = await requireOwnedAgencyClient(userId, input.clientId);
  const consent = await db.select({ id: clientConsents.id }).from(clientConsents).where(and(eq(clientConsents.id, input.consentId), eq(clientConsents.ownerUserId, userId), eq(clientConsents.clientId, input.clientId))).limit(1);
  if (!consent[0]) throw new Error("Registro de consentimento não encontrado para este cliente.");
  const now = new Date();
  await db.update(clientConsents).set({ status: input.status, grantedAt: input.status === "granted" ? now : undefined, revokedAt: input.status === "revoked" ? now : undefined }).where(eq(clientConsents.id, input.consentId));
  return input.consentId;
}

export async function listDataRetentionPolicies(userId: number, clientId: number) {
  const db = await requireOwnedAgencyClient(userId, clientId);
  return db.select().from(dataRetentionPolicies).where(and(eq(dataRetentionPolicies.ownerUserId, userId), eq(dataRetentionPolicies.clientId, clientId))).orderBy(asc(dataRetentionPolicies.dataCategory));
}

export async function upsertDataRetentionPolicy(userId: number, input: { clientId: number; dataCategory: "contacts" | "conversations" | "creative" | "analytics" | "financial" | "research"; retentionDays: number; status: "active" | "paused"; reviewAt?: Date | null }) {
  const db = await requireOwnedAgencyClient(userId, input.clientId);
  const existing = await db.select({ id: dataRetentionPolicies.id }).from(dataRetentionPolicies).where(and(eq(dataRetentionPolicies.ownerUserId, userId), eq(dataRetentionPolicies.clientId, input.clientId), eq(dataRetentionPolicies.dataCategory, input.dataCategory))).limit(1);
  const values = { retentionDays: Math.max(1, Math.floor(input.retentionDays)), status: input.status, reviewAt: input.reviewAt ?? null };
  if (existing[0]) {
    await db.update(dataRetentionPolicies).set(values).where(eq(dataRetentionPolicies.id, existing[0].id));
    return existing[0].id;
  }
  const [created] = await db.insert(dataRetentionPolicies).values({ ...values, ownerUserId: userId, clientId: input.clientId, dataCategory: input.dataCategory }).$returningId();
  return created.id;
}

export async function listIntegrationHealthLogs(userId: number, clientId: number) {
  const db = await requireOwnedAgencyClient(userId, clientId);
  return db.select().from(integrationHealthLogs).where(and(eq(integrationHealthLogs.ownerUserId, userId), eq(integrationHealthLogs.clientId, clientId))).orderBy(desc(integrationHealthLogs.checkedAt)).limit(60);
}

export async function recordIntegrationHealth(userId: number, input: { clientId: number; integrationType: "ai" | "whatsapp" | "email" | "media" | "research" | "crm" | "other"; provider: string; status: "healthy" | "warning" | "error" | "unknown"; safeMessage?: string | null }) {
  const db = await requireOwnedAgencyClient(userId, input.clientId);
  const [created] = await db.insert(integrationHealthLogs).values({ ownerUserId: userId, clientId: input.clientId, integrationType: input.integrationType, provider: input.provider.trim(), status: input.status, safeMessage: input.safeMessage?.trim().replace(/(?:api[_ -]?key|token|secret|password)\s*[:=]\s*[^\s]+/gi, "[redigido]") || null }).$returningId();
  return created.id;
}

export async function getExecutiveDashboard(userId: number) {
  const db = await requireDb();
  const [contracts, entries, leads, snapshots, capacities, allClients] = await Promise.all([
    db.select().from(serviceContracts).where(eq(serviceContracts.ownerUserId, userId)),
    db.select().from(financialEntries).where(eq(financialEntries.ownerUserId, userId)),
    db.select().from(salesLeads).where(eq(salesLeads.ownerUserId, userId)),
    db.select().from(paidMediaSnapshots).where(eq(paidMediaSnapshots.ownerUserId, userId)),
    db.select().from(capacityPlans).where(eq(capacityPlans.ownerUserId, userId)),
    db.select().from(clients).where(eq(clients.createdByUserId, userId)),
  ]);
  const revenueCents = entries.filter(entry => entry.entryType === "revenue" && ["invoiced", "paid", "overdue"].includes(entry.status)).reduce((sum, entry) => sum + entry.amountCents, 0);
  const refundCents = entries.filter(entry => entry.entryType === "refund" && ["invoiced", "paid", "overdue"].includes(entry.status)).reduce((sum, entry) => sum + entry.amountCents, 0);
  const directCostCents = entries.filter(entry => (entry.entryType === "expense" || entry.entryType === "media_spend") && ["invoiced", "paid", "overdue"].includes(entry.status)).reduce((sum, entry) => sum + entry.amountCents, 0);
  const activeContracts = contracts.filter(contract => contract.status === "active");
  const endedContracts = contracts.filter(contract => contract.status === "ended");
  const mrrCents = activeContracts.reduce((sum, contract) => sum + (contract.billingCycle === "monthly" ? contract.recurringRevenueCents ?? 0 : contract.billingCycle === "annual" ? Math.round((contract.recurringRevenueCents ?? 0) / 12) : 0), 0);
  const netRevenueCents = revenueCents - refundCents;
  const plannedMinutes = capacities.reduce((sum, plan) => sum + plan.capacityMinutes, 0);
  const bookedMinutes = capacities.reduce((sum, plan) => sum + plan.bookedMinutes, 0);
  const decidedLeads = leads.filter(lead => lead.status === "won" || lead.status === "lost");
  return {
    clients: allClients.length,
    mrrCents,
    revenueCents: netRevenueCents,
    directCostCents,
    marginCents: netRevenueCents - directCostCents,
    marginPercent: netRevenueCents > 0 ? Math.round(((netRevenueCents - directCostCents) / netRevenueCents) * 100) : null,
    churnRatePercent: activeContracts.length + endedContracts.length > 0 ? Math.round((endedContracts.length / (activeContracts.length + endedContracts.length)) * 1000) / 10 : null,
    cacCents: null as number | null,
    ltvCents: null as number | null,
    pipelineCents: leads.filter(lead => !["won", "lost", "archived"].includes(lead.status)).reduce((sum, lead) => sum + (lead.estimatedMonthlyRevenueCents ?? 0), 0),
    winRatePercent: decidedLeads.length ? Math.round((leads.filter(lead => lead.status === "won").length / decidedLeads.length) * 1000) / 10 : null,
    media: { spendCents: snapshots.reduce((sum, item) => sum + item.spendCents, 0), leads: snapshots.reduce((sum, item) => sum + item.leads, 0), conversions: snapshots.reduce((sum, item) => sum + item.conversions, 0), conversionValueCents: snapshots.reduce((sum, item) => sum + item.conversionValueCents, 0) },
    capacity: { plannedMinutes, bookedMinutes, utilizationPercent: plannedMinutes ? Math.round((bookedMinutes / plannedMinutes) * 100) : null },
    metricAvailability: { cac: false, ltv: false, note: "CAC e LTV permanecem indisponíveis até que custos de aquisição e histórico de retenção sejam registrados de forma consistente." },
  };
}
