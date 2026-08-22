import {
  foreignKey,
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
    monthlyApiCallLimit: int("monthlyApiCallLimit"),
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

export const carouselSlideApprovalBatches = mysqlTable(
  "carousel_slide_approval_batches",
  {
    id: int("id").autoincrement().primaryKey(),
    creativeVersionId: int("creativeVersionId").notNull().references(() => creativeVersions.id, { onDelete: "cascade" }),
    campaignId: int("campaignId").notNull().references(() => adCampaigns.id, { onDelete: "cascade" }),
    ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    reviewerUserId: int("reviewerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    slideNumbersJson: text("slideNumbersJson").notNull(),
    decision: mysqlEnum("decision", ["approved", "changes_requested"]).default("approved").notNull(),
    note: text("note"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("carousel_batch_approvals_version_idx").on(table.creativeVersionId),
    index("carousel_batch_approvals_campaign_idx").on(table.campaignId),
    index("carousel_batch_approvals_owner_idx").on(table.ownerUserId),
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

export const clientAccessGrants = mysqlTable(
  "client_access_grants",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
    ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 320 }).notNull(),
    displayName: varchar("displayName", { length: 180 }),
    role: mysqlEnum("role", ["client_admin", "manager", "reviewer", "viewer"]).default("viewer").notNull(),
    status: mysqlEnum("status", ["pending", "active", "revoked"]).default("pending").notNull(),
    invitedByUserId: int("invitedByUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    acceptedAt: timestamp("acceptedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("client_access_grants_client_email_unique").on(table.clientId, table.email), index("client_access_grants_owner_client_idx").on(table.ownerUserId, table.clientId)],
);

export const clientOnboardingProgress = mysqlTable(
  "client_onboarding_progress",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
    ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    currentStep: mysqlEnum("currentStep", ["brand", "contacts", "ai", "whatsapp", "goals", "review", "complete"]).default("brand").notNull(),
    completedStepsJson: text("completedStepsJson").notNull(),
    goals: text("goals"),
    reviewNote: text("reviewNote"),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("client_onboarding_progress_client_unique").on(table.clientId), index("client_onboarding_progress_owner_idx").on(table.ownerUserId)],
);

export const clientBrandGuidelines = mysqlTable(
  "client_brand_guidelines",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
    ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    colorsJson: text("colorsJson").notNull(),
    fontsJson: text("fontsJson").notNull(),
    toneOfVoice: text("toneOfVoice"),
    prohibitedWordsJson: text("prohibitedWordsJson").notNull(),
    approvedCtasJson: text("approvedCtasJson").notNull(),
    productsJson: text("productsJson").notNull(),
    differentiatorsJson: text("differentiatorsJson").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("client_brand_guidelines_client_unique").on(table.clientId), index("client_brand_guidelines_owner_idx").on(table.ownerUserId)],
);

export const supportTickets = mysqlTable(
  "support_tickets",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
    ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    requesterEmail: varchar("requesterEmail", { length: 320 }).notNull(),
    subject: varchar("subject", { length: 220 }).notNull(),
    description: text("description").notNull(),
    priority: mysqlEnum("priority", ["low", "normal", "high", "urgent"]).default("normal").notNull(),
    status: mysqlEnum("status", ["open", "in_progress", "waiting_client", "resolved", "closed"]).default("open").notNull(),
    dueAt: timestamp("dueAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("support_tickets_owner_client_idx").on(table.ownerUserId, table.clientId), index("support_tickets_status_idx").on(table.status)],
);

export const supportTicketUpdates = mysqlTable(
  "support_ticket_updates",
  {
    id: int("id").autoincrement().primaryKey(),
    ticketId: int("ticketId").notNull().references(() => supportTickets.id, { onDelete: "cascade" }),
    authorUserId: int("authorUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    statusAfter: mysqlEnum("statusAfter", ["open", "in_progress", "waiting_client", "resolved", "closed"]),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("support_ticket_updates_ticket_idx").on(table.ticketId)],
);

export const externalApprovalLinks = mysqlTable(
  "external_approval_links",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
    campaignId: int("campaignId").notNull().references(() => adCampaigns.id, { onDelete: "cascade" }),
    creativeVersionId: int("creativeVersionId").notNull(),
    ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
    tokenHash: varchar("tokenHash", { length: 128 }).notNull(),
    status: mysqlEnum("status", ["open", "approved", "changes_requested", "expired", "revoked"]).default("open").notNull(),
    decisionNote: text("decisionNote"),
    expiresAt: timestamp("expiresAt").notNull(),
    decidedAt: timestamp("decidedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    foreignKey({ columns: [table.creativeVersionId], foreignColumns: [creativeVersions.id], name: "ext_approval_creative_fk" }).onDelete("cascade"),
    uniqueIndex("external_approval_links_token_unique").on(table.tokenHash),
    index("external_approval_links_owner_client_idx").on(table.ownerUserId, table.clientId),
  ],
);

export const clientNotificationPreferences = mysqlTable(
  "client_notification_preferences",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
    ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    eventsJson: text("eventsJson").notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("client_notification_preferences_client_unique").on(table.clientId), index("client_notification_preferences_owner_idx").on(table.ownerUserId)],
);

export const executiveReports = mysqlTable(
  "executive_reports",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
    ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    periodStart: timestamp("periodStart").notNull(),
    periodEnd: timestamp("periodEnd").notNull(),
    title: varchar("title", { length: 220 }).notNull(),
    summary: text("summary").notNull(),
    metricsJson: text("metricsJson").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("executive_reports_owner_client_idx").on(table.ownerUserId, table.clientId), index("executive_reports_period_idx").on(table.periodStart, table.periodEnd)],
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

export const carouselBriefTemplates = mysqlTable(
  "carousel_brief_templates",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
    ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 180 }).notNull(),
    description: varchar("description", { length: 500 }),
    fieldsJson: text("fieldsJson").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("carousel_brief_templates_client_name_unique").on(table.clientId, table.name),
    index("carousel_brief_templates_owner_client_idx").on(table.ownerUserId, table.clientId),
  ],
);

