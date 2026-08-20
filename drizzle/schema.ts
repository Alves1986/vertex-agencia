import {
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const clients = mysqlTable(
  "clients",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 180 }).notNull(),
    contactName: varchar("contactName", { length: 180 }),
    contactEmail: varchar("contactEmail", { length: 320 }),
    segment: varchar("segment", { length: 120 }),
    status: mysqlEnum("status", ["active", "paused", "archived"]).default("active").notNull(),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("clients_owner_idx").on(table.createdByUserId), index("clients_status_idx").on(table.status)],
);

export const teams = mysqlTable(
  "teams",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 140 }).notNull(),
    color: varchar("color", { length: 16 }).default("#E85D3F").notNull(),
    leadUserId: int("leadUserId").references(() => users.id, { onDelete: "set null" }),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("teams_owner_idx").on(table.createdByUserId)],
);

export const teamMembers = mysqlTable(
  "team_members",
  {
    id: int("id").autoincrement().primaryKey(),
    teamId: int("teamId").notNull().references(() => teams.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("team_members_team_user_unique").on(table.teamId, table.userId),
    index("team_members_user_idx").on(table.userId),
  ],
);

export const operators = mysqlTable(
  "operators",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 180 }).notNull(),
    email: varchar("email", { length: 320 }),
    role: varchar("role", { length: 120 }),
    teamId: int("teamId").references(() => teams.id, { onDelete: "set null" }),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("operators_owner_idx").on(table.createdByUserId), index("operators_team_idx").on(table.teamId)],
);

export const projects = mysqlTable(
  "projects",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "restrict" }),
    teamId: int("teamId").references(() => teams.id, { onDelete: "set null" }),
    responsibleOperatorId: int("responsibleOperatorId").references(() => operators.id, { onDelete: "set null" }),
    ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "restrict" }),
    status: mysqlEnum("status", ["briefing", "in_progress", "review", "approved", "on_hold", "completed"]).default("briefing").notNull(),
    priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium").notNull(),
    progress: int("progress").default(0).notNull(),
    sourceSkill: mysqlEnum("sourceSkill", ["agencia", "carrosseis", "manual"]).default("manual").notNull(),
    startsAt: timestamp("startsAt"),
    dueAt: timestamp("dueAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("projects_client_idx").on(table.clientId),
    index("projects_team_idx").on(table.teamId),
    index("projects_responsible_operator_idx").on(table.responsibleOperatorId),
    index("projects_owner_idx").on(table.ownerUserId),
    index("projects_status_idx").on(table.status),
    index("projects_due_idx").on(table.dueAt),
  ],
);

export const projectArtifacts = mysqlTable(
  "project_artifacts",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
    fileName: varchar("fileName", { length: 255 }).notNull(),
    fileSize: int("fileSize"),
    sourcePath: varchar("sourcePath", { length: 500 }),
    syncedAt: timestamp("syncedAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("project_artifacts_project_idx").on(table.projectId)],
);

export const tasks = mysqlTable(
  "tasks",
  {
    id: int("id").autoincrement().primaryKey(),
    title: varchar("title", { length: 240 }).notNull(),
    description: text("description"),
    projectId: int("projectId").references(() => projects.id, { onDelete: "cascade" }),
    teamId: int("teamId").references(() => teams.id, { onDelete: "set null" }),
    responsibleOperatorId: int("responsibleOperatorId").references(() => operators.id, { onDelete: "set null" }),
    assignedUserId: int("assignedUserId").references(() => users.id, { onDelete: "set null" }),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id, { onDelete: "restrict" }),
    status: mysqlEnum("status", ["backlog", "ready", "in_progress", "review", "done", "blocked"]).default("backlog").notNull(),
    priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium").notNull(),
    dueAt: timestamp("dueAt"),
    startedAt: timestamp("startedAt"),
    completedAt: timestamp("completedAt"),
    estimateMinutes: int("estimateMinutes"),
    sortOrder: int("sortOrder").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("tasks_project_idx").on(table.projectId),
    index("tasks_team_idx").on(table.teamId),
    index("tasks_responsible_operator_idx").on(table.responsibleOperatorId),
    index("tasks_assigned_idx").on(table.assignedUserId),
    index("tasks_status_idx").on(table.status),
    index("tasks_due_idx").on(table.dueAt),
  ],
);

