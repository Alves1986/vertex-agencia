import { trpc } from "@/lib/trpc";
import { BadgeDollarSign, Bell, ChevronDown, HeartPulse, LayoutDashboard, LifeBuoy, ListFilter, Loader2, MessageCircleMore, Plus, Search, ShieldCheck, SlidersHorizontal, SquareKanban, UsersRound, Workflow, WandSparkles } from "lucide-react";
import { getNotificationTarget } from "@/lib/notificationTarget";
import React, { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import "./studio-shell.css";

export const vertexLogo = "/manus-storage/vertex-consulting-logo-transparent_6996f748.png";

export function VertexBrand() {
  return <><img src={vertexLogo} alt="Logo VERTEX" /><span><b>VERTEX</b><small>Consulting</small></span></>;
}

export const navigationGroups = [
  { label: "Visão", links: [{ href: "/", label: "Visão geral", icon: LayoutDashboard }] },
  { label: "Operação", links: [{ href: "/projetos", label: "Projetos", icon: SquareKanban }, { href: "/producao", label: "Produção", icon: Workflow }] },
  { label: "Inteligência e clientes", links: [{ href: "/agencia", label: "Agência IA", icon: WandSparkles }, { href: "/inteligencia", label: "Inteligência", icon: Search }, { href: "/atendimento", label: "Atendimento", icon: MessageCircleMore }, { href: "/comercial", label: "Comercial", icon: BadgeDollarSign }, { href: "/sucesso", label: "Sucesso", icon: HeartPulse }, { href: "/governanca", label: "Governança", icon: ShieldCheck }, { href: "/suporte", label: "Suporte", icon: LifeBuoy }] },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function StudioShell({ title, eyebrow, actions, children }: { title: string; eyebrow: string; actions?: ReactNode; children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const utils = trpc.useUtils();
  const clients = trpc.workspace.clients.useQuery();
  const teams = trpc.workspace.teams.useQuery();
  const preferences = trpc.workspace.preferences.useQuery();
  const notifications = trpc.notifications.list.useQuery();
  const updatePreferences = trpc.workspace.updatePreferences.useMutation({
    onSuccess: async () => {
      await utils.workspace.preferences.invalidate();
      await utils.projects.list.invalidate();
      await utils.production.tasks.invalidate();
    },
  });
  const markRead = trpc.notifications.markRead.useMutation({ onSuccess: () => utils.notifications.list.invalidate() });
  const markAllRead = trpc.notifications.markAllRead.useMutation({ onSuccess: () => utils.notifications.list.invalidate() });

  const unread = notifications.data?.filter(item => !item.readAt).length ?? 0;
  const activeClient = preferences.data?.activeClientId ?? null;
  const activeTeam = preferences.data?.activeTeamId ?? null;
  return (
    <div className="ops-app">
      <main className="ops-main">
        <header className="ops-header">
          <div className="ops-header-title">
            <Link href="/" className="ops-top-brand" aria-label="VERTEX Consulting — Centro de comando">
              <VertexBrand />
            </Link>
            <span className="ops-header-divider" aria-hidden="true" />
            <div>
              <p className="ops-eyebrow"><i /> {eyebrow}</p>
              <h1>{title}</h1>
            </div>
          </div>
          <div className="ops-header-actions">
            <div className="ops-popover-wrap">
              <button className="ops-icon-button" type="button" aria-label="Abrir filtros persistentes" onClick={() => setFiltersOpen(open => !open)}>
                <SlidersHorizontal size={18} />
              </button>
              {filtersOpen ? (
                <div className="ops-popover ops-filter-popover" role="dialog" aria-label="Filtros do painel">
                  <div className="ops-popover-title"><ListFilter size={16} /> Filtros do painel</div>
                  <label>Cliente
                    <select value={activeClient ?? "all-clients"} onChange={event => updatePreferences.mutate({ activeClientId: event.target.value === "all-clients" ? null : Number(event.target.value) })}>
                      <option value="all-clients">Todos os clientes</option>
                      {(clients.data ?? []).map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
                    </select>
                  </label>
                  <label>Equipe
                    <select value={activeTeam ?? "all-teams"} onChange={event => updatePreferences.mutate({ activeTeamId: event.target.value === "all-teams" ? null : Number(event.target.value) })}>
                      <option value="all-teams">Todas as equipes</option>
                      <TeamFilterOptions teams={teams.data ?? []} />
                    </select>
                  </label>
                  <button type="button" className="ops-text-button" onClick={() => updatePreferences.mutate({ activeClientId: null, activeTeamId: null })}>Limpar filtros</button>
                </div>
              ) : null}
            </div>
            <div className="ops-popover-wrap">
              <button className="ops-icon-button has-badge" type="button" aria-label="Abrir notificações" onClick={() => setNotificationsOpen(open => !open)}>
                <Bell size={19} />{unread ? <b>{unread > 9 ? "9+" : unread}</b> : null}
              </button>
              {notificationsOpen ? (
                <div className="ops-popover ops-notification-popover" role="dialog" aria-label="Notificações">
                  <div className="ops-popover-heading"><div><p>Centro de sinais</p><strong>Notificações</strong></div>{unread ? <button type="button" className="ops-text-button" onClick={() => markAllRead.mutate()}>Ler todas</button> : null}</div>
                  <div className="ops-notification-list">
                    {notifications.isLoading ? <div className="ops-inline-loading"><Loader2 size={16} /> Atualizando sinais</div> : null}
                    {!notifications.isLoading && !(notifications.data?.length) ? <p className="ops-empty-copy">Nenhuma notificação ainda. As novas atividades aparecerão aqui.</p> : null}
                    {(notifications.data ?? []).map(note => (
                      <button key={note.id} type="button" className={note.readAt ? "ops-notification" : "ops-notification is-unread"} onClick={() => { const target = getNotificationTarget(note); if (!note.readAt) markRead.mutate({ notificationId: note.id }); if (target) { setNotificationsOpen(false); setLocation(target); } }}>
                        <span className={`ops-note-icon ${note.type}`}><Bell size={14} /></span>
                        <span><strong>{note.title}</strong><small>{note.body ?? "Atualização da operação"}</small></span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            {actions}
          </div>
        </header>
        <nav className="ops-top-tabs" aria-label="Navegação principal">
          {navigationGroups.map((group, groupIndex) => <React.Fragment key={group.label}>
            {groupIndex ? <span className="ops-top-tabs-divider" aria-hidden="true" /> : null}
            {group.links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} title={`${group.label}: ${label}`} className={isActive(location, href) ? "ops-top-tab is-active" : "ops-top-tab"}><Icon size={16} /><span>{label}</span></Link>)}
          </React.Fragment>)}
        </nav>
        {children}
      </main>
    </div>
  );
}

export function NewProjectLink() {
  return <Link href="/projetos?novo=1" className="ops-primary-button"><Plus size={18} /> Novo projeto</Link>;
}

export function TeamFilterOptions({ teams }: { teams: ReadonlyArray<{ id: number; name: string }> }) {
  return <>{teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</>;
}

export function formatDate(value?: Date | string | null, withTime = false) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(new Date(value));
}

export const projectStatusLabel: Record<string, string> = { briefing: "Briefing", in_progress: "Em andamento", review: "Em revisão", approved: "Aprovado", on_hold: "Pausado", completed: "Concluído" };
export const taskStatusLabel: Record<string, string> = { backlog: "Backlog", ready: "Pronto", in_progress: "Em produção", review: "Em revisão", done: "Concluído", blocked: "Bloqueado" };
export const priorityLabel: Record<string, string> = { low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente" };