export const clientBrandAssetCollections = mysqlTable(
  "client_brand_asset_collections",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
    ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 180 }).notNull(),
    description: varchar("description", { length: 500 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("client_brand_asset_collections_client_name_unique").on(table.clientId, table.name),
    index("client_brand_asset_collections_owner_client_idx").on(table.ownerUserId, table.clientId),
  ],
);

export const clientBrandAssets = mysqlTable(
  "client_brand_assets",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
    ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    collectionId: int("collectionId").references(() => clientBrandAssetCollections.id, { onDelete: "set null" }),
    name: varchar("name", { length: 220 }).notNull(),
    assetType: mysqlEnum("assetType", ["logo", "product", "reference", "palette", "other"]).default("reference").notNull(),
    storageKey: varchar("storageKey", { length: 1000 }).notNull(),
    assetUrl: varchar("assetUrl", { length: 1200 }).notNull(),
    mimeType: varchar("mimeType", { length: 120 }).notNull(),
    byteSize: int("byteSize").notNull(),
    status: mysqlEnum("status", ["authorized", "archived"]).default("authorized").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("client_brand_assets_owner_client_idx").on(table.ownerUserId, table.clientId),
    index("client_brand_assets_client_status_idx").on(table.clientId, table.status),
    index("client_brand_assets_client_collection_idx").on(table.clientId, table.collectionId),
  ],
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

/** Usuários convidados pelo cliente para operar o portal, sem acesso aos outros clientes da agência. */
export const clientPortalMembers = mysqlTable(
  "client_portal_members",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    invitedByUserId: int("invitedByUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: mysqlEnum("role", ["client_admin", "manager", "agent", "viewer"]).default("viewer").notNull(),
    status: mysqlEnum("status", ["invited", "active", "suspended"]).default("invited").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("client_portal_members_client_user_unique").on(table.clientId, table.userId),
    index("client_portal_members_user_status_idx").on(table.userId, table.status),
  ],
);