export const calendarEvents = mysqlTable(
  "calendar_events",
  {
    id: int("id").autoincrement().primaryKey(),
    title: varchar("title", { length: 240 }).notNull(),
    description: text("description"),
    projectId: int("projectId").references(() => projects.id, { onDelete: "set null" }),
    clientId: int("clientId").references(() => clients.id, { onDelete: "set null" }),
    teamId: int("teamId").references(() => teams.id, { onDelete: "set null" }),
    responsibleOperatorId: int("responsibleOperatorId").references(() => operators.id, { onDelete: "set null" }),
    ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "restrict" }),
    eventType: mysqlEnum("eventType", ["meeting", "review", "delivery", "focus", "deadline"]).default("meeting").notNull(),
    startsAt: timestamp("startsAt").notNull(),
    endsAt: timestamp("endsAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("calendar_events_owner_idx").on(table.ownerUserId),
    index("calendar_events_start_idx").on(table.startsAt),
    index("calendar_events_project_idx").on(table.projectId),
    index("calendar_events_responsible_operator_idx").on(table.responsibleOperatorId),
  ],
);

export const notifications = mysqlTable(
  "notifications",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: mysqlEnum("type", ["approval", "deadline", "comment", "delivery", "system"]).default("system").notNull(),
    title: varchar("title", { length: 240 }).notNull(),
    body: text("body"),
    entityType: varchar("entityType", { length: 64 }),
    entityId: int("entityId"),
    actionPath: varchar("actionPath", { length: 300 }),
    readAt: timestamp("readAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("notifications_user_read_idx").on(table.userId, table.readAt)],
);

export const userDashboardPreferences = mysqlTable(
  "user_dashboard_preferences",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    activeClientId: int("activeClientId").references(() => clients.id, { onDelete: "set null" }),
    activeTeamId: int("activeTeamId").references(() => teams.id, { onDelete: "set null" }),
    preferredRange: mysqlEnum("preferredRange", ["week", "month"]).default("week").notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("dashboard_preferences_user_unique").on(table.userId)],
);

export const originalAppConnections = mysqlTable(
  "original_app_connections",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    baseUrl: varchar("baseUrl", { length: 500 }).notNull(),
    connectionStatus: mysqlEnum("connectionStatus", ["pending", "connected", "error"]).default("pending").notNull(),
    lastCheckedAt: timestamp("lastCheckedAt"),
    lastError: text("lastError"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("original_app_connections_user_unique").on(table.userId)],
);

export const clientAiConnections = mysqlTable(
  "client_ai_connections",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
    ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 120 }).notNull(),
    provider: mysqlEnum("provider", ["manus", "openai", "openai_compatible", "gemini", "anthropic"]).notNull(),
    apiBaseUrl: varchar("apiBaseUrl", { length: 500 }),
    defaultModel: varchar("defaultModel", { length: 180 }).notNull(),
    defaultImageModel: varchar("defaultImageModel", { length: 180 }),
    encryptedApiKey: text("encryptedApiKey"),
    keyHint: varchar("keyHint", { length: 16 }),
    status: mysqlEnum("status", ["active", "disabled"]).default("active").notNull(),
    lastTestedAt: timestamp("lastTestedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("client_ai_connections_owner_client_label_unique").on(table.ownerUserId, table.clientId, table.label),
    index("client_ai_connections_client_idx").on(table.clientId),
    index("client_ai_connections_owner_idx").on(table.ownerUserId),
  ],
);

export const adCampaigns = mysqlTable(
  "ad_campaigns",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
    ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    providerConnectionId: int("providerConnectionId").references(() => clientAiConnections.id, { onDelete: "set null" }),
    name: varchar("name", { length: 200 }).notNull(),
    mode: mysqlEnum("mode", ["ads", "carousel", "bundle"]).notNull(),
    status: mysqlEnum("status", ["draft", "generating", "ready", "review", "approved", "failed"]).default("draft").notNull(),
    objective: varchar("objective", { length: 180 }).notNull(),
    briefingJson: text("briefingJson").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("ad_campaigns_owner_idx").on(table.ownerUserId),
    index("ad_campaigns_client_idx").on(table.clientId),
    index("ad_campaigns_status_idx").on(table.status),
  ],
);

