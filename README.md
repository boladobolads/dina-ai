# DINA — Inteligência Artificial Pessoal

A DINA é uma assistente de IA pessoal, acessível pelo navegador e adaptável a computador e celular. O projeto usa uma arquitetura híbrida para alternar entre provedores de modelos sem prender a aplicação a uma única empresa.

## Arquitetura de motores

- **Gemini API:** motor em nuvem com modalidade gratuita sujeita a cotas, disponibilidade regional e termos do Google.
- **Ollama:** execução de modelos abertos em uma máquina controlada pelo usuário; não há cobrança por token do provedor, mas há custo de hardware e energia.
- **OpenAI API:** motor adicional opcional, cobrado conforme o uso e o modelo.
- **Automático:** tenta os provedores configurados na ordem definida em `DINA_PROVIDER_ORDER`; se um falhar, tenta o próximo.
- O seletor no topo permite escolher Automático ou um motor específico. O chat informa qual motor respondeu.

O backend mantém as chaves e URLs no servidor. O navegador envia somente a escolha do motor, nunca credenciais dos provedores.

## Variáveis do Cloudflare Pages

Configure em Settings → Variables and Secrets. Cadastre chaves e códigos como **Secrets**, não como variáveis públicas.

| Nome | Tipo | Obrigatória | Finalidade |
|---|---|---|---|
| `DINA_ACCESS_CODE` | Secret | Sim | Código privado de acesso provisório |
| `DINA_PROVIDER_ORDER` | Variable | Não | Ordem de fallback. Padrão: `gemini,ollama,openai` |
| `GEMINI_API_KEY` | Secret | Para Gemini | Chave criada no Google AI Studio |
| `GEMINI_MODEL` | Variable | Para Gemini | Modelo principal, por exemplo `gemini-3.8-flash` |
| `GEMINI_FALLBACK_MODEL` | Variable | Não | Modelo alternativo em caso de sobrecarga; padrão: `gemini-3.5-flash-lite` |
| `OLLAMA_BASE_URL` | Variable | Para Ollama | URL base do serviço Ollama, sem barra final |
| `OLLAMA_MODEL` | Variable | Para Ollama | Nome do modelo baixado no Ollama, por exemplo `llama3.2` |
| `OPENAI_API_KEY` | Secret | Para OpenAI | Chave secreta da API OpenAI |
| `OPENAI_MODEL` | Variable | Para OpenAI | Identificador de um modelo habilitado no projeto |
| `ENABLE_WEB_SEARCH` | Variable | Não | Defina `true` para habilitar a ferramenta de pesquisa da OpenAI |

Você pode começar somente com Gemini: configure `DINA_ACCESS_CODE`, `GEMINI_API_KEY` e `GEMINI_MODEL`. Não é necessário configurar OpenAI para a DINA responder. O backend repete automaticamente falhas temporárias (como HTTP 429/503) e tenta o modelo alternativo `GEMINI_FALLBACK_MODEL`; por padrão, usa `gemini-3.5-flash-lite`.

### Como configurar o Gemini

