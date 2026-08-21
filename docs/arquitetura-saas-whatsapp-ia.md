# Arquitetura SaaS de WhatsApp com IA — VERTEX Consulting

## Objetivo operacional

O módulo de WhatsApp expande a VERTEX Consulting para atender simultaneamente à equipe interna da agência e aos seus clientes, sem misturar números, credenciais, conversas, consumo ou regras de uma organização com outra. Cada cliente contrata um plano anual, configura seu canal e escolhe entre usar uma chave de IA própria ou contratar o adicional de **IA gerenciada pela VERTEX**.

| Camada | Responsabilidade | Limite de isolamento |
|---|---|---|
| Agência | Cria clientes, planos, canais, políticas e operadores. | `ownerUserId` delimita o espaço da agência. |
| Cliente | Administra o próprio canal, equipe autorizada e regras permitidas. | `clientId` delimita dados, conversas, mensagens e consumo. |
| Canal | Conecta um número a Meta Cloud API ou a um BSP. | `channelId` associa conversa, webhook, configuração cifrada e automação. |
| Atendimento | Registra contato, conversa, mensagem, IA e handoff humano. | Toda mensagem herda `clientId` e `channelId`. |

## Papéis e autorização

| Papel | Acesso esperado | Restrição obrigatória |
|---|---|---|
| Administrador da agência | Todos os clientes daquele espaço, planos, auditoria e configuração operacional. | Não pode expor segredos descriptografados ao navegador. |
| Operador da agência | Caixa de entrada e handoff dos clientes atribuídos. | Não altera cobrança ou segredos sem permissão administrativa. |
| Administrador do cliente | Canal, política de atendimento, membros e relatórios do próprio cliente. | Não consulta outro `clientId`. |
| Gestor/agente do cliente | Conversas, atendimento humano e automações autorizadas. | Não altera plano, cobrança nem segredos. |
| Visualizador | Indicadores e histórico permitido. | Não envia mensagens nem ativa automações. |

As tabelas `client_portal_members`, `whatsapp_channels`, `whatsapp_contacts`, `whatsapp_conversations`, `whatsapp_messages`, `whatsapp_ai_runs` e `whatsapp_audit_logs` tornam o isolamento persistente e rastreável. As consultas do produto devem sempre confirmar que o cliente pertence ao espaço operacional atual antes de ler, alterar ou enviar qualquer informação.

## Dois modos de WhatsApp no mesmo produto

| Modo | Ativação | Uso no produto | Persistência |
|---|---|---|---|
| **Meta Cloud API** | O cliente autoriza seus ativos empresariais pelo onboarding da Meta. | Canal direto, webhook próprio e token armazenado cifrado. | `provider = meta_cloud`. |
| **BSP compatível** | O cliente conecta as credenciais do parceiro selecionado. | Mesmo inbox e automações, por adaptador de canal. | `provider = twilio` inicialmente; a camada de adaptadores permite novos BSPs. |

A Meta entrega atualizações de mensagens por webhooks e disponibiliza um fluxo de onboarding integrado para conceder ativos empresariais autorizados à aplicação.[1] [2] O adaptador BSP segue o mesmo princípio de recepção autenticada de mensagens e status por webhook.[3]

## Política de IA e resposta humana

Cada cliente possui uma política em `whatsapp_ai_policies`. No modo **chave do cliente**, a política referencia uma conexão de IA ativa já cifrada do cliente. No modo **IA gerenciada pela VERTEX**, cada execução é registrada em `whatsapp_ai_runs` com telemetria e limite mensal próprio do adicional contratado.

| Modo de fluxo | Comportamento | Controle de risco |
|---|---|---|
| `auto_reply` | Nesta versão, a regra prepara apenas um rascunho local quando credencial e consentimento forem válidos. | O transporte externo continua desabilitado; uma futura liberação exige fluxo de aprovação e adaptador de saída auditado. |
| `draft_for_approval` | A IA gera um rascunho para um operador revisar. | Nenhuma mensagem é enviada antes da aprovação humana. |
| `handoff_only` | A automação apenas encaminha e contextualiza a conversa. | A IA não responde ao contato. |

