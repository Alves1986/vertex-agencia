import { trpc } from "@/lib/trpc";
import { ArrowLeft, Bot, CalendarDays, CheckCircle2, CircleAlert, MessageCircleMore, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { inboxStatusCopy } from "./WhatsApp";
import "./whatsapp-saas.css";

export function clientSubscriptionStatusCopy(status: string | null | undefined) {
  const labels: Record<string, string> = { active: "Assinatura ativa", trialing: "Período de teste", past_due: "Ação financeira necessária", canceled: "Assinatura encerrada" };
  return labels[status ?? ""] ?? "Sem assinatura ativa";
}

export default function ClientPortal() {
  const workspaces = trpc.whatsapp.clientPortalWorkspaces.useQuery();
  const [clientId, setClientId] = useState<number | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const overview = trpc.whatsapp.clientPortalOverview.useQuery({ clientId: clientId ?? 0 }, { enabled: clientId !== null });
  const messages = trpc.whatsapp.clientPortalConversationMessages.useQuery({ clientId: clientId ?? 0, conversationId: conversationId ?? 0 }, { enabled: clientId !== null && conversationId !== null });

  useEffect(() => {
    if (clientId === null && workspaces.data?.[0]) setClientId(workspaces.data[0].clientId);
  }, [clientId, workspaces.data]);

  useEffect(() => {
    if (!overview.data?.conversations.length) {
      setConversationId(null);
      return;
    }
    if (!overview.data.conversations.some(conversation => conversation.id === conversationId)) setConversationId(overview.data.conversations[0].id);
  }, [conversationId, overview.data?.conversations]);

  const portal = overview.data;
  return <main className="client-portal-shell">
    <header className="client-portal-header">
      <div><span className="client-portal-kicker">VERTEX CONSULTING</span><h1>Meu atendimento</h1><p>Acompanhe somente os canais e conversas autorizados para a sua operação.</p></div>
      <Link href="/"><ArrowLeft size={16} /> Voltar ao painel</Link>
    </header>

    {workspaces.isLoading ? <div className="wa-empty">Carregando seu espaço…</div> : !(workspaces.data ?? []).length ? <section className="client-portal-empty"><ShieldCheck size={28} /><h2>Acesso ainda não liberado</h2><p>Peça para a VERTEX associar seu usuário ao cliente correto. Após a liberação, este ambiente mostrará apenas suas informações operacionais.</p></section> : <>
      <label className="client-portal-picker"><span>Operação vinculada</span><select value={clientId ?? ""} onChange={event => setClientId(Number(event.target.value))}>{workspaces.data?.map(workspace => <option key={workspace.clientId} value={workspace.clientId}>{workspace.name} · {workspace.role}</option>)}</select></label>
      {overview.isLoading ? <div className="wa-empty">Atualizando dados da operação…</div> : portal ? <>
        <section className="client-portal-summary">
          <article><CheckCircle2 size={18} /><span>Assinatura</span><strong>{clientSubscriptionStatusCopy(portal.subscription?.status)}</strong><small>{portal.subscription?.planName ?? "Plano ainda não vinculado"}</small></article>
          <article><Bot size={18} /><span>Atendimento por IA</span><strong>{portal.policy?.aiAccessMode === "vertex_managed" ? "IA VERTEX" : portal.policy?.aiAccessMode === "client_api_key" ? "IA do cliente" : "Em configuração"}</strong><small>{portal.policy?.workflowMode === "draft_for_approval" ? "Respostas passam por revisão" : portal.policy?.workflowMode === "handoff_only" ? "Encaminhamento humano" : "Automação conforme política"}</small></article>
          <article><CalendarDays size={18} /><span>Canais</span><strong>{portal.channels.filter(channel => channel.status === "active").length} ativo(s)</strong><small>{portal.channels.length} canal(is) autorizado(s)</small></article>
        </section>

        <section className="client-portal-content">
          <article className="client-portal-card"><div className="client-portal-card-title"><MessageCircleMore size={18} /><div><h2>Conversas recentes</h2><p>Histórico da sua operação. Rascunhos internos não são exibidos.</p></div></div>{!portal.conversations.length ? <div className="wa-empty">Ainda não há conversas recebidas neste canal.</div> : <div className="client-conversation-list">{portal.conversations.map(conversation => <button type="button" className={conversationId === conversation.id ? "is-selected" : ""} key={conversation.id} onClick={() => setConversationId(conversation.id)}><span><strong>{conversation.channelLabel}</strong><small>{inboxStatusCopy(conversation.status)}</small></span><em>{conversation.lastMessagePreview || "Sem prévia disponível"}</em></button>)}</div>}</article>
          <article className="client-portal-card"><div className="client-portal-card-title"><CircleAlert size={18} /><div><h2>Linha do tempo</h2><p>Mensagens já registradas no atendimento.</p></div></div>{messages.isLoading ? <div className="wa-empty">Carregando mensagens…</div> : !conversationId ? <div className="wa-empty">Selecione uma conversa para visualizar o histórico.</div> : <div className="client-message-timeline">{messages.data?.map(message => <div className={`client-message is-${message.direction}`} key={message.id}><small>{message.authorType === "ai" ? "IA" : message.authorType === "human" ? "Equipe" : "Contato"} · {new Date(message.occurredAt).toLocaleString("pt-BR")}</small><p>{message.body || message.templateName || "Mensagem com mídia"}</p></div>)}</div>}</article>
        </section>
      </> : <div className="wa-empty">Não foi possível carregar a operação autorizada.</div>}
    </>}
  </main>;
}
