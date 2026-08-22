import { NewProjectLink, StudioShell, formatDate, priorityLabel, projectStatusLabel } from "@/components/StudioShell";
import { trpc } from "@/lib/trpc";
import { ArrowRight, BriefcaseBusiness, FileStack, Loader2, Plus, Search, Settings2, UserPlus, X } from "lucide-react";
import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const statuses = ["briefing", "in_progress", "review", "approved", "on_hold", "completed"] as const;

export default function Projects() {
  const [location, setLocation] = useLocation();
  const showCreateFromUrl = new URLSearchParams(location.split("?")[1] ?? "").get("novo") === "1";
  const projectFromUrl = Number(new URLSearchParams(location.split("?")[1] ?? "").get("projeto"));
  const [createOpen, setCreateOpen] = useState(showCreateFromUrl);
  const [operatorOpen, setOperatorOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(Number.isFinite(projectFromUrl) && projectFromUrl > 0 ? projectFromUrl : null);
  const preferences = trpc.workspace.preferences.useQuery();
  const clients = trpc.workspace.clients.useQuery();
  const teams = trpc.workspace.teams.useQuery();
  const operators = trpc.workspace.operators.useQuery();
  const utils = trpc.useUtils();
  const filters = useMemo(() => ({ clientId: preferences.data?.activeClientId ?? undefined, teamId: preferences.data?.activeTeamId ?? undefined, query: query || undefined }), [preferences.data?.activeClientId, preferences.data?.activeTeamId, query]);
  const projects = trpc.projects.list.useQuery(filters);
  const selected = trpc.projects.get.useQuery({ projectId: selectedProjectId ?? 0 }, { enabled: selectedProjectId !== null });
  const artifacts = trpc.projects.artifacts.useQuery({ projectId: selectedProjectId ?? 0 }, { enabled: selectedProjectId !== null });
  const createProject = trpc.projects.create.useMutation({ onSuccess: async () => { await utils.projects.list.invalidate(); setCreateOpen(false); setLocation("/projetos"); toast.success("Projeto criado e incluído no radar."); } });
  const createClient = trpc.workspace.createClient.useMutation({ onSuccess: () => { utils.workspace.clients.invalidate(); toast.success("Cliente adicionado."); } });
  const createTeam = trpc.workspace.createTeam.useMutation({ onSuccess: () => { utils.workspace.teams.invalidate(); toast.success("Equipe adicionada."); } });
  const createOperator = trpc.workspace.createOperator.useMutation({ onSuccess: () => { utils.workspace.operators.invalidate(); setOperatorOpen(false); toast.success("Responsável incluído na operação."); } });
  const updateStatus = trpc.projects.updateStatus.useMutation({ onSuccess: () => { utils.projects.list.invalidate(); utils.projects.get.invalidate(); } });

  useEffect(() => {
    setSelectedProjectId(Number.isFinite(projectFromUrl) && projectFromUrl > 0 ? projectFromUrl : null);
  }, [projectFromUrl]);

  function submitProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const clientId = Number(data.get("clientId"));
    if (!clientId) return toast.error("Escolha o cliente responsável pelo projeto.");
    const due = String(data.get("dueAt") ?? "");
    createProject.mutate({ name: String(data.get("name") ?? ""), description: String(data.get("description") ?? "") || null, clientId, teamId: String(data.get("teamId")) === "no-team" ? null : Number(data.get("teamId")), responsibleOperatorId: String(data.get("responsibleOperatorId")) === "no-operator" ? null : Number(data.get("responsibleOperatorId")), priority: String(data.get("priority")) as "low" | "medium" | "high" | "urgent", dueAt: due ? new Date(`${due}T12:00:00`) : null });
  }

  function submitOperator(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    createOperator.mutate({ name: String(data.get("name") ?? ""), role: String(data.get("role") ?? "") || null, email: String(data.get("email") ?? "") || null, teamId: String(data.get("teamId")) === "no-team" ? null : Number(data.get("teamId")) });
  }

  return <StudioShell title="Projetos & entregas" eyebrow="04 · Escopo e responsáveis" actions={<><button className="ops-outline-button" type="button" onClick={() => setOperatorOpen(true)}><UserPlus size={17} /> Responsável</button><button className="ops-primary-button" type="button" onClick={() => setCreateOpen(true)}><Plus size={18} /> Novo projeto</button></>}>
    <div className="ops-content">
      <section className="ops-page-intro"><div><p className="ops-section-kicker">Carteira ativa</p><h2>Contexto, responsabilidade e próximo marco em uma mesma leitura.</h2></div><div className="ops-search"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar projeto" aria-label="Buscar projeto" /></div></section>
      {!clients.isLoading && !clients.data?.length ? <WorkspaceSetup onClient={name => createClient.mutate({ name })} onTeam={(name, color) => createTeam.mutate({ name, color })} /> : null}
      <div className="ops-projects-layout">
        <section className="ops-panel ops-project-table"><div className="ops-panel-heading"><div><p className="ops-section-kicker">Lista operacional</p><h2>{projects.data?.length ?? 0} projeto(s)</h2></div><BriefcaseBusiness size={20} /></div>
          {projects.isLoading ? <div className="ops-page-loading"><Loader2 size={20} /> Carregando projetos…</div> : null}
          {!projects.isLoading && !(projects.data?.length) ? <div className="ops-empty"><p>Não há projetos que correspondam aos filtros atuais.</p><button className="ops-text-button" type="button" onClick={() => setCreateOpen(true)}>Criar primeiro projeto</button></div> : null}
          <div className="ops-project-table-list">{(projects.data ?? []).map(row => <ProjectListEntry key={row.project.id} row={row} selected={selectedProjectId === row.project.id} onSelect={() => setSelectedProjectId(row.project.id)} />)}</div>
        </section>
        <aside className="ops-detail-panel">{selectedProjectId && selected.data ? <><button type="button" className="ops-close-detail" onClick={() => setSelectedProjectId(null)}><X size={17} /> Fechar</button><p className="ops-section-kicker">Projeto selecionado</p><h2>{selected.data.project.name}</h2><p>{selected.data.project.description || "Sem descrição registrada."}</p><dl className="ops-detail-list"><div><dt>Cliente</dt><dd>{selected.data.client.name}</dd></div><div><dt>Equipe</dt><dd>{selected.data.team?.name ?? "Não atribuída"}</dd></div><div><dt>Responsável</dt><dd>{selected.data.responsible?.name ?? "Não atribuído"}</dd></div><div><dt>Prioridade</dt><dd>{priorityLabel[selected.data.project.priority]}</dd></div><div><dt>Prazo</dt><dd>{formatDate(selected.data.project.dueAt)}</dd></div></dl><label className="ops-status-control">Status<select value={selected.data.project.status} onChange={event => updateStatus.mutate({ projectId: selected.data!.project.id, status: event.target.value as typeof statuses[number] })}>{statuses.map(status => <option key={status} value={status}>{projectStatusLabel[status]}</option>)}</select></label><div className="ops-progress-readout"><span>Progresso registrado</span><b>{selected.data.project.progress}%</b><i><em style={{ width: `${selected.data.project.progress}%` }} /></i></div><div className="ops-artifacts"><div><FileStack size={17} /><strong>Entregas vinculadas</strong></div>{artifacts.isLoading ? <small>Consultando arquivos…</small> : artifacts.data?.length ? artifacts.data.map(file => <span key={file.id}>{file.fileName}</span>) : <small>Conecte a aplicação original na Produção e vincule arquivos reais aqui.</small>}</div></> : <div className="ops-detail-placeholder"><Settings2 size={22} /><strong>Selecione um projeto</strong><p>Abra um item da lista para ver contexto, prazo, status e arquivos associados.</p></div>}</aside>
      </div>
    </div>
    {createOpen ? <ProjectComposer clients={clients.data ?? []} teams={teams.data ?? []} operators={operators.data ?? []} onClose={() => { setCreateOpen(false); setLocation("/projetos"); }} onSubmit={submitProject} pending={createProject.isPending} /> : null}
    {operatorOpen ? <OperatorComposer teams={teams.data ?? []} onClose={() => setOperatorOpen(false)} onSubmit={submitOperator} pending={createOperator.isPending} /> : null}
  </StudioShell>;
}

