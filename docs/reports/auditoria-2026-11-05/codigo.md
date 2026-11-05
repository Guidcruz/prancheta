Confirmado: `facts.ts:runs` e `fans.ts:winlessRuns` fazem a mesma varredura. Tenho o suficiente para fechar a auditoria.

# Auditoria — Eixo CÓDIGO (Prancheta, `main` em 5498ccc, 2026-11-05)

**Escopo lido:** `app/src/engine/` (todos os módulos de produção; lint e 1.177 testes rodados, verdes, 1 pulado), `app/src/lib/`, `app/src/data/`, `scripts/balance/`, `site/src/lib/`, `docs/02-architecture.md` §3–§5, §7, §9. Nenhuma edição.

**Veredito geral:** o motor cumpre o contrato do §4.1 no essencial: nenhum `Math.random`, `Date`, `Intl` ou `node:*` em produção (lint prova com `boundary.test.ts`), todo erro de situação de jogo é `Result` tipado, os `throw` restantes são erros de programação documentados, o estado é JSON-exato (sem `Map`/`Set`/`undefined` gravados). Não há achado crítico. Os achados abaixo são dívida, acoplamento e preparo para o save e o servidor.

## Achados

### Alta

**1. O estado carrega 95 KB de `lastRound` que o servidor vai serializar a cada rodada (18 % do estado).**

- Onde: `app/src/engine/round.ts:792` (`state: { ...applied, lastRound: report }`); `app/src/engine/game.ts:86`. Medido na fixture `__fixtures__/state-engine-v9-round-6.json`: estado 531 KB, dos quais `players` 284 KB, `lastRound` 95 KB, `fixtures` 72 KB, `seasonStats` 46 KB. Cada `MatchResult` em `lastRound` tem 9,3 KB, e 3 KB dele são `ratings`, `minutes`, `finalEnergy` e `conceded` por jogador, dados que `applyRound` já aplicou em `players`/`seasonStats`.
- Impacto: o gatilho da 1b é 8 ms de CPU por rodada no `workerd`, e o motor sozinho já está em 6,7–7,8 ms (§5). O custo que falta medir é ler/serializar/comprimir o estado (estimativa 16–30 ms, §9), e `lastRound` é a parte mais fácil de cortar, além de ir inteira em cada snapshot do save (3 por carreira).
- Recomendação: antes da T-018, o `architect` decide se `lastRound` continua no `GameState` (então `MatchResult` perde os mapas por jogador já aplicados, ou guarda só `events` + `score` + `stats`), ou se vai para `CareerSave.career` e para a tabela de rodadas do D1, fora do estado que o `playRound` recebe e devolve. Nos dois casos é mudança de forma antes de o formato congelar (T-019).

**2. `index.ts` não é a fronteira real: `lib/` e `scripts/balance/` importam módulos internos do motor.**

- Onde: `app/src/engine/index.ts:2-3` ("Everything outside `engine/` imports from here"); `app/src/lib/generators/names.ts:1` (`@engine/rng`), `app/src/lib/generators/shield.ts:1-2` (`@engine/types`, `@engine/clubs`), `scripts/balance/robot.ts:27` (`engine/math.ts`, porque `exp` não é exportado), `site/astro.config.mjs` (alias `@engine` para o site inteiro). O lint só protege o sentido motor → fora; o sentido fora → interno do motor é livre.
- Impacto: o servidor da 1b vai copiar o padrão, e o contrato do §4.1 deixa de ser o único ponto de compatibilidade; uma renomeação interna quebra `lib/`, `site/` e `scripts/`.
- Recomendação: regra de lint para `lib/**`, `ui/**`, `site/**` e `scripts/**` que só aceita `engine/index.ts` (ou `@engine` sem subcaminho); exportar `exp` em `index.ts` se o `/balance` precisa dele; trocar os 3 imports.

**3. Superfície pública do motor com ~250 símbolos, muitos deles internos exportados para teste.**

