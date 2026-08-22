import { useMemo, useState } from "react";
import { toast } from "sonner";
import { StudioShell } from "@/components/StudioShell";
import { trpc } from "@/lib/trpc";
import "./governance.css";

const currency = (value?: number | null) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((value ?? 0) / 100);
const percent = (value?: number | null) => value == null ? "Não disponível" : `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const dateText = (value?: Date | string | null) => value ? new Date(value).toLocaleDateString("pt-BR") : "—";

export default function Governance() {
  const utils = trpc.useUtils();
  const clients = trpc.workspace.clients.useQuery();
  const operators = trpc.workspace.operators.useQuery();
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const clientId = selectedClientId ?? clients.data?.[0]?.id ?? 0;
  const assets = trpc.agency.brandAssets.useQuery({ clientId }, { enabled: clientId > 0 });
  const rights = trpc.governance.assetRights.useQuery({ clientId }, { enabled: clientId > 0 });
  const consents = trpc.governance.consents.useQuery({ clientId }, { enabled: clientId > 0 });
  const retention = trpc.governance.retentionPolicies.useQuery({ clientId }, { enabled: clientId > 0 });
  const health = trpc.governance.integrationHealth.useQuery({ clientId }, { enabled: clientId > 0 });
  const capacity = trpc.governance.capacityPlans.useQuery();
  const executive = trpc.governance.executiveDashboard.useQuery();
  const [assetRight, setAssetRight] = useState({ brandAssetId: "", versionLabel: "Versão atual", licenseType: "owned" as const, status: "active" as const, expiresAt: "" });
  const [consent, setConsent] = useState({ subjectEmail: "", consentType: "data_processing" as const, status: "granted" as const, legalBasis: "Consentimento registrado" });
  const [retentionForm, setRetentionForm] = useState({ dataCategory: "contacts" as const, retentionDays: "365", status: "active" as const });
  const [capacityForm, setCapacityForm] = useState({ operatorId: "", periodStart: new Date().toISOString().slice(0, 10), capacityMinutes: "9600", bookedMinutes: "0" });
  const [integration, setIntegration] = useState({ integrationType: "other" as const, provider: "", status: "healthy" as const, safeMessage: "" });

  const authorizedAssets = useMemo(() => assets.data?.filter(asset => asset.status === "authorized") ?? [], [assets.data]);
  const invalidateClientGovernance = async () => {
    await Promise.all([utils.governance.assetRights.invalidate(), utils.governance.consents.invalidate(), utils.governance.retentionPolicies.invalidate(), utils.governance.integrationHealth.invalidate()]);
  };
  const saveAssetRight = trpc.governance.saveAssetRight.useMutation({ onSuccess: async () => { await utils.governance.assetRights.invalidate(); toast.success("Direito de uso registrado."); } });
  const createConsent = trpc.governance.createConsent.useMutation({ onSuccess: async () => { await utils.governance.consents.invalidate(); toast.success("Consentimento registrado."); } });
  const saveRetention = trpc.governance.saveRetentionPolicy.useMutation({ onSuccess: async () => { await utils.governance.retentionPolicies.invalidate(); toast.success("Política de retenção atualizada."); } });
  const saveCapacity = trpc.governance.saveCapacityPlan.useMutation({ onSuccess: async () => { await utils.governance.capacityPlans.invalidate(); await utils.governance.executiveDashboard.invalidate(); toast.success("Capacidade atualizada."); } });
  const recordHealth = trpc.governance.recordIntegrationHealth.useMutation({ onSuccess: async () => { await utils.governance.integrationHealth.invalidate(); toast.success("Status da integração registrado."); } });

  return (
    <StudioShell eyebrow="Gestão da plataforma" title="Governança & BI">
      <div className="governance-page">
        <section className="governance-hero">
          <div><span className="governance-kicker">Visão de gestão</span><h2>Decisões sustentadas por dados disponíveis.</h2><p>Receita, capacidade e performance são exibidas sem estimar indicadores que ainda não possuem base confiável.</p></div>
          <label className="governance-client-picker">Cliente de referência<select value={clientId || ""} onChange={event => setSelectedClientId(Number(event.target.value))}><option value="" disabled>Selecione um cliente</option>{clients.data?.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
        </section>

        <section className="executive-grid" aria-label="Indicadores executivos">
          <Metric label="MRR ativo" value={currency(executive.data?.mrrCents)} detail="Contratos mensais e anuais ativos" />
          <Metric label="Receita registrada" value={currency(executive.data?.revenueCents)} detail="Lançamentos faturados, pagos ou em atraso" />
          <Metric label="Margem direta" value={currency(executive.data?.marginCents)} detail={`Margem ${percent(executive.data?.marginPercent)}`} />
          <Metric label="Pipeline" value={currency(executive.data?.pipelineCents)} detail={`Conversão ${percent(executive.data?.winRatePercent)}`} />
          <Metric label="Mídia reportada" value={currency(executive.data?.media.spendCents)} detail={`${executive.data?.media.leads ?? 0} leads reportados`} />
          <Metric label="Capacidade reservada" value={percent(executive.data?.capacity.utilizationPercent)} detail={`${Math.round((executive.data?.capacity.bookedMinutes ?? 0) / 60)}h de ${Math.round((executive.data?.capacity.plannedMinutes ?? 0) / 60)}h`} />
        </section>
        <p className="governance-disclosure">CAC e LTV: <b>não disponíveis</b> até que custos de aquisição e histórico consistente de retenção sejam registrados. O índice de churn é histórico, baseado em contratos ativos e encerrados cadastrados.</p>

        <div className="governance-columns">
          <section className="governance-card span-two"><header><div><span>Biblioteca com governança</span><h3>Direitos, licença e validade de ativos</h3></div><strong>{rights.data?.length ?? 0} registros</strong></header>
            {authorizedAssets.length ? <form className="compact-form" onSubmit={event => { event.preventDefault(); if (!clientId || !assetRight.brandAssetId) return toast.error("Selecione um ativo autorizado."); saveAssetRight.mutate({ clientId, brandAssetId: Number(assetRight.brandAssetId), versionLabel: assetRight.versionLabel, licenseType: assetRight.licenseType, status: assetRight.status, expiresAt: assetRight.expiresAt ? new Date(`${assetRight.expiresAt}T12:00:00`) : null }); }}>
              <select value={assetRight.brandAssetId} onChange={event => setAssetRight(current => ({ ...current, brandAssetId: event.target.value }))}><option value="">Ativo autorizado</option>{authorizedAssets.map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select>
              <input value={assetRight.versionLabel} onChange={event => setAssetRight(current => ({ ...current, versionLabel: event.target.value }))} placeholder="Versão" />
              <select value={assetRight.licenseType} onChange={event => setAssetRight(current => ({ ...current, licenseType: event.target.value as typeof assetRight.licenseType }))}><option value="owned">Propriedade</option><option value="licensed">Licenciado</option><option value="stock">Banco de imagem</option><option value="partner">Parceiro</option><option value="editorial">Editorial</option><option value="unknown">A validar</option></select>
              <input type="date" value={assetRight.expiresAt} onChange={event => setAssetRight(current => ({ ...current, expiresAt: event.target.value }))} aria-label="Validade" /><button disabled={saveAssetRight.isPending}>Registrar</button>
            </form> : <p className="empty-note">Inclua primeiro um ativo autorizado na biblioteca de marca para registrar licença e validade.</p>}
            <div className="governance-list">{rights.data?.map(({ right, asset }) => <article key={right.id}><b>{asset.name}</b><span>{right.versionLabel} · {right.licenseType}</span><small className={`status-dot ${right.status}`}>{right.status} · vence {dateText(right.expiresAt)}</small></article>)}{!rights.data?.length && <p className="empty-note">Nenhum direito de uso cadastrado.</p>}</div>
          </section>

          <section className="governance-card"><header><div><span>Equipe</span><h3>Capacidade e gargalos</h3></div><strong>{capacity.data?.length ?? 0} planos</strong></header>
            <form className="compact-form vertical" onSubmit={event => { event.preventDefault(); if (!capacityForm.operatorId) return toast.error("Selecione um responsável."); saveCapacity.mutate({ operatorId: Number(capacityForm.operatorId), periodStart: new Date(`${capacityForm.periodStart}T12:00:00`), capacityMinutes: Number(capacityForm.capacityMinutes), bookedMinutes: Number(capacityForm.bookedMinutes) }); }}>
              <select value={capacityForm.operatorId} onChange={event => setCapacityForm(current => ({ ...current, operatorId: event.target.value }))}><option value="">Responsável</option>{operators.data?.map(({ operator }) => <option value={operator.id} key={operator.id}>{operator.name}</option>)}</select><input type="date" value={capacityForm.periodStart} onChange={event => setCapacityForm(current => ({ ...current, periodStart: event.target.value }))} /><div className="split-input"><input type="number" min="0" value={capacityForm.capacityMinutes} onChange={event => setCapacityForm(current => ({ ...current, capacityMinutes: event.target.value }))} placeholder="Min. capacidade" /><input type="number" min="0" value={capacityForm.bookedMinutes} onChange={event => setCapacityForm(current => ({ ...current, bookedMinutes: event.target.value }))} placeholder="Min. reservados" /></div><button disabled={saveCapacity.isPending}>Salvar capacidade</button>
            </form>
            <div className="governance-list compact">{capacity.data?.slice(0, 5).map(({ plan, operator }) => <article key={plan.id}><b>{operator.name}</b><span>{dateText(plan.periodStart)} · {Math.round(plan.bookedMinutes / 60)}h / {Math.round(plan.capacityMinutes / 60)}h</span><small className={plan.bookedMinutes > plan.capacityMinutes ? "status-dot error" : "status-dot healthy"}>{plan.bookedMinutes > plan.capacityMinutes ? "Sobrecarga" : "Dentro da capacidade"}</small></article>)}</div>
          </section>

          <section className="governance-card"><header><div><span>LGPD e relacionamento</span><h3>Consentimentos</h3></div><strong>{consents.data?.length ?? 0}</strong></header>
            <form className="compact-form vertical" onSubmit={event => { event.preventDefault(); if (!clientId) return; createConsent.mutate({ clientId, subjectEmail: consent.subjectEmail || null, consentType: consent.consentType, status: consent.status, legalBasis: consent.legalBasis || null }); }}>
              <input type="email" value={consent.subjectEmail} onChange={event => setConsent(current => ({ ...current, subjectEmail: event.target.value }))} placeholder="E-mail do titular (opcional)" /><div className="split-input"><select value={consent.consentType} onChange={event => setConsent(current => ({ ...current, consentType: event.target.value as typeof consent.consentType }))}><option value="data_processing">Tratamento de dados</option><option value="marketing">Marketing</option><option value="whatsapp">WhatsApp</option><option value="email">E-mail</option><option value="terms">Termos</option></select><select value={consent.status} onChange={event => setConsent(current => ({ ...current, status: event.target.value as typeof consent.status }))}><option value="granted">Concedido</option><option value="pending">Pendente</option><option value="revoked">Revogado</option></select></div><button disabled={createConsent.isPending}>Registrar consentimento</button>
            </form>
            <div className="governance-list compact">{consents.data?.slice(0, 5).map(item => <article key={item.id}><b>{item.subjectEmail || item.subjectName || "Titular não identificado"}</b><span>{item.consentType}</span><small className={`status-dot ${item.status === "granted" ? "healthy" : item.status === "revoked" ? "error" : "warning"}`}>{item.status}</small></article>)}</div>
          </section>

          <section className="governance-card"><header><div><span>Privacidade</span><h3>Retenção de dados</h3></div><strong>{retention.data?.length ?? 0}</strong></header>
            <form className="compact-form vertical" onSubmit={event => { event.preventDefault(); if (!clientId) return; saveRetention.mutate({ clientId, dataCategory: retentionForm.dataCategory, retentionDays: Number(retentionForm.retentionDays), status: retentionForm.status }); }}><div className="split-input"><select value={retentionForm.dataCategory} onChange={event => setRetentionForm(current => ({ ...current, dataCategory: event.target.value as typeof retentionForm.dataCategory }))}><option value="contacts">Contatos</option><option value="conversations">Conversas</option><option value="creative">Criativos</option><option value="analytics">Analytics</option><option value="financial">Financeiro</option><option value="research">Pesquisa</option></select><input type="number" min="1" value={retentionForm.retentionDays} onChange={event => setRetentionForm(current => ({ ...current, retentionDays: event.target.value }))} /></div><button disabled={saveRetention.isPending}>Definir retenção</button></form>
            <div className="governance-list compact">{retention.data?.map(item => <article key={item.id}><b>{item.dataCategory}</b><span>{item.retentionDays} dias</span><small className={`status-dot ${item.status === "active" ? "healthy" : "warning"}`}>{item.status}</small></article>)}</div>
          </section>

          <section className="governance-card span-two"><header><div><span>Operação monitorada</span><h3>Saúde de integrações</h3></div><strong>{health.data?.length ?? 0} eventos</strong></header>
            <form className="compact-form" onSubmit={event => { event.preventDefault(); if (!clientId || !integration.provider) return toast.error("Informe o provedor ou serviço avaliado."); recordHealth.mutate({ clientId, integrationType: integration.integrationType, provider: integration.provider, status: integration.status, safeMessage: integration.safeMessage || null }); }}><select value={integration.integrationType} onChange={event => setIntegration(current => ({ ...current, integrationType: event.target.value as typeof integration.integrationType }))}><option value="ai">IA</option><option value="whatsapp">WhatsApp</option><option value="email">E-mail</option><option value="media">Mídia</option><option value="research">Pesquisa</option><option value="crm">CRM</option><option value="other">Outro</option></select><input value={integration.provider} onChange={event => setIntegration(current => ({ ...current, provider: event.target.value }))} placeholder="Provedor ou conector" /><select value={integration.status} onChange={event => setIntegration(current => ({ ...current, status: event.target.value as typeof integration.status }))}><option value="healthy">Saudável</option><option value="warning">Atenção</option><option value="error">Falha</option><option value="unknown">Sem verificação</option></select><input value={integration.safeMessage} onChange={event => setIntegration(current => ({ ...current, safeMessage: event.target.value }))} placeholder="Nota segura — sem chaves ou segredos" /><button disabled={recordHealth.isPending}>Registrar</button></form>
            <div className="health-strip">{health.data?.slice(0, 8).map(item => <article key={item.id}><i className={item.status} /><b>{item.provider}</b><span>{item.integrationType} · {dateText(item.checkedAt)}</span><small>{item.safeMessage || "Sem observação"}</small></article>)}{!health.data?.length && <p className="empty-note">Sem eventos registrados para este cliente.</p>}</div>
          </section>
        </div>
      </div>
    </StudioShell>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="metric-card"><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}