export const aiGenerations = mysqlTable(
  "ai_generations",
  {
    id: int("id").autoincrement().primaryKey(),
    campaignId: int("campaignId").notNull().references(() => adCampaigns.id, { onDelete: "cascade" }),
    ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: mysqlEnum("kind", ["strategy", "ads", "carousel", "bundle", "image"]).notNull(),
    provider: varchar("provider", { length: 64 }).notNull(),
    model: varchar("model", { length: 180 }).notNull(),
    status: mysqlEnum("status", ["queued", "running", "succeeded", "failed"]).default("queued").notNull(),
    promptSnapshot: text("promptSnapshot").notNull(),
    outputJson: text("outputJson"),
    errorMessage: text("errorMessage"),
    inputTokens: int("inputTokens"),
    outputTokens: int("outputTokens"),
    totalTokens: int("totalTokens"),
    requestDurationMs: int("requestDurationMs"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
  },
  table => [
    index("ai_generations_campaign_idx").on(table.campaignId),
    index("ai_generations_owner_idx").on(table.ownerUserId),
    index("ai_generations_status_idx").on(table.status),
  ],
);

export const carouselSlides = mysqlTable(
  "carousel_slides",
  {
    id: int("id").autoincrement().primaryKey(),
    campaignId: int("campaignId").notNull().references(() => adCampaigns.id, { onDelete: "cascade" }),
    generationId: int("generationId").references(() => aiGenerations.id, { onDelete: "set null" }),
    slideNumber: int("slideNumber").notNull(),
    role: mysqlEnum("role", ["cover", "context", "insight", "proof", "solution", "cta"]).notNull(),
    headline: varchar("headline", { length: 240 }).notNull(),
    body: text("body"),
    visualDirection: text("visualDirection"),
    imagePrompt: text("imagePrompt"),
    assetUrl: varchar("assetUrl", { length: 1000 }),
    approvalStatus: mysqlEnum("approvalStatus", ["draft", "review", "approved"]).default("draft").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("carousel_slides_campaign_number_unique").on(table.campaignId, table.slideNumber),
    index("carousel_slides_generation_idx").on(table.generationId),
  ],
);

export const creativeVersions = mysqlTable(
  "creative_versions",
  {
    id: int("id").autoincrement().primaryKey(),
    campaignId: int("campaignId").notNull().references(() => adCampaigns.id, { onDelete: "cascade" }),
    generationId: int("generationId").references(() => aiGenerations.id, { onDelete: "set null" }),
    ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: mysqlEnum("kind", ["ads", "carousel", "strategy", "video", "bundle"]).notNull(),
    versionNumber: int("versionNumber").notNull(),
    summary: varchar("summary", { length: 300 }),
    payloadJson: text("payloadJson").notNull(),
    status: mysqlEnum("status", ["draft", "review", "approved", "rejected"]).default("review").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("creative_versions_campaign_kind_number_unique").on(table.campaignId, table.kind, table.versionNumber),
    index("creative_versions_campaign_idx").on(table.campaignId),
    index("creative_versions_generation_idx").on(table.generationId),
    index("creative_versions_owner_status_idx").on(table.ownerUserId, table.status),
  ],
);

export const creativeApprovals = mysqlTable(
  "creative_approvals",
  {
    id: int("id").autoincrement().primaryKey(),
    creativeVersionId: int("creativeVersionId").notNull().references(() => creativeVersions.id, { onDelete: "cascade" }),
    campaignId: int("campaignId").notNull().references(() => adCampaigns.id, { onDelete: "cascade" }),
    ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    reviewerUserId: int("reviewerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    decision: mysqlEnum("decision", ["approved", "changes_requested", "rejected"]).notNull(),
    note: text("note"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("creative_approvals_version_idx").on(table.creativeVersionId),
    index("creative_approvals_campaign_idx").on(table.campaignId),
    index("creative_approvals_owner_idx").on(table.ownerUserId),
  ],
);

export const clientAgencyProfiles = mysqlTable(
  "client_agency_profiles",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
    ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    positioning: text("positioning"),
    voice: varchar("voice", { length: 240 }),
    audience: text("audience"),
    offers: text("offers"),
    proofPolicy: text("proofPolicy"),
    visualSystem: text("visualSystem"),
    departmentContextJson: text("departmentContextJson"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("client_agency_profiles_client_unique").on(table.clientId),
    index("client_agency_profiles_owner_idx").on(table.ownerUserId),
  ],
);

export const contentBriefs = mysqlTable(
  "content_briefs",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
    campaignId: int("campaignId").references(() => adCampaigns.id, { onDelete: "set null" }),
    ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 220 }).notNull(),
    sourceType: mysqlEnum("sourceType", ["briefing", "idea", "trend", "reference", "decision"]).default("briefing").notNull(),
    objective: varchar("objective", { length: 240 }),
    content: text("content").notNull(),
    status: mysqlEnum("status", ["draft", "review", "approved", "archived"]).default("draft").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("content_briefs_client_idx").on(table.clientId), index("content_briefs_campaign_idx").on(table.campaignId), index("content_briefs_owner_idx").on(table.ownerUserId)],
);