1. Abra [Google AI Studio](https://aistudio.google.com/).
2. Crie uma API key.
3. No Cloudflare Pages, salve a chave em `GEMINI_API_KEY` como Secret.
4. Informe em `GEMINI_MODEL` um identificador de modelo que esteja habilitado para sua chave e região.

O nível gratuito tem limites de uso, que podem mudar. Consulte as condições e cotas atuais no AI Studio antes de depender dele em produção.

### Como configurar o Ollama

1. Instale o [Ollama](https://ollama.com/download) no computador que executará os modelos.
2. Baixe um modelo adequado à memória e capacidade da máquina, por exemplo com `ollama pull llama3.2`.
3. Teste localmente com `ollama run llama3.2`.
4. Configure `OLLAMA_MODEL` com o nome exato do modelo.
5. Configure `OLLAMA_BASE_URL` com o endereço do serviço acessível pelo backend.

**Importante sobre hospedagem:** uma função hospedada no Cloudflare não consegue acessar o `localhost` do computador do usuário. Para usar Ollama com a DINA publicada, será necessário disponibilizar a máquina por uma conexão privada segura, VPN ou túnel autenticado, e usar essa URL em `OLLAMA_BASE_URL`. Não exponha a porta 11434 diretamente à internet sem autenticação e controles de acesso. Em desenvolvimento local, o endereço pode ser `http://127.0.0.1:11434`.

### Ordem dos motores

A ordem padrão é:

```text
gemini,ollama,openai
```

Altere `DINA_PROVIDER_ORDER` para mudar a prioridade. O modo Automático tenta somente os provedores que estiverem configurados. Se escolher um provedor específico, a DINA não fará fallback para outro.

## Publicação no Cloudflare Pages

Conecte este repositório ao Cloudflare Pages. Use a raiz do projeto como diretório de saída; não é necessária etapa de build para esta versão estática com Pages Functions. As funções em `functions/api` serão publicadas como endpoints.

Depois de adicionar ou alterar variáveis, faça um novo deploy.

## Desenvolvimento local

Com Wrangler instalado, execute:

```bash
npx wrangler pages dev .
```

Crie um arquivo local `.dev.vars` (não versionar) com as variáveis que deseja testar. Exemplo:

```text
DINA_ACCESS_CODE=seu-codigo-local
GEMINI_API_KEY=sua-chave
GEMINI_MODEL=gemini-3.8-flash
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2
DINA_PROVIDER_ORDER=gemini,ollama
```

Nunca coloque o conteúdo de `.dev.vars` no GitHub.

## Segurança e limitações atuais

- O código compartilhado é uma proteção provisória, não autenticação individual.
- O endpoint Ollama não deve ser exposto publicamente sem túnel privado/autenticado.
- Implemente autenticação individual, autorização por usuário, rate limiting, limites de custo e monitoramento antes de abrir o serviço ao público.
- O histórico permanece somente na sessão atual; ainda não há memória persistente.
- O fallback automático depende de cada provedor estar configurado e acessível.
- O modo gratuito do Gemini está sujeito a cotas e alterações de política.

## Próximas etapas

1. Testar cada motor com credenciais próprias, sem publicar segredos.
2. Criar uma conexão segura e documentada para Ollama remoto.
3. Adicionar autenticação individual e banco de dados.
4. Construir memória configurável e histórico persistente.
5. Adicionar upload e análise de arquivos.
6. Criar espaço de projetos e ferramentas de programação/GitHub.
7. Adicionar criação de documentos, planilhas, apresentações, voz e imagens.
8. Implementar testes automatizados, observabilidade e proteção contra abuso.

A arquitetura é modular: novos provedores podem ser adicionados no backend sem expor suas credenciais ao navegador.

 
## DINA Studio — geração de vídeo

O DINA Studio integra opcionalmente a Nureta Developer API para criação de vídeos por texto. A chave nunca é enviada ao navegador nem armazenada no GitHub.

### Configuração
1. Crie uma conta e uma chave em [Nureta Developer](https://developer.nureta.ai/).
2. Adicione `NURETA_API_KEY` em Cloudflare Pages → Settings → Variables and Secrets → Production como **Secret**.
3. Faça um novo deploy.
4. Abra **DINA Studio** na barra lateral. Marque as confirmações de maioridade, consentimento e cobrança antes de solicitar uma geração.

A API usa saldo pré-pago e cobra por segundo conforme modelo e resolução. Consulte o saldo no Studio e confira os preços oficiais antes de gerar. A DINA não compra créditos nem recarrega saldo automaticamente.

### Recursos desta primeira versão
- Texto para vídeo, 480p / 720p / 1080p.
- Durações de 5 a 180 segundos (clipes maiores podem ser compostos por cenas).
- Formatos paisagem, vertical e quadrado.
- Consulta manual do status e reprodução do resultado.
- Chave protegida no backend Cloudflare.

Esta versão inicial não envia imagens de referência; inclui somente texto para vídeo. O provedor exige conteúdo de adultos, consentimento e autorização para qualquer semelhança usada. São proibidos menores, pessoas reais sem consentimento e figuras públicas. A declaração na interface não substitui a responsabilidade de cumprir as regras do provedor e a legislação aplicável.

Documentação: [Nureta Video API](https://developer.nureta.ai/docs/video) · [Autenticação e tarefas](https://developer.nureta.ai/docs)
