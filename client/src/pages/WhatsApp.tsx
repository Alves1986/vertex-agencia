import { StudioShell } from "@/components/StudioShell";
import { trpc } from "@/lib/trpc";
import { ArrowLeftRight, Bot, CheckCircle2, CircleAlert, KeyRound, Loader2, MessageCircleMore, Plus, Send, ShieldCheck, Sparkles, UsersRound, Workflow } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import "./whatsapp-saas.css";

type ChannelProvider = "meta_cloud" | "twilio";
type AiAccessMode = "client_api_key" | "vertex_managed";
type WorkflowMode = "auto_reply" | "draft_for_approval" | "handoff_only";

export const whatsappChannelProviders: Array<{ value: ChannelProvider; label: string; description: string }> = [
  { value: "meta_cloud", label: "API oficial da Meta", description: "Canal oficial do WhatsApp Business com ativos conectados pelo cliente." },
  { value: "twilio", label: "Parceiro BSP (Twilio)", description: "Conector de parceiro para contas que já operam com um BSP." },
];

export function getAiModeCopy(mode: AiAccessMode) {
  return mode === "client_api_key"
    ? { title: "API do próprio cliente", description: "O cliente usa uma conexão de IA validada e isolada no seu contrato." }
    : { title: "IA gerenciada pela VERTEX", description: "A VERTEX opera o provedor e controla o teto mensal do plano contratado." };
}

export function inboxStatusCopy(status: string) {
  const labels: Record<string, string> = { ai_active: "IA em triagem", waiting_human: "Aguardando humano", human_active: "Em revisão humana", closed: "Encerrada" };
  return labels[status] ?? status;
}

export function formatManagedAiCents(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((value ?? 0) / 100);
}

export function formatAnnualPlanPrice(value: number | null | undefined) {
  return `${formatManagedAiCents(value)} / ano`;
}

export function canOpenAnnualCheckout(clientId: number | null, stripePriceId: string | null | undefined) {
  return Boolean(clientId && stripePriceId?.trim());
}

export function clientPortalMemberAction(status: "active" | "suspended" | "invited") {
  return status === "active" ? "Suspender acesso" : "Reativar acesso";
}

export function channelProviderSwitchCopy(provider: ChannelProvider) {
  return provider === "meta_cloud"
    ? "Trocar para API oficial da Meta"
    : "Trocar para parceiro BSP (Twilio)";
}

const workflowOptions: Array<{ value: WorkflowMode; label: string; description: string }> = [
  { value: "draft_for_approval", label: "Rascunho para aprovação", description: "A IA prepara a resposta e um humano libera o envio." },
  { value: "auto_reply", label: "Resposta automática", description: "A regra só pode operar sem aprovação quando for ativada explicitamente." },
  { value: "handoff_only", label: "Somente encaminhar", description: "Identifica o contexto e direciona para uma pessoa da equipe." },
];

function channelStatus(status: string) {
  const labels: Record<string, string> = { draft: "Aguardando credenciais", pending_verification: "Em verificação", active: "Ativo", paused: "Pausado", error: "Atenção necessária" };
  return labels[status] ?? status;
}

