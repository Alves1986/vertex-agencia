# Validação da Entrega WhatsApp Controlada

## Escopo entregue

A VERTEX Consulting agora possui uma camada de despacho oficial para Meta Cloud API e Twilio. O transporte é iniciado apenas pela administração da agência, a partir de um rascunho da inbox e após confirmação em duas etapas. Nenhuma ação equivalente foi adicionada ao portal do cliente.

| Controle | Comportamento implementado |
|---|---|
| Credenciais | O painel aceita a configuração por canal e o servidor a cifra antes da persistência. Nenhuma chave retorna na consulta da interface. |
| Aprovação humana | Um rascunho em fila exibe **Aprovar rascunho**; somente um segundo clique confirma a solicitação de envio. |
| Idempotência | A transição da mensagem só aceita um rascunho na fila. Repetições retornam o resultado já registrado e não chamam novamente o provedor. |
| Proteções de entrega | O servidor exige ambiente habilitado, canal ativo, configuração válida, opt-in do contato, janela de 24 horas e corpo de mensagem. |
| Falha externa | Erros, respostas não bem-sucedidas e respostas sem identificador do provedor deixam rastreabilidade local e não são marcados como entregues. |

## Ativação controlada em produção

O módulo continua seguro sem credenciais: a configuração pode ficar vazia e o transporte permanece desabilitado. Para liberar um primeiro envio de produção, a agência deve concluir a sequência abaixo com um canal de teste e uma conversa cujo contato tenha consentimento válido.

| Ordem | Ação da agência | Evidência mínima |
|---|---|---|
| 1 | Cadastrar o canal Meta ou Twilio e salvar suas credenciais pelo painel. | Canal com configuração cifrada e sem erro pendente. |
| 2 | Configurar o callback público do provedor e validar assinatura. | Evento de teste aceito e auditado. |
| 3 | Ativar o canal somente após teste controlado. | Status ativo e data de verificação registrada. |
| 4 | Definir `WHATSAPP_OUTBOUND_ENABLED=true` apenas no ambiente de produção aprovado. | Variável configurada exclusivamente na administração segura do projeto. |
| 5 | Criar um rascunho, revisar o texto e usar a confirmação de duas etapas. | Identificador retornado por Meta ou Twilio gravado na mensagem. |

> A variável de ambiente não deve ser colocada em arquivos versionados nem em código do cliente. Sem ela, o endpoint de aprovação recusa a entrega mesmo quando o canal possui credenciais.

## Validação automática e visual

A suíte final contém **104 testes aprovados** em 25 arquivos. Ela valida os dois construtores de despacho, respostas de sucesso dos provedores, recusas HTTP, ausência de identificador rastreável e a trava ambiental. A suíte existente também cobre webhooks Meta/Twilio, assinaturas, automações, isolamento por cliente e contratos administrativos.

O build de produção foi concluído após a alteração. A revisão do painel em desktop confirmou que a página **Atendimento WhatsApp** apresenta o formulário de credenciais cifradas, mantém a inbox separada por cliente e torna a aprovação obrigatória explícita. Como não há conversas reais de teste no ambiente, o cartão de aprovação aparece somente quando houver um rascunho em fila; sua renderização é coberta pela lógica da página e pelo contrato de despacho.

## Referências operacionais

Os requisitos de callback e segurança usados para a ativação estão consolidados em [requisitos-integracao-whatsapp.md](./requisitos-integracao-whatsapp.md), com referências às documentações oficiais da Meta, Twilio e Stripe.
