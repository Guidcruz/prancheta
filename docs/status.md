# Status

Atualizado pelo Orquestrador e pelo `tech-writer` a cada merge. Último post do devlog: 2026-11-03 (Dia 1).

## Etapa atual: 1a — Brasileirão Série A (em andamento)

A Etapa 0 (Dia 1) está concluída; o que resta dela são pendências do CEO, listadas abaixo. A tabela a seguir é o estado da Etapa 0.

### Etapa 0 — Dia 1

| Item                           | Estado     | Observação                                                                           |
| ------------------------------ | ---------- | ------------------------------------------------------------------------------------ |
| Documento de projeto           | feito      | congelado em `docs/PROJETO.md`                                                       |
| Design system                  | feito (v1) | artefato "Prancheta"; tokens em `design/tokens.json`                                 |
| Kit de agentes adaptado        | feito      | 14 agentes, 10 comandos, hook com travas do projeto e 74 casos de teste              |
| Auditoria do dia 1             | feita      | 50 achados; corrigidos os que não dependem de decisão; os outros estão abaixo        |
| Repositório no GitHub          | feito      | `Guidcruz/prancheta`, público, `main` protegida por ruleset (PR, CI `ci`, só squash) |
| Site no Cloudflare Pages       | feito      | `prancheta-ad1.pages.dev`; publica a cada merge na `main`, prévia por PR             |
| Domínio                        | pendente   | decisão do CEO; até lá `*.pages.dev`                                                 |
| Versão zero do jogo em `/jogo` | feito      | tela inicial com escudo, nome e botão                                                |
| Post "Dia 1"                   | feito      | `site/src/content/devlog/2026-11-03-dia-1.md`                                        |
| Nome no INPI                   | pendente   | CEO                                                                                  |
| Revisão jurídica dos escudos   | pendente   | CEO; antes do lançamento público, escudos de risco médio (ADR-0014)                  |
| Licença do código              | pendente   | CEO                                                                                  |

## Decisões pendentes do CEO (da auditoria do dia 1)

> 2026-11-04: no `/kickoff`, o CEO adiou os itens 4 a 8 (não bloqueiam o planejamento da Etapa 1); o item 9 ficou resolvido com o uso do `/kickoff` adaptado.

1. Caminho leve por PR, com a `main` protegida (aplicado como padrão; para voltar ao merge local, mudar o hook e o `/quick`).
2. Apagar branches só pelo CEO (aplicado: `ALLOW_BRANCH_DELETE=0`).
3. Fontes hospedadas no próprio site, sem Google Fonts (aplicado, por privacidade).
4. E-mail de suporte real (hoje vazio; a política de privacidade avisa) e domínio definitivo.
5. Manter nome e cidade do responsável na política de privacidade.
6. Publicar o nome "Prancheta" no site antes da conferência no INPI, ou esperar.
7. Licença do código.
8. Confirmar que o alias de modelo `fable` existe na sua instalação do Claude Code (usado pelo `project-auditor`); senão, trocar por `opus`.
9. ~~Versão adaptada do `/kickoff` (passo 0) antes do primeiro uso.~~ Resolvido em 2026-11-04.

## Decisões do CEO no `/kickoff` (2026-11-04)

Telas da 1a (`docs/design/telas/`):

1. Rótulo "promessa" para jovens de potencial alto: aprovado, só o rótulo, nunca o número (ajustar US-016).
2. Ícones próprios, desenhados pelo `art-director` (`/assets arte ícones`); até a aprovação, conjunto aberto provisório atrás do componente `Icon`.
3. Tipo de partida (animada, lances principais, só resultado) pode ser trocado durante a carreira, nas Preferências e ao jogar a rodada; o "Realismo" fica fixo após criar a carreira.
4. Patrocínio vazio no jogo mostra marcas fictícias; "Patrocine aqui" só no site e na tela Sobre.
5. Menu "Mais" fica no topo na 1a, com as mesmas entradas no pé da tela Clube; revisar na Etapa 3, quando o Mercado virar a 5ª aba.

## Decisões do CEO depois do merge do `/kickoff` (2026-11-04)

