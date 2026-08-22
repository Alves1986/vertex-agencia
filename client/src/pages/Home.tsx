import { NewProjectLink, StudioShell, formatDate, projectStatusLabel } from "@/components/StudioShell";
import { trpc } from "@/lib/trpc";
import { ArrowRight, CalendarDays, CheckCircle2, CircleDot, FolderKanban, Gauge, KeyRound, ListChecks, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import React, { useMemo, useState } from "react";
import { Link } from "wouter";
import { agencyFlow } from "@/lib/agencyFlow";
import "./home-credentials.css";

export type CredentialStatusRow = { id: number; name: string; activeCount: number; disabledCount: number; status: "active" | "disabled" | "missing" };
export type ApiUsageRow = { id: number; name: string; requestCount: number; successfulCount: number; failedCount: number; inputTokens: number; outputTokens: number; totalTokens: number; averageDurationMs: number | null; telemetryAvailable: boolean; costStatus: "unavailable"; lastUsedAt: Date | null; periodDays: number; monthlyApiCallLimit: number | null; monthlyRequestCount: number; utilizationPercent: number | null; limitStatus: "not_configured" | "within" | "near" | "reached" | "exceeded" };

export function filterCredentialStatuses(rows: CredentialStatusRow[], filter: "all" | "inactive") {
  return filter === "all" ? rows : rows.filter(client => client.status === "disabled");
}

export function describeApiUsage(row: ApiUsageRow) {
  if (!row.requestCount) return "Sem chamadas registradas";
  if (!row.telemetryAvailable) return `${row.requestCount} chamada${row.requestCount === 1 ? "" : "s"} registrada${row.requestCount === 1 ? "" : "s"}; o provedor ainda não reportou tokens.`;
  return `${row.successfulCount} geração(ões) concluída(s) · ${formatNumber(row.totalTokens)} tokens reportados`;
}

export function describeUsageLimit(row: ApiUsageRow) {
  if (!row.monthlyApiCallLimit) return "Sem limite mensal configurado";
  const usage = `${row.monthlyRequestCount}/${row.monthlyApiCallLimit} chamadas no mês`;
  if (row.limitStatus === "near") return `Atenção: ${usage} (${row.utilizationPercent}%)`;
  if (row.limitStatus === "reached") return `Limite mensal atingido: ${usage}`;
  if (row.limitStatus === "exceeded") return `Limite mensal excedido: ${usage}`;
  return `${usage} (${row.utilizationPercent}%)`;
}

export default function Home() {
  const [credentialFilter, setCredentialFilter] = useState<"all" | "inactive">("all");
  const [usagePeriod, setUsagePeriod] = useState<7 | 15 | 30>(30);
  const utils = trpc.useUtils();
  const preferences = trpc.workspace.preferences.useQuery();
  const filters = useMemo(() => ({ clientId: preferences.data?.activeClientId ?? undefined, teamId: preferences.data?.activeTeamId ?? undefined }), [preferences.data?.activeClientId, preferences.data?.activeTeamId]);
  const projects = trpc.projects.list.useQuery(filters);
  const tasks = trpc.production.tasks.useQuery(filters);
  const agenda = trpc.production.agenda.useQuery();
  const credentialStatuses = trpc.agency.credentialStatuses.useQuery();
  const apiUsage = trpc.agency.usageByClient.useQuery({ periodDays: usagePeriod });
  const saveMonthlyLimit = trpc.agency.setMonthlyApiLimit.useMutation({ onSuccess: () => utils.agency.usageByClient.invalidate() });
  const activeProjects = (projects.data ?? []).filter(row => !["completed", "on_hold"].includes(row.project.status));
  const attention = (tasks.data ?? []).filter(row => ["blocked", "review"].includes(row.task.status));
  const doneTasks = (tasks.data ?? []).filter(row => row.task.status === "done");
  const busy = preferences.isLoading || projects.isLoading || tasks.isLoading;
  const credentialRows = filterCredentialStatuses(credentialStatuses.data ?? [], credentialFilter);
  const inactiveCredentialCount = (credentialStatuses.data ?? []).filter(client => client.status === "disabled").length;
  const readyCredentialCount = (credentialStatuses.data ?? []).filter(client => client.status === "active").length;
  const nextAction = attention.length
    ? { href: "/producao", label: "Resolver pendências de produção", description: `${attention.length} item(ns) pedem decisão, revisão ou desbloqueio.` }
    : activeProjects.length
      ? { href: "/projetos", label: "Acompanhar projetos em andamento", description: `${activeProjects.length} projeto(s) seguem ativos no escopo atual.` }
      : { href: "/comercial", label: "Cadastrar a primeira oportunidade", description: "Comece pelo cliente, proposta ou contrato que dará origem à operação." };

  return <StudioShell title="Painel da agência" eyebrow="Visão executiva" actions={<NewProjectLink />}>
    <div className="ops-content">
      <section className="ops-hero-card">
        <div><p className="ops-section-kicker">Leitura de agora</p><h2>A agência inteira em uma sequência que faz sentido.</h2><p>Veja o que já existe, onde há risco e qual é a próxima decisão. Depois, avance pelas etapas de clientes, planejamento, criação, produção, atendimento e sucesso.</p><Link href={nextAction.href} className="ops-hero-action"><span><small>Próxima ação</small><strong>{nextAction.label}</strong><em>{nextAction.description}</em></span><ArrowRight size={17} /></Link></div>
        <div className="ops-hero-mark"><span>RADAR</span><i /><i /><i /></div>
      </section>
      <section className="ops-stat-grid" aria-label="Resumo da operação">
        <article><span><FolderKanban size={17} /> Projetos em curso</span><strong>{activeProjects.length}</strong><small>Considerando os filtros atuais</small></article>
        <article><span><CircleDot size={17} /> Pedem atenção</span><strong>{attention.length}</strong><small>Em revisão ou bloqueados</small></article>
        <article><span><CheckCircle2 size={17} /> Clientes prontos para IA</span><strong>{readyCredentialCount}</strong><small>{doneTasks.length} tarefa(s) concluída(s) no filtro</small></article>
      </section>
      <section className="ops-flow-panel" aria-label="Fluxo da agência">
        <div className="ops-panel-heading"><div><p className="ops-section-kicker">Como trabalhar na VERTEX</p><h2>Fluxo da agência</h2></div><p className="ops-flow-helper">Cada etapa tem uma finalidade. A ordem é uma referência; você pode retomar qualquer módulo conforme a demanda do cliente.</p></div>
        <div className="ops-flow-grid">{agencyFlow.slice(1).map(item => { const Icon = item.icon; return <Link key={item.href} href={item.href} className="ops-flow-card"><b>{item.step}</b><span><Icon size={17} /></span><div><strong>{item.label}</strong><small>{item.description}</small></div><ArrowRight size={15} /></Link>; })}</div>
      </section>
      {busy ? <div className="ops-page-loading"><Loader2 size={20} /> Atualizando operação…</div> : null}
      <section className="ops-two-column">
        <div className="ops-panel"><div className="ops-panel-heading"><div><p className="ops-section-kicker">04 · Projetos</p><h2>Entregas em andamento</h2></div><Link href="/projetos" className="ops-text-link">Abrir projetos <ArrowRight size={16} /></Link></div>
          {activeProjects.length ? <div className="ops-row-list">{activeProjects.slice(0, 5).map(({ project, client, team }) => <Link key={project.id} href="/projetos" className="ops-project-row"><span className={`ops-status-dot ${project.priority}`} /><span className="ops-row-main"><strong>{project.name}</strong><small>{client.name}{team ? ` · ${team.name}` : ""}</small></span><span className="ops-row-meta"><b>{project.progress}%</b><small>{projectStatusLabel[project.status]}</small></span></Link>)}</div> : <Empty message="Ainda não há projetos no radar. Crie o primeiro para começar a leitura da operação." action="Criar projeto" href="/projetos?novo=1" />}
        </div>
        <div className="ops-panel"><div className="ops-panel-heading"><div><p className="ops-section-kicker">05 · Produção</p><h2>Próximos marcos</h2></div><CalendarDays size={20} /></div>
          {agenda.data?.length ? <div className="ops-agenda-list">{agenda.data.slice(0, 5).map(({ event, project }) => <div key={event.id} className="ops-agenda-item"><time>{formatDate(event.startsAt, true)}</time><span><strong>{event.title}</strong><small>{project?.name ?? "Marco da operação"}</small></span></div>)}</div> : <Empty message="A agenda fica limpa até você registrar reuniões, aprovações, entregas ou prazos." action="Abrir produção" href="/producao" />}
        </div>
      </section>
      <section className="ops-panel ops-credential-panel" aria-label="Status de credenciais de IA por cliente"><div className="ops-panel-heading"><div><p className="ops-section-kicker">03 · Criação</p><h2>Prontidão de IA por cliente</h2></div><Link href="/agencia" className="ops-text-link">Abrir criação <ArrowRight size={16} /></Link></div><div className="ops-credential-toolbar"><p className="ops-credential-intro">Confirme quem já pode criar com um provedor configurado e onde a agência ainda precisa agir antes de gerar materiais.</p><div className="ops-credential-filter" aria-label="Filtro de credenciais"><button className={credentialFilter === "all" ? "is-selected" : ""} type="button" onClick={() => setCredentialFilter("all")}>Todos</button><button className={credentialFilter === "inactive" ? "is-selected" : ""} type="button" onClick={() => setCredentialFilter("inactive")}>Inativas{inactiveCredentialCount ? ` (${inactiveCredentialCount})` : ""}</button></div></div>{credentialStatuses.isLoading ? <div className="ops-page-loading"><Loader2 size={18} /> Lendo status de conexões…</div> : <div className="ops-credential-list">{credentialRows.map(client => { const isActive = client.status === "active"; const isDisabled = client.status === "disabled"; const label = isActive ? `${client.activeCount} ativa${client.activeCount === 1 ? "" : "s"}` : isDisabled ? "Inativa" : "Sem credencial"; return <Link key={client.id} href="/agencia" className={`ops-credential-row is-${client.status}`}><span className="ops-credential-icon">{isActive ? <ShieldCheck size={17} /> : <ShieldAlert size={17} />}</span><span className="ops-credential-client"><strong>{client.name}</strong><small>{isActive ? `${client.disabledCount ? `${client.disabledCount} desativada(s) em histórico.` : "Pronto para criar e revisar."}` : isDisabled ? `${client.disabledCount} conexão(ões) aguardando reativação.` : "Configure uma conexão antes de criar."}</small></span><b>{label}</b></Link>; })}{credentialFilter === "inactive" && !credentialRows.length ? <div className="ops-empty"><p>Nenhum cliente possui apenas credenciais inativas neste momento.</p><button type="button" className="ops-text-button" onClick={() => setCredentialFilter("all")}>Ver todos os clientes</button></div> : null}{!(credentialStatuses.data?.length) ? <div className="ops-empty"><p>Os clientes cadastrados aparecerão aqui quando existir uma conta para operar.</p><Link href="/comercial" className="ops-text-link">Abrir clientes <ArrowRight size={15} /></Link></div> : null}</div>}</section>
      <ApiUsagePanel rows={apiUsage.data} loading={apiUsage.isLoading} periodDays={usagePeriod} onPeriodChange={setUsagePeriod} onSaveLimit={(clientId, limit) => saveMonthlyLimit.mutate({ clientId, monthlyApiCallLimit: limit })} savingClientId={saveMonthlyLimit.isPending ? saveMonthlyLimit.variables?.clientId : null} />
      <section className="ops-focus-strip"><ListChecks size={22} /><div><strong>Gestão da plataforma</strong><span>Suporte, governança, BI, portal do cliente e controles recorrentes ficam reunidos fora do fluxo principal.</span></div><Link href="/gestao">Abrir gestão <ArrowRight size={16} /></Link></section>
    </div>
  </StudioShell>;
}

function Empty({ message, action, href }: { message: string; action: string; href: string }) {
  return <div className="ops-empty"><p>{message}</p><Link href={href} className="ops-text-link">{action} <ArrowRight size={15} /></Link></div>;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function ApiUsagePanel({ rows, loading, periodDays = 30, onPeriodChange, onSaveLimit, savingClientId = null }: { rows: ApiUsageRow[] | undefined; loading: boolean; periodDays?: 7 | 15 | 30; onPeriodChange?: (period: 7 | 15 | 30) => void; onSaveLimit?: (clientId: number, limit: number | null) => void; savingClientId?: number | null }) {
  return <section className="ops-panel ops-usage-panel" aria-label="Consumo de API por cliente"><div className="ops-panel-heading"><div><p className="ops-section-kicker">Uso de IA</p><h2>Consumo por cliente</h2></div><Gauge size={20} /></div><div className="ops-usage-toolbar"><p className="ops-credential-intro">Chamadas e tokens são apurados nas gerações registradas. Custos só aparecem quando um provedor os informar oficialmente.</p><div className="ops-period-filter" aria-label="Período de consumo">{([7, 15, 30] as const).map(period => <button key={period} type="button" className={periodDays === period ? "is-selected" : ""} onClick={() => onPeriodChange?.(period)}>{period} dias</button>)}</div></div>{loading ? <div className="ops-page-loading"><Loader2 size={18} /> Consolidando consumo…</div> : <div className="ops-usage-list">{(rows ?? []).map(client => <article className={`ops-usage-row is-${client.limitStatus}`} key={client.id}><div className="ops-usage-main"><strong>{client.name}</strong><small>{describeApiUsage(client)}</small></div><div className="ops-usage-metrics"><span><b>{client.requestCount}</b> chamadas em {client.periodDays} dias</span><span><b>{client.successfulCount}</b> gerações</span><span><b>{client.telemetryAvailable ? formatNumber(client.totalTokens) : "—"}</b> tokens</span></div><div className="ops-usage-audit"><small>{client.lastUsedAt ? `Último uso: ${formatDate(client.lastUsedAt, true)}` : "Ainda sem uso"}</small><small>{client.averageDurationMs != null ? `${(client.averageDurationMs / 1000).toFixed(1)} s em média` : "Tempo indisponível"}</small><em>Custo indisponível</em></div><ApiUsageLimitControl client={client} onSave={onSaveLimit} saving={savingClientId === client.id} /></article>)}{!(rows?.length) ? <div className="ops-empty"><p>Os clientes aparecerão aqui assim que forem cadastrados. As métricas serão preenchidas a cada geração.</p><Link href="/agencia" className="ops-text-link">Abrir Agência IA <ArrowRight size={15} /></Link></div> : null}</div>}</section>;
}

function ApiUsageLimitControl({ client, onSave, saving }: { client: ApiUsageRow; onSave?: (clientId: number, limit: number | null) => void; saving: boolean }) {
  const [value, setValue] = useState(client.monthlyApiCallLimit?.toString() ?? "");
  const parsed = value.trim() ? Number(value) : null;
  const canSave = parsed === null || (Number.isInteger(parsed) && parsed > 0 && parsed <= 10_000_000);
  const hasConfiguredLimit = client.monthlyApiCallLimit !== null;
  const hasChange = parsed !== client.monthlyApiCallLimit;
  const actionLabel = parsed === null ? (hasConfiguredLimit ? "Remover limite" : "Definir limite") : "Salvar limite";
  return <div className={`ops-usage-limit is-${client.limitStatus}`}><div><strong>{describeUsageLimit(client)}</strong>{client.limitStatus !== "not_configured" ? <small>{client.limitStatus === "near" ? "Consumo próximo ao teto mensal." : client.limitStatus === "reached" ? "Revise o contrato antes de novas gerações." : client.limitStatus === "exceeded" ? "Consumo acima do teto definido." : "Consumo mensal dentro do limite definido."}</small> : <small>Defina um valor inteiro de 1 a 10.000.000 chamadas para ativar alertas de consumo.</small>}</div><label><span>Limite mensal</span><input aria-label={`Limite mensal para ${client.name}`} aria-describedby={`monthly-limit-help-${client.id}`} type="number" min="1" max="10000000" inputMode="numeric" placeholder="Informe de 1 a 10.000.000" value={value} onChange={event => setValue(event.target.value)} /></label><small id={`monthly-limit-help-${client.id}`} className="ops-usage-limit-help">Use somente números inteiros. Deixe em branco para remover um limite já salvo.</small><button type="button" className="ops-text-button" disabled={!onSave || !canSave || saving || !hasChange} onClick={() => onSave?.(client.id, parsed)}>{saving ? "Salvando…" : actionLabel}</button></div>;
}
