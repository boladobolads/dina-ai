# DINA — Inteligência Artificial Pessoal

A DINA é uma assistente de IA pessoal, acessível pelo navegador e adaptável a computador e celular. Este repositório contém a primeira base funcional do aplicativo.

## Primeira versão

- Interface responsiva de conversa.
- Backend Cloudflare Pages Functions.
- Integração com a OpenAI Responses API.
- Histórico de mensagens durante a conversa atual.
- Pesquisa na web opcional por ferramenta nativa.
- Código de acesso provisório para proteger o endpoint.
- Segredos mantidos nas variáveis de ambiente do servidor.

## Publicação no Cloudflare Pages

Conecte este repositório ao Cloudflare Pages. Configure a raiz do projeto como diretório de saída e não é necessária etapa de build para esta versão. As funções em `functions/api` serão publicadas como endpoints.

Em Settings → Variables and Secrets, configure:

| Variável | Obrigatória | Descrição |
|---|---|---|
| `OPENAI_API_KEY` | Sim | Chave secreta da API OpenAI. Cadastre como Secret. |
| `OPENAI_MODEL` | Sim | Identificador de um modelo habilitado no seu projeto de API. |
| `DINA_ACCESS_CODE` | Sim | Código privado de acesso nesta versão inicial. Cadastre como Secret. |
| `ENABLE_WEB_SEARCH` | Não | Defina `true` para habilitar pesquisa na web nativa. |

Depois de cadastrar ou alterar variáveis, faça um novo deploy.

**Nunca coloque a chave da OpenAI no HTML, JavaScript do navegador ou GitHub.** A API é cobrada separadamente da assinatura ChatGPT. Configure limites de uso e monitore o consumo no painel da plataforma.

## Desenvolvimento local

Com Wrangler instalado, execute:

```bash
npx wrangler pages dev .
```

Crie um arquivo local `.dev.vars` (não versionar) com as mesmas variáveis de ambiente.

## Segurança e limitações

O código compartilhado é uma proteção provisória e não substitui autenticação individual. Antes de abrir o serviço ao público, implementar login, autorização por usuário, rate limiting, limites de custo, proteção contra abuso, armazenamento seguro e política de privacidade. O histórico desta versão permanece apenas durante a sessão atual; ainda não é memória persistente.

## Próximas etapas

1. Autenticação individual e banco de dados.
2. Memória configurável e histórico persistente.
3. Upload e análise de arquivos.
4. Espaço de projetos e ferramentas de programação/GitHub.
5. Criação de documentos, planilhas e apresentações.
6. Voz, geração de imagens e integrações autorizadas.
7. Testes, observabilidade, segurança e publicação estável.

A arquitetura será ampliada por módulos, sem expor credenciais no cliente e sem afirmar que uma ação foi concluída antes da confirmação do serviço.
