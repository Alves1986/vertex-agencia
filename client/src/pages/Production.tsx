import { NewProjectLink, StudioShell, formatDate, priorityLabel, taskStatusLabel } from "@/components/StudioShell";
import { trpc } from "@/lib/trpc";
import { getTaskIdFromLocation } from "@/lib/notificationTarget";
import { CalendarPlus, CheckSquare2, CircleDotDashed, CloudCog, Link2, Loader2, Plus, UploadCloud, X } from "lucide-react";
import React, { FormEvent, RefObject, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const taskStatuses = ["backlog", "ready", "in_progress", "review", "done", "blocked"] as const;
const publishedOriginalAppUrl = "https://agencia-app-backend.onrender.com";

export default function Production() {
  const [location, setLocation] = useLocation();
  const taskFromUrl = getTaskIdFromLocation(location);
  const [composer, setComposer] = useState<"task" | "event" | null>(null);
  const [connectionUrl, setConnectionUrl] = useState(publishedOriginalAppUrl);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [projectToAttach, setProjectToAttach] = useState("no-project");
  const taskDetailRef = useRef<HTMLElement | null>(null);
  const preferences = trpc.workspace.preferences.useQuery();
  const operators = trpc.workspace.operators.useQuery();
  const projects = trpc.projects.list.useQuery(useMemo(() => ({ clientId: preferences.data?.activeClientId ?? undefined, teamId: preferences.data?.activeTeamId ?? undefined }), [preferences.data?.activeClientId, preferences.data?.activeTeamId]));
  const filters = useMemo(() => ({ clientId: preferences.data?.activeClientId ?? undefined, teamId: preferences.data?.activeTeamId ?? undefined }), [preferences.data?.activeClientId, preferences.data?.activeTeamId]);
  const tasks = trpc.production.tasks.useQuery(filters);
  const taskDetail = trpc.production.getTask.useQuery({ taskId: taskFromUrl ?? 0 }, { enabled: taskFromUrl !== null });
  const agenda = trpc.production.agenda.useQuery();
  const connection = trpc.originalApp.connection.useQuery();
  const integration = trpc.originalApp.inspect.useQuery(undefined, { enabled: connection.data?.connectionStatus === "connected", retry: false });
  const utils = trpc.useUtils();
  const updateStatus = trpc.production.updateTaskStatus.useMutation({ onSuccess: () => utils.production.tasks.invalidate() });
  const createTask = trpc.production.createTask.useMutation({ onSuccess: () => { utils.production.tasks.invalidate(); utils.notifications.list.invalidate(); setComposer(null); toast.success("Tarefa criada na produção."); } });
  const createEvent = trpc.production.createEvent.useMutation({ onSuccess: () => { utils.production.agenda.invalidate(); setComposer(null); toast.success("Marco registrado na agenda."); } });
  const connect = trpc.originalApp.testAndSave.useMutation({ onSuccess: () => { utils.originalApp.connection.invalidate(); utils.originalApp.inspect.invalidate(); utils.notifications.list.invalidate(); toast.success("Aplicação original conectada."); }, onError: error => toast.error(error.message) });
  const attach = trpc.originalApp.attachFilesToProject.useMutation({ onSuccess: result => { setSelectedFiles([]); utils.projects.artifacts.invalidate(); utils.notifications.list.invalidate(); toast.success(`${result.attached} arquivo(s) vinculados ao projeto.`); }, onError: error => toast.error(error.message) });

  useEffect(() => {
    if (!taskFromUrl || !taskDetail.data) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`tarefa-${taskFromUrl}`)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      taskDetailRef.current?.focus();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [taskFromUrl, taskDetail.data]);

  function submitTask(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); const due = String(data.get("dueAt") ?? ""); createTask.mutate({ title: String(data.get("title") ?? ""), projectId: String(data.get("projectId")) === "no-project" ? null : Number(data.get("projectId")), responsibleOperatorId: String(data.get("responsibleOperatorId")) === "no-operator" ? null : Number(data.get("responsibleOperatorId")), priority: String(data.get("priority")) as "low" | "medium" | "high" | "urgent", status: "backlog", dueAt: due ? new Date(`${due}T12:00:00`) : null }); }
  function submitEvent(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); const startsAt = String(data.get("startsAt") ?? ""); if (!startsAt) return; createEvent.mutate({ title: String(data.get("title") ?? ""), projectId: String(data.get("projectId")) === "no-project" ? null : Number(data.get("projectId")), responsibleOperatorId: String(data.get("responsibleOperatorId")) === "no-operator" ? null : Number(data.get("responsibleOperatorId")), eventType: String(data.get("eventType")) as "meeting" | "review" | "delivery" | "focus" | "deadline", startsAt: new Date(startsAt) }); }
  function toggleFile(name: string) { setSelectedFiles(current => current.includes(name) ? current.filter(file => file !== name) : [...current, name]); }

  return <StudioShell title="Produção & calendário" eyebrow="05 · Execução e prazos" actions={<NewProjectLink />}>
    <div className="ops-content">
      <section className="ops-page-intro"><div><p className="ops-section-kicker">Fila de trabalho</p><h2>Transforme cada tarefa, revisão e entrega em um sinal inequívoco.</h2></div><div className="ops-button-group"><button type="button" className="ops-outline-button" onClick={() => setComposer("event")}><CalendarPlus size={17} /> Novo marco</button><button type="button" className="ops-primary-button" onClick={() => setComposer("task")}><Plus size={17} /> Nova tarefa</button></div></section>
      <section className="ops-production-board" aria-label="Quadro de produção">
        {taskStatuses.map(status => {
          const group = (tasks.data ?? []).filter(row => row.task.status === status);
          return (
            <div className="ops-task-column" key={status}>
              <div className="ops-task-column-heading"><span>{taskStatusLabel[status]}</span><b>{group.length}</b></div>
              {group.map(row => <ProductionTaskCard key={row.task.id} row={row} targeted={row.task.id === taskFromUrl} onStatus={status => updateStatus.mutate({ taskId: row.task.id, status })} />)}
              {!group.length ? <div className="ops-empty-slot">Sem tarefas neste estágio.</div> : null}
            </div>
          );
        })}
      </section>
      <section className="ops-two-column ops-production-lower"><div className="ops-panel"><div className="ops-panel-heading"><div><p className="ops-section-kicker">Agenda operacional</p><h2>Próximos marcos</h2></div><CircleDotDashed size={20} /></div><ProductionAgenda rows={agenda.data ?? []} /></div><IntegrationPanel connectionUrl={connectionUrl} setConnectionUrl={setConnectionUrl} connection={connection.data} integration={integration.data} loading={integration.isLoading} projects={projects.data ?? []} projectToAttach={projectToAttach} setProjectToAttach={setProjectToAttach} selectedFiles={selectedFiles} toggleFile={toggleFile} onConnect={() => connect.mutate({ baseUrl: connectionUrl.trim() || connection.data?.baseUrl || publishedOriginalAppUrl })} connecting={connect.isPending} onAttach={() => projectToAttach !== "no-project" && attach.mutate({ projectId: Number(projectToAttach), fileNames: selectedFiles })} attaching={attach.isPending} /></section>
    </div>
    {composer ? <ProductionComposer mode={composer} projects={projects.data ?? []} operators={operators.data ?? []} onClose={() => setComposer(null)} onTask={submitTask} onEvent={submitEvent} pending={createTask.isPending || createEvent.isPending} /> : null}
    {taskFromUrl !== null && taskDetail.data ? <TaskDetail task={taskDetail.data} detailRef={taskDetailRef} onClose={() => setLocation("/producao")} onStatus={status => updateStatus.mutate({ taskId: taskDetail.data!.task.id, status })} /> : null}
  </StudioShell>;
}