1. ADRs 0006 a 0010 aceitos; ADR-0011 aceito na opção A (`match.homeBase = 0.05`).
2. Dependências aprovadas: `valibot` (1a); `hono`, `@simplewebauthn/server` e `/browser` (1b); só de teste `@playwright/test`, `fake-indexeddb`, `@axe-core/playwright` (sem `fast-check`).
3. Ajustes no `CLAUDE.md`, CI e `docs/04-deploy.md` sugeridos pelo `architect` e pelo `qa-engineer` aprovados; entram no PR da tarefa que os usa.
4. Desempate da tabela pelos critérios da CBF, com sorteio pela semente no fim (P1).
5. Depois da rodada 38, nova temporada com os mesmos 20 clubes (P2); subida de 4 clubes fica para quando houver lista aprovada.
6. Demais perguntas do `product-manager` (P3 a P13) e do `qa-engineer` (Q1 a Q10): aceitas as recomendações dos documentos.

## Etapa 1a: andamento das tarefas

| Tarefa | Estado                                                                                                                                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T-001  | feita (PR #4 mergeado); fundações do motor                                                                                                                                                                         |
| T-002  | feita (`GameParams`, `validateParams`, seis JSON em `app/src/params/`, `lib/params.ts`)                                                                                                                            |
| T-003  | feita (`ClubDef`, `validateClubs`, `app/src/data/`, `content:check`, `blocklist:hash`; 322 testes; `content:check` 107)                                                                                            |
| T-004  | feita (gerador de nomes, listas `br`, exclusões, 469 hashes de atletas; 344 testes)                                                                                                                                |
| T-005  | feita (PR #10 mergeado); modelo do jogador no motor: `players.ts`, `testing/identity.ts`, `testing/players.ts`, golden `players.json`; 398 testes; `ENGINE_VERSION` segue 1                                        |
| T-006  | feita (`newGame`, `generateSquad`, formações, camisas realistas, joia, ídolo, `lib/generators/identity.ts` com rosto placeholder até a T-027)                                                                      |
| T-007  | feita (PR #15 mergeado; code review e QA aprovados; 517 testes, 518 com o completo de nomes): `fixtures.ts` com 380 jogos, `newGame` com `fixtures` e erro `'invalid-calendar'`, `ENGINE_VERSION` 2, `Rng.shuffle` |

## Decisões do CEO durante a T-003 (2026-11-04)

1. Porte por títulos, história e torcida: 12 grandes, 5 médios, 3 pequenos.
2. Força pela tabela do Brasileirão 2026 parcial (33ª rodada), numa escada única de 20 degraus, separada do porte.
3. Lote refeito em dezembro com a tabela final.
4. Atualização anual dos dados (US-066 a US-069).
5. Títulos da carreira somam ao histórico do clube (T-017/T-018).
6. O porte pode crescer dentro da carreira (Etapa 4).
7. Metas de balanceamento ajustadas.

## Decisões do CEO durante a T-004 (2026-11-04)

1. Lote de nomes aprovado com ajustes: itens ofensivos e de pessoas notórias removidos, origens inventadas, diminutivo ligado ao prenome.
2. Metas de placar: 0×0 de 6% a 9%; goleada de 8% a 13%; diferença de 5 ou mais gols de 0,5% a 2%.
3. ADR-0012 aceito: nome e rosto resolvidos ficam no estado e no save; nome retirado também sai dos saves antigos.
4. Exceção à regra de nomes reais: documentos de trabalho em `docs/` podem citá-los só como referência; no jogo, código, dados e site a regra continua absoluta.

## Decisões do CEO sobre o site novo (2026-11-04)

Desenho (`docs/design/site.md`) e textos (`docs/content/site/`) aprovados, com 8 decisões:

1. "Série A" no lugar de "Brasileirão".
2. Só exemplos de clubes.
3. Nome provisório numa linha.
4. Discussions do GitHub via `contacts.discussionsUrl`.
5. Sem citar advogado.
6. Tema dia, seguindo o sistema.
7. Tokens `layout`.
8. `@astrojs/sitemap`.

Implementado e publicado (PR #12; correções no PR #13 e no PR da T-006).

## Decisões do CEO em 2026-11-04 (T-006 e liga online)

1. Camisas realistas nos elencos, desenhadas pelo `game-designer`.
2. ADR-0013 aceito: liga da 1b com até 20 humanos, um por clube; liga online com Séries A e B antecipada para a Etapa 2.
3. Site com "Até 20 (um técnico por clube da Série A)" no tamanho da liga.
4. Site novo entregue (implementação do desenho aprovado), com correção dos espaços em volta de elementos inline.

## Decisões do CEO em 2026-11-04 (calendário, nomes, site e escudos)

1. Nomes, revisão 2: listas revisadas pelo CEO, origens curtas, limite de 22 caracteres no nome de exibição, exclusões regeneradas.
2. ADR-0013 revisado: liga ao vivo até 8 humanos; assíncrona até 20 por divisão. O site usa esses números.
3. Descrições curtas para compartilhar aprovadas (clubes: "Clubes com trocadilho").
4. Site: escolhida a direção visual A "Noite de estádio", com os toques recomendados; especificação em `docs/design/site.md` (em escrita pelo `ux-designer`).
5. Escudos: estilo A v5 (Brasão) escolhido e implementado; ADR-0014 aceito.

## Perguntas abertas para a Etapa 2

1. **No online, o que acontece quando um técnico humano é rebaixado?** (pergunta do CEO)
   - A: liga com Séries A e B; quem cai joga a B na mesma liga.
   - B: liga só da Série A; quem cai assume um dos clubes que subiram.
   - C: liga só da Série A com rebaixamento desligado.
   - Recomendação do Orquestrador: o dono escolhe ao criar a liga entre "Série A e B" e "Só Série A"; na "Só Série A" ele também escolhe se o rebaixamento vale (B como alternativa). Na carreira offline, cair é jogar a Série B.

## Observações do QA para revisar depois

- Nomes de exibição longos: tratar a truncagem na tela do elenco (T-028).
- Alguns nomes lembram pessoas notórias (ex.: "Cartola", "Dudek", "Carlos Alberto"): revisão de conteúdo.
- Estrangeiros saem com nome brasileiro até existir a lista em espanhol.

## Pendências abertas

- `/balance` da T-016 deve medir "grande rebaixado" (estimativa grosseira ~97% contra a meta de 40% a 80%).
- ADR da Etapa 4 para a meta da diretoria pela força.
- Consulta ao advogado sobre espelhar dados reais (tabela e títulos).
- Lote de dezembro com a tabela final.

## Dívida técnica (achados do security-auditor)

- M1 (resolvido por este PR): a política prometia apagar mensagens de suporte em 90 dias, mas o canal publicado são as Discussões do GitHub (público, de terceiros). Textos de Privacidade, Perguntas e rodapé corrigidos.
- L1: `scripts/og.mjs` não limpa a pasta temporária em SIGINT/SIGTERM.
- L2: criar `_headers` do Cloudflare Pages (CSP, `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors`) antes da Etapa 1b.
- L3: fixar a imagem do devcontainer e as ações do CI por SHA/digest.

## Em andamento (PR do site e dos escudos, branch `claude/kickoff-i22gas`)

Aprovado em revisão, aguardando merge do CEO:

- Site na direção A "Noite de estádio": componentes e páginas novos, imagens de compartilhamento por `scripts/og.mjs`, tabelas que viram cartões no celular.
- Gerador de escudos estilo A v5 (`shield.ts`): silhuetas, padrões, símbolo da cidade, estrelas douradas (Série A) e prateadas (Série B). ADR-0014 aceito.
- Campos de escudo em `ClubDef` (`crestShape`, `crestPattern`, `crestBase`, `crestSymbol`, problema `invalid-crest`) e `ENGINE_VERSION` 3.
- ADR-0013 revisada: ao vivo até 8, assíncrona até 20 por divisão, Série A+B na Etapa 2.
- Tokens novos: `body-lg`, `sticker-name`, `sticker-name-long`, `stage-number`; mínimo de `type-display-xl` em 64px.
- Textos aprovados em `docs/content/site/complementos.md`.

## Pendências do CEO

- Consulta no INPI do nome "Prancheta" e dos nomes de risco médio.
- Advogado: espelhamento anual de dados reais (tabela e títulos) e os 5 escudos de risco médio da ADR-0014.
- Domínio definitivo (bloqueia a US-047).
- Quem trata as denúncias e em quanto tempo (bloqueia a US-065).
- Merge do PR do site e dos escudos.

## Próximo

1. Bloco "Patrocine aqui" em `/apoiar/` (`/quick`).
2. CI com `REQUIRE_SITE_DIST=1` depois do build e `NAMES_FULL_CHECK=1` (`devops-engineer`).
3. Lista de nomes em espanhol (estrangeiros ainda saem com nome brasileiro).
4. T-008 até T-016 da Etapa 1a.
5. Lote de clubes de dezembro, com a tabela final de 2026.