- Onde: `app/src/engine/index.ts:98-110, 185-216, 285-306` (`roundBenchStreaks`, `roundMoraleDeltas`, `nextRecentRatings`, `winsTie`, `kickoffBench`, `evolutionSeed`, `strengthRank`, `CHAOTIC_*_WEIGHTS`, `MAX_SAME_VENUE_RUN` etc.). O §4.1 lista cerca de 15 funções e os tipos.
- Impacto: a UI (T-023+) e o servidor (T-050+) vão se apoiar em funções que o `architect` não assinou como contrato; cada ajuste de regra vira risco de quebrar fora do motor; a "API pública" documentada e a real divergem.
- Recomendação: `index.ts` exporta só o contrato do §4.1 e os tipos; testes e `scripts/balance/` importam internos por caminho (os testes já fazem isso). Se o `/balance` precisa de `strengthsFromRatings`, `pickBench` etc., documentar a lista como "API de ferramentas" no §4.1 ou criar `engine/tools.ts`.

### Média

**4. Duas implementações da mesma série (jogos sem vencer).**

- Onde: `app/src/engine/fans.ts:160-171` (`winlessRuns`) e `app/src/engine/facts.ts:139-161` (`runs`), ambas filtram e ordenam os 380 fixtures por rodada e contam a sequência sem vitória; `applyRound` chama as duas na mesma rodada (`round.ts:600` via `roundFans` e `:790` via `roundFacts`).
- Impacto: duplicação de regra (um ajuste em "jogo abandonado conta pelo placar atribuído" precisa ser feito duas vezes) e trabalho repetido por rodada.
- Recomendação: `facts.runs` passa a ser a única e `fans.ts` lê `winless` dela (ou `applyRound` calcula uma vez e passa às duas).

**5. `humanModes` é calculado duas vezes em `playRound`, e `prepareRound` sugere ficha para clube humano que já mandou a sua.**

- Onde: `app/src/engine/round.ts:281` (dentro de `prepareRound`) e `:869` (de novo em `playRound`, com `warnings` vazios para não duplicar avisos); `:288` (`suggestSheet` sempre, mesmo com `own` presente).
- Impacto: pequeno em CPU (1 de 20 fichas; `suggestSheet` custa 1,2–1,7 ms pelas 20), mas é lógica duplicada e, com o gatilho de 8 ms, cada décimo conta.
- Recomendação: `prepareRound` devolve os `humans` no plano (campo interno) ou `playRound` chama uma função interna que devolve plano + humanos; `suggested` só para quem não mandou ficha, com o §4.1 ajustado ("sugestão" só para quem precisa).

**6. Tolerância a estado legado dentro do motor, antes de existir a camada de save.**

- Onde: `app/src/engine/season.ts:641, 786` (`Array.isArray(state.pastSeasons) ? ... : []`, "A state from before T-017"); `app/src/engine/legacy-state.test.ts` com fixture de 531 KB em `engine/__fixtures__/`; `app/src/engine/ai.ts:126` (`club.preferredFormations ?? []`).
- Impacto: o contrato do §4.2 diz que migração é de `lib/save/migrations/`, função pura `vN → vN+1`. Se o motor remenda estado velho, a cadeia de migração nasce com buracos ("funcionou sem migrar") e ninguém sabe qual camada é a responsável; a fixture no motor vai duplicar `lib/save/fixtures/vN.json` da T-019.
- Recomendação: o motor assume `GameState` válido na forma atual; a tolerância vira migração na T-019, e a fixture `state-engine-v9-round-6.json` muda de pasta (ou vira a `v1.json` do save).

**7. O site depende de internos do app (`app/src/data/clubs.serie-a.json`, `app/src/lib/generators/shield`, alias `@engine`), e o site não aparece no §3 da arquitetura.**

- Onde: `site/src/lib/shields.ts:1-2`, `site/astro.config.mjs` (alias `@engine` para `app/src/engine`), `docs/02-architecture.md:32-50` (árvore de componentes sem `site/`).
- Impacto: sentido de dependência site → app não está escrito em lugar nenhum nem protegido por lint; um refactor em `lib/generators` quebra o build do site sem o `developer` do app perceber.
- Recomendação: `architect` acrescenta `site/` ao §3 com a regra "o site lê só `config/`, `docs/roadmap.md`, `app/src/data/*.json` e `app/src/lib/generators/shield.ts`", e um teste (ou lint do site) que fixe essa lista.