export function ProductionTaskCard({ row, targeted, onStatus }: { row: any; targeted: boolean; onStatus: (status: (typeof taskStatuses)[number]) => void }) {
  const { task, project, client, responsible } = row;
  return <article id={`tarefa-${task.id}`} className={`ops-task-card ${task.priority}${targeted ? " is-targeted" : ""}`}><div><span className="ops-priority-chip">{priorityLabel[task.priority]}</span><button type="button" aria-label={`Atualizar status da tarefa ${task.title}`} className="ops-task-status" onClick={() => onStatus(task.status === "done" ? "backlog" : "done")}><CheckSquare2 size={17} /></button></div><strong>{task.title}</strong><p>{project?.name ?? "Sem projeto vinculado"}{client ? ` · ${client.name}` : ""}{responsible ? ` · ${responsible.name}` : ""}</p><footer><span>{formatDate(task.dueAt)}</span><select value={task.status} onChange={event => onStatus(event.target.value as (typeof taskStatuses)[number])}>{taskStatuses.map(item => <option key={item} value={item}>{taskStatusLabel[item]}</option>)}</select></footer></article>;
}

export function ProductionAgenda({ rows }: { rows: any[] }) {
  if (!rows.length) return <div className="ops-empty"><p>Não há marcos na agenda. Registre reuniões, entregas e revisões para torná-los visíveis à equipe.</p></div>;

  return <div className="ops-agenda-list">{rows.slice(0, 8).map(({ event, project, responsible }) => <div key={event.id} className="ops-agenda-item"><time>{formatDate(event.startsAt, true)}</time><span><strong>{event.title}</strong><small>{project?.name ?? "Evento da operação"}{responsible ? ` · ${responsible.name}` : ""}</small></span></div>)}</div>;
}