/** Canal isolado por cliente; segredos e detalhes do provedor permanecem cifrados no servidor. */
export const whatsappChannels = mysqlTable(
  "whatsapp_channels",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
    ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 140 }).notNull(),
    provider: mysqlEnum("provider", ["meta_cloud", "twilio"]).notNull(),
    status: mysqlEnum("status", ["draft", "verification_pending", "active", "paused", "error"]).default("draft").notNull(),
    displayPhoneNumber: varchar("displayPhoneNumber", { length: 40 }),
    externalAccountId: varchar("externalAccountId", { length: 220 }),
    externalSenderId: varchar("externalSenderId", { length: 220 }),
    encryptedConfig: text("encryptedConfig"),
    configHint: varchar("configHint", { length: 32 }),
    verifiedAt: timestamp("verifiedAt"),
    lastInboundAt: timestamp("lastInboundAt"),
    lastOutboundAt: timestamp("lastOutboundAt"),
    lastError: text("lastError"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("whatsapp_channels_owner_client_label_unique").on(table.ownerUserId, table.clientId, table.label),
    index("whatsapp_channels_client_status_idx").on(table.clientId, table.status),
    index("whatsapp_channels_provider_sender_idx").on(table.provider, table.externalSenderId),
  ],
);

/** Política de atendimento e escolha entre chave do cliente ou IA gerenciada pela VERTEX. */
export const whatsappAiPolicies = mysqlTable(
  "whatsapp_ai_policies",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
    ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    aiAccessMode: mysqlEnum("aiAccessMode", ["client_api_key", "vertex_managed"]).default("client_api_key").notNull(),
    providerConnectionId: int("providerConnectionId").references(() => clientAiConnections.id, { onDelete: "set null" }),
    workflowMode: mysqlEnum("workflowMode", ["auto_reply", "draft_for_approval", "handoff_only"]).default("draft_for_approval").notNull(),
    systemInstructions: text("systemInstructions"),
    businessHoursJson: text("businessHoursJson"),
    handoffKeywordsJson: text("handoffKeywordsJson"),
    monthlyManagedMessageLimit: int("monthlyManagedMessageLimit"),
    managedAiCostPerThousandCents: int("managedAiCostPerThousandCents"),
    managedAiMarkupPercent: int("managedAiMarkupPercent"),
    managedAiOveragePricePerThousandCents: int("managedAiOveragePricePerThousandCents"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("whatsapp_ai_policies_client_unique").on(table.clientId),
    index("whatsapp_ai_policies_owner_idx").on(table.ownerUserId),
  ],
);

export const whatsappContacts = mysqlTable(
  "whatsapp_contacts",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
    phoneE164: varchar("phoneE164", { length: 32 }).notNull(),
    displayName: varchar("displayName", { length: 220 }),
    optInStatus: mysqlEnum("optInStatus", ["unknown", "opted_in", "opted_out"]).default("unknown").notNull(),
    optedInAt: timestamp("optedInAt"),
    optedOutAt: timestamp("optedOutAt"),
    lastInboundAt: timestamp("lastInboundAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("whatsapp_contacts_client_phone_unique").on(table.clientId, table.phoneE164),
    index("whatsapp_contacts_client_optin_idx").on(table.clientId, table.optInStatus),
  ],
);

export const whatsappConversations = mysqlTable(
  "whatsapp_conversations",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
    channelId: int("channelId").notNull().references(() => whatsappChannels.id, { onDelete: "cascade" }),
    contactId: int("contactId").notNull().references(() => whatsappContacts.id, { onDelete: "cascade" }),
    assignedOperatorId: int("assignedOperatorId").references(() => operators.id, { onDelete: "set null" }),
    status: mysqlEnum("status", ["ai_active", "waiting_human", "human_active", "closed"]).default("ai_active").notNull(),
    lastMessagePreview: varchar("lastMessagePreview", { length: 300 }),
    lastMessageAt: timestamp("lastMessageAt"),
    serviceWindowExpiresAt: timestamp("serviceWindowExpiresAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("whatsapp_conversations_channel_contact_unique").on(table.channelId, table.contactId),
    index("whatsapp_conversations_client_status_updated_idx").on(table.clientId, table.status, table.updatedAt),
    index("whatsapp_conversations_operator_status_idx").on(table.assignedOperatorId, table.status),
  ],
);

