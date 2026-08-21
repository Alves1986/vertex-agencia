# Pesquisa técnica — WhatsApp SaaS multicliente

**Data da consulta:** 21 de agosto de 2026.  
**Fonte primária:** documentação oficial da Meta/WhatsApp Business Platform.

## Achados que orientam a arquitetura

A solução deve usar a **WhatsApp Business Platform Cloud API oficial**, com um endpoint HTTPS próprio para receber eventos. A Meta entrega por webhook as mensagens recebidas, os estados das mensagens enviadas e eventos de conta; notificações podem ser reenviadas durante até sete dias quando o endpoint não responde com sucesso. Portanto, o processamento precisa ser idempotente, armazenar o identificador do evento e confirmar rapidamente o recebimento antes de processar IA ou disparos posteriores.[1]

Para um SaaS, o **Embedded Signup** é o onboarding preferencial: o próprio cliente autoriza a VERTEX a operar os ativos da sua empresa, inclusive WABA e número, e o servidor troca o código devolvido por um token empresarial com escopo daquele cliente. Após o fluxo, a aplicação deve registrar, por organização, o identificador da WABA, o identificador do número e o token cifrado; esses ativos continuam pertencendo ao cliente.[2]

O uso em escala exige planejamento de permissões. Parceiros que atendem empresas precisam de acesso avançado para as permissões de mensageria e gestão; o onboarding padrão começa limitado a dez novos clientes em sete dias e aumenta após verificações e aprovação. Também existem requisitos de cobrança próprios do WhatsApp: parceiros de solução podem compartilhar linha de crédito, enquanto outros modelos exigem que cada empresa cadastre seu método de pagamento na conta WhatsApp.[2]

O segundo modo de canal pode ser fornecido por um **BSP**, usando Twilio como adaptador de referência. Esse provedor recebe mensagens e atualizações de entrega por webhook, expõe um fluxo de onboarding para provedores de software e exige opt-in explícito; fora da janela de atendimento iniciada pelo usuário, notificações precisam de templates aprovados. A aplicação deve normalizar esses eventos no mesmo modelo interno utilizado pela Cloud API, sem misturar as credenciais de cada organização.[4] [5]

| Decisão | Consequência para a VERTEX |
|---|---|
| Entrada de mensagens via webhook | Endpoint público, verificação de assinatura, idempotência, fila persistente e auditoria por organização. |
| Onboarding de empresas | Embedded Signup, token empresarial cifrado e segregação por WABA/número. |
| Atendimento por IA | IA executada após persistir a mensagem; regras de horário, opt-out, transferência humana e aprovação de templates. |
| Cobrança SaaS | Assinatura anual da VERTEX separada do custo de conversas faturado pela Meta. |
| Modo BSP | Adaptador específico, validação da assinatura do provedor e normalização para o mesmo contrato de conversas. |

## Referências

[1] [Meta for Developers — Webhooks da WhatsApp Business Platform](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview)  
[2] [Meta for Developers — Embedded Signup](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview)  
[3] [Meta for Developers — About the WhatsApp Business Platform](https://developers.facebook.com/documentation/business-messaging/whatsapp/about-the-platform)  
[4] [Twilio — Overview of WhatsApp Business Platform](https://www.twilio.com/docs/whatsapp/api)  
[5] [Twilio — Messaging Webhooks](https://www.twilio.com/docs/usage/webhooks/messaging-webhooks)
