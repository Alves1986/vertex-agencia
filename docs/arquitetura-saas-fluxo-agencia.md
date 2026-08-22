# Arquitetura SaaS orientada ao fluxo de agência

## Princípio de organização

A VERTEX passa a apresentar a operação pela sequência real de uma agência. O painel inicial não é um local para executar tudo: ele resume o que já foi criado, os alertas e a próxima decisão. Cada aba seguinte concentra uma etapa da jornada, reduzindo a necessidade de descobrir funções pelo nome técnico.

| Etapa | Módulo | Decisão principal | O que permanece isolado |
|---|---|---|---|
| 00 | Painel | Onde atuar agora? | Leitura agregada, sem alterar registros acidentalmente. |
| 01 | Clientes | Qual oportunidade, contrato ou cliente será atendido? | Pipeline, propostas e rentabilidade por conta. |
| 02 | Planejamento | Qual estratégia, pauta, calendário ou pesquisa orienta a entrega? | Contexto e fontes vinculados ao cliente. |
| 03 | Criação | Qual material será produzido e revisado? | Briefings, ativos, versões, provedores e credenciais cifradas. |
| 04 | Projetos | Quem é responsável e qual é o escopo contratado? | Projetos e responsáveis da conta selecionada. |
| 05 | Produção | O que deve avançar hoje e quando será entregue? | Tarefas, agenda e aprovações internas. |
| 06 | Atendimento | Como a agência responde e faz handoff? | Conversas, canais e consentimento por cliente. |
| 07 | Sucesso | Como a conta está e o que precisa ser renovado ou comunicado? | Saúde, acessos, aprovações e portal do cliente. |

## Separação de públicos

> **Operação da agência** usa o fluxo principal para vender, planejar, criar, produzir e atender. **Gestão da conta** concentra controles recorrentes de SaaS. O **portal do cliente** continua com escopo restrito aos dados autorizados para aquela conta.

| Área | Público principal | Finalidade |
|---|---|---|
| Fluxo principal | Equipe da agência | Executar a entrega do início ao relacionamento contínuo. |
| Gestão da conta | Administradores da agência | Manter saúde, suporte, controles, integrações, governança e BI. |
| Portal do cliente | Usuários convidados do cliente | Acompanhar somente canais, consumo, aprovações e informações liberadas. |

## Regras de clareza

A navegação superior mostra somente as etapas essenciais e mantém sua ordem. Os recursos especializados — suporte interno, governança, BI, conexões de IA e portal — ficam reunidos em **Gestão da conta**, sem remover as rotas existentes. A nomenclatura prioriza verbos e resultados operacionais: *Planejamento*, *Criação*, *Produção* e *Atendimento* substituem agrupamentos ambíguos.

Alterar a estrutura visual não altera a proteção existente: credenciais continuam cifradas no servidor, dados seguem isolados por cliente e revisão humana permanece obrigatória antes de qualquer publicação ou envio externo.
