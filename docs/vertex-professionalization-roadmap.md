# Roteiro de profissionalização — VERTEX Consulting

## Objetivo

A VERTEX Consulting já reúne operação de agência, geração assistida por IA, credenciais por cliente e revisão humana. Para uso interno imediato e futura comercialização, a evolução recomendada é transformar a aplicação em uma plataforma **multiempresa, auditável e orientada a serviço**, sem perder o controle de publicação humana que já existe no produto.

## Arquitetura recomendada

| Camada | Papel recomendado | Decisão prática |
|---|---|---|
| Vercel | Aplicação React, páginas públicas, borda e entrega global | Manter como camada de experiência e domínio principal, incluindo o frontend do painel. |
| API da aplicação | Contratos tRPC, regras de negócio, autorização e dados operacionais | Definir uma única API canônica. Toda leitura e mutação deve passar por ela, sem acesso direto do navegador ao banco ou a provedores de IA. |
| Render | Adaptadores Python existentes, processamento longo e workers | Tratar o FastAPI atual como serviço interno de skills e processamento, não como uma segunda fonte de regras do produto. |
| Banco e arquivos | Fonte de verdade de dados e S3 para artefatos | Manter dados relacionais e referências de arquivos; nunca guardar mídia ou chaves em registros que chegam ao navegador. |
| Fila e observabilidade | Trabalhos de geração, retry, logs e alertas | Introduzir fila persistente e um worker no Render para tarefas demoradas, com execução idempotente e rastreável. |

> **Diretriz central:** Vercel é a experiência de produto; Render é o ambiente de processamento e skills. Os dois serviços devem se comunicar por contratos autenticados, versionados e observáveis.

## Melhorias prioritárias de produto

| Prioridade | Entrega | Benefício para a agência | Benefício para o SaaS |
|---|---|---|---|
| 1 | Organizações, workspaces e membros | Separação clara entre clientes e equipes | Base real de multitenancy B2B |
| 2 | Papéis e permissões granulares | Delegação segura de criação e aprovação | Planos por função e governança empresarial |
| 3 | Ledger de uso por geração | Controle de custo por cliente e campanha | Limites, franquias e cobrança por consumo |
| 4 | Fila de geração e retry | Menos falhas em vídeos, imagens e campanhas extensas | Confiabilidade para múltiplas empresas |
| 5 | Auditoria imutável | Rastreia credenciais, aprovações e publicações | Requisito de compradores corporativos |
| 6 | Integrações de publicação | Fluxos reais para Meta, Google e canais aprovados | Módulos adicionais comercializáveis |

## Segurança e governança

As chaves de provedores devem continuar cifradas no servidor. O painel pode exibir apenas um identificador mascarado; copiar esse identificador **não** equivale a revelar a chave. Na próxima etapa, a cifragem deve adotar rotação de chave, escopo por workspace e trilha de auditoria para criação, teste, alteração, desativação e uso de cada conexão.

Uma publicação externa deve exigir: versão aprovada, usuário responsável, destino identificado, confirmação explícita e registro do evento. Webhooks de plataformas devem ser assinados, idempotentes e tratados por worker, com tentativas limitadas e visíveis ao operador.

## Plano de execução em 90 dias

### Dias 1–30: consolidar a operação

Formalizar uma API única entre Vercel e Render, incluir health checks, logs estruturados, monitoramento de erros e backups testados. Evoluir os registros atuais para workspaces e memberships, preservando Globo Acabamentos como dado de referência. Criar um ambiente de homologação separado do ambiente de produção.

### Dias 31–60: tornar o produto escalável

Introduzir fila para gerações, armazenamento de artefatos com metadados, limites de uso, auditoria e permissões. Definir métricas de produto — campanhas criadas, taxa de aprovação, custo por geração e tempo até revisão — por workspace.

### Dias 61–90: preparar a venda

Criar onboarding guiado, página de planos, convite de membros, termos de uso, política de privacidade, contrato de processamento de dados e suporte. O primeiro piloto comercial deve usar um workspace isolado, plano limitado, métricas de adoção e revisão semanal do fluxo de valor.

## Critério de prontidão para comercialização

A VERTEX Consulting estará pronta para vender a primeira versão quando cada empresa tiver isolamento verificável, membros com papéis definidos, uso mensurado, exportação de auditoria, backups restauráveis, suporte a falhas de geração e um processo de cancelamento que preserve os dados pelo prazo contratado. Até lá, a recomendação é operar como **produto interno com pilotos controlados**, não como serviço aberto sem limites de consumo ou governança.

