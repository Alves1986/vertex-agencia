import { ArrowRight, BarChart3, Headphones, HeartPulse, KeyRound, Settings2, ShieldCheck, UsersRound } from "lucide-react";
import { Link } from "wouter";
import { StudioShell } from "@/components/StudioShell";
import "./management.css";

const managementAreas = [
  { href: "/sucesso", icon: HeartPulse, eyebrow: "Relacionamento", title: "Sucesso e portal do cliente", description: "Acompanhe saúde da conta, acessos, aprovações externas, onboarding e relatórios por cliente." },
  { href: "/atendimento", icon: Headphones, eyebrow: "Canais", title: "Atendimento e WhatsApp", description: "Configure canais, acompanhe conversas e mantenha handoff humano antes de qualquer envio externo." },
  { href: "/governanca", icon: ShieldCheck, eyebrow: "Controles", title: "Governança e BI", description: "Consulte consentimentos, auditoria, integrações, retenção e indicadores executivos sem inventar métricas." },
  { href: "/suporte", icon: UsersRound, eyebrow: "Operação", title: "Suporte interno", description: "Organize tickets, prioridades, atualizações e acordos de atendimento por cliente." },
  { href: "/agencia", icon: KeyRound, eyebrow: "IA", title: "Conexões e consumo", description: "Gerencie provedores, credenciais cifradas, limites de uso e modelos habilitados por cliente." },
  { href: "/governanca", icon: BarChart3, eyebrow: "Direção", title: "Indicadores executivos", description: "Use o BI para leitura de receita, margem, mídia e sinais de risco com base nos dados registrados." },
];

export default function Management() {
  return <StudioShell eyebrow="Plataforma SaaS" title="Gestão da conta">
    <div className="ops-content management-page">
      <section className="management-hero">
        <div><p className="ops-section-kicker">Base da operação</p><h2>Controles que sustentam a agência e as contas atendidas.</h2><p>Esta área reúne os itens de administração contínua. Ela não compete com o fluxo principal: serve para manter clientes, equipe, integrações, segurança e indicadores organizados.</p></div>
        <span><Settings2 size={30} /></span>
      </section>
      <section className="management-principles" aria-label="Como usar a gestão da conta"><article><b>Agência</b><span>Opera clientes, projetos, produção e canais no fluxo principal.</span></article><article><b>Conta atendida</b><span>Enxerga apenas seus acessos, aprovações, consumo e conversas autorizadas.</span></article><article><b>Plataforma</b><span>Centraliza controles, auditoria, suporte e saúde da operação sem expor credenciais.</span></article></section>
      <section className="management-grid" aria-label="Áreas de gestão">{managementAreas.map(area => { const Icon = area.icon; return <Link key={`${area.href}-${area.title}`} href={area.href} className="management-card"><span className="management-card-icon"><Icon size={18} /></span><div><p>{area.eyebrow}</p><h3>{area.title}</h3><small>{area.description}</small></div><ArrowRight size={17} /></Link>; })}</section>
    </div>
  </StudioShell>;
}