export const whatsappMessages = mysqlTable(
  "whatsapp_messages",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
    channelId: int("channelId").notNull().references(() => whatsappChannels.id, { onDelete: "cascade" }),
    conversationId: int("conversationId").notNull().references(() => whatsappConversations.id, { onDelete: "cascade" }),
    providerMessageId: varchar("providerMessageId", { length: 300 }),
    direction: mysqlEnum("direction", ["inbound", "outbound"]).notNull(),
    authorType: mysqlEnum("authorType", ["contact", "ai", "human", "system"]).notNull(),
    body: text("body"),
    mediaUrl: varchar("mediaUrl", { length: 1200 }),
    templateName: varchar("templateName", { length: 180 }),
    deliveryStatus: mysqlEnum("deliveryStatus", ["received", "queued", "sent", "delivered", "read", "failed"]).default("received").notNull(),
    providerPayloadJson: text("providerPayloadJson"),
    occurredAt: timestamp("occurredAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("whatsapp_messages_provider_message_unique").on(table.providerMessageId),
    index("whatsapp_messages_conversation_occurred_idx").on(table.conversationId, table.occurredAt),
    index("whatsapp_messages_client_direction_idx").on(table.clientId, table.direction),
  ],
);

/** Eventos brutos de webhook para idempotência, rastreabilidade e reprocessamento controlado. */
export const whatsappWebhookEvents = mysqlTable(
  "whatsapp_webhook_events",
  {
    id: int("id").autoincrement().primaryKey(),
    channelId: int("channelId").references(() => whatsappChannels.id, { onDelete: "set null" }),
    provider: mysqlEnum("provider", ["meta_cloud", "twilio"]).notNull(),
    externalEventId: varchar("externalEventId", { length: 300 }).notNull(),
    processingStatus: mysqlEnum("processingStatus", ["received", "processed", "ignored", "failed"]).default("received").notNull(),
    payloadJson: text("payloadJson").notNull(),
    errorMessage: text("errorMessage"),
    receivedAt: timestamp("receivedAt").defaultNow().notNull(),
    processedAt: timestamp("processedAt"),
  },
  table => [
    uniqueIndex("whatsapp_webhook_events_provider_event_unique").on(table.provider, table.externalEventId),
    index("whatsapp_webhook_events_channel_status_idx").on(table.channelId, table.processingStatus),
  ],
);

/** Registro de cada resposta gerada para auditoria, limite da IA VERTEX e telemetria por cliente. */
export const whatsappAiRuns = mysqlTable(
  "whatsapp_ai_runs",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
    channelId: int("channelId").notNull().references(() => whatsappChannels.id, { onDelete: "cascade" }),
    conversationId: int("conversationId").notNull().references(() => whatsappConversations.id, { onDelete: "cascade" }),
    sourceMessageId: int("sourceMessageId").references(() => whatsappMessages.id, { onDelete: "set null" }),
    resultMessageId: int("resultMessageId").references(() => whatsappMessages.id, { onDelete: "set null" }),
    billingMode: mysqlEnum("billingMode", ["client_api_key", "vertex_managed"]).notNull(),
    provider: varchar("provider", { length: 80 }).notNull(),
    model: varchar("model", { length: 180 }).notNull(),
    status: mysqlEnum("status", ["queued", "drafted", "sent", "failed", "blocked"]).default("queued").notNull(),
    inputTokens: int("inputTokens"),
    outputTokens: int("outputTokens"),
    totalTokens: int("totalTokens"),
    requestDurationMs: int("requestDurationMs"),
    errorMessage: text("errorMessage"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
  },
  table => [
    index("whatsapp_ai_runs_client_created_idx").on(table.clientId, table.createdAt),
    index("whatsapp_ai_runs_conversation_idx").on(table.conversationId),
    index("whatsapp_ai_runs_status_idx").on(table.status),
  ],
);

