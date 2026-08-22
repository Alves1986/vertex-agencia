# Módulo de Sucesso do Cliente e Governança SaaS

## Objetivo

O módulo **Sucesso** consolida a governança operacional de cada cliente da VERTEX Consulting. Ele complementa os fluxos de Agência IA e WhatsApp sem alterar seus controles existentes e mantém toda gestão sensível sob a equipe administrativa da agência.

| Área | Quem opera | Resultado principal |
| --- | --- | --- |
| Acessos, onboarding, marca, saúde e preferências | Administração VERTEX | Governança por cliente e visão operacional consolidada |
| Tickets internos | Administração VERTEX | Triagem, prioridade, atualização e acompanhamento de SLA |
| Tickets no portal | Usuário associado ao próprio cliente | Solicitação e acompanhamento somente da própria conta |
| Aprovação externa | Destinatário com link válido | Uma decisão sobre uma única versão criativa, dentro do prazo |
| Relatórios e exportação | Administração VERTEX | Registro executivo sob demanda e backup lógico seguro |

## Controle de acesso e isolamento

Os convites de acesso são registrados por cliente com os papéis `client_admin`, `manager`, `reviewer` e `viewer`. A equipe da agência cria, altera o estado ou revoga um convite. A associação ao portal só é aceita pelo usuário correspondente ao convite; consultas e ações do portal usam essa associação como guarda de escopo.

> Nenhuma tela do portal retorna custos internos, margens, chaves de API, valores cifrados, informações de outros clientes ou conteúdo de links externos não destinados ao usuário.

## Jornada de onboarding

A central orienta a evolução pelos estágios **marca**, **contatos**, **IA**, **WhatsApp**, **objetivos** e **revisão**. A conclusão não dispara publicação, mensagens ou automações. A etapa de revisão preserva a exigência de verificação humana antes de qualquer operação externa.

## Saúde, marca e notificações

O cartão de saúde agrega sinais de assinatura, consumo de IA, canais, falhas de e-mail, pendências de suporte, aprovações e próximos passos. A nota de saúde é uma sinalização operacional, não uma avaliação automática definitiva.

As diretrizes expandidas centralizam cores, fontes, tom de voz, palavras proibidas, CTAs, produtos e diferenciais. As preferências de notificação podem ser definidas por cliente para aprovações, consumo, canal, falhas de e-mail, prazos, cobrança e suporte. Elas configuram a elegibilidade de alertas dentro da plataforma; não criam agendamentos ou disparos externos autônomos.

## Aprovação externa segura

Ao criar um link, a agência seleciona o cliente, campanha, versão criativa, destinatário e prazo. O token é aleatório, somente seu hash é persistido e a página pública recebe apenas o conteúdo autorizado para aquela decisão. Um link expirado, revogado ou já decidido não pode ser reutilizado. A decisão possível é **aprovar** ou **solicitar alterações**, com uma nota opcional e trilha auditável.

> A aprovação externa não publica nem envia material automaticamente. A equipe VERTEX continua responsável pela revisão e pela ação final em qualquer canal.

## Relatórios e exportação

Relatórios executivos são **criados sob demanda** na central de Sucesso, com período, título, resumo e métricas estruturadas. Esta versão não possui cron, fila mensal ou envio automático.

A ação **Exportar backup seguro (JSON)** gera um retrato lógico administrativo do cliente para portabilidade e restauração controlada. O arquivo exclui segredos, chaves de API, credenciais cifradas e informações de outros clientes.

| Procedimento de restauração | Responsável | Controle obrigatório |
| --- | --- | --- |
| Validar o formato `vertex-client-backup/v1` e identificar cliente de destino | Administração VERTEX | Nunca importar diretamente em produção sem revisão |
| Comparar entidades e dados de referência antes de qualquer gravação | Administração VERTEX | Confirmar que não há colisão de identificadores nem sobrescrita indevida |
| Restaurar por procedimento administrativo versionado | Equipe técnica autorizada | Recriar segredos e integrações manualmente, nunca a partir do backup |
| Validar isolamento, contagens e telas relevantes | Administração VERTEX | Registrar a ação e manter revisão humana para ações externas |

O exportador é um mecanismo de **backup lógico sob demanda**, não uma alegação de backup automático de infraestrutura. Para retenção ou automação futura, será necessário desenho específico de agendamento, armazenamento, políticas de retenção e testes de recuperação.

## Validação desta entrega

Foram verificados os controles de contrato para administração, portal e links públicos; os novos fluxos de suporte e onboarding; a normalização de diretrizes; a compilação de tipos; o build de produção; e a interface das telas `/sucesso`, `/suporte` e `/meu-atendimento` em desktop e celular. A suíte final aprovada contém **142 testes em 31 arquivos**.
