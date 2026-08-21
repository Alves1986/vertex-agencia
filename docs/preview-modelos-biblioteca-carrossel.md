# Prévia, Modelos e Biblioteca de Marca para Carrosséis

## Finalidade

A jornada de carrossel da **Agência IA** agora possui uma camada de preparação entre o briefing e a geração final. A equipe pode reutilizar um modelo por cliente, selecionar referências visuais autorizadas e editar uma prévia de três a dez slides. A geração continua interna e sujeita à revisão humana.

> A prévia não publica conteúdo externo. Ela cria uma versão de trabalho vinculada à campanha, que pode ser revisada antes de acionar o motor de criação.

| Recurso | Escopo de dados | Proteção aplicada |
|---|---|---|
| Modelo de briefing | Cliente e workspace selecionados | Consultas e mutações validam a propriedade do cliente. |
| Ativo de marca | Cliente e workspace selecionados | O arquivo é armazenado fora do banco; a aplicação persiste somente URL, metadados e estado de autorização. |
| Prévia editável | Campanha do cliente selecionado | A prévia é salva como versão de carrossel e mantém o fluxo de revisão humana. |

## Fluxo operacional

Na página **Agência IA**, selecione o cliente e o serviço **Carrossel**. O assistente mostra campos de mensagem central, leitor prioritário, quantidade de slides, formato, direção visual e CTA. A quantidade aceita de três a dez slides; depois do preenchimento, use **Preparar prévia de slides** para materializar os cartões editáveis.

Cada slide pode ter número, papel editorial, título, texto de apoio, direção visual e orientação de imagem ajustados. Ao iniciar a criação, a VERTEX salva essa composição como uma versão revisável e a transfere para a geração de carrossel. As referências de marca selecionadas acompanham o briefing estruturado como contexto autorizado.

## Modelos de briefing por cliente

Use o campo de nome de modelo depois de preencher os campos do carrossel e selecione **Salvar modelo**. O sistema guarda os dados estruturados no cliente atual, sem copiar as informações para outros clientes. Para reutilizar um modelo, selecione **Carregar** na biblioteca; a interface muda para o serviço Carrossel, preenche os campos e limpa a prévia anterior para evitar mistura de contextos.

| Ação | Resultado esperado |
|---|---|
| Salvar modelo | Persiste nome, descrição opcional e campos estruturados no cliente atual. |
| Carregar modelo | Preenche o briefing de Carrossel e solicita revisão antes da prévia. |
| Remover modelo | Exclui somente o modelo pertencente ao cliente selecionado. |

## Biblioteca de referências visuais

Na seção **Biblioteca de marca**, envie imagens PNG, JPG, WebP ou GIF de até 5 MB. O ativo nasce como autorizado pela operação da agência e pode ser marcado como arquivado quando não deve mais compor novos briefings. Somente os ativos com estado **Autorizado** podem ser selecionados para o carrossel.

Antes de usar uma referência, confirme que a marca possui direito de uso e que o arquivo corresponde à versão visual aprovada. A tela mostra nome, tipo e estado; a URL de armazenamento não precisa ser digitada no briefing pelo operador.

## Validação registrada

Os testes de contrato cobrem a persistência da prévia, os modelos por cliente, o upload de referência e a transmissão do contexto autorizado. A suíte do projeto concluiu com **116 testes aprovados**. O build de produção também foi concluído com sucesso. A revisão visual em desktop confirmou a sequência do assistente, o seletor explícito de cliente, a capacidade ativa e a legibilidade da jornada de criação. Em tela móvel, os cartões de serviço, campos de briefing e ações de criação permanecem empilhados, legíveis e operáveis sem corte horizontal.
