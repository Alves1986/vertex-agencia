# Histórico de aprovações e validação de IA

**Autoria:** Manus AI  
**Produto:** VERTEX Consulting  
**Atualização:** 22 de agosto de 2026

## Histórico por campanha

A área **Histórico de aprovações**, disponível ao abrir a revisão de uma campanha na página **Agência IA**, consolida a trilha de decisões criativas. Ela apresenta decisões individuais de versão e aprovações em lote de slides em ordem cronológica decrescente.

| Campo | Origem | Uso operacional |
|---|---|---|
| Decisão | Aprovação individual ou lote de slides | Identifica aprovação, pedido de ajuste ou rejeição |
| Responsável | Usuário revisor registrado no evento | Atribui a decisão a uma pessoa identificável |
| Data e hora | Registro imutável da ação | Apoia a conferência temporal da revisão |
| Nota | Justificativa opcional do revisor | Preserva critérios, ressalvas ou orientações |
| Slides | Registro de aprovação em lote | Mostra exatamente quais slides foram revisados juntos |

O contrato de consulta recebe somente o identificador da campanha e utiliza o usuário operacional autenticado para limitar o resultado ao espaço de trabalho proprietário. A tela não cria, altera ou publica materiais: ela apenas exibe fatos de revisão já registrados.

> A aprovação continua sendo uma decisão humana. O histórico melhora rastreabilidade e prestação de contas, mas não dispara publicação externa.

## Credencial e geração completa

Para a validação foi utilizado o **motor Manus integrado** do ambiente do projeto. Ele opera no servidor com credenciais injetadas pelo ambiente, de modo que nenhuma chave de API externa foi exibida, copiada para o navegador ou salva nos dados do cliente.

| Etapa de validação | Resultado |
|---|---|
| Catálogo de modelos disponível | Confirmado antes do teste |
| Modelo utilizado | `gpt-5-mini` pelo motor integrado |
| Teste de conexão | Confirmado pelo adaptador Manus |
| Geração estruturada | Concluída com três slides |
| Papéis normalizados | `cover`, `context` e `cta` |
| Persistência de conteúdo de teste | Não realizada |

O gerador passou a solicitar JSON válido na instrução de sistema, sem acionar o modo JSON que o provedor integrado rejeita quando a pesquisa web está habilitada. Além disso, a aplicação normaliza rótulos narrativos livres retornados pelo modelo para os papéis aceitos de carrossel antes de qualquer persistência.

## Como usar uma chave externa futuramente

Quando uma campanha exigir uma conta própria do cliente, abra **Credenciais de IA** na Agência IA, escolha o provedor, informe modelo e URL quando aplicável e use **Testar conexão** antes de salvar. A chave é enviada apenas ao servidor para validação e armazenamento cifrado; a interface mantém somente a máscara derivada e a data do último teste bem-sucedido.

| Escolha | Indicação |
|---|---|
| Motor Manus integrado | Testes internos, protótipos e operação centralizada pela VERTEX |
| Chave do cliente | Contratos com cobrança ou governança própria de uso de IA |
| IA gerenciada VERTEX | Planos que incluem consumo mediado e controle operacional da agência |

Antes de gerar material comercial, selecione o cliente correto, informe somente fatos e ativos autorizados no briefing e mantenha a revisão humana até a liberação explícita.

## Validação visual

Em 21 de agosto de 2026, a página **Agência IA** foi revisada nas larguras de **1280 × 720** e **375 × 812**. O seletor de cliente, o estado do motor integrado, o catálogo de serviços, o formulário de briefing, a fila de campanhas e a área **Versões e aprovações** permaneceram legíveis nos dois formatos. No conjunto de dados de validação não havia campanha criada; por isso, a área de versões exibiu corretamente sua orientação para iniciar uma revisão, em vez de apresentar histórico inexistente.

## Filtros e exportação para clientes

Na linha do tempo de uma campanha, selecione um responsável e, se necessário, uma data inicial e final. Os registros apresentados e o arquivo exportado usam o mesmo recorte. Use **CSV** para análise em planilhas e **PDF** para enviar uma evidência legível ao cliente.

| Formato | Conteúdo | Uso indicado |
|---|---|---|
| CSV | Campos estruturados, critérios aplicados e uma linha por decisão | Auditoria, conciliação ou compartilhamento em planilha |
| PDF | Cabeçalho da campanha, critérios e eventos em ordem cronológica | Aprovação documental e envio por e-mail ou WhatsApp |

O download contém somente o histórico da campanha selecionada, limitado ao espaço de trabalho do usuário autenticado. As exportações não incluem chaves de IA, tokens, configurações de conexão ou registros de outros clientes. Para evitar arquivos excessivos, o relatório é limitado a 500 eventos por solicitação.