export function ProjectListEntry({ row, selected, onSelect }: { row: any; selected: boolean; onSelect: () => void }) {
  const { project, client, team, responsible } = row;
  return <button className={selected ? "ops-project-table-row is-selected" : "ops-project-table-row"} type="button" onClick={onSelect}><span className={`ops-status-dot ${project.priority}`} /><span><strong>{project.name}</strong><small>{client.name}{team ? ` · ${team.name}` : ""}{responsible ? ` · ${responsible.name}` : ""}</small></span><span><small>Próximo marco</small><b>{formatDate(project.dueAt)}</b></span><span className={`ops-status-tag ${project.status}`}>{projectStatusLabel[project.status]}</span><span className="ops-percent">{project.progress}%</span></button>;
}

function WorkspaceSetup({ onClient, onTeam }: { onClient: (name: string) => void; onTeam: (name: string, color: string) => void }) {
  const [clientName, setClientName] = useState(""); const [teamName, setTeamName] = useState("");
  return <section className="ops-setup"><div><p className="ops-section-kicker">Primeira configuração</p><h2>Crie o contexto antes de abrir o primeiro projeto.</h2></div><form onSubmit={event => { event.preventDefault(); if (clientName.trim()) { onClient(clientName.trim()); setClientName(""); } }}><label>Cliente<input value={clientName} onChange={event => setClientName(event.target.value)} placeholder="Nome do cliente" /></label><button className="ops-outline-button" type="submit">Adicionar cliente</button></form><form onSubmit={event => { event.preventDefault(); if (teamName.trim()) { onTeam(teamName.trim(), "#E85D3F"); setTeamName(""); } }}><label>Equipe<input value={teamName} onChange={event => setTeamName(event.target.value)} placeholder="Ex.: Criação" /></label><button className="ops-outline-button" type="submit">Adicionar equipe</button></form></section>;
}