export function IntegrationPanel({ connectionUrl, setConnectionUrl, connection, integration, loading, projects, projectToAttach, setProjectToAttach, selectedFiles, toggleFile, onConnect, connecting, onAttach, attaching }: any) {
  return <aside className="ops-panel ops-integration"><div className="ops-panel-heading"><div><p className="ops-section-kicker">Aplicação original</p><h2>Arquivos de produção</h2></div><CloudCog size={20} /></div><p className="ops-integration-copy">Conecte a instância FastAPI publicada para consultar as skills e os arquivos que ela realmente gerou. Credenciais de IA não são transferidas.</p><div className="ops-connect-form"><input value={connectionUrl} onChange={event => setConnectionUrl(event.target.value)} placeholder="https://sua-instancia.example.com" aria-label="URL HTTPS da aplicação original" /><button className="ops-outline-button" type="button" onClick={onConnect} disabled={connecting}>{connecting ? <Loader2 size={16} className="spin" /> : <Link2 size={16} />} {connection?.connectionStatus === "connected" ? "Atualizar" : "Conectar"}</button></div>{connection?.connectionStatus === "connected" ? <p className="ops-connected-copy">Instância conectada. Altere esta URL somente quando a nova publicação estiver disponível.</p> : null}{connection?.connectionStatus === "error" ? <p className="ops-error-copy">{connection.lastError ?? "A última tentativa falhou."}</p> : null}{loading ? <div className="ops-inline-loading"><Loader2 size={16} /> Consultando instância original…</div> : null}{integration ? <div className="ops-integration-results"><p><strong>{integration.config.configured ? "IA configurada" : "IA sem chave configurada"}</strong>{integration.config.provider ? ` · ${integration.config.provider}` : ""}</p><div className="ops-skill-list">{integration.skills.map((skill: any) => <span key={skill.id ?? skill.name}>{skill.name ?? skill.id}</span>)}</div>{integration.files.length ? <><div className="ops-file-choices">{integration.files.map((file: any) => <label key={file.name}><input type="checkbox" checked={selectedFiles.includes(file.name)} onChange={() => toggleFile(file.name)} />{file.name}</label>)}</div><select value={projectToAttach} onChange={event => setProjectToAttach(event.target.value)}><option value="no-project">Vincular ao projeto…</option>{projects.map((row: any) => <option key={row.project.id} value={row.project.id}>{row.project.name}</option>)}</select><button type="button" className="ops-primary-button ops-full-button" disabled={!selectedFiles.length || projectToAttach === "no-project" || attaching} onClick={onAttach}>{attaching ? <Loader2 size={16} className="spin" /> : <UploadCloud size={16} />} Vincular arquivos selecionados</button></> : <p className="ops-empty-copy">A instância não retornou arquivos em `storage`.</p>}</div> : null}</aside>;
}

