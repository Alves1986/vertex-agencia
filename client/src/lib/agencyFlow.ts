import { BadgeDollarSign, BrainCircuit, HeartPulse, LayoutDashboard, MessageCircleMore, Settings2, SquareKanban, WandSparkles, Workflow } from "lucide-react";

export const agencyFlow = [
  { step: "00", label: "Painel", href: "/", icon: LayoutDashboard, description: "Leitura executiva do que existe, do que está em risco e da próxima ação." },
  { step: "01", label: "Clientes", href: "/comercial", icon: BadgeDollarSign, description: "Oportunidades, propostas, contratos, receita e início do relacionamento." },
  { step: "02", label: "Planejamento", href: "/inteligencia", icon: BrainCircuit, description: "Estratégia, pesquisa, pautas, calendário editorial e mídia." },
  { step: "03", label: "Criação", href: "/agencia", icon: WandSparkles, description: "Briefings, IA, ativos, versões e revisão humana antes de qualquer saída." },
  { step: "04", label: "Projetos", href: "/projetos", icon: SquareKanban, description: "Escopo, responsáveis, prioridades e visão de cada entrega contratada." },
  { step: "05", label: "Produção", href: "/producao", icon: Workflow, description: "Tarefas, calendário, aprovações internas e ritmo de execução." },
  { step: "06", label: "Atendimento", href: "/atendimento", icon: MessageCircleMore, description: "Conversas, canais de WhatsApp, handoff e regras de atendimento." },
  { step: "07", label: "Sucesso", href: "/sucesso", icon: HeartPulse, description: "Saúde da conta, acessos, aprovações externas e acompanhamento contínuo." },
] as const;

export const managementEntry = { label: "Gestão", href: "/gestao", icon: Settings2, description: "Controles de plataforma, suporte, governança, BI e portal." } as const;