export default function WhatsApp() {
  const utils = trpc.useUtils();
  const clients = trpc.workspace.clients.useQuery();
  const preferences = trpc.workspace.preferences.useQuery();
  const [clientId, setClientId] = useState<number | null>(null);
  const [channelForm, setChannelForm] = useState({ label: "", provider: "meta_cloud" as ChannelProvider, phone: "", account: "", sender: "" });
  const [aiMode, setAiMode] = useState<AiAccessMode>("vertex_managed");
  const [policyForm, setPolicyForm] = useState({ connectionId: "", workflow: "draft_for_approval" as WorkflowMode, monthlyLimit: "500", costPerThousand: "120", markupPercent: "80", overagePerThousand: "216", instructions: "", handoffKeywords: "humano, atendente, suporte" });
  const [automationForm, setAutomationForm] = useState({ name: "Triagem inicial", trigger: "inbound_message" as "inbound_message" | "keyword" | "outside_business_hours" | "handoff_requested", action: "draft_for_approval" as "ai_reply" | "draft_for_approval" | "handoff_human" | "tag_conversation", requiresApproval: true });
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [draftBody, setDraftBody] = useState("");
  const [projectedMessages, setProjectedMessages] = useState("1000");
  const [planForm, setPlanForm] = useState({ code: "", name: "", annualPriceCents: "", stripePriceId: "", includedChannels: "1", includedHumanSeats: "1", includedManagedAiMessages: "0", managedAiCostPerThousandCents: "0", managedAiMarkupPercent: "0", managedAiOveragePricePerThousandCents: "0" });
  const [portalForm, setPortalForm] = useState({ email: "", role: "client_admin" as "client_admin" | "manager" | "agent" | "viewer" });
  const [switchingChannelId, setSwitchingChannelId] = useState<number | null>(null);
  const [switchProvider, setSwitchProvider] = useState<ChannelProvider>("meta_cloud");
  const [credentialChannelId, setCredentialChannelId] = useState<number | null>(null);
  const [channelCredentialForm, setChannelCredentialForm] = useState({ accessToken: "", verifyToken: "", phoneNumberId: "", graphVersion: "v20.0", accountSid: "", authToken: "", messagingServiceSid: "", from: "" });
  const [pendingApprovalMessageId, setPendingApprovalMessageId] = useState<number | null>(null);

  const overview = trpc.whatsapp.overview.useQuery({ clientId: clientId ?? 0 }, { enabled: clientId !== null });
  const agency = trpc.agency.overview.useQuery({ clientId: clientId ?? 0 }, { enabled: clientId !== null });
  const inbox = trpc.whatsapp.inbox.useQuery({ clientId: clientId ?? 0 }, { enabled: clientId !== null });
  const conversationMessages = trpc.whatsapp.conversationMessages.useQuery({ clientId: clientId ?? 0, conversationId: selectedConversationId ?? 0 }, { enabled: clientId !== null && selectedConversationId !== null });
  const managedAiBilling = trpc.whatsapp.managedAiBillingPreview.useQuery({ clientId: clientId ?? 0, projectedAdditionalMessages: Number(projectedMessages) || 0, includedMonthlyMessages: Number(policyForm.monthlyLimit) || 0, costPerThousandCents: Number(policyForm.costPerThousand) || 0, markupPercent: Number(policyForm.markupPercent) || 0, overagePricePerThousandCents: Number(policyForm.overagePerThousand) || 0 }, { enabled: clientId !== null && aiMode === "vertex_managed" });
  const annualPlans = trpc.whatsapp.annualPlans.useQuery();
  const portalMembers = trpc.whatsapp.portalMembers.useQuery({ clientId: clientId ?? 0 }, { enabled: clientId !== null });
  const selectedClient = useMemo(() => clients.data?.find(client => client.id === clientId) ?? null, [clients.data, clientId]);
  const selectedConversation = useMemo(() => inbox.data?.find(conversation => conversation.id === selectedConversationId) ?? null, [inbox.data, selectedConversationId]);
  const selectedCredentialChannel = useMemo(() => overview.data?.channels.find(channel => channel.id === credentialChannelId) ?? null, [overview.data?.channels, credentialChannelId]);
  const queuedDraft = useMemo(() => (conversationMessages.data ?? []).find(message => message.direction === "outbound" && message.deliveryStatus === "queued" && !message.providerMessageId) ?? null, [conversationMessages.data]);

  useEffect(() => {
    if (clientId !== null || !clients.data?.length) return;
    const preferred = preferences.data?.activeClientId;
    setClientId(preferred && clients.data.some(client => client.id === preferred) ? preferred : clients.data[0].id);
  }, [clientId, clients.data, preferences.data?.activeClientId]);

  useEffect(() => {
    const policy = overview.data?.policy;
    if (!policy) return;
    setAiMode(policy.aiAccessMode);
    setPolicyForm({
      connectionId: policy.providerConnectionId ? String(policy.providerConnectionId) : "",
      workflow: policy.workflowMode,
      monthlyLimit: policy.monthlyManagedMessageLimit ? String(policy.monthlyManagedMessageLimit) : "500",
      costPerThousand: policy.managedAiCostPerThousandCents != null ? String(policy.managedAiCostPerThousandCents) : "120",
      markupPercent: policy.managedAiMarkupPercent != null ? String(policy.managedAiMarkupPercent) : "80",
      overagePerThousand: policy.managedAiOveragePricePerThousandCents != null ? String(policy.managedAiOveragePricePerThousandCents) : "216",
      instructions: policy.systemInstructions ?? "",
      handoffKeywords: (() => { try { return (JSON.parse(policy.handoffKeywordsJson ?? "[]") as string[]).join(", "); } catch { return ""; } })(),
    });
  }, [overview.data?.policy?.updatedAt]);

  useEffect(() => {
    if (!inbox.data?.length) { setSelectedConversationId(null); return; }
    if (!selectedConversationId || !inbox.data.some(conversation => conversation.id === selectedConversationId)) setSelectedConversationId(inbox.data[0].id);
  }, [inbox.data, selectedConversationId]);

  const refresh = async () => { await Promise.all([utils.whatsapp.overview.invalidate(), utils.whatsapp.channels.invalidate(), utils.whatsapp.inbox.invalidate(), utils.whatsapp.conversationMessages.invalidate(), utils.whatsapp.managedAiBilling.invalidate(), utils.whatsapp.managedAiBillingPreview.invalidate(), utils.whatsapp.annualPlans.invalidate(), utils.whatsapp.portalMembers.invalidate()]); };
  const createChannel = trpc.whatsapp.createChannel.useMutation({ onSuccess: async () => { await refresh(); setChannelForm({ label: "", provider: "meta_cloud", phone: "", account: "", sender: "" }); toast.success("Canal criado em modo de configuração. As credenciais serão solicitadas na ativação."); }, onError: error => toast.error(error.message) });
  const updateChannelProvider = trpc.whatsapp.updateChannelProvider.useMutation({ onSuccess: async () => { await refresh(); setSwitchingChannelId(null); toast.success("Conector alterado. As credenciais anteriores foram removidas e as conversas foram preservadas para este cliente."); }, onError: error => toast.error(error.message) });
  const configureChannel = trpc.whatsapp.configureChannel.useMutation({ onSuccess: async () => { await refresh(); setChannelCredentialForm({ accessToken: "", verifyToken: "", phoneNumberId: "", graphVersion: "v20.0", accountSid: "", authToken: "", messagingServiceSid: "", from: "" }); toast.success("Credenciais armazenadas de forma cifrada. O canal permanece em verificação até o teste de ativação."); }, onError: error => toast.error(error.message) });
  const savePolicy = trpc.whatsapp.savePolicy.useMutation({ onSuccess: async () => { await refresh(); toast.success("Política de IA salva para este cliente."); }, onError: error => toast.error(error.message) });
  const saveAutomation = trpc.whatsapp.saveAutomation.useMutation({ onSuccess: async () => { await refresh(); toast.success("Automação salva como regra revisável."); }, onError: error => toast.error(error.message) });
  const assumeHumanReview = trpc.whatsapp.assumeHumanReview.useMutation({ onSuccess: async () => { await refresh(); toast.success("Conversa assumida para revisão humana. Nenhuma mensagem foi enviada."); }, onError: error => toast.error(error.message) });
  const saveDraft = trpc.whatsapp.saveDraft.useMutation({ onSuccess: async () => { await refresh(); setDraftBody(""); toast.success("Rascunho salvo localmente. O envio externo permanece desativado."); }, onError: error => toast.error(error.message) });
  const approveAndSendDraft = trpc.whatsapp.approveAndSendDraft.useMutation({ onSuccess: async data => { await refresh(); setPendingApprovalMessageId(null); toast.success(data.state === "sent" ? "Mensagem aceita pelo provedor e registrada na auditoria." : "Esta mensagem já havia sido processada; nenhuma duplicidade foi enviada."); }, onError: error => { setPendingApprovalMessageId(null); toast.error(error.message); } });
  const saveAnnualPlan = trpc.whatsapp.saveAnnualPlan.useMutation({ onSuccess: async () => { await utils.whatsapp.annualPlans.invalidate(); setPlanForm({ code: "", name: "", annualPriceCents: "", stripePriceId: "", includedChannels: "1", includedHumanSeats: "1", includedManagedAiMessages: "0", managedAiCostPerThousandCents: "0", managedAiMarkupPercent: "0", managedAiOveragePricePerThousandCents: "0" }); toast.success("Plano anual salvo no catálogo da agência."); }, onError: error => toast.error(error.message) });
  const checkoutAnnualPlan = trpc.whatsapp.checkoutAnnualPlan.useMutation({ onSuccess: data => { window.open(data.url, "_blank", "noopener,noreferrer"); toast.success("Checkout anual aberto em uma nova aba. Nenhuma assinatura é ativada até a confirmação do pagamento."); }, onError: error => toast.error(error.message) });
  const grantPortalMember = trpc.whatsapp.grantPortalMember.useMutation({ onSuccess: async () => { await utils.whatsapp.portalMembers.invalidate(); setPortalForm({ email: "", role: "client_admin" }); toast.success("Acesso ao portal concedido para este cliente."); }, onError: error => toast.error(error.message) });
  const updatePortalMemberStatus = trpc.whatsapp.updatePortalMemberStatus.useMutation({ onSuccess: async () => { await utils.whatsapp.portalMembers.invalidate(); toast.success("Acesso ao portal atualizado."); }, onError: error => toast.error(error.message) });

  function submitChannel(event: FormEvent) {
    event.preventDefault();
    if (!clientId) return;
    createChannel.mutate({ clientId, label: channelForm.label, provider: channelForm.provider, displayPhoneNumber: channelForm.phone || null, externalAccountId: channelForm.account || null, externalSenderId: channelForm.sender || null });
  }

  function switchChannelProvider(channel: { id: number; provider: ChannelProvider; displayPhoneNumber?: string | null; externalAccountId?: string | null; externalSenderId?: string | null }) {
    if (!clientId || switchProvider === channel.provider) return toast.message("Selecione um conector diferente para iniciar a troca.");
    updateChannelProvider.mutate({ clientId, channelId: channel.id, provider: switchProvider, displayPhoneNumber: channel.displayPhoneNumber ?? null, externalAccountId: channel.externalAccountId ?? null, externalSenderId: channel.externalSenderId ?? null });
  }

  function submitChannelCredentials(event: FormEvent) {
    event.preventDefault();
    if (!clientId || !selectedCredentialChannel) return;
    configureChannel.mutate({ clientId, channelId: selectedCredentialChannel.id, config: channelCredentialForm });
  }

  function approveQueuedDraft() {
    if (!clientId || !queuedDraft) return;
    if (pendingApprovalMessageId !== queuedDraft.id) { setPendingApprovalMessageId(queuedDraft.id); return; }
    approveAndSendDraft.mutate({ clientId, messageId: queuedDraft.id });
  }

  function submitPolicy(event: FormEvent) {
    event.preventDefault();
    if (!clientId) return;
    const providerConnectionId = policyForm.connectionId ? Number(policyForm.connectionId) : null;
    const monthlyLimit = policyForm.monthlyLimit ? Number(policyForm.monthlyLimit) : null;
    const costPerThousand = policyForm.costPerThousand ? Number(policyForm.costPerThousand) : null;
    const markupPercent = policyForm.markupPercent ? Number(policyForm.markupPercent) : null;
    const overagePerThousand = policyForm.overagePerThousand ? Number(policyForm.overagePerThousand) : null;
    if (aiMode === "client_api_key" && !providerConnectionId) return toast.error("Selecione uma conexão de IA ativa e pertencente a este cliente.");
    if (aiMode === "vertex_managed" && (!monthlyLimit || monthlyLimit < 1)) return toast.error("Informe o limite mensal do plano VERTEX.");
    if (aiMode === "vertex_managed" && ([costPerThousand, markupPercent, overagePerThousand].some(value => value == null || value < 0))) return toast.error("Informe custos e markup válidos para a simulação interna da VERTEX.");
    savePolicy.mutate({ clientId, aiAccessMode: aiMode, providerConnectionId, workflowMode: policyForm.workflow, monthlyManagedMessageLimit: monthlyLimit, managedAiCostPerThousandCents: aiMode === "vertex_managed" ? costPerThousand : null, managedAiMarkupPercent: aiMode === "vertex_managed" ? markupPercent : null, managedAiOveragePricePerThousandCents: aiMode === "vertex_managed" ? overagePerThousand : null, systemInstructions: policyForm.instructions || null, handoffKeywordsJson: JSON.stringify(policyForm.handoffKeywords.split(",").map(item => item.trim()).filter(Boolean)) });
  }

  function submitAutomation(event: FormEvent) {
    event.preventDefault();
    if (!clientId) return;
    saveAutomation.mutate({ clientId, name: automationForm.name, triggerType: automationForm.trigger, actionType: automationForm.action, requiresApproval: automationForm.requiresApproval, status: "draft", triggerConfigJson: automationForm.trigger === "keyword" ? JSON.stringify({ keywords: policyForm.handoffKeywords.split(",").map(item => item.trim()).filter(Boolean) }) : null });
  }

  function submitDraft(event: FormEvent) {
    event.preventDefault();
    if (!clientId || !selectedConversationId || !draftBody.trim()) return;
    saveDraft.mutate({ clientId, conversationId: selectedConversationId, body: draftBody.trim() });
  }

  function submitAnnualPlan(event: FormEvent) {
    event.preventDefault();
    const values = Object.fromEntries(Object.entries(planForm).map(([key, value]) => [key, key === "code" || key === "name" || key === "stripePriceId" ? value : Number(value)]));
    if (!planForm.code || !planForm.name || !Number(planForm.annualPriceCents)) return toast.error("Informe código, nome e valor anual do plano.");
    saveAnnualPlan.mutate({ code: planForm.code, name: planForm.name, annualPriceCents: Number(planForm.annualPriceCents), stripePriceId: planForm.stripePriceId || null, includedChannels: Number(values.includedChannels), includedHumanSeats: Number(values.includedHumanSeats), includedManagedAiMessages: Number(values.includedManagedAiMessages), managedAiCostPerThousandCents: Number(values.managedAiCostPerThousandCents), managedAiMarkupPercent: Number(values.managedAiMarkupPercent), managedAiOveragePricePerThousandCents: Number(values.managedAiOveragePricePerThousandCents), isActive: true });
  }

  function submitPortalMember(event: FormEvent) {
    event.preventDefault();
    if (!clientId || !portalForm.email.trim()) return;
    grantPortalMember.mutate({ clientId, email: portalForm.email.trim(), role: portalForm.role });
  }

  const policyCopy = getAiModeCopy(aiMode);
  const activeConnections = (agency.data?.connections ?? []).filter(connection => connection.status === "active");

  return <StudioShell eyebrow="06 · Conversas, canais e handoff" title="Atendimento & canais" actions={<span className="wa-header-signal"><ShieldCheck size={15} /> Isolamento por cliente</span>}>
    <section className="ops-page whatsapp-page">
      <div className="wa-intro">
        <div><p className="ops-eyebrow"><i /> OPERAÇÃO CONECTADA</p><h2>Atendimento com IA, sob o controle da agência.</h2><p>Conecte cada cliente pela API oficial da Meta ou por parceiro BSP, escolha a fonte de IA e preserve a revisão humana onde ela é necessária.</p></div>
        <label className="wa-client-picker">Cliente ativo<select aria-label="Cliente para atendimento WhatsApp" value={clientId ?? ""} onChange={event => setClientId(Number(event.target.value))}>{(clients.data ?? []).map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
      </div>

      {overview.isLoading || !selectedClient ? <div className="ops-inline-loading"><Loader2 size={17} /> Carregando estrutura de atendimento…</div> : <>
        <div className="wa-readiness" aria-label="Estado da operação de atendimento">
          <div><span><MessageCircleMore size={17} /></span><small>Canais</small><strong>{overview.data?.channels.length ?? 0}</strong><p>{overview.data?.channels.some(channel => channel.status === "active") ? "Há canal ativo" : "Aguardando ativação"}</p></div>
          <div><span><Bot size={17} /></span><small>Fonte de IA</small><strong>{overview.data?.policy ? getAiModeCopy(overview.data.policy.aiAccessMode).title : "Não definida"}</strong><p>{overview.data?.policy ? "Política salva" : "Escolha o modelo de IA"}</p></div>
          <div><span><Workflow size={17} /></span><small>Automações</small><strong>{overview.data?.automations.length ?? 0}</strong><p>{overview.data?.automations.some(rule => rule.status === "active") ? "Regras em operação" : "Tudo em revisão"}</p></div>
          <div><span><ShieldCheck size={17} /></span><small>Proteção</small><strong>Humano no ciclo</strong><p>Ativação e credenciais separadas</p></div>
        </div>

        <div className="wa-grid wa-grid-channels">
          <article className="wa-panel"><div className="wa-panel-heading"><div><span className="wa-kicker"><MessageCircleMore size={15} /> Canais</span><h3>Conectores de WhatsApp</h3><p>Crie o canal primeiro. As chaves globais e de cada cliente só serão solicitadas quando você ativar o tráfego real.</p></div></div>
            <div className="wa-channel-list">
              {(overview.data?.channels ?? []).length ? overview.data?.channels.map(channel => <div className="wa-channel-row" key={channel.id}><div className={`wa-channel-icon ${channel.provider}`}><MessageCircleMore size={18} /></div><div><strong>{channel.label}</strong><p>{whatsappChannelProviders.find(provider => provider.value === channel.provider)?.label} {channel.displayPhoneNumber ? `· ${channel.displayPhoneNumber}` : "· Número a configurar"}</p>{switchingChannelId === channel.id && <div className="wa-channel-switch"><label>Próximo conector<select aria-label={`Novo conector para ${channel.label}`} value={switchProvider} onChange={event => setSwitchProvider(event.target.value as ChannelProvider)}>{whatsappChannelProviders.map(provider => <option key={provider.value} value={provider.value}>{provider.label}</option>)}</select></label><p>O histórico deste canal permanece no cliente atual. As credenciais anteriores serão removidas e o novo conector exigirá configuração.</p><button type="button" className="ops-secondary-button" disabled={updateChannelProvider.isPending} onClick={() => switchChannelProvider(channel)}>{updateChannelProvider.isPending ? <Loader2 size={14} /> : <ArrowLeftRight size={14} />} Confirmar troca segura</button><button type="button" className="ops-text-button" disabled={updateChannelProvider.isPending} onClick={() => setSwitchingChannelId(null)}>Cancelar</button></div>}</div><span className={`wa-status ${channel.status}`}>{channelStatus(channel.status)}</span><button type="button" className="ops-text-button" disabled={updateChannelProvider.isPending} onClick={() => { setSwitchingChannelId(channel.id); setSwitchProvider(channel.provider === "meta_cloud" ? "twilio" : "meta_cloud"); }}><ArrowLeftRight size={14} /> Trocar conector</button></div>) : <div className="wa-empty"><CircleAlert size={17} /><span>Nenhum canal configurado para {selectedClient.name}.</span></div>}
            </div>
            <form className="wa-compact-form" onSubmit={submitChannelCredentials}><h4><KeyRound size={15} /> Credenciais cifradas</h4><div className="wa-form-grid"><label>Canal<select aria-label="Canal para configurar credenciais" value={credentialChannelId ?? ""} onChange={event => setCredentialChannelId(event.target.value ? Number(event.target.value) : null)}><option value="">Selecione um canal</option>{(overview.data?.channels ?? []).map(channel => <option key={channel.id} value={channel.id}>{channel.label} · {channel.provider === "meta_cloud" ? "Meta" : "Twilio"}</option>)}</select></label>{selectedCredentialChannel?.provider === "meta_cloud" ? <><label>Token de acesso<input type="password" autoComplete="off" value={channelCredentialForm.accessToken} onChange={event => setChannelCredentialForm(current => ({ ...current, accessToken: event.target.value }))} /></label><label>Token de verificação<input type="password" autoComplete="off" value={channelCredentialForm.verifyToken} onChange={event => setChannelCredentialForm(current => ({ ...current, verifyToken: event.target.value }))} /></label><label>ID do número da Meta<input value={channelCredentialForm.phoneNumberId} onChange={event => setChannelCredentialForm(current => ({ ...current, phoneNumberId: event.target.value }))} /></label><label>Versão Graph API<input value={channelCredentialForm.graphVersion} onChange={event => setChannelCredentialForm(current => ({ ...current, graphVersion: event.target.value }))} /></label></> : selectedCredentialChannel?.provider === "twilio" ? <><label>Account SID<input value={channelCredentialForm.accountSid} onChange={event => setChannelCredentialForm(current => ({ ...current, accountSid: event.target.value }))} /></label><label>Auth Token<input type="password" autoComplete="off" value={channelCredentialForm.authToken} onChange={event => setChannelCredentialForm(current => ({ ...current, authToken: event.target.value }))} /></label><label>Número de origem<input value={channelCredentialForm.from} onChange={event => setChannelCredentialForm(current => ({ ...current, from: event.target.value }))} placeholder="whatsapp:+55…" /></label><label>Messaging Service SID (opcional)<input value={channelCredentialForm.messagingServiceSid} onChange={event => setChannelCredentialForm(current => ({ ...current, messagingServiceSid: event.target.value }))} /></label></> : null}</div><p className="wa-provider-note">As chaves não retornam ao navegador. Salve-as apenas quando estiver pronto para realizar a verificação externa controlada.</p><button className="ops-secondary-button" disabled={!selectedCredentialChannel || configureChannel.isPending} type="submit">{configureChannel.isPending ? <Loader2 size={16} /> : <KeyRound size={16} />} Armazenar configuração cifrada</button></form>
            <form className="wa-compact-form" onSubmit={submitChannel}><h4><Plus size={15} /> Novo canal</h4><div className="wa-form-grid"><label>Nome do canal<input required value={channelForm.label} onChange={event => setChannelForm(current => ({ ...current, label: event.target.value }))} placeholder="Ex.: Comercial" /></label><label>Modo de conexão<select value={channelForm.provider} onChange={event => setChannelForm(current => ({ ...current, provider: event.target.value as ChannelProvider }))}>{whatsappChannelProviders.map(provider => <option key={provider.value} value={provider.value}>{provider.label}</option>)}</select></label><label>Número de exibição<input value={channelForm.phone} onChange={event => setChannelForm(current => ({ ...current, phone: event.target.value }))} placeholder="+55 11 99999-9999" /></label><label>ID da conta (opcional)<input value={channelForm.account} onChange={event => setChannelForm(current => ({ ...current, account: event.target.value }))} placeholder="Conta Meta ou BSP" /></label></div><p className="wa-provider-note">{whatsappChannelProviders.find(provider => provider.value === channelForm.provider)?.description}</p><button className="ops-primary-button" disabled={createChannel.isPending} type="submit">{createChannel.isPending ? <Loader2 size={16} /> : <Plus size={16} />} Criar canal em configuração</button></form>
          </article>

          <article className="wa-panel wa-ai-panel"><div className="wa-panel-heading"><div><span className="wa-kicker"><Sparkles size={15} /> IA e contrato</span><h3>Como este cliente usa IA?</h3><p>A escolha é registrada por cliente e não permite que chaves, limites ou consumo sejam misturados.</p></div></div>
            <form onSubmit={submitPolicy} className="wa-policy-form"><div className="wa-mode-options">{(["client_api_key", "vertex_managed"] as AiAccessMode[]).map(mode => <label className={aiMode === mode ? "is-selected" : ""} key={mode}><input type="radio" name="ai-access" value={mode} checked={aiMode === mode} onChange={() => setAiMode(mode)} /><span><KeyRound size={17} /><strong>{getAiModeCopy(mode).title}</strong><small>{getAiModeCopy(mode).description}</small></span></label>)}</div>
              <div className="wa-policy-card"><div><strong>{policyCopy.title}</strong><p>{policyCopy.description}</p></div>{aiMode === "client_api_key" ? <label>Conexão de IA do cliente<select value={policyForm.connectionId} onChange={event => setPolicyForm(current => ({ ...current, connectionId: event.target.value }))}><option value="">Selecione uma conexão ativa</option>{activeConnections.map(connection => <option key={connection.id} value={connection.id}>{connection.label} · {connection.provider}</option>)}</select></label> : <label>Limite mensal do plano VERTEX<input type="number" min="1" max="10000000" inputMode="numeric" value={policyForm.monthlyLimit} onChange={event => setPolicyForm(current => ({ ...current, monthlyLimit: event.target.value }))} /></label>}</div>
              {aiMode === "vertex_managed" && <section className="wa-pricing-panel" aria-label="Simulação interna de margem VERTEX"><div><span className="wa-kicker"><Sparkles size={15} /> Precificação interna</span><h4>Margem da IA gerenciada</h4><p>Valores em centavos por mil mensagens. Estes controles são restritos à operação da agência.</p></div><div className="wa-form-grid"><label>Custo base / 1.000<input aria-label="Custo base por mil mensagens" type="number" min="0" inputMode="numeric" value={policyForm.costPerThousand} onChange={event => setPolicyForm(current => ({ ...current, costPerThousand: event.target.value }))} /></label><label>Markup (%)<input aria-label="Markup da IA VERTEX" type="number" min="0" max="1000" inputMode="numeric" value={policyForm.markupPercent} onChange={event => setPolicyForm(current => ({ ...current, markupPercent: event.target.value }))} /></label><label>Excedente / 1.000<input aria-label="Preço de excedente por mil mensagens" type="number" min="0" inputMode="numeric" value={policyForm.overagePerThousand} onChange={event => setPolicyForm(current => ({ ...current, overagePerThousand: event.target.value }))} /></label><label>Simular novas mensagens<input aria-label="Mensagens adicionais para simular" type="number" min="0" inputMode="numeric" value={projectedMessages} onChange={event => setProjectedMessages(event.target.value)} /></label></div><div className="wa-pricing-summary">{managedAiBilling.isLoading ? <span><Loader2 size={15} /> Atualizando simulação…</span> : <><span><small>Uso projetado</small><strong>{managedAiBilling.data?.quote.totalMonthlyMessages ?? 0} mensagens</strong></span><span><small>Excedente</small><strong>{managedAiBilling.data?.quote.overageMessages ?? 0} mensagens</strong></span><span><small>Receita estimada</small><strong>{formatManagedAiCents(managedAiBilling.data?.quote.projectedOverageRevenueCents)}</strong></span><span><small>Margem estimada</small><strong>{formatManagedAiCents(managedAiBilling.data?.quote.projectedOverageGrossMarginCents)}</strong></span></>}</div></section>}
              <div className="wa-form-grid"><label>Modo de atendimento<select value={policyForm.workflow} onChange={event => setPolicyForm(current => ({ ...current, workflow: event.target.value as WorkflowMode }))}>{workflowOptions.map(workflow => <option key={workflow.value} value={workflow.value}>{workflow.label}</option>)}</select><small>{workflowOptions.find(option => option.value === policyForm.workflow)?.description}</small></label><label>Palavras para encaminhar ao humano<input value={policyForm.handoffKeywords} onChange={event => setPolicyForm(current => ({ ...current, handoffKeywords: event.target.value }))} placeholder="humano, suporte" /></label></div><label>Instruções de atendimento<textarea value={policyForm.instructions} onChange={event => setPolicyForm(current => ({ ...current, instructions: event.target.value }))} placeholder="Tom de voz, serviços cobertos, limites e instruções aprovadas pelo cliente." /></label><button className="ops-primary-button" disabled={savePolicy.isPending} type="submit">{savePolicy.isPending ? <Loader2 size={16} /> : <CheckCircle2 size={16} />} Salvar política de IA</button></form>
          </article>
        </div>

        <article className="wa-panel wa-plans-panel"><div className="wa-panel-heading"><div><span className="wa-kicker"><Sparkles size={15} /> Contratos anuais</span><h3>Planos SaaS e ativação comercial</h3><p>O catálogo pertence à agência. O checkout só é aberto quando você seleciona um plano para o cliente atual; nenhum pagamento é disparado automaticamente.</p></div><span className="wa-audit-note"><ShieldCheck size={15} /> Stripe com IDs mínimos</span></div>
          <div className="wa-plan-list">{annualPlans.isLoading ? <div className="wa-empty"><Loader2 size={16} /> Carregando planos…</div> : !(annualPlans.data ?? []).length ? <div className="wa-empty"><CircleAlert size={17} /><span>Cadastre o primeiro plano anual para iniciar uma assinatura por cliente.</span></div> : annualPlans.data?.map(plan => <div className="wa-plan-row" key={plan.id}><div><strong>{plan.name}</strong><p>{plan.code} · {formatAnnualPlanPrice(plan.annualPriceCents)} · {plan.includedChannels} canal(is) · {plan.includedHumanSeats} pessoa(s)</p><small>{plan.stripePriceId ? "Preço Stripe vinculado" : "Preço Stripe ainda não vinculado"}</small></div><button type="button" className="ops-secondary-button" disabled={!canOpenAnnualCheckout(clientId, plan.stripePriceId) || checkoutAnnualPlan.isPending} onClick={() => clientId && checkoutAnnualPlan.mutate({ clientId, planId: plan.id })}>{checkoutAnnualPlan.isPending ? <Loader2 size={15} /> : "Abrir checkout anual"}</button></div>)}</div>
          <form className="wa-compact-form wa-plan-form" onSubmit={submitAnnualPlan}><h4><Plus size={15} /> Novo plano anual</h4><div className="wa-form-grid"><label>Código<input required value={planForm.code} onChange={event => setPlanForm(current => ({ ...current, code: event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") }))} placeholder="pro-anual" /></label><label>Nome do plano<input required value={planForm.name} onChange={event => setPlanForm(current => ({ ...current, name: event.target.value }))} placeholder="Profissional anual" /></label><label>Valor anual (centavos)<input required type="number" min="50" inputMode="numeric" value={planForm.annualPriceCents} onChange={event => setPlanForm(current => ({ ...current, annualPriceCents: event.target.value }))} placeholder="120000" /></label><label>ID do preço Stripe<input value={planForm.stripePriceId} onChange={event => setPlanForm(current => ({ ...current, stripePriceId: event.target.value }))} placeholder="price_…" /></label><label>Canais incluídos<input type="number" min="1" value={planForm.includedChannels} onChange={event => setPlanForm(current => ({ ...current, includedChannels: event.target.value }))} /></label><label>Assentos humanos<input type="number" min="1" value={planForm.includedHumanSeats} onChange={event => setPlanForm(current => ({ ...current, includedHumanSeats: event.target.value }))} /></label><label>Mensagens IA incluídas<input type="number" min="0" value={planForm.includedManagedAiMessages} onChange={event => setPlanForm(current => ({ ...current, includedManagedAiMessages: event.target.value }))} /></label><label>Excedente IA / 1.000<input type="number" min="0" value={planForm.managedAiOveragePricePerThousandCents} onChange={event => setPlanForm(current => ({ ...current, managedAiOveragePricePerThousandCents: event.target.value }))} /></label></div><p className="wa-provider-note">Os valores de custo base e markup da VERTEX permanecem internos. Para abrir checkout, crie antes o preço anual correspondente no Stripe e informe seu identificador.</p><button className="ops-primary-button" disabled={saveAnnualPlan.isPending} type="submit">{saveAnnualPlan.isPending ? <Loader2 size={16} /> : <Plus size={16} />} Salvar plano anual</button></form>
        </article>

        <article className="wa-panel wa-portal-access-panel"><div className="wa-panel-heading"><div><span className="wa-kicker"><UsersRound size={15} /> Portal do cliente</span><h3>Quem pode acompanhar {selectedClient.name}?</h3><p>Conceda acesso por e-mail. O cliente acompanha somente seus canais, conversas e contrato; margem, custos, credenciais e outros clientes permanecem internos.</p></div><span className="wa-audit-note"><ShieldCheck size={15} /> Acesso revogável</span></div>
          <div className="wa-member-list">{portalMembers.isLoading ? <div className="wa-empty"><Loader2 size={16} /> Carregando acessos…</div> : !(portalMembers.data ?? []).length ? <div className="wa-empty"><UsersRound size={17} /><span>Nenhum usuário do cliente tem acesso ao portal ainda.</span></div> : portalMembers.data?.map(member => <div className="wa-member-row" key={member.id}><div><strong>{member.name ?? member.email}</strong><p>{member.email ?? "E-mail não informado"} · {member.role.replace("_", " ")}</p><small className={`wa-member-status ${member.status}`}>{member.status === "active" ? "Acesso ativo" : "Acesso suspenso"}</small></div><button type="button" className="ops-secondary-button" disabled={updatePortalMemberStatus.isPending} onClick={() => clientId && updatePortalMemberStatus.mutate({ clientId, memberId: member.id, status: member.status === "active" ? "suspended" : "active" })}>{clientPortalMemberAction(member.status)}</button></div>)}</div>
          <form className="wa-compact-form wa-portal-form" onSubmit={submitPortalMember}><h4><Plus size={15} /> Conceder acesso</h4><div className="wa-form-grid"><label>E-mail do usuário<input aria-label="E-mail para acesso ao portal" required type="email" value={portalForm.email} onChange={event => setPortalForm(current => ({ ...current, email: event.target.value }))} placeholder="cliente@empresa.com" /></label><label>Papel no portal<select aria-label="Papel no portal do cliente" value={portalForm.role} onChange={event => setPortalForm(current => ({ ...current, role: event.target.value as typeof portalForm.role }))}><option value="client_admin">Administrador do cliente</option><option value="manager">Gestor</option><option value="agent">Atendente</option><option value="viewer">Consulta</option></select></label></div><p className="wa-provider-note">A pessoa precisa acessar a VERTEX pelo menos uma vez antes da concessão. O vínculo pode ser suspenso a qualquer momento.</p><button className="ops-primary-button" disabled={grantPortalMember.isPending} type="submit">{grantPortalMember.isPending ? <Loader2 size={16} /> : <UsersRound size={16} />} Conceder acesso ao portal</button></form>
        </article>

        <article className="wa-panel wa-inbox-panel"><div className="wa-panel-heading"><div><span className="wa-kicker"><MessageCircleMore size={15} /> Atendimento humano</span><h3>Caixa de entrada por cliente</h3><p>Mensagens recebidas permanecem isoladas. O envio exige aprovação em duas etapas, canal ativo, consentimento, janela de atendimento e ativação controlada do ambiente.</p></div><span className="wa-audit-note"><ShieldCheck size={15} /> Aprovação obrigatória</span></div>
          <div className="wa-inbox-layout"><div className="wa-conversation-list" aria-label="Conversas do cliente">{inbox.isLoading ? <div className="wa-empty"><Loader2 size={16} /> Carregando conversas…</div> : !(inbox.data ?? []).length ? <div className="wa-empty"><MessageCircleMore size={17} /><span>As primeiras conversas aparecerão aqui quando um canal ativo receber mensagens.</span></div> : inbox.data?.map(conversation => <button type="button" key={conversation.id} className={`wa-conversation-row ${conversation.id === selectedConversationId ? "is-selected" : ""}`} onClick={() => setSelectedConversationId(conversation.id)}><span className="wa-conversation-avatar">{(conversation.contactName ?? conversation.contactPhone).slice(0, 1).toUpperCase()}</span><span><strong>{conversation.contactName ?? conversation.contactPhone}</strong><small>{conversation.channelLabel} · {inboxStatusCopy(conversation.status)}</small><em>{conversation.lastMessagePreview ?? "Sem conteúdo textual"}</em></span><time>{conversation.lastMessageAt ? new Date(conversation.lastMessageAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—"}</time></button>)}</div>
            <div className="wa-thread">{!selectedConversation ? <div className="wa-empty"><CircleAlert size={17} /><span>Selecione uma conversa para revisar a linha do tempo.</span></div> : <><header className="wa-thread-header"><div><strong>{selectedConversation.contactName ?? selectedConversation.contactPhone}</strong><p>{selectedConversation.contactPhone} · {selectedConversation.channelLabel} · {inboxStatusCopy(selectedConversation.status)}</p></div><button type="button" className="ops-secondary-button" disabled={assumeHumanReview.isPending || selectedConversation.status === "human_active"} onClick={() => clientId && assumeHumanReview.mutate({ clientId, conversationId: selectedConversation.id })}>{assumeHumanReview.isPending ? <Loader2 size={15} /> : <><ShieldCheck size={15} /> {selectedConversation.status === "human_active" ? "Em revisão humana" : "Assumir revisão"}</>}</button></header>
              <div className="wa-message-timeline">{conversationMessages.isLoading ? <div className="wa-empty"><Loader2 size={16} /> Carregando mensagens…</div> : !(conversationMessages.data ?? []).length ? <div className="wa-empty"><MessageCircleMore size={17} /><span>Esta conversa ainda não possui mensagens registradas.</span></div> : conversationMessages.data?.map(message => <div key={message.id} className={`wa-message ${message.direction} ${message.authorType}`}><span>{message.authorType === "contact" ? "Cliente" : message.authorType === "human" ? "Equipe VERTEX" : message.authorType === "ai" ? "IA" : "Sistema"}</span><p>{message.body ?? "Mídia ou template sem texto"}</p><small>{message.deliveryStatus === "queued" && !message.providerMessageId ? "Rascunho local — não enviado" : message.deliveryStatus}</small></div>)}</div>
              {queuedDraft && <div className="wa-delivery-review"><div><strong>Rascunho aguardando aprovação</strong><p>O despacho só será tentado após sua confirmação. O servidor valida opt-in, janela de atendimento, canal ativo e ambiente habilitado antes de falar com Meta ou Twilio.</p></div><button type="button" className="ops-secondary-button" disabled={approveAndSendDraft.isPending} onClick={approveQueuedDraft}>{approveAndSendDraft.isPending ? <Loader2 size={15} /> : <Send size={15} />} {pendingApprovalMessageId === queuedDraft.id ? "Confirmar envio ao WhatsApp" : "Aprovar rascunho"}</button></div>}
              <form className="wa-draft-form" onSubmit={submitDraft}><label>Rascunho de resposta<textarea aria-label="Rascunho de resposta" value={draftBody} onChange={event => setDraftBody(event.target.value)} placeholder="Escreva a resposta para revisão antes de solicitar o envio." /></label><div><small>O rascunho entra em fila interna e só pode seguir mediante aprovação explícita.</small><button className="ops-primary-button" disabled={!draftBody.trim() || saveDraft.isPending} type="submit">{saveDraft.isPending ? <Loader2 size={16} /> : <Send size={16} />} Salvar rascunho</button></div></form></>}</div>
          </div>
        </article>

        <article className="wa-panel wa-automation-panel"><div className="wa-panel-heading"><div><span className="wa-kicker"><Workflow size={15} /> Orquestração</span><h3>Automações revisáveis</h3><p>Novas regras nascem em rascunho. Respostas automáticas somente podem ser ativadas quando não exigirem aprovação humana.</p></div><span className="wa-audit-note"><ShieldCheck size={15} /> Auditável por conversa</span></div>
          <div className="wa-rule-list">{(overview.data?.automations ?? []).length ? overview.data?.automations.map(rule => <div className="wa-rule-row" key={rule.id}><span className="wa-rule-state"><Workflow size={15} /></span><div><strong>{rule.name}</strong><p>{rule.triggerType.replaceAll("_", " ")} → {rule.actionType.replaceAll("_", " ")}</p></div><span className={`wa-status ${rule.status}`}>{rule.status === "draft" ? "Em revisão" : rule.status}</span></div>) : <div className="wa-empty"><Send size={17} /><span>Crie a primeira regra para organizar a triagem de mensagens.</span></div>}</div>
          <form className="wa-compact-form wa-automation-form" onSubmit={submitAutomation}><h4><Plus size={15} /> Nova regra revisável</h4><div className="wa-form-grid"><label>Nome da regra<input required value={automationForm.name} onChange={event => setAutomationForm(current => ({ ...current, name: event.target.value }))} /></label><label>Gatilho<select value={automationForm.trigger} onChange={event => setAutomationForm(current => ({ ...current, trigger: event.target.value as typeof automationForm.trigger }))}><option value="inbound_message">Mensagem recebida</option><option value="keyword">Palavra-chave</option><option value="outside_business_hours">Fora do horário</option><option value="handoff_requested">Solicitação de humano</option></select></label><label>Ação<select value={automationForm.action} onChange={event => setAutomationForm(current => ({ ...current, action: event.target.value as typeof automationForm.action }))}><option value="draft_for_approval">Gerar rascunho</option><option value="handoff_human">Encaminhar para humano</option><option value="tag_conversation">Classificar conversa</option><option value="ai_reply">Responder automaticamente</option></select></label><label className="wa-checkbox"><input type="checkbox" checked={automationForm.requiresApproval} onChange={event => setAutomationForm(current => ({ ...current, requiresApproval: event.target.checked }))} /> Exigir aprovação humana</label></div><button className="ops-secondary-button" disabled={saveAutomation.isPending} type="submit">{saveAutomation.isPending ? <Loader2 size={16} /> : <Workflow size={16} />} Salvar como rascunho</button></form>
        </article>
      </>}
    </section>
  </StudioShell>;
}