O estado da conversa (`ai_active`, `waiting_human`, `human_active` ou `closed`) é a autoridade final para determinar se uma automação pode agir. Palavras de handoff, fora do horário, opt-out e falhas de integração devem bloquear a resposta automática e criar uma execução auditável.

## Automações explícitas e auditáveis

As tabelas `whatsapp_automation_rules` e `whatsapp_automation_executions` modelam regras por cliente e por canal. Uma regra possui gatilho, configuração, ação, prioridade, exigência de aprovação e estado; uma execução registra a decisão, a razão, a saída estruturada e o resultado. A chave única formada por `sourceMessageId` e `automationRuleId` impede que uma reentrega execute a mesma regra duas vezes.

| Situação avaliada | Resultado persistido | Efeito no atendimento |
|---|---|---|
| Regra ativa de mensagem, palavra-chave ou horário | `executed` com rascunho local | Cria mensagem de saída em fila interna, sem chamada a provedor externo. |
| Pedido de humano, regra de handoff ou política `handoff_only` | `executed` com `outcome = handoff` | Transfere a conversa para `waiting_human`. |
| Chave do cliente não testada, conexão inativa, adicional VERTEX ausente ou contato sem opt-in | `blocked` com motivo explícito | Não cria rascunho nem tenta entregar mensagem. |
| Regra pausada, gatilho não correspondente ou reentrega já avaliada | Nenhuma execução ou `skipped` | Não altera a conversa nem duplica o registro. |

O avaliador é chamado logo após a ingestão da mensagem recebida. Ele ordena as regras ativas por prioridade, registra a decisão e cria auditoria antes de qualquer possibilidade futura de transporte. A implementação atual não chama Meta, Twilio nem outro provedor para enviar uma resposta.

## Troca controlada de conector

A agência pode alternar um canal existente entre Meta Cloud API e Twilio. A operação mantém o mesmo `channelId`, preservando o histórico de conversas do cliente, porém apaga a configuração cifrada, a dica de segredo e a verificação do conector anterior. O canal volta ao estado `draft`, permanece sem tráfego e registra uma auditoria com `credentialsCleared`, `conversationsPreserved` e `externalDelivery = disabled`. Assim, uma credencial de um provedor não é reutilizada pelo outro.

## Limites e cobrança anual

Os planos anuais ficam em `saas_plans`, enquanto `saas_subscriptions` mantém o contrato ativo, prazo anual, canais, usuários humanos e o adicional de IA gerenciada. O produto deve bloquear a criação de canais e execuções da IA VERTEX quando o plano, o adicional ou o limite mensal não permitirem. O módulo inicia com registros de cobrança manual e está preparado para uma integração futura de assinatura Stripe, sem guardar cartões ou outros dados de pagamento.

## Fluxo seguro de evento

1. O provedor chama o endpoint exclusivo do canal.
2. O servidor valida desafio ou assinatura antes de persistir dados.
3. O evento bruto recebe uma chave externa idempotente em `whatsapp_webhook_events`.
4. A mensagem cria ou atualiza apenas o contato e a conversa daquele canal.
5. A política, a regra de automação e o estado de handoff decidem entre bloquear, rascunhar ou encaminhar.
6. A execução, a telemetria e a auditoria são gravadas; nesta versão, não há integração de envio externo.

> Nenhum segredo de canal, token de provedor ou chave de IA é retornado pelas consultas do navegador. O tráfego real permanece inativo até que a VERTEX informe os segredos globais da Meta e configure as credenciais cifradas de cada canal.

## Cobertura verificável

Os testes cobrem a rejeição de assinatura Meta inválida, reentrega idempotente, ingestão autenticada em Meta e Twilio, gatilhos de automação, bloqueio por credencial ausente, handoff, pausa por inexistência de regra ativa, idempotência de execução, troca administrativa de conector e negação de acesso do portal a clientes ou conversas não autorizadas. O build de produção é executado antes de cada checkpoint de entrega.

## Referências

[1]: https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview "Meta — WhatsApp webhooks"
[2]: https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview "Meta — Embedded Signup"
[3]: https://www.twilio.com/docs/whatsapp/api "Twilio — WhatsApp API"
