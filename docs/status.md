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

| Tarefa | Estado                                                                                                                                                                                          |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-001  | feita (PR #4 mergeado); fundações do motor                                                                                                                                                      |
| T-002  | feita (`GameParams`, `validateParams`, seis JSON em `app/src/params/`, `lib/params.ts`)                                                                                                         |
| T-003  | feita (`ClubDef`, `validateClubs`, `app/src/data/`, `content:check`, `blocklist:hash`; 322 testes; `content:check` 107)                                                                         |
| T-004  | feita (gerador de nomes, listas `br`, exclusões, 469 hashes de atletas; 344 testes)                                                                                                             |
| T-005  | feita (PR #10); entregue, aguardando merge (modelo do jogador no motor: `players.ts`, `testing/identity.ts`, `testing/players.ts`, golden `players.json`; 398 testes; `ENGINE_VERSION` segue 1) |

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

A implementação sai em PR próprio.

## Pendências abertas

- `/balance` da T-016 deve medir "grande rebaixado" (estimativa grosseira ~97% contra a meta de 40% a 80%).
- ADR da Etapa 4 para a meta da diretoria pela força.
- Consulta ao advogado sobre espelhar dados reais (tabela e títulos).
- Lote de dezembro com a tabela final.

## Próximo

T-005 mergeada. Site novo entregue, aguardando merge do CEO (PR próprio). Depois: T-006 (elencos e novo jogo). Pendências do site: bloco "Patrocine aqui" em `/apoiar/` (`/quick`) e a passada `REQUIRE_SITE_DIST=1` no CI depois do build (`devops-engineer`). Pendentes do CEO: consulta no INPI dos nomes de risco médio, domínio definitivo (trava a US-047) e quem trata as denúncias e em quanto tempo (trava a US-065).
