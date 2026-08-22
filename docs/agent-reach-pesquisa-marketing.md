# Pesquisa Profunda de Marketing com Referência no Agent-Reach

## Decisão de arquitetura

O repositório [Agent-Reach](https://github.com/Alves1986/Agent-Reach) foi avaliado como uma **camada de capacidade**: ele escolhe, verifica e encaminha ferramentas adequadas para fontes públicas, vídeo, repositórios, RSS e plataformas que dependem de sessão. Não deve ser incorporado diretamente ao runtime da VERTEX nesta primeira versão, porque parte dos seus conectores requer CLI em Python, dependências de sistema, sessão local do navegador ou cookies. A aplicação SaaS gerenciada não deve instalar esses componentes, manipular cookies de redes sociais ou executar comandos arbitrários em nome de clientes.

| Opção | Funcionamento | Vantagens | Limitações |
| --- | --- | --- | --- |
| **Central de inteligência sob demanda — adotada** | A VERTEX registra a pergunta, objetivo, fontes, evidências, síntese e recomendação revisável; pesquisas externas são realizadas sob comando da equipe por fontes permitidas. | Compatível com o produto atual, rastreável, sem cookies no SaaS e com revisão humana obrigatória. | Não tenta automatizar redes que exigem login nem promete coleta contínua. |
| Serviço de pesquisa dedicado — futuro opcional | Um ambiente isolado mantém o Agent-Reach e seus conectores; a VERTEX envia pedidos autenticados e recebe apenas resultados estruturados. | Maior cobertura de fontes e roteamento de ferramentas. | Exige infraestrutura própria, gestão de segredos/sessões, conformidade de cada fonte, observabilidade e política de retenção. |

> Nesta versão, a VERTEX adotará a primeira opção. A interface prepara a investigação, preserva fontes e gera material revisável para briefing, conteúdo, mídia e estratégia. Não será criado cron, coleta recorrente, login automatizado, armazenamento de cookie ou publicação automática.

## Regras de segurança

O Agent-Reach afirma que a configuração de fontes autenticadas depende de sessão ou exportação manual de cookies e que seu papel é selecionar e verificar backends, e não encapsular a leitura por conta própria [1]. Na VERTEX, esse padrão será usado apenas como referência arquitetural: os dados guardados no SaaS serão o **pedido de pesquisa, links de fonte escolhidos, notas, data, responsável e síntese**, e nunca cookies, tokens de redes sociais, comandos de terminal ou conteúdo de credenciais.

| Controle | Regra aplicada na VERTEX |
| --- | --- |
| Origem | Fontes públicas, URLs explicitamente registradas ou resultados inseridos por membro autorizado. |
| Privacidade | Nenhuma sessão de rede social, cookie ou chave de terceiros é persistida no módulo de inteligência. |
| Revisão | Recomendações são rascunhos; conteúdo, mídia ou comunicação externa continuam exigindo aprovação humana. |
| Escopo | Toda pesquisa é vinculada a um cliente e protegida pelos mesmos guards multicliente do sistema. |
| Evidência | A síntese deve poder referenciar as fontes utilizadas; dados não verificados ficam explicitamente marcados como hipótese. |
| Automação | Não há varredura, agendamento ou disparo automático nesta versão. |

## Uso operacional previsto

A equipe abre uma pesquisa a partir de uma oportunidade, campanha, pauta ou cliente. Define o objetivo, público, território, concorrentes e perguntas. Depois registra fontes e descobertas, elabora uma síntese e converte os achados em uma recomendação de estratégia, pauta, briefing ou hipótese de mídia. O produto conserva o contexto para evitar pesquisas repetidas e permitir auditoria da decisão criativa.

O repositório usa licença MIT, que permite uso, modificação e distribuição preservando o aviso de copyright e a licença [2]. Nenhum código do Agent-Reach é copiado para a VERTEX neste escopo; o documento reconhece apenas sua arquitetura como referência.

## Referências

[1]: https://github.com/Panniantong/Agent-Reach "Agent-Reach — capacidades, fontes suportadas e modelo de configuração"

[2]: https://github.com/Panniantong/Agent-Reach/blob/main/LICENSE "Agent-Reach — licença MIT"
