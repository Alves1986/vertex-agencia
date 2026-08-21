# Validação visual do Atendimento SaaS

**Data:** 21 de agosto de 2026.  
**Ambiente:** painel autenticado VERTEX Consulting.  
**Cliente selecionado:** Globo Acabamentos.

| Área verificada | Estado observado | Resultado |
|---|---|---|
| Seleção multicliente | O seletor exibiu Globo Acabamentos e os cartões usaram os dados desse contexto. | Confirmado |
| Canais | Nenhum canal ativo; criação disponível em modo de configuração para Meta Cloud ou BSP Twilio. | Confirmado |
| IA VERTEX | A política exibiu limite de 500 mensagens e calculadora interna com custo, markup, excedente e projeção. | Confirmado |
| Simulação | Para 1.000 mensagens projetadas, o painel mostrou 500 de excedente, receita de R$ 2,16 e margem de R$ 0,96. | Confirmado |
| Caixa de entrada | Exibiu estado vazio isolado por cliente e indicou que o envio externo permanece desativado. | Confirmado |
| Automações | Exibiu regra inicial como rascunho e aviso de aprovação humana. | Confirmado |
| Portal do cliente sem associação | A rota `/meu-atendimento` exibiu somente a orientação de acesso não liberado, sem canais, conversas, consumo, margem ou credenciais. | Confirmado |

> A calculadora é destinada à equipe da agência. Os contratos do servidor rejeitam essa área para perfis não administrativos; nenhum custo-base, markup, credencial ou payload de provedor é retornado ao cliente.

> A inspeção autenticada com a conta administrativa, que não possui associação ativa como cliente, também confirmou o comportamento de negação segura do portal. A tela informa o próximo passo de associação pela VERTEX em vez de assumir acesso a algum cliente.
