# VERTEX Consulting — Plataforma SaaS para Agências

A **VERTEX Consulting** é uma plataforma operacional para agências de marketing que precisam organizar clientes, estratégia, criação, produção, atendimento, sucesso do cliente, governança e indicadores em uma única experiência. O produto foi estruturado para ser usado pela própria VERTEX e também por outras agências que possam contratar a solução no modelo SaaS.

O sistema combina gestão operacional, CRM, produção criativa, recursos de IA por cliente, WhatsApp, portal de aprovação e visão executiva. A interface segue uma jornada orientada por etapas, evitando que recursos diferentes sejam apresentados como se fossem uma única função.

> **Princípio central:** a agência começa entendendo o cenário, cadastra ou seleciona o cliente, planeja a demanda, cria os materiais, organiza a produção, atende o cliente e acompanha o sucesso da conta.

## Índice

1. [Visão do produto](#visão-do-produto)
2. [Fluxo principal da agência](#fluxo-principal-da-agência)
3. [Módulos da plataforma](#módulos-da-plataforma)
4. [Arquitetura do sistema](#arquitetura-do-sistema)
5. [Tecnologias](#tecnologias)
6. [Pré-requisitos](#pré-requisitos)
7. [Instalação local](#instalação-local)
8. [Configuração de ambiente](#configuração-de-ambiente)
9. [Banco de dados e migrações](#banco-de-dados-e-migrações)
10. [Execução e validação](#execução-e-validação)
11. [Segurança e isolamento SaaS](#segurança-e-isolamento-saas)
12. [IA por cliente](#ia-por-cliente)
13. [WhatsApp e atendimento](#whatsapp-e-atendimento)
14. [Exclusão integral de clientes](#exclusão-integral-de-clientes)
15. [Estrutura de pastas](#estrutura-de-pastas)
16. [Publicação e hospedagem](#publicação-e-hospedagem)
17. [Manutenção e diagnóstico](#manutenção-e-diagnóstico)
18. [Próximas evoluções recomendadas](#próximas-evoluções-recomendadas)
19. [Referências](#referências)

## Visão do produto

A plataforma atende dois níveis de operação. O primeiro é a **agência operadora**, que administra sua equipe, seus clientes, contratos, produção, integrações, cobrança e indicadores. O segundo é o **cliente atendido**, que pode receber acesso controlado ao portal para acompanhar materiais, aprovar entregas, consultar informações autorizadas e interagir com a equipe.

A navegação foi organizada para que cada etapa tenha uma responsabilidade clara:

| Etapa | Pergunta que responde | Resultado esperado |
|---|---|---|
| Painel | O que está acontecendo agora? | Cenário executivo, riscos e próxima ação |
| Clientes | Quem é o cliente e qual é a relação comercial? | Conta, contatos, oportunidades, contratos e preferências |
| Planejamento | O que deve ser feito e por quê? | Estratégia, pesquisa, calendário, mídia e decisões |
| Criação | Qual material precisa ser criado? | Briefing, IA, carrossel, anúncio, roteiro e revisão |
| Projetos | Como a entrega será organizada? | Escopo, responsáveis, prioridades e visão do projeto |
| Produção | O que está sendo executado? | Tarefas, agenda, prazos, aprovações internas e externas |
| Atendimento | Como a conversa e os canais estão funcionando? | WhatsApp, tickets, handoff e histórico de atendimento |
| Sucesso | A conta está saudável e evoluindo? | Saúde da conta, portal, aprovações e indicadores de relacionamento |
| Gestão | Como a plataforma está configurada? | Governança, permissões, integrações, IA, BI e operação SaaS |

## Fluxo principal da agência

### 1. Painel da agência

O painel inicial é a primeira página da plataforma. Ele mostra a leitura executiva da operação, projetos em curso, itens que pedem atenção, clientes preparados para IA e a próxima ação recomendada. O painel não substitui os módulos; ele funciona como uma camada de orientação para decidir onde entrar em seguida.

### 2. Cadastro e qualificação do cliente

A equipe cadastra o cliente, registra dados comerciais e inicia a relação. O cadastro é a base de isolamento de dados: recursos de IA, ativos de marca, projetos, contratos, atendimento e indicadores devem ser associados ao cliente correto.

### 3. Planejamento

A agência registra objetivos, público, posicionamento, pesquisa, decisões estratégicas, calendário editorial e planos de mídia. A pesquisa externa é orientada por comando humano e deve ser revisada antes de virar uma decisão de campanha.

### 4. Criação

A equipe escolhe o cliente e o tipo de serviço. O sistema apresenta os campos de briefing correspondentes e permite iniciar uma criação de anúncio, carrossel, roteiro ou outro material. A IA pode operar com uma credencial da própria agência, com uma credencial do cliente ou com outro provedor autorizado.

### 5. Projetos e produção

As ideias e entregas são organizadas em projetos, tarefas, responsáveis, prioridades, calendário e etapas de revisão. A produção separa o que precisa ser feito do material que está sendo criado, evitando misturar briefing, execução e acompanhamento.

### 6. Atendimento e sucesso

O atendimento reúne canais, conversas, tickets, handoff humano e políticas de automação. O módulo de sucesso acompanha a saúde da conta, acessos, aprovações e informações relevantes para retenção e expansão.

## Módulos da plataforma

### Clientes & comercial

Centraliza clientes, oportunidades, propostas, contratos, lançamentos financeiros, rentabilidade e margem. Os valores exibidos são derivados dos registros presentes no sistema; a plataforma não deve inventar faturamento, avaliações, depoimentos ou métricas.

### Planejamento e inteligência

Organiza estratégias, pesquisas sob demanda, sinais de tendência, decisões, calendário editorial e mídia paga. O material coletado externamente deve manter fonte, contexto e revisão humana.

### Criação e Agência IA

Permite configurar conexões de IA por cliente, selecionar provedor e modelo, validar a conexão antes de salvar e criar materiais a partir de um briefing estruturado. A interface suporta presets NVIDIA e identificador de modelo personalizado.

### Projetos

Mantém escopo, responsáveis, prioridades, visão de entrega e relacionamento entre projetos e clientes. Projetos são a unidade de organização de uma demanda contratada.

### Produção

Exibe tarefas, agenda, responsáveis, status, aprovação interna e dependências de execução. A produção deve refletir o trabalho real da equipe, não ser usada como área genérica para qualquer configuração.

### Atendimento e WhatsApp

Organiza canais, contatos, conversas, mensagens, automações, políticas de IA, handoff e auditoria. O envio externo deve permanecer desligado até que as credenciais, consentimentos, templates e políticas estejam configurados.

### Sucesso do cliente e portal

Oferece uma visão de saúde da conta e um espaço controlado para o cliente consultar entregas e aprovar materiais. O acesso externo deve ser limitado por token, permissão, expiração e escopo.

### Governança e BI

Reúne permissões, consentimentos, retenção, direitos de uso de ativos, capacidade operacional, saúde de integrações e indicadores executivos. Métricas sem base de dados devem aparecer como indisponíveis, não como zero fabricado.

### Gestão da conta

Concentra configurações que não pertencem a uma etapa específica da produção, como integrações, planos, usuários, credenciais, notificações, BI e governança. Essa separação reduz a sobreposição entre funções operacionais.

## Arquitetura do sistema

A aplicação é um monorepo TypeScript com frontend React, API tRPC, servidor Express e persistência MySQL/TiDB via Drizzle ORM.

```text
Navegador
   │
   ├── React 19 + Vite + Tailwind CSS
   │       └── páginas, componentes, navegação e estados da interface
   │
   └── tRPC client
           │
           ▼
      Express + tRPC
           │
           ├── autenticação Manus OAuth
           ├── routers protegidos por sessão
           ├── regras de isolamento por owner/workspace
           ├── validação de IA e integrações
           └── serviços de e-mail, Stripe, WhatsApp e armazenamento
                   │
                   ├── Drizzle ORM → MySQL/TiDB
                   └── Storage → objetos e referências de arquivos
```

O frontend não deve acessar o banco diretamente. As operações devem passar pelos contratos tRPC. O servidor é responsável por autenticação, autorização, validação, criptografia e chamadas a serviços externos.

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Interface | React 19, TypeScript, Vite |
| Estilo | Tailwind CSS 4, CSS modular e componentes reutilizáveis |
| Navegação | Wouter |
| API | Express 4 e tRPC 11 |
| Dados | Drizzle ORM e MySQL/TiDB |
| Autenticação | Manus OAuth e sessão protegida |
| Validação | Zod |
| Testes | Vitest |
| Build | Vite e esbuild |
| Arquivos | Storage compatível com o ambiente Manus |
| Pagamentos | Stripe em sandbox, quando configurado |
| E-mail | Resend, quando configurado |
| IA | Provedores externos por cliente e integrações nativas disponíveis |

## Pré-requisitos

Para desenvolvimento local, instale:

- Node.js compatível com o projeto;
- pnpm 10 ou versão compatível;
- uma instância MySQL/TiDB acessível;
- credenciais do ambiente Manus para autenticação e serviços internos;
- credenciais externas apenas quando o recurso correspondente for utilizado.

O projeto declara `pnpm` como gerenciador de pacotes. Evite misturar `npm`, `yarn` e `pnpm` no mesmo ambiente para não gerar locks concorrentes.

## Instalação local

Clone o repositório privado e entre na pasta:

```bash
git clone https://github.com/Alves1986/vertex-agencia.git
cd vertex-agencia
```

Instale as dependências:

```bash
pnpm install
```

Crie o arquivo de ambiente local a partir do padrão da sua infraestrutura. Nunca copie valores reais para o README ou para o Git:

```bash
cp .env.example .env
```

Caso `.env.example` ainda não exista no ambiente de desenvolvimento, crie o `.env` manualmente com base na seção de variáveis abaixo e mantenha-o fora do versionamento.

Execute as migrações conforme o procedimento do ambiente e inicie o servidor:

```bash
pnpm check
pnpm dev
```

A aplicação será servida pela porta definida pelo ambiente. Não fixe a porta em código de produção.

## Configuração de ambiente

Os nomes abaixo representam as variáveis utilizadas pelo projeto. Os valores devem ser configurados no ambiente de desenvolvimento ou no provedor de hospedagem, nunca no código-fonte.

| Variável | Obrigatória | Uso |
|---|---:|---|
| `DATABASE_URL` | Sim | Conexão MySQL/TiDB |
| `JWT_SECRET` | Sim | Assinatura da sessão |
| `VITE_APP_ID` | Sim | Identificação da aplicação OAuth |
| `OAUTH_SERVER_URL` | Sim | Servidor OAuth |
| `VITE_OAUTH_PORTAL_URL` | Sim | Portal de login no frontend |
| `OWNER_OPEN_ID` | Sim | Identificação do proprietário inicial |
| `OWNER_NAME` | Sim | Nome do proprietário inicial |
| `BUILT_IN_FORGE_API_URL` | Conforme recurso | API interna para LLM, storage, notificações e dados |
| `BUILT_IN_FORGE_API_KEY` | Conforme recurso | Chave server-side dos serviços internos |
| `VITE_FRONTEND_FORGE_API_URL` | Conforme recurso | Endpoint público permitido para recursos frontend |
| `VITE_FRONTEND_FORGE_API_KEY` | Conforme recurso | Chave pública limitada para o frontend |
| `VITE_APP_TITLE` | Opcional | Título da aplicação |
| `VITE_APP_LOGO` | Opcional | Logo da aplicação |
| `REPORTS_FROM_EMAIL` | Relatórios | Remetente dos relatórios |
| `RESEND_API_KEY` | Relatórios | Envio de e-mail por Resend |
| `STRIPE_SECRET_KEY` | Stripe | Operações server-side do Stripe |
| `STRIPE_WEBHOOK_SECRET` | Stripe | Validação de webhooks |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe | Chave pública do Stripe |
| `WHATSAPP_META_APP_SECRET` | WhatsApp Meta | Validação do canal Meta |
| `WHATSAPP_OUTBOUND_ENABLED` | WhatsApp | Controle explícito de envio externo |
| `PORT` | Não | Porta fornecida pelo ambiente |

As chaves de provedores de IA dos clientes não devem ser colocadas nessas variáveis globais. Elas são inseridas no fluxo autenticado do cliente, validadas server-to-server e persistidas cifradas.

## Banco de dados e migrações

O esquema está em `drizzle/schema.ts`. As migrações ficam em `drizzle/*.sql`. O procedimento recomendado é:

```bash
pnpm drizzle-kit generate
```

Depois de gerar, revise o SQL produzido e aplique-o pela ferramenta de migração aprovada pelo ambiente. Em mudanças destrutivas, confirme dependências, índices, chaves estrangeiras e possibilidade de recuperação antes de executar.

As últimas migrações da exclusão integral de clientes ajustam as relações de projetos, eventos, propostas e leads convertidos para `ON DELETE CASCADE`. A aplicação também remove referências de preferências do usuário que não devem continuar apontando para uma conta apagada.

Não execute comandos destrutivos diretamente contra produção sem revisar a migração. Não utilize `DROP TABLE`, `TRUNCATE` ou alterações de coluna sem plano de recuperação.

## Execução e validação

Os comandos principais são:

```bash
# Verificação de tipos
pnpm check

# Suíte de testes
pnpm test

# Build de produção
pnpm build

# Desenvolvimento com servidor e Vite
pnpm dev
```

A suíte cobre contratos de roteadores, componentes de interface, geração de IA, WhatsApp, Stripe, exportações, histórico de aprovações, exclusão de clientes e regras de negócio. Testes que dependem de serviços externos podem precisar de credenciais ou isolamento controlado.

Antes de enviar uma alteração para produção, valide a combinação abaixo:

| Verificação | Objetivo |
|---|---|
| `pnpm check` | Detectar erros TypeScript |
| `pnpm test` | Verificar regras e regressões |
| `pnpm build` | Confirmar que frontend e servidor compilam |
| Revisão visual | Conferir desktop, mobile, estados vazios e erros |
| Revisão de segurança | Confirmar que logs e respostas não expõem segredos |
| Revisão de migração | Confirmar que schema e banco estão alinhados |

## Segurança e isolamento SaaS

Cada operação protegida deve validar a sessão do usuário e o escopo do proprietário ou workspace. O frontend pode ocultar ações, mas a autorização real deve existir no servidor.

As regras principais são:

1. Não retornar chaves de API em texto puro.
2. Exibir apenas máscaras e, quando necessário, uma dica final não sensível.
3. Nunca mostrar payload bruto de erro de provedor externo.
4. Validar a posse do cliente antes de consultar ou alterar qualquer dado.
5. Isolar clientes, projetos, conversas, ativos e relatórios por workspace.
6. Exigir confirmação humana antes de publicações, envios externos ou aprovações críticas.
7. Registrar auditoria sanitizada, sem tokens, anexos privados ou conteúdo sensível desnecessário.
8. Usar armazenamento de arquivos como referência externa, mantendo metadados e autorização no banco.
9. Manter `.env`, chaves, certificados e dumps fora do Git.
10. Tratar dados de clientes conforme políticas internas de retenção, consentimento e direitos de uso.

## IA por cliente

O fluxo de configuração de IA está associado a um cliente específico. O operador escolhe o provedor, informa o modelo textual, opcionalmente informa um modelo de imagem, adiciona a chave e executa o teste de conexão.

O teste deve ser concluído antes de salvar uma credencial externa. O modelo textual faz parte da identidade da configuração validada; se ele mudar, um novo teste deve ser exigido. O modelo de imagem opcional não invalida uma conexão textual já testada quando não altera o caminho de resposta textual.

A plataforma suporta provedores compatíveis com suas configurações atuais, incluindo NVIDIA NIM. Para NVIDIA, a interface oferece presets recomendados e modelo personalizado. Presets são conveniências de configuração e não representam garantia de disponibilidade, limite, região ou entitlement da conta NVIDIA.

Referências oficiais da NVIDIA:

- [NVIDIA NIM API Reference](https://docs.nvidia.com/nim/large-language-models/latest/api-reference.html)
- [NVIDIA Build — catálogo de modelos](https://build.nvidia.com/models)
- [NVIDIA Build](https://build.nvidia.com/)

## WhatsApp e atendimento

O WhatsApp deve ser ativado como uma integração controlada, não como um envio automático irrestrito. Antes de habilitar tráfego externo, configure credenciais, canal, consentimento, janela de atendimento, políticas de IA, templates aprovados e handoff humano.

O fluxo recomendado é:

1. cadastrar o cliente e o canal;
2. validar credenciais e webhook;
3. configurar políticas de automação;
4. definir quando a IA pode responder;
5. exigir transferência para humano nos casos previstos;
6. testar em sandbox;
7. habilitar envio externo de forma explícita;
8. acompanhar entrega, falhas, tempo de resposta e auditoria.

O sistema deve permanecer em modo seguro quando o canal não estiver validado. Não habilite envio real apenas porque a interface foi preenchida.

## Exclusão integral de clientes

A ação de exclusão está disponível em **Clientes & comercial**. Ela exige seleção do cliente, visualização do impacto e digitação do nome exato antes de liberar a operação.

Ao excluir a conta, o banco remove em cascata os registros vinculados, incluindo projetos, tarefas, campanhas, aprovações, conexões de IA, ativos, direitos, briefings, produção, mídia, pesquisas, relatórios, contratos, financeiro, consentimentos, suporte, portal, canais e históricos relacionados.

A exclusão é permanente. Antes de executar em produção, a operação recomendada é exportar os dados permitidos, confirmar o escopo e registrar a autorização administrativa. Um futuro recurso de arquivamento ou backup pré-exclusão pode ser adicionado caso a operação comercial exija retenção temporária.

## Estrutura de pastas

```text
client/
  src/
    components/       Componentes reutilizáveis e shell da aplicação
    lib/              Contratos e utilitários compartilhados do frontend
    pages/            Módulos de negócio e telas da plataforma
    contexts/         Contextos de tema e estado global
    index.css         Tokens e estilos globais

server/
  _core/              Infraestrutura de autenticação, runtime e serviços Manus
  aiAds/              Testes e geração de conteúdo por IA
  email/              Relatórios e mensagens transacionais
  routers/            Contratos tRPC por domínio
  whatsapp/           Regras de canais, automação e entrega
  db.ts               Helpers e operações de persistência
  storage.ts          Integração de arquivos

drizzle/
  schema.ts           Modelo de dados
  *.sql               Migrações versionadas

docs/
  *.md                Documentação operacional e decisões do produto

scripts/
  *.mts               Scripts de validação e operação controlada

api/
  *.ts                Entradas de API compatíveis com o ambiente de hospedagem
```

## Publicação e hospedagem

O repositório oficial privado é [Alves1986/vertex-agencia](https://github.com/Alves1986/vertex-agencia). O branch principal é `main`.

Para publicar uma alteração:

```bash
git status
git diff --stat
pnpm check
pnpm test
pnpm build
git add .
git commit -m "tipo: descreva a alteração"
git push origin main
```

Configure secrets na hospedagem, não no repositório. O build requer que as variáveis obrigatórias estejam disponíveis no ambiente correspondente. Em caso de uso de Vercel, Render ou outro provedor externo, confira a compatibilidade do servidor Express, das rotas tRPC, dos webhooks e do armazenamento.

A hospedagem gerenciada da plataforma Manus pode ser usada quando o projeto estiver operando dentro do fluxo WebDev. Em qualquer provedor, mantenha domínio, OAuth callback, webhooks e variáveis de ambiente alinhados entre preview e produção.

## Manutenção e diagnóstico

Quando houver erro de runtime, revise primeiro os logs do servidor, console do navegador, requisições de rede e reprodução da sessão. Em seguida, confirme se o problema é de autenticação, banco, integração externa, tipagem ou renderização.

Checklist prático:

| Sintoma | Primeira verificação |
|---|---|
| Página vazia | Console do navegador e rota registrada |
| Login falhando | URL OAuth, cookie de sessão e callback |
| Dados de outro cliente | Escopo server-side e filtro por owner/workspace |
| Chave de IA não salva | Teste de conexão, modelo textual e token de verificação |
| WhatsApp sem envio | Canal, webhook, consentimento e flag de envio externo |
| E-mail falhando | `RESEND_API_KEY`, remetente e disponibilidade da rede |
| Indicador zerado | Existência de registros confirmados e período selecionado |
| Migração falhando | SQL gerado, nome das constraints e estado real do banco |
| Build lento | Tamanho de chunks e possibilidade de code splitting |

Nunca corrija um erro de integração exibindo a resposta bruta do provedor ao usuário. Prefira diagnóstico sanitizado, código interno de erro e orientação acionável.

## Próximas evoluções recomendadas

Para transformar a plataforma em um produto SaaS comercial mais maduro, as próximas evoluções prioritárias são:

1. **Onboarding guiado por agência**, com criação do workspace, equipe, plano, primeiro cliente e primeira entrega.
2. **RBAC completo**, separando proprietário, administrador, operador, financeiro, atendimento, cliente e aprovador externo.
3. **Assinaturas SaaS**, com limites por plano, cobrança recorrente, período de teste e controle de uso.
4. **Backup e arquivamento**, permitindo exportação protegida antes da exclusão definitiva.
5. **Observabilidade**, com métricas de latência, erro por integração, consumo por modelo e saúde dos webhooks.
6. **Code splitting e otimização de bundle**, reduzindo o tamanho inicial do frontend.
7. **Política formal de privacidade e retenção**, alinhada ao uso de dados de clientes, contatos, conversas e ativos.

## Referências

- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vite.dev/guide/)
- [tRPC Documentation](https://trpc.io/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [Vitest Documentation](https://vitest.dev/guide/)
- [Stripe Documentation](https://docs.stripe.com/)
- [Resend Documentation](https://resend.com/docs)
- [NVIDIA NIM API Reference](https://docs.nvidia.com/nim/large-language-models/latest/api-reference.html)

## Licença e uso

Este repositório é privado e destinado ao uso da VERTEX Consulting e de organizações autorizadas. Defina a licença comercial, regras de contribuição, política de suporte e condições de revenda antes de abrir o código ou distribuir a plataforma para terceiros.

---

**VERTEX Consulting — operação de agência com clareza, governança e escala.**
