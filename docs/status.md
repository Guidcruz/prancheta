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

| Tarefa | Estado                                                                                                                     |
| ------ | -------------------------------------------------------------------------------------------------------------------------- |
| T-001  | entregue, aguardando merge (branch `claude/kickoff-i22gas`; passou no code review e no QA); fundações do motor             |
| T-002  | próxima (`GameParams` e `validateParams`)                                                                                  |
| T-003  | próxima, em paralelo à T-002 (dados dos clubes; lista dos 20 aprovada em `docs/content/lotes/2026-11-04-nomes-serie-a.md`) |

## Próximo

`/feature T-002` e `/feature T-003` depois do merge da T-001. Pendentes do CEO: consulta no INPI dos nomes de risco médio, domínio definitivo (trava a US-047) e quem trata as denúncias e em quanto tempo (trava a US-065).
