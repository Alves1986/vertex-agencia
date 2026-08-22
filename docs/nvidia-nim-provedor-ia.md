# NVIDIA NIM no motor de IA VERTEX

## Decisão de integração

A NVIDIA NIM será tratada como um provedor compatível com a interface de chat da OpenAI. A VERTEX usará o endpoint padrão em nuvem `https://integrate.api.nvidia.com/v1` quando o cliente não informar uma URL própria. A chave continua sendo enviada somente do servidor para a validação e é cifrada antes da persistência.

## Seleção de modelos

O card apresentará uma seleção de modelos recomendados da NVIDIA para resposta textual e permitirá informar um identificador personalizado. A seleção não promete disponibilidade: a disponibilidade real depende da conta, chave, região e catálogo contratados pelo cliente. A validação continua testando a URL, a chave e o acesso do provedor antes do salvamento.

Os presets iniciais são `meta/llama-3.3-70b-instruct` (recomendado por padrão), `nvidia/llama-3.1-nemotron-70b-instruct` e `qwen/qwen3-235b-a22b`. A opção **Informar identificador personalizado** preserva qualquer nome de modelo habilitado na conta do cliente. Alterar o modelo textual exige testar novamente a chave; alterar somente o modelo de imagem opcional não invalida uma validação já aprovada.

> O catálogo da NVIDIA é dinâmico. Presets no card facilitam o início da configuração; a opção personalizada atende modelos recém-lançados ou habilitados especificamente no catálogo do cliente.

## Referências oficiais

- [NVIDIA NIM API Reference — LLM](https://docs.nvidia.com/nim/large-language-models/latest/api-reference.html)
- [NVIDIA Build — catálogo de modelos](https://build.nvidia.com/models)
- [NVIDIA Build — início de uso](https://build.nvidia.com/)
