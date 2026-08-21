import React, { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { Bot, BrainCircuit, CheckCircle2, ChevronRight, Clapperboard, Copy, FileText, KeyRound, Loader2, Pencil, Plus, RefreshCw, ShieldCheck, Sparkles, ToggleLeft, ToggleRight, UploadCloud, WandSparkles, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StudioShell } from "@/components/StudioShell";
import { trpc } from "@/lib/trpc";
import "./agency-review.css";

type Mode = "ads" | "carousel" | "bundle" | "strategy" | "video" | "council";
type ProviderKind = "manus" | "openai" | "openai_compatible" | "gemini" | "anthropic";
type ProviderForm = { label: string; provider: ProviderKind; model: string; imageModel: string; baseUrl: string; apiKey: string };
type PublicationTarget = { id: number; title: string };
type CampaignProviderTarget = { id: number; title: string };
export type GuidedServiceKey = "bundle" | "ads" | "carousel" | "video" | "strategy" | "council";
type GuidedFieldKey = "offer" | "audience" | "channel" | "keyMessage" | "callToAction" | "proof" | "slideCount" | "visualDirection" | "hook" | "duration" | "format" | "scenes" | "businessChallenge" | "marketContext" | "decision" | "options" | "risks";
type GuidedField = { key: GuidedFieldKey; label: string; placeholder: string; required?: boolean; multiline?: boolean };
export type GuidedService = { key: GuidedServiceKey; label: string; description: string; capability: string; generationMode: Mode; fields: GuidedField[] };

export const agencyModeOptions: Record<Mode, { label: string; description: string }> = {
  bundle: { label: "Campanha integrada", description: "Estratégia, anúncios, carrossel e roteiro no mesmo briefing." },
  ads: { label: "Anúncios", description: "Ângulos, textos principais e chamadas para ação." },
  carousel: { label: "Carrossel", description: "Narrativa editorial com artes independentes por slide." },
  video: { label: "Roteiro de vídeo", description: "Gancho, cenas, locução e plano de edição." },
  strategy: { label: "Estratégia", description: "Posicionamento, público e lacunas de evidência." },
  council: { label: "Conselho IA", description: "Lentes de decisão, recomendação e risco humano." },
};

export const guidedServiceCatalog: GuidedService[] = [
  { key: "bundle", label: "Campanha integrada", description: "Estratégia, anúncios, carrossel e roteiro a partir de uma única direção.", capability: "Orquestração de campanha", generationMode: "bundle", fields: [{ key: "offer", label: "Oferta prioritária", placeholder: "Produto, serviço ou condição que será comunicada", required: true }, { key: "audience", label: "Público que queremos mover", placeholder: "Quem precisa ser alcançado e qual contexto vive", required: true }, { key: "keyMessage", label: "Mensagem central", placeholder: "A ideia que precisa permanecer após o contato", required: true, multiline: true }, { key: "channel", label: "Canais planejados", placeholder: "Ex.: Instagram, Meta Ads, landing page" }, { key: "callToAction", label: "Ação esperada", placeholder: "Ex.: solicitar orçamento, iniciar conversa" }] },
  { key: "ads", label: "Anúncios", description: "Cria variações de texto, ângulos e chamadas para ação.", capability: "Redação de performance", generationMode: "ads", fields: [{ key: "offer", label: "Oferta ou produto", placeholder: "O que será anunciado", required: true }, { key: "audience", label: "Público prioritário", placeholder: "Perfil e dor ou desejo principal", required: true }, { key: "channel", label: "Canal de mídia", placeholder: "Ex.: Meta Ads, Google, LinkedIn", required: true }, { key: "proof", label: "Provas aprovadas", placeholder: "Fatos, diferenciais ou fontes que podem ser utilizados", multiline: true }, { key: "callToAction", label: "Chamada para ação", placeholder: "Ex.: peça uma proposta" }] },
  { key: "carousel", label: "Carrossel", description: "Desenha uma narrativa editorial com arte e texto por slide.", capability: "Narrativa para carrossel", generationMode: "carousel", fields: [{ key: "keyMessage", label: "Ideia central do carrossel", placeholder: "A transformação, insight ou ensinamento a desenvolver", required: true, multiline: true }, { key: "audience", label: "Leitor prioritário", placeholder: "Quem deve parar para ler", required: true }, { key: "slideCount", label: "Quantidade desejada de slides", placeholder: "Ex.: 7" }, { key: "visualDirection", label: "Direção visual", placeholder: "Elementos, referências e restrições da arte", multiline: true }, { key: "callToAction", label: "Ação do último slide", placeholder: "Ex.: salve este post ou fale com a equipe" }] },
  { key: "video", label: "Roteiro de vídeo", description: "Estrutura gancho, cenas, locução e plano de edição.", capability: "Roteiro audiovisual", generationMode: "video", fields: [{ key: "hook", label: "Gancho de abertura", placeholder: "Pergunta, tensão ou promessa dos primeiros segundos", required: true }, { key: "offer", label: "Tema, oferta ou demonstração", placeholder: "O assunto que o vídeo precisa desenvolver", required: true }, { key: "duration", label: "Duração desejada", placeholder: "Ex.: até 45 segundos" }, { key: "format", label: "Formato", placeholder: "Ex.: Reels vertical, institucional, depoimento autorizado" }, { key: "scenes", label: "Cenas, materiais ou restrições", placeholder: "O que já existe e o que não pode ser usado", multiline: true }] },
  { key: "strategy", label: "Estratégia", description: "Organiza posicionamento, público, ângulo e lacunas de evidência.", capability: "Planejamento estratégico", generationMode: "strategy", fields: [{ key: "businessChallenge", label: "Desafio de negócio", placeholder: "Qual decisão ou resultado precisa ser destravado", required: true, multiline: true }, { key: "audience", label: "Público prioritário", placeholder: "Quem será analisado", required: true }, { key: "marketContext", label: "Contexto de mercado", placeholder: "Concorrentes, sazonalidade e cenário atual", multiline: true }, { key: "proof", label: "Evidências disponíveis", placeholder: "Dados, fontes e premissas que podem sustentar a recomendação", multiline: true }] },
  { key: "council", label: "Conselho IA", description: "Compara lentes de decisão, recomendação e riscos a revisar.", capability: "Conselho de decisão", generationMode: "council", fields: [{ key: "decision", label: "Decisão que precisa ser tomada", placeholder: "A pergunta objetiva que a equipe precisa responder", required: true, multiline: true }, { key: "options", label: "Opções em análise", placeholder: "Alternativas que devem ser comparadas", required: true, multiline: true }, { key: "risks", label: "Riscos ou limites conhecidos", placeholder: "O que não pode ser ignorado", multiline: true }, { key: "proof", label: "Evidências e dados reais", placeholder: "Fontes, histórico e fatos disponíveis", multiline: true }] },
];

export function buildGuidedBriefing(service: GuidedService, answers: Partial<Record<GuidedFieldKey, string>>) {
  const details = service.fields
    .map(field => ({ label: field.label, value: answers[field.key]?.trim() }))
    .filter((item): item is { label: string; value: string } => Boolean(item.value))
    .map(item => `- ${item.label}: ${item.value}`);
  return [`Serviço selecionado: ${service.label}`, `Capacidade ativada: ${service.capability}`, ...details, "\nUse somente informações fornecidas. Marque lacunas como [FONTE PENDENTE] e mantenha a entrega em revisão humana."].join("\n");
}

export const providerCatalog: Array<{ value: ProviderKind; label: string; defaultModel: string; description: string }> = [
  { value: "manus", label: "Manus integrado", defaultModel: "gpt-5-mini", description: "Usa o motor integrado, sem colar uma chave externa." },
  { value: "openai", label: "OpenAI", defaultModel: "gpt-5-mini", description: "Para texto, estratégia e ideação do cliente." },
  { value: "openai_compatible", label: "OpenAI compatível", defaultModel: "gpt-5-mini", description: "Para gateways ou provedores compatíveis com OpenAI." },
  { value: "gemini", label: "Google Gemini", defaultModel: "gemini-2.5-flash", description: "Para fluxos baseados no ecossistema Google." },
  { value: "anthropic", label: "Anthropic", defaultModel: "claude-sonnet-4-6", description: "Para análise, escrita e raciocínio assistido." },
];

export const publicationGuardrail = "A liberação no painel não envia conteúdo automaticamente a redes, contas de anúncio ou canais externos.";

export function getCampaignGenerationBlock(providerConnectionId: number | null | undefined, connection?: { label?: string | null; status?: string | null } | null) {
  const blocked = Boolean(providerConnectionId && connection?.status === "disabled");
  return {
    blocked,
    message: blocked ? `Provedor ${connection?.label ?? "vinculado"} desativado — reative a conexão ou crie uma nova campanha com outro provedor.` : null,
  };
}

export function getConnectionRevalidationState(input: { editing: boolean; originalConfiguration: string; provider: ProviderKind; baseUrl: string; model: string; apiKey: string }) {
  const currentConfiguration = `${input.provider}|${input.baseUrl}|${input.model}`;
  const configurationChanged = input.editing && input.originalConfiguration !== currentConfiguration;
  const requiresNewKey = input.provider !== "manus" && configurationChanged;
  const requiresTest = input.provider !== "manus" && (!input.editing || Boolean(input.apiKey.trim()) || configurationChanged);
  return { configurationChanged, requiresNewKey, requiresTest };
}

const defaultProfile = { positioning: "", voice: "", audience: "", offers: "", proofPolicy: "", visualSystem: "" };
const emptyProvider = (): ProviderForm => ({ label: "", provider: "manus", model: "gpt-5-mini", imageModel: "", baseUrl: "", apiKey: "" });

function providerLabel(provider: ProviderKind) {
  return providerCatalog.find(item => item.value === provider)?.label ?? provider;
}

export function formatLastConnectionTest(value?: Date | string | null) {
  if (!value) return "Ainda não testada";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export default function Agency() {
  const utils = trpc.useUtils();
  const clients = trpc.workspace.clients.useQuery();
  const preferences = trpc.workspace.preferences.useQuery();
  const [clientId, setClientId] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("bundle");
  const [guidedServiceKey, setGuidedServiceKey] = useState<GuidedServiceKey>("bundle");
  const [guidedAnswers, setGuidedAnswers] = useState<Partial<Record<GuidedFieldKey, string>>>({});
  const [guidedAction, setGuidedAction] = useState<"idle" | "draft" | "generating">("idle");
  const [profile, setProfile] = useState(defaultProfile);
  const [campaign, setCampaign] = useState({ name: "", objective: "", briefing: "", connectionId: "" });
  const [provider, setProvider] = useState<ProviderForm>(() => emptyProvider());
  const [editingConnectionId, setEditingConnectionId] = useState<number | null>(null);
  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [reviewCampaignId, setReviewCampaignId] = useState<number | null>(null);
  const [lastCampaignId, setLastCampaignId] = useState<number | null>(null);
  const [publicationTarget, setPublicationTarget] = useState<PublicationTarget | null>(null);
  const [publicationStage, setPublicationStage] = useState<"confirm" | "processing" | "complete">("confirm");
  const [providerTestState, setProviderTestState] = useState<"idle" | "passed" | "failed">("idle");
  const [providerTestFingerprint, setProviderTestFingerprint] = useState("");
  const [providerVerificationToken, setProviderVerificationToken] = useState("");
  const [editingConfigurationFingerprint, setEditingConfigurationFingerprint] = useState("");
  const [campaignProviderTarget, setCampaignProviderTarget] = useState<CampaignProviderTarget | null>(null);
  const [campaignProviderId, setCampaignProviderId] = useState("");
  const selectedClient = useMemo(() => clients.data?.find(item => item.id === clientId) ?? null, [clients.data, clientId]);
  const selectedGuidedService = useMemo(() => guidedServiceCatalog.find(item => item.key === guidedServiceKey) ?? guidedServiceCatalog[0], [guidedServiceKey]);
  const overview = trpc.agency.overview.useQuery({ clientId: clientId ?? 0 }, { enabled: clientId !== null });
  const versions = trpc.agency.versions.useQuery({ campaignId: reviewCampaignId ?? 0 }, { enabled: reviewCampaignId !== null });

  useEffect(() => {
    if (clientId !== null || !clients.data?.length) return;
    setClientId(preferences.data?.activeClientId && clients.data.some(item => item.id === preferences.data?.activeClientId) ? preferences.data.activeClientId : clients.data[0].id);
  }, [clientId, clients.data, preferences.data?.activeClientId]);
  useEffect(() => {
    if (!overview.data?.profile) return;
    setProfile({ positioning: overview.data.profile.positioning ?? "", voice: overview.data.profile.voice ?? "", audience: overview.data.profile.audience ?? "", offers: overview.data.profile.offers ?? "", proofPolicy: overview.data.profile.proofPolicy ?? "", visualSystem: overview.data.profile.visualSystem ?? "" });
  }, [overview.data?.profile?.updatedAt]);

  const saveProfile = trpc.agency.saveProfile.useMutation({ onSuccess: () => { utils.agency.overview.invalidate(); toast.success("Perfil de agência salvo para este cliente."); }, onError: error => toast.error(error.message) });
  const connected = async () => { await utils.agency.overview.invalidate(); setProviderDialogOpen(false); setEditingConnectionId(null); setProvider(emptyProvider()); setProviderVerificationToken(""); setEditingConfigurationFingerprint(""); toast.success("Conexão protegida e disponível somente para este cliente."); };
  const connectProvider = trpc.agency.connectProvider.useMutation({ onSuccess: connected, onError: error => toast.error(error.message) });
  const updateProvider = trpc.agency.updateProvider.useMutation({ onSuccess: connected, onError: error => toast.error(error.message) });
  const setProviderStatus = trpc.agency.setProviderStatus.useMutation({ onSuccess: async data => { await utils.agency.overview.invalidate(); toast.success(data.id ? "Estado da conexão atualizado." : "Conexão atualizada."); }, onError: error => toast.error(error.message) });
  const testProviderConnection = trpc.agency.testProviderConnection.useMutation({ onSuccess: (data, variables) => { setProviderTestState("passed"); setProviderTestFingerprint(`${variables.provider}|${variables.apiBaseUrl ?? ""}|${variables.defaultModel}|${variables.apiKey ?? ""}`); setProviderVerificationToken("verificationToken" in data ? data.verificationToken : ""); toast.success(data.message); }, onError: error => { setProviderTestState("failed"); setProviderTestFingerprint(""); setProviderVerificationToken(""); toast.error(error.message); } });
  const updateCampaignProvider = trpc.agency.updateCampaignProvider.useMutation({ onSuccess: async () => { await utils.agency.overview.invalidate(); setCampaignProviderTarget(null); setCampaignProviderId(""); toast.success("Provedor atualizado sem alterar briefing, modo, versões ou aprovações."); }, onError: error => toast.error(error.message) });
  const createCampaign = trpc.agency.createCampaign.useMutation({
    onSuccess: async data => {
      await utils.agency.overview.invalidate();
      setCampaign(current => ({ ...current, name: "", objective: "", briefing: "" }));
      toast.success("Campanha criada. Revise o briefing e gere quando estiver pronto.");
      setLastCampaignId(data.id);
    },
    onError: error => toast.error(error.message),
  });
  const generate = trpc.agency.generate.useMutation({ onSuccess: async (_data, variables) => { setReviewCampaignId(variables.campaignId); await Promise.all([utils.agency.overview.invalidate(), utils.agency.versions.invalidate({ campaignId: variables.campaignId })]); toast.success("Geração concluída. Revise os materiais antes de aprovar."); }, onError: error => toast.error(error.message) });
  const approveVersion = trpc.agency.approveVersion.useMutation({ onSuccess: () => { if (reviewCampaignId) utils.agency.versions.invalidate({ campaignId: reviewCampaignId }); }, onError: error => toast.error(error.message) });
  const isSavingProvider = connectProvider.isPending || updateProvider.isPending;
  const providerNeedsTest = provider.provider !== "manus" && Boolean(provider.apiKey.trim());
  const revalidationState = getConnectionRevalidationState({ editing: Boolean(editingConnectionId), originalConfiguration: editingConfigurationFingerprint, provider: provider.provider, baseUrl: provider.baseUrl, model: provider.model, apiKey: provider.apiKey });
  const configurationChanged = revalidationState.configurationChanged;
  const requiresNewKey = revalidationState.requiresNewKey;
  const mustTestBeforeSave = revalidationState.requiresTest;
  const currentProviderFingerprint = `${provider.provider}|${provider.baseUrl}|${provider.model}|${provider.apiKey}`;
  const providerTestIsCurrent = providerTestState === "passed" && providerTestFingerprint === currentProviderFingerprint;
  const selectedProvider = providerCatalog.find(item => item.value === provider.provider) ?? providerCatalog[0];

  function submitProfile(event: FormEvent) {
    event.preventDefault();
    if (!clientId) return;
    saveProfile.mutate({ clientId, ...profile });
  }
  function openProviderDialog(connection?: { id: number; label: string; provider: ProviderKind; defaultModel: string; defaultImageModel?: string | null; apiBaseUrl?: string | null }) {
    if (connection) {
      setEditingConnectionId(connection.id);
      setProvider({ label: connection.label, provider: connection.provider, model: connection.defaultModel, imageModel: connection.defaultImageModel ?? "", baseUrl: connection.apiBaseUrl ?? "", apiKey: "" });
      setEditingConfigurationFingerprint(`${connection.provider}|${connection.apiBaseUrl ?? ""}|${connection.defaultModel}`);
    } else {
      setEditingConnectionId(null);
      setProvider(emptyProvider());
      setEditingConfigurationFingerprint("");
    }
    setProviderTestState("idle");
    setProviderTestFingerprint("");
    setProviderVerificationToken("");
    setProviderDialogOpen(true);
  }
  function closeProviderDialog() {
    if (isSavingProvider) return;
    setProviderDialogOpen(false);
    setEditingConnectionId(null);
    setProvider(emptyProvider());
    setProviderTestState("idle");
    setProviderTestFingerprint("");
    setProviderVerificationToken("");
    setEditingConfigurationFingerprint("");
  }
  function submitProvider(event: FormEvent) {
    event.preventDefault();
    if (!clientId) return;
    if (requiresNewKey && !provider.apiKey.trim()) {
      toast.error("Informe uma nova chave ao trocar provedor, URL ou modelo desta conexão.");
      return;
    }
    if (mustTestBeforeSave && (!providerTestIsCurrent || !providerVerificationToken)) {
      toast.error("Teste a conexão antes de proteger esta chave para o cliente.");
      return;
    }
    const payload = { label: provider.label, provider: provider.provider, defaultModel: provider.model, defaultImageModel: provider.imageModel || null, apiBaseUrl: provider.baseUrl || null, apiKey: provider.provider === "manus" ? undefined : provider.apiKey || undefined, verificationToken: providerTestIsCurrent ? providerVerificationToken || undefined : undefined };
    if (editingConnectionId) updateProvider.mutate({ connectionId: editingConnectionId, ...payload });
    else connectProvider.mutate({ clientId, ...payload });
  }
  function testProvider() {
    if (provider.provider !== "manus" && !provider.apiKey.trim()) {
      toast.error("Cole a chave de API que deseja validar antes de testar.");
      return;
    }
    setProviderTestState("idle");
    setProviderTestFingerprint("");
    setProviderVerificationToken("");
    testProviderConnection.mutate({ connectionId: editingConnectionId && !configurationChanged ? editingConnectionId : undefined, provider: provider.provider, apiBaseUrl: provider.baseUrl || null, defaultModel: provider.model, apiKey: provider.provider === "manus" ? undefined : provider.apiKey });
  }
  async function copyMaskedKey(keyHint?: string | null) {
    if (!keyHint || keyHint === "integrado") {
      toast.message("Esta conexão usa o Manus integrado e não possui chave externa para copiar.");
      return;
    }
    try {
      await navigator.clipboard.writeText(keyHint);
      toast.success("Identificador mascarado copiado. A chave completa permanece protegida no servidor.");
    } catch {
      toast.error("Não foi possível copiar o identificador mascarado neste navegador.");
    }
  }
  function openCampaignProviderDialog(target: CampaignProviderTarget, currentConnectionId: number | null | undefined, connection?: { status?: string | null } | null) {
    setCampaignProviderTarget(target);
    setCampaignProviderId(connection?.status === "active" && currentConnectionId ? String(currentConnectionId) : "");
  }
  async function submitGuidedCampaign(event: FormEvent, action: "draft" | "generating") {
    event.preventDefault();
    if (!clientId) return;
    const missingField = selectedGuidedService.fields.find(field => field.required && !guidedAnswers[field.key]?.trim());
    if (missingField) {
      toast.error(`Preencha “${missingField.label}” para iniciar ${selectedGuidedService.label.toLowerCase()}.`);
      return;
    }
    setGuidedAction(action);
    try {
      const data = await createCampaign.mutateAsync({
        clientId,
        name: campaign.name,
        objective: campaign.objective,
        briefing: buildGuidedBriefing(selectedGuidedService, guidedAnswers),
        mode: selectedGuidedService.generationMode === "ads" ? "ads" : selectedGuidedService.generationMode === "carousel" ? "carousel" : "bundle",
        generationMode: selectedGuidedService.generationMode,
        serviceKey: selectedGuidedService.key,
        providerConnectionId: campaign.connectionId ? Number(campaign.connectionId) : undefined,
      });
      if (action === "generating") {
        await generate.mutateAsync({ campaignId: data.id, mode: selectedGuidedService.generationMode });
        setReviewCampaignId(data.id);
        toast.success(`${selectedGuidedService.label} criada e enviada para revisão humana.`);
      } else {
        toast.success(`${selectedGuidedService.label} salva como material de trabalho.`);
      }
      setGuidedAnswers({});
    } finally {
      setGuidedAction("idle");
    }
  }
  function requestPublication(target: PublicationTarget) {
    setPublicationTarget(target);
    setPublicationStage("confirm");
  }
  function closePublicationDialog() {
    if (publicationStage === "processing") return;
    setPublicationTarget(null);
    setPublicationStage("confirm");
  }
  async function confirmPublication() {
    if (!publicationTarget || approveVersion.isPending) return;
    setPublicationStage("processing");
    try {
      await new Promise(resolve => window.setTimeout(resolve, 700));
      await approveVersion.mutateAsync({ creativeVersionId: publicationTarget.id, decision: "approved", note: "Revisão humana concluída: versão liberada para publicação no painel." });
      setPublicationStage("complete");
      toast.success("Versão liberada para publicação. Nenhum canal externo foi acionado automaticamente.");
      window.setTimeout(closePublicationDialog, 1100);
    } catch {
      setPublicationStage("confirm");
    }
  }

  return <StudioShell eyebrow="Agência conectada" title="Criação com IA" actions={<button className="ops-primary-button" type="button" onClick={() => document.getElementById("agency-briefing")?.scrollIntoView({ behavior: "smooth" })}><WandSparkles size={17} /> Nova geração</button>}>
    <div className="ops-content agency-content">
      <section className="agency-hero">
        <div><p className="ops-section-kicker">Orquestração por cliente</p><h2>Uma campanha, várias entregas, uma decisão humana.</h2><p>Conecte a marca, selecione um provedor e transforme o mesmo briefing em estratégia, anúncios, carrossel, vídeo e conselho de decisão.</p></div>
        <label className="agency-client-picker">Cliente operacional<select value={clientId ?? ""} onChange={event => setClientId(Number(event.target.value))} aria-label="Cliente da agência"><option value="" disabled>Selecione um cliente</option>{(clients.data ?? []).map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
      </section>
      {!clients.data?.length ? <section className="ops-empty"><p>Cadastre um cliente em Projetos antes de iniciar uma operação de agência.</p></section> : null}
      {selectedClient ? <>
        <section className="agency-metrics" aria-label="Visão da agência">
          <Metric icon={<FileText size={18} />} label="Briefs ativos" value={overview.data?.briefs.length ?? "—"} />
          <Metric icon={<Sparkles size={18} />} label="Campanhas" value={overview.data?.campaigns.length ?? "—"} />
          <Metric icon={<Clapperboard size={18} />} label="Roteiros" value={overview.data?.videos.length ?? "—"} />
          <Metric icon={<BrainCircuit size={18} />} label="Decisões" value={overview.data?.decisions.length ?? "—"} />
        </section>
        <section className="agency-workbench">
          <form className="ops-panel agency-profile" onSubmit={submitProfile}>
            <div className="ops-panel-heading"><div><p className="ops-section-kicker">01 · Contexto da marca</p><h2>Perfil de {selectedClient.name}</h2></div><Bot size={20} /></div>
            <div className="agency-form-grid"><Field label="Posicionamento" value={profile.positioning} onChange={value => setProfile({ ...profile, positioning: value })} placeholder="O espaço que a marca quer ocupar" /><Field label="Voz" value={profile.voice} onChange={value => setProfile({ ...profile, voice: value })} placeholder="Ex.: direta, especialista, acolhedora" /><Field label="Público prioritário" value={profile.audience} onChange={value => setProfile({ ...profile, audience: value })} placeholder="Quem precisa ser alcançado" /><Field label="Oferta e prioridade" value={profile.offers} onChange={value => setProfile({ ...profile, offers: value })} placeholder="Produto, serviço ou ação" /></div>
            <Field label="Regras de prova" value={profile.proofPolicy} onChange={value => setProfile({ ...profile, proofPolicy: value })} placeholder="O que pode ser afirmado e quais fontes são necessárias" multiline /><Field label="Sistema visual" value={profile.visualSystem} onChange={value => setProfile({ ...profile, visualSystem: value })} placeholder="Cores, composição, restrições e referências autorizadas" multiline />
            <button className="ops-outline-button" type="submit" disabled={saveProfile.isPending}>{saveProfile.isPending ? <Loader2 size={16} /> : null} Salvar contexto</button>
          </form>
          <section className="ops-panel agency-provider-manager" aria-label="Provedores de IA do cliente">
            <div className="ops-panel-heading"><div><p className="ops-section-kicker">02 · Motor de IA</p><h2>Conexões de {selectedClient.name}</h2></div><KeyRound size={20} /></div>
            <p className="ops-panel-copy">Configure um provedor por vez. As chaves são cifradas no servidor; aqui você vê somente o final seguro e o estado de uso.</p>
            <div className="agency-provider-summary"><ShieldCheck size={17} /><span>{(overview.data?.connections.filter(item => item.status === "active").length ?? 0)} conexão(ões) ativa(s)</span></div>
            <div className="agency-provider-list">
              {(overview.data?.connections ?? []).map(connection => <article className={`agency-provider-card ${connection.status === "disabled" ? "is-disabled" : ""}`} key={connection.id}>
                <div className="agency-provider-card-main"><div className="agency-provider-symbol"><KeyRound size={15} /></div><div><strong>{connection.label}</strong><span>{providerLabel(connection.provider as ProviderKind)} · {connection.defaultModel}</span><span className="agency-key-hint">Chave <code>{connection.keyHint || "integrada"}</code>{connection.keyHint && connection.keyHint !== "integrado" ? <button type="button" className="agency-copy-key" onClick={() => void copyMaskedKey(connection.keyHint)} aria-label={`Copiar identificador mascarado da conexão ${connection.label}`}><Copy size={12} /> Copiar</button> : null}{connection.apiBaseUrl ? " · URL personalizada" : ""}</span><small>Último teste bem-sucedido: {formatLastConnectionTest(connection.lastTestedAt)}</small></div></div>
                <div className="agency-provider-card-actions"><span className={`agency-status-badge ${connection.status === "active" ? "is-active" : ""}`}>{connection.status === "active" ? "Ativa" : "Desativada"}</span><button className="ops-text-button" type="button" onClick={() => openProviderDialog(connection as Parameters<typeof openProviderDialog>[0])}><Pencil size={14} /> Editar</button><button className="ops-text-button" type="button" disabled={setProviderStatus.isPending} onClick={() => setProviderStatus.mutate({ connectionId: connection.id, status: connection.status === "active" ? "disabled" : "active" })}>{connection.status === "active" ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}{connection.status === "active" ? "Desativar" : "Reativar"}</button></div>
              </article>)}
              {!overview.isLoading && !overview.data?.connections.length ? <p className="ops-empty-copy">Nenhum provedor configurado. Adicione uma conexão para este cliente ou use o Manus integrado.</p> : null}
            </div>
            <button className="ops-outline-button agency-provider-add" type="button" onClick={() => openProviderDialog()}><Plus size={16} /> Adicionar provedor</button>
          </section>
        </section>
        <section id="agency-briefing" className="ops-panel agency-briefing agency-guided-briefing">
          <div className="ops-panel-heading"><div><p className="ops-section-kicker">03 · Assistente de serviço</p><h2>Escolha a entrega e responda só o que importa</h2></div><WandSparkles size={20} /></div>
          <p className="ops-panel-copy">O cliente selecionado define o contexto. Em seguida, a VERTEX ativa a capacidade da entrega e organiza o briefing antes de criar qualquer material.</p>
          <div className="agency-guided-steps" aria-label="Etapas do fluxo de criação"><span><b>1</b> Cliente <strong>{selectedClient.name}</strong></span><span><b>2</b> Serviço <strong>{selectedGuidedService.label}</strong></span><span><b>3</b> Briefing <strong>Revisável</strong></span></div>
          <div className="agency-guided-services" aria-label="Tipos de serviço">{guidedServiceCatalog.map(service => <button key={service.key} className={guidedServiceKey === service.key ? "is-selected" : ""} type="button" onClick={() => { setGuidedServiceKey(service.key); setMode(service.generationMode); setGuidedAnswers({}); }}><span>{service.capability}</span><strong>{service.label}</strong><small>{service.description}</small></button>)}</div>
          <form onSubmit={event => void submitGuidedCampaign(event, "generating")} className="agency-campaign-form agency-guided-form">
            <div className="agency-guided-capability"><Sparkles size={16} /><div><span>Capacidade ativada</span><strong>{selectedGuidedService.capability}</strong></div><p>{selectedGuidedService.description}</p></div>
            <div className="agency-form-grid"><Field label="Nome do projeto" value={campaign.name} onChange={value => setCampaign({ ...campaign, name: value })} placeholder={`Ex.: ${selectedGuidedService.label} — ${selectedClient.name}`} required /><Field label="Objetivo da entrega" value={campaign.objective} onChange={value => setCampaign({ ...campaign, objective: value })} placeholder="Ex.: gerar conversas qualificadas" required /><label className="agency-field">Motor de IA<select value={campaign.connectionId} onChange={event => setCampaign({ ...campaign, connectionId: event.target.value })}><option value="">Manus integrado</option>{(overview.data?.connections ?? []).filter(item => item.status === "active").map(item => <option key={item.id} value={item.id}>{item.label} · {item.defaultModel}</option>)}</select></label></div>
            <div className="agency-guided-question-grid">{selectedGuidedService.fields.map(field => <Field key={field.key} label={`${field.label}${field.required ? " *" : ""}`} value={guidedAnswers[field.key] ?? ""} onChange={value => setGuidedAnswers(current => ({ ...current, [field.key]: value }))} placeholder={field.placeholder} multiline={field.multiline} required={field.required} />)}</div>
            <div className="agency-guided-actions"><div className="agency-publication-guardrail"><ShieldCheck size={16} /><span>A criação gera material interno sujeito à revisão humana. Nenhuma publicação externa será acionada.</span></div><div><button className="ops-outline-button" type="button" disabled={guidedAction !== "idle" || createCampaign.isPending || generate.isPending} onClick={event => void submitGuidedCampaign(event, "draft")}>{guidedAction === "draft" ? <Loader2 size={16} /> : <FileText size={16} />} Salvar briefing</button><button className="ops-primary-button" type="submit" disabled={guidedAction !== "idle" || createCampaign.isPending || generate.isPending}>{guidedAction === "generating" ? <Loader2 size={16} /> : <WandSparkles size={17} />} Iniciar criação</button></div></div>
          </form>
        </section>
        <section className="agency-output-grid"><div className="ops-panel"><div className="ops-panel-heading"><div><p className="ops-section-kicker">Fila de criação</p><h2>Campanhas recentes</h2></div><Sparkles size={20} /></div>{overview.isLoading ? <div className="ops-page-loading"><Loader2 size={18} /> Lendo agência…</div> : null}{!(overview.data?.campaigns.length) && !overview.isLoading ? <p className="ops-empty-copy">O primeiro briefing criado aparecerá aqui para revisão e geração.</p> : null}{(overview.data?.campaigns ?? []).slice(0, 5).map(({ campaign: item, connection, generationMode }) => { const generationBlock = getCampaignGenerationBlock(item.providerConnectionId, connection); return <div className={`agency-list-row ${generationBlock.blocked ? "agency-list-row-blocked" : ""}`} key={item.id}><div><strong>{item.name}</strong><span>{item.objective}</span><small>{generationBlock.message ?? (item.status === "ready" ? "Pronto para revisão" : item.status === "failed" ? "Falha na geração" : "Rascunho de trabalho")}</small></div><div className="agency-row-actions"><button type="button" className="ops-text-button" onClick={() => setReviewCampaignId(item.id)}>Revisar</button><button type="button" className="ops-text-button" onClick={() => openCampaignProviderDialog({ id: item.id, title: item.name }, item.providerConnectionId, connection)}><RefreshCw size={14} /> Provedor</button><button type="button" className="ops-text-button" disabled={generate.isPending || generationBlock.blocked} title={generationBlock.blocked ? "Reative ou troque o provedor antes de gerar" : undefined} onClick={() => generate.mutate({ campaignId: item.id, mode: generationMode })}>Gerar <ChevronRight size={15} /></button></div></div>; })}</div>
          <div className="ops-panel"><div className="ops-panel-heading"><div><p className="ops-section-kicker">Conselho e inteligência</p><h2>Sinais para revisar</h2></div><BrainCircuit size={20} /></div>{(overview.data?.trends ?? []).slice(0, 3).map(item => <div className="agency-list-row" key={item.id}><div><strong>{item.title}</strong><span>{item.platform} · prioridade {item.score ?? "—"}</span></div></div>)}{(overview.data?.decisions ?? []).slice(0, 3).map(item => <div className="agency-list-row" key={item.id}><div><strong>{item.recommendation}</strong><small>Risco: {item.primaryRisk || "em revisão"}</small></div></div>)}{!(overview.data?.trends.length || overview.data?.decisions.length) ? <p className="ops-empty-copy">Registre sinais e decisões após gerar ou revisar uma campanha. A IA recomenda; sua equipe aprova.</p> : null}</div></section>
        <section className="ops-panel agency-review-queue" aria-label="Revisão humana de versões"><div className="ops-panel-heading"><div><p className="ops-section-kicker">Revisão humana</p><h2>Versões e aprovações</h2></div><CheckCircle2 size={20} /></div>{!reviewCampaignId ? <p className="ops-empty-copy">Escolha <strong>Revisar</strong> em uma campanha para abrir seu histórico de materiais.</p> : null}{versions.isLoading ? <div className="ops-page-loading"><Loader2 size={18} /> Carregando versões…</div> : null}{reviewCampaignId && !versions.isLoading && !versions.data?.length ? <p className="ops-empty-copy">Ainda não há material gerado para esta campanha.</p> : null}{(versions.data ?? []).map(version => <div className="agency-version-row" key={version.id}><div><strong>{version.kind} · V{version.versionNumber}</strong><span>{version.summary || "Material sem resumo"}</span><small>Status: {version.status === "approved" ? "Liberada para publicação" : version.status === "rejected" ? "Rejeitada" : "Em revisão"}</small></div>{version.status === "review" ? <div className="agency-row-actions"><button type="button" className="ops-text-button" disabled={approveVersion.isPending} onClick={() => approveVersion.mutate({ creativeVersionId: version.id, decision: "changes_requested" })}>Ajustes</button><button type="button" className="ops-text-button agency-reject-action" disabled={approveVersion.isPending} onClick={() => approveVersion.mutate({ creativeVersionId: version.id, decision: "rejected" })}><XCircle size={15} /> Rejeitar</button><button type="button" className="ops-primary-button agency-publish-action" disabled={approveVersion.isPending} onClick={() => requestPublication({ id: version.id, title: `${version.kind} · V${version.versionNumber}` })}><UploadCloud size={15} /> Liberar publicação</button></div> : null}</div>)}</section>
        {lastCampaignId ? <p className="agency-result-note">Campanha #{lastCampaignId} pronta para geração. Selecione <strong>Gerar</strong> na fila quando quiser enviar o briefing ao provedor.</p> : null}
      </> : null}
    </div>
    <ProviderConnectionDialog open={providerDialogOpen} onOpenChange={open => { if (!open) closeProviderDialog(); }} onSubmit={submitProvider} onCancel={closeProviderDialog} provider={provider} setProvider={setProvider} editing={Boolean(editingConnectionId)} selectedProvider={selectedProvider} saving={isSavingProvider} testing={testProviderConnection.isPending} testState={providerTestState} testIsCurrent={providerTestIsCurrent} requiresTest={mustTestBeforeSave} requiresNewKey={requiresNewKey} onTest={testProvider} />
    <CampaignProviderDialog open={Boolean(campaignProviderTarget)} onOpenChange={open => { if (!open && !updateCampaignProvider.isPending) { setCampaignProviderTarget(null); setCampaignProviderId(""); } }} target={campaignProviderTarget} providerId={campaignProviderId} setProviderId={setCampaignProviderId} connections={overview.data?.connections ?? []} saving={updateCampaignProvider.isPending} onCancel={() => { setCampaignProviderTarget(null); setCampaignProviderId(""); }} onConfirm={() => campaignProviderTarget && updateCampaignProvider.mutate({ campaignId: campaignProviderTarget.id, providerConnectionId: campaignProviderId ? Number(campaignProviderId) : null })} />
    <Dialog open={Boolean(publicationTarget)} onOpenChange={open => { if (!open) closePublicationDialog(); }}><DialogContent className="agency-publication-dialog" showCloseButton={publicationStage !== "processing"} onPointerDownOutside={event => { if (publicationStage === "processing") event.preventDefault(); }}><DialogHeader><p className="ops-section-kicker">Confirmação humana</p><DialogTitle>{publicationStage === "complete" ? "Versão liberada" : "Liberar para publicação?"}</DialogTitle><DialogDescription>{publicationStage === "complete" ? "O histórico recebeu sua aprovação. A equipe pode agora publicar no canal escolhido." : `Você está liberando ${publicationTarget?.title ?? "esta versão"} após sua revisão.`}</DialogDescription></DialogHeader>{publicationStage === "processing" ? <div className="agency-publication-loading" role="status" aria-live="polite"><span className="agency-publication-orbit"><Loader2 size={25} /></span><div><strong>Registrando sua revisão</strong><p>Validando a liberação antes de tornar o material disponível no painel.</p></div></div> : publicationStage === "complete" ? <div className="agency-publication-complete"><CheckCircle2 size={24} /><p>Liberação registrada com sucesso.</p></div> : <div className="agency-publication-guardrail"><ShieldCheck size={18} /><p>{publicationGuardrail} Esta etapa apenas registra a decisão humana e libera o material para o fluxo operacional.</p></div>}<DialogFooter>{publicationStage === "confirm" ? <><button className="ops-text-button" type="button" onClick={closePublicationDialog}>Voltar</button><button className="ops-primary-button agency-publish-action" type="button" onClick={confirmPublication}><UploadCloud size={16} />Confirmar liberação</button></> : null}</DialogFooter></DialogContent></Dialog>
  </StudioShell>;
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number | string }) { return <div className="agency-metric"><span>{icon}</span><strong>{value}</strong><small>{label}</small></div>; }
function Field({ label, value, onChange, placeholder, multiline, type = "text", required, autoComplete }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; multiline?: boolean; type?: string; required?: boolean; autoComplete?: string }) { return <label className="agency-field"><span>{label}</span>{multiline ? <textarea value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} required={required} /> : <input type={type} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} required={required} autoComplete={autoComplete} />}</label>; }
export function ProviderConnectionDialog({ open, onOpenChange, onSubmit, onCancel, provider, setProvider, editing, selectedProvider, saving, testing, testState, testIsCurrent, requiresTest, requiresNewKey, onTest }: { open: boolean; onOpenChange: (open: boolean) => void; onSubmit: (event: FormEvent) => void; onCancel: () => void; provider: ProviderForm; setProvider: (provider: ProviderForm) => void; editing: boolean; selectedProvider: { description: string }; saving: boolean; testing: boolean; testState: "idle" | "passed" | "failed"; testIsCurrent: boolean; requiresTest: boolean; requiresNewKey: boolean; onTest: () => void }) {
  const update = (partial: Partial<ProviderForm>) => setProvider({ ...provider, ...partial });
  const description = requiresNewKey
    ? "Você alterou o provedor, URL ou modelo. Informe uma nova chave e conclua o teste antes de salvar."
    : editing && provider.provider !== "manus"
      ? "Deixe a chave em branco para preservar a credencial cifrada atual; ao trocar a chave, valide-a antes de salvar."
      : "";
  const testMessage = testing
    ? "Validando sem salvar a chave…"
    : testIsCurrent
      ? "Conexão validada. Pode salvar com segurança."
      : testState === "failed"
        ? "O teste falhou. Revise os dados antes de salvar."
        : requiresNewKey
          ? "A alteração exige uma nova chave e uma validação concluída."
          : provider.provider === "manus"
            ? "Valide a integração antes de salvar."
            : "O teste é obrigatório para uma chave nova ou alterada.";

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="agency-dialog" showCloseButton={!saving} onPointerDownOutside={event => { if (saving) event.preventDefault(); }}><form onSubmit={onSubmit}><DialogHeader><p className="ops-section-kicker">{editing ? "Editar conexão" : "Nova conexão"}</p><DialogTitle>{editing ? "Atualize o provedor com segurança" : "Configure o motor de IA"}</DialogTitle><DialogDescription>{selectedProvider.description} {description}</DialogDescription></DialogHeader><div className="agency-dialog-fields"><Field label="Nome da conexão" value={provider.label} onChange={label => update({ label })} placeholder="Ex.: OpenAI · Marketing" required /><label className="agency-field"><span>Provedor</span><select value={provider.provider} onChange={event => { const next = event.target.value as ProviderKind; const preset = providerCatalog.find(item => item.value === next); update({ provider: next, model: preset?.defaultModel ?? provider.model, baseUrl: next === "openai_compatible" ? provider.baseUrl : "", apiKey: "" }); }}>{providerCatalog.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><Field label="Modelo de texto" value={provider.model} onChange={model => update({ model })} placeholder="Modelo de texto" required /><Field label="Modelo de imagem (opcional)" value={provider.imageModel} onChange={imageModel => update({ imageModel })} placeholder="Modelo de imagem, se houver" />{provider.provider !== "manus" ? <><Field label="URL base (opcional)" value={provider.baseUrl} onChange={baseUrl => update({ baseUrl })} placeholder="https://..." /><Field label={requiresNewKey ? "Nova chave de API (obrigatória)" : editing ? "Nova chave de API (opcional)" : "Chave de API"} value={provider.apiKey} onChange={apiKey => update({ apiKey })} placeholder="Cole a chave do cliente" type="password" autoComplete="new-password" required={!editing || requiresNewKey} /></> : null}</div><div className={`agency-connection-test ${testIsCurrent ? "is-passed" : testState === "failed" ? "is-failed" : ""}`}><button className="ops-outline-button" type="button" disabled={testing} onClick={onTest}>{testing ? <Loader2 size={15} /> : <RefreshCw size={15} />} Testar conexão</button><span>{testMessage}</span></div><p className="agency-dialog-security"><ShieldCheck size={15} />A chave é usada apenas no teste servidor a servidor, é cifrada em repouso ao salvar e não retorna à interface.</p><DialogFooter><button className="ops-text-button" type="button" disabled={saving} onClick={onCancel}>Cancelar</button><button className="ops-primary-button" type="submit" disabled={saving || testing || (requiresTest && !testIsCurrent)}>{saving ? <Loader2 size={16} /> : <ShieldCheck size={16} />}{editing ? "Salvar alterações" : "Proteger conexão"}</button></DialogFooter></form></DialogContent></Dialog>;
}
function CampaignProviderDialog({ open, onOpenChange, target, providerId, setProviderId, connections, saving, onCancel, onConfirm }: { open: boolean; onOpenChange: (open: boolean) => void; target: CampaignProviderTarget | null; providerId: string; setProviderId: (value: string) => void; connections: Array<{ id: number; label: string; defaultModel: string; status?: string | null }>; saving: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="agency-dialog"><DialogHeader><p className="ops-section-kicker">Troca preservada</p><DialogTitle>Alterar o provedor da campanha</DialogTitle><DialogDescription>Escolha um provedor ativo para <strong>{target?.title}</strong>. O briefing, objetivo, modo, versões e aprovações permanecem inalterados.</DialogDescription></DialogHeader><div className="agency-dialog-fields"><label className="agency-field"><span>Novo provedor</span><select value={providerId} onChange={event => setProviderId(event.target.value)}><option value="">Manus integrado</option>{connections.filter(item => item.status === "active").map(item => <option key={item.id} value={item.id}>{item.label} · {item.defaultModel}</option>)}</select></label></div><p className="agency-dialog-security"><ShieldCheck size={15} />A troca altera somente o vínculo do motor de IA. Ela não gera conteúdo, não substitui materiais e não publica nada.</p><DialogFooter><button className="ops-text-button" type="button" disabled={saving} onClick={onCancel}>Cancelar</button><button className="ops-primary-button" type="button" disabled={saving || !target} onClick={onConfirm}>{saving ? <Loader2 size={16} /> : <RefreshCw size={16} />} Atualizar provedor</button></DialogFooter></DialogContent></Dialog>;
}