**8. `npm run content:check` roda simulações de temporada inteira, não só conferência de conteúdo.**

- Onde: `scripts/content-check.mjs:11` (`suites = ['src/data/']`); em `app/src/data/` estão `season.ai.e2e.test.ts`, `career.acceptance.e2e.test.ts`, `match-metrics.test.ts`, `fans-metrics.test.ts` (temporadas encadeadas, 11.400 partidas no modo completo), todos testes de aceite do motor com os 20 clubes reais.
- Impacto: o comando que o `content-writer` roda ao mexer num nome de clube leva minutos e falha por motivo que não é dele; o sufixo `.e2e.` colide com `tests/e2e/` (Playwright, vazio) do `CLAUDE.md`.
- Recomendação: mover os testes de aceite para `app/src/engine/acceptance/` (ou `tests/regression/`), renomear sem `.e2e.`, e `content:check` ficar só com `clubs.serie-a.test.ts`, `check.test.ts`, `blocklist.test.ts`, `hash-blocklist.test.ts`.

**9. Método de medição em dois lugares: `match-metrics.test.ts` e `scripts/balance/duels.ts`.**

- Onde: `scripts/balance/duels.ts:24-27` ("the method of `app/src/data/match-metrics.test.ts`, which the game-designer used"), `app/src/data/match-metrics.test.ts` (próprio motor de duelos, 349 linhas).
- Impacto: dois relatórios com números parecidos mas não iguais (um usa `suggestSheet` com todos a 100 de condição, o outro elencos gerados com `clubStrengthSd = 0`); quem lê o `balance-log.md` não sabe qual vale, e o `/balance` já é o oficial (decisão do CEO).
- Recomendação: `match-metrics.test.ts` fica só com as cotas de sanidade (ou é removido) e o relatório é do `/balance`.

**10. Arquivos grandes e com mais de uma responsabilidade.**

- Onde: `app/src/engine/round.ts` (875 linhas: plano da rodada, resumo da partida, moral, banco, torcida, condição, aplicação); `app/src/engine/season.ts` (788: prêmios, campanha, evolução, virada); `app/src/engine/match/simulate.ts` (842); `scripts/balance/metrics.ts` (853); `app/src/engine/properties.test.ts` (1.201).
- Impacto: `round.ts` guarda `ROUND_MORALE`, `moraleDrift`, `roundMoraleDeltas` que o §3 ("Arquivos previstos") nem o `docs/design/jogadores.md` atribuem a ele; `morale.test.ts` existe sem `morale.ts`.
- Recomendação: extrair `engine/morale.ts` (moral, banco, forma) de `round.ts` e `engine/awards.ts` de `season.ts`; sem mudança de comportamento, sem subir `ENGINE_VERSION`.

**11. `clubMatches` existe com o mesmo nome e semânticas diferentes em dois módulos.**

- Onde: `app/src/engine/round.ts:397` (`clubMatches(players, matches, results)`: as partidas da rodada por clube) e `app/src/engine/season.ts:451` (`clubMatches(state, clubId)`: a campanha de um clube).
- Impacto: confusão na leitura e no futuro `morale.ts`.
- Recomendação: renomear a de `season.ts` para `campaignMatches`.

**12. Prontidão para o save (T-018/T-019): falta um validador de forma do `GameState` no motor, e `ClubState.def` repete os 20 `ClubDef` em cada snapshot.**

