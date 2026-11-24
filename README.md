# DINA — Inteligência Artificial Pessoal

A DINA será uma assistente de IA completa, acessível pelo navegador e adaptável a computador e celular.

## Visão do produto

A DINA deve ajudar no dia a dia e oferecer recursos de:
- Conversa natural e assistência contextual.
- Memória configurável de preferências, projetos e decisões.
- Programação: criação, leitura, edição, análise e depuração de projetos.
- Criação de conteúdo e artefatos: textos, documentos, planilhas, apresentações e imagens.
- Trabalho com arquivos enviados pelo usuário.
- Pesquisa na web com fontes e atualização de informações.
- Organização de tarefas, planejamento e lembretes.
- Integrações com serviços externos mediante autorização.
- Execução de ferramentas com confirmação antes de ações sensíveis.
- Histórico de conversas, configurações e controle de privacidade.

## Princípios

1. A DINA não deve fingir que executou algo: toda ação precisa de confirmação real do serviço.
2. Segredos e chaves de API ficam no servidor, nunca no navegador ou no Git.
3. Ações externas (enviar mensagens, publicar, apagar ou alterar dados) exigem autorização adequada.
4. Memória deve ser visível e controlável pelo usuário.
5. Arquitetura modular para permitir trocar modelos e adicionar ferramentas sem reconstruir o produto.

## Arquitetura planejada

- **Aplicação web responsiva/PWA:** interface de conversa, projetos, arquivos e configurações.
- **Backend seguro:** autenticação, sessões, orquestração da IA e execução de ferramentas.
- **Camada de modelos:** integração com um provedor de IA por API, com possibilidade de múltiplos provedores.
- **Memória e dados:** banco de dados com separação por usuário e controles de retenção.
- **Ferramentas:** arquivos, programação, pesquisa, criação de documentos e integrações autorizadas.

## Etapas de desenvolvimento

1. Definir experiência, identidade e requisitos da DINA.
2. Criar a base do aplicativo e autenticação.
3. Implementar chat conectado ao modelo de IA por backend seguro.
4. Adicionar memória e histórico.
5. Implementar arquivos e ferramentas de programação.
6. Adicionar geração de documentos e imagens.
7. Integrar agenda, e-mail e demais serviços autorizados.
8. Testar segurança, permissões e publicar.

## Estado atual

Repositório iniciado em 2026-11-24. Nenhuma chave de API ou credencial deve ser adicionada ao repositório.
