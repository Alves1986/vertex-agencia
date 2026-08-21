# Fluxo Guiado de Criação — Agência IA

## Objetivo

O assistente de serviço da página **Agência IA** transforma a criação de marketing em uma sequência previsível: selecionar o cliente cadastrado, escolher a entrega, preencher somente as perguntas relevantes e iniciar uma criação interna que permanece sujeita à revisão humana.

> O fluxo cria briefing, campanha e versões de material no ambiente VERTEX. Ele **não publica** em redes sociais, contas de anúncio, WhatsApp ou qualquer canal externo.

## Sequência de uso

| Etapa | Ação da equipe | Resultado no sistema |
|---|---|---|
| 1. Escolher cliente | Selecione o cliente no topo da página Agência IA. | Perfil de marca, conexões e campanhas ficam restritos ao cliente selecionado. |
| 2. Escolher serviço | Selecione uma das seis entregas no assistente. | A capacidade correspondente é exibida e suas perguntas aparecem. |
| 3. Contextualizar | Preencha nome, objetivo, motor de IA e os campos obrigatórios do serviço. | O briefing estruturado inclui apenas dados fornecidos e sinaliza lacunas de fonte. |
| 4. Criar | Use **Salvar briefing** ou **Iniciar criação**. | O primeiro mantém o material como rascunho; o segundo chama o motor escolhido e abre a revisão. |
| 5. Revisar | Analise versões na fila de revisão humana. | Ajustes, rejeição e liberação ficam registrados; liberação não faz publicação externa. |

## Serviços e perguntas condicionais

| Serviço | Capacidade ativada | Campos principais |
|---|---|---|
| Campanha integrada | Orquestração de campanha | Oferta, público, mensagem central, canais e ação esperada. |
| Anúncios | Redação de performance | Oferta, público, canal de mídia, provas aprovadas e CTA. |
| Carrossel | Narrativa para carrossel | Ideia central, leitor, 3 a 10 slides, formato e proporção, direção visual e CTA. |
| Roteiro de vídeo | Roteiro audiovisual | Gancho, tema ou oferta, duração, formato e cenas ou restrições. |
| Estratégia | Planejamento estratégico | Desafio de negócio, público, contexto de mercado e evidências. |
| Conselho IA | Conselho de decisão | Decisão, opções em análise, riscos e evidências disponíveis. |

## Proteções do fluxo

O serviço escolhido é persistido junto ao briefing como `generationMode` e `serviceKey`. Por isso, uma campanha de roteiro, estratégia ou conselho continua utilizando a capacidade original quando a equipe a retoma pela fila de criação. Campanhas antigas, sem esse metadado, usam de modo seguro o modo já salvo na própria campanha.

Se a equipe escolher uma conexão externa, o sistema usa somente conexões ativas do cliente selecionado. Uma conexão desativada impede a geração; a equipe pode reativá-la ou trocar o provedor sem perder briefing, versões ou aprovações. O motor Manus integrado permanece disponível quando nenhum provedor externo foi escolhido.

## Jornada específica de carrossel

O painel mostra o cliente associado diretamente no assistente, além do seletor principal da página. Ao clicar em **Carrossel**, a capacidade passa a ser identificada como **Narrativa para carrossel** e aparece um formulário condicional. Os seis campos são obrigatórios: ideia central, leitor prioritário, quantidade de slides, formato e proporção, direção visual e ação final. A quantidade aceita somente números inteiros entre três e dez; assim, a estrutura solicitada não fica ambígua para o motor de criação.

Ao selecionar **Iniciar criação**, o sistema monta um briefing que persiste `serviceKey = carousel` e `generationMode = carousel` junto ao `clientId`, projeto, objetivo e conexão de IA escolhida. O servidor usa esse modo para montar o prompt de carrossel e gravar slides como versões revisáveis. A interface deixa explícito que a criação permanece interna e não aciona publicação externa.

## Evidências de validação

O fluxo é validado por testes de contrato e interface: catálogo dos seis serviços, perguntas próprias por entrega, montagem do briefing estruturado, persistência do modo guiado e compatibilidade com campanhas anteriores. A cobertura específica de carrossel valida campos obrigatórios, intervalo de slides, payload com cliente e conexão, modo `carousel`, criação de slides e versão sujeita à revisão. A revisão visual desktop confirmou a sequência de três passos, a seleção visível do cliente, os cartões de serviço e as ações de salvar ou iniciar criação.
