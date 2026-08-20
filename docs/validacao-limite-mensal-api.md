# Validação de consumo e limite mensal de API

**Data da validação:** 20 de agosto de 2026.  
**Cliente preservado:** Globo Acabamentos, identificador `1`.  
**Ambiente:** painel autenticado da VERTEX Consulting.

Esta evidência foi coletada no próprio painel, com a sessão autenticada do usuário operacional. Os valores de validação foram temporários: o cliente começou sem limite, recebeu `120` chamadas, foi atualizado para `240` e retornou ao estado original sem limite configurado. Não houve alteração nas gerações, no consumo registrado ou nas credenciais do cliente.

## Transições executadas pela interface

| Etapa | Ação executada no painel | Estado renderizado após salvar | Captura verificável |
|---|---|---|---|
| Estado inicial | Abrir o painel de consumo | **Sem limite mensal configurado**; ação **Definir limite** | [Abrir captura](/manus-storage/vertex-limite-inicial_49e23f91.webp) |
| Criação | Informar `120` e selecionar **Salvar limite** | **0/120 chamadas no mês (0%)**; consumo dentro do limite | [Abrir captura](/manus-storage/vertex-limite-criado-120_bbd4f572.webp) |
| Atualização | Substituir por `240` e selecionar **Salvar limite** | **0/240 chamadas no mês (0%)**; consumo dentro do limite | [Abrir captura](/manus-storage/vertex-limite-atualizado-240_dd182c87.webp) |
| Remoção | Limpar o campo e selecionar **Remover limite** | **Sem limite mensal configurado**; ação retorna a **Definir limite** | [Abrir captura](/manus-storage/vertex-limite-removido_f731e849.webp) |

> As capturas mostram o formulário de **Globo Acabamentos**, o texto orientativo de faixa válida e a leitura atualizada depois de cada submissão. A última etapa restaura exatamente o estado operacional inicial.

## Filtros de período confirmados com dados reais

Os dados reais disponíveis para Globo Acabamentos ainda não possuem chamadas de IA. Ainda assim, os filtros foram acionados diretamente na interface, e cada leitura exibiu corretamente o período selecionado, com `0` chamadas, `0` gerações e telemetria indisponível.

| Período selecionado | Leitura mostrada pelo painel | Captura verificável |
|---|---|---|
| 7 dias | **0 chamadas em 7 dias** | [Abrir captura](/manus-storage/vertex-consumo-7-dias_e8166e24.webp) |
| 15 dias | **0 chamadas em 15 dias** | [Abrir captura](/manus-storage/vertex-consumo-15-dias_76f81774.webp) |
| 30 dias | **0 chamadas em 30 dias** | [Abrir captura](/manus-storage/vertex-consumo-30-dias_32bb996d.webp) |

## Cobertura automatizada complementar

Além da inspeção visual autenticada, a suíte automatizada confirma que `7`, `15` e `30` são encaminhados ao contrato `usageByClient`, a remoção recebe explicitamente o valor `null`, a orientação apresenta a faixa de `1` a `10.000.000` chamadas e o contador de teto mensal usa o primeiro dia do mês-calendário corrente mesmo quando o filtro de 30 dias alcança o mês anterior.