function ProjectComposer({ clients, teams, operators, onClose, onSubmit, pending }: { clients: Array<{ id: number; name: string }>; teams: Array<{ id: number; name: string }>; operators: Array<{ operator: { id: number; name: string } }>; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; pending: boolean }) {
  return <div className="ops-modal-backdrop" role="presentation"><section className="ops-modal" role="dialog" aria-modal="true" aria-label="Criar projeto"><div className="ops-modal-heading"><div><p className="ops-section-kicker">Novo sinal</p><h2>Criar projeto</h2></div><button type="button" className="ops-icon-button" onClick={onClose} aria-label="Fechar"><X size={18} /></button></div><form className="ops-form-grid" onSubmit={onSubmit}><label className="full">Nome do projeto<input name="name" autoFocus required minLength={2} placeholder="Ex.: Campanha de lançamento" /></label><label className="full">Contexto<textarea name="description" placeholder="Objetivo, escopo ou decisão necessária" rows={3} /></label><label>Cliente<select name="clientId" defaultValue="select-client" required><option value="select-client" disabled>Selecione um cliente</option>{clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><label>Equipe<select name="teamId" defaultValue="no-team"><option value="no-team">Sem equipe definida</option>{teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label><label>Responsável<select name="responsibleOperatorId" defaultValue="no-operator"><option value="no-operator">Sem responsável</option>{operators.map(({ operator }) => <option key={operator.id} value={operator.id}>{operator.name}</option>)}</select></label><label>Prioridade<select name="priority" defaultValue="medium"><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></label><label>Próximo marco<input name="dueAt" type="date" /></label><div className="ops-form-actions full"><button type="button" className="ops-ghost-button" onClick={onClose}>Cancelar</button><button type="submit" className="ops-primary-button" disabled={pending}>{pending ? <Loader2 size={17} className="spin" /> : <Plus size={17} />} Criar projeto</button></div></form></section></div>;
}

function OperatorComposer({ teams, onClose, onSubmit, pending }: { teams: Array<{ id: number; name: string }>; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; pending: boolean }) {
  return <div className="ops-modal-backdrop" role="presentation"><section className="ops-modal" role="dialog" aria-modal="true" aria-label="Adicionar responsável"><div className="ops-modal-heading"><div><p className="ops-section-kicker">Equipe de operação</p><h2>Novo responsável</h2></div><button type="button" className="ops-icon-button" onClick={onClose} aria-label="Fechar"><X size={18} /></button></div><form className="ops-form-grid" onSubmit={onSubmit}><label>Nome<input name="name" autoFocus required minLength={2} placeholder="Nome completo" /></label><label>Função<input name="role" placeholder="Ex.: Direção de arte" /></label><label className="full">E-mail<input name="email" type="email" placeholder="nome@agencia.com" /></label><label>Equipe<select name="teamId" defaultValue="no-team"><option value="no-team">Sem equipe definida</option>{teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label><div className="ops-form-actions full"><button type="button" className="ops-ghost-button" onClick={onClose}>Cancelar</button><button type="submit" className="ops-primary-button" disabled={pending}>{pending ? <Loader2 size={17} className="spin" /> : <UserPlus size={17} />} Adicionar responsável</button></div></form></section></div>;
}
