# Projeto: Prancheta

> Jogo de técnico de futebol para o celular (PWA), com clubes brasileiros e sul-americanos fictícios. O processo da empresa de agentes (papéis, fluxo, portões, o que só o CEO faz) está em `docs/PROCESSO.md` e `docs/papeis.md` e sempre vale. Este arquivo tem só o que é específico do Prancheta. Mantenha abaixo de ~250 linhas; tabelas longas vão para `docs/`.

## Processo (leia primeiro)

- A sessão principal é o **Orquestrador**; delega aos agentes de `.claude/agents/` e nunca escreve código de produção. Regras: `docs/PROCESSO.md`. Papéis: `docs/papeis.md`.
- Comandos: `/kickoff`, `/quick`, `/feature`, `/audit`, `/release`, `/ceo-report` e os do projeto: `/balance`, `/content`, `/devlog`, `/assets`.
- **Critério do caminho leve (`/quick`)**: até 5 arquivos; textos, templates de conteúdo, tokens de cor, parâmetros em `app/src/params/`, posts do devlog e ajustes de tela. Nunca toca `app/src/engine/` (motor de simulação), o formato de save (`app/src/lib/save/`), `server/`, `config/` nem `.github/`. Tudo o mais é `/feature`. Nos dois caminhos a `main` só recebe merge por PR, feito pelo CEO no GitHub; nenhum agente faz merge nem push na `main`.
- Travas: `.claude/settings.json` (deny/ask) e `.claude/hooks/guard-git.sh` (bloco "Ajuste por projeto" já preenchido para o Prancheta).

## Visão geral

- **O que é:** um jogo de técnico de futebol no estilo Brasfoot, só com clubes fictícios em trocadilho, rodando no navegador e instalável no celular; carreira offline e ligas online.
- **Status:** Etapa 1a em andamento, com o motor completo (T-001 a T-017 feitas); ver `docs/status.md`.
- **Documentos-chave:** `docs/PROJETO.md` (o documento de projeto congelado, fonte das decisões), `docs/00-vision.md`, `docs/01-requirements.md`, `docs/02-architecture.md`, `docs/adr/`, `docs/03-test-plan.md`, `docs/04-deploy.md`, `docs/roadmap.md`, `docs/status.md`.
- **Design system:** artefato "Prancheta" no claude.ai; os tokens estão exportados em `design/tokens.json` e compilados para `app/src/tokens.css` por `scripts/tokens-to-css.mjs`. O `ux-designer` é o guardião.

## Stack e comandos

- **Linguagem:** TypeScript 5 (strict) / Node 22.23.4+ (fixada em `.nvmrc`).
- **Jogo (`app/`):** Svelte 5 + Vite 8, PWA com `vite-plugin-pwa` 2, saves em IndexedDB (`idb`), campo 2D em canvas. Fontes hospedadas no próprio app (`@fontsource`), sem chamadas a terceiros.
- **Site (`site/`):** Astro 7, conteúdo em Markdown (`site/src/content/devlog/`); o roteiro do site é lido de `docs/roadmap.md` no build. O site é só em pt-BR.
- **Motor (`app/src/engine/`):** TypeScript puro, sem DOM, determinístico (semente explícita), compartilhado com o servidor a partir da Etapa 1b. Parâmetros numéricos ficam fora dele, em `app/src/params/`, e entram como argumento.
- **Servidor (`server/`, a partir da Etapa 1b):** Hono em Cloudflare Workers, D1 (SQLite), Durable Objects; R2 na Etapa 4.
- **Testes:** Vitest 5 (unitário e motor). E2E com Playwright entra na Etapa 1a; até lá não existe e o CI não finge que roda.
- **Lint/format:** ESLint 10 + svelte-check + astro check + Prettier (`npm run lint` roda tudo e também os testes do hook; `npm run format`).
- **Gerenciador:** npm com workspaces (`app`, `site`).