### Evidência complementar

Os filtros por responsável e período, a serialização CSV em UTF-8, a assinatura PDF e o contrato protegido de exportação foram verificados por testes automatizados. No conjunto de dados usado para a revisão visual não havia campanha persistida; por isso, os controles de exportação não foram materializados nas capturas, sem prejuízo à validação dos formatos e da responsividade geral da página.

## Enviar o relatório PDF por e-mail

Na tela **Histórico de aprovações**, aplique os filtros de responsável, decisão e período que devem compor o documento. Depois, escolha **Enviar por e-mail**. A plataforma mostra o endereço de contato cadastrado para o cliente e exige uma segunda confirmação antes de transmitir qualquer informação para fora do sistema.

| Controle | Comportamento |
|---|---|
| Destinatário principal | É somente leitura e vem do e-mail de contato registrado no cliente da campanha |
| Destinatários adicionais | Só podem ser selecionados após cadastro explícito como contatos autorizados e ativos do mesmo cliente |
| PDF enviado | Reproduz exatamente os filtros ativos, com no máximo 500 eventos |
| Modelo de mensagem | Apresenta a campanha, o recorte aplicado, a quantidade de decisões e a assinatura VERTEX Consulting |
| Auditoria | Registra campanha, destinatário, filtros, volume, resultado e identificador do provedor; não guarda PDF, corpo da mensagem ou credenciais |
| Confirmação | O envio externo só ocorre após o clique em **Confirmar envio** no diálogo de confirmação |

O e-mail acompanha o PDF com a saudação ao contato cadastrado, um resumo dos critérios e a orientação para responder à equipe VERTEX Consulting caso seja necessário alinhar algum ponto. Nenhuma chave de IA é incluída no anexo ou na mensagem.

## Alertas de falha e contatos autorizados

Quando o provedor não confirma uma entrega, a área do histórico apresenta um **alerta visual** com a campanha, a data, os destinatários envolvidos e uma explicação segura. Mensagens brutas do provedor, conteúdo do relatório e credenciais permanecem fora da interface. A auditoria continua sendo a fonte dos alertas, portanto não existe duplicação de registros.

Para adicionar uma cópia autorizada, abra a configuração de envio da campanha, informe nome e e-mail do contato e mantenha o registro ativo. O destinatário principal cadastrado no cliente sempre recebe o relatório e não pode ser removido nesse fluxo. Antes de confirmar o despacho, selecione somente os adicionais que devem receber aquela cópia.

| Situação | Resultado |
|---|---|
| Contato adicional ativo e selecionado | Recebe o mesmo PDF filtrado junto ao contato principal |
| Contato inativo | Permanece no cadastro, mas não pode ser selecionado para envio |
| Contato removido | Deixa de aparecer na seleção; eventos anteriores continuam auditáveis |
| Falha no provedor | Exibe alerta seguro e mantém a tentativa na auditoria para nova análise |

> O envio é externo. Revise os destinatários apresentados no diálogo e confirme conscientemente antes de acionar o despacho.

## Validação desta evolução

Em 21 de agosto de 2026, a página Agência IA foi revisada nas larguras **1280 × 720** e **375 × 812**. O menu lateral compacto, a orquestração por cliente, o seletor de serviços e as áreas de revisão permaneceram legíveis nos dois formatos. Como a campanha de validação não possui versões aprováveis persistidas, os controles de histórico e confirmação não eram materializáveis na captura; sua lógica foi validada por testes de componente, contratos protegidos e gerador de e-mail isolado.

| Verificação | Resultado |
|---|---|
| Filtro de decisão e exportações | Aplicados na fonte auditável e propagados para PDF, CSV e e-mail |
| Modelo de e-mail e anexo | Testados com provedor simulado, sem disparar mensagem real |
| Proteção de destinatário | Coberta pelo contrato: contato principal obrigatório e adicionais ativos, selecionados e pertencentes ao mesmo cliente |
| Alerta e seleção de contato | Cobertos por contratos e teste de componente, sem e-mail externo na suíte |
| Suíte e build | 133 testes aprovados em 29 arquivos; build de produção concluído |

Em 22 de agosto de 2026, a revisão visual foi repetida em **1280 × 720** e **375 × 812**. A estrutura da Agência IA, os campos de contexto, o catálogo de serviços e a área de versões permaneceram legíveis e proporcionais. Não havia uma campanha persistida no conjunto de validação para materializar alertas e controles de destinatários nas capturas; esses estados foram validados por contratos e testes automatizados, mantendo a interface vazia sem dados artificiais.