export const trendSignals = mysqlTable(
  "trend_signals",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
    campaignId: int("campaignId").references(() => adCampaigns.id, { onDelete: "set null" }),
    ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    platform: mysqlEnum("platform", ["instagram", "youtube", "x", "tiktok", "other"]).default("other").notNull(),
    sourceUrl: varchar("sourceUrl", { length: 1200 }),
    title: varchar("title", { length: 260 }).notNull(),
    observedAt: timestamp("observedAt"),
    reactionNotes: text("reactionNotes"),
    metricsJson: text("metricsJson"),
    score: int("score"),
    status: mysqlEnum("status", ["captured", "shortlisted", "approved", "discarded"]).default("captured").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("trend_signals_client_idx").on(table.clientId), index("trend_signals_campaign_idx").on(table.campaignId), index("trend_signals_owner_idx").on(table.ownerUserId), index("trend_signals_status_idx").on(table.status)],
);

export const videoScripts = mysqlTable(
  "video_scripts",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
    campaignId: int("campaignId").references(() => adCampaigns.id, { onDelete: "set null" }),
    contentBriefId: int("contentBriefId").references(() => contentBriefs.id, { onDelete: "set null" }),
    ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 220 }).notNull(),
    scriptJson: text("scriptJson").notNull(),
    editPlan: text("editPlan"),
    status: mysqlEnum("status", ["draft", "review", "approved", "produced"]).default("draft").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("video_scripts_client_idx").on(table.clientId), index("video_scripts_campaign_idx").on(table.campaignId), index("video_scripts_owner_idx").on(table.ownerUserId)],
);

export const strategyDecisions = mysqlTable(
  "strategy_decisions",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
    campaignId: int("campaignId").references(() => adCampaigns.id, { onDelete: "set null" }),
    ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    lensOutputJson: text("lensOutputJson").notNull(),
    recommendation: text("recommendation").notNull(),
    primaryRisk: text("primaryRisk"),
    status: mysqlEnum("status", ["draft", "review", "accepted", "rejected"]).default("review").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("strategy_decisions_client_idx").on(table.clientId), index("strategy_decisions_campaign_idx").on(table.campaignId), index("strategy_decisions_owner_idx").on(table.ownerUserId), index("strategy_decisions_status_idx").on(table.status)],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Client = typeof clients.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type ClientAiConnection = typeof clientAiConnections.$inferSelect;
export type AdCampaign = typeof adCampaigns.$inferSelect;
export type AiGeneration = typeof aiGenerations.$inferSelect;
export type CarouselSlide = typeof carouselSlides.$inferSelect;
export type CreativeVersion = typeof creativeVersions.$inferSelect;
export type CreativeApproval = typeof creativeApprovals.$inferSelect;
export type ClientAgencyProfile = typeof clientAgencyProfiles.$inferSelect;
export type ContentBrief = typeof contentBriefs.$inferSelect;
export type TrendSignal = typeof trendSignals.$inferSelect;
export type VideoScript = typeof videoScripts.$inferSelect;
export type StrategyDecision = typeof strategyDecisions.$inferSelect;