| Ação                                                                                  | Comando                                                                                                       |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Instalar                                                                              | `npm install`                                                                                                 |
| Rodar o jogo (dev)                                                                    | `npm run dev -w app`                                                                                          |
| Rodar o site (dev)                                                                    | `npm run dev -w site`                                                                                         |
| Testes unitários e do motor                                                           | `npm test`                                                                                                    |
| Atualizar golden do motor (recusa sem subir ENGINE_VERSION)                           | `npm run golden:update -w app`                                                                                |
| Regressão completa (lint + testes + build)                                            | `npm run test:all`                                                                                            |
| Lint                                                                                  | `npm run lint`                                                                                                |
| Formatar                                                                              | `npm run format`                                                                                              |
| Build (site + jogo em `dist/`)                                                        | `npm run build`                                                                                               |
| Auditoria de dependências                                                             | `npm audit --audit-level=high`                                                                                |
| Ícones da PWA a partir do SVG                                                         | `npm run icons`                                                                                               |
| Testes do hook de travas                                                              | `bash scripts/test-hook.sh`                                                                                   |
| Tokens do design system → CSS                                                         | `npm run tokens`                                                                                              |
| Balanceamento (simula N temporadas)                                                   | `npm run balance -- --seasons 200`                                                                            |
| Balanceamento de release (1.000 temporadas, robô no mais fraco)                       | `npm run balance -- --seasons 1000 --seed 1 --robot weakest`                                                  |
| Conferir dados e conteúdo (clubes, lista bloqueada)                                   | `npm run content:check`                                                                                       |
| Gerar hashes da lista bloqueada (arquivo de nomes fora do repo)                       | `npm run blocklist:hash -- <arquivo>`                                                                         |
| Medir a gravação do save (Chromium sem janela, CPU 4×)                                | `PRANCHETA_ENV=test npm run measure:save` (com `PRANCHETA_CHROMIUM=<caminho>`, usa um navegador já instalado) |
| Gerar fixtures de uma versão nova do save (nunca sobrescreve)                         | `npm run save:fixtures -w app`                                                                                |
| Recalcular as exclusões do gerador de nomes                                           | `npm run names:exclusions`                                                                                    |
| Teste completo dos nomes (antes de release e quando as listas mudarem)                | `NAMES_FULL_CHECK=1 npm test -w app`                                                                          |
| Testes de propriedade completos (10.000 partidas, 1.000 temporadas; antes de release) | `PROPERTY_FULL=1 npm test -w app`                                                                             |

## Estrutura

```
config/prancheta.config.ts   configuração central: nome, slogan, logo, cores, domínio, contatos, idiomas (tudo lê daqui)
design/tokens.json           tokens exportados do design system (fonte); app/src/tokens.css é gerado
app/                         o jogo (PWA), publicado em /jogo
  src/engine/                motor: simulação, calendário, mercado, IA dos clubes, economia (sem DOM, sem lib/, sem content/)
  src/params/                parâmetros numéricos do jogo (JSON), ajustados pelo /balance
  src/lib/                   save, i18n, config, geradores (escudos, avatares, nomes)
  src/ui/                    telas e componentes Svelte
  src/content/<idioma>/      templates de notícias, rede social, conversas e textos de interface
site/                        site público e devlog (Astro), publicado em /
server/                      API e salas online (a partir da Etapa 1b)
docs/                        processo, decisões, roteiro, status, relatórios, auditorias
scripts/                     tokens-to-css, balance, verificação de repetição de templates
tests/                       e2e/ e regression/ (unitários ficam ao lado do código)
```

## Convenções

