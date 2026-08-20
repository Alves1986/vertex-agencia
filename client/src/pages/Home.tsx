import { NewProjectLink, StudioShell, formatDate, projectStatusLabel } from "@/components/StudioShell";
import { trpc } from "@/lib/trpc";
import { ArrowRight, CalendarDays, CheckCircle2, CircleDot, FolderKanban, KeyRound, ListChecks, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import "./home-credentials.css";

export type CredentialStatusRow = { id: number; name: string; activeCount: number; disabledCount: number; status: "active" | "disabled" | "missing" };

export function filterCredentialStatuses(rows: CredentialStatusRow[], filter: "all" | "inactive") {
  return filter === "all" ? rows : rows.filter(client => client.status === "disabled");
}

export default function Home() {
  const [credentialFilter, setCredentialFilter] = useState<"all" | "inactive">("all");
  const preferences = trpc.workspace.preferences.useQuery();
  const filters = useMemo(() => ({ clientId: preferences.data?.activeClientId ?? undefined, teamId: preferences.data?.activeTeamId ?? undefined }), [preferences.data?.activeClientId, preferences.data?.activeTeamId]);
  const projects = trpc.projects.list.useQuery(filters);
  const tasks = trpc.production.tasks.useQuery(filters);
  const agenda = trpc.production.agenda.useQuery();
  const credentialStatuses = trpc.agency.credentialStatuses.useQuery();
  const activeProjects = (projects.data ?? []).filter(row => !["completed", "on_hold"].includes(row.project.status));
  const attention = (tasks.data ?? []).filter(row => ["blocked", "review"].includes(row.task.status));
  const doneTasks = (tasks.data ?? []).filter(row => row.task.status === "done");
  const busy = preferences.isLoading || projects.isLoading || tasks.isLoading;
  const credentialRows = filterCredentialStatuses(credentialStatuses.data ?? [], credentialFilter);
  const inactiveCredentialCount = (credentialStatuses.data ?? []).filter(client => client.status === "disabled").length;

  return <StudioShell title="Visão geral" eyebrow="Radar da operação" actions={<NewProjectLink />}>
    <div className="ops-content">
      <section className="ops-hero-card">
        <div><p className="ops-section-kicker">Leitura de agora</p><h2>O estúdio acompanha o que você realmente colocou em movimento.</h2><p>Projetos, produção e agenda formam um só ritmo — e os filtros escolhidos permanecem ativos entre as páginas.</p></div>
        <div className="ops-hero-mark"><span>RADAR</span><i /><i /><i /></div>
      </section>
      <section className="ops-stat-grid" aria-label="Resumo da operação">
        <article><span><FolderKanban size={17} /> Projetos em curso</span><strong>{activeProjects.length}</strong><small>Considerando os filtros atuais</small></article>
        <article><span><CircleDot size={17} /> Pedem atenção</span><strong>{attention.length}</strong><small>Em revisão ou bloqueados</small></article>
        <article><span><CheckCircle2 size={17} /> Tarefas concluídas</span><strong>{doneTasks.length}</strong><small>O sinal vem da produção</small></article>
      </section>
      {busy ? <div className="ops-page-loading"><Loader2 size={20} /> Atualizando operação…</div> : null}
      <section className="ops-two-column">
        <div className="ops-panel"><div className="ops-panel-heading"><div><p className="ops-section-kicker">Projetos</p><h2>No radar</h2></div><Link href="/projetos" className="ops-text-link">Ver todos <ArrowRight size={16} /></Link></div>
          {activeProjects.length ? <div className="ops-row-list">{activeProjects.slice(0, 5).map(({ project, client, team }) => <Link key={project.id} href="/projetos" className="ops-project-row"><span className={`ops-status-dot ${project.priority}`} /><span className="ops-row-main"><strong>{project.name}</strong><small>{client.name}{team ? ` · ${team.name}` : ""}</small></span><span className="ops-row-meta"><b>{project.progress}%</b><small>{projectStatusLabel[project.status]}</small></span></Link>)}</div> : <Empty message="Ainda não há projetos no radar. Crie o primeiro para começar a leitura da operação." action="Criar projeto" href="/projetos?novo=1" />}
        </div>
        <div className="ops-panel"><div className="ops-panel-heading"><div><p className="ops-section-kicker">Agenda</p><h2>Próximos marcos</h2></div><CalendarDays size={20} /></div>
          {agenda.data?.length ? <div className="ops-agenda-list">{agenda.data.slice(0, 5).map(({ event, project }) => <div key={event.id} className="ops-agenda-item"><time>{formatDate(event.startsAt, true)}</time><span><strong>{event.title}</strong><small>{project?.name ?? "Marco da operação"}</small></span></div>)}</div> : <Empty message="A agenda fica limpa até você registrar reuniões, aprovações, entregas ou prazos." action="Abrir produção" href="/producao" />}
        </div>
      </section>
      <section className="ops-panel ops-credential-panel" aria-label="Status de credenciais de IA por cliente"><div className="ops-panel-heading"><div><p className="ops-section-kicker">Prontidão de IA</p><h2>Credenciais por cliente</h2></div><KeyRound size={20} /></div><div className="ops-credential-toolbar"><p className="ops-credential-intro">Veja quem já pode gerar com um provedor configurado e onde ainda é preciso agir.</p><div className="ops-credential-filter" aria-label="Filtro de credenciais"><button className={credentialFilter === "all" ? "is-selected" : ""} type="button" onClick={() => setCredentialFilter("all")}>Todos</button><button className={credentialFilter === "inactive" ? "is-selected" : ""} type="button" onClick={() => setCredentialFilter("inactive")}>Inativas{inactiveCredentialCount ? ` (${inactiveCredentialCount})` : ""}</button></div></div>{credentialStatuses.isLoading ? <div className="ops-page-loading"><Loader2 size={18} /> Lendo status de conexões…</div> : <div className="ops-credential-list">{credentialRows.map(client => { const isActive = client.status === "active"; const isDisabled = client.status === "disabled"; const label = isActive ? `${client.activeCount} ativa${client.activeCount === 1 ? "" : "s"}` : isDisabled ? "Inativa" : "Sem credencial"; return <Link key={client.id} href="/agencia" className={`ops-credential-row is-${client.status}`}><span className="ops-credential-icon">{isActive ? <ShieldCheck size={17} /> : <ShieldAlert size={17} />}</span><span className="ops-credential-client"><strong>{client.name}</strong><small>{isActive ? `${client.disabledCount ? `${client.disabledCount} desativada(s) em histórico.` : "Pronto para escolher o provedor."}` : isDisabled ? `${client.disabledCount} conexão(ões) aguardando reativação.` : "Configure uma conexão para começar."}</small></span><b>{label}</b></Link>; })}{credentialFilter === "inactive" && !credentialRows.length ? <div className="ops-empty"><p>Nenhum cliente possui apenas credenciais inativas neste momento.</p><button type="button" className="ops-text-button" onClick={() => setCredentialFilter("all")}>Ver todos os clientes</button></div> : null}{!(credentialStatuses.data?.length) ? <div className="ops-empty"><p>Os clientes cadastrados aparecerão aqui com o estado de suas credenciais de IA.</p><Link href="/agencia" className="ops-text-link">Abrir Agência IA <ArrowRight size={15} /></Link></div> : null}</div>}</section>
      <section className="ops-focus-strip"><ListChecks size={22} /><div><strong>Produção sem ruído</strong><span>{attention.length ? `${attention.length} item(ns) precisam de decisão.` : "Nenhum bloqueio ou revisão pendente nos filtros atuais."}</span></div><Link href="/producao">Abrir produção <ArrowRight size={16} /></Link></section>
    </div>
  </StudioShell>;
}

function Empty({ message, action, href }: { message: string; action: string; href: string }) {
  return <div className="ops-empty"><p>{message}</p><Link href={href} className="ops-text-link">{action} <ArrowRight size={15} /></Link></div>;
}
