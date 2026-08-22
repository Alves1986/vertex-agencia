# Operação Comercial, Inteligência e Governança

## Visão da expansão

Esta entrega amplia a VERTEX Consulting para acompanhar o ciclo operacional de uma agência, da primeira oportunidade ao resultado executivo, sem substituir a revisão humana. Os novos módulos ficam restritos à equipe administrativa da VERTEX e preservam a separação por cliente em todas as consultas, criações e atualizações.

| Central | Finalidade | Dados que exigem registro humano |
| --- | --- | --- |
| Comercial | CRM, propostas, contratos, lançamentos e margem | Oportunidade, escopo, valor, decisão comercial e condição financeira |
| Inteligência | Calendário editorial, mídia e pesquisa de marketing | Pautas, planos, resultados informados, fontes e sínteses |
| Governança | Direitos de ativos, capacidade, privacidade, integrações e BI | Licenças, carga de equipe, consentimentos, retenção e status de conectores |

## CRM, propostas, contratos e rentabilidade

O módulo **Comercial** centraliza oportunidades reais, atividades de relacionamento, propostas estruturadas, contratos e lançamentos financeiros. Uma proposta pode ser vinculada a uma oportunidade e um contrato pode se originar de uma proposta; os lançamentos registram receitas, custos, reembolsos e ajustes ligados ao cliente, contrato ou projeto, quando houver.

> O sistema não estima preço, margem, faturamento, CAC ou LTV. Os indicadores são calculados apenas sobre valores confirmados ou explicitamente planejados pela operação.

Antes de ativar um contrato, a equipe deve conferir escopo, ciclo de cobrança, recorrência e condição comercial. Renovação, aditivo e encerramento devem ser registrados como eventos rastreáveis, não como substituição silenciosa de histórico.

## Planejamento editorial e mídia paga

A central **Inteligência** organiza o calendário por cliente, canal, formato, pilar, objetivo, responsável, data planejada e estado editorial. Os estados cobrem a jornada de ideia, briefing, produção, revisão, aprovação, publicação e arquivamento; publicação externa continua dependente do fluxo humano adequado.

Planos de mídia registram plataforma, objetivo, meta e orçamento planejado. As métricas de gasto, impressões, alcance, cliques, leads, conversões e valor de conversão são snapshots informados ou importados sob revisão. A tela exibe CTR e ROAS apenas quando os campos necessários existem.

| Métrica | Regra de disponibilidade |
| --- | --- |
| CTR | Exibida somente com impressões e cliques registrados |
| ROAS | Exibido somente com gasto e valor de conversão registrados |
| Leads e conversões | Somatório dos snapshots informados para o plano selecionado |
| Orçamento | Valor planejado, não confirmação de gasto efetivo |

## Pesquisa profunda com Agent-Reach

A VERTEX utiliza a avaliação arquitetural do Agent-Reach como referência de método para pesquisa profunda sob demanda. Cada dossiê registra pergunta, objetivo, público, mercado, fontes, síntese, recomendação, riscos e estado de revisão. A fonte é gravada com tipo, título, URL, origem, trecho e data de publicação quando disponíveis.

O Agent-Reach não é executado automaticamente pelo produto, nem há cron, coleta contínua, publicação automática ou compartilhamento de credenciais. Quando a equipe solicitar uma investigação, ela deve ser iniciada explicitamente e suas fontes devem ser verificadas antes de serem aceitas no dossiê.

> A pesquisa orienta uma decisão; não é uma autorização automática para campanha, publicação, investimento ou contato externo.

Consulte também [a decisão técnica de pesquisa](./agent-reach-pesquisa-marketing.md) para limites, segurança e modo de uso do repositório de referência.

## Ativos, capacidade e governança

Ativos autorizados da biblioteca de marca podem receber registro de versão, origem de licença, situação e validade. A equipe deve utilizar `A validar` sempre que não houver confirmação documental de uso. O plano de capacidade registra minutos planejados e reservados por responsável e período, ajudando a tornar sobrecarga visível antes de prometer uma nova entrega.

Consentimentos e retenção são registros operacionais de apoio à LGPD, não substituem parecer jurídico ou política corporativa. A saúde de integrações registra apenas provedor, categoria, estado, momento de checagem e observação segura. Tokens, chaves, respostas brutas e dados sensíveis não devem ser inseridos em observações.

## BI executivo

O painel executivo consolida MRR, receita, margem direta, pipeline, mídia registrada e capacidade. CAC e LTV são exibidos como **não disponíveis** até que exista base histórica suficiente; a aplicação não cria valores substitutos. O churn é histórico e depende de contratos com estados adequadamente registrados.

| Indicador | Fonte no sistema |
| --- | --- |
| MRR | Contratos ativos com recorrência mensal ou anual normalizada |
| Receita e margem | Lançamentos financeiros registrados, sem estimativa oculta |
| Pipeline e conversão | Oportunidades qualificadas, ganhas e perdidas |
| Resultado de mídia | Snapshots de mídia revisados |
| Capacidade | Planos por responsável e período |

## Controle e validação

Os roteadores de Comercial, Inteligência e Governança aceitam somente procedimentos administrativos. A suíte inclui verificações de bloqueio de usuários não administrativos e de encaminhamento explícito de `clientId` para operações multicliente. A entrega foi validada com **148 testes em 34 arquivos**, checagem de tipos, build de produção e revisão responsiva das três novas centrais.