- Branches: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`, `refactor/<slug>`, `docs/<slug>`, `quick/<slug>`. Nunca commit na `main`. Quando o ambiente exige uma branch de sessão, é ela que vale; nenhum commit novo nela enquanto houver PR aberto dela.
- Um PR por tarefa. ADR, pesquisa e texto de site vão em PR próprio. Tamanho G só com "G aprovado" escrito pelo CEO; o PR declara o tamanho. O título do PR (assunto do squash) fica em inglês, em Conventional Commits.
- Commits: Conventional Commits, em inglês, modo imperativo.
- Código, identificadores e comentários de API em inglês. Specs, commits de corpo longo, PRs, docs e devlog em **português do Brasil** (o CEO lê tudo). Textos do jogo em pt-BR, es e en, sempre em `app/src/content/<idioma>/`, nunca no código.
- O motor é determinístico: toda aleatoriedade passa pelo `Rng` com semente; `Math.random()` e `Date.now()` são proibidos em `app/src/engine/` (lint bloqueia).
- O formato de save tem número de versão e migração; mudar o formato exige ADR e teste de migração.
- Nenhum nome de clube, jogador, veículo ou pessoa real em lugar nenhum. Exceção: documentos de trabalho em `docs/` podem citar nomes reais só como referência; no jogo, código, dados e site a regra continua absoluta. Escudos podem lembrar o real só na silhueta, nas cores e no tipo de padrão, nunca no símbolo, iniciais, sigla, nome ou composição (ADR-0014); nenhum uniforme, canção ou voz que imite um real.
- Nenhum dado pessoal novo sem ADR e revisão do `security-auditor` (LGPD). Sem analytics com identificação, sem cookies de terceiros.
- Sem loot box, sem recompensa por tempo de uso, sem chat de texto livre (ECA Digital, Lei 15.211/2025).
- Acessibilidade: alvos de toque ≥ 44px, contraste ≥ 4,5:1, resultado nunca só por cor, respeito a `prefers-reduced-motion`.
- Erros: o motor nunca lança por situação de jogo; retorna resultados tipados (e `undefined` onde não há resposta). Erro de programação pode lançar e é bug. A interface mostra o erro em pt-BR e registra sem dados pessoais.

## Política de idioma (vale para todos os agentes; ninguém "corrige")

| O quê                                                                     | Idioma                                         |
| ------------------------------------------------------------------------- | ---------------------------------------------- |
| Conversa com o CEO, relatórios dos agentes, comentários de revisão        | português do Brasil                            |
| Código, identificadores, comentários de API, linha de assunto dos commits | inglês                                         |
| Specs (`docs/`), ADRs, PRs, CHANGELOG, devlog, templates                  | português do Brasil                            |
| Textos do jogo                                                            | pt-BR, es e en, em `app/src/content/<idioma>/` |
| Site                                                                      | só pt-BR (textos no próprio Astro)             |

## Regras de negócio (resumo; o completo está em `docs/PROJETO.md`)

- Dois modos (Carreira offline, Liga online) e dois ritmos (No meu ritmo, Tempo real).
- Três ajustes táticos (formação, postura, pressão); partida simulada minuto a minuto; meta de 2,5 a 2,8 gols por jogo; time 20 pontos mais forte vence cerca de 65% das vezes.
- Mercado com janelas, empréstimos, multa rescisória, olheiros e o resto do mundo como mercado abstrato.
- Patrocínio real desligado e não anunciado (ADR-0015): placas, placar e camisas mostram só marcas fictícias, como cenário; nada de "Patrocine aqui" no jogo nem no site; a receita é só o apoio voluntário, com recompensa cosmética; ligar exige ADR novo e revisão do `security-auditor`.

## Restrições do CEO

- Custo zero até o online; Cloudflare (Pages, Workers, D1, R2); migração para VPS possível (Hono, SQL padrão).
- ComfyUI roda só na máquina do CEO (RTX 5080): agentes entregam fluxos e prompts.
- ElevenLabs: nenhuma geração paga sem ok escrito do CEO com a estimativa de créditos.
- Nome provisório "Prancheta" até a conferência no INPI; tudo lê de `config/prancheta.config.ts`.

## Fora de escopo (Etapa 1)

- Séries B a D, copas, América do Sul, mercado (entre clubes e entre humanos), finanças, carreira longa, tempo real, sincronização de saves, áudio com voz, patrocinadores reais, painel de admin completo. O online entra na 1b só com ligas da Série A entre amigos.

## Combinados com o CEO

- O Prettier roda antes de cada commit, e o `npm run test:all` é obrigatório em todo PR, também no caminho leve (`/quick`) e no `/devlog`.
- Perguntar antes de começar cada item; avisar no celular quando algo esperar por ele.
- "Pode rodar" antes de qualquer coisa que abra janela ou use a GPU; um teste de tela por vez.
- Ambiente de teste isolado: a definir na Etapa 1a (`PRANCHETA_ENV=test` e um IndexedDB separado); o hook já exige a variável para `playwright test`, `vite preview` e `npm run preview -w app` (o preview do site é livre).
- Toda semana um post no devlog, mesmo curto; toda etapa concluída, um post de marco. O `/kickoff` parte do backlog de `docs/PROJETO.md`, não só de `docs/roadmap.md`.
- Estilo do devlog (aprovado em 2026-11-05): explica de forma técnica e acessível, definindo os termos e dando mecanismos e números; comparações só para ideias técnicas, sem analogia para o óbvio; pode ser longo e ter imagens em `site/public/devlog/<data>/`, nunca de escudo; pode citar inspirações reais (campeonatos, jogos) como referência, sem marca registrada (nunca "Brasileirão": use "Série A" ou "campeonato brasileiro"), e nomes de clubes, jogadores e pessoas reais continuam proibidos; o site e o devlog nunca citam códigos internos (de tarefa, história, bug ou ADR, como T-048 ou ADR-0019), e há teste automático no build do site para isso.
- Cada lote de textos do `content-writer` e cada lista de clubes passa pelo CEO antes de entrar no jogo.
- Tabela de andamento no fim de cada resposta longa.

## Notas para os agentes

- O documento de projeto completo está em `docs/PROJETO.md`; leia a seção relevante antes de propor algo que ele já decide. Mudança nele é ADR.
- `app/src/engine/` não importa nada de `app/src/ui/` nem do DOM; o lint bloqueia.
- Escudos e avatares são gerados por código em `app/src/lib/generators/`; nunca há imagens de escudo no repositório.
- Os tokens de design não se editam em `app/src/tokens.css`; edite `design/tokens.json` e rode `npm run tokens`.
