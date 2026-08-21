# Operação do SaaS de Atendimento WhatsApp — VERTEX Consulting

## Finalidade e limite da versão atual

Este guia descreve como operar o módulo SaaS multicliente de atendimento da VERTEX Consulting. A versão atual recebe eventos autenticados, mantém conversas isoladas por cliente, avalia automações, cria rascunhos revisáveis e registra handoffs. **Ela não transmite mensagens para WhatsApp automaticamente.** Essa restrição é deliberada: o primeiro ciclo de operação mantém a revisão humana e reduz o risco de resposta não aprovada.

> A ativação de tráfego real é uma etapa futura e separada. Ela exige credenciais válidas, validação de assinatura, consentimento aplicável, teste de envio controlado e uma decisão explícita da agência.

| Papel | Atividade permitida | Informação que não recebe |
|---|---|---|
| Administração da agência | Criar canais, definir políticas, planos, membros e realizar troca de conector. | Segredos descriptografados no navegador. |
| Operação da agência | Revisar conversa, assumir handoff e salvar rascunho. | Margem interna quando não autorizada. |
| Membro do portal do cliente | Consultar somente canais, histórico e assinatura do próprio `clientId`. | Dados de outro cliente, credenciais, custos e markup. |

## Sequência de configuração por cliente

A operação começa no painel **Atendimento WhatsApp**. Selecione o cliente correto, crie um canal em modo de configuração e escolha entre **API oficial da Meta** ou **Parceiro BSP (Twilio)**. O canal não fica ativo após sua criação; isso impede tráfego acidental antes do cadastramento e da validação das credenciais.

| Etapa | Ação da agência | Resultado esperado |
|---|---|---|
| 1. Contrato | Cadastre ou selecione o plano anual e, se aplicável, o adicional de IA VERTEX. | Limites comerciais ficam associados ao cliente. |
| 2. Canal | Crie o canal e informe apenas identificadores não secretos, como número e conta. | Canal em `draft`, sem tráfego. |
| 3. IA | Escolha chave própria validada do cliente ou IA gerenciada VERTEX. | Política registrada por `clientId`. |
| 4. Atendimento | Defina modo de revisão, palavras de handoff, horário comercial e regras. | Rascunho e handoff ficam auditáveis. |
| 5. Portal | Conceda acesso por e-mail e papel. | O usuário visualiza somente o workspace autorizado. |

## Ativação de webhooks e credenciais

Para Meta Cloud API, o endpoint do canal segue o formato `/api/webhooks/whatsapp/meta/:channelId`. A Meta envia webhooks para mensagens recebidas e status de mensagens; o aplicativo precisa estar configurado com endpoint e permissões adequadas para receber esses eventos.[1] Para produção, a Meta também pode reenviar eventos que não recebam resposta HTTP 200, o que reforça a necessidade da idempotência aplicada pelo sistema.[1]

Para Twilio, o endpoint é `/api/webhooks/whatsapp/twilio/:channelId`. A assinatura `X-Twilio-Signature` deve ser conferida utilizando a URL exata e todos os parâmetros recebidos. A Twilio recomenda HTTPS com certificado público válido e valida a assinatura antes do processamento.[2]

| Provedor | Material a configurar fora do painel | Controle aplicado pela VERTEX |
|---|---|---|
| Meta Cloud API | Segredo global da aplicação, token de verificação e credenciais cifradas do canal. | Verificação do desafio, HMAC da requisição e evento idempotente. |
| Twilio | Credencial cifrada do canal e URL de webhook configurada no Console Twilio. | Verificação da assinatura e evento idempotente. |

Não registre chaves de API, tokens ou segredos em texto livre nos campos de identificação do canal. A configuração real deve permanecer no servidor, em segredo gerenciado e cifrado. Antes de ativar um canal, teste cada callback com os consoles dos respectivos provedores e revise os registros de auditoria.

## Política de IA e automações

No modo de chave própria, a automação com ação de IA só avança para rascunho se houver uma conexão ativa, com chave presente e teste bem-sucedido. No modo VERTEX, requer uma assinatura ativa ou em avaliação com adicional de IA gerenciada. Em ambos os modos, o contato deve ter `opted_in` para uma ação automatizada de IA.

| Gatilho ou condição | Ação local | Status de execução |
|---|---|---|
| Mensagem recebida, palavra-chave ou fora de horário | Cria rascunho interno quando a regra permite. | `executed` |
| Palavra de handoff ou política somente humana | Coloca a conversa em `waiting_human`. | `executed` |
| Credencial, adicional ou consentimento ausente | Registra motivo, sem rascunho e sem envio. | `blocked` |
| Reentrega da mesma mensagem para a mesma regra | Mantém a decisão anterior. | `skipped` |

O operador revisa a conversa na caixa de entrada, pode assumir o atendimento humano e salva um rascunho. Mesmo os rascunhos marcados como saída permanecem com `deliveryStatus = queued`; eles não são publicados pelo módulo nesta fase.

## Troca de conector sem perda de histórico

Use **Trocar conector** no cartão do canal para selecionar o outro provedor e confirmar a alteração. Essa operação conserva o histórico no mesmo canal e no mesmo cliente, mas remove obrigatoriamente a configuração secreta e a verificação do provedor anterior. O canal retorna a `draft`; configure e teste as credenciais do novo provedor antes de liberar qualquer tráfego.

| O que é preservado | O que é removido | Motivo |
|---|---|---|
| `channelId`, conversas, mensagens e auditoria daquele cliente. | Configuração cifrada, dica de segredo e marca de verificação do conector anterior. | Evita reaproveitar credencial Meta em Twilio, ou o inverso. |

## Cobrança anual com Stripe

O painel administrativo cadastra planos anuais, incluindo o `stripePriceId`. A abertura do checkout é manual, por plano e cliente. O webhook Stripe verifica a assinatura do evento e persiste apenas identificadores necessários para relacionar cliente, assinatura e preço; dados de cartão não são guardados no sistema.

O Stripe orienta que integrações de assinatura processem eventos por webhook, pois muitas mudanças de estado ocorrem de forma assíncrona. A confirmação e as alterações de status devem ser tratadas no endpoint autenticado antes de provisionar ou revogar acesso.[3]

## Rotina de revisão operacional

| Frequência | Revisão necessária | Evidência esperada |
|---|---|---|
| Diária | Conversas em `waiting_human`, bloqueios e rascunhos pendentes. | Motivo de bloqueio e decisão do operador. |
| Semanal | Eventos de webhook falhos, tentativas duplicadas e saúde dos canais. | Auditoria por canal e processamento idempotente. |
| Mensal | Consumo de IA, limites contratados e assinatura anual. | Indicadores por cliente sem expor custo interno ao portal. |
| Antes de ativar tráfego | Consentimento, credenciais, assinatura, teste de callback e responsável humano. | Checklist aprovado pela agência. |

## Validação automatizada atual

A suíte do projeto cobre assinatura Meta inválida, reentrega idempotente, ingestão Meta/Twilio, rascunho por gatilho, bloqueio de IA sem credencial, handoff, regras sem ativação, idempotência de execução, troca de provedor e bloqueio de acessos do portal entre clientes. Essas verificações devem continuar obrigatórias a cada evolução do transporte externo.

## Referências

[1]: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks "Meta — Webhooks da WhatsApp Business Platform"
[2]: https://www.twilio.com/docs/usage/webhooks/webhooks-security "Twilio — Secure webhooks"
[3]: https://docs.stripe.com/billing/subscriptions/webhooks "Stripe — Using webhooks with subscriptions"