- Onde: o motor tem `validatePlayer`, `validateClubs`, `validateParams`, mas não `validateState`; `app/src/engine/game.ts:31` (`def: ClubDef`, 0,5 KB × 20 = 12 KB por snapshot, 10 % do `clubs`); `docs/02-architecture.md:868` (teste de forma com `shape-vN.json`) e `:870` (`valibot` estrito na importação).
- Impacto: a T-019 vai escrever o esquema `valibot` do `GameState` fora do motor, duplicando as faixas que o motor já conhece (`MORALE_RANGE`, `AGE_RANGE`, `POSITIONS`...); e qualquer campo novo no estado (T-048) precisa ser lembrado em dois lugares. O `def` repetido é aceitável por desenho (a carreira congela os clubes), mas deve ser decisão explícita porque a "lista de dezembro" não vai alcançar saves existentes.
- Recomendação: o `developer` da T-019 lê as faixas do motor (`index.ts` já exporta as constantes) em vez de redigitar; o `architect` registra no ADR-0006 que `ClubDef` é congelado no save e que a lista nova vale só para carreira nova.

### Baixa

**13. Números mágicos fora das constantes.** `scripts/balance/league.ts:417` (`state.round <= 38`), `app/src/engine/season.ts:95` (`minutesReference: 38 * 90 * 0.6`), `app/src/engine/round.bench.ts:23, 38`. Usar `SEASON_ROUNDS` e `HALF_MINUTES`.

**14. `app/src/lib/audio/manifest.json` é `{}` sem dono.** Criado pelo ADR-0016 antes da T-047; `lib/audio/` não existe de fato. Ou entra com a T-047 ou sai agora para não parecer módulo pronto.

**15. `registerType: 'autoUpdate'` na PWA e `GAME_PLAYABLE = false` são travas temporárias sem item que as remova.** `app/vite.config.ts:29` (comentário "até a tela de 'nova versão' existir"), `site/src/data/game.ts:5`. O `architect` já prevê `'prompt'` na T-039; conferir que a T-039 e a release da 1a citam os dois pontos.

**16. `site/src/lib/dist.test.ts` depende do `dist/` já construído (pulado quando não existe).** `site/src/lib/dist.test.ts:12`. Teste que passa em silêncio no `npm test` e só vale no `test:all`; documentar ou mover para o passo de build.

## Sem achado (conferido)

- Determinismo: `Rng` mulberry32 com `seedFromString` FNV-1a; `normal` consome 6 sorteios fixos; `exp` encapsulado; `Math.exp` só em `math.ts`; nenhum `localeCompare`; datas do calendário sem `Date` (`fixtures.ts:133-181`).
- `Result` tipado em `newGame`, `prepareRound`, `playRound`, `endSeason`, `startNextSeason`, `validateLineup`, `validateParams`, `validateClubs`; `simulateMatch`, `suggestSheet`, `getStandings` nunca lançam; os `throw` em `strength.ts:232,268`, `generation.ts:628,657,674` e `players.ts:393,397` são erros de programação, não alcançáveis por situação de jogo.
- Acoplamento com a máquina: nenhum caminho fixo; variáveis `PROPERTY_FULL`, `NAMES_FULL_CHECK`, `MATCH_METRICS`, `FANS_METRICS`, `REQUIRE_SITE_DIST` só em testes; `og.mjs` cria o `fontconfig` em diretório temporário próprio. `.nvmrc` 22.23.4 bate com `engines`.
- `/balance`: reprodutível por semente com `worker_threads` em ordem fixa; `robot.ts` é "humano bom" fora do motor (duplicação com `inplay.ts` é intencional e documentada).

## Decisões para o CEO

1. `lastRound` sai do `GameState` (vai para `CareerSave.career`/D1) ou emagrece (sem os mapas por jogador) antes do formato do save congelar na T-019? (achado 1)
2. `index.ts` passa a exportar só o contrato do §4.1, com lint que proíba importar internos do motor fora dele, inclusive no site e no `/balance`? (achados 2 e 3)
3. Tolerância a estado antigo é do motor ou só de `lib/save/migrations/`? (achado 6)
4. `ClubDef` congelado no save: a lista de clubes de dezembro vale só para carreira nova, ou haverá migração que atualize nomes e escudos dos saves existentes? (achado 12)
5. `content:check` fica só com conteúdo e os testes de aceite do motor saem de `app/src/data/`? (achado 8)
6. `match-metrics.test.ts` é aposentado em favor do `/balance` como único relatório de calibragem? (achado 9)