function ProductionComposer({ mode, projects, operators, onClose, onTask, onEvent, pending }: { mode: "task" | "event"; projects: any[]; operators: Array<{ operator: { id: number; name: string } }>; onClose: () => void; onTask: (event: FormEvent<HTMLFormElement>) => void; onEvent: (event: FormEvent<HTMLFormElement>) => void; pending: boolean }) {
  const isTask = mode === "task";
  return <div className="ops-modal-backdrop" role="presentation"><section className="ops-modal" role="dialog" aria-modal="true" aria-label={isTask ? "Criar tarefa" : "Criar marco"}><div className="ops-modal-heading"><div><p className="ops-section-kicker">Produção</p><h2>{isTask ? "Nova tarefa" : "Novo marco"}</h2></div><button type="button" className="ops-icon-button" onClick={onClose}><X size={18} /></button></div><form className="ops-form-grid" onSubmit={isTask ? onTask : onEvent}><label className="full">Título<input name="title" required minLength={2} autoFocus placeholder={isTask ? "Ex.: Revisar roteiro principal" : "Ex.: Reunião de alinhamento"} /></label><label>Projeto<select name="projectId" defaultValue="no-project"><option value="no-project">Sem projeto vinculado</option>{projects.map(row => <option key={row.project.id} value={row.project.id}>{row.project.name}</option>)}</select></label><label>Responsável<select name="responsibleOperatorId" defaultValue="no-operator"><option value="no-operator">Sem responsável</option>{operators.map(({ operator }) => <option key={operator.id} value={operator.id}>{operator.name}</option>)}</select></label>{isTask ? <><label>Prioridade<select name="priority" defaultValue="medium"><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></label><label className="full">Prazo<input name="dueAt" type="date" /></label></> : <><label>Tipo<select name="eventType" defaultValue="meeting"><option value="meeting">Reunião</option><option value="review">Revisão</option><option value="delivery">Entrega</option><option value="focus">Foco</option><option value="deadline">Prazo</option></select></label><label>Quando<input name="startsAt" type="datetime-local" required /></label></>}<div className="ops-form-actions full"><button className="ops-ghost-button" type="button" onClick={onClose}>Cancelar</button><button className="ops-primary-button" type="submit" disabled={pending}>{pending ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}{isTask ? "Criar tarefa" : "Registrar marco"}</button></div></form></section></div>;
}

export function TaskDetail({ task: row, detailRef, onClose, onStatus }: { task: any; detailRef: RefObject<HTMLElement | null>; onClose: () => void; onStatus: (status: (typeof taskStatuses)[number]) => void }) {
  const { task, project, client, team, responsible } = row;
  return <div className="ops-modal-backdrop" role="presentation"><section ref={detailRef} tabIndex={-1} className="ops-modal ops-task-detail" role="dialog" aria-modal="true" aria-label="Detalhe da tarefa"><div className="ops-modal-heading"><div><p className="ops-section-kicker">Tarefa vinculada</p><h2>{task.title}</h2></div><button type="button" className="ops-icon-button" onClick={onClose} aria-label="Fechar detalhe"><X size={18} /></button></div><p className="ops-task-detail-copy">{task.description || "Sem contexto adicional registrado para esta tarefa."}</p><dl className="ops-task-detail-list"><div><dt>Projeto</dt><dd>{project?.name ?? "Sem projeto vinculado"}</dd></div><div><dt>Cliente</dt><dd>{client?.name ?? "Não atribuído"}</dd></div><div><dt>Equipe</dt><dd>{team?.name ?? "Não atribuída"}</dd></div><div><dt>Responsável</dt><dd>{responsible?.name ?? "Não atribuído"}</dd></div><div><dt>Prazo</dt><dd>{formatDate(task.dueAt)}</dd></div></dl><label className="ops-status-control ops-light-status-control">Status<select value={task.status} onChange={event => onStatus(event.target.value as (typeof taskStatuses)[number])}>{taskStatuses.map(status => <option key={status} value={status}>{taskStatusLabel[status]}</option>)}</select></label></section></div>;
}
