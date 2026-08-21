# Requisitos Verificados de Integração WhatsApp

Esta nota registra os requisitos externos verificados em agosto de 2026 para a camada de entrega da VERTEX Consulting. Ela orienta a implementação e a ativação, mas não substitui a revisão das políticas vigentes de cada provedor antes de colocar um canal de cliente em produção.

## Recebimento de eventos

A Meta usa webhooks HTTP para informar mensagens recebidas, estados de mensagens enviadas e outros eventos. O campo `messages` cobre tanto mensagens recebidas de usuários quanto status das mensagens de saída. Falhas de resposta diferente de HTTP 200 podem gerar novas tentativas de entrega por até sete dias, portanto o endpoint deve manter idempotência por evento.[1]

A Twilio assina seus callbacks em `X-Twilio-Signature`. A validação requer a URL exata do callback e todos os parâmetros recebidos, inclusive parâmetros adicionados futuramente; em JSON, deve ser usado o corpo bruto e a rotina específica de validação. A Twilio também requer HTTPS com certificado público confiável.[2]

| Provedor | Entrada obrigatória | Proteção operacional no sistema |
|---|---|---|
| Meta Cloud API | Endpoint configurado, permissões adequadas e assinatura validada. | HMAC, resposta rápida, auditoria e idempotência. |
| Twilio | Callback HTTPS e assinatura `X-Twilio-Signature`. | Validação com URL e parâmetros completos, auditoria e idempotência. |

## Entrega de mensagens

As mensagens de serviço da Meta podem ser enviadas no período de atendimento ao cliente que começa quando a pessoa envia uma mensagem ou inicia uma chamada. Esse período é de 24 horas e é renovado por nova interação; fora dele, a Meta exige um template pré-aprovado. A pessoa também precisa ter optado por receber mensagens.[3]

| Condição antes de enviar | Decisão segura |
|---|---|
| Contato sem opt-in | Bloquear e registrar a razão; não chamar o provedor. |
| Janela de atendimento Meta expirada | Bloquear mensagem de texto livre; exigir fluxo de template aprovado. |
| Canal sem credencial ou ainda em configuração | Bloquear; não testar ou enviar ao provedor. |
| Aprovação humana ausente | Manter a mensagem como rascunho ou em fila de aprovação. |
| Retentativa de uma mesma entrega | Reutilizar a referência local e não duplicar a chamada externa. |

## Referências

[1]: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks "Meta — WhatsApp Cloud API: Webhooks"
[2]: https://www.twilio.com/docs/usage/webhooks/webhooks-security "Twilio — Secure webhooks"
[3]: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages "Meta — Service messages"