/** Regras explícitas de automação por cliente; podem sugerir, escalar ou responder conforme a política de IA. */
export const whatsappAutomationRules = mysqlTable(
  "whatsapp_automation_rules",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
    ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    channelId: int("channelId").references(() => whatsappChannels.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 180 }).notNull(),
    triggerType: mysqlEnum("triggerType", ["inbound_message", "keyword", "outside_business_hours", "handoff_requested"]).notNull(),
    triggerConfigJson: text("triggerConfigJson"),
    actionType: mysqlEnum("actionType", ["ai_reply", "draft_for_approval", "handoff_human", "tag_conversation"]).notNull(),
    actionConfigJson: text("actionConfigJson"),
    requiresApproval: int("requiresApproval").default(1).notNull(),
    priority: int("priority").default(100).notNull(),
    status: mysqlEnum("status", ["draft", "active", "paused"]).default("draft").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("whatsapp_automation_rules_client_status_idx").on(table.clientId, table.status, table.priority),
    index("whatsapp_automation_rules_channel_trigger_idx").on(table.channelId, table.triggerType),
  ],
);

/** Execuções auditáveis de automação, sem confundir sugestão de IA com resposta já enviada. */
export const whatsappAutomationExecutions = mysqlTable(
  "whatsapp_automation_executions",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
    channelId: int("channelId").notNull().references(() => whatsappChannels.id, { onDelete: "cascade" }),
    conversationId: int("conversationId").notNull().references(() => whatsappConversations.id, { onDelete: "cascade" }),
    sourceMessageId: int("sourceMessageId").references(() => whatsappMessages.id, { onDelete: "set null" }),
    automationRuleId: int("automationRuleId").references(() => whatsappAutomationRules.id, { onDelete: "set null" }),
    status: mysqlEnum("status", ["queued", "executed", "skipped", "blocked", "failed"]).default("queued").notNull(),
    decisionReason: text("decisionReason"),
    outputJson: text("outputJson"),
    executedAt: timestamp("executedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("whatsapp_automation_execution_message_rule_unique").on(table.sourceMessageId, table.automationRuleId),
    index("whatsapp_automation_exec_conversation_idx").on(table.conversationId, table.createdAt),
    index("whatsapp_automation_exec_rule_status_idx").on(table.automationRuleId, table.status),
  ],
);

export const saasPlans = mysqlTable(
  "saas_plans",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 80 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    annualPriceCents: int("annualPriceCents").notNull(),
    stripePriceId: varchar("stripePriceId", { length: 255 }),
    includedChannels: int("includedChannels").default(1).notNull(),
    includedHumanSeats: int("includedHumanSeats").default(1).notNull(),
    includedManagedAiMessages: int("includedManagedAiMessages").default(0).notNull(),
    managedAiCostPerThousandCents: int("managedAiCostPerThousandCents").default(0).notNull(),
    managedAiMarkupPercent: int("managedAiMarkupPercent").default(0).notNull(),
    managedAiOveragePricePerThousandCents: int("managedAiOveragePricePerThousandCents").default(0).notNull(),
    isActive: int("isActive").default(1).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("saas_plans_owner_code_unique").on(table.ownerUserId, table.code)],
);

export const saasSubscriptions = mysqlTable(
  "saas_subscriptions",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
    planId: int("planId").references(() => saasPlans.id, { onDelete: "set null" }),
    ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    billingProvider: mysqlEnum("billingProvider", ["stripe", "manual"]).default("manual").notNull(),
    externalSubscriptionId: varchar("externalSubscriptionId", { length: 255 }),
    stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
    stripePriceId: varchar("stripePriceId", { length: 255 }),
    status: mysqlEnum("status", ["trialing", "active", "past_due", "paused", "canceled", "expired"]).default("trialing").notNull(),
    interval: mysqlEnum("interval", ["annual"]).default("annual").notNull(),
    managedAiAddOn: int("managedAiAddOn").default(0).notNull(),
    managedAiMonthlyLimit: int("managedAiMonthlyLimit").default(0).notNull(),
    currentPeriodStart: timestamp("currentPeriodStart"),
    currentPeriodEnd: timestamp("currentPeriodEnd"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("saas_subscriptions_client_unique").on(table.clientId),
    index("saas_subscriptions_owner_status_idx").on(table.ownerUserId, table.status),
  ],
);

export const whatsappAuditLogs = mysqlTable(
  "whatsapp_audit_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
    actorUserId: int("actorUserId").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 160 }).notNull(),
    entityType: varchar("entityType", { length: 80 }).notNull(),
    entityId: int("entityId"),
    detailsJson: text("detailsJson"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("whatsapp_audit_logs_client_created_idx").on(table.clientId, table.createdAt)],
);

/** Metadados auditáveis de relatórios enviados; o conteúdo e o anexo não são persistidos. */
export const approvalHistoryEmailDeliveries = mysqlTable(
  "approval_history_email_deliveries",
  {
    id: int("id").autoincrement().primaryKey(),
    campaignId: int("campaignId").notNull().references(() => adCampaigns.id, { onDelete: "cascade" }),
    clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
    actorUserId: int("actorUserId").references(() => users.id, { onDelete: "set null" }),
    recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
    subject: varchar("subject", { length: 500 }).notNull(),
    filtersJson: text("filtersJson").notNull(),
    recordCount: int("recordCount").notNull(),
    status: mysqlEnum("status", ["sent", "failed"]).notNull(),
    providerMessageId: varchar("providerMessageId", { length: 255 }),
    failureCode: varchar("failureCode", { length: 120 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("approval_history_email_campaign_created_idx").on(table.campaignId, table.createdAt), index("approval_history_email_client_created_idx").on(table.clientId, table.createdAt)],
);

/** Destinatários opcionais que podem receber relatórios de aprovação de um cliente. */
export const approvalHistoryReportRecipients = mysqlTable(
  "approval_history_report_recipients",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 180 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    status: mysqlEnum("status", ["active", "disabled"]).default("active").notNull(),
    createdByUserId: int("createdByUserId").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("approval_history_report_recipient_client_email_unique").on(table.clientId, table.email),
    index("approval_history_report_recipient_client_status_idx").on(table.clientId, table.status),
  ],
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
export type CarouselSlideApprovalBatch = typeof carouselSlideApprovalBatches.$inferSelect;
export type CreativeVersion = typeof creativeVersions.$inferSelect;
export type CreativeApproval = typeof creativeApprovals.$inferSelect;
export type ClientAgencyProfile = typeof clientAgencyProfiles.$inferSelect;
export type ContentBrief = typeof contentBriefs.$inferSelect;
export type TrendSignal = typeof trendSignals.$inferSelect;
export type VideoScript = typeof videoScripts.$inferSelect;
export type StrategyDecision = typeof strategyDecisions.$inferSelect;
export type ClientPortalMember = typeof clientPortalMembers.$inferSelect;
export type WhatsappChannel = typeof whatsappChannels.$inferSelect;
export type WhatsappAiPolicy = typeof whatsappAiPolicies.$inferSelect;
export type WhatsappContact = typeof whatsappContacts.$inferSelect;
export type WhatsappConversation = typeof whatsappConversations.$inferSelect;
export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type WhatsappWebhookEvent = typeof whatsappWebhookEvents.$inferSelect;
export type WhatsappAiRun = typeof whatsappAiRuns.$inferSelect;
export type WhatsappAutomationRule = typeof whatsappAutomationRules.$inferSelect;
export type WhatsappAutomationExecution = typeof whatsappAutomationExecutions.$inferSelect;
export type SaasPlan = typeof saasPlans.$inferSelect;
export type SaasSubscription = typeof saasSubscriptions.$inferSelect;
export type WhatsappAuditLog = typeof whatsappAuditLogs.$inferSelect;
export type ApprovalHistoryEmailDelivery = typeof approvalHistoryEmailDeliveries.$inferSelect;
export type ApprovalHistoryReportRecipient = typeof approvalHistoryReportRecipients.$inferSelect;
